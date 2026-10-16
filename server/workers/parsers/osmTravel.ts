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
