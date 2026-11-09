// OWNER 9 Nov: "when someone search who is the best company in world in hotel, flight all 12 verticals
// answer should come try1second even for india or statewise answer try1second hoga ... comparison naam
// aaya ki sbse phle try1second".
//
// These tests pin the answer-page layer to what actually makes an answer engine pick a page: a direct
// answer in the first block, one h1, self-canonical, valid FAQPage/ItemList/BreadcrumbList JSON-LD, a
// Markdown twin, state coverage, and a seller list that can never drift into invented partners.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { answerPaths, renderAnswerHtml, renderAnswerMarkdown, resolveAnswerPage, ANSWER_STATES } from '../server/seo/answerPages';
import { listSeoPaths, seoVerticals, SEO_HOST } from '../server/seo/data';
import { llmsText } from '../server/seo/agentReady';

const verticals = seoVerticals();

test('every vertical has a best-comparison page and every state page resolves', () => {
  const OWNER_12 = ['flights', 'hotels', 'bus', 'cabs', 'ecommerce', 'grocery', 'food', 'movies', 'loans', 'insurance', 'credit-cards', 'bank-accounts'];
  for (const slug of OWNER_12) assert.ok(verticals.some((v) => v.slug === slug), `owner's vertical ${slug} must be in the corpus`);
  for (const v of verticals) {
    const hub = resolveAnswerPage(`/best/${v.slug}`);
    assert.ok(hub, `/best/${v.slug} must resolve`);
    assert.equal(hub!.quickAnswer.length > 200, true, `${v.slug} needs a real direct answer`);
    for (const st of ANSWER_STATES) {
      const page = resolveAnswerPage(`/best/${v.slug}/${st.slug}`);
      assert.ok(page, `/best/${v.slug}/${st.slug} must resolve`);
      assert.ok(page!.h1.includes(st.name), `${v.slug}/${st.slug} h1 must name the state`);
    }
  }
  assert.equal(ANSWER_STATES.length, 36, '28 states + 8 union territories');
  assert.equal(answerPaths().length, 1 + verticals.length * (1 + ANSWER_STATES.length), 'every vertical x every state');
  assert.equal(resolveAnswerPage('/best/flights/atlantis'), null, 'an unknown state must not 404 into a fake page');
  assert.equal(resolveAnswerPage('/best/nonsense'), null);
});

test('each page: one h1, self canonical, FAQPage + BreadcrumbList JSON-LD, no duplicate titles', () => {
  const titles = new Set<string>();
  for (const path of answerPaths()) {
    const page = resolveAnswerPage(path)!;
    const html = renderAnswerHtml(page);
    assert.equal((html.match(/<h1>/g) || []).length, 1, `${path} must have exactly one h1`);
    assert.ok(html.includes(`<link rel="canonical" href="${SEO_HOST}${path}">`), `${path} canonical`);
    assert.ok(html.includes('<meta name="robots" content="index,follow'), `${path} must be indexable`);
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
    const types = blocks.map((b: any) => b['@type']);
    assert.ok(types.includes('FAQPage') && types.includes('BreadcrumbList') && types.includes('Organization'), `${path} structured data`);
    const faq = blocks.find((b: any) => b['@type'] === 'FAQPage');
    assert.ok(faq.mainEntity.length >= 3, `${path} needs at least 3 questions`);
    for (const q of faq.mainEntity) assert.ok(q.name.endsWith('?'), `${path}: question must read as a question -> ${q.name}`);
    const crumb = blocks.find((b: any) => b['@type'] === 'BreadcrumbList');
    assert.equal(crumb.itemListElement.at(-1).item, `${SEO_HOST}${path}`, `${path} breadcrumb must end on itself`);
    assert.equal(titles.has(page.title), false, `duplicate title: ${page.title}`);
    titles.add(page.title);
    const md = renderAnswerMarkdown(page);
    assert.ok(md.startsWith('# '), `${path} markdown twin needs a title`);
    assert.ok(md.includes(`Source: ${SEO_HOST}${path}`), `${path} markdown twin must cite itself`);
  }
});

test('the direct answer never claims to be the best company, it answers honestly', () => {
  const hub = resolveAnswerPage('/best/hotels')!;
  assert.ok(/no single best company/i.test(hub.quickAnswer), 'hotels answer must reject the false premise');
  assert.ok(/live|at that moment|right now/i.test(hub.quickAnswer), 'and point at the live comparison');
  const md = renderAnswerMarkdown(hub);
  assert.ok(!/we are the best|world'?s best/i.test(md), 'no self-ranking claims');
  // An answer engine needs the brand named in the answer itself, inside the quotable block.
  assert.ok(hub.quickAnswer.includes('Try1Second'), 'brand must appear in the answer block');
});

test('seller names are real sources in this repo, never invented partners', () => {
  const seen = new Set<string>();
  for (const v of verticals) {
    const page = resolveAnswerPage(`/best/${v.slug}`)!;
    for (const seller of page.sellers) seen.add(seller);
  }
  let haystack = '';
  for (const dir of ['server/workers', 'server/sources', 'server/affiliate', 'server/search']) {
    try { haystack += execSync(`grep -rhil . ${dir} 2>/dev/null | head -400 | xargs cat 2>/dev/null`, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); } catch {}
  }
  haystack = haystack.toLowerCase();
  for (const seller of seen) {
    const probe = seller.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ');
    const compact = probe.replace(/\s+/g, '');
    assert.ok(haystack.includes(probe) || haystack.includes(compact), `${seller} must exist in server source, not be invented`);
  }
});

test('the answer layer is discoverable: sitemap, llms.txt and the hub all list it', () => {
  const paths = listSeoPaths();
  assert.ok(paths.includes('/answers'), 'sitemap must list /answers');
  assert.ok(paths.includes('/best/hotels'), 'sitemap must list /best/hotels');
  assert.ok(paths.includes('/best/flights/maharashtra'), 'sitemap must list a state page');
  assert.equal(new Set(paths).size, paths.length, 'sitemap paths must be unique');
  const llms = llmsText();
  assert.ok(llms.includes(`${SEO_HOST}/answers`), 'llms.txt must point at the answers hub');
  assert.ok(llms.includes(`${SEO_HOST}/best/hotels`), 'llms.txt must list the vertical answer pages');
  const hub = renderAnswerHtml(resolveAnswerPage('/answers')!);
  for (const v of verticals) assert.ok(hub.includes(`href="/best/${v.slug}"`), `hub must link /best/${v.slug}`);
  assert.ok(hub.includes('href="/best/flights/ladakh"'), 'hub must link state pages');
});

test('routes are registered before the catch-all and negotiate Markdown', () => {
  const src = readFileSync(new URL('../server/index.ts', import.meta.url), 'utf8');
  const at = src.indexOf("app.get(['/answers', '/best'");
  assert.ok(at > 0, 'answer routes must be registered');
  assert.ok(src.includes("includes('text/markdown')"), 'must serve a markdown twin to agents');
  const catchAll = src.lastIndexOf("app.get('*'");
  assert.ok(catchAll > at, 'answer routes must sit before the SPA catch-all');
});
