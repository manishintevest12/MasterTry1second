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

// ---------- product-comparison view (owner 21 Oct, image-1 design) ----------
const SVG_SHARE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M12 15V3"/><path d="M7 8l5-5 5 5"/></svg>';
const SVG_COPY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';
const SVG_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';

const faviconOf = (u) => {
  const d = String(u || '').replace(/^https:\/\//, '').split('/')[0];
  return d ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=64` : '';
};

/** Footer "Open Try1Second" deep-links to the PRODUCT COMPARISON page when we
 *  know the product (owner 21 Oct) — never the bare home page for a product. */
async function setFooterToProduct(title) {
  const link = $('#open-t1s');
  if (!link) return;
  try { link.href = title ? (await try1secondProductUrl(title)) : 'https://www.try1second.com'; }
  catch { link.href = 'https://www.try1second.com'; }
}

/**
 * Image-1 comparison view: a product card (merchant pill, name, big price,
 * share/copy) and a "Compare N Available Prices" card with one row per
 * price-owning site, a green "Lowest price" badge on the cheapest and a
 * chevron. Every number comes from the real backend — nothing invented.
 * rows: [{ seller, subtitle, price, logo, goUrl?, sellerUrl?, offerId? }]
 */
async function renderCompareView(box, { title, seller, price, image = '', save = 0, rows }) {
  const sorted = rows.filter((r) => Number(r.price) > 0).sort((a, b) => Number(a.price) - Number(b.price));
  if (!sorted.length) return;
  const lowest = sorted[0];
  let pageUrl = 'https://www.try1second.com';
  try { pageUrl = await try1secondProductUrl(title); } catch { /* keep home */ }
  const pillLogo = faviconOf(sorted.find((r) => r.sellerUrl)?.sellerUrl || '') || lowest.logo;
  const cmp = document.createElement('div');
  cmp.className = 't1s-cmp';
  cmp.innerHTML = `
    <div class="t1s-pcard">
      <div class="t1s-pill">${pillLogo ? `<img src="${esc(pillLogo)}" alt="" onerror="this.style.display='none'" />` : ''}<span>${esc(seller || lowest.seller || 'Best price')}</span></div>
      <div class="t1s-pcard-main">
        ${image ? `<img class="t1s-thumb" src="${esc(image)}" alt="" onerror="this.style.display='none'" />` : ''}
        <div class="t1s-pcard-txt">
          <div class="t1s-pcard-name">${esc(title)}</div>
          <div class="t1s-pcard-price">${inr(Number(price) || Number(lowest.price))}</div>
        </div>
      </div>
      ${save > 0 ? `<div class="t1s-pcard-save">Saves ${inr(save)} vs this page</div>` : ''}
      <div class="t1s-pcard-actions">
        <button class="t1s-iconbtn" data-act="share" title="Share this comparison">${SVG_SHARE}</button>
        <button class="t1s-iconbtn" data-act="copy" title="Copy comparison link">${SVG_COPY}</button>
      </div>
    </div>
    <div class="t1s-ccard">
      <div class="t1s-ccard-head">Compare ${sorted.length} Available Price${sorted.length > 1 ? 's' : ''}</div>
      ${sorted.map((r, i) => `
      <div class="t1s-crow" data-i="${i}">
        <img class="t1s-clogo" src="${esc(r.logo || '')}" alt="" onerror="this.style.visibility='hidden'" />
        <div class="t1s-cmid">
          <div class="t1s-csite">${esc(r.seller || 'Verified source')}</div>
          <div class="t1s-csub">${esc(String(r.subtitle || title || '').slice(0, 36))}</div>
        </div>
        <div class="t1s-cright">
          <span class="t1s-cprice">${inr(Number(r.price))}</span>
          ${r === lowest && sorted.length > 1 ? '<span class="t1s-lowest">Lowest price</span>' : ''}
        </div>
        <svg class="t1s-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
      </div>`).join('')}
    </div>`;
  // Row click → THAT site's own listing via the safe /api/go redirect.
  cmp.querySelectorAll('.t1s-crow').forEach((rowEl) => {
    const r = sorted[Number(rowEl.dataset.i)];
    rowEl.addEventListener('click', async () => {
      try {
        if (r.goUrl) return chrome.tabs.create({ url: new URL(r.goUrl, 'https://www.try1second.com').href });
        if (r.sellerUrl) return chrome.tabs.create({ url: await apiGo(r.sellerUrl, r.offerId) });
        chrome.tabs.create({ url: pageUrl });
      } catch { chrome.tabs.create({ url: pageUrl }); }
    });
  });
  // Share / copy both hand out the website's product-comparison deep link.
  const actBtn = (which, fn) => {
    const btn = cmp.querySelector(`[data-act="${which}"]`);
    if (!btn) return;
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await fn();
      const orig = btn.innerHTML;
      btn.innerHTML = SVG_CHECK;
      setTimeout(() => { btn.innerHTML = orig; }, 1400);
    });
  };
  actBtn('share', async () => {
    if (navigator.share) { try { await navigator.share({ title: title || 'Try1Second', url: pageUrl }); return; } catch { /* cancelled → copy */ } }
    await navigator.clipboard.writeText(pageUrl);
  });
  actBtn('copy', async () => { await navigator.clipboard.writeText(pageUrl); });
  box.appendChild(cmp);
}

// ---------- search ----------
async function doLens(input) {
  const box = $('#results');
  box.innerHTML = spinnerRow('Finding your best price… checking every store right now. Please wait, we are getting the best deal for you.');
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
    const title = res.product?.title || rows[0]?.title || '';
    const save = res.pageVsCheapest && res.pageVsCheapest.saving > 0 ? res.pageVsCheapest.saving : 0;
    box.innerHTML = '';
    await renderCompareView(box, {
      title,
      seller: rows[0].seller,
      price: rows[0].price,
      image: imgOf(rows[0]),
      save,
      rows: rows.map((r) => ({ seller: r.seller, subtitle: r.title, price: Number(r.price) || 0, logo: faviconOf(r.sellerUrl), goUrl: r.goUrl })),
    });
    setFooterToProduct(title);
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
/** Honest product image (https-only, straight from the offer's attributes). */
function imgOf(r) {
  const a = (r && r.attributes) || {};
  if (/^https:/.test(a.image_url || '')) return a.image_url;
  const many = String(a.image_urls || '').split('|').filter((x) => /^https:/.test(x));
  return many[0] || '';
}

// ---------- smart page routing (auto-grab) ----------
/** Search pages on these hosts belong to these verticals (not e-commerce). */
const HOST_VERTICALS = {
  'blinkit.com': 'grocery', 'bigbasket.com': 'grocery', 'zeptonow.com': 'grocery', 'jiomart.com': 'grocery',
  'swiggy.com': 'food', 'zomato.com': 'food', 'dominos.co.in': 'food',
  'bookmyshow.com': 'movies',
};

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
  if ((isSearchPath || term) && term) return { kind: 'search', query: term, vertical: HOST_VERTICALS[host] || 'ecommerce' };
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
      if (product && product.routeOnly) {
        const route = product.routeQuery || product.title;
        $('#q').value = route;
        $('#results').innerHTML = `
          <div class="t1s-lens-best">
            <div class="t1s-lens-head">Route detected on this page</div>
            <div class="t1s-item-title">${esc(route)}</div>
            <div class="t1s-item-row">
              <div class="t1s-item-more">Compare live fares for this exact route on Try1Second.</div>
              <button class="t1s-btn t1s-item-open" id="t1s-route-hop">Compare</button>
            </div>
          </div>`;
        $('#results').querySelector('#t1s-route-hop').addEventListener('click', async () => {
          chrome.tabs.create({ url: await try1secondSearchUrl(route) });
          window.close();
        });
        return;
      }
    } catch { /* no content script on this page */ }
  }

  const kind = classifyMerchantUrl(url);
  if (kind.kind === 'search' && kind.query) {
    $('#q').value = kind.query;
    return doVerticalSearch(kind.query, kind.vertical || 'ecommerce');
  }
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
  box.innerHTML = spinnerRow(`Finding the best price for "${query}"… checking every store right now. Please wait, we are getting the best deal for you.`);
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
      await renderCompareView(box, {
        title: best.title,
        seller: best.seller || best.vendor,
        price: priceOf(best),
        image: imgOf(best),
        rows: g.offers.map((o) => ({
          seller: o.seller || o.vendor || 'Verified source',
          subtitle: o.title,
          price: priceOf(o),
          logo: faviconOf(o.sellerUrl),
          sellerUrl: o.sellerUrl,
          offerId: o.id,
        })),
      });
    }
    setFooterToProduct(query);
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
  const { t1sPrefs = {} } = await chrome.storage.sync.get('t1sPrefs').catch(async () => await chrome.storage.local.get('t1sPrefs'));
  $('#set-dock').checked = t1sPrefs.dockVisible !== false;
}
$('#save-settings').addEventListener('click', async () => {
  // keep the rail toggle in sync with the saved prefs (same store the rail reads)
  try {
    const store = chrome.storage.sync;
    const { t1sPrefs = {} } = await store.get('t1sPrefs');
    t1sPrefs.dockVisible = $('#set-dock').checked !== false;
    await store.set({ t1sPrefs });
  } catch { /* storage blocked — rail falls back to defaults (visible) */ }
  await chrome.storage.local.set({
    t1sCity: $('#set-city').value.trim(),
    t1sPincode: $('#set-pincode').value.trim(),
    t1sApiBase: $('#set-api').value.trim(),
  });
  $('#save-ok').classList.remove('hidden');
  setTimeout(() => $('#save-ok').classList.add('hidden'), 1600);
});

// v1.8.5 recovery: unhide the rail on every site it was hidden from. The old
// in-logo X made accidental permanent hides far too easy (recurring owner
// report: "sidebar not showing") — this is the one-click way back.
$('#restore-dock').addEventListener('click', async () => {
  try {
    await chrome.storage.local.set({ t1sDockHidden: [] });
    const { t1sPrefs = {} } = await chrome.storage.sync.get('t1sPrefs').catch(async () => await chrome.storage.local.get('t1sPrefs'));
    t1sPrefs.dockVisible = true;
    await chrome.storage.sync.set({ t1sPrefs }).catch(() => chrome.storage.local.set({ t1sPrefs }));
    $('#restore-ok').classList.remove('hidden');
    setTimeout(() => $('#restore-ok').classList.add('hidden'), 2200);
  } catch { /* best effort */ }
});

loadSettings();
renderDropsBadge();
renderTracked();
