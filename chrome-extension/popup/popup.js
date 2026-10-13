/** Try1Second popup logic. All prices come from the real backend API. */
'use strict';

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- tabs ----------
document.querySelectorAll('.t1s-tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.t1s-tab').forEach((b) => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.t1s-panel').forEach((p) => p.classList.add('hidden'));
    $(`#tab-${btn.dataset.tab}`).classList.remove('hidden');
    if (btn.dataset.tab === 'tracked') renderTracked();
  });
});

// ---------- search ----------
async function doSearch() {
  const q = $('#q').value.trim();
  const box = $('#results');
  if (!q) return;
  box.innerHTML = spinnerRow('Searching across sites…');
  try {
    const { t1sCity = '', t1sPincode = '' } = await chrome.storage.local.get(['t1sCity', 't1sPincode']);
    const res = await apiSearch(q, { city: t1sCity, pincode: t1sPincode });
    const groups = groupByEntity(res.results)
      .filter((g) => g.best && priceOf(g.best) > 0)
      .sort((a, b) => priceOf(a.best) - priceOf(b.best));
    if (!groups.length) {
      box.innerHTML = `<div class="t1s-status t1s-muted">No verified offers right now for "${esc(q)}". Try1Second does not show unverified prices.</div>`;
      return;
    }
    box.innerHTML = '';
    for (const g of groups.slice(0, 8)) {
      const best = g.best;
      const div = document.createElement('div');
      div.className = 't1s-item';
      div.innerHTML = `
        <div class="t1s-item-title">${esc(best.title)}</div>
        <div class="t1s-item-row">
          <div>
            <span class="t1s-item-price">${inr(priceOf(best))}</span>
            <div class="t1s-item-site">${esc(best.seller || best.vendor || '')}</div>
            <div class="t1s-item-more">+${g.offers.length - 1} more site${g.offers.length > 2 ? 's' : ''} compared</div>
          </div>
          <button class="t1s-btn t1s-item-open">Open</button>
        </div>`;
      div.querySelector('.t1s-item-open').addEventListener('click', async () => {
        try {
          const url = await apiGo(best.sellerUrl, best.id);
          chrome.tabs.create({ url });
        } catch { chrome.tabs.create({ url: await try1secondSearchUrl(q) }); }
      });
      box.appendChild(div);
    }
  } catch (err) {
    box.innerHTML = `<div class="t1s-status t1s-muted">Try1Second unreachable (${esc(err.message || 'error')}). No prices were invented.</div>`;
  }
}
$('#go').addEventListener('click', doSearch);
$('#q').addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });

const spinnerRow = (msg) => `<div class="t1s-status"><span class="t1s-spin"></span>${esc(msg)}</div>`;

// ---------- tracked ----------
async function renderTracked() {
  const list = await getTracked();
  $('#tracked-count').textContent = String(list.length);
  const box = $('#tracked-list');
  if (!list.length) {
    box.innerHTML = '<div class="t1s-status t1s-muted">Nothing tracked yet. Open a product page on Amazon, Flipkart, Myntra, Ajio, Tata CLiQ or Meesho and press "Track price".</div>';
  } else {
    box.innerHTML = '';
    for (const item of list) {
      const div = document.createElement('div');
      div.className = 't1s-item';
      div.innerHTML = `
        <div class="t1s-item-title">${esc(item.title)}</div>
        <div class="t1s-item-row">
          <div>
            <span class="t1s-item-price">${inr(item.lastPrice)}</span>
            <div class="t1s-item-more">tracked from ${esc(item.site || 'web')}</div>
          </div>
          <button class="t1s-btn t1s-remove" title="Stop tracking">✕</button>
        </div>`;
      div.querySelector('.t1s-remove').addEventListener('click', async () => {
        const l = (await getTracked()).filter((t) => t.key !== item.key);
        await saveTracked(l);
        renderTracked();
      });
      box.appendChild(div);
    }
  }
  const { t1sLastPollAt = 0 } = await chrome.storage.local.get('t1sLastPollAt');
  $('#last-poll').textContent = t1sLastPollAt ? `last check: ${new Date(t1sLastPollAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : '';
}

$('#poll-now').addEventListener('click', async () => {
  $('#poll-now').textContent = 'Checking…';
  await chrome.runtime.sendMessage({ type: 't1s-poll-now' });
  $('#poll-now').textContent = 'Check prices now';
  renderTracked();
  renderDropsBadge();
});

// ---------- drops badge ----------
async function renderDropsBadge() {
  const { t1sDrops = 0 } = await chrome.storage.local.get('t1sDrops');
  const badge = $('#drops-badge');
  if (t1sDrops > 0) {
    badge.textContent = `${t1sDrops} price drop${t1sDrops > 1 ? 's' : ''}`;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
  $('#tracked-count').textContent = String((await getTracked()).length);
}
$('#drops-badge').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 't1s-clear-drops' });
  renderDropsBadge();
});

// ---------- settings ----------
async function loadSettings() {
  const { t1sCity = '', t1sPincode = '', t1sApiBase = '' } = await chrome.storage.local.get(['t1sCity', 't1sPincode', 't1sApiBase']);
  $('#set-city').value = t1sCity;
  $('#set-pincode').value = t1sPincode;
  $('#set-api').value = t1sApiBase;
}
$('#save-settings').addEventListener('click', async () => {
  await chrome.storage.local.set({
    t1sCity: $('#set-city').value.trim(),
    t1sPincode: $('#set-pincode').value.trim(),
    t1sApiBase: $('#set-api').value.trim(),
  });
  $('#save-ok').classList.remove('hidden');
  setTimeout(() => $('#save-ok').classList.add('hidden'), 1600);
});

loadSettings();
renderDropsBadge();
renderTracked();
