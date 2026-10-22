/**
 * Brand-image fallback (owner rule: every result card must carry an image).
 * Only REAL public logo sources are used, and only when the offer has no image of its own:
 *  - flights: the airline's logo from Google Flights' public airline-logo CDN (keyed by IATA code)
 *  - everything else: the seller's own favicon/logo via Google's favicon service
 * Data hosts (GitHub/OpenStreetMap/Wikidata...) are never treated as a brand. No image is invented:
 * when neither a code nor a brand domain is known the offer stays image-less (UI shows initials).
 */
import type { NormalizedOffer } from '../types';
import { resolveLenderLogo } from './lenderLogo';

const AIRLINE_IATA: Record<string, string> = {
  'indigo': '6E', 'spicejet': 'SG', 'air india': 'AI', 'air india express': 'IX', 'air-india express': 'IX',
  'akasa air': 'QP', 'akasa': 'QP', 'vistara': 'UK', 'alliance air': '9I', 'star air': 'S5', 'fly91': 'IC',
  'emirates': 'EK', 'qatar airways': 'QR', 'etihad airways': 'EY', 'singapore airlines': 'SQ', 'thai airways': 'TG',
  'british airways': 'BA', 'lufthansa': 'LH', 'air arabia': 'G9', 'flydubai': 'FZ', 'oman air': 'WY', 'airasia': 'AK',
};

