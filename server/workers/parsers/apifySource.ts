/**
 * Apify-actor transport (owner 10 Nov: "stayapi, apify actors jaise kaam kr rahe hai same principal lga kr
 * price lao aur uss pr evergreen cj deeplink kro").
 *
 * Why this exists: Booking.com serves a bot wall to every plain HTTP fetch we can make, including through a
 * proxy service. MEASURED 10 Nov from this egress:
 *   direct             -> 202, 8.8KB shell, 0 property cards
 *   ScraperAPI (IN)    -> 200, 8.8KB shell, 0 property cards (a proxy IP did not change the outcome)
 * A page that only paints inside a real browser cannot be read by cURL, so the honest way to get Booking.com
 * prices is to let a browser run somewhere else and hand us structured items. Apify actors do exactly that,
 * and StayAPI-class providers do the same behind their own API.
 *
 * Contract with the engine: this module NEVER invents a price. An item without a positive price is dropped
 * (No Price, No Card). The exit link is not built here either: rows carry the merchant URL and the affiliate
 * layer wraps it (booking.com already routes through the owner's evergreen CJ link).
 *
 * Configuration (all optional; nothing runs unless set):
 *   APIFY_TOKEN            Apify API token (free tier is enough to test)
 *   APIFY_BOOKING_ACTOR    actor id, e.g. "voyager/booking-scraper" (no default: we never guess an actor)
 *   APIFY_BOOKING_CURRENCY default INR
 */

export interface ApifyItemRow {
  name: string;
  price: number;
  url: string;
  imageUrl?: string;
  rating?: number;
  address?: string;
}

export function apifyConfig(): { token: string; bookingActor: string; currency: string } {
  return {
    token: (process.env.APIFY_TOKEN || '').trim(),
    bookingActor: (process.env.APIFY_BOOKING_ACTOR || '').trim(),
    currency: (process.env.APIFY_BOOKING_CURRENCY || 'INR').trim().toUpperCase(),
  };
}

export function apifyMeetsConfigured(): boolean {
  const c = apifyConfig();
  return Boolean(c.token && c.bookingActor);
}

/** Names the exact missing env vars so the admin dashboard can show why the source is idle. */
export function apifyMissingEnv(): string[] {
  const c = apifyConfig();
  const missing: string[] = [];
  if (!c.token) missing.push('APIFY_TOKEN');
  if (!c.bookingActor) missing.push('APIFY_BOOKING_ACTOR');
  return missing;
}

/** Actor input for a hotel search. Keys follow the common Apify hotel-scraper contract. */
export function bookingActorInput(query: { destination: string; checkin: string; checkout: string; adults?: number; rooms?: number; maxItems?: number }) {
  const c = apifyConfig();
  return {
    location: query.destination,
    query: query.destination,
    checkIn: query.checkin,
    checkOut: query.checkout,
    adults: query.adults || 2,
    rooms: query.rooms || 1,
    currency: c.currency,
    maxItems: query.maxItems || 40,
  };
}

/** Positive price or nothing. Accepts 1234, "1,234", "Rs 1,234.50", 1234.5. */
export function coercePrice(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : 0;
  if (typeof v !== 'string') return 0;
  const m = v.replace(/[, ]/g, '').match(/([0-9]+(?:\.[0-9]+)?)/);
  if (!m) return 0;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function firstString(...vals: unknown[]): string {
  for (const v of vals) if (typeof v === 'string' && v.trim()) return v.trim();
  return '';
}

/**
 * Maps raw actor items to priced rows. Deliberately shape-tolerant: actors differ in field names, so we read
 * the common variants and drop anything we cannot prove (no price, no http(s) URL).
 */
export function apifyBookingRows(items: unknown[]): ApifyItemRow[] {
  const out: ApifyItemRow[] = [];
  const seen = new Set<string>();
  for (const it of items || []) {
    if (!it || typeof it !== 'object') continue;
    const o = it as Record<string, any>;
    const name = firstString(o.name, o.hotelName, o.title, o.propertyName);
    const url = firstString(o.url, o.link, o.hotelUrl, o.bookingUrl, o.detailUrl);
    const price = coercePrice(
      o.price ?? o.pricePerNight ?? o.pricepernight ?? o.minPrice ?? o.totalPrice ?? o.priceFrom ?? o.lowestPrice,
    );
    if (!name || price <= 0) continue;
    if (!/^https?:\/\//i.test(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({
      name: name.slice(0, 160),
      price,
      url,
      imageUrl: firstString(o.image, o.imageUrl, o.photo, o.thumbnail) || undefined,
      rating: Number(o.rating ?? o.reviewScore ?? 0) || undefined,
      address: firstString(o.address, o.location) || undefined,
    });
  }
  return out;
}

/** Runs an actor synchronously and returns dataset items (run-sync-get-dataset-items endpoint). */
export async function runActorSync(actorId: string, input: unknown, timeoutMs = 120_000): Promise<unknown[]> {
  const { token } = apifyConfig();
  if (!token) throw new Error('APIFY_TOKEN missing');
  if (!actorId) throw new Error('actor id missing');
  const url = `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input ?? {}),
      signal: ctrl.signal,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Apify ${res.status}: ${text.slice(0, 200)}`);
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } finally {
    clearTimeout(timer);
  }
}
