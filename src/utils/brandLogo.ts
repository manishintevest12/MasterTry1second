/**
 * Brand logos for travel/finance rows. Only REAL public logo sources are used:
 *  - airlines: Google Flights' public airline-logo CDN keyed by IATA code
 *  - everything else: the brand's own favicon via Google's favicon service
 * When neither can be resolved the caller renders a neutral initials badge (never a fake logo).
 */
const AIRLINE_NAME_TO_IATA: Record<string, string> = {
  'indigo': '6E', 'spicejet': 'SG', 'air india': 'AI', 'air india express': 'IX', 'air-india express': 'IX',
  'akasa air': 'QP', 'akasa': 'QP', 'vistara': 'UK', 'alliance air': '9I', 'star air': 'S5', 'fly91': 'IC',
  'emirates': 'EK', 'qatar airways': 'QR', 'etihad': 'EY', 'etihad airways': 'EY', 'singapore airlines': 'SQ',
  'thai airways': 'TG', 'british airways': 'BA', 'lufthansa': 'LH', 'air arabia': 'G9', 'flydubai': 'FZ',
  'oman air': 'WY', 'saudia': 'SV', 'turkish airlines': 'TK', 'malaysia airlines': 'MH', 'airasia': 'AK',
  'cathay pacific': 'CX', 'virgin atlantic': 'VS', 'klm': 'KL', 'air france': 'AF', 'kuwait airways': 'KU',
  'gulf air': 'GF', 'royal jordanian': 'RJ', 'jazeera airways': 'J9', 'srilankan': 'UL', 'sri lankan airlines': 'UL',
  'maldivian': 'Q2', 'thai airasia': 'FD', 'nok air': 'DD', 'ethiopian': 'ET', 'egyptair': 'MS',
  'kenya airways': 'KQ', 'el al': 'LY', 'air canada': 'AC', 'united': 'UA', 'american airlines': 'AA',
  'air asia x': 'D7', 'batik air': 'ID', 'lion air': 'JT', 'scoot': 'TR', 'jetstar': 'JQ',
  'air mauritius': 'MK', 'air seychelles': 'HM', 'us airways': 'US', 'air astana': 'KC',
};

const DOMAIN_BY_BRAND: Array<[RegExp, string]> = [
  [/redbus/i, 'redbus.in'], [/abhibus/i, 'abhibus.com'], [/zingbus/i, 'zingbus.com'], [/intrcity|intercity smart/i, 'intrcity.com'],
  [/vrl/i, 'vrlbus.in'], [/srs/i, 'srsbooking.com'], [/nuego/i, 'ngo.nuego.in'], [/flixbus/i, 'flixbus.in'],
  [/savaari/i, 'savaari.com'], [/quick ?ride/i, 'quickride.in'], [/ola/i, 'book.olacabs.com'], [/uber/i, 'uber.com'],
  [/rapido/i, 'rapido.bike'], [/indrive/i, 'indrive.com'], [/blusmart/i, 'blusmart.com'], [/meru/i, 'meru.in'],
  [/cleartrip/i, 'cleartrip.com'], [/airbnb/i, 'airbnb.co.in'], [/makemytrip|mmt/i, 'makemytrip.com'],
  [/goibibo/i, 'goibibo.com'], [/booking\.com/i, 'booking.com'], [/agoda/i, 'agoda.com'], [/yatra/i, 'yatra.com'],
  [/easemytrip|emt/i, 'easemytrip.com'], [/ixigo/i, 'ixigo.com'], [/oyo/i, 'oyorooms.com'], [/treebo/i, 'treebo.com'],
  [/swiggy/i, 'swiggy.com'], [/zomato/i, 'zomato.com'], [/domino/i, 'dominos.co.in'], [/pizza hut/i, 'pizzahut.co.in'],
  [/bookmyshow|bms/i, 'bookmyshow.com'], [/ticketnew/i, 'ticketnew.com'], [/cinepolis/i, 'cinepolisindia.com'],
  [/district/i, 'district.in'], [/paytm/i, 'paytm.com'], [/pvr|inox/i, 'pvrcinemas.com'],
  [/amazon/i, 'amazon.in'], [/flipkart/i, 'flipkart.com'], [/myntra/i, 'myntra.com'], [/ajio/i, 'ajio.com'],
  [/meesho/i, 'meesho.com'], [/tata ?cliq/i, 'tatacliq.com'], [/croma/i, 'croma.com'], [/reliance digital/i, 'reliancedigital.in'],
  [/blinkit/i, 'blinkit.com'], [/zepto/i, 'zeptonow.com'], [/instamart/i, 'swiggy.com'], [/bigbasket/i, 'bigbasket.com'],
  [/jiomart/i, 'jiomart.com'], [/bankbazaar/i, 'bankbazaar.com'], [/paisabazaar/i, 'paisabazaar.com'],
  [/policybazaar/i, 'policybazaar.com'], [/bajaj/i, 'bajajfinserv.in'], [/money ?view/i, 'moneyview.in'],
  [/hdfc ergo/i, 'hdfcergo.com'], [/hdfc/i, 'hdfcbank.com'], [/acko/i, 'acko.com'], [/digit/i, 'godigit.com'],
  [/sbi/i, 'sbi.co.in'], [/icici/i, 'icicibank.com'], [/axis/i, 'axisbank.com'], [/kotak/i, 'kotak.com'],
  // Owner 17 Oct: companies whose logos were resolving to generic/blank favicons.
  [/bharat ?taxi/i, 'bharattaxi.com'], [/travelguru/i, 'travelguru.com'], [/kiwi/i, 'kiwi.com'],
  [/expedia/i, 'expedia.com'], [/via\.com/i, 'via.com'], [/saffronstays/i, 'saffronstays.com'],
  [/ditto/i, 'dittoinsurance.com'], [/insurancedekho/i, 'insurancedekho.com'], [/coverfox/i, 'coverfox.com'],
  [/kreditbee/i, 'kreditbee.in'], [/(^|\b)navi(\b|$)/i, 'navi.com'], [/cardinsider/i, 'cardinsider.com'],
  [/nykaa/i, 'nykaa.com'], [/snapdeal/i, 'snapdeal.com'], [/tata ?neu/i, 'tatacliq.com'],
  [/oven ?story/i, 'ovenstorypizzas.com'], [/eatsure/i, 'eatsure.com'], [/blu?smart/i, 'bluSmart.in'],
  [/indigo/i, 'goindigo.in'], [/spicejet/i, 'spicejet.com'], [/air india express/i, 'airindiaexpress.in'],
  [/(^|\b)air india(\b|$)/i, 'airindia.in'], [/akasa/i, 'akasaair.com'], [/vistara/i, 'airvistara.com'],
  [/emer?ging/i, 'emergingtravel.com'], [/alibaba/i, 'alibaba.com'],
];

