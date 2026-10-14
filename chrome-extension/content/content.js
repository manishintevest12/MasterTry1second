/**
 * Try1Second extension — content script.
 * Injects a Try1Second-styled comparison + price-history panel on supported
 * e-commerce product pages. Every price comes from the real Try1Second
 * backend; "unavailable" is shown whenever data can't be verified.
 */
'use strict';

(function () {
  const PANEL_ID = 't1s-panel';
  let state = { collapsed: false, tracking: false };

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

  // ---------- main flow ------------------------------------------------

  async function main() {
    const product = detectProduct();
    if (!product || !product.title) return;

    const { t1sCity = '', t1sPincode = '' } = await chrome.storage.local.get(['t1sCity', 't1sPincode']);

    const panel = buildPanel(product);
    document.documentElement.appendChild(panel);
    renderStatus(panel, 'Searching across sites…');

    try {
      const [searchRes] = await Promise.all([apiSearch(product.title, { city: t1sCity, pincode: t1sPincode })]);
      const match = pickMatchingResult(searchRes.results, product.title, null);
      if (!match) {
        renderUnavailable(panel, 'Try1Second has no verified offers for this product yet. Not showing unverified prices.');
        return;
      }
      await renderMatch(panel, product, searchRes, match);
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

  /** SVG sparkline of REAL history points (oldest -> newest). */
  function renderHistory(box, points, currentPrice) {
    if (!points.length) {
      box.innerHTML = `<div class="t1s-hist-title">Price history</div>
        <div class="t1s-status t1s-muted">No price history recorded for this product yet. Try1Second never generates synthetic history.</div>`;
      return;
    }
    const pts = points.slice().reverse(); // oldest first
    const prices = pts.map((p) => p.price).filter((n) => n > 0);
    const low = Math.min(...prices), high = Math.max(...prices);
    const W = 320, H = 90, PAD = 8;
    const min = low * 0.97, max = high * 1.03;
    const x = (i) => PAD + (i * (W - PAD * 2)) / Math.max(pts.length - 1, 1);
    const y = (p) => H - PAD - ((p - min) / (max - min || 1)) * (H - PAD * 2);
    const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.price).toFixed(1)}`).join(' ');
    const area = `${path} L${x(pts.length - 1)},${H - PAD} L${x(0)},${H - PAD} Z`;
    const lowIdx = pts.findIndex((p) => p.price === low);
    const last = pts[pts.length - 1];

    box.innerHTML = `
      <div class="t1s-hist-title">Price history <span class="t1s-hist-n">${pts.length} recorded points</span></div>
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
        <span>Lowest <b>${inr(low)}</b></span>
        <span>Highest <b>${inr(high)}</b></span>
        <span>Latest <b>${inr(last.price)}</b></span>
      </div>
      <div class="t1s-hist-when">${esc(fmtDate(pts[0].capturedAt))} → ${esc(fmtDate(last.capturedAt))}</div>`;
  }

  function fmtDate(s) {
    const d = new Date(s);
    if (isNaN(d)) return String(s);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  main();
})();
