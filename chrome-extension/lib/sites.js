/**
 * Try1Second extension — per-site product extractors.
 * Reads ONLY what the merchant page actually renders. If a field can't be
 * found, it stays null — we never guess (no-fabrication rule).
 */
'use strict';

function txt(sel, root = document) {
  const el = root.querySelector(sel);
  return el ? el.textContent.trim().replace(/\s+/g, ' ') : null;
}

function num(sel, root = document) {
  const t = txt(sel, root);
  if (!t) return null;
  const m = t.replace(/,/g, '').match(/[\d.]+/);
  if (!m) return null;
  const n = Math.round(parseFloat(m[0]));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function detectAmazon() {
  const asinMatch = location.pathname.match(/\/dp\/([A-Z0-9]{10})/i);
  const title = txt('#productTitle') || txt('#title span');
  if (!asinMatch || !title) return null;
  return {
    site: 'Amazon India',
    title,
    identifiers: { asin: asinMatch[1] },
    price:
      num('.a-price .a-offscreen') ||
      num('#corePriceDisplay_desktop_feature_div .a-offscreen') ||
      num('#apex_desktop .a-price .a-offscreen'),
    mrp: num('.basisPrice .a-offscreen') || num('.a-text-price .a-offscreen'),
    image: document.querySelector('#landingImage, #imgTagWrapperId img')?.src || null,
  };
}

function detectFlipkart() {
  if (!/\/p\//.test(location.pathname)) return null;
  const title = txt('.VU-ZE1') || txt('span.B_NuP') || txt('h1') || txt('[class*="dyC2hf"]');
  if (!title) return null;
  const priceText =
    txt('div.Nx9bqj.CxhGGd') || txt('div._30jeq3._16Jk6d') || txt('[class*="Nx9bqj"]') ||
    txt('div[data-testid="price"]') || txt('._16Jk6d');
  const price = priceText ? Math.round(parseFloat(priceText.replace(/[^\d.]/g, ''))) : null;
  return {
    site: 'Flipkart',
    title,
    identifiers: {},
    price: Number.isFinite(price) && price > 0 ? price : null,
    mrp: num('div.yRaY8b, .yRaY8b') || num('[class*="yRaY8b"]'),
    image: document.querySelector('div._3kidJb img, div[data-testid="productImage"] img, .flex .DByuo4 img')?.src || null,
  };
}

function detectMyntra() {
  const h1 = txt('h1.pdp-title, h1[class*="pdp-title"]') || txt('h1');
  if (!h1) return null;
  const price = num('h1 + div span, .pdp-price strong, [class*="pdp-price"]');
  return {
    site: 'Myntra',
    title: h1,
    identifiers: {},
    price,
    mrp: num('.pdp-mrp, [class*="pdp-mrp"]'),
    image: document.querySelector('.image-grid-image, .show-image, [class*="pdp-image"] img')?.src || null,
  };
}

function detectAjio() {
  const title = txt('h1[dir="auto"], .prod-name, h1');
  if (!title) return null;
  return {
    site: 'Ajio',
    title,
    identifiers: {},
    price: num('[class*="prod-price"], .promo-discounted-price, span._1_nXW'),
    mrp: num('[class*="prod-cp"], .prod-cp, span._2mY2S'),
    image: document.querySelector('img[src*="assets.ajio.com"], .ril--lazy-loaded, img[alt*="product"]')?.src || null,
  };
}

function detectTataCliq() {
  const title = txt('h1, [class*="ProductTitle"], .pdp-title');
  if (!title) return null;
  return {
    site: 'Tata CLiQ',
    title,
    identifiers: {},
    price: num('[class*="pdp-price"], .ProductPrice, [data-testid="product-price"]'),
    mrp: num('[class*="pdp-mrp"], .striked'),
    image: document.querySelector('img[class*="productImage"], [class*="imageWrapper"] img')?.src || null,
  };
}

function detectMeesho() {
  const title = txt('h1, [class*="ProductTitle"], span[class*="name"]');
  if (!title) return null;
  return {
    site: 'Meesho',
    title,
    identifiers: {},
    price: num('[class*="price"], span[class*="Price"]'),
    mrp: num('[class*="mrp"], [class*="strike"], [class*="Mrp"]'),
    image: document.querySelector('img[src*="cdn.meesho.com"], img[srcset*="cdn.meesho.com"]')?.src || null,
  };
}

// ---------- 10-min grocery product pages ----------

function detectBlinkit() {
  const title = txt('h1, [class*="ProductCard"] h1, div[class*="title"]') || document.title.split('|')[0];
  if (!title) return null;
  return {
    site: 'Blinkit', vertical: 'grocery',
    title: title.slice(0, 120), identifiers: {},
    price: num('[class*="price"]'), mrp: num('[class*="mrp"], [class*="strike"], [class*="MRP"]'),
    image: document.querySelector('img[src*="cdn.grofers.com"], img[src*="blinkit"]')?.src || null,
  };
}

function detectBigBasket() {
  const title = txt('h1, [class*="DescriptionBox"] h1');
  if (!title) return null;
  return {
    site: 'BigBasket', vertical: 'grocery',
    title: title.slice(0, 120), identifiers: {},
    price: num('[class*="PricingTable"] [class*="price"], .discnt-price, [class*="_3DgGZ"], span[class*="Price"]'),
    mrp: num('[class*="mrp"], del, [class*="strike"]'),
    image: document.querySelector('img[src*="bbassets"], img[src*="bigbasket"]')?.src || null,
  };
}

function detectZepto() {
  const title = txt('h1, [class*="product"] h1');
  if (!title) return null;
  return {
    site: 'Zepto', vertical: 'grocery',
    title: title.slice(0, 120), identifiers: {},
    price: num('[class*="price"], [class*="Price"]'), mrp: num('[class*="mrp"], [class*="Mrp"], del'),
    image: document.querySelector('img[src*="zepto"], img[src*="cdn.zeptonow"]')?.src || null,
  };
}

function detectJioMart() {
  const title = txt('h1, [class*="product-title"], [data-title]');
  if (!title) return null;
  return {
    site: 'JioMart', vertical: 'grocery',
    title: title.slice(0, 120), identifiers: {},
    price: num('[class*="price"], [class*="Price"]'), mrp: num('[class*="mrp"], [class*="strike-off"], del'),
    image: document.querySelector('img[src*="jiostatic"], img[src*="rukminim"]')?.src || null,
  };
}

// ---------- food & movies pages ----------

function detectSwiggy() {
  if (/\/instamart/.test(location.pathname)) {
    const title = txt('h1, [class*="product"] h1, [class*="title"]') || document.title.split(' | ')[0];
    return title ? { site: 'Swiggy Instamart', vertical: 'grocery', title: title.slice(0, 120), identifiers: {}, price: null, mrp: null, image: null } : null;
  }
  const h1 = txt('h1');
  if (!h1) return null;
  return { site: 'Swiggy', vertical: 'food', title: h1.slice(0, 120), identifiers: {}, price: null, mrp: null, image: null };
}

function detectZomato() {
  if (!/\/order|\/info/.test(location.pathname)) return null;
  const h1 = txt('h1');
  if (!h1) return null;
  return { site: 'Zomato', vertical: 'food', title: h1.slice(0, 120), identifiers: {}, price: null, mrp: null, image: null };
}

function detectDominos() {
  const h1 = txt('h1') || txt('[class*="product-title"]');
  return {
    site: "Domino's India", vertical: 'food',
    title: (h1 || "Domino's Pizza India").slice(0, 120), identifiers: {},
    price: null, mrp: null, image: null,
  };
}

function detectBookMyShow() {
  const h1 = txt('h1');
  if (!h1) return null;
  return { site: 'BookMyShow', vertical: 'movies', title: h1.slice(0, 120), identifiers: {}, price: null, mrp: null, image: null };
}

// ---------- travel (flights / hotels / bus) route pages ----------

/** redBus SEO route URLs: /bus-tickets/<from>-to-<to>.aspx — the route is honestly in the slug. */
function extractRedbusRoute() {
  const m = location.pathname.match(/\/bus-tickets\/([a-z0-9-]+)-to-([a-z0-9-]+)\.aspx/i);
  if (!m) return null;
  const pretty = (s) => s.replace(/-+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
  const from = pretty(m[1]), to = pretty(m[2]);
  return from && to ? `${from} to ${to}` : null;
}

function detectTravel() {
  const host = location.hostname.replace(/^www\./, '');
  const map = [
    ['makemytrip.com', 'MakeMyTrip', 'flights'],
    ['goibibo.com', 'Goibibo', 'flights'],
    ['easemytrip.com', 'EaseMyTrip', 'flights'],
    ['yatra.com', 'Yatra', 'flights'],
    ['cleartrip.com', 'Cleartrip', 'flights'],
    ['redbus.in', 'redBus', 'bus'],
    ['abhibus.com', 'AbhiBus', 'bus'],
  ];
  for (const [h, site, vertical] of map) {
    if (host.endsWith(h)) {
      const routeQuery = vertical === 'bus' ? extractRedbusRoute() : null;
      return { site, vertical, routeOnly: true, routeQuery, title: routeQuery || site, identifiers: {}, price: null, mrp: null, image: null };
    }
  }
  return null;
}

const DETECTORS = [
  ['instamart.swiggy.com', detectSwiggy],
  ['swiggy.com', detectSwiggy],
  ['zomato.com', detectZomato],
  ['dominos.co.in', detectDominos],
  ['in.bookmyshow.com', detectBookMyShow],
  ['bookmyshow.com', detectBookMyShow],
  ['blinkit.com', detectBlinkit],
  ['bigbasket.com', detectBigBasket],
  ['zeptonow.com', detectZepto],
  ['jiomart.com', detectJioMart],
  ['makemytrip.com', detectTravel],
  ['goibibo.com', detectTravel],
  ['easemytrip.com', detectTravel],
  ['yatra.com', detectTravel],
  ['cleartrip.com', detectTravel],
  ['redbus.in', detectTravel],
  ['abhibus.com', detectTravel],
  ['amazon.in', detectAmazon],
  ['flipkart.com', detectFlipkart],
  ['myntra.com', detectMyntra],
  ['ajio.com', detectAjio],
  ['tatacliq.com', detectTataCliq],
  ['meesho.com', detectMeesho],
];

/** Returns the detected product info or null when the page isn't a product page. */
function detectProduct() {
  for (const [host, fn] of DETECTORS) {
    if (location.hostname.includes(host)) {
      try { return fn(); } catch { return null; }
    }
  }
  return null;
}

/** Merchant key for /api/deals (matches the backend's merchantKeyOf slugs). */
function merchantKeyFor(site) {
  const s = String(site || '').toLowerCase();
  const map = {
    'amazon india': 'amazon', 'swiggy instamart': 'swiggy', "domino's india": 'dominos',
    'tata cliq': 'tatacliq', 'tatacliq': 'tatacliq',
  };
  if (map[s]) return map[s];
  return s.replace(/[^a-z0-9]/g, '');
}

// Node-test exports (never used in the browser sandbox).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { merchantKeyFor };
}
