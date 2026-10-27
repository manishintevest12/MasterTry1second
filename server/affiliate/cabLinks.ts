/**
 * Cab app-level deep links (owner 27 Oct: "jo app pr available hai jaise uber, ola,
 * rapido unko app level mai deeplink kro").
 *
 * Native app schemes open the installed app with pickup/drop prefilled; when the app
 * is not installed the same link falls back to the merchant's web booking page, and
 * BOTH paths stay inside our server-side tracking (/api/app-open -> click recorded).
 *
 * Coordinates are REQUIRED (owner rule: cab pricing/direction needs explicit coords,
 * never server-side guessing). Without coords we return no scheme instead of a
 * half-filled app launch.
 */

export interface CabPoint {
  lat: number;
  lng: number;
  name?: string;
}

export interface CabRoute {
  pickup?: CabPoint | null;
  drop?: CabPoint | null;
}

export interface CabLinks {
  /** native scheme (opens the installed app), '' when it cannot be built honestly */
  scheme: string;
  /** web fallback (always set) */
  web: string;
}

const num = (n: unknown): number | null => {
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
};

const ok = (p?: CabPoint | null): p is CabPoint => !!p && num(p.lat) !== null && num(p.lng) !== null;

const enc = encodeURIComponent;

/** Uber universal/app link: uber://?action=setPickup&pickup=...&dropoff[latitude]=... */
function uberScheme(r: CabRoute): string {
  const p = r.pickup;
  const d = r.drop;
  if (!ok(d)) return '';
  const parts = ['action=setPickup'];
  if (ok(p)) {
    parts.push(`pickup[latitude]=${p.lat}`, `pickup[longitude]=${p.lng}`);
    if (p.name) parts.push(`pickup[nickname]=${enc(p.name)}`);
  } else {
    parts.push('pickup=my_location');
  }
  parts.push(`dropoff[latitude]=${d.lat}`, `dropoff[longitude]=${d.lng}`);
  if (d.name) parts.push(`dropoff[nickname]=${enc(d.name)}`);
  return `uber://?${parts.join('&')}`;
}

/** Ola app link: olacabs://app/launch?lat=..&lng=..&drop_lat=..&drop_lng=.. */
function olaScheme(r: CabRoute): string {
  if (!ok(r.pickup) || !ok(r.drop)) return '';
  return `olacabs://app/launch?lat=${r.pickup.lat}&lng=${r.pickup.lng}&drop_lat=${r.drop.lat}&drop_lng=${r.drop.lng}`;
}

/** Rapido app link: rapido://ride?... (needs both ends) */
function rapidoScheme(r: CabRoute): string {
  if (!ok(r.pickup) || !ok(r.drop)) return '';
  return `rapido://ride?pickup_lat=${r.pickup.lat}&pickup_lng=${r.pickup.lng}&drop_lat=${r.drop.lat}&drop_lng=${r.drop.lng}`;
}

/** inDrive app link */
function indriveScheme(r: CabRoute): string {
  if (!ok(r.drop)) return '';
  const p = ok(r.pickup) ? r.pickup : null;
  const q = new URLSearchParams({
    dropLat: String(r.drop.lat), dropLng: String(r.drop.lng),
    ...(p ? { pickupLat: String(p.lat), pickupLng: String(p.lng) } : {}),
  });
  return `indrive://route?${q.toString()}`;
}

export const CAB_APP_SCHEMES = ['uber', 'olacabs', 'rapido', 'indrive', 'meru'] as const;

/** True when this destination is one of the whitelisted cab app schemes. */
export function isCabAppScheme(url: string): boolean {
  const m = String(url || '').match(/^([a-z]+):\/\//i);
  if (!m) return false;
  return (CAB_APP_SCHEMES as readonly string[]).includes(m[1].toLowerCase());
}

/**
 * Build the app scheme + web fallback for a cab merchant.
 * Web fallbacks mirror the URLs already used by the cab worker (route-prefilled).
 */
export function cabLinks(merchant: string, route: CabRoute = {}, webFallback = ''): CabLinks {
  const v = String(merchant || '').toLowerCase();
  const p = ok(route.pickup) ? route.pickup : null;
  const d = ok(route.drop) ? route.drop : null;
  const lat = p?.lat; const lng = p?.lng;
  const dlat = d?.lat; const dlng = d?.lng;

  if (v.includes('uber')) {
    return {
      scheme: uberScheme({ pickup: p, drop: d }),
      web: webFallback || 'https://m.uber.com/looking',
    };
  }
  if (v.includes('ola')) {
    return {
      scheme: olaScheme({ pickup: p, drop: d }),
      web: webFallback || `https://book.olacabs.com/${lat !== undefined ? `?lat=${lat}&lng=${lng}&drop_lat=${dlat}&drop_lng=${dlng}` : ''}`,
    };
  }
  if (v.includes('rapido')) {
    return {
      scheme: rapidoScheme({ pickup: p, drop: d }),
      web: webFallback || `https://m.rapido.bike/${lat !== undefined && dlat !== undefined ? `?pickup_lat=${lat}&pickup_lng=${lng}&drop_lat=${dlat}&drop_lng=${dlng}` : ''}`,
    };
  }
  if (v.includes('indrive') || v.includes('in drive')) {
    return { scheme: indriveScheme({ pickup: p, drop: d }), web: webFallback || 'https://indrive.com/' };
  }
  if (v.includes('meru')) return { scheme: d ? 'meru://' : '', web: webFallback || 'https://www.meru.in/' };
  if (v.includes('fastdeal') || v.includes('snap')) return { scheme: '', web: webFallback || 'https://www.fastdeals.in/' };
  return { scheme: '', web: webFallback };
}

/** Our tracked app-open bridge URL (scheme tried first, web fallback always offered). */
export function cabAppOpenUrl(links: CabLinks, offerId?: string): string {
  if (!links.scheme) return '';
  const q = new URLSearchParams({ s: links.scheme, w: links.web });
  if (offerId) q.set('o', String(offerId));
  return `/api/app-open?${q.toString()}`;
}