/**
 * Owner 17 Oct: some brands publish only a 16x16 favicon — Google's favicon service
 * upscales it into a pixelated smear (redBus, BigBasket screenshots). For those we
 * ship the brand's own high-res logo as a static asset instead.
 */
const HD_LOGO: Array<[RegExp, string]> = [
  [/redbus/i, '/brand-logos/redbus.svg'],
  [/big ?basket|bb ?now/i, '/brand-logos/bigbasket.png'],
];

export function airlineIata(item: { specs?: Record<string, string>; provider?: string; subtitle?: string }): string | undefined {
  const code = item.specs?.['airline code'] || item.specs?.['airline_code'];
  if (code && /^[A-Za-z0-9]{2}$/.test(code)) return code.toUpperCase();
  const alName = String(item.specs?.['airline'] || '').toLowerCase().trim();
  if (alName && AIRLINE_NAME_TO_IATA[alName]) return AIRLINE_NAME_TO_IATA[alName];
  const name = (item.provider || item.subtitle || '').toLowerCase().trim();
  return AIRLINE_NAME_TO_IATA[name];
}

export function brandDomain(name: string | null | undefined): string | undefined {
  const n = String(name ?? '');
  if (!n) return undefined;
  for (const [re, d] of DOMAIN_BY_BRAND) if (re.test(n)) return d;
  return undefined;
}

/** Best real logo URL for an item, or undefined (caller shows initials). */
export function brandLogoUrl(item: { vertical: string; specs?: Record<string, string>; provider?: string; subtitle?: string; sellerQuotes?: Array<{ sourceDomain?: string }> }): string | undefined {
  if (item.vertical === 'flights') {
    const iata = airlineIata(item);
    if (iata) return `https://www.gstatic.com/flights/airline_logos/70px/${iata}.png`;
  }
  const name = `${item.provider || ''} ${item.subtitle || ''}`;
  for (const [re, asset] of HD_LOGO) if (re.test(name)) return asset;
  let dom = brandDomain(name) || item.sellerQuotes?.[0]?.sourceDomain?.replace(/^www\./, '');
  // Data hosts (open-data mirrors, APIs) are never a brand: show initials instead of their favicon.
  if (dom && /(^|\.)(githubusercontent|github|wikidata|wikipedia|openstreetmap|osrm|project-osrm)\./i.test(dom)) dom = undefined;
  return dom ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(dom)}&sz=128` : undefined;
}

export function initials(name: string | null | undefined): string {
  // OWNER 2 Nov ("/flights par undefined.replace"): every card helper must survive a row that
  // arrived without a provider/subtitle instead of throwing out of the whole feed.
  const parts = String(name ?? '').replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0] || '?').slice(0, 2)).toUpperCase();
}
