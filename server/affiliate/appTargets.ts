/**
 * PARTNER APP TARGETS (owner 30 Oct) — "app-to-app" exits.
 *
 * When a user taps an offer, we want the partner's OWN app to open if it is installed on
 * the phone, and the merchant site otherwise. Nothing here replaces the money path: every
 * target still carries the affiliate/AdSense URL as its fallback, so a missing app only
 * changes WHERE the page opens, never WHETHER we get paid.
 *
 * How the open works on Android: `intent://…#Intent;scheme=https;package=<pkg>;
 * S.browser_fallback_url=<our tracked url>;end`. Chrome (and any WebView that forwards it)
 * launches the package when installed and silently falls back to our tracked URL when it is
 * not — a single URL, no app-detection guessing from the server.
 *
 * package ids below were each confirmed against the Play Store listing (HTTP 200) before
 * being added; a wrong id is harmless (the fallback fires) but a MISSING id would silently
 * lose the app hop, so nothing unverified is listed.
 */
export interface AppTarget {
  /** Display label used in the interstitial button. */
  label: string;
  /** Android application id (verified on Play). */
  pkg: string;
  /** Custom scheme, only where the app documents one (cabs mainly). */
  scheme?: string;
}

/** Host fragments -> target. First match wins, so put specific hosts before generic ones. */
const BY_HOST: Array<[RegExp, AppTarget]> = [
  // cabs (native schemes already used by the cab exit page)
  [/(^|\.)olacabs\.com$|(^|\.)olacabs\.in$/, { label: 'Ola', pkg: 'com.olacabs.customer', scheme: 'olacabs://' }],
  [/(^|\.)uber\.com$/, { label: 'Uber', pkg: 'com.ubercab', scheme: 'uber://' }],
  [/(^|\.)rapido\.bike$/, { label: 'Rapido', pkg: 'com.rapido.passenger', scheme: 'rapido://' }],
  [/(^|\.)indriver\.com$/, { label: 'inDrive', pkg: 'sinet.startup.inDriver' }],
  // flights
  [/(^|\.)goindigo\.in$/, { label: 'IndiGo', pkg: 'in.goindigo.android' }],
  [/(^|\.)airindia\.com$|(^|\.)airindia\.in$/, { label: 'Air India', pkg: 'com.bets.airindia.ui' }],
  [/(^|\.)akasaair\.com$/, { label: 'Akasa Air', pkg: 'com.akasaair.ibe' }],
  [/(^|\.)spicejet\.com$/, { label: 'SpiceJet', pkg: 'com.vl.spicejet' }],
  [/(^|\.)makemytrip\.com$/, { label: 'MakeMyTrip', pkg: 'com.makemytrip' }],
  [/(^|\.)goibibo\.com$/, { label: 'Goibibo', pkg: 'com.goibibo' }],
  [/(^|\.)yatra\.com$/, { label: 'Yatra', pkg: 'com.yatra.base' }],
  [/(^|\.)cleartrip\.com$/, { label: 'Cleartrip', pkg: 'com.cleartrip.android' }],
  [/(^|\.)easemytrip\.com$/, { label: 'EaseMyTrip', pkg: 'com.easemytrip.android' }],
  [/(^|\.)ixigo\.com$/, { label: 'ixigo', pkg: 'com.ixigo.train.ixigotrains' }],
  // hotels
  [/(^|\.)agoda\.com$/, { label: 'Agoda', pkg: 'com.agoda.mobile.consumer' }],
  [/(^|\.)booking\.com$/, { label: 'Booking.com', pkg: 'com.booking' }],
  [/(^|\.)oyorooms\.com$|(^|\.)oyorooms\.com\.*$|(^|\.)oyo\.com$/, { label: 'OYO', pkg: 'com.oyo.consumer' }],
  [/(^|\.)airbnb\.(co\.in|com)$/, { label: 'Airbnb', pkg: 'com.airbnb.android' }],
  // bus
  [/(^|\.)redbus\.in$/, { label: 'redBus', pkg: 'in.redbus.android', scheme: 'redbus://' }],
  [/(^|\.)abhibus\.com$/, { label: 'AbhiBus', pkg: 'com.app.abhibus' }],
  [/(^|\.)zingbus\.com$/, { label: 'zingbus', pkg: 'com.zingbusbtoc.zingbus' }],
  // movies
  [/(^|\.)bookmyshow\.com$/, { label: 'BookMyShow', pkg: 'com.bt.bms', scheme: 'bookmyshow://' }],
  [/(^|\.)district\.in$/, { label: 'District', pkg: 'com.application.zomato.district' }],
  [/(^|\.)cinepolis(india)?\.com$/, { label: 'Cinépolis', pkg: 'com.ia.cinepolis.india' }],
  [/(^|\.)ticketnew\.com$/, { label: 'TicketNew', pkg: 'ticketnew.android.ui' }],
  // food
  [/(^|\.)swiggy\.com$/, { label: 'Swiggy', pkg: 'in.swiggy.android', scheme: 'swiggy://' }],
  [/(^|\.)zomato\.com$/, { label: 'Zomato', pkg: 'com.application.zomato', scheme: 'zomato://' }],
  [/(^|\.)dominos\.co\.in$/, { label: "Domino's", pkg: 'com.Dominos' }],
  // grocery
  [/(^|\.)blinkit\.com$/, { label: 'Blinkit', pkg: 'com.grofers.customerapp', scheme: 'blinkit://' }],
  [/(^|\.)zepto\.com$/, { label: 'Zepto', pkg: 'com.zeptoconsumerapp' }],
  [/(^|\.)bigbasket\.com$/, { label: 'BigBasket', pkg: 'com.bigbasket.mobileapp' }],
  [/(^|\.)jiomart\.com$/, { label: 'JioMart', pkg: 'com.jpl.jiomart' }],
  // ecommerce
  [/(^|\.)amazon\.(in|com)$|(^|\.)amzn\.to$/, { label: 'Amazon', pkg: 'com.amazon.mShop.android.shopping', scheme: 'amazon://' }],
  [/(^|\.)flipkart\.com$/, { label: 'Flipkart', pkg: 'com.flipkart.android', scheme: 'flipkart://' }],
  [/(^|\.)myntra\.com$/, { label: 'Myntra', pkg: 'com.myntra.android', scheme: 'myntra://' }],
  [/(^|\.)ajio\.com$/, { label: 'AJIO', pkg: 'com.ril.ajio' }],
  [/(^|\.)meesho\.com$/, { label: 'Meesho', pkg: 'com.meesho.supply' }],
  [/(^|\.)tatacliq\.com$/, { label: 'Tata CLiQ', pkg: 'com.tul.tatacliq' }],
  [/(^|\.)reliancedigital\.in$/, { label: 'Reliance Digital', pkg: 'in.digital.reliance' }],
  // banking / loans / insurance
  [/(^|\.)hdfcbank\.com$/, { label: 'HDFC Bank', pkg: 'com.hdfcbank.android.now' }],
  [/(^|\.)paisabazaar\.com$/, { label: 'Paisabazaar', pkg: 'com.paisabazaar' }],
  [/(^|\.)bankbazaar\.com$/, { label: 'BankBazaar', pkg: 'com.bankbazaar.app' }],
  [/(^|\.)insurancedekho\.com$/, { label: 'InsuranceDekho', pkg: 'com.insurancedekho.pos' }],
  [/(^|\.)acko\.com$/, { label: 'Acko', pkg: 'com.acko.android' }],
];

