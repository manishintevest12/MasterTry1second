/**
 * Merchant logo registry (owner 21 Oct): admin-uploaded brand logos that render on
 * every card where the scraped image/favicon would be a blurry or generic fallback.
 * Logos are stored as base64 data URLs in MySQL — shared hosting safe, no filesystem.
 * Keyed by the same merchantKeyOf() slug the deals registry uses.
 */
import { getStore } from '../common/db';
import { merchantKeyOf } from './deals';

export interface MerchantLogo { name_key: string; name: string; logo: string; updated_at: string; }

let ensured = false;
export async function ensureMerchantLogosTable(): Promise<void> {
  if (ensured) return;
  await getStore().execute(`CREATE TABLE IF NOT EXISTS merchant_logos (
    name_key VARCHAR(80) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    logo MEDIUMTEXT NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  ensured = true;
}

const DATA_URL_RE = /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/;

export function validateLogoPayload(p: { name?: unknown; logo?: unknown }): { ok: boolean; error?: string; clean?: { name_key: string; name: string; logo: string } } {
  const name = String(p.name || '').trim().slice(0, 120);
  const logo = String(p.logo || '').trim();
  if (!name) return { ok: false, error: 'Merchant name is required' };
  if (!logo || !DATA_URL_RE.test(logo)) return { ok: false, error: 'Logo must be a base64 PNG/JPEG/WebP data URL' };
  // ~400KB base64 cap ≈ 300KB image — plenty for a 256px brand logo
  if (logo.length > 400_000) return { ok: false, error: 'Logo too large (resize to ≤256px before upload)' };
  return { ok: true, clean: { name_key: merchantKeyOf(name).slice(0, 80) || 'brand', name, logo } };
}

export async function listMerchantLogos(): Promise<MerchantLogo[]> {
  await ensureMerchantLogosTable();
  return (await getStore().query('SELECT name_key, name, logo, updated_at FROM merchant_logos ORDER BY name')) as MerchantLogo[];
}

/** Fetch one logo by its name_key (serves GET /api/logos/:key). */
export async function getMerchantLogo(nameKey: string): Promise<MerchantLogo | null> {
  await ensureMerchantLogosTable();
  const rows = (await getStore().query('SELECT name_key, name, logo, updated_at FROM merchant_logos WHERE name_key = ? LIMIT 1', [
    String(nameKey || '').slice(0, 80),
  ])) as MerchantLogo[];
  return rows[0] || null;
}

/** Decode a stored data URL into { mime, bytes } for HTTP image serving. */
export function decodeLogoDataUrl(logo: string): { mime: string; bytes: Buffer } | null {
  const m = /^data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(String(logo || '').trim());
  if (!m) return null;
  try {
    return { mime: m[1] === 'jpg' ? 'jpeg' : m[1], bytes: Buffer.from(m[2], 'base64') };
  } catch { return null; }
}

/** Map of key -> data URL for the public endpoint (client caches it). */
export async function merchantLogoMap(): Promise<Record<string, string>> {
  const rows = await listMerchantLogos();
  const out: Record<string, string> = {};
  for (const r of rows) out[r.name_key] = r.logo;
  return out;
}

export async function upsertMerchantLogo(p: { name?: unknown; logo?: unknown }): Promise<{ ok: boolean; error?: string; name_key?: string }> {
  const v = validateLogoPayload(p);
  if (!v.ok || !v.clean) return v;
  await ensureMerchantLogosTable();
  await getStore().execute(
    'INSERT INTO merchant_logos (name_key, name, logo, updated_at) VALUES (?, ?, ?, UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE name=VALUES(name), logo=VALUES(logo), updated_at=UTC_TIMESTAMP()',
    [v.clean.name_key, v.clean.name, v.clean.logo]);
  return { ok: true, name_key: v.clean.name_key };
}

export async function deleteMerchantLogo(nameKey: string): Promise<void> {
  await ensureMerchantLogosTable();
  await getStore().execute('DELETE FROM merchant_logos WHERE name_key = ?', [String(nameKey || '').slice(0, 80)]);
}

/**
 * SELF-HEALING LOGO FALLBACK (owner 29 Oct: "logo not showing for sellers" on the
 * Product Page — every circle showed the empty storefront placeholder because
 * /api/logos/<key> answered 404 whenever the owner had not manually uploaded that
 * brand's logo, and the app/web then had nothing to render).
 *
 * The endpoint now never answers "no image" for a known brand: it resolves the
 * brand's own domain, fetches its real favicon ONCE from Google's public favicon
 * service, and caches the bytes in-process (12h) so repeat views cost nothing and
 * never re-hit the network. Unknown brands still 404 so the UI can show initials
 * rather than a fake logo.
 */
const KEY_DOMAIN: Record<string, string> = {
  reliance: 'reliancedigital.in', reliancedigital: 'reliancedigital.in',
  croma: 'croma.com', amazon: 'amazon.in', amzn: 'amazon.in', flipkart: 'flipkart.com',
  myntra: 'myntra.com', ajio: 'ajio.com', tatacliq: 'tatacliq.com', tata: 'tatacliq.com',
  shopsy: 'shopsy.in', nykaa: 'nykaa.com', snapdeal: 'snapdeal.com', jiomart: 'jiomart.com',
  blinkit: 'blinkit.com', zepto: 'zeptonow.com', zeptonow: 'zeptonow.com',
  instamart: 'swiggy.com', swiggy: 'swiggy.com', bigbasket: 'bigbasket.com', bbnow: 'bigbasket.com',
  flipkartminutes: 'flipkart.com', dmart: 'dmart.in', spencer: 'spencers.in', more: 'moreretail.in',
  vijaysales: 'vijaysales.com', poorvika: 'poorvika.com', sangeetha: 'sangeethamobiles.com',
  paytm: 'paytm.com', tataneu: 'newnue.com', firstcry: 'firstcry.com',
  redbus: 'redbus.in', abhibus: 'abhibus.com', zingbus: 'zingbus.com', ola: 'olacabs.com',
  uber: 'uber.com', rapido: 'rapido.bike', indrive: 'indrive.com', blusmart: 'blusmart.com',
  makemytrip: 'makemytrip.com', goibibo: 'goibibo.com', cleartrip: 'cleartrip.com',
  yatra: 'yatra.com', easemytrip: 'easemytrip.com', ixigo: 'ixigo.com', booking: 'booking.com',
  agoda: 'agoda.com', airbnb: 'airbnb.co.in', oyo: 'oyorooms.com', treebo: 'treebo.com',
  bookmyshow: 'bookmyshow.com', district: 'district.in', ticketnew: 'ticketnew.com', pvr: 'pvrcinemas.com',
  cinepolis: 'cinepolisindia.com', inox: 'inoxmovies.com', zomato: 'zomato.com', dominos: 'dominos.co.in',
  pizzahut: 'pizzahut.co.in', eatsure: 'eatsure.com', ovenstory: 'ovenstorypizzas.com',
  hdfc: 'hdfcbank.com', icici: 'icicibank.com', sbi: 'sbi.co.in', axis: 'axisbank.com',
  kotak: 'kotak.com', bajaj: 'bajajfinserv.in', acko: 'acko.com', digit: 'godigit.com',
  policybazaar: 'policybazaar.com', paisabazaar: 'paisabazaar.com', bankbazaar: 'bankbazaar.com',
  indigo: 'goindigo.in', spicejet: 'spicejet.com', airindia: 'airindia.in', akasa: 'akasaair.com',
};

const faviconCache = new Map<string, { bytes: Buffer; mime: string; at: number }>();
const FAVICON_TTL_MS = 12 * 60 * 60_000;

/** Real favicon bytes for a brand key, cached. undefined = unknown brand / fetch failed. */
export async function resolveBrandFavicon(nameKey: string): Promise<{ bytes: Buffer; mime: string } | undefined> {
  const key = String(nameKey || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const domain = KEY_DOMAIN[key];
  if (!domain) return undefined;
  const hit = faviconCache.get(domain);
  if (hit && Date.now() - hit.at < FAVICON_TTL_MS) return { bytes: hit.bytes, mime: hit.mime };
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 4000);
    const res = await fetch(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`, {
      signal: ctl.signal,
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; Try1SecondLogoBot/1.0)' },
    });
    clearTimeout(t);
    if (!res.ok) return undefined;
    const mime = String(res.headers.get('content-type') || '').split(';')[0] || 'image/png';
    const bytes = Buffer.from(await res.arrayBuffer());
    // A 0-byte or HTML answer is not a logo.
    if (bytes.length < 100 || !/^image\//.test(mime)) return undefined;
    faviconCache.set(domain, { bytes, mime, at: Date.now() });
    return { bytes, mime };
  } catch {
    return undefined;
  }
}
