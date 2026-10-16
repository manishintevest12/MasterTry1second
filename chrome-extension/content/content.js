/**
 * Try1Second extension — content script (v1.4.0, all verticals).
 *
 * On every supported merchant page (e-commerce, grocery, food, movies, travel)
 * this injects:
 *   1. a floating bar (bottom-right, per the owner's design reference):
 *        [TRY1SECOND badge] [ATL / Best price] [Auto-Test Coupons] [panel toggle]
 *   2. the full Try1Second panel (cross-site comparison, real price history,
 *      track button) for pages where a product/entity can be detected.
 *
 * No-fabrication rule: every number comes from the real Try1Second backend.
 * When nothing is verified, the bar honestly shows "—" and says so.
 */
'use strict';

(function () {
  const PANEL_ID = 't1s-panel';
  const BAR_ID = 't1s-floating-bar';
  let state = { collapsed: false, tracking: false, couponsOpen: false, product: null, prefs: { showBar: true, dropNotifications: true } };

  // ---------- helpers --------------------------------------------------

  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    return n;
  };

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const logoSvg = `
    <span class="t1s-lockup" role="img" aria-label="Try1Second">
      <span class="t1s-ic"><img src="${chrome.runtime.getURL('images/logo-icon.png')}" alt="" /><span class="t1s-ring"></span><span class="t1s-sweep"></span><svg class="t1s-spark" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0L14 9.5 24 12 14 14.5 12 24 10 14.5 0 12 10 9.5Z" fill="#fff"/></svg></span>
      <img class="t1s-wd" src="${chrome.runtime.getURL('images/logo-wordmark.png')}" alt="" />
    </span>`;

  const PRODUCT_VERTICALS = new Set(['ecommerce', 'grocery']);
  const SEARCH_VERTICALS = new Set(['ecommerce', 'grocery', 'food', 'movies', 'bus']);

  // ---------- floating bar (owner design reference) --------------------

  function buildBar() {
    const bar = el('div');
    bar.id = BAR_ID;
    bar.className = 't1s-bar';
    bar.innerHTML = `
      <span class="t1s-bar-badge">TRY1SECOND</span>
      <span class="t1s-bar-atl" title="All-time low verified by Try1Second (real recorded prices only)">ATL: <b>…</b></span>
      <button type="button" class="t1s-bar-coupon">Auto-Test Coupons</button>
      <button type="button" class="t1s-bar-toggle" title="Open the Try1Second panel">&#9432;</button>
      <div class="t1s-bar-coupons" hidden></div>`;
    document.documentElement.appendChild(bar);
    return bar;
  }

  function setBarPrice(bar, text, muted) {
    const node = bar.querySelector('.t1s-bar-atl');
    node.innerHTML = `ATL: <b>${esc(text)}</b>`;
    node.classList.toggle('t1s-bar-muted', !!muted);
  }

  /** Auto-Test Coupons: pulls this merchant's LIVE coupons from the backend and
   *  lists them with one-tap copy. Codes come from Try1Second's acquired/admin
   *  deal registry — nothing is invented; no live coupon = honest empty state. */
  async function renderCoupons(bar, product) {
    const box = bar.querySelector('.t1s-bar-coupons');
    state.couponsOpen = !state.couponsOpen;
    box.hidden = !state.couponsOpen;
    if (!state.couponsOpen) return;
    box.innerHTML = `<div class="t1s-status"><span class="t1s-spinner"></span>Fetching live coupons…</div>`;
    let deals = [];
    try {
      deals = await apiDeals(merchantKeyFor(product.site));
      if (!deals.length) deals = await apiDeals(merchantKeyFor(product.site).split('-')[0]);
    } catch { deals = []; }
    if (!deals.length) {
      box.innerHTML = `<div class="t1s-coupon-empty">No live coupons for ${esc(product.site)} on Try1Second right now. Never shows made-up codes.</div>`;
      return;
    }
    box.innerHTML = '<div class="t1s-coupon-head">Live coupons for this site — tap to copy</div>';
    for (const d of deals.slice(0, 8)) {
      const row = el('div', 't1s-coupon-row');
      const isCoupon = d.kind === 'coupon' && d.code;
      row.innerHTML = `
        <div class="t1s-coupon-txt">
          <div class="t1s-coupon-title">${esc(d.title || d.discount_text || '')}</div>
          <div class="t1s-coupon-sub">${esc(d.discount_text || d.description || '')}${d.terms ? ` · ${esc(d.terms)}` : ''}</div>
        </div>
        ${isCoupon
          ? `<button type="button" class="t1s-coupon-code" title="Copy code">${esc(d.code)}</button>`
          : `<a class="t1s-btn t1s-btn-open" target="_blank" rel="noopener">Open</a>`}`;
      if (isCoupon) {
        const btn = row.querySelector('.t1s-coupon-code');
        btn.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(d.code);
            btn.classList.add('t1s-copied');
            const old = btn.textContent;
            btn.textContent = 'Copied ✓';
            setTimeout(() => { btn.textContent = old; btn.classList.remove('t1s-copied'); }, 1600);
          } catch { btn.textContent = d.code; }
        });
      } else {
        const a = row.querySelector('a');
        a.href = d.dest_url || '#';
        if (!d.dest_url) a.style.display = 'none';
      }
      box.appendChild(row);
    }
  }

  // ---------- main flow ------------------------------------------------

  async function main() {
    const product = detectProduct();
    if (!product || !product.site) return;
    state.product = product;
    const vertical = product.vertical || 'ecommerce';

    const { t1sCity = '', t1sPincode = '' } = await chrome.storage.local.get(['t1sCity', 't1sPincode']);

    // The floating bar appears on EVERY supported page, even when the page has
    // no detectable product entity (search pages, listings): it offers a hop to
    // the metasearch rather than invented numbers.
    state.prefs = await getPrefs();
    await recordRecent(product);
    await mountDock(product);

    const bar = buildBar();
    if (!state.prefs.showBar) bar.style.display = 'none';
    bar.querySelector('.t1s-bar-coupon').addEventListener('click', () => renderCoupons(bar, product));

    if (product.routeOnly) {
      // Travel / bus route pages: no per-product entity — offer the route search.
      setBarPrice(bar, '—', true);
      bar.querySelector('.t1s-bar-toggle').addEventListener('click', async () => {
        window.open(await try1secondSearchUrl(product.routeQuery || product.site), '_blank', 'noopener');
      });
      bar.querySelector('.t1s-bar-coupon').style.display = 'none';
      bar.title = 'Search this on Try1Second for the cheapest verified price';
      return;
    }
    if (!product.title) return;

    const panel = buildPanel(product);
    document.documentElement.appendChild(panel);
    panel.style.display = 'none';
    let panelOpen = false;
    bar.querySelector('.t1s-bar-toggle').addEventListener('click', () => {
      panelOpen = !panelOpen;
      panel.style.display = panelOpen ? '' : 'none';
      if (panelOpen && !panel.dataset.rendered) { panel.dataset.rendered = '1'; renderPanelFlow(panel, product, { t1sCity, t1sPincode }); }
    });
    renderPanelFlow(panel, product, { t1sCity, t1sPincode, background: true });

    if (!SEARCH_VERTICALS.has(vertical)) return;

    // Populate the bar with the verified best price / all-time low.
    try {
      const searchRes = await apiSearch(product.title, { vertical, city: t1sCity, pincode: t1sPincode });
      const match = pickMatchingResult(searchRes.results, product.title, product.identifiers?.asin || null);
      let atl = null;
      if (match?.canonicalEntityId) {
        try { atl = (await apiHistory(match.canonicalEntityId)).map((p) => p.price).filter((n) => n > 0); } catch { atl = null; }
      }
      if (atl && atl.length) {
        setBarPrice(bar, inr(Math.min(...atl)));
        bar.querySelector('.t1s-bar-atl').title = `All-time low across ${atl.length} recorded real prices`;
      } else if (match) {
        const best = cheapestOf(searchRes.results.filter((r) => String(r.canonicalEntityId || '') === String(match.canonicalEntityId || '')));
        if (priceOf(best) > 0) {
          setBarPrice(bar, inr(priceOf(best)));
          bar.querySelector('.t1s-bar-atl').title = 'Best verified price right now (no history recorded yet)';
        } else setBarPrice(bar, '—', true);
      } else {
        setBarPrice(bar, '—', true);
        bar.querySelector('.t1s-bar-atl').title = 'No verified offer recorded for this page yet';
      }
    } catch {
      setBarPrice(bar, '—', true);
    }
  }

  async function renderPanelFlow(panel, product, { t1sCity, t1sPincode, background = false }) {
    renderStatus(panel, 'Searching across sites…');
    const vertical = product.vertical || 'ecommerce';
    try {
      const searchRes = await apiSearch(product.title, { vertical, city: t1sCity, pincode: t1sPincode });
      const match = pickMatchingResult(searchRes.results, product.title, null);
      if (!match) {
        renderUnavailable(panel, 'Try1Second has no verified offers for this yet. Not showing unverified prices.');
        return;
      }
      if (PRODUCT_VERTICALS.has(vertical)) {
        await renderMatch(panel, product, searchRes, match);
      } else {
        await renderCompactMatch(panel, product, searchRes, match);
      }
    } catch (err) {
      renderUnavailable(panel, `Try1Second is unreachable right now (${esc(err.message || 'network error')}). Prices were not changed.`);
    }
  }

  // ---------- panel skeleton --------------------------------------------

  function buildPanel(product) {
    const root = el('div', 't1s-root');
    root.id = PANEL_ID;
    root.innerHTML = `
      <div class="t1s-card">
        <div class="t1s-head">
          <div class="t1s-logo">${logoSvg}</div>
          <div class="t1s-head-actions">
            <button class="t1s-btn t1s-btn-track" title="Alert me when the price drops">Track price</button>
            <button class="t1s-btn t1s-btn-collapse" title="Minimise panel">&minus;</button>
          </div>
        </div>
        <div class="t1s-body"></div>
        <div class="t1s-foot">
          <span class="t1s-page-price">On this page (${esc(product.site)}): <b>${product.price ? inr(product.price) : 'price not read'}</b></span>
        </div>
      </div>`;
    root.querySelector('.t1s-btn-collapse').addEventListener('click', () => {
      state.collapsed = !state.collapsed;
      root.classList.toggle('t1s-collapsed', state.collapsed);
    });
    return root;
  }

  function bodyOf(panel) { return panel.querySelector('.t1s-body'); }

  function renderStatus(panel, msg) {
    bodyOf(panel).innerHTML = `<div class="t1s-status"><span class="t1s-spinner"></span>${esc(msg)}</div>`;
  }

  function renderUnavailable(panel, msg) {
    bodyOf(panel).innerHTML = `<div class="t1s-status t1s-muted">${esc(msg)}</div>`;
  }

  // Compact panel for non-product verticals (food restaurant, movie, bus route):
  // top verified offers + a hop to the metasearch. No history charts (these
  // entities have no per-item price history on the backend).
  async function renderCompactMatch(panel, product, searchRes, match) {
    const body = bodyOf(panel);
    body.innerHTML = '';
    const offers = (searchRes.results || []).filter((r) => priceOf(r) > 0).slice(0, 5);
    if (!offers.length) {
      renderUnavailable(panel, 'No verified offers for this yet.');
      return;
    }
    body.appendChild(el('div', 't1s-bestrow', `
      <div class="t1s-bp"><span class="t1s-bpl">Best verified price</span><span class="t1s-bpv">${inr(priceOf(offers[0]))}</span>
      <span class="t1s-bps">${esc(offers[0].seller || offers[0].vendor || '')}</span></div>`));
    const list = el('div', 't1s-offers');
    for (const o of offers) {
      const row = el('div', 't1s-offer');
      row.innerHTML = `
        <span class="t1s-offer-site">${esc((o.title || '').slice(0, 44))}</span>
        <span class="t1s-offer-price">${inr(priceOf(o))}</span>
        <a class="t1s-btn t1s-btn-open" target="_blank" rel="noopener">Open</a>`;
      const a = row.querySelector('a');
      a.href = '#';
      a.addEventListener('click', async (e) => {
        e.preventDefault();
        if (o.sellerUrl) { try { window.open(await apiGo(o.sellerUrl, o.id), '_blank', 'noopener'); } catch { a.textContent = 'Link expired'; } }
        else window.open(await try1secondSearchUrl(product.title), '_blank', 'noopener');
      });
      list.appendChild(row);
    }
    body.appendChild(list);
    const openRow = el('div', 't1s-openweb');
    openRow.innerHTML = `<a class="t1s-link" target="_blank" rel="noopener">Compare more on Try1Second →</a>`;
    openRow.querySelector('a').href = await try1secondSearchUrl(product.title);
    body.appendChild(openRow);
    panel.querySelector('.t1s-btn-track').style.display = 'none';
  }

  // ---------- matched render --------------------------------------------

  async function renderMatch(panel, product, searchRes, match) {
    const body = bodyOf(panel);
    body.innerHTML = '';

    // 1) Cross-site comparison for the SAME canonical product
    const groups = groupByEntity(searchRes.results);
    const group = groups.find((g) => g.best && String(g.best.canonicalEntityId) === String(match.canonicalEntityId)) ||
                  groups.find((g) => g.best && g.best.id === match.id) || { best: match, offers: [match] };
    const offers = group.offers.slice().sort((a, b) => (priceOf(a) || Infinity) - (priceOf(b) || Infinity));
    const best = offers[0];
    const bestPrice = priceOf(best);
    const savings = product.price && bestPrice ? product.price - bestPrice : 0;

    const priceRow = el('div', 't1s-bestrow');
    priceRow.innerHTML = `
      <div class="t1s-bp"><span class="t1s-bpl">Best verified price</span><span class="t1s-bpv">${inr(bestPrice)}</span>
      <span class="t1s-bps">${esc(best.seller || best.vendor || '')}</span></div>
      ${savings > 0 ? `<div class="t1s-save">Save ${inr(savings)} vs this page</div>` : ''}`;
    body.appendChild(priceRow);

    // 2) All sites list (price-owning sellers only, via /api/go safe redirect)
    const list = el('div', 't1s-offers');
    for (const o of offers.slice(0, 6)) {
      const row = el('div', 't1s-offer' + (o === best ? ' t1s-best' : ''));
      row.innerHTML = `
        <span class="t1s-offer-site">${esc(o.seller || o.vendor || 'Verified source')}</span>
        <span class="t1s-offer-price">${inr(priceOf(o))}</span>
        <a class="t1s-btn t1s-btn-open" target="_blank" rel="noopener">Open</a>`;
      const open = row.querySelector('a');
      if (o.sellerUrl) {
        open.href = '#';
        open.addEventListener('click', async (e) => {
          e.preventDefault();
          try {
            const url = await apiGo(o.sellerUrl, o.id);
            window.open(url, '_blank', 'noopener');
          } catch (err) {
            open.textContent = 'Link expired';
          }
        });
      } else {
        open.textContent = 'See site';
        open.addEventListener('click', async () => {
          window.open(await try1secondSearchUrl(product.title), '_blank', 'noopener');
        });
      }
      list.appendChild(row);
    }
    body.appendChild(list);

    // 3) REAL price history from the backend
    const histBox = el('div', 't1s-hist');
    histBox.innerHTML = `<div class="t1s-hist-title">Price history (real recorded prices only)</div><div class="t1s-status"><span class="t1s-spinner"></span>Loading history…</div>`;
    body.appendChild(histBox);

    let historyPoints = [];
    if (match.canonicalEntityId) {
      try { historyPoints = await apiHistory(match.canonicalEntityId); } catch { historyPoints = []; }
    }
    renderHistory(histBox, historyPoints, bestPrice);

    // 3b) Cross-site cheaper-elsewhere footer (reference green bar) — only
    // when a REAL verified offer from another seller is cheaper than this page.
    if (savings > 0 && best.seller && best.seller !== product.site) {
      const cheaper = el('div', 't1s-cheaper');
      cheaper.innerHTML = `
        <div class="t1s-cheaper-txt"><b>Cheaper on ${esc(best.seller)}!</b>
          <span>${inr(savings)} below this page's price</span></div>
        <a class="t1s-cheaper-btn" target="_blank" rel="noopener">Switch to ${esc(best.seller)} ↗</a>`;
      const link = cheaper.querySelector('a');
      link.href = '#';
      link.addEventListener('click', async (e) => {
        e.preventDefault();
        if (best.sellerUrl) {
          try { window.open(await apiGo(best.sellerUrl, best.id), '_blank', 'noopener'); return; } catch { /* fall through */ }
        }
        window.open(await try1secondSearchUrl(product.title), '_blank', 'noopener');
      });
      body.appendChild(cheaper);
    }

    // 4) Advice + track row
    const verdict = verdictFrom(historyPoints, bestPrice);
    body.appendChild(el('div', 't1s-verdict', verdict ? `<span class="t1s-v-badge">${esc(verdict.label)}</span> ${esc(verdict.text)}` : 'Not enough recorded history for advice yet — only real observations are used.'));

    // 5) Open in Try1Second
    const openRow = el('div', 't1s-openweb');
    openRow.innerHTML = `<a class="t1s-link" target="_blank" rel="noopener">Compare more sites on Try1Second →</a>`;
    openRow.querySelector('a').href = await try1secondSearchUrl(product.title);
    body.appendChild(openRow);

    // 6) Wire tracking
    const trackBtn = panel.querySelector('.t1s-btn-track');
    const trackedList = await getTracked();
    const trackedKey = String(match.canonicalEntityId || match.id);
    state.tracking = trackedList.some((t) => t.key === trackedKey);
    updateTrackBtn(trackBtn);
    trackBtn.addEventListener('click', async () => {
      let list = await getTracked();
      if (state.tracking) {
        list = list.filter((t) => t.key !== trackedKey);
        state.tracking = false;
      } else {
        list.unshift({
          key: trackedKey,
          title: product.title.slice(0, 140),
          site: product.site,
          query: product.title.slice(0, 140),
          canonicalEntityId: match.canonicalEntityId || null,
          lastPrice: bestPrice,
          pageUrl: location.href.slice(0, 400),
          addedAt: Date.now(),
        });
        state.tracking = true;
      }
      await saveTracked(list.slice(0, 50));
      updateTrackBtn(trackBtn);
    });
  }

  function updateTrackBtn(btn) {
    btn.textContent = state.tracking ? 'Tracking ✓' : 'Track price';
    btn.classList.toggle('t1s-tracking', state.tracking);
  }

  /** Buy/wait advice derived ONLY from real recorded history. */
  function verdictFrom(points, currentPrice) {
    const prices = points.map((p) => p.price).filter((n) => n > 0);
    if (prices.length < 3 || !currentPrice) return null;
    const low = Math.min(...prices), high = Math.max(...prices);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    const pos = (currentPrice - low) / (high - low || 1);
    if (pos <= 0.15) return { label: 'Buy now', text: `Current price is at/near the lowest ever recorded (${inr(low)}).` };
    if (currentPrice > avg) return { label: 'Wait', text: `Current price is above the recorded average (${inr(Math.round(avg))}). Consider waiting for a drop.` };
    return { label: 'Fair price', text: `Current price is between the recorded low (${inr(low)}) and high (${inr(high)}).` };
  }

  /** History window tabs (reference design: 90D / 180D / 365D). Real capturedAt
   *  filtering; if a window holds fewer than 2 real points, the full recorded
   *  range is shown instead — never a synthesized series. */
  const HISTORY_TABS = [
    { days: 90, label: '90D' },
    { days: 180, label: '180D' },
    { days: 365, label: '365D' },
  ];

  function historyWindow(points, days) {
    const cutoff = Date.now() - days * 86400000;
    const inWindow = points.filter((pt) => {
      const t = new Date(pt.capturedAt).getTime();
      return isNaN(t) || t >= cutoff;
    });
    return inWindow.length >= 2 ? inWindow : points.slice();
  }

  /** SVG sparkline of REAL history points (oldest -> newest) with period tabs. */
  function renderHistory(box, points, currentPrice) {
    if (!points.length) {
      box.innerHTML = `<div class="t1s-hist-title">Price history</div>
        <div class="t1s-status t1s-muted">No price history recorded for this product yet. Try1Second never generates synthetic history.</div>`;
      return;
    }
    box.innerHTML = `
      <div class="t1s-hist-title">Price history</div>
      <div class="t1s-hist-tabs"></div>
      <div class="t1s-hist-view"></div>`;
    const tabsEl = box.querySelector('.t1s-hist-tabs');
    const viewEl = box.querySelector('.t1s-hist-view');

    const draw = (pts) => {
      const oldest = pts.slice().reverse(); // oldest first
      const prices = oldest.map((p) => p.price).filter((n) => n > 0);
      const low = Math.min(...prices), high = Math.max(...prices);
      const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
      const W = 320, H = 90, PAD = 8;
      const min = low * 0.97, max = high * 1.03;
      const x = (i) => PAD + (i * (W - PAD * 2)) / Math.max(oldest.length - 1, 1);
      const y = (p) => H - PAD - ((p - min) / (max - min || 1)) * (H - PAD * 2);
      const path = oldest.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.price).toFixed(1)}`).join(' ');
      const area = `${path} L${x(oldest.length - 1)},${H - PAD} L${x(0)},${H - PAD} Z`;
      const lowIdx = oldest.findIndex((p) => p.price === low);
      const last = oldest[oldest.length - 1];
      viewEl.innerHTML = `
        <svg viewBox="0 0 ${W} ${H}" class="t1s-chart" preserveAspectRatio="none">
          <defs><linearGradient id="t1sArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#E11D48" stop-opacity="0.22"/><stop offset="100%" stop-color="#E11D48" stop-opacity="0"/>
          </linearGradient></defs>
          <path d="${area}" fill="url(#t1sArea)"/>
          <path d="${path}" fill="none" stroke="#E11D48" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
          <circle cx="${x(lowIdx)}" cy="${y(low)}" r="4" fill="#16a34a"/>
          <title>Lowest recorded: ${inr(low)}</title>
        </svg>
        <div class="t1s-hist-stats">
          <span class="t1s-stat"><em>ALL-TIME LOW EVER</em><b class="t1s-green">${inr(low)}</b></span>
          <span class="t1s-stat"><em>${tabsEl.querySelector('.t1s-htab.active') ? tabsEl.querySelector('.t1s-htab.active').textContent + ' AVERAGE' : 'AVERAGE'}</em><b>${inr(avg)}</b></span>
          <span class="t1s-stat"><em>CURRENT PRICE</em><b>${inr(currentPrice)}</b></span>
        </div>
        <div class="t1s-hist-when">${esc(fmtDate(oldest[0].capturedAt))} → ${esc(fmtDate(last.capturedAt))} · ${oldest.length} recorded points</div>`;
    };

    let activeDays = 365;
    for (const tab of HISTORY_TABS) {
      const b = el('button', 't1s-htab', tab.label + ' History');
      b.type = 'button';
      if (tab.days === activeDays) b.classList.add('active');
      b.addEventListener('click', () => {
        activeDays = tab.days;
        tabsEl.querySelectorAll('.t1s-htab').forEach((n) => n.classList.remove('active'));
        b.classList.add('active');
        draw(historyWindow(points, tab.days));
      });
      tabsEl.appendChild(b);
    }
    draw(historyWindow(points, activeDays));
  }

  function fmtDate(s) {
    const d = new Date(s);
    if (isNaN(d)) return String(s);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  // The popup asks the page's content script what it detected (auto-grab:
  // the panel already knows the product/vertical, so the popup never has to
  // guess from the URL alone).

  // ====================================================================
  // v1.6.0 — RIGHT-EDGE DOCK + SLIDE-OUT SIDEBAR (owner reference design).
  // BuyHatke-style icon rail with tooltips and a full-height in-page app:
  // every view is powered by the REAL Try1Second engine (no mock data).
  // ====================================================================

  const DOCK_ID = 't1s-dock';
  const SIDEBAR_ID = 't1s-sidebar';
  const ICON = {
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
    ticket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 11v2"/><path d="M13 17v2"/></svg>',
    gauge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M12 21v-6"/></svg>',
    gift: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>',
  };

  const DOCK_ITEMS = [
    { id: 'alerts', label: 'Price Alerts', icon: ICON.bell },
    { id: 'coupons', label: 'Coupons', icon: ICON.ticket },
    { id: 'score', label: 'Deal Score', icon: ICON.gauge },
    { id: 'recent', label: 'Recent Views', icon: ICON.eye },
    { id: 'tracked', label: 'Tracked Items', icon: ICON.heart },
    { id: 'rewards', label: 'Rewards Hub', icon: ICON.gift },
  ];

  const VIEW_TITLES = { main: 'Try1Second', alerts: 'Price Alerts', coupons: 'Coupons', score: 'Deal Score', recent: 'Recent Views', tracked: 'Tracked Items', rewards: 'Rewards Hub', settings: 'Settings' };

  async function getPrefs() {
    try {
      const { t1sPrefs = {} } = await chrome.storage.sync.get('t1sPrefs');
      return Object.assign({ showBar: true, dropNotifications: true }, t1sPrefs);
    } catch {
      try {
        const { t1sPrefs = {} } = await chrome.storage.local.get('t1sPrefs');
        return Object.assign({ showBar: true, dropNotifications: true }, t1sPrefs);
      } catch { return { showBar: true, dropNotifications: true }; }
    }
  }

  async function savePrefs(p) {
    state.prefs = p;
    try { await chrome.storage.sync.set({ t1sPrefs: p }); } catch { await chrome.storage.local.set({ t1sPrefs: p }); }
  }

  async function dockHiddenHere() {
    const { t1sDockHidden = [] } = await chrome.storage.local.get('t1sDockHidden');
    return (t1sDockHidden || []).includes(location.hostname);
  }

  async function hideDockHere() {
    const { t1sDockHidden = [] } = await chrome.storage.local.get('t1sDockHidden');
    const list = (t1sDockHidden || []).filter((h) => h !== location.hostname);
    list.push(location.hostname);
    await chrome.storage.local.set({ t1sDockHidden: list.slice(-50) });
  }

  async function unhideDockHere() {
    const { t1sDockHidden = [] } = await chrome.storage.local.get('t1sDockHidden');
    await chrome.storage.local.set({ t1sDockHidden: (t1sDockHidden || []).filter((h) => h !== location.hostname) });
  }

  async function recordRecent(product) {
    try {
      const { t1sRecent = [] } = await chrome.storage.local.get('t1sRecent');
      const entry = { title: String(product.title || '').slice(0, 120), site: product.site, price: product.price || 0, url: location.href.slice(0, 400), at: Date.now() };
      if (!entry.title) return;
      const list = (t1sRecent || []).filter((r) => r.url !== entry.url);
      list.unshift(entry);
      await chrome.storage.local.set({ t1sRecent: list.slice(0, 20) });
    } catch { /* storage full/blocked — recent views is a nice-to-have */ }
  }

  /** Deal score 0-100 computed ONLY from real recorded history (honest: null when <2 points). */
  function computeDealScore(points, current) {
    const prices = (points || []).map((p) => p.price).filter((n) => n > 0);
    if (prices.length < 2 || !current) return null;
    const low = Math.min(...prices), high = Math.max(...prices);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    let score;
    if (current <= low) score = 100;
    else if (current >= high) score = 5;
    else score = Math.round(100 * (high - current) / (high - low));
    const verdict = current <= low * 1.02 ? { label: 'Buy now', cls: 't1s-green' }
      : current <= avg ? { label: 'Good price', cls: 't1s-green' }
      : { label: 'Wait for a drop', cls: 't1s-amber' };
    return { score, low, high, avg: Math.round(avg), n: prices.length, verdict };
  }

  // ---------- sidebar shell ----------------------------------------------

  let dockEl = null, sidebarEl = null, activeView = null, panelHost = null;

  function buildSidebar() {
    const sb = el('div', 't1s-sb');
    sb.id = SIDEBAR_ID;
    sb.innerHTML = `
      <div class="t1s-sb-head">
        <div class="t1s-sb-logo">${logoSvg}</div>
        <span class="t1s-sb-title"></span>
        <button type="button" class="t1s-sb-close" title="Close">${ICON.x}</button>
      </div>
      <div class="t1s-sb-body"></div>
      <div class="t1s-sb-foot"><span>Every number is real — from the Try1Second engine.</span></div>`;
    sb.querySelector('.t1s-sb-close').addEventListener('click', closeSidebar);
    return sb;
  }

  function ensureChrome() {
    if (!sidebarEl) {
      sidebarEl = buildSidebar();
      document.documentElement.appendChild(sidebarEl);
    }
    if (!dockEl) {
      dockEl = buildDock();
      document.documentElement.appendChild(dockEl);
    }
  }

  function closeSidebar() {
    if (sidebarEl) sidebarEl.classList.remove('t1s-sb-open');
    if (dockEl) dockEl.querySelectorAll('.t1s-dock-btn').forEach((b) => b.classList.remove('t1s-dock-active'));
    activeView = null;
  }

  async function openView(id) {
    ensureChrome();
    activeView = id;
    sidebarEl.querySelector('.t1s-sb-title').textContent = VIEW_TITLES[id] || 'Try1Second';
    const body = sidebarEl.querySelector('.t1s-sb-body');
    body.innerHTML = '<div class="t1s-status"><span class="t1s-spinner"></span>Loading…</div>';
    sidebarEl.classList.add('t1s-sb-open');
    try {
      if (id === 'main') await viewMain(body);
      else if (id === 'alerts') await viewAlerts(body);
      else if (id === 'coupons') await viewCoupons(body);
      else if (id === 'score') await viewScore(body);
      else if (id === 'recent') await viewRecent(body);
      else if (id === 'tracked') await viewTracked(body);
      else if (id === 'rewards') viewRewards(body);
      else if (id === 'settings') await viewSettings(body);
    } catch (err) {
      body.innerHTML = `<div class="t1s-status t1s-muted">Something went wrong reaching the Try1Second engine (${esc(err.message || 'network error')}).</div>`;
    }
  }

  // ---------- the dock ---------------------------------------------------

  function dockBtn(item) {
    const b = el('button', 't1s-dock-btn');
    b.type = 'button';
    b.dataset.view = item.id;
    b.innerHTML = `<span class="t1s-dock-ic">${item.icon}</span><span class="t1s-dock-tip">${esc(item.label)}</span>`;
    b.addEventListener('click', () => {
      const wasActive = b.classList.contains('t1s-dock-active');
      dockEl.querySelectorAll('.t1s-dock-btn').forEach((x) => x.classList.remove('t1s-dock-active'));
      if (wasActive && sidebarEl?.classList.contains('t1s-sb-open')) { closeSidebar(); return; }
      b.classList.add('t1s-dock-active');
      openView(item.id);
    });
    return b;
  }

  function buildDock() {
    const dock = el('div', 't1s-dock');
    dock.id = DOCK_ID;

    // collapse chevron (reference: top circular button)
    const chev = el('button', 't1s-dock-btn t1s-dock-chev');
    chev.type = 'button';
    chev.title = 'Minimise the rail';
    chev.innerHTML = `<span class="t1s-dock-ic">${ICON.chevron}</span><span class="t1s-dock-tip">Minimise rail</span>`;
    chev.addEventListener('click', () => dock.classList.add('t1s-dock-collapsed'));
    dock.appendChild(chev);

    for (const item of DOCK_ITEMS) dock.appendChild(dockBtn(item));

    // brand pill: Try1Second logo + 3x3 dots -> MAIN comparison view
    const brand = el('button', 't1s-dock-brand');
    brand.type = 'button';
    brand.title = 'Open Try1Second';
    brand.innerHTML = `
      <span class="t1s-dock-x" title="Hide the rail on this site">${ICON.x}</span>
      <img src="${chrome.runtime.getURL('images/logo-icon.png')}" alt="Try1Second" />
      <span class="t1s-dots">${'<i></i>'.repeat(9)}</span>`;
    brand.addEventListener('click', async (e) => {
      if (e.target.closest('.t1s-dock-x')) { e.stopPropagation(); await hideDockHere(); dock.remove(); dockEl = null; return; }
      dock.classList.remove('t1s-dock-collapsed');
      dockEl.querySelectorAll('.t1s-dock-btn').forEach((x) => x.classList.remove('t1s-dock-active'));
      openView('main');
    });
    dock.appendChild(brand);

    // settings at the bottom
    const gear = dockBtn({ id: 'settings', label: 'Settings', icon: ICON.gear });
    dock.appendChild(gear);
    return dock;
  }

  // ---------- views ------------------------------------------------------

  async function viewMain(body) {
    const product = state.product;
    panelHost = panelHost || document.getElementById(PANEL_ID);
    if (!product || !product.title || product.routeOnly || !panelHost) {
      body.innerHTML = `
        <div class="t1s-sb-empty">
          <img src="${chrome.runtime.getURL('images/logo-icon.png')}" alt="" class="t1s-empty-logo" />
          <b>No product detected on this page</b>
          <span>Open a product page on Amazon, Flipkart, Blinkit, MakeMyTrip and 17 more stores — Try1Second compares every price live. Or search on the website.</span>
          <a class="t1s-cheaper-btn" target="_blank" rel="noopener" style="background:#151922;color:#fff">Search on Try1Second ${ICON.arrow}</a>
        </div>`;
      body.querySelector('a').href = 'https://www.try1second.com';
      return;
    }
    // Move the (already rendered) comparison panel into the sidebar — no
    // duplicate API calls, the cross-site offers/history live in one place.
    body.innerHTML = '';
    panelHost.style.display = '';
    panelHost.classList.add('t1s-in-sidebar');
    body.appendChild(panelHost);
  }

  async function viewAlerts(body) {
    const { t1sTracked = [] } = await chrome.storage.local.get('t1sTracked');
    const { t1sLastPollAt = 0 } = await chrome.storage.local.get('t1sLastPollAt');
    const last = t1sLastPollAt ? new Date(t1sLastPollAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'never';
    body.innerHTML = `
      <div class="t1s-view-head">Get notified the moment a verified price crosses your target. Checks run every 30 minutes.</div>
      <div class="t1s-view-tools">
        <button type="button" class="t1s-checkpage">⚡ Check prices now</button>
        <span class="t1s-muted">Last check: ${esc(last)}</span>
      </div>
      <div class="t1s-alert-list"></div>
      <div class="t1s-sb-empty t1s-sb-empty-mini">
        <b>Choose where you want alerts</b>
        <span>Website price-drop alerts (email) work on try1second.com — open your alerts page to set them there.</span>
        <a class="t1s-cheaper-btn" target="_blank" rel="noopener" style="background:#00A86B;color:#fff">Open alerts on Try1Second ${ICON.arrow}</a>
      </div>`;
    body.querySelector('.t1s-checkpage').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true; btn.textContent = 'Checking…';
      try { await new Promise((res) => chrome.runtime.sendMessage({ type: 't1s-poll-now' }, res)); await viewAlerts(body); } catch { btn.disabled = false; btn.textContent = '⚡ Check prices now'; }
    });
    const list = body.querySelector('.t1s-alert-list');
    if (!t1sTracked.length) {
      list.innerHTML = `<div class="t1s-sb-empty"><b>No price alerts yet</b><span>Track a product from its page (heart icon → Tracked Items) and set a target price below.</span></div>`;
      return;
    }
    for (const item of t1sTracked) {
      const row = el('div', 't1s-alert-row');
      row.innerHTML = `
        <div class="t1s-alert-txt">
          <b>${esc((item.title || '').slice(0, 80))}</b>
          <span>Last verified: ${item.lastPrice ? inr(item.lastPrice) : '—'} · ${esc(item.site || '')}</span>
        </div>
        <input type="number" min="1" placeholder="Target ₹" value="${item.target || ''}" />
        <button type="button" class="t1s-remove" title="Stop tracking">✕</button>`;
      row.querySelector('input').addEventListener('change', async (e) => {
        const v = Number(e.target.value) || 0;
        const { t1sTracked: cur = [] } = await chrome.storage.local.get('t1sTracked');
        const it = cur.find((x) => x.key === item.key);
        if (it) { it.target = v > 0 ? v : undefined; it.targetHit = false; await chrome.storage.local.set({ t1sTracked: cur }); }
      });
      row.querySelector('.t1s-remove').addEventListener('click', async () => {
        const { t1sTracked: cur = [] } = await chrome.storage.local.get('t1sTracked');
        await chrome.storage.local.set({ t1sTracked: cur.filter((x) => x.key !== item.key) });
        row.remove();
      });
      list.appendChild(row);
    }
  }

  async function viewCoupons(body) {
    const product = state.product;
    body.innerHTML = `
      <div class="t1s-view-head">Live coupons for <b>${esc(product?.site || 'this store')}</b> — straight from the Try1Second deal registry. Tap to copy. No invented codes, ever.</div>
      <div class="t1s-coupon-list"><div class="t1s-status"><span class="t1s-spinner"></span>Fetching live coupons…</div></div>`;
    const box = body.querySelector('.t1s-coupon-list');
    try {
      let deals = [];
      try {
        deals = await apiDeals(merchantKeyFor(product?.site));
        if (!deals.length) deals = await apiDeals(merchantKeyFor(product?.site).split('-')[0]);
      } catch { deals = []; }
      if (!deals || !deals.length) {
        box.innerHTML = `<div class="t1s-sb-empty"><b>No live coupons right now</b><span>Try1Second only lists codes verified in the registry — when the store has none, we say so instead of guessing.</span></div>`;
        return;
      }
      box.innerHTML = '';
      for (const d of deals) {
        const row = el('div', 't1s-coupon-row2');
        row.innerHTML = `
          <div class="t1s-coupon-txt">
            <b>${esc(d.title || d.discount_text || 'Coupon')}</b>
            <span>${esc(d.discount_text || d.description || '')}${d.code ? ` · code <b>${esc(d.code)}</b>` : ''}</span>
          </div>
          <button type="button" class="t1s-checkpage">${d.code ? 'Copy' : 'Open'}</button>`;
        row.querySelector('button').addEventListener('click', async (e) => {
          const btn = e.currentTarget;
          if (d.code) { try { await navigator.clipboard.writeText(d.code); btn.textContent = 'Copied ✓'; } catch { btn.textContent = d.code; } }
          else if (d.url) window.open(d.url, '_blank', 'noopener');
        });
        box.appendChild(row);
      }
    } catch (err) {
      box.innerHTML = `<div class="t1s-sb-empty"><b>Coupons unavailable</b><span>${esc(err.message || 'The registry could not be reached.')}</span></div>`;
    }
  }

  async function viewScore(body) {
    const product = state.product;
    if (!product?.title) {
      body.innerHTML = `<div class="t1s-sb-empty"><b>No product on this page</b><span>Open a product page to see its Deal Score.</span></div>`;
      return;
    }
    body.innerHTML = '<div class="t1s-status"><span class="t1s-spinner"></span>Scoring from recorded history…</div>';
    const { t1sCity = '', t1sPincode = '' } = await chrome.storage.local.get(['t1sCity', 't1sPincode']);
    const res = await apiSearch(product.title, { vertical: product.vertical || 'ecommerce', city: t1sCity, pincode: t1sPincode });
    const match = pickMatchingResult(res.results, product.title, product.identifiers?.asin || null);
    const current = match ? priceOf(match) : (product.price || 0);
    let points = [];
    if (match?.canonicalEntityId) { try { points = await apiHistory(match.canonicalEntityId); } catch { points = []; } }
    const score = computeDealScore(points, current);
    if (!score) {
      body.innerHTML = `
        <div class="t1s-sb-empty"><b>Not enough history to score</b>
          <span>Try1Second scores only from real recorded prices. Once this product has 2+ recorded checks, the score appears — no guesses before that.</span></div>`;
      return;
    }
    const C = 2 * Math.PI * 44;
    const dash = (Math.max(5, Math.min(100, score.score)) / 100) * C;
    const col = score.verdict.cls === 't1s-green' ? '#00A86B' : '#f59e0b';
    body.innerHTML = `
      <div class="t1s-score-wrap">
        <svg viewBox="0 0 120 120" class="t1s-score-ring">
          <circle cx="60" cy="60" r="44" fill="none" stroke="#e5e9f0" stroke-width="10"/>
          <circle cx="60" cy="60" r="44" fill="none" stroke="${col}" stroke-width="10" stroke-linecap="round"
            stroke-dasharray="${dash.toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 60 60)"/>
          <text x="60" y="58" text-anchor="middle" font-size="26" font-weight="900" fill="#151922">${score.score}</text>
          <text x="60" y="76" text-anchor="middle" font-size="9" font-weight="800" fill="#94a3b8">DEAL SCORE</text>
        </svg>
        <div class="t1s-score-verdict ${score.verdict.cls}">${esc(score.verdict.label)}</div>
        <div class="t1s-score-note">Scored from <b>${score.n}</b> real recorded prices — never invented.</div>
        <div class="t1s-hist-stats">
          <span class="t1s-stat"><em>ALL-TIME LOW</em><b class="t1s-green">${inr(score.low)}</b></span>
          <span class="t1s-stat"><em>AVERAGE</em><b>${inr(score.avg)}</b></span>
          <span class="t1s-stat"><em>CURRENT</em><b>${inr(current)}</b></span>
        </div>
      </div>`;
  }

  async function viewRecent(body) {
    const { t1sRecent = [] } = await chrome.storage.local.get('t1sRecent');
    if (!t1sRecent.length) {
      body.innerHTML = `<div class="t1s-sb-empty"><b>No recent views yet</b><span>Products you open on supported stores appear here, so you can jump back and re-compare in one tap.</span></div>`;
      return;
    }
    body.innerHTML = '<div class="t1s-recent-list"></div>';
    const list = body.querySelector('.t1s-recent-list');
    for (const r of t1sRecent) {
      const row = el('button', 't1s-recent-row');
      row.type = 'button';
      const when = new Date(r.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
      row.innerHTML = `
        <div class="t1s-alert-txt"><b>${esc((r.title || '').slice(0, 80))}</b>
        <span>${esc(r.site || '')}${r.price ? ` · ${inr(r.price)}` : ''} · ${esc(when)}</span></div>
        ${ICON.arrow}`;
      row.addEventListener('click', () => window.open(r.url, '_blank', 'noopener'));
      list.appendChild(row);
    }
  }

  async function viewTracked(body) {
    const { t1sTracked = [] } = await chrome.storage.local.get('t1sTracked');
    if (!t1sTracked.length) {
      body.innerHTML = `<div class="t1s-sb-empty"><b>Nothing tracked yet</b><span>Hit “Track price” on any product page and it lands here with live re-checks every 30 minutes.</span></div>`;
      return;
    }
    body.innerHTML = '<div class="t1s-recent-list"></div>';
    const list = body.querySelector('.t1s-recent-list');
    for (const item of t1sTracked) {
      const row = el('div', 't1s-recent-row');
      row.innerHTML = `
        <div class="t1s-alert-txt"><b>${esc((item.title || '').slice(0, 80))}</b>
        <span>Last verified: ${item.lastPrice ? inr(item.lastPrice) : '—'}${item.target ? ` · target ${inr(item.target)}` : ''}</span></div>
        <button type="button" class="t1s-btn t1s-btn-open" type-check>Check</button>`;
      row.querySelector('[type-check]').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        btn.textContent = '…';
        try {
          const { t1sCity = '', t1sPincode = '' } = await chrome.storage.local.get(['t1sCity', 't1sPincode']);
          const res = await apiSearch(item.query, { city: t1sCity, pincode: t1sPincode });
          const m = pickMatchingResult(res.results, item.query, item.canonicalEntityId);
          const price = m ? priceOf(m) : 0;
          if (price > 0) {
            const { t1sTracked: cur = [] } = await chrome.storage.local.get('t1sTracked');
            const it = cur.find((x) => x.key === item.key);
            if (it) { it.lastPrice = price; await chrome.storage.local.set({ t1sTracked: cur }); }
            btn.textContent = inr(price);
          } else btn.textContent = '—';
        } catch { btn.textContent = 'n/a'; }
      });
      list.appendChild(row);
    }
  }

  function viewRewards(body) {
    body.innerHTML = `
      <div class="t1s-score-wrap">
        <div class="t1s-sb-empty" style="text-align:left">
          <b>Earn 1 point per redirection. Spin at 100.</b>
          <span>The Rewards Hub lives on the website — collect points on every deal you open, then spin the wheel for vouchers and cashback.</span>
          <a class="t1s-cheaper-btn" target="_blank" rel="noopener" style="background:#4F46E5;color:#fff">Open Rewards Hub ${ICON.arrow}</a>
        </div>
      </div>`;
    body.querySelector('a').href = 'https://www.try1second.com';
  }

  async function viewSettings(body) {
    const prefs = await getPrefs();
    const { t1sCity = '', t1sPincode = '', t1sApiBase = '' } = await chrome.storage.local.get(['t1sCity', 't1sPincode', 't1sApiBase']);
    const hidden = await dockHiddenHere();
    const toggles = [
      { key: 'showBar', label: 'Floating compare bar', on: prefs.showBar },
      { key: 'dropNotifications', label: 'Price-drop notifications', on: prefs.dropNotifications },
    ];
    body.innerHTML = `
      <div class="t1s-view-head">Customisation</div>
      <div class="t1s-toggles"></div>
      <div class="t1s-view-head" style="margin-top:14px">Live pricing</div>
      <label class="t1s-set-row">City<input class="t1s-set-in" id="t1s-set-city" value="${esc(t1sCity)}" placeholder="e.g. Indore"/></label>
      <label class="t1s-set-row">Pincode<input class="t1s-set-in" id="t1s-set-pin" value="${esc(t1sPincode)}" placeholder="e.g. 452001"/></label>
      <label class="t1s-set-row">Backend URL<input class="t1s-set-in" id="t1s-set-api" value="${esc(t1sApiBase)}" placeholder="https://www.try1second.com"/></label>
      ${hidden ? '<button type="button" class="t1s-checkpage" id="t1s-unhide">Show the rail on this site again</button>' : ''}
      <div class="t1s-muted" style="margin-top:12px">Try1Second v${esc(chrome.runtime.getManifest().version)} · 21 stores · 13 verticals · every price verified live.</div>`;
    const box = body.querySelector('.t1s-toggles');
    for (const t of toggles) {
      const row = el('div', 't1s-toggle-row');
      row.innerHTML = `<span>${esc(t.label)}</span><button type="button" class="t1s-toggle ${t.on ? 'on' : ''}" role="switch" aria-checked="${t.on}"><i></i></button>`;
      row.querySelector('.t1s-toggle').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        const next = Object.assign({}, await getPrefs());
        next[t.key] = !next[t.key];
        await savePrefs(next);
        btn.classList.toggle('on', next[t.key]);
        btn.setAttribute('aria-checked', String(next[t.key]));
        if (t.key === 'showBar') {
          const bar = document.getElementById(BAR_ID);
          if (bar) bar.style.display = next.showBar ? '' : 'none';
        }
      });
      box.appendChild(row);
    }
    for (const [id, key] of [['t1s-set-city', 't1sCity'], ['t1s-set-pin', 't1sPincode'], ['t1s-set-api', 't1sApiBase']]) {
      body.querySelector('#' + id).addEventListener('change', async (e) => {
        const set = {}; set[key] = e.target.value.trim();
        await chrome.storage.local.set(set);
        if (key === 't1sApiBase' && typeof setBackendUrl === 'function') setBackendUrl(set[key]);
      });
    }
    const uh = body.querySelector('#t1s-unhide');
    if (uh) uh.addEventListener('click', async () => { await unhideDockHere(); uh.remove(); });
  }

  /** Attach the dock on supported pages (unless the owner hid it for this site). */
  async function mountDock(product) {
    if (await dockHiddenHere()) return;
    state.prefs = await getPrefs();
    ensureChrome();
  }


  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 't1s-get-product') {
      try { sendResponse({ product: detectProduct() || null }); } catch { sendResponse({ product: null }); }
    }
    return false;
  });

  main();
})();