const norm = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Display-name fallback for destinations we could not match by host (affiliate hops). */
const BY_NAME: Array<[string, AppTarget]> = BY_HOST.map(([, t]) => [norm(t.label), t]);

export function hostOf(url: string): string {
  try { return new URL(url).hostname.toLowerCase(); } catch { return ''; }
}

/** The installed-app target for this exit, or null when the partner has no app we know. */
/**
 * MONEY-SAFE RULE (owner 30 Oct: "earnings miss na ho"): an app hop is only attempted when
 * the destination still points at the merchant's OWN host. If the link is an affiliate
 * converter hop (linkinr.com, fktr.in, cuelinks, ekaro...), launching the merchant app would
 * skip the network's redirect chain and lose the commission, so those exits stay on the
 * converted URL in the browser. AdSense is unaffected either way: the interstitial still
 * renders on the same page.
 */
export function directAppTarget(destinationUrl: string): AppTarget | null {
  const host = hostOf(destinationUrl);
  if (!host) return null;
  for (const [re, target] of BY_HOST) if (re.test(host)) return target;
  return null;
}

/**
 * Ticketing partner hosts whose exits must STAY INSIDE the in-app browser.
 *
 * Owner 2 Nov: "maine kaha tha iske andar dikhane ko jaisa 1st image mai hai, pr ye tho
 * redirection ke baad new tab open krta hai. phle iske andar hi aata tha aur black colour
 * se link hide krta tha pr ab ni krta hai."
 *
 * What was happening: for a movies exit the app webview asked /api/out, the server answered
 * `intent://…#package=com.bt.bms;S.browser_fallback_url=<paid url>;end`, the webview handed
 * that to the OS (app_handoff) and the OS either opened the BookMyShow app or, when it is not
 * installed, opened CHROME with the fallback URL — a normal browser tab, so the dark in-app
 * browser header (hidden URL) disappeared and the tracked stay-on-page flow broke.
 *
 * The app hop is a nice-to-have for shop/travel exits, but a movie booking is a multi-step
 * seat-selection flow that belongs inside our own browser. These hosts therefore never get
 * the intent redirect; the webview loads the tracked https URL directly.
 */
