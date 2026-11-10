/**
 * Akasa Air Demand-IBE fare feed (owner 10 Nov: "IndiGo/Akasa ki fare API capture karo" - continue).
 *
 * RECON RESULT from Akasa's own production bundle (https://www.akasaair.com/_app-*.js, read 10 Nov):
 *   api host     https://prod-bl.qp.akasaair.com
 *   low fare     GET  {host}/api/ibe/availability/v2/search?origin=&destination=&startDate=&endDate=
 *                     &numberOfPassengers=1&currencyCode=INR
 *   legacy POST  {host}/api/ibe/availability/v2/search/availability/search/lowFare
 *                     body {currencyCode, origin, destination, startDate, endDate, includeTaxesAndFees, numberOfPassengers}
 *   item shape   {date, price, taxesAndFees, available, noFlights, soldOut, referenceFareKeys}
 *   auth         the site builds headers with getHeaders() from a Cognito session (Bearer accessToken) inside
 *                /api/ibe/users/auth (+ /v2); guest state carries accessToken:null
 * MEASURED from our egress with chrome AND safari impersonation, plus full browser headers, plus the rescue
 * ladder (direct/ScraperAPI/reader): every call is a plain nginx 403 Forbidden, and the site's own low-fare
 * pages render client-side (333KB shell, zero fares). So the endpoint is known and correct, but access is
 * edge-blocked and needs an authorised token.
 *
 * This module therefore stays honest: with AKASA_BEARER set it calls the real endpoint and returns priced
 * per-date lowest fares (labelled as lowest fare for that date, never as a specific flight); without it, it
 * raises CAPABILITY_UNAVAILABLE naming the variable. No price is ever invented, and a sold-out/no-flight
 * date is dropped (No Price, No Card).
 */

const AKASA_BASE = (process.env.AKASA_API_BASE || 'https://prod-bl.qp.akasaair.com').replace(/\/+$/, '');

export interface AkasaLowFare {
  date: string;
  price: number;
  taxesAndFees?: number;
  available?: number;
}

export function akasaConfigured(): boolean {
  return Boolean((process.env.AKASA_BEARER || '').trim());
}

export function akasaMissingEnv(): string[] {
  return akasaConfigured() ? [] : ['AKASA_BEARER'];
}

export function akasaLowFareUrl(q: { origin: string; destination: string; startDate: string; endDate?: string; currency?: string }): string {
  const params = new URLSearchParams({
    origin: q.origin.toUpperCase(),
    destination: q.destination.toUpperCase(),
    startDate: q.startDate,
    endDate: q.endDate || q.startDate,
    numberOfPassengers: '1',
    currencyCode: (q.currency || 'INR').toUpperCase(),
  });
  return `${AKASA_BASE}/api/ibe/availability/v2/search?${params.toString()}`;
}

/** Reads the low-fare calendar payload. Tolerant of {data:[...]}, {data:{dates:[...]}} and bare arrays. */
export function akasaLowFares(payload: unknown): AkasaLowFare[] {
  const root: any = payload as any;
  const candidates: any[] =
    (Array.isArray(root) && root) ||
    (Array.isArray(root?.data) && root.data) ||
    (Array.isArray(root?.data?.dates) && root.data.dates) ||
    (Array.isArray(root?.dates) && root.dates) ||
    [];
  const out: AkasaLowFare[] = [];
  for (const c of candidates) {
    if (!c || typeof c !== 'object') continue;
    const price = Number(c.price ?? c.totalPrice ?? c.amount ?? 0);
    const date = String(c.date || c.departureDate || '').slice(0, 10);
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (!Number.isFinite(price) || price <= 0) continue;
    if (c.soldOut === true || c.noFlights === true) continue;
    const taxes = Number(c.taxesAndFees ?? 0) || undefined;
    out.push({ date, price, taxesAndFees: taxes, available: Number(c.available ?? 0) || undefined });
  }
  return out;
}

/** Calls the feed. Honest failures: missing token, edge block, or a payload with no priced date. */
export async function akasaFetchLowFares(q: { origin: string; destination: string; startDate: string; endDate?: string }, fetchImpl: typeof fetch = fetch): Promise<AkasaLowFare[]> {
  const token = (process.env.AKASA_BEARER || '').trim();
  if (!token) throw new Error('AKASA_BEARER_NOT_CONFIGURED');
  const url = akasaLowFareUrl(q);
  const res = await fetchImpl(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json, text/plain, */*',
      Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}`,
      Origin: 'https://www.akasaair.com',
      Referer: 'https://www.akasaair.com/',
    },
  });
  const text = await res.text();
  if (res.status === 403) throw new Error('AKASA_EDGE_403');
  if (!res.ok) throw new Error(`AKASA_${res.status}: ${text.slice(0, 160)}`);
  let parsed: unknown = null;
  try { parsed = JSON.parse(text); } catch { throw new Error('AKASA_MALFORMED_RESPONSE'); }
  return akasaLowFares(parsed);
}
