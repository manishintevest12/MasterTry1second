/**
 * MakeMyTrip autosuggest parser — LIVE browserless (17 Oct 2026).
 *
 * GET https://mapi.makemytrip.com/autosuggest/v5/search?t=city&q=<text>
 * GET https://mapi.makemytrip.com/autosuggest/v5/search?t=hotel&q=<text>
 *
 * The mapi Kong gateway serves this route OPEN (no auth, no cookie handshake,
 * verified from datacenter IPs). t=hotel returns REAL property entries with
 * MMT hotel ids, star ratings and geo; t=city returns destination entries
 * (cityCode CTGOI etc.). This is a NAME/ID registry only — NO prices — so it
 * feeds the hotels location typeahead (metadata), never price offers.
 *
 * Verified: 'Taj Mahal Palace Mumbai' -> The Taj Mahal Palace, Mumbai (id
 * 20170907..., srating 5); 'goa' -> Goa, India (CTGOI).
 */

export interface MmtSuggestion {
  name: string;
  type: 'HOTEL' | 'CITY';
  cityName: string;
  stateName?: string;
  countryName?: string;
  hotelId?: string;
  cityCode?: string;
  starRating?: number;
  lat?: number;
  lng?: number;
}

export function parseMmtAutosuggest(body: string, kind: 'city' | 'hotel'): MmtSuggestion[] {
  let data: any;
  try {
    data = JSON.parse(body);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const out: MmtSuggestion[] = [];
  for (const d of data) {
    if (!d || typeof d !== 'object') continue;
    const cc = String(d.countryCode || '').toUpperCase();
    if (cc && cc !== 'IN') continue; // India stays only (owner policy)
    const name = String(d.displayName || '').split(',')[0].trim() || String(d.displayName || '').trim();
    const rawName = String(d.displayName || '').trim();
    if (!rawName) continue;
    const city = String(d.cityName || '').trim();
    if (kind === 'city' && String(d.type || '') !== 'city') continue;
    const id = String(d.id || '').trim();
    const star = Number(d.srating) || undefined;
    const centre = d?.centre || d?.location || {};
    out.push({
      name: kind === 'hotel' ? rawName : name,
      type: kind === 'hotel' ? 'HOTEL' : 'CITY',
      cityName: city,
      stateName: String(d.stateName || '').trim() || undefined,
      countryName: String(d.countryName || '').trim() || undefined,
      hotelId: kind === 'hotel' ? id || undefined : undefined,
      cityCode: String(d.cityCode || '').trim() || undefined,
      starRating: star && star > 0 ? star : undefined,
      lat: Number(centre.lat) || undefined,
      lng: Number(centre.lng) || undefined,
    });
  }
  return out;
}
