import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mintShareToken, readShareToken, cleanPayload, esc, previewCopy, renderSharePage, renderInvitePage,
  resultsPath, seenLabel, isLinkPreviewBot, rupees,
} from '../server/share/shareLinks';

/**
 * OWNER 19 Nov growth brief: "clean share URLs, dynamic Open Graph metadata for social previews ... so shared
 * links open directly to the relevant screen/result with minimal drop-off."
 *
 * These tests pin the three things that make a share link safe to put in front of the public: it cannot be
 * forged, it never presents a remembered price as the current one, and no product title can inject markup.
 */

test('a minted token round-trips the card it was made from', () => {
  const token = mintShareToken({ v: 'movies', q: 'jawan', c: 'Indore', t: 'Jawan', p: 180, s: 'BookMyShow' }, 1_700_000_000_000);
  const back = readShareToken(token);
  assert.ok(back);
  assert.equal(back!.v, 'movies');
  assert.equal(back!.t, 'Jawan');
  assert.equal(back!.p, 180);
  assert.equal(back!.s, 'BookMyShow');
  assert.equal(back!.c, 'Indore');
});

test('a tampered token is refused', () => {
  const token = mintShareToken({ v: 'grocery', t: 'Amul Butter 500g', p: 62 });
  const [body, sig] = token.split('.');
  // flip one character of the payload: the signature no longer matches
  const forged = (body[0] === 'A' ? 'B' : 'A') + body.slice(1) + '.' + sig;
  assert.equal(readShareToken(forged), null);
  // and a token with no signature at all
  assert.equal(readShareToken(body), null);
  assert.equal(readShareToken(''), null);
  assert.equal(readShareToken('x'.repeat(2000)), null);
});

test('the preview says WHEN the price was seen, never that it is current', () => {
  const payload = cleanPayload({ v: 'ecommerce', t: 'iPhone 15 128GB', p: 45999, s: 'Flipkart', ts: Date.parse('2026-11-19T06:00:00Z') });
  const copy = previewCopy(payload);
  assert.match(copy.title, /iPhone 15 128GB/);
  assert.match(copy.title, /₹45,999/);
  assert.match(copy.description, /Seen at ₹45,999 on Flipkart on 19 Nov/);
  assert.match(copy.description, /live price/i);
  assert.equal(seenLabel(Date.parse('2026-11-19T06:00:00Z')), '19 Nov');
});

test('a share with no price promises no number', () => {
  const copy = previewCopy(cleanPayload({ v: 'flights', q: 'indore to mumbai', ts: Date.now() }));
  assert.ok(!copy.title.includes('₹'));
  assert.match(copy.title, /compare live prices/i);
});

test('a product title cannot inject markup into the page', () => {
  const evil = '<script>alert(1)</script> "quoted" & \'apostrophe\'';
  assert.equal(esc(evil), '&lt;script&gt;alert(1)&lt;/script&gt; &quot;quoted&quot; &amp; &#39;apostrophe&#39;');
  const html = renderSharePage({ origin: 'https://www.try1second.com', payload: cleanPayload({ t: evil, v: 'ecommerce', ts: Date.now() }) });
  assert.ok(!html.includes('<script>alert(1)</script>'), 'the title must never become a script tag');
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
});

test('the share page carries the OG tags WhatsApp and Facebook read', () => {
  const html = renderSharePage({
    origin: 'https://www.try1second.com',
    payload: cleanPayload({ v: 'movies', t: 'Jawan', p: 180, s: 'BookMyShow', c: 'Indore', q: 'jawan', ts: Date.now() }),
  });
  for (const tag of ['og:title', 'og:description', 'og:image', 'og:url', 'og:type', 'twitter:card', 'twitter:image']) {
    assert.ok(html.includes(`property="${tag}"`) || html.includes(`name="${tag}"`), tag);
  }
  assert.ok(html.includes('https://www.try1second.com/og-default.png'));
  assert.ok(html.includes('https://www.try1second.com/movies?q=jawan&amp;city=Indore'), 'the CTA opens the live search');
  assert.ok(html.includes('noindex'), 'a share page is not a search landing page');
});

test('the invite page never promises a reward for signing up', () => {
  const html = renderInvitePage({ origin: 'https://www.try1second.com', code: 'T1S-AB12CD' });
  assert.ok(html.includes('T1S-AB12CD'));
  assert.ok(html.includes('og:image'));
  assert.match(html, /earns a reward only when you actually use/i);
  assert.ok(!/earn a reward on signup/i.test(html));
});

test('a result path stays on the vertical with the sharer query and city', () => {
  assert.equal(resultsPath({ v: 'movies', q: 'jawan', c: 'Indore', ts: 0 }), '/movies?q=jawan&city=Indore');
  assert.equal(resultsPath({ v: 'grocery', q: 'amul butter', ts: 0 }), '/grocery?q=amul+butter');
  assert.equal(resultsPath({ ts: 0 }), '/');
});

test('link preview bots are recognised, browsers are not', () => {
  assert.equal(isLinkPreviewBot('WhatsApp/2.23.20.0 A'), true);
  assert.equal(isLinkPreviewBot('facebookexternalhit/1.1'), true);
  assert.equal(isLinkPreviewBot('TelegramBot (like TwitterBot)'), true);
  assert.equal(isLinkPreviewBot('Mozilla/5.0 (Linux; Android 14; SM-S918B) Chrome/120'), false);
  assert.equal(isLinkPreviewBot(''), false);
});

test('rupees are formatted the Indian way', () => {
  assert.equal(rupees(45999), '₹45,999');
  assert.equal(rupees(1250000), '₹12,50,000');
  assert.equal(rupees(62.5), '₹62.5');
});

test('a payload is clamped so a token cannot be used as storage', () => {
  const p = cleanPayload({ q: 'x'.repeat(500), t: 'y'.repeat(500), p: -5, ts: 0 });
  assert.equal(p.q!.length, 120);
  assert.equal(p.t!.length, 120);
  assert.equal(p.p, undefined, 'a negative price is not a price');
  assert.ok(p.ts > 0, 'a missing timestamp falls back to now, so the label is honest');
});
