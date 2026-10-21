/**
 * Product-image search (owner 21 Oct): food cards must carry the real product photo,
 * never a brand logo/favicon. For offers whose only image is a brand-logo fallback
 * (Domino's national menu has no photos), we search an image engine (Bing Images,
 * browserless, no API key) for "<seller> <dish>", score results against the dish
 * tokens, verify the candidate is a real image, and cache the winner in MySQL
 * (product_images) so each dish is looked up exactly once — ever.
 *
 * Self-healing: on engine gating (challenge/empty) a 10-minute breaker silently keeps
 * the brand-logo fallback; lookups resume automatically. No mock images, ever.
 */
import { getStore } from '../common/db';
import { cffiFetch } from '../common/curlCffiFetch';
import type { NormalizedOffer } from '../types';

const BREAKER_MS = 10 * 60_000;
let breakerUntil = 0;

let ensured = false;
async function ensureTable(): Promise<void> {
  if (ensured) return;
  await getStore().execute(`CREATE TABLE IF NOT EXISTS product_images (
    img_key VARCHAR(160) PRIMARY KEY,
    url VARCHAR(600) NOT NULL,
    source VARCHAR(40) NOT NULL DEFAULT 'bing-images',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  ensured = true;
}

const STOP_RE = /logo|icon|store_|building|office|career|jobs?|realestate|furniture|coupon|banner|app-?store|flickr.*people|facebook/i;
const GOOD_PATH_RE = /menu|pizza|product|food|dish|media|photo|uploads?\b|zmtcdn|swiggy|dominos/i;

function slug(s: string): string {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 150);
}

interface BingItem { murl?: string; t?: string; }

function parseBingItems(html: string): BingItem[] {
  const out: BingItem[] = [];
  const re = /class="iusc"[^>]*m="({[^"]+})"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const j = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&'));
      if (j.murl) out.push({ murl: String(j.murl), t: String(j.t || '') });
    } catch { /* skip malformed */ }
  }
  return out;
}

function scoreItem(it: BingItem, tokens: string[], brandTok: string): number {
  const url = String(it.murl || '');
  const hay = `${url} ${it.t || ''}`.toLowerCase();
  if (!/^https:\/\//.test(url)) return -1;
  if (!/\.(jpg|jpeg|webp)(\?|$)/i.test(url) && !/(zmtcdn|swiggy|media-assets|instacdn)/i.test(url)) return -1; // no svg/png/logo art
  if (STOP_RE.test(hay)) return -1;
  let sc = 0;
  for (const tk of tokens) if (hay.includes(tk)) sc += 3;
  if (hay.includes(brandTok)) sc += 4;
  if (GOOD_PATH_RE.test(url)) sc += 2;
  return sc;
}

/** Verify the candidate is a real servable image: ranged GET + magic-byte sniff (8s). */
async function verifyImage(url: string): Promise<boolean> {
  try {
    const r = await cffiFetch(url, { impersonate: 'chrome', timeoutMs: 8000, headers: { Range: 'bytes=0-63' } });
    if (r.status !== 200 && r.status !== 206) return false;
    const head = String(r.body || '').slice(0, 64);
    if (/^\x89PNG|\xff\xd8\xff/.test(head)) return true;          // PNG / JPEG magic bytes
    if (/^(RIFF)/.test(head) && head.slice(8, 12) === 'WEBP') return true; // WebP
    return false;
  } catch { return false; }
}

async function lookupProductImage(seller: string, dish: string): Promise<string | null> {
  if (Date.now() < breakerUntil) return null;
  const brand = seller.toLowerCase().includes("domino") ? "domino's" : String(seller || '').trim();
  const q = encodeURIComponent(`${brand} ${dish} menu`.replace(/\s+/g, ' ').trim());
  let html = '';
  try {
    const r = await cffiFetch(`https://www.bing.com/images/async?q=${q}&first=0&count=25&mmasync=1`, { impersonate: 'chrome', timeoutMs: 10_000 });
    if (r.status !== 200) throw new Error(`bing HTTP ${r.status}`);
    html = String(r.body || '');
  } catch (e) {
    breakerUntil = Date.now() + BREAKER_MS; // engine gated — silent honest fallback for 10 min
    return null;
  }
  const items = parseBingItems(html);
  if (items.length < 3) { breakerUntil = Date.now() + BREAKER_MS; return null; } // challenge shell
  const brandTok = slug(brand).split('-')[0] || 'pizza';
  const tokens = Array.from(new Set([brandTok, ...slug(dish).split('-').filter((t) => t.length > 2 && !['pizza', 'the', 'and'].includes(t))]));
  const ranked = items
    .map((it) => ({ it, sc: scoreItem(it, tokens, brandTok) }))
    .filter((x) => x.sc > 2)
    .sort((a, b) => b.sc - a.sc)
    .slice(0, 3);
  for (const cand of ranked) {
    if (await verifyImage(cand.it.murl as string)) return String(cand.it.murl);
  }
  return null;
}

async function cachedImage(key: string): Promise<string | null> {
  await ensureTable();
  const rows = (await getStore().query('SELECT url FROM product_images WHERE img_key = ?', [key])) as any[];
  const row = rows?.[0] || (rows as any)?.rows?.[0];
  return row?.url ? String(row.url) : null;
}

async function rememberImage(key: string, url: string): Promise<void> {
  await ensureTable();
  await getStore().execute('INSERT IGNORE INTO product_images (img_key, url, source) VALUES (?, ?, ?)', [key, url, 'bing-images']);
}

/**
 * Attach real product photos to food offers that only carry a brand-logo fallback.
 * Real scraped photos are never touched. Max `budget` fresh lookups per call.
 */
export async function withProductImages(offers: NormalizedOffer[], budget = 5): Promise<NormalizedOffer[]> {
  const food = offers.filter((o) => String(o.vertical) === 'food');
  if (!food.length) return offers;
  let spent = 0;
  const tasks: Promise<void>[] = [];
  for (const o of food) {
    const a: any = o.attributes || {};
    if (a.image_url && a.image_is_brand_logo !== 'true') continue; // has a real photo already
    const dish = String(a.dish || o.title || '').replace(/\s*\([^)]*\)\s*/g, ' ').trim();
    if (!dish) continue;
    const seller = String(o.seller || a.restaurant || '');
    const key = slug(`${seller}|${dish}`).slice(0, 160);
    tasks.push((async () => {
      try {
        let url = await cachedImage(key);
        if (!url) {
          if (spent >= budget) return; // keep search latency flat on cold dishes
          spent += 1;
          url = await lookupProductImage(seller, dish);
          if (url) await rememberImage(key, url);
        }
        if (url) {
          a.image_url = url;
          a.image_is_brand_logo = 'false';
          a.image_is_product_image = 'true';
          a.image_source = 'bing-images (cached per dish)';
        }
      } catch { /* honest fallback: keep brand logo */ }
    })());
  }
  await Promise.allSettled(tasks);
  return offers;
}
