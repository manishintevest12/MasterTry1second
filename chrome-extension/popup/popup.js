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
async function doLens(input) {
  const box = $('#results');
  box.innerHTML = spinnerRow('Reading the product and comparing live prices…');
  try {
    const res = await apiLens(input);
    if (!res.found) {
      box.innerHTML = `<div class="t1s-status t1s-muted">${esc(res.message || 'Could not read a product from that link. Try typing the product name.')}</div>`;
      return;
    }
    const rows = res.results || [];
    if (!rows.length) {
      box.innerHTML = `<div class="t1s-status t1s-muted">${esc(res.message || 'No verified listing of this exact product right now.')}</div>`;
      return;
    }
    const best = rows[0];
    const saving = res.pageVsCheapest && res.pageVsCheapest.saving > 0 ? `<div class="t1s-lens-save">Saves ${inr(res.pageVsCheapest.saving)} vs this page</div>` : '';
    box.innerHTML = `
      <div class="t1s-lens-best">
        <div class="t1s-lens-head">Cheapest we found</div>
        <div class="t1s-item-title">${esc(res.product?.title || '')}</div>
        <div class="t1s-item-row">
          <div>
            <span class="t1s-item-price">${inr(best.price)}</span>
            <div class="t1s-item-site">${esc(best.seller)}</div>
            ${saving}
          </div>
          <button class="t1s-btn t1s-item-open" data-go="0">Buy</button>
        </div>
      </div>`;
    box.querySelector('[data-go="0"]').addEventListener('click', () => { if (best.goUrl) chrome.tabs.create({ url: (new URL(best.goUrl, 'https://www.try1second.com')).href }); });
    for (const [i, r] of rows.slice(1, 8).entries()) {
      const div = document.createElement('div');
      div.className = 't1s-item';
      div.innerHTML = `
        <div class="t1s-item-row">
          <div><div class="t1s-item-site"><strong>${esc(r.seller)}</strong></div><div class="t1s-item-more">${esc((r.title || '').slice(0, 60))}</div></div>
          <div style="text-align:right"><span class="t1s-item-price">${inr(r.price)}</span><br/><button class="t1s-btn t1s-item-open" data-go="${i + 1}">Open</button></div>
        </div>`;
      div.querySelector('[data-go]').addEventListener('click', () => { if (r.goUrl) chrome.tabs.create({ url: (new URL(r.goUrl, 'https://www.try1second.com')).href }); });
      box.appendChild(div);
    }
  } catch (err) {
    box.innerHTML = `<div class="t1s-status t1s-muted">Try1Second unreachable (${esc(err.message || 'error')}). No prices were invented.</div>`;
  }
}

async function doSearch(vertical) {
  const q = $('#q').value.trim();
  if (!q) return;
  if (!vertical && looksLikeLink(q)) return pageFlow(q);
  return doVerticalSearch(q, vertical || 'ecommerce');
}
// ---------- smart page routing (auto-grab) ----------
/** What kind of merchant page is this URL? */
function classifyMerchantUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { return { kind: 'none' }; }
  const host = u.hostname.replace(/^www\./, '');
  const q = (name) => (u.searchParams.get(name) || '').trim();
  // product pages
  const productHosts = /(^|\.)(amazon\.(in|com)|flipkart\.com|myntra\.com|ajio\.com|tatacliq\.com|meesho\.com|blinkit\.com|bigbasket\.com|zeptonow\.com|jiomart\.com)$/;
  if (!productHosts.test(host)) return { kind: 'none' };
  const path = u.pathname;
  const isAmazonProduct = /\/dp\//.test(path) || /\/gp\/product\//.test(path);
  const isFlipkartProduct = /\/p\//.test(path);
  if (isAmazonProduct || isFlipkartProduct) return { kind: 'product' };
  // search / listing pages: the user's own query is in the URL
  // (flipkart ?q=, amazon ?k=, ajio ?query=, tatacliq ?searchText=term:relevance:...)
  const isSearchPath = /^\/(search|s|gp\/search)(\/|$)/.test(path);
  let term = q('q') || q('k') || q('query') || q('originalSearchText') || '';
  if (!term) {
    const st = q('searchText'); // tatacliq packs 'term:relevance:inStockFlag:true'
    if (st) term = st.split(':')[0];
  }
  term = term.replace(/\+/g, ' ').replace(/[-_]+/g, ' ').trim();
  if ((isSearchPath || term) && term) return { kind: 'search', query: term };
  // any other page on a merchant host: the content script may still know more
  return { kind: 'unknown' };
}