const BRAND_DOMAIN: Array<[RegExp, string]> = [
  [/redbus/i, 'redbus.in'], [/abhibus/i, 'abhibus.com'], [/zingbus/i, 'zingbus.com'], [/intrcity/i, 'intrcity.com'],
  [/vrl/i, 'vrlbus.in'], [/srs travels/i, 'srsbooking.com'], [/savaari/i, 'savaari.com'], [/quick ?ride/i, 'quickride.in'],
  [/ola\b/i, 'book.olacabs.com'], [/uber/i, 'uber.com'], [/rapido/i, 'rapido.bike'], [/cleartrip/i, 'cleartrip.com'],
  [/airbnb/i, 'airbnb.co.in'], [/makemytrip/i, 'makemytrip.com'], [/goibibo/i, 'goibibo.com'], [/booking\.com/i, 'booking.com'],
  [/easemytrip/i, 'easemytrip.com'], [/ixigo/i, 'ixigo.com'], [/swiggy/i, 'swiggy.com'], [/zomato/i, 'zomato.com'],
  [/domino/i, 'dominos.co.in'], [/bookmyshow/i, 'bookmyshow.com'], [/ticketnew/i, 'ticketnew.com'], [/cinepolis/i, 'cinepolisindia.com'],
  [/district/i, 'district.in'], [/pvr|inox/i, 'pvrcinemas.com'], [/amazon/i, 'amazon.in'], [/flipkart/i, 'flipkart.com'],
  [/myntra/i, 'myntra.com'], [/ajio/i, 'ajio.com'], [/bankbazaar/i, 'bankbazaar.com'], [/paisabazaar/i, 'paisabazaar.com'],
  [/policybazaar/i, 'policybazaar.com'], [/bajaj/i, 'bajajfinserv.in'], [/money ?view/i, 'moneyview.in'], [/kreditbee/i, 'kreditbee.in'],
  [/hdfc ergo/i, 'hdfcergo.com'], [/hdfc/i, 'hdfcbank.com'], [/acko/i, 'acko.com'], [/digit/i, 'godigit.com'],
  [/insurancedekho/i, 'insurancedekho.com'], [/sbi/i, 'sbi.co.in'], [/icici/i, 'icicibank.com'], [/axis/i, 'axisbank.com'],
];
// Lender / issuer / insurer domains: for loans, insurance and credit cards the logo must be the
// institution the offer is FOR (Axis Bank, Union Bank...), never the comparison site that listed it.
const LENDER_DOMAIN: Array<[RegExp, string]> = [
  [/axis/i, 'axisbank.com'], [/union bank/i, 'unionbankofindia.co.in'], [/idfc/i, 'idfcfirstbank.com'],
  [/\bsbi\b|state bank/i, 'sbi.co.in'], [/\bpnb\b|punjab national/i, 'pnbindia.in'], [/indusind/i, 'indusind.com'],
  [/hdfc ergo/i, 'hdfcergo.com'], [/hdfc/i, 'hdfcbank.com'], [/icici lombard/i, 'icicilombard.com'], [/icici pru|icici prudential/i, 'iciciprulife.com'],
  [/icici/i, 'icicibank.com'], [/kotak/i, 'kotak.com'],
  // Brokers / demat + investment platforms (owner 22 Oct: "Zerodha Demat Account" card rendered blank)
  [/zerodha/i, 'zerodha.com'], [/groww/i, 'groww.in'], [/upstox/i, 'upstox.com'],
  [/angel ?one|angel broking/i, 'angelone.in'], [/5paisa/i, '5paisa.com'], [/dhan/i, 'dhan.co'],
  [/paytm money/i, 'paytmmoney.com'], [/smallcase/i, 'smallcase.com'], [/yes bank/i, 'yesbank.in'], [/bank of baroda|\bbob\b/i, 'bankofbaroda.in'],
  [/canara/i, 'canarabank.com'], [/bank of india/i, 'bankofindia.co.in'], [/bank of maharashtra/i, 'bankofmaharashtra.in'],
  [/central bank/i, 'centralbankofindia.co.in'], [/indian bank/i, 'indianbank.in'], [/indian overseas|\biob\b/i, 'iob.in'],
  [/uco bank/i, 'ucobank.com'], [/punjab (&|and) sind/i, 'psbindia.com'], [/federal bank/i, 'federalbank.co.in'],
  [/rbl/i, 'rblbank.com'], [/au small|au bank/i, 'aubank.in'], [/bandhan/i, 'bandhanbank.com'], [/idbi/i, 'idbibank.in'],
  [/south indian/i, 'southindianbank.com'], [/karnataka bank/i, 'karnatakabank.com'], [/city union/i, 'cityunionbank.com'],
  [/standard chartered/i, 'sc.com'], [/hsbc/i, 'hsbc.co.in'], [/citi/i, 'citibank.co.in'], [/american express|amex/i, 'americanexpress.com'],
  [/dbs/i, 'dbs.com'], [/tata capital/i, 'tatacapital.com'], [/tata aig/i, 'tataaig.com'], [/bajaj (finserv|finance)/i, 'bajajfinserv.in'],
  [/bajaj allianz/i, 'bajajallianz.com'], [/hero fincorp/i, 'herofincorp.com'], [/fullerton|sumitomo/i, 'smfgindia.com'],
  [/piramal/i, 'piramalfinance.com'], [/aditya birla/i, 'adityabirlacapital.com'], [/poonawalla/i, 'poonawallafincorp.com'],
  [/lendingkart/i, 'lendingkart.com'], [/navi/i, 'navi.com'], [/kreditbee/i, 'kreditbee.in'], [/money ?view/i, 'moneyview.in'],
  [/cashe/i, 'getcashe.com'], [/fibe|earlysalary/i, 'myfibe.com'], [/mpokket/i, 'mpokket.in'], [/stashfin/i, 'stashfin.com'],
  [/lic\b|life insurance corp/i, 'licindia.in'], [/star health/i, 'starhealth.in'], [/care health/i, 'careinsurance.com'],
  [/niva|max bupa/i, 'nivabupa.com'], [/new india/i, 'newindia.co.in'], [/national insurance/i, 'nationalinsurance.nic.co.in'],
  [/oriental/i, 'orientalinsurance.org.in'], [/united india/i, 'uiic.co.in'], [/royal sundaram/i, 'royalsundaram.in'],
  [/reliance general/i, 'reliancegeneral.co.in'], [/sbi general/i, 'sbigeneral.in'], [/sbi life/i, 'sbilife.co.in'],
  [/future generali|generali/i, 'generalicentral.com'], [/chola/i, 'cholainsurance.com'], [/iffco/i, 'iffcotokio.co.in'],
  [/acko/i, 'acko.com'], [/digit/i, 'godigit.com'], [/manipal/i, 'manipalcigna.com'], [/aditya birla health/i, 'adityabirlacapital.com'],
];
const LENDER_VERTICALS = new Set(['loans', 'insurance', 'creditcards', 'banking', 'account']);
const DATA_HOST = /(^|\.)(githubusercontent|github|wikidata|wikipedia|openstreetmap|project-osrm|osrm)\./i;

