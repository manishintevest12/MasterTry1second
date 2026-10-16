importScripts("../lib/api.js"); // shared backend client (plain script, MV3 classic worker)
/**
 * Try1Second extension — MV3 service worker.
 * Polls the REAL backend for tracked products on an alarm and fires a
 * notification when the verified price drops below the recorded price.
 * No fabricated prices: a tracked item updates only from live API responses.
 */
'use strict';

const ALARM_NAME = 't1s-price-watch';
const POLL_PERIOD_MIN = 30;

chrome.runtime.onInstalled.addListener(async () => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: POLL_PERIOD_MIN, delayInMinutes: 1 });
  await chrome.storage.local.set({ t1sDrops: 0 });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: POLL_PERIOD_MIN, delayInMinutes: 1 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) await pollTracked();
});

// Popup asks the worker to re-check immediately after settings changes.
// Content-script fetch bridge: content scripts can't do cross-origin fetches,
// so they relay through this worker (which holds host_permissions).
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 't1s-fetch') {
    fetch(msg.url, msg.options || {})
      .then(async (res) => {
        if (!res.ok) {
          let detail = `HTTP ${res.status}`;
          try { const j = await res.json(); if (j?.error) detail = j.error; } catch { /* not json */ }
          return sendResponse({ ok: false, error: detail });
        }
        sendResponse({ ok: true, data: await res.json() });
      })
      .catch((err) => sendResponse({ ok: false, error: err?.message || 'network error' }));
    return true; // keep the message channel open for the async response
  }
  if (msg?.type === 't1s-poll-now') {
    pollTracked().then(() => sendResponse({ done: true }));
    return true; // async response
  }
  if (msg?.type === 't1s-clear-drops') {
    chrome.storage.local.set({ t1sDrops: 0 }).then(() => refreshBadge()).then(() => sendResponse({ done: true }));
    return true;
  }
});

async function pollTracked() {
  const { t1sTracked = [] } = await chrome.storage.local.get('t1sTracked');
  const { t1sCity = '', t1sPincode = '' } = await chrome.storage.local.get(['t1sCity', 't1sPincode']);
  // owner-set preferences (v1.6.0 settings toggles)
  let prefs = { showBar: true, dropNotifications: true };
  try {
    const { t1sPrefs = {} } = await chrome.storage.sync.get('t1sPrefs');
    prefs = Object.assign(prefs, t1sPrefs);
  } catch {
    const { t1sPrefs = {} } = await chrome.storage.local.get('t1sPrefs');
    prefs = Object.assign(prefs, t1sPrefs);
  }
  let drops = 0;
  const updated = [];

  for (const item of t1sTracked) {
    try {
      const res = await apiSearch(item.query, { city: t1sCity, pincode: t1sPincode });
      const match = pickMatchingResult(res.results, item.query, item.canonicalEntityId);
      const price = match ? priceOf(match) : 0;
      if (price > 0) {
        const prev = Number(item.lastPrice) || 0;
        if (prev > 0 && price < prev) {
          drops++;
          if (prefs.dropNotifications) notifyDrop(item, price, prev);
          item.lastPrice = price;
        } else if (price !== prev) {
          item.lastPrice = price;
        }
        // Price Alerts (sidebar, v1.6.0): notify ONCE when a target set by the
        // user is crossed by a VERIFIED live price; re-arms if it climbs back above.
        const target = Number(item.target) || 0;
        if (target > 0 && price <= target && !item.targetHit && prefs.dropNotifications) {
          notifyTarget(item, price, target);
          item.targetHit = true;
        } else if (target > 0 && price > target) {
          item.targetHit = false;
        }
      }
      // backend had no verified offer -> keep item untouched (honest, no guess)
    } catch {
      /* backend unreachable this cycle — retry on next alarm */
    }
    updated.push(item);
  }

  await chrome.storage.local.set({ t1sTracked: updated, t1sLastPollAt: Date.now() });
  if (drops > 0) {
    const { t1sDrops = 0 } = await chrome.storage.local.get('t1sDrops');
    await chrome.storage.local.set({ t1sDrops: t1sDrops + drops });
  }
  await refreshBadge();
}

function notifyTarget(item, price, target) {
  chrome.notifications.create(`t1s-target-${item.key}-${Date.now()}`, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title: 'Target price reached',
    message: `${item.title.slice(0, 90)}
Now ${inr(price)} — your target was ${inr(target)} on Try1Second`,
    priority: 2,
  });
}

function notifyDrop(item, newPrice, oldPrice) {
  const diff = oldPrice - newPrice;
  chrome.notifications.create(`t1s-drop-${item.key}-${Date.now()}`, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title: 'Price drop detected',
    message: `${item.title.slice(0, 90)}\n${inr(oldPrice)} → ${inr(newPrice)} (−${inr(diff)}) on Try1Second`,
    priority: 2,
  });
}

chrome.notifications.onClicked.addListener((notifId) => {
  chrome.notifications.clear(notifId);
  chrome.tabs.create({ url: 'https://www.try1second.com' });
});

chrome.action.setBadgeBackgroundColor({ color: '#E11D48' });
