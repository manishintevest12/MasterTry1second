/**
 * Amazon PDP gallery regression (17 Oct): owner rule — every e-commerce card must
 * show multiple images. Amazon's SRP gives one hero shot; the worker now fetches
 * the PDP for top offers and extractAmazonGallery() lifts the colorImages hiRes[]
 * block. Must dedupe, keep https m.media-amazon.com only, cap at 6, and fall
 * back to "large" when hiRes is missing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { extractAmazonGallery } from '../server/workers/parsers/amazonIn.ts';

const HIRES = (n: number) => Array.from({ length: n }, (_, i) => `https://m.media-amazon.com/images/I/7${i}abc${i}.._AC_SL1500_.jpg`);

test('amazon gallery: hiRes images extracted, deduped, capped at 6', () => {
  const imgs = HIRES(8);
  const html = `'colorImages' : { 'initial' : [ ${[...imgs, imgs[0]]
    .map((u) => `{ "hiRes" : "${u}", "large" : "${u}", "thumb" : "${u}", "variant" : "MAIN" }`)
    .join(', ')} ] }`;
  const out = extractAmazonGallery(html);
  assert.equal(out.length, 6);
  assert.deepEqual(out, [...new Set(imgs)].slice(0, 6));
  assert.ok(out.every((u) => /^https:\/\/m\.media-amazon\.com\/.+\.(jpg|jpeg|png|webp)$/i.test(u)));
});

test('amazon gallery: falls back to large when hiRes absent, rejects non-amazon urls', () => {
  const html = `'colorImages' : { 'initial' : [
    { "large" : "https://m.media-amazon.com/images/I/41xyz._SL1000_.jpg", "thumb" : "https://m.media-amazon.com/images/I/41xyz._SL75_.jpg" },
    { "large" : "https://m.media-amazon.com/images/I/42abc._SL1000_.png", "thumb" : "https://m.media-amazon.com/images/I/42abc._SL75_.png" },
    { "large" : "http://evil.example.com/not-amazon.jpg" }
  ] }`;
  const out = extractAmazonGallery(html);
  assert.equal(out.length, 2);
  assert.ok(out.every((u) => u.startsWith('https://m.media-amazon.com/')));
});

test('amazon gallery: challenge/shell pages yield empty (never fabricate)', () => {
  assert.equal(extractAmazonGallery('<html>bm-verify interstitial</html>').length, 0);
  assert.equal(extractAmazonGallery('').length, 0);
});
