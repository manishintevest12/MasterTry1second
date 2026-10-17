/**
 * OpenStreetMap parsers for the worldwide HOTELS vertical.
 * Photon (Komoot, open) geocodes a place name; Overpass returns real hotel/
 * guest_house/hostel/resort records (name, coords, stars, phone, website) under ODbL.
 * No prices exist in OSM — price stays unknown, never invented.
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

export interface GeoPoint { lat: number; lon: number; label: string }

export async function photonGeocode(name: string): Promise<GeoPoint | null> {
  const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(name)}&limit=5&lang=en`);
  if (!res.ok) return null;
  const json: any = await res.json();
  const features: any[] = json?.features || [];
  if (features.length === 0) return null;
  // India-first: ambiguous names (e.g. "Delhi") must not geocode to a foreign namesake.
  // Try1Second's launch market is India; prefer a feature whose OSM address country is IN,
  // then a point inside India's bounding box, then the first result as honest fallback.
  const inIndiaBbox = (f: any) => { const [lon, lat] = f.geometry.coordinates; return lat > 6 && lat < 37 && lon > 68 && lon < 98; };
  const f = features.find((x: any) => x?.properties?.countrycode === 'IN')
    || features.find(inIndiaBbox)
    || features[0];
  return { lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], label: name };
}

/** UI search endpoints arrive locality-decorated ("Chappan Dukan / MG Road, Indore",
 * "Terminal 3 Airport (110037)", "DLF Cyber City, Gurugram"). City-based registries
 * (Ola BPD, InDrive, BharatTaxi/Savaari route slugs, Uber city guides) need the clean
 * CITY: strip pincode parens and keep the LAST comma segment; no comma -> whole string. */
export function cityFromRouteText(place: string): string {
  const noPin = place.replace(/\(\s*\d{6}\s*\)/g, ' ');
  const parts = noPin.split(',').map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
  return (parts.length ? parts[parts.length - 1] : noPin.replace(/\s+/g, ' ').trim()) || place.trim();
}

/** Resolve the CITY for a UI endpoint. Comma-suffixed strings are easy, but the
 *  pincode-hotspot UI sends locality-only text ("Terminal 3 Airport (110037)") — for
 *  those, geocode the pincode and reverse-geocode its centroid to the city name
 *  (verified: 110037 -> Delhi, 122002 -> Gurgaon, 452001 -> Juni Indore Tahsil). */
export async function cityForPlace(place: string): Promise<string | null> {
  const clean = cityFromRouteText(place);
  const pin = place.match(/\((\d{6})\)/)?.[1];
  if (!pin) return clean || null;

  // Primary: India Post's public pincode registry (no auth) — District-level city
  // (verified: 122002 -> Gurgaon, 452001 -> Indore). Some area pincodes (e.g. the
  // 452022 airport zone) carry no postal records — fall through below.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
      if (res.ok) {
        const j: any = await res.json();
        const po = j?.[0]?.PostOffice?.[0];
        const district = po?.District || po?.Block || null;
        if (district) return /delhi/i.test(district) ? 'New Delhi' : String(district);
      }
      await new Promise((r) => setTimeout(r, 400));
    } catch { await new Promise((r) => setTimeout(r, 400)); }
  }

  // Fallback: Nominatim postal-code search (India-only). display_name shape is
  // "PIN, <locality>..., <district>, <state>, India" — the district is the last
  // token before the state, and district-level naming matches the India Post path
  // (verified: 110001 -> New Delhi, 122002 -> Gurugram, 201309 -> Gautam Buddha Nagar).
  // Bare-pincode geocoding is deliberately NOT used: photon resolves unknown pincodes
  // to foreign namesakes (452022 -> a Russian village, verified live).
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?postalcode=${pin}&countrycodes=in&format=jsonv2&limit=1`,
      { headers: { 'User-Agent': 'Try1Second/1.0' } },
    );
    if (res.ok) {
      const rows: any[] = (await res.json()) || [];
      if (rows.length) {
        const parts = String(rows[0].display_name || '').split(',').map((x: string) => x.trim()).filter(Boolean);
        // parts: [PIN, ...localities, district, state, 'India']
        const district = parts.length >= 4 ? parts[parts.length - 3] : parts[1];
        if (district && !/^\d+$/.test(district)) return /delhi/i.test(district) ? 'New Delhi' : district;
      }
    }
  } catch { /* fall through to the comma-suffix guess */ }
  return clean || null;
}

/** Geocode a UI endpoint: full string first (most precise), clean-city fallback. */
export async function geocodePlace(name: string): Promise<GeoPoint | null> {
  const a = await photonGeocode(name);
  if (a) return a;
  const city = cityFromRouteText(name);
  return city !== name ? photonGeocode(city) : null;
}

export interface OverpassElement {
  type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number };
  tags: Record<string, string>;
}

export function parseOverpassHotels(json: any, source: SourceConfig, city: string, bbox: string, queryUrl: string): RawSourceItem[] {
  const els: OverpassElement[] = Array.isArray(json?.elements) ? json.elements : [];
  const out: RawSourceItem[] = [];
  for (const e of els) {
    const name = e.tags?.name;
    if (!name) continue;
    const coords = e.type === 'node' ? { lat: e.lat!, lon: e.lon! } : e.center;
    const kind = e.tags.tourism || 'hotel';
    const stars = e.tags.stars ? String(parseInt(e.tags.stars, 10) || '') : '';
    out.push(newRawItem(source, {
      title: name.slice(0, 200),
      seller: 'OpenStreetMap (ODbL)',
      sellerUrl: e.tags.website || e.tags['contact:website'] || `https://www.openstreetmap.org/${e.type}/${e.id}`,
      currency: 'INR',
      location: { city },
      attributes: {
        property_type: kind,
        ...(stars ? { stars } : {}),
        ...(e.tags.phone || e.tags['contact:phone'] ? { phone: (e.tags.phone || e.tags['contact:phone']).slice(0, 40) } : {}),
        ...(e.tags['addr:street'] ? { address: e.tags['addr:street'].slice(0, 120) } : {}),
        ...(coords ? { lat: coords.lat.toFixed(5), lon: coords.lon.toFixed(5) } : {}),
        osm_license: 'Data (c) OpenStreetMap contributors, ODbL',
      },
      evidence: {
        sourceUrl: queryUrl,
        sourceReference: `osm:${e.type}/${e.id}`,
        extractedFields: ['title', 'location', ...(stars ? ['stars'] : []), ...(e.tags.phone ? ['phone'] : [])],
      },
    }));
  }
  return out.slice(0, 60);
}

export function overpassHotelQuery(bbox: string): string {
  return `[out:json][timeout:20];nwr[tourism~"^(hotel|guest_house|hostel|resort|motel)$"](${bbox});out 80 tags center;`;
}
