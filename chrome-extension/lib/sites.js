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

const DETECTORS = [
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
