#!/usr/bin/env node
/**
 * Builds the nearby card photo pool from Wikimedia Commons, once, into public/nearby-photos/<category>/*.jpg.
 *
 * Why this exists (owner, 17 Nov: "abhi v image ke bina card aa raha hai"): a card for a small Pune cafe has no
 * encyclopaedic photograph anywhere free, so the fallback was a drawn gradient tile - which reads as a broken image
 * and made every ordinary vertical look empty. This pool gives those cards a real photograph of that KIND of place,
 * free-licensed, credited in the card's own honesty line. A place that open data does photograph still uses its own
 * photo first; the pool only fills the gap, never pretends to be that exact shop.
 *
 * Run: node scripts/fetch-nearby-photos.mjs [--limit=14]
 */
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('public/nearby-photos');
const UA = { 'User-Agent': 'Try1Second/1.0 (https://www.try1second.com; contact@try1second.com)' };
const API = 'https://commons.wikimedia.org/w/api.php';
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const PER_CATEGORY = Number(limitArg?.split('=')[1] || 14);

/** Queries per vertical. Order matters: India first, generic subject second. */
const QUERIES = {
  cafes: ['cafe interior india', 'coffee shop interior', 'cafe india table'],
  restaurants: ['restaurant interior india', 'indian restaurant table', 'dhaba india food'],
  hotels: ['hotel room india', 'hotel lobby india', 'hotel reception desk'],
  stays: ['homestay india', 'guest house india room', 'resort cottage india'],
  cabs: ['taxi india', 'auto rickshaw india', 'taxi street india'],
  cinemas: ['cinema hall india', 'movie theater interior seats', 'cinema multiplex india'],
  stores: ['supermarket india', 'grocery store shelves india', 'retail shop india'],
  all: ['market street india', 'indian bazaar shops', 'shopping street india'],
  // Vehicle & services. The owner's complaint there ("images mai vehicle and services mai mt rkho") was the drawn
  // gradient placeholder; a real photograph of a petrol pump, a tyre shop or an RTO counter is what a card should show.
  petrol: ['petrol station india', 'petrol pump fuel', 'fuel station forecourt'],
  cng: ['cng station india', 'compressed natural gas station', 'gas station pump india'],
  lpg: ['lpg cylinder india', 'gas cylinder delivery india', 'lpg autogas station'],
  car_repair: ['car repair garage india', 'car workshop mechanic', 'auto repair shop india'],
  bike_repair: ['motorcycle repair shop india', 'bike mechanic workshop', 'two wheeler service india'],
  puncture: ['tyre puncture repair', 'tyre repair shop india', 'tire repair garage'],
  battery: ['car battery shop', 'automotive battery', 'car battery replacement'],
  tyres: ['tyre shop india', 'tire store shelves', 'tyres stacked shop'],
  denting: ['car body shop painting', 'auto body repair workshop', 'car painting garage'],
  accessories: ['car accessories shop', 'automobile spare parts shop india', 'car parts store'],
  car_wash: ['car wash service', 'car washing india', 'car wash bay'],
  detailing: ['car detailing polishing', 'car polishing service', 'auto detailing studio'],
  pucc: ['vehicle inspection centre india', 'emission testing vehicle', 'vehicle testing station'],
  insurance: ['insurance office india', 'insurance company office desk', 'insurance agency india'],
  rto: ['regional transport office india', 'rto office india building', 'vehicle registration office india'],
  bike_rental: ['scooter rental shop', 'motorcycle rental india', 'scooters parked rental'],
  car_rental: ['car rental office', 'rental cars parked', 'self drive car rental india'],
  scrapping: ['vehicle scrap yard', 'scrap metal yard cars', 'car dismantling yard'],
};

const BAD = /\b(painting|engraving|drawing|manet|map|diagram|poster|logo|banknote|stamp|manuscript)\b/i;

async function apiJson(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', ...params })}`;
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`commons ${res.status}`);
  return res.json();
}

async function candidates(query) {
  const data = await apiJson({
    action: 'query',
    generator: 'search',
    gsrsearch: `filetype:bitmap ${query}`,
    gsrnamespace: '6',
    gsrlimit: '30',
    prop: 'imageinfo',
    iiprop: 'url|mime|size',
    iiurlwidth: '640',
  });
  const pages = Object.values(data?.query?.pages || {});
  return pages
    .map((p) => ({ title: p.title, info: (p.imageinfo || [])[0] }))
    .filter(({ title, info }) => {
      if (!info || info.mime !== 'image/jpeg') return false;
      if (!info.thumburl) return false;
      if (BAD.test(title)) return false;
      const { width, height } = info;
      if (!width || !height) return false;
      const ratio = width / height;
      // Card frame is 16:10; keep landscape-ish photos so a real picture is cropped, never letterboxed into a strip.
      if (ratio < 1.15 || ratio > 2.4) return false;
      if (width < 900) return false;
      return true;
    });
}

async function download(url, dest) {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) return false;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 12_000) return false;
  if (!(buf[0] === 0xff && buf[1] === 0xd8)) return false; // real JPEG only
  fs.writeFileSync(dest, buf);
  return true;
}

const manifest = {};
for (const [category, queries] of Object.entries(QUERIES)) {
  const dir = path.join(OUT, category);
  fs.mkdirSync(dir, { recursive: true });
  const seen = new Set();
  let saved = 0;
  for (const query of queries) {
    if (saved >= PER_CATEGORY) break;
    let found = [];
    try {
      found = await candidates(query);
    } catch (err) {
      console.warn(`[photos] ${category} "${query}" failed: ${err.message}`);
      continue;
    }
    for (const { title, info } of found) {
      if (saved >= PER_CATEGORY) break;
      if (seen.has(title)) continue;
      seen.add(title);
      const dest = path.join(dir, `${String(saved + 1).padStart(2, '0')}.jpg`);
      if (await download(info.thumburl, dest)) {
        manifest[`${category}/${path.basename(dest)}`] = { title, credit: 'Wikimedia Commons' };
        saved += 1;
      }
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  console.log(`[photos] ${category}: ${saved} photos`);
}

fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`[photos] total ${Object.keys(manifest).length} photos -> ${OUT}`);
