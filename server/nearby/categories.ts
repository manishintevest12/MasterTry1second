/**
 * NEARBY CATEGORY REGISTRY (owner 17 Nov).
 *
 * The Nearby tab only knew eight buckets (restaurants, cafes, hotels, stays, cabs, cinemas, stores, all). The owner
 * listed the everyday errands that actually happen on a vehicle in an Indian city: petrol, CNG, LPG, car repair,
 * two-wheeler repair, puncture, battery, tyres, denting/painting, accessories, car wash, detailing, PUCC, insurance,
 * RTO, bike and car rentals, scrapping.
 *
 * Every one of them is answered from OpenStreetMap tags (free, no key, real names and coordinates), so this file is
 * the single place that says what each category MEANS: the tags to ask Overpass for, the words that identify it in a
 * second-hand data source (Photon/Nominatim text search), and the label shown on the chip. The server, the website
 * and the app all read the same list, so a new vertical can never appear on one surface and be missing on another.
 */

export interface NearbyCategoryDef {
  id: string;
  /** Chip text on the web and in the app. */
  label: string;
  /** Overpass tag filters (OSM). The first one is the primary; extras widen the net. */
  filters: string[];
  /** Lower-case words that prove a place belongs here when the source only gives a name (Photon/Nominatim). */
  terms: string[];
  /** Text used for name-based lookups on sources that have no tag dimension. */
  search: string;
  /** Extra radius (metres) for sparse categories so a city still returns real rows. */
  radiusM?: number;
}

