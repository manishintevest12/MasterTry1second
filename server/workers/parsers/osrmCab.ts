/**
 * Cab fare-estimate parser (cab vertical, India). OSRM (public routing service)
 * gives the REAL road distance and duration between two geocoded points (Photon).
 * The fare is a transparent computed ESTIMATE: distance x declared per-km rate
 * (source config, admin-editable). It is always labelled indicative_estimate —
 * never presented as a live operator quote.
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';
import { photonGeocode } from './osmTravel';

export async function buildCabEstimate(
  source: SourceConfig, from: string, to: string, date: string | undefined,
  fetchRoute: (lon1: number, lat1: number, lon2: number, lat2: number) => Promise<{ distanceM: number; durationS: number }>,
  ratePerKm: number, sourceUrl: string,
): Promise<RawSourceItem[]> {
  const [a, b] = await Promise.all([photonGeocode(from), photonGeocode(to)]);
  if (!a || !b) return [];
  const route = await fetchRoute(a.lon, a.lat, b.lon, b.lat);
  const km = Math.round(route.distanceM / 100) / 10;
  const mins = Math.round(route.durationS / 60);
  if (km > 800) return []; // cab rides beyond 800 km are mis-geocoded routes, not real rides
  const estimate = Math.round(km * ratePerKm);
  return [newRawItem(source, {
    title: `${from.trim()} → ${to.trim()} · ${km} km · about ${mins} min`,
    seller: 'Try1Second estimate',
    sellerUrl: sourceUrl,
    price: estimate,
    currency: 'INR',
    travel: { route: `${from.trim()} to ${to.trim()}`.toLowerCase(), ...(date ? { date } : {}), seatType: 'unknown' },
    location: { city: from.trim().slice(0, 60) },
    attributes: {
      vehicle_type: 'cab (indicative)',
      distance_km: String(km),
      duration_minutes: String(mins),
      rate_per_km_assumed: String(ratePerKm),
      fare_type: 'indicative_estimate',
      estimate_note: `Estimate = ${km} km x ₹${ratePerKm}/km (assumed rate, editable in admin). Real fare varies by operator, surge and time.`,
      from_lat: a.lat.toFixed(5), from_lon: a.lon.toFixed(5),
      to_lat: b.lat.toFixed(5), to_lon: b.lon.toFixed(5),
    },
    availability: 'unknown',
    evidence: {
      sourceUrl,
      sourceReference: `${from}->${to}`,
      extractedFields: ['distance_km', 'duration_minutes', 'estimated_fare'],
    },
  })];
}