export const WEBVIEW_ONLY_HOSTS: Array<[RegExp, string]> = [
  [/(^|\.)bookmyshow\.com$/, 'BookMyShow'],
  [/(^|\.)district\.in$/, 'District'],
  [/(^|\.)cinepolis(india)?\.com$/, 'Cinépolis'],
  [/(^|\.)ticketnew\.com$/, 'TicketNew'],
];

/** True when this destination must open inside the in-app browser, never via an OS app hop. */
export function keepsWebviewExit(destinationUrl: string): boolean {
  const host = hostOf(destinationUrl);
  if (!host) return false;
  return WEBVIEW_ONLY_HOSTS.some(([re]) => re.test(host));
}

export function appTargetFor(destinationUrl: string, partner?: string | null): AppTarget | null {
  const host = hostOf(destinationUrl);
  if (host) {
    for (const [re, target] of BY_HOST) if (re.test(host)) return target;
  }
  // Affiliate converters hide the merchant behind their own host (fktr.in, myntr.it, ...),
  // so fall back to the partner NAME the interstitial already displays.
  const key = norm(partner || '');
  if (key) {
    for (const [name, target] of BY_NAME) {
      if (name && (key.includes(name) || name.includes(key))) return target;
    }
  }
  return null;
}

/**
 * Android intent URL: opens `target.pkg` when installed, otherwise lands on `webUrl`
 * (our tracked/affiliate URL) — the OS itself performs the fallback, so no detection code.
 */
export function androidIntentUrl(target: AppTarget, webUrl: string): string {
  let rest = '';
  try {
    const u = new URL(webUrl);
    rest = `https://${u.host}${u.pathname}${u.search}`;
  } catch {
    rest = webUrl;
  }
  const payload = rest.replace(/^https:\/\//, '');
  return `intent://${payload}#Intent;scheme=https;package=${target.pkg};` +
    `S.browser_fallback_url=${encodeURIComponent(webUrl)};end`;
}

export function isAndroid(ua: string | undefined): boolean {
  return /android/i.test(String(ua || ''));
}

/** Our own Flutter app's webview: "Try1SecondApp/1.8" marker set in in_app_browser_screen. */
export function appBuildMarker(ua: string | undefined): string | null {
  const m = String(ua || '').match(/Try1SecondApp\/(\d+(?:\.\d+)?)/);
  return m ? m[1] : null;
}

/**
 * App builds that can hand `intent://` to the OS. Older builds block non-http navigations
 * inside the webview, so sending them an intent URL would break the exit — they keep the
 * instant plain redirect until an upgraded build is installed.
 */
export function appHandlesIntents(ua: string | undefined): boolean {
  const v = appBuildMarker(ua);
  if (!v) return false;
  return parseFloat(v) >= 1.9;
}
