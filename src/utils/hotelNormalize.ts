/**
 * Pure functions for hotel name normalization, similarity calculation, and same-hotel matching.
 * No external runtime dependencies.
 */

export interface HotelComparable {
  name: string;
  city?: string;
  lat?: number;
  lng?: number;
  site?: string;
  specs?: Record<string, any>;
}

// Known hotel brand tokens to guard against bare brand matching
const BRAND_TOKENS = new Set([
  'treebo', 'oyo', 'fabhotel', 'fabhotels', 'radisson', 'blu', 'red',
  'taj', 'trident', 'ginger', 'oberoi', 'marriott', 'hyatt', 'novotel',
  'ibis', 'ramada', 'welcomhotel', 'itc', 'lalit', 'lemon', 'tree'
]);

// Stopwords to strip out of hotel names
const STOPWORDS_SET = new Set([
  'hotel', 'hotels',
  'the',
  'by',
  'resort', 'resorts', 'spa',
  'suite', 'suites',
  'inn',
  'unit', 'of', 'a', 'an', 'and', 'near', 'in', 'at',
  'pvt', 'ltd', 'private', 'limited',
  'heritage',
  'boutique',
  'luxury',
  'premium',
  'collection',
  'grand',
  'palace',
  'stay', 'stays', 'room', 'rooms',
  'residency', 'residence', 'residences',
  'international', 'intl',
  'airport', 'apt',
  'city', 'center', 'centre',
  'best',
]);

// Locality/area words in major cities used for locality branch separation guard
const LOCALITY_TOKENS = new Set([
  'bandra', 'kurla', 'bkc', 'nariman', 'point', 'andheri', 'goregaon', 'juhu', 'powai', 'sahar', 'colaba', 'worli', 'malad', 'thane', 'vashi',
  'aerocity', 'connaught', 'cp', 'dwarka', 'karol', 'bagh', 'saket', 'gurgaon', 'gurugram', 'noida', 'kaushambi', 'paschim', 'vihar', 'ghaziabad', 'faridabad',
  'koramangala', 'indiranagar', 'whitefield', 'mg', 'marathahalli', 'electronic',
  'hitec', 'gachibowli', 'jubilee', 'banjara',
  'secunderabad', 't nagar', 'velachery', 'adyar',
  'salt', 'lake', 'newtown', 'park', 'street',
  'north', 'south', 'east', 'west', 'central',
]);

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Calculate Haversine distance in meters between two lat/lng coordinates.
 */
export function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Normalizes a hotel property name:
 * - lowercase & strip unicode accents
 * - strip punctuation and star ratings
 * - drop city/area suffixes after ',', '|', '(', ')', ' - ', ' in ', ' near '
 * - expand abbreviations (rd -> road, intl -> international, apt -> airport, etc.)
 * - unify '&' / 'and'
 * - preserve recognized brand prefixes (Treebo, OYO, FabHotel, Radisson, Taj, etc.)
 * - strip stopwords (hotel, resort & spa, suites, inn, pvt ltd, heritage, luxury, etc.)
 * - collapse repeated spaces
 */
export function normalizeHotelName(name: string, city = ''): string {
  if (!name) return '';

  // 1. Unicode NFD normalization (strip accents) & lowercase
  let s = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  // 2. Unify '&' and 'and'
  s = s.replace(/&/g, ' and ');

  // 3. Handle separators: drop suffixes after ',', '|', '(', ')', ' - ', ' in ', ' near ' if they contain city name or location fillers
  const cLower = city.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  
  const parts = s.split(/\s*[,|()]\s*|\s+-\s+|\s+in\s+|\s+near\s+/i);
  if (parts.length > 1) {
    const keepParts: string[] = [parts[0]];
    for (let i = 1; i < parts.length; i++) {
      const p = parts[i].trim();
      if (!p) continue;
      // If suffix contains city or common area phrases, omit it
      const matchesCity = cLower && p.includes(cLower);
      const isLocationSuffix = /^(airport|railway station|stn|rly|city center|centre|a unit of|pvt ltd|private limited)\b/i.test(p);
      if (!matchesCity && !isLocationSuffix) {
        keepParts.push(p);
      }
    }
    s = keepParts.join(' ');
  }

  // 4. Strip city name from text if present
  if (cLower) {
    s = s.replace(new RegExp(`\\b${escapeRegExp(cLower)}\\b`, 'gi'), ' ');
  }

  // 5. Expand abbreviations
  s = s
    .replace(/\brd\b/g, 'road')
    .replace(/\bint'?l\b/g, 'international')
    .replace(/\bapt\b/g, 'airport')
    .replace(/\bstn\b/g, 'station')
    .replace(/\brly\b/g, 'railway');

  // 6. Handle brand prefixes and OYO / Fab / Treebo numbers (e.g. "oyo flagship 1234", "fabhotel 567")
  s = s
    .replace(/\b(oyo|fabhotel|fabhotels|treebo)\s+(flagship|premium|trend|rooms)?\s*\d+\b/g, '$1')
    .replace(/\btreebo\s+trend\b/g, 'treebo')
    .replace(/\bfab\s*hotels?\b/g, 'fabhotel')
    .replace(/\bradisson\s+(blu|red)\b/g, 'radisson blu');

  // 7. Strip star ratings & numeric tokens (e.g. "5 star", "3*", "4-star", "5star", standalone numbers)
  s = s
    .replace(/\b\d+\s*-\s*star\b/g, ' ')
    .replace(/\b\d+\s*star\b/g, ' ')
    .replace(/\b\d+\s*\*\b/g, ' ')
    .replace(/\b\d+\b/g, ' ');

  // 8. Replace non-alphanumeric with space
  s = s.replace(/[^a-z0-9\s]/g, ' ');

  // 9. Tokenize & remove stopwords (while keeping tokens that are brand names or distinguishing words)
  const rawTokens = s.split(/\s+/).filter(Boolean);
  const finalTokens: string[] = [];

  for (const token of rawTokens) {
    if (STOPWORDS_SET.has(token)) {
      continue;
    }
    finalTokens.push(token);
  }

  // Collapse repeated spaces and preserve order
  return [...new Set(finalTokens)].join(' ');
}

/**
 * Returns token-set Jaccard similarity between two hotel names (0.0 to 1.0).
 */
export function hotelSimilarity(nameA: string, nameB: string, cityA = '', cityB = ''): number {
  const normA = normalizeHotelName(nameA, cityA);
  const normB = normalizeHotelName(nameB, cityB);

  if (!normA || !normB) return 0;
  if (normA === normB) return 1.0;

  const tokensA = new Set(normA.split(' '));
  const tokensB = new Set(normB.split(' '));

  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }

  const union = new Set([...tokensA, ...tokensB]).size;
  return union > 0 ? intersection / union : 0;
}