export const NEARBY_CATEGORIES: NearbyCategoryDef[] = [
  {
    id: 'petrol',
    label: 'Petrol Pumps',
    filters: ['node["amenity"="fuel"]', 'way["amenity"="fuel"]'],
    terms: ['petrol', 'fuel', 'filling station', 'hp', 'indian oil', 'iocl', 'bharat petroleum', 'bpcl', 'shell', 'nayara', 'jio-bp', 'essar'],
    search: 'petrol pump',
    radiusM: 6000,
  },
  {
    id: 'cng',
    label: 'CNG Stations',
    filters: ['node["amenity"="fuel"]["fuel:cng"="yes"]', 'node["amenity"="fuel"]["name"~"CNG",i]', 'way["amenity"="fuel"]["fuel:cng"="yes"]'],
    terms: ['cng', 'compressed natural gas'],
    search: 'CNG',
    radiusM: 12000,
  },
  {
    id: 'lpg',
    label: 'LPG & Gas',
    filters: ['node["shop"="gas"]', 'node["amenity"="fuel"]["fuel:lpg"="yes"]', 'way["shop"="gas"]'],
    terms: ['lpg', 'gas agency', 'indane', 'hp gas', 'bharat gas', 'gas cylinder', 'gobar gas'],
    search: 'gas agency',
    radiusM: 10000,
  },
  {
    id: 'car_repair',
    label: 'Car Repair',
    filters: ['node["shop"="car_repair"]', 'way["shop"="car_repair"]', 'node["shop"="car_service"]'],
    terms: ['car repair', 'car service', 'garage', 'auto works', 'motors', 'workshop', 'service centre', 'service center'],
    search: 'car repair',
    radiusM: 6000,
  },
  {
    id: 'bike_repair',
    label: 'Bike Repair',
    filters: ['node["shop"="motorcycle_repair"]', 'node["shop"="motorcycle"]', 'way["shop"="motorcycle_repair"]'],
    terms: ['bike repair', 'bike service', 'two wheeler', 'scooter repair', 'motorcycle', 'mechanic'],
    search: 'two wheeler',
    radiusM: 6000,
  },
  {
    id: 'puncture',
    label: 'Puncture',
    filters: ['node["shop"="tyres"]["service:tyres"="yes"]', 'node["shop"="tyres"]["name"~"puncture|tyre|tire",i]', 'node["amenity"="fuel"]["name"~"puncture",i]'],
    terms: ['puncture', 'tyre repair', 'tire repair', 'tyre shop', 'tire shop'],
    search: 'puncture',
    radiusM: 6000,
  },
  {
    id: 'battery',
    label: 'Battery Shops',
    filters: ['node["shop"="car_parts"]["name"~"battery",i]', 'node["shop"="motorcycle"]["name"~"battery",i]', 'node["shop"="battery"]'],
    terms: ['battery', 'exide', 'amaron', 'battery shop', 'inverter battery'],
    search: 'battery',
    radiusM: 6000,
  },
  {
    id: 'tyres',
    label: 'Tyre Shops',
    filters: ['node["shop"="tyres"]', 'way["shop"="tyres"]'],
    terms: ['tyre', 'tire', 'mrf', 'apollo tyres', 'ceat', 'j-k tyre', 'jk tyre', 'tyre house'],
    search: 'tyre',
    radiusM: 6000,
  },
  {
    id: 'denting',
    label: 'Denting & Painting',
    filters: ['node["shop"="car_repair"]["name"~"denting|painting|paint|body shop",i]', 'node["shop"="car_repair"]["service:car_repair"="paint"]'],
    terms: ['denting', 'painting', 'paint shop', 'body shop', 'dent'],
    search: 'denting',
    radiusM: 8000,
  },
  {
    id: 'accessories',
    label: 'Accessories',
    filters: ['node["shop"="car_parts"]', 'way["shop"="car_parts"]', 'node["shop"="car_accessories"]', 'node["shop"="motorcycle"]["name"~"accessor|helmet|spare",i]'],
    terms: ['accessories', 'accessory', 'spare parts', 'car parts', 'helmet', 'seat cover'],
    search: 'accessories',
    radiusM: 6000,
  },
  {
    id: 'car_wash',
    label: 'Car Wash',
    filters: ['node["amenity"="car_wash"]', 'way["amenity"="car_wash"]', 'node["shop"="car_wash"]'],
    terms: ['car wash', 'carwash', 'bike wash', 'foam wash', 'water wash'],
    search: 'car wash',
    radiusM: 8000,
  },
  {
    id: 'detailing',
    label: 'Detailing',
    filters: ['node["shop"="car_repair"]["name"~"detailing|detail|ceramic|coating|ppf|polish",i]', 'node["shop"="car_wash"]["name"~"detailing|ceramic|coating",i]'],
    terms: ['detailing', 'detailing studio', 'ceramic coating', 'ppf', 'paint protection', 'polishing'],
    search: 'detailing',
    radiusM: 10000,
  },
  {
    id: 'pucc',
    label: 'PUCC Centres',
    filters: ['node["amenity"="fuel"]["name"~"PUC|PUCC|pollution",i]', 'node["shop"="car_repair"]["name"~"PUC|PUCC|pollution",i]', 'node["office"="government"]["name"~"pollution",i]'],
    terms: ['puc', 'pucc', 'pollution certificate', 'pollution check', 'emission test'],
    search: 'pollution',
    radiusM: 10000,
  },
  {
    id: 'insurance',
    label: 'Insurance Offices',
    filters: ['node["office"="insurance"]', 'way["office"="insurance"]', 'node["shop"="insurance"]'],
    terms: ['insurance', 'lic', 'policy bazaar', 'insurance office', 'general insurance'],
    search: 'insurance',
    radiusM: 8000,
  },
  {
    id: 'rto',
    label: 'RTO Office',
    filters: ['node["office"="government"]["name"~"RTO|transport",i]', 'node["amenity"="driving_school"]["name"~"RTO",i]', 'way["office"="government"]["name"~"RTO|transport",i]'],
    terms: ['rto', 'regional transport office', 'transport office', 'parivahan'],
    search: 'RTO',
    radiusM: 20000,
  },
  {
    id: 'bike_rental',
    label: 'Bike & Scooty Rentals',
    filters: ['node["amenity"="motorcycle_rental"]', 'node["amenity"="bicycle_rental"]["name"~"bike|scooter|scooty|two wheeler",i]', 'node["shop"="rental"]["name"~"bike|scooter|scooty",i]'],
    terms: ['bike rental', 'scooter rental', 'scooty rental', 'two wheeler rental', 'bike on rent', 'royal brothers', 'bounce', 'vogo', 'onn bikes'],
    search: 'bike rental',
    radiusM: 12000,
  },
  {
    id: 'car_rental',
    label: 'Car Rentals',
    filters: ['node["amenity"="car_rental"]', 'way["amenity"="car_rental"]', 'node["amenity"="car_sharing"]'],
    terms: ['car rental', 'car hire', 'self drive', 'taxi service', 'zoomcar', 'revv', 'car on rent'],
    search: 'car rental',
    radiusM: 12000,
  },
  {
    id: 'scrapping',
    label: 'Vehicle Scrapping',
    filters: ['node["shop"="car_repair"]["name"~"scrap|scrapping|scrap yard|kabadi",i]', 'node["amenity"="recycling"]["name"~"vehicle|car|scrap|kabadi",i]', 'node["shop"="car_parts"]["name"~"scrap|scrap yard",i]'],
    terms: ['scrap', 'scrapping', 'vehicle scrapping', 'scrap yard', 'kabadi', 'car market', 'rvsf'],
    search: 'scrap',
    radiusM: 20000,
  },
];

const BY_ID = new Map(NEARBY_CATEGORIES.map((c) => [c.id, c]));

/** The definition for a category id, or null when the id is one of the original eight. */
export function categoryDef(id: string): NearbyCategoryDef | null {
  return BY_ID.get(String(id || '')) || null;
}

/** Chip labels, in the order the owner listed them. */
export function categoryLabel(id: string): string {
  return BY_ID.get(String(id || ''))?.label || String(id || '');
}

/** Overpass filters for a category (empty for the original eight, which the aggregator maps itself). */
export function categoryFilters(id: string): string[] {
  return BY_ID.get(String(id || ''))?.filters || [];
}

/** Words used when a source can only be asked by name. */
export function categoryTerms(id: string): string[] {
  const def = BY_ID.get(String(id || ''));
  return def ? [def.search, ...def.terms] : [];
}

/** Does a place name prove this category? Used for name-only sources and for filtering mixed results. */
export function nameMatchesCategory(name: string, id: string): boolean {
  const def = BY_ID.get(String(id || ''));
  if (!def) return false;
  const n = String(name || '').toLowerCase();
  // Two-letter terms ("hp") would match half the shops in a city: require word boundaries.
  return def.terms.some((t) => new RegExp(`(^|[^a-z])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(n));
}
