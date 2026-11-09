/**
 * OWNER 9 Nov: monetise every visitor without a payment gateway, without a popunder and without
 * breaking the search flow - "Indirect Monetization & Intent Routing". Two surfaces are pinned here:
 * the answer/hub pages (only cold organic traffic surface, previously unmonetised) and the in-feed
 * sponsored card placement in the results list.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveAnswerPage, renderAnswerHtml, renderAnswerMarkdown } from '../server/seo/answerPages';

const feedSource = readFileSync(new URL('../src/components/ComparisonFeed.tsx', import.meta.url), 'utf8');

test('answer pages carry a labelled AdSense unit, the loader and an intent-routing CTA', () => {
  process.env.T1S_ANSWER_AD_SLOT = '9876543210';
  try {
    const page = resolveAnswerPage('/best/hotels/maharashtra');
    assert.ok(page, 'state answer page must resolve');
    const html = renderAnswerHtml(page!);
    // one labelled unit, real slot id, auto format: never a floating or full-screen interstitial
    assert.match(html, /class="adlabel">Advertisement</, 'ad must be labelled Advertisement');
    assert.match(html, /class="adsbygoogle"[\s\S]*data-ad-slot="9876543210"/, 'unit must use the configured slot');
    assert.match(html, /data-ad-format="auto"/, 'must be responsive, not a fixed intrusive size');
    assert.match(html, /adsbygoogle\.js\?client=ca-pub-3144522772064172/, 'loader must use the site publisher id');
    // intent routing: the CTA continues the visit into the vertical where affiliate exits live
    assert.match(html, /class="cta"><a href="\/hotels"/, `CTA must point at the vertical page for ${page!.path}`);
    assert.ok(!/window\.open|popunder|onclick="location/.test(html), 'no popunder / forced navigation on a content page');
  } finally {
    delete process.env.T1S_ANSWER_AD_SLOT;
  }
});

test('answer page without a configured slot still loads AdSense but renders no empty unit', () => {
  const page = resolveAnswerPage('/best/flights')!;
  const html = renderAnswerHtml(page);
  assert.match(html, /adsbygoogle\.js\?client=ca-pub/, 'loader stays so dashboard Auto ads can fill');
  assert.ok(!html.includes('class="adsbygoogle"'), 'no slot configured means no empty <ins> taking space');
  assert.match(html, /class="cta"><a href="\/flights"/, 'CTA is unconditional: it is internal, not an ad');
});

test('the Markdown twin stays clean for LLM crawlers', () => {
  const page = resolveAnswerPage('/best/hotels')!;
  const md = renderAnswerMarkdown(page);
  assert.ok(!/adsbygoogle|Advertisement|class="cta"/.test(md), 'machine twin must not carry ad markup');
});

test('results list places one sponsored card after the 6th row instead of a second unit', () => {
  assert.match(feedSource, /const IN_FEED_AD_AFTER = 5;/, '0-based 5 = after the 6th card');
  assert.match(feedSource, /i === IN_FEED_AD_AFTER && inFeedAdVisible/, 'card is injected at that index');
  assert.match(feedSource, /const inFeedAdVisible = !isHotels && visibleItems\.length > IN_FEED_AD_AFTER \+ 1/, 'only when a 7th row exists');
  assert.match(feedSource, /\{!inFeedAdVisible && \(/, 'the below-list unit stands down so one impression, one slot');
  const verticalSlots = (feedSource.match(/slotKey=\{`vertical_\$\{vertical\}`\}/g) || []).length;
  assert.equal(verticalSlots, 2, 'exactly two placements: in-feed and the short-list fallback');
});