/**
 * Determines whether two hotel property records represent the exact same hotel.
 */
export function sameHotel(hotelA: HotelComparable, hotelB: HotelComparable): boolean {
  // 1. Same site guard: Two listings from the exact same site never merge
  if (hotelA.site && hotelB.site && hotelA.site === hotelB.site) {
    return false;
  }

  // 2. City check: Different cities never merge
  const cityA = (hotelA.city || hotelA.specs?.city || '').toLowerCase().trim();
  const cityB = (hotelB.city || hotelB.specs?.city || '').toLowerCase().trim();
  if (cityA && cityB && cityA !== cityB) {
    return false;
  }

  // 3. Lat/Lng distance check: If both have coordinates, require within ~600m
  const latA = hotelA.lat ?? Number(hotelA.specs?.lat ?? hotelA.specs?.latitude);
  const lngA = hotelA.lng ?? Number(hotelA.specs?.lng ?? hotelA.specs?.longitude);
  const latB = hotelB.lat ?? Number(hotelB.specs?.lat ?? hotelB.specs?.latitude);
  const lngB = hotelB.lng ?? Number(hotelB.specs?.lng ?? hotelB.specs?.longitude);

  if (!isNaN(latA) && !isNaN(lngA) && !isNaN(latB) && !isNaN(lngB) && latA !== 0 && latB !== 0) {
    const dist = haversineDistanceMeters(latA, lngA, latB, lngB);
    if (dist > 600) {
      return false; // Farther than 600 meters apart
    }
  }

  // 4. Token normalization & matching
  const normA = normalizeHotelName(hotelA.name, cityA);
  const normB = normalizeHotelName(hotelB.name, cityB);

  if (!normA || !normB) return false;
  if (normA === normB) return true;

  const tokensA = new Set(normA.split(' '));
  const tokensB = new Set(normB.split(' '));

  // Locality guard: Check for differing locality/area tokens in same city
  const diffA = [...tokensA].filter(t => !tokensB.has(t));
  const diffB = [...tokensB].filter(t => !tokensA.has(t));

  const hasLocalityDiffA = diffA.some(t => LOCALITY_TOKENS.has(t));
  const hasLocalityDiffB = diffB.some(t => LOCALITY_TOKENS.has(t));

  if (hasLocalityDiffA || hasLocalityDiffB) {
    // If different branches in same city have differing locality words, do not merge!
    return false;
  }

  // Token-set Jaccard score >= 0.6
  let intersectionCount = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersectionCount++;
  }
  const unionSize = new Set([...tokensA, ...tokensB]).size;
  const jaccard = unionSize > 0 ? intersectionCount / unionSize : 0;

  if (jaccard >= 0.6) {
    return true;
  }

  // Subset match: one's distinctive tokens subset of the other's AND same city
  const [small, big] = tokensA.size <= tokensB.size ? [tokensA, tokensB] : [tokensB, tokensA];
  if (small.size > 0 && [...small].every(t => big.has(t))) {
    // Guard against bare brand absorbing a specific locality branch
    const isBareBrand = [...small].every(t => BRAND_TOKENS.has(t));
    if (!isBareBrand && [...small].some(t => t.length >= 3)) {
      if (big.size - small.size <= 1) {
        return true;
      }
    }
  }

  return false;
}