function hostOf(u?: string): string | undefined {
  try { return u ? new URL(u).hostname.replace(/^www\./, '') : undefined; } catch { return undefined; }
}

/** Brands stuck with a 16x16 favicon ship a bundled high-res asset instead (17 Oct). */
const HD_LOGO: Array<[RegExp, string]> = [
  [/redbus/i, '/brand-logos/redbus.svg'],
  [/big ?basket|bb ?now/i, '/brand-logos/bigbasket.png'],
];

export function brandImageFor(o: NormalizedOffer): string | undefined {
  const attrs: any = o.attributes || {};
  if (o.vertical === 'flights') {
    const code = String(attrs.airline_code || '').toUpperCase();
    const iata = /^[A-Z0-9]{2}$/.test(code) ? code : AIRLINE_IATA[String(attrs.airline || o.seller || '').toLowerCase().trim()];
    if (iata) return `https://www.gstatic.com/flights/airline_logos/70px/${iata}.png`;
  }
  // Loans / insurance / cards: logo of the lender named on the offer (title / provider / bank), not the listing site.
  if (LENDER_VERTICALS.has(String(o.vertical))) {
    const lenderLabel = `${o.title || ''} ${attrs.bank || ''} ${attrs.provider || ''} ${attrs.insurer || ''} ${attrs.lender || ''}`;
    const ld = LENDER_DOMAIN.find(([re]) => re.test(lenderLabel))?.[1];
    if (ld) return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(ld)}&sz=128`;
  }
  const label = `${o.seller || ''} ${o.vendor || ''}`;
  const hd = HD_LOGO.find(([re]) => re.test(label))?.[1];
  if (hd) return hd;
  let dom = BRAND_DOMAIN.find(([re]) => re.test(label))?.[1];
  if (!dom) { const h = hostOf((o as any).sellerUrl); if (h && !DATA_HOST.test(h)) dom = h; }
  return dom ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(dom)}&sz=128` : undefined;
}

/** Owner rule (17 Oct food, 22 Oct grocery): PRODUCT cards must never show a merchant
 * logo in place of a product photo. Grocery/food rows without a real photo stay empty
 * and the UI renders its honest product placeholder instead of a misleading logo. */
const PRODUCT_IMAGE_VERTICALS = new Set(['grocery', 'food']);

/** Attach a brand image only where the offer has none of its own. Never overwrites a real product/hotel photo. */
export function withBrandImages(offers: NormalizedOffer[]): NormalizedOffer[] {
  for (const o of offers) {
    const a: any = o.attributes || (o.attributes = {} as any);
    if (a.image_url || a.image) continue;
    if (PRODUCT_IMAGE_VERTICALS.has(String(o.vertical))) continue;
    const img = brandImageFor(o);
    if (img) { a.image_url = img; a.image_is_brand_logo = 'true'; }
  }
  return offers;
}

const FAVICON_URL = /s2\/favicons|brand-logos\//;

/** Purge merchant-logo stand-ins already stored on product rows (stale catalogue rows
 * persisted before the rule). Runs on every search assembly so old favicons cannot
 * resurface as fake product photos on grocery/food cards. */
