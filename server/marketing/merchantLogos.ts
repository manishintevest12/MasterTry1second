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
  // OWNER 13 Nov: "mai chata hoon koi v size daale ... w size khud apna kar le, na ki user ko bolo ye size
  // daalo". The tab compresses in the browser, and this cap is now the safety valve for any other client,
  // not advice to the owner: 8 MB of base64 still fits the column and the body parser, so a big photo is
  // stored instead of bounced.
  if (logo.length > 8_000_000) return { ok: false, error: 'That image is over 8 MB even as base64; save it as JPG once and retry' };
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

export async function upsertMerchantLogo(p: { name?: unknown; logo?: unknown; key?: unknown }): Promise<{ ok: boolean; error?: string; name_key?: string }> {
  const v = validateLogoPayload(p);
  // OWNER 11 Nov: merchantKeyOf() keeps only the FIRST word, so the finance tab's own keys
  // ("finance-loans-...") all collapsed to a single key 'finance' and every card shared one photo.
  // An explicit, slug-shaped key keeps each uploaded picture its own.
  const explicit = String((p as any)?.key || '').trim().toLowerCase();
  if (v.ok && v.clean && /^[a-z0-9][a-z0-9-]{2,79}$/.test(explicit)) v.clean.name_key = explicit;
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
  // Merchant brand key -> the domain whose own mark represents it. Every seller the engine can render a
  // row for belongs here, because a missing key is what makes the app fall back to an initials badge.
  reliance: 'reliancedigital.in',
  reliancedigital: 'reliancedigital.in',
  croma: 'croma.com',
  amazon: 'amazon.in',
  amzn: 'amazon.in',
  flipkart: 'flipkart.com',
  myntra: 'myntra.com',
  ajio: 'ajio.com',
  tatacliq: 'tatacliq.com',
  tata: 'tatacliq.com',
  shopsy: 'shopsy.in',
  nykaa: 'nykaa.com',
  snapdeal: 'snapdeal.com',
  jiomart: 'jiomart.com',
  blinkit: 'blinkit.com',
  zepto: 'zeptonow.com',
  zeptonow: 'zeptonow.com',
  instamart: 'swiggy.com',
  swiggy: 'swiggy.com',
  bigbasket: 'bigbasket.com',
  bbnow: 'bigbasket.com',
  flipkartminutes: 'flipkart.com',
  dmart: 'dmart.in',
  spencer: 'spencers.in',
  more: 'moreretail.in',
  vijaysales: 'vijaysales.com',
  poorvika: 'poorvika.com',
  sangeetha: 'sangeethamobiles.com',
  paytm: 'paytm.com',
  tataneu: 'newnue.com',
  firstcry: 'firstcry.com',
  redbus: 'redbus.in',
  abhibus: 'abhibus.com',
  zingbus: 'zingbus.com',
  ola: 'olacabs.com',
  uber: 'uber.com',
  rapido: 'rapido.bike',
  indrive: 'indrive.com',
  blusmart: 'blusmart.com',
  makemytrip: 'makemytrip.com',
  goibibo: 'goibibo.com',
  cleartrip: 'cleartrip.com',
  yatra: 'yatra.com',
  easemytrip: 'easemytrip.com',
  ixigo: 'ixigo.com',
  booking: 'booking.com',
  agoda: 'agoda.com',
  airbnb: 'airbnb.co.in',
  oyo: 'oyorooms.com',
  treebo: 'treebo.com',
  bookmyshow: 'bookmyshow.com',
  district: 'district.in',
  ticketnew: 'ticketnew.com',
  pvr: 'pvrcinemas.com',
  cinepolis: 'cinepolisindia.com',
  inox: 'inoxmovies.com',
  zomato: 'zomato.com',
  dominos: 'dominos.co.in',
  pizzahut: 'pizzahut.co.in',
  eatsure: 'eatsure.com',
  ovenstory: 'ovenstorypizzas.com',
  hdfc: 'hdfcbank.com',
  icici: 'icicibank.com',
  sbi: 'sbi.co.in',
  axis: 'axisbank.com',
  kotak: 'kotak.com',
  bajaj: 'bajajfinserv.in',
  acko: 'acko.com',
  digit: 'godigit.com',
  policybazaar: 'policybazaar.com',
  paisabazaar: 'paisabazaar.com',
  bankbazaar: 'bankbazaar.com',
  indigo: 'goindigo.in',
  spicejet: 'spicejet.com',
  airindia: 'airindia.in',
  akasa: 'akasaair.com',
  meesho: 'meesho.com',
  expedia: 'expedia.co.in',
  hotels: 'hotels.com',
  qatarairways: 'qatarairways.com',
  emirates: 'emirates.com',
  britishairways: 'britishairways.com',
  singaporeair: 'singaporeair.com',
  cathaypacific: 'cathaypacific.com',
  srilankan: 'srilankan.com',
  airindiaexpress: 'airindiaexpress.com',
  starair: 'starair.in',
  fly91: 'fly91.in',
  kiwi: 'kiwi.com',
  gotogate: 'gotogate.com',
  flightnetwork: 'flightnetwork.com',
  aertrip: 'aertrip.com',
  via: 'via.com',
  budgetair: 'budgetair.co.in',
  marriott: 'marriott.com',
  hilton: 'hilton.com',
  hyatt: 'hyatt.com',
  ihg: 'ihg.com',
  taj: 'tajhotels.com',
  accor: 'accor.com',
  radisson: 'radissonhotels.com',
  lemontree: 'lemontreehotels.com',
  fabhotels: 'fabhotels.com',
  zostel: 'zostel.com',
  oberoi: 'oberoihotels.com',
  theleela: 'theleela.com',
  orchid: 'orchidhotel.com',
  thepark: 'theparkhotels.com',
  sunnsand: 'sunnsandhotels.com',
  royalorchid: 'royalorchidhotels.com',
  meru: 'mahindralogistics.com',
  savaari: 'savaari.com',
  bharattaxi: 'bharattaxi.com',
  quickride: 'quickride.in',
  coverfox: 'coverfox.com',
  insurancedekho: 'insurancedekho.com',
  cardinsider: 'cardinsider.com',
  groww: 'groww.in',
  zerodha: 'zerodha.com',
  navi: 'navi.com',
  kreditbee: 'kreditbee.in',
  moneyview: 'moneyview.in',
  hdfcergo: 'hdfcergo.com',
  godigit: 'godigit.com',
  rbl: 'rblbank.com',
  yes: 'yesbank.in',
  hsbc: 'hsbc.co.in',
  amex: 'americanexpress.com',
  aubank: 'aubank.in',
  bobcard: 'bobfinancial.com',
  inDrive: 'indrive.com',
  bajajfinserv: 'bajajfinserv.in',
  jingbus: 'jingbus.com',
};


