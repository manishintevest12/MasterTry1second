/**
 * Brand-image fallback (owner rule: every result card must carry an image).
 * Only REAL public logo sources are used, and only when the offer has no image of its own:
 *  - flights: the airline's logo from Google Flights' public airline-logo CDN (keyed by IATA code)
 *  - everything else: the seller's own favicon/logo via Google's favicon service
 * Data hosts (GitHub/OpenStreetMap/Wikidata...) are never treated as a brand. No image is invented:
 * when neither a code nor a brand domain is known the offer stays image-less (UI shows initials).
 */
import type { NormalizedOffer } from '../types';

const AIRLINE_IATA: Record<string, string> = {
  'indigo': '6E', 'spicejet': 'SG', 'air india': 'AI', 'air india express': 'IX', 'air-india express': 'IX',
  'akasa air': 'QP', 'akasa': 'QP', 'vistara': 'UK', 'alliance air': '9I', 'star air': 'S5', 'fly91': 'IC',
  'emirates': 'EK', 'qatar airways': 'QR', 'etihad airways': 'EY', 'singapore airlines': 'SQ', 'thai airways': 'TG',
  'british airways': 'BA', 'lufthansa': 'LH', 'air arabia': 'G9', 'flydubai': 'FZ', 'oman air': 'WY', 'airasia': 'AK',
};

const BRAND_DOMAIN: Array<[RegExp, string]> = [
  [/redbus/i, 'redbus.in'], [/abhibus/i, 'abhibus.com'], [/zingbus/i, 'zingbus.com'], [/intrcity/i, 'intrcity.com'],
  [/vrl/i, 'vrlbus.in'], [/srs travels/i, 'srsbooking.com'], [/savaari/i, 'savaari.com'], [/quick ?ride/i, 'quickride.in'],
  [/ola\b/i, 'olacabs.com'], [/uber/i, 'uber.com'], [/rapido/i, 'rapido.bike'], [/cleartrip/i, 'cleartrip.com'],
  [/airbnb/i, 'airbnb.co.in'], [/makemytrip/i, 'makemytrip.com'], [/goibibo/i, 'goibibo.com'], [/booking\.com/i, 'booking.com'],
  [/easemytrip/i, 'easemytrip.com'], [/ixigo/i, 'ixigo.com'], [/swiggy/i, 'swiggy.com'], [/zomato/i, 'zomato.com'],
  [/domino/i, 'dominos.co.in'], [/bookmyshow/i, 'bookmyshow.com'], [/ticketnew/i, 'ticketnew.com'], [/cinepolis/i, 'cinepolisindia.com'],
  [/district/i, 'district.in'], [/pvr|inox/i, 'pvrcinemas.com'], [/amazon/i, 'amazon.in'], [/flipkart/i, 'flipkart.com'],
  [/myntra/i, 'myntra.com'], [/ajio/i, 'ajio.com'], [/bankbazaar/i, 'bankbazaar.com'], [/paisabazaar/i, 'paisabazaar.com'],
  [/policybazaar/i, 'policybazaar.com'], [/bajaj/i, 'bajajfinserv.in'], [/money ?view/i, 'moneyview.in'], [/kreditbee/i, 'kreditbee.in'],
  [/hdfc ergo/i, 'hdfcergo.com'], [/hdfc/i, 'hdfcbank.com'], [/acko/i, 'acko.com'], [/digit/i, 'godigit.com'],
  [/insurancedekho/i, 'insurancedekho.com'], [/sbi/i, 'sbi.co.in'], [/icici/i, 'icicibank.com'], [/axis/i, 'axisbank.com'],
];
const DATA_HOST = /(^|\.)(githubusercontent|github|wikidata|wikipedia|openstreetmap|project-osrm|osrm)\./i;

function hostOf(u?: string): string | undefined {
  try { return u ? new URL(u).hostname.replace(/^www\./, '') : undefined; } catch { return undefined; }
}

export function brandImageFor(o: NormalizedOffer): string | undefined {
  const attrs: any = o.attributes || {};
  if (o.vertical === 'flights') {
    const code = String(attrs.airline_code || '').toUpperCase();
    const iata = /^[A-Z0-9]{2}$/.test(code) ? code : AIRLINE_IATA[String(attrs.airline || o.seller || '').toLowerCase().trim()];
    if (iata) return `https://www.gstatic.com/flights/airline_logos/70px/${iata}.png`;
  }
  const label = `${o.seller || ''} ${o.vendor || ''}`;
  let dom = BRAND_DOMAIN.find(([re]) => re.test(label))?.[1];
  if (!dom) { const h = hostOf((o as any).sellerUrl); if (h && !DATA_HOST.test(h)) dom = h; }
  return dom ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(dom)}&sz=128` : undefined;
}

/** Attach a brand image only where the offer has none of its own. Never overwrites a real product/hotel photo. */
export function withBrandImages(offers: NormalizedOffer[]): NormalizedOffer[] {
  for (const o of offers) {
    const a: any = o.attributes || (o.attributes = {} as any);
    if (a.image_url || a.image) continue;
    const img = brandImageFor(o);
    if (img) { a.image_url = img; a.image_is_brand_logo = 'true'; }
  }
  return offers;
}