export function stripMerchantLogoFallbacks(offers: NormalizedOffer[]): NormalizedOffer[] {
  for (const o of offers) {
    if (!PRODUCT_IMAGE_VERTICALS.has(String(o.vertical))) continue;
    const a: any = o.attributes || {};
    const isLogo = (u?: string) => !u || a.image_is_brand_logo === 'true' || FAVICON_URL.test(u);
    if (isLogo(a.image_url)) { delete a.image_url; delete a.image_is_brand_logo; delete a.image_is_lender_logo; }
    if (Array.isArray(a.image_urls)) {
      const real = (a.image_urls as string[]).filter((u) => u && !FAVICON_URL.test(u));
      if (real.length) a.image_urls = real; else delete a.image_urls;
    }
  }
  return offers;
}

const LENDER_VERTICAL_IDS = new Set(['loans', 'insurance', 'creditcards', 'account']);

/**
 * Loans / insurance: replace the comparison-site favicon with the LENDER's real logo (Wikidata P154).
 * Credit cards keep their own card art; only a missing image falls back to the issuing bank's logo.
 * Real photos are never overwritten. Lookups are cached; failures leave the existing fallback in place.
 */
export async function withLenderLogos(offers: NormalizedOffer[]): Promise<NormalizedOffer[]> {
  const targets = offers.filter((o) => {
    if (!LENDER_VERTICAL_IDS.has(String(o.vertical))) return false;
    const a: any = o.attributes || {};
    return !a.image_url || a.image_is_brand_logo === 'true';   // never overwrite a real card/product photo
  });
  const names = Array.from(new Set(targets.map((o) => String((o.attributes as any)?.bank || o.title || ''))));
  const logos = new Map<string, string | null>();
  await Promise.all(names.map(async (n) => { logos.set(n, await resolveLenderLogo(n)); }));
  for (const o of targets) {
    const a: any = o.attributes || (o.attributes = {} as any);
    const logo = logos.get(String((o.attributes as any)?.bank || o.title || ''));
    if (logo) { a.image_url = logo; a.image_is_brand_logo = 'true'; a.image_is_lender_logo = 'true'; }
  }
  return offers;
}

/**
 * Owner 21 Oct: admin-uploaded brand logos beat every generic fallback. The
 * merchant_logos table (admin upload, base64 data URL) is cached in-memory for
 * 5 minutes — shared-hosting friendly — and applied to offers with no real photo
 * of their own. This is the fix for "globe/blurry icons" (Ola, Bank of
 * Maharashtra, small banks...): the owner uploads the right logo once in admin.
 */
let uploadedLogosCache: { at: number; map: Record<string, string> } | null = null;
async function uploadedLogoMap(): Promise<Record<string, string>> {
  if (uploadedLogosCache && Date.now() - uploadedLogosCache.at < 300_000) return uploadedLogosCache.map;
  try {
    const { merchantLogoMap } = await import('../marketing/merchantLogos');
    const map = await merchantLogoMap();
    uploadedLogosCache = { at: Date.now(), map };
    return map;
  } catch { return (uploadedLogosCache = { at: Date.now(), map: {} } as any).map; }
}

/** Same slug the deals registry uses so "Bank of Maharashtra" -> "bank". */
function logoKeyOf(name: string): string {
  return String(name || '').toLowerCase().replace(/\.(com|in|co\.in)\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim().split(' ')[0] || '';
}

export async function withMerchantLogos(offers: NormalizedOffer[]): Promise<NormalizedOffer[]> {
  const map = await uploadedLogoMap();
  if (!Object.keys(map).length) return offers;
  for (const o of offers) {
    const a: any = o.attributes || {};
    if (a.image_url && a.image_is_brand_logo !== 'true') continue; // never overwrite a real product photo
    const attrs: any = o.attributes || {};
    const label = [o.seller, o.vendor, o.title, attrs.bank, attrs.lender, attrs.insurer, attrs.provider].filter(Boolean).join(' ');
    const keys = [logoKeyOf(String(o.seller || '')), logoKeyOf(String(attrs.bank || '')), logoKeyOf(String(attrs.lender || '')), logoKeyOf(String(attrs.provider || ''))];
    for (const k of keys) {
      if (k && map[k]) { a.image_url = map[k]; a.image_is_brand_logo = 'true'; break; }
    }
    void label;
  }
  return offers;
}
