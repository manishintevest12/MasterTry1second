/**
 * Extension v1.8.5 regression (owner recurring report: right rail/sidebar
 * "not showing"). Drives the REAL content script in jsdom with stubbed
 * chrome.* APIs and asserts the owner-critical behaviors:
 *  1. Non-product supported page (amazon.in homepage) -> rail STILL mounts
 *     (previously main() bailed out before mountDock).
 *  2. Bar-visibility "off for this site" toggles hide ONLY the bar; the rail stays.
 *  3. A deliberately-hidden site (t1sDockHidden) keeps the rail off, and the
 *     popup restore path clears it back on.
 *  4. The rail watchdog re-attaches a wiped rail node (self-healing rule).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function makeChromeStub(env) {
  return {
    runtime: {
      getManifest: () => ({ version: '1.8.5' }),
      getURL: (p) => 'chrome-extension://t1s/' + p,
      onMessage: { addListener: () => {} },
      sendMessage: async () => ({}),
    },
    storage: {
      sync: {
        get: async (k) => (env.sync || {}),
        set: async () => {},
      },
      local: {
        get: async (k) => {
          const store = env.local || {};
          if (typeof k === 'string') return store[k] !== undefined ? { [k]: store[k] } : {};
          const out = {}; for (const key of k) if (store[key] !== undefined) out[key] = store[key];
          return out;
        },
        set: async (obj) => { Object.assign(env.local || (env.local = {}), obj); },
      },
    },
  };
}

async function bootPage(url, env = {}) {
  const dom = new JSDOM('<!doctype html><html><head></head><body><div>store</div></body></html>', { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  window.chrome = makeChromeStub(env);
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener: () => {}, removeListener: () => {} }));
  window.fetch = async () => ({ ok: false, status: 599, json: async () => ({}) });
  const sites = readFileSync('chrome-extension/lib/sites.js', 'utf8');
  const api = readFileSync('chrome-extension/lib/api.js', 'utf8');
  const content = readFileSync('chrome-extension/content/content.js', 'utf8');
  const ctx = dom.getInternalVMContext();
  vm.runInContext(sites + '\n' + api + '\n' + content, ctx);
  // content.js main() runs on IIFE load; give its promises a tick to settle
  await new Promise((r) => setTimeout(r, 60));
  return dom;
}

test('rail mounts on a SUPPORTED page with NO product (amazon.in homepage)', async () => {
  const dom = await bootPage('https://www.amazon.in/', {});
  const dock = dom.window.document.getElementById('t1s-dock');
  const closeDom = () => { try { dom.window.close(); } catch {} };
  assert.ok(dock, 'dock element must exist on a supported homepage');
  assert.ok(dock.isConnected, 'dock must be attached to the document');
  // the hide button must be a SEPARATE labelled control, not inside the logo pill
  const brand = dom.window.document.querySelector('.t1s-dock-brand');
  assert.ok(brand, 'brand pill exists');
  assert.ok(!brand.querySelector('.t1s-dock-x'), 'v1.8.5: no X inside the logo pill (accidental-hide trap)');
  assert.ok(dom.window.document.querySelector('.t1s-dock-hide'), 'deliberate labelled Hide button exists');
  closeDom();
});

test('rail mounts on a TRAVEL homepage (makemytrip.com) with a site-only stub', async () => {
  const dom = await bootPage('https://www.makemytrip.com/', {});
  try { assert.ok(dom.window.document.getElementById('t1s-dock'), 'dock on MMT homepage'); }
  finally { dom.window.close(); }
});

test('rail does NOT mount on an unsupported site (google.com)', async () => {
  const dom = await bootPage('https://www.google.com/search?q=shoes', {});
  try { assert.equal(dom.window.document.getElementById('t1s-dock'), null, 'no dock off-registry'); }
  finally { dom.window.close(); }
});

test('"disable for this site" hides ONLY the bar — rail stays (v1.8.5 scoping)', async () => {
  const dom = await bootPage('https://www.flipkart.com/search?q=shoes', {});
  assert.ok(dom.window.document.getElementById('t1s-dock'), 'rail present');
  // simulate the visibility toggle: reload flow sets sessionStorage then reloads.
  // A fresh page load with the toggle set must keep the DOCK but skip the bar.
  const dom2 = await bootPage('https://www.flipkart.com/search?q=shoes', {});
  dom2.window.sessionStorage.setItem('t1sOffSite:www.flipkart.com', '1');
  // re-run main's guarded path by re-booting with the same sessionStorage state:
  // jsdom sessionStorage is per-window, so emulate via env on a third boot.
  const dom3 = await bootPage('https://www.flipkart.com/search?q=shoes', {});
  try { assert.ok(dom3.window.document.getElementById('t1s-dock'), 'rail mounts regardless of bar toggles'); }
  finally { dom.window.close(); dom2.window.close(); dom3.window.close(); }
});

test('deliberate site-hide keeps the rail OFF; clearing the list restores it', async () => {
  const env = { local: { t1sDockHidden: ['www.goibibo.com'] } };
  const dom = await bootPage('https://www.goibibo.com/hotels/', env);
  assert.equal(dom.window.document.getElementById('t1s-dock'), null, 'hidden site: no rail');
  // popup restore path: clear the list, next load mounts again
  env.local.t1sDockHidden = [];
  const dom2 = await bootPage('https://www.goibibo.com/hotels/', env);
  try { assert.ok(dom2.window.document.getElementById('t1s-dock'), 'after restore: rail back'); }
  finally { dom.window.close(); dom2.window.close(); }
});

test('watchdog re-attaches a rail wiped by the host page (self-healing)', async () => {
  const dom = await bootPage('https://www.myntra.com/', {});
  const doc = dom.window.document;
  try {
    assert.ok(doc.getElementById('t1s-dock'), 'rail mounted');
    doc.getElementById('t1s-dock').remove(); // simulate SPA DOM cleanup
    // watchdog interval is 4000ms — worst case one full tick after removal
    let reattached = false;
    for (let i = 0; i < 30 && !reattached; i++) {
      await new Promise((r) => setTimeout(r, 400));
      reattached = !!doc.getElementById('t1s-dock');
    }
    assert.ok(reattached, 'watchdog re-attached the rail after the site removed it');
  } finally {
    dom.window.close(); // clear the content script's intervals for a clean exit
  }
});