const SEARCH_PRODUCT_VERTICALS = new Set(['ecommerce', 'grocery', 'food', 'movies', 'bus']);

/** Route an auto-grabbed / pasted URL: content-script product > product page > search page. */
async function pageFlow(url, { auto = false } = {}) {
  const box = $('#results');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // 1) Ask the page's content script what it detected (title + vertical).
  if (tab && tab.id) {
    try {
      const reply = await chrome.tabs.sendMessage(tab.id, { type: 't1s-get-product' });
      const product = reply && reply.product;
      if (product && product.title && !product.routeOnly && SEARCH_PRODUCT_VERTICALS.has(product.vertical || 'ecommerce')) {
        $('#q').value = url;
        return doVerticalSearch(product.title, product.vertical || 'ecommerce');
      }
    } catch { /* no content script on this page */ }
  }

  const kind = classifyMerchantUrl(url);
  if (kind.kind === 'product') {
    $('#q').value = url;
    return doLens(url);
  }
  if (kind.kind === 'search' && kind.query) {
    $('#q').value = kind.query;
    return doVerticalSearch(kind.query, 'ecommerce');
  }
  if (/^https?:\/\//i.test(url)) {
    // product link on any other host (Myntra /buy, Croma, Nykaa...): the lens
    // resolves it honestly from the page's own JSON-LD / og / title / slug.
    $('#q').value = url;
    return doLens(url);
  }
  if (auto) {
    box.innerHTML = '<div class="t1s-status t1s-muted">Open a product or search page on a supported store (Amazon, Flipkart, Myntra, Ajio, Tata CLiQ, Meesho, Blinkit, BigBasket…) and Try1Second compares it automatically.</div>';
  } else {
    box.innerHTML = '<div class="t1s-status t1s-muted">That page has no readable product or search query. Paste a product link or type a product name.</div>';
  }
}

/** Grouped vertical results list (the "vertical view" the popup shows for searches). */
async function doVerticalSearch(query, vertical) {
  const box = $('#results');
  box.innerHTML = spinnerRow(`Searching "${query}" across sites…`);
  try {
    const { t1sCity = '', t1sPincode = '' } = await chrome.storage.local.get(['t1sCity', 't1sPincode']);
    const res = await apiSearch(query, { vertical, city: t1sCity, pincode: t1sPincode });
    const groups = groupByEntity(res.results)
      .filter((g) => g.best && priceOf(g.best) > 0)
      .sort((a, b) => priceOf(a.best) - priceOf(b.best));
    if (!groups.length) {
      box.innerHTML = `<div class="t1s-status t1s-muted">No verified offers right now for "${esc(query)}". Try1Second does not show unverified prices.</div>`;
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
        } catch { chrome.tabs.create({ url: await try1secondSearchUrl(query) }); }
      });
      box.appendChild(div);
    }
  } catch (err) {
    box.innerHTML = `<div class="t1s-status t1s-muted">Try1Second unreachable (${esc(err.message || 'error')}). No prices were invented.</div>`;
  }
}

$('#go').addEventListener('click', () => doSearch());
$('#check-page').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab && tab.url;
  if (!url || !/^https?:\/\//i.test(url)) {
    $('#results').innerHTML = '<div class="t1s-status t1s-muted">Open a product page first, then press this button.</div>';
    return;
  }
  pageFlow(url);
});
$('#q').addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });

// AUTO-GRAB: on popup open, read the active tab and run the right flow at once.
(async function autoGrab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab && tab.url;
    if (!url || !/^https?:\/\//i.test(url)) return;
    const kind = classifyMerchantUrl(url);
    if (kind.kind === 'none') return; // nothing useful on this page; leave the box empty
    $('#q').value = kind.kind === 'search' ? kind.query : url;
    pageFlow(url, { auto: true });
  } catch { /* popup closing etc. */ }
})();

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
