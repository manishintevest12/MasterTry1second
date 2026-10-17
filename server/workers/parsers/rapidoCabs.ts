/**
 * Rapido (owner request 17 Oct 2026 — "add Rapido without API").
 * Rapido publishes NO fares on the web: route pages (/delhi/routes/A-B) and city
 * main-pages are SEO content with FAQs only, and the web bundle references only
 * internal .svc.production.internal service hosts. Fares are calculated in-app.
 *
 * What Rapido DOES publish (all verified live):
 *  - a served-city registry: /sitemaps/cities/sitemap.xml (96 Indian city main-pages)
 *  - per-city SSR route pages: /{city}/routes/{A_B} — page existence proves Rapido
 *    operates on that exact city route (thousands listed in per-city sitemaps)
 *  - three service categories on every city page: Bike Taxi, Auto, Cab
 *
 * So we emit honest AVAILABILITY rows with the fare left unpriced and labelled
 * "available only on app" (owner's app-only platform policy). No number is invented.
 */
import { newRawItem } from '../../sources/contract';
import type { RawSourceItem, SourceConfig } from '../../types';

const CITIES_SITEMAP = 'https://www.rapido.bike/sitemaps/cities/sitemap.xml';

/** Route-page city slug uses lowercase legacy spellings (bangalore, not bengaluru). */
const CITY_SLUG_ALIASES: Record<string, string> = {
  bengaluru: 'bangalore', mysuru: 'mysore', 'new delhi': 'delhi', gurugram: 'gurgaon',
  'gautam buddha nagar': 'noida', vizag: 'vishakapatnam', trivandrum: 'thiruvananthapuram',
};

export function rapidoCitySlug(city: string): string {
  const l = city.trim().toLowerCase();
  return CITY_SLUG_ALIASES[l] || l.replace(/\s+/g, '');
}

export interface RapidoCity { name: string; mainPagePath: string }

let citiesCache: { at: number; cities: RapidoCity[] } | null = null;

/** Cities Rapido operates in, from Rapido's own cities sitemap (12h cache). */
export async function rapidoServedCities(fetchText: (url: string) => Promise<string>): Promise<RapidoCity[]> {
  if (citiesCache && Date.now() - citiesCache.at < 12 * 3600_000) return citiesCache.cities;
  const xml = await fetchText(CITIES_SITEMAP);
  const cities: RapidoCity[] = [];
  for (const m of xml.matchAll(/<loc>https:\/\/www\.rapido\.bike\/([^/]+)\/main-page<\/loc>/g)) {
    const path = m[1];
    if (!path || path.includes('.')) continue; // skip stray entries
    cities.push({ name: decodeURIComponent(path).replace(/[_%20]/g, ' ').trim(), mainPagePath: path });
  }
  if (!cities.length) throw new Error(`Rapido cities sitemap carried no city pages (len=${xml.length})`);
  citiesCache = { at: Date.now(), cities };
  return cities;
}

/** Canonical spellings so "Gurgaon" (photon) matches "Gurugram" and vice versa. */
const CITY_NAME_ALIASES: Record<string, string> = {
  gurgaon: 'gurugram', bangalore: 'bengaluru', mysore: 'mysuru',
  'new delhi': 'delhi', trivandrum: 'thiruvananthapuram', vishakapatnam: 'visakhapatnam',
  bombay: 'mumbai', madras: 'chennai', calcutta: 'kolkata',
  // India Post districts that are not city names: NCR districts fold into their city
  'gautam buddha nagar': 'noida', 'central delhi': 'delhi', 'south west delhi': 'delhi',
  'north west delhi': 'delhi', 'north east delhi': 'delhi', 'east delhi': 'delhi',
  'west delhi': 'delhi', 'south delhi': 'delhi', 'north delhi': 'delhi', shahdara: 'delhi',
};

export function canonCity(name: string): string {
  const t = name.trim().toLowerCase();
  return CITY_NAME_ALIASES[t] || t;
}

export function rapidoCityLookup(cities: RapidoCity[], city: string): RapidoCity | null {
  const t = canonCity(city);
  return cities.find((c) => canonCity(c.name) === t) || null;
}

export interface RapidoAvailabilityInput {
  source: SourceConfig;
  from: string; // raw UI endpoint text ("Terminal 3 Airport (110037)")
  to: string;
  city: string; // served-city display name ("New Delhi")
  mainPageUrl: string; // https://www.rapido.bike/<City>/main-page — Rapido's own served-city page
}

const SERVICES: { vehicle: string; blurb: string }[] = [
  { vehicle: 'Bike Taxi', blurb: 'bike rides' },
  { vehicle: 'Auto', blurb: 'auto rides for city travel' },
  { vehicle: 'Cab', blurb: 'sedan cabs' },
];

/** Three availability rows (Bike Taxi / Auto / Cab), fare honestly unpriced (app-only). */
export function buildRapidoAvailability(inp: RapidoAvailabilityInput): RawSourceItem[] {
  const route = `${inp.from} → ${inp.to}`;
  return SERVICES.map((svc, i) => newRawItem(inp.source, {
    title: `${inp.from} to ${inp.to} Rapido ${svc.vehicle} (city ride, one-way)`,
    currency: 'INR',
    seller: 'Rapido',
    sellerUrl: inp.mainPageUrl,
    availability: 'unknown',
    travel: { route },
    location: { city: inp.city },
    identifiers: { sku: `rapido-${rapidoCitySlug(inp.city)}-${svc.vehicle.toLowerCase().replace(/\s+/g, '-')}` },
    attributes: {
      pickup: inp.from,
      drop: inp.to,
      vehicle_type: svc.vehicle,
      service_blurb: svc.blurb,
      price_basis: 'app_only_fares',
      app_only: 'true',
      data_note: `Rapido operates in ${inp.city}: ${svc.blurb}. ` +
        'Rapido calculates fares in-app — no web pricing exists, so this row is priced "available only on app" rather than estimated. ' +
        (i === 0 ? `Availability verified from Rapido's own served-city registry (rapido.bike ${inp.city} city page).` : ''),
    },
    evidence: {
      extractedFields: ['title', 'seller', 'currency'],
      sourceUrl: inp.mainPageUrl,
      sourceReference: 'rapido.bike served-city page availability (app-only fares)',
    },
  }));
}
