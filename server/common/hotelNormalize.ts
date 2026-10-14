/**
 * Server-side mirror of hotel normalization functions.
 * Pure TS, zero external dependencies.
 */

export interface HotelComparable {
  name: string;
  city?: string;
  lat?: number;
  lng?: number;
  site?: string;
  specs?: Record<string, any>;
}

const BRAND_TOKENS = new Set([
  'treebo', 'oyo', 'fabhotel', 'fabhotels', 'radisson', 'blu', 'red',
  'taj', 'trident', 'ginger', 'oberoi', 'marriott', 'hyatt', 'novotel',
  'ibis', 'ramada', 'welcomhotel', 'itc', 'lalit', 'lemon', 'tree'
]);

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

export function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function normalizeHotelName(name: string, city = ''): string {
  if (!name) return '';

  let s = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  s = s.replace(/&/g, ' and ');

  const cLower = city.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  
  const parts = s.split(/\s*[,|()]\s*|\s+-\s+|\s+in\s+|\s+near\s+/i);
  if (parts.length > 1) {
    const keepParts: string[] = [parts[0]];
    for (let i = 1; i < parts.length; i++) {
      const p = parts[i].trim();
      if (!p) continue;
      const matchesCity = cLower && p.includes(cLower);
      const isLocationSuffix = /^(airport|railway station|stn|rly|city center|centre|a unit of|pvt ltd|private limited)\b/i.test(p);
      if (!matchesCity && !isLocationSuffix) {
        keepParts.push(p);
      }
    }
    s = keepParts.join(' ');
  }

  if (cLower) {
    s = s.replace(new RegExp(`\\b${escapeRegExp(cLower)}\\b`, 'gi'), ' ');
  }

  s = s
    .replace(/\brd\b/g, 'road')
    .replace(/\bint'?l\b/g, 'international')
    .replace(/\bapt\b/g, 'airport')
    .replace(/\bstn\b/g, 'station')
    .replace(/\brly\b/g, 'railway');

  s = s
    .replace(/\b(oyo|fabhotel|fabhotels|treebo)\s+(flagship|premium|trend|rooms)?\s*\d+\b/g, '$1')
    .replace(/\btreebo\s+trend\b/g, 'treebo')
    .replace(/\bfab\s*hotels?\b/g, 'fabhotel')
    .replace(/\bradisson\s+(blu|red)\b/g, 'radisson blu');

  s = s
    .replace(/\b\d+\s*-\s*star\b/g, ' ')
    .replace(/\b\d+\s*star\b/g, ' ')
    .replace(/\b\d+\s*\*\b/g, ' ')
    .replace(/\b\d+\b/g, ' ');

  s = s.replace(/[^a-z0-9\s]/g, ' ');

  const rawTokens = s.split(/\s+/).filter(Boolean);
  const finalTokens: string[] = [];

  for (const token of rawTokens) {
    if (STOPWORDS_SET.has(token)) continue;
    finalTokens.push(token);
  }

  return [...new Set(finalTokens)].join(' ');
}

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

export function sameHotel(hotelA: HotelComparable, hotelB: HotelComparable): boolean {
  if (hotelA.site && hotelB.site && hotelA.site === hotelB.site) {
    return false;
  }

  const cityA = (hotelA.city || hotelA.specs?.city || '').toLowerCase().trim();
  const cityB = (hotelB.city || hotelB.specs?.city || '').toLowerCase().trim();
  if (cityA && cityB && cityA !== cityB) {
    return false;
  }

  const latA = hotelA.lat ?? Number(hotelA.specs?.lat ?? hotelA.specs?.latitude);
  const lngA = hotelA.lng ?? Number(hotelA.specs?.lng ?? hotelA.specs?.longitude);
  const latB = hotelB.lat ?? Number(hotelB.specs?.lat ?? hotelB.specs?.latitude);
  const lngB = hotelB.lng ?? Number(hotelB.specs?.lng ?? hotelB.specs?.longitude);

  if (!isNaN(latA) && !isNaN(lngA) && !isNaN(latB) && !isNaN(lngB) && latA !== 0 && latB !== 0) {
    const dist = haversineDistanceMeters(latA, lngA, latB, lngB);
    if (dist > 600) {
      return false;
    }
  }

  const normA = normalizeHotelName(hotelA.name, cityA);
  const normB = normalizeHotelName(hotelB.name, cityB);

  if (!normA || !normB) return false;
  if (normA === normB) return true;

  const tokensA = new Set(normA.split(' '));
  const tokensB = new Set(normB.split(' '));

  const diffA = [...tokensA].filter(t => !tokensB.has(t));
  const diffB = [...tokensB].filter(t => !tokensA.has(t));

  const hasLocalityDiffA = diffA.some(t => LOCALITY_TOKENS.has(t));
  const hasLocalityDiffB = diffB.some(t => LOCALITY_TOKENS.has(t));

  if (hasLocalityDiffA || hasLocalityDiffB) {
    return false;
  }

  let intersectionCount = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersectionCount++;
  }
  const unionSize = new Set([...tokensA, ...tokensB]).size;
  const jaccard = unionSize > 0 ? intersectionCount / unionSize : 0;

  if (jaccard >= 0.6) {
    return true;
  }

  const [small, big] = tokensA.size <= tokensB.size ? [tokensA, tokensB] : [tokensB, tokensA];
  if (small.size > 0 && [...small].every(t => big.has(t))) {
    const isBareBrand = [...small].every(t => BRAND_TOKENS.has(t));
    if (!isBareBrand && [...small].some(t => t.length >= 3)) {
      if (big.size - small.size <= 1) {
        return true;
      }
    }
  }

  return false;
}
