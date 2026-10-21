/**
 * Try1Second extension — backend API client.
 * Talks to the REAL Try1Second production backend (shared-hosting Node app).
 * No-fabrication rule: every number shown comes from these API responses.
 * If the backend has no data, we surface "unavailable" — never a guess.
 */
'use strict';

const DEFAULT_API_BASE = 'https://www.try1second.com';
const HISTORY_LIMIT = 120;

async function getApiBase() {
  const { t1sApiBase } = await chrome.storage.local.get('t1sApiBase');
  return (t1sApiBase && t1sApiBase.trim()) || DEFAULT_API_BASE;
}

/**
 * True when running as a CONTENT SCRIPT on a web page. Content scripts cannot
 * make cross-origin fetches (CORS) even with host_permissions, so requests are
 * relayed through the service worker via chrome.runtime messaging.
 */
const IS_CONTENT_SCRIPT =
  typeof window !== 'undefined' && !window.location.protocol.startsWith('chrome-extension:');

async function t1sFetch(path, options = {}) {
  const base = await getApiBase();
  const url = base + path;
  if (IS_CONTENT_SCRIPT) {
    const reply = await chrome.runtime.sendMessage({ type: 't1s-fetch', url, options });
    if (!reply || !reply.ok) throw new Error(reply?.error || 'Background fetch failed');
    return reply.data;
  }
  const res = await fetch(url, options);
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try { const j = await res.json(); if (j?.error) detail = j.error; } catch { /* body not json */ }
    throw new Error(detail);
  }
  return res.json();
}

/** POST /api/search — real metasearch pipeline (vertical: 'ecommerce' etc). */
async function apiSearch(query, { vertical = 'ecommerce', city, pincode } = {}) {
  const body = { query: String(query).slice(0, 300), vertical };
  if (city) body.city = String(city).slice(0, 80);
  if (pincode) body.pincode = String(pincode).slice(0, 10);
  const data = await t1sFetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!data || !Array.isArray(data.results)) throw new Error('Malformed search response');
  return data;
}

/** POST /api/lens — paste ANY product link, get the same product's cheapest real price across sites. */
async function apiLens(input) {
  const data = await t1sFetch('/api/lens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: String(input).slice(0, 2000) }),
  });
  if (!data || data.success === false) throw new Error(data?.error || 'Could not check that link');
  return data;
}

/** True when the box holds a link (alone or inside pasted share text) rather than a product name. */
function looksLikeLink(text) {
  return /https?:\/\/[^\s]+/i.test(String(text || ''));
}

/** GET /api/history?entity=<canonicalEntityId> — real recorded price history. */
async function apiHistory(entityId, limit = HISTORY_LIMIT) {
  const data = await t1sFetch(`/api/history?entity=${encodeURIComponent(entityId)}&limit=${limit}`);
  if (!data || !Array.isArray(data.points)) throw new Error('Malformed history response');
  return data.points; // [{price, capturedAt}]
}

/** GET /api/deals?merchant=<key> — live coupons/offers for this merchant (admin + acquired). */
async function apiDeals(merchantKey) {
  const data = await t1sFetch(`/api/deals?merchant=${encodeURIComponent(merchantKey)}&limit=20`);
  if (!data || !Array.isArray(data.deals)) throw new Error('Malformed deals response');
  return data.deals.filter((d) => d && (d.code || d.discount_text || d.title));
}

/** GET /api/go — server-side safe redirect resolver (records click, applies affiliate). */
async function apiGo(url, offerId) {
  const data = await t1sFetch(`/api/go?url=${encodeURIComponent(url)}${offerId ? `&offerId=${encodeURIComponent(offerId)}` : ''}`);
  if (!data || !data.success || !data.redirectUrl) throw new Error('Redirect refused');
  return data.redirectUrl;
}

/** Try1Second search page URL for a query (fallback for "open in Try1Second"). */
async function try1secondSearchUrl(query) {
  const base = await getApiBase();
  return `${base}/?q=${encodeURIComponent(query)}`;
}

/**
 * Deep link to the website's IN-SITE PRODUCT PAGE (the "Compare N Available
 * Prices" view) for a product title. Owner request 21 Oct: extension buttons
 * must open the product comparison page, not the bare home page.
 */
async function try1secondProductUrl(title) {
  const base = await getApiBase();
  return `${base}/#product=${encodeURIComponent(String(title || '').slice(0, 160))}`;
}

/**
 * Pick the backend result that matches the on-page product best.
 * Match by canonical entity id when available, else by title token overlap.
 * Returns null when nothing overlaps honestly.
 */
function pickMatchingResult(results, pageTitle, canonicalEntityId) {
  if (!results || !results.length) return null;
  if (canonicalEntityId) {
    const byEntity = results.filter((r) => String(r.canonicalEntityId) === String(canonicalEntityId));
    if (byEntity.length) return cheapestOf(byEntity);
  }
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const pageTokens = new Set(norm(pageTitle).split(' ').filter((t) => t.length > 2));
  let best = null, bestScore = 0;
  for (const r of results) {
    const rTokens = norm(r.title).split(' ').filter((t) => t.length > 2);
    if (!rTokens.length) continue;
    const overlap = rTokens.filter((t) => pageTokens.has(t)).length / rTokens.length;
    // require a majority of the result's title tokens to appear on the page
    if (overlap >= 0.6 && overlap > bestScore) { best = r; bestScore = overlap; }
  }
  return best;
}

function cheapestOf(results) {
  return results.reduce((a, b) => (priceOf(b) > 0 && (priceOf(a) === 0 || priceOf(b) < priceOf(a)) ? b : a), results[0]);
}

function priceOf(r) { return Number(r?.prices?.effectivePrice ?? r?.prices?.mandatoryTotal ?? 0) || 0; }

/** Group results by canonical entity id (independent cross-site comparison). */
function groupByEntity(results) {
  const groups = new Map();
  for (const r of results) {
    const key = r.canonicalEntityId || r.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  return [...groups.values()].map((offers) => ({ offers, best: cheapestOf(offers) }));
}

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

// Shared storage helpers ---------------------------------------------

async function getTracked() {
  const { t1sTracked = [] } = await chrome.storage.local.get('t1sTracked');
  return t1sTracked;
}

async function saveTracked(list) {
  await chrome.storage.local.set({ t1sTracked: list });
  await refreshBadge();
}

async function refreshBadge() {
  // chrome.action exists only in the service worker / popup, never in content scripts.
  if (typeof chrome === 'undefined' || !chrome.action?.setBadgeText) return;
  const { t1sDrops = 0 } = await chrome.storage.local.get('t1sDrops');
  if (t1sDrops > 0) {
    await chrome.action.setBadgeText({ text: String(t1sDrops) });
    await chrome.action.setBadgeBackgroundColor({ color: '#E11D48' });
  } else {
    await chrome.action.setBadgeText({ text: '' });
  }
}