const faviconCache = new Map<string, { bytes: Buffer; mime: string; at: number }>();
const FAVICON_TTL_MS = 12 * 60 * 60_000;

/** The brand's own domain for a key, or '' when the brand is unknown. Export makes the map testable without
 *  depending on a live favicon provider (provider flakes are not a code regression). */
export function brandDomainFor(nameKey: string): string {
  const key = String(nameKey || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return KEY_DOMAIN[key] || '';
}

/** Real favicon bytes for a brand key, cached. undefined = unknown brand / fetch failed. */
export async function resolveBrandFavicon(nameKey: string): Promise<{ bytes: Buffer; mime: string } | undefined> {
  const key = String(nameKey || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const domain = KEY_DOMAIN[key];
  if (!domain) return undefined;
  const hit = faviconCache.get(domain);
  if (hit && Date.now() - hit.at < FAVICON_TTL_MS) return { bytes: hit.bytes, mime: hit.mime };
  // Two independent providers: Google's favicon cache first, DuckDuckGo's icon service as the second way
  // home. A single transient provider failure must not turn a seller's mark into an initials badge.
  const providers = [
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`,
    `https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`,
    // Third route: the brand's own icon files, for the handful the two caches do not carry.
    `https://${domain}/apple-touch-icon.png`,
    `https://${domain}/favicon.ico`,
  ];
  for (const url of providers) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 4500);
      const res = await fetch(url, {
        signal: ctl.signal,
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; Try1SecondLogoBot/1.0)' },
      });
      clearTimeout(t);
      if (!res.ok) continue;
      const mime = String(res.headers.get('content-type') || '').split(';')[0] || 'image/png';
      const bytes = Buffer.from(await res.arrayBuffer());
      // A 0-byte or HTML answer is not a logo.
      const magic = bytes.subarray(0, 12);
      const looksImage = (magic[0] === 0x89 && magic[1] === 0x50) || (magic[0] === 0xff && magic[1] === 0xd8)
        || magic.subarray(0, 3).toString('ascii') === 'GIF' || magic.subarray(0, 4).toString('ascii') === 'RIFF'
        || /svg|xml|image/i.test(mime);
      if (bytes.length < 100 || !looksImage) continue;
      const servedMime = /^image\//.test(mime) ? mime : 'image/png';
      faviconCache.set(domain, { bytes, mime: servedMime, at: Date.now() });
      return { bytes, mime: servedMime };
    } catch { /* try the next provider */ }
  }
  return undefined;
}
