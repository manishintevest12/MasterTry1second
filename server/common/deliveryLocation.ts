/**
 * WHERE a hyper-local search must be priced from.
 *
 * OWNER 25 Nov: "app mai maan lo maine briyani check kiya tho biryani search mai aata hai pr jb mai redirect kr ke
 * swiggy pr jata hoon tho wo mere area mai delivery ni krta hai, tho location wise result diya kr jiss se delivery
 * ho paye — same issue food delivery vertical mai face kr raha hoon, wahi issue 10-min grocery mai v."
 *
 * MEASURED cause: Swiggy, Instamart and Blinkit are delivery-zone products. They price a menu against ONE point,
 * and every dish/price they return is only real inside the polygon that serves that point. The food worker threw
 * away the shopper's GPS fix and asked Swiggy for the CITY CENTRE's coordinates; when the city was not in its own
 * table it silently asked for New Delhi's. The grocery worker did the same, falling back to Mumbai. So a shopper in
 * an Indore locality was shown a menu priced for Indore's centre (or Delhi/Mumbai), tapped through, and Swiggy
 * answered "not delivering to your area".
 *
 * The rule this file enforces:
 *   1. the shopper's own coordinates, when the client sent them (the app's "Using your location"),
 *   2. otherwise the coordinates of the city they actually typed,
 *   3. otherwise NOTHING — never another city's point. A missing answer is honest; a Mumbai menu for an Ujjain
 *      shopper is not.
 */

export interface DeliveryPoint {
  lat: number;
  lng: number;
  /** What to call this point in user-facing text: the locality when known, else the city, else "your location". */
  label: string;
  /** True when this is the shopper's own GPS fix rather than a city-centre stand-in. */
  exact: boolean;
}

type CityTable = Record<string, [number, number]>;

function finiteCoord(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * The single point a delivery-zone source may be queried at, or null when we cannot honestly place the shopper.
 * Pure and table-driven so both workers (and their tests) share one rule.
 */
export function resolveDeliveryPoint(
  location: { lat?: number; lng?: number; city?: string; pincode?: string; locality?: string } | undefined,
  cityTable: CityTable,
): DeliveryPoint | null {
  const loc = location || {};
  const lat = finiteCoord(loc.lat);
  const lng = finiteCoord(loc.lng);
  // 0/0 is the "no fix" placeholder some clients send; it is in the Gulf of Guinea, not a delivery address.
  if (lat !== null && lng !== null && !(Math.abs(lat) < 0.01 && Math.abs(lng) < 0.01)) {
    const label = String(loc.locality || loc.city || '').trim() || 'your location';
    return { lat, lng, label, exact: true };
  }

  const city = String(loc.city || '').trim().toLowerCase();
  const hit = city ? cityTable[city] : undefined;
  if (hit) return { lat: hit[0], lng: hit[1], label: String(loc.city || city), exact: false };

  // An alias city can still be recognised through the table's own spelling (Bengaluru = Bangalore,
  // Gurugram = Gurgaon) without inventing a point.
  for (const [name, coords] of Object.entries(cityTable)) {
    if (!city) break;
    if (city.includes(name) || name.includes(city)) {
      return { lat: coords[0], lng: coords[1], label: String(loc.city || name), exact: false };
    }
  }
  return null;
}
