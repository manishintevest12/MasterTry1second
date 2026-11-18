/**
 * PLACE TILES, DRAWN PER CARD (owner 17 Nov: "site pr image same kyun aa raha hai").
 *
 * When no real photo of a place can be found, the card must still show an image, and that image must not be the same
 * picture on ten different cards - a repeated photo reads as a false claim about every place after the first. The old
 * fallback rotated three jpgs per vertical, so a grid of restaurants showed the identical tile again and again.
 *
 * This module draws a tile per place: the hue is derived from the place name, so two cards never share one, and the
 * vertical sets the family of colours (food warm, stays indigo, fuel amber...). No dependency is used, the PNG is
 * built by hand with zlib, and the result is cached forever at the edge - a tile costs one small response per place.
 */
import { deflateSync } from 'node:zlib';

// Small on purpose: it is a backdrop that the card scales up softly, so 220x124 keeps a tile under 20 KB while a
// 20-card grid still loads in one budget. Photo tiles are backgrounds, not content.
const W = 220;
const H = 124;

const FAMILY: Record<string, number> = {
  restaurants: 12, cafes: 28, hotels: 232, stays: 258, cabs: 45, stores: 320, movies: 280,
  petrol: 38, cng: 150, lpg: 20, car_repair: 205, bike_repair: 190, puncture: 8, battery: 48,
  tyres: 215, denting: 265, accessories: 300, car_wash: 185, detailing: 200, pucc: 165,
  insurance: 210, rto: 222, bike_rental: 140, car_rental: 170, scrapping: 95, ev_charging: 130, all: 250,
};

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** HSL -> RGB, all inputs 0..1. */
function hsl(h: number, s: number, l: number): [number, number, number] {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)))));
  };
  return [f(0), f(8), f(4)];
}

function crc32(buf: Buffer): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/**
 * A tile for one place. `seed` is the place name, so the same place always gets the same tile and two places
 * practically never get the same one.
 */
export function placeTile(category: string, seed: string): Buffer {
  const h = hash(`${category}|${seed}`);
  const base = (FAMILY[String(category || '')] ?? 250) + (h % 26) - 13;
  const hue = ((base % 360) + 360) % 360;
  const hue2 = (hue + 26 + (h % 18)) % 360;
  const dark = hsl(hue / 360, 0.52, 0.28);
  const light = hsl(hue2 / 360, 0.64, 0.62);
  const stripe = hsl(((hue + 180) % 360) / 360, 0.55, 0.5);

  const raw = Buffer.alloc((W * 3 + 1) * H);
  let p = 0;
  for (let y = 0; y < H; y += 1) {
    raw[p] = 0; p += 1;
    const v = y / (H - 1);
    for (let x = 0; x < W; x += 1) {
      const u = x / (W - 1);
      // Diagonal blend plus a soft glow where the two hues cross, so the tile reads as an image, not a swatch.
      const t = Math.min(1, Math.max(0, (u * 0.7 + v * 0.3)));
      let r = dark[0] + (light[0] - dark[0]) * t;
      let g = dark[1] + (light[1] - dark[1]) * t;
      let b = dark[2] + (light[2] - dark[2]) * t;
      const dx = u - 0.34; const dy = v - 0.42;
      const glow = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) * 1.9);
      r += (255 - r) * glow * 0.22; g += (255 - g) * glow * 0.22; b += (255 - b) * glow * 0.22;
      if (((x + y + (h % 40)) % 23) < 1) { r += (stripe[0] - r) * 0.18; g += (stripe[1] - g) * 0.18; b += (stripe[2] - b) * 0.18; }
      raw[p] = Math.max(0, Math.min(255, Math.round(r))); p += 1;
      raw[p] = Math.max(0, Math.min(255, Math.round(g))); p += 1;
      raw[p] = Math.max(0, Math.min(255, Math.round(b))); p += 1;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
