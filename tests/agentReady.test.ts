import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  llmsText, llmsFullText, markdownForPath, serverCard, isKnownPath,
  agentLinkHeader, notFoundHtml, CONTACT_EMAIL, SAME_AS, BUSINESS_TELEPHONE, BUSINESS_ADDRESS,
} from '../server/seo/agentReady';
import { robotsText } from '../server/seo/sitemap';

// OWNER 9 Nov: "make try1second.com more agent-ready ... make AI visibility score 100%".
// These pin the machine-facing surface so a refactor cannot quietly delete it again.

test('robots.txt declares a Content-Signal and the sitemap', () => {
  const r = robotsText();
  assert.match(r, /^Content-Signal: search=yes, ai-input=yes, ai-train=no$/m);
  assert.match(r, /^Sitemap: https:\/\/www\.try1second\.com\/sitemap\.xml$/m);
  assert.match(r, /^User-agent: \*$/m);
});

test('llms.txt follows the format: # title, > summary, markdown links', () => {
  const t = llmsText();
  assert.ok(t.startsWith('# Try1Second'), 'top-level heading first');
  assert.ok(/\n> \S/.test(t), 'has a > summary line');
  assert.match(t, /\[About Try1Second\]\(https:\/\/www\.try1second\.com\/about\)/);
  assert.ok(t.includes(CONTACT_EMAIL), 'publishes the contact address');
  assert.ok(t.includes('/llms-full.txt') && t.includes('/sitemap.xml'));
  assert.ok(llmsFullText().split('\n').length > t.split('\n').length, 'full variant is longer');
});

test('the markdown view of a page is real markdown with a canonical line', () => {
  const home = markdownForPath('/');
  assert.ok(home.startsWith('# '));
  assert.ok(home.includes('Canonical: https://www.try1second.com/'));
  assert.ok(home.includes('search_prices'), 'tells agents about the MCP tool');
  assert.ok(markdownForPath('/about').includes('Canonical: https://www.try1second.com/about'));
});

test('the MCP server card points at a tool the endpoint really implements', () => {
  const card: any = serverCard();
  assert.equal(card.endpoint, 'https://www.try1second.com/mcp');
  assert.equal(card.transport.type, 'http');
  assert.ok(Array.isArray(card.tools) && card.tools.length >= 1);
  const tool = card.tools[0];
  assert.equal(tool.name, 'search_prices');
  assert.equal(tool.inputSchema.type, 'object');
  assert.deepEqual(tool.inputSchema.required, ['query']);
  assert.equal(card.contact.email, CONTACT_EMAIL);
  const src = readFileSync(new URL('../server/seo/mcpEndpoint.ts', import.meta.url), 'utf8');
  assert.ok(src.includes("if (name === 'search_prices')"), 'endpoint implements the tool');
  assert.ok(src.includes("method === 'initialize'") && src.includes("method === 'tools/list'"));
});

test('sameAs only holds real URLs', () => {
  assert.ok(Array.isArray(SAME_AS) && SAME_AS.length >= 1);
  for (const u of SAME_AS) assert.match(u, /^https:\/\//);
});

test('unknown paths are not "known", so they can answer a real 404', () => {
  assert.equal(isKnownPath('/'), true);
  assert.equal(isKnownPath('/flights'), true);
  assert.equal(isKnownPath('/about'), true);
  assert.equal(isKnownPath('/llms.txt'), true);
  assert.equal(isKnownPath('/.well-known/mcp/server-card.json'), true);
  assert.equal(isKnownPath('/this-page-does-not-exist-9f3a'), false);
  const html = notFoundHtml('/nope');
  assert.ok(html.includes('<title>404') && html.includes('noindex'));
});

test('every response advertises llms.txt and the MCP card via Link', () => {
  const l = agentLinkHeader();
  assert.ok(l.includes('rel="llms-txt"'));
  assert.ok(l.includes('rel="mcp-server-card"'));
  assert.ok(l.includes('rel="sitemap"'));
});

test('every canonical vertical path from the address bar is a known page (no 404 for the app)', () => {
  const src = readFileSync(new URL('../src/utils/verticalRoutes.ts', import.meta.url), 'utf8');
  const paths = [...src.matchAll(/'(\/[a-z0-9-]+)'/g)].map((m) => m[1]);
  assert.ok(paths.length >= 12, 'read the vertical route map');
  for (const p of new Set(paths)) {
    assert.equal(isKnownPath(p), true, `${p} must not answer 404`);
  }
});

test('the Link header is set by middleware, so legal/SEO pages carry it too', () => {
  const src = readFileSync(new URL('../server/index.ts', import.meta.url), 'utf8');
  assert.ok(src.includes('res.setHeader(\'Link\''), 'a global middleware sets Link');
  assert.ok(src.includes("startsWith('/api')"), 'api responses are skipped');
});

// OWNER 9 Nov (second pass): "Page has a clear heading hierarchy - found 3 <h1>" and
// "Organization schema is missing telephone, address".
test('exactly one h1 can reach a page: the shell loader and prerender loader are demoted', () => {
  const shell = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
  assert.equal((shell.match(/<h1[\s>]/g) || []).length, 0, 'the SPA shell carries no h1 at all');
  assert.ok(shell.includes('role="heading" aria-level="2"'), 'the splash title is an h2-level heading');
  const render = readFileSync(new URL('../server/seo/render.ts', import.meta.url), 'utf8');
  const blocks = render.split('function prerenderLoader')[1]?.split('function prerenderBody')[0] || '';
  assert.ok(!blocks.includes('<h1'), 'the prerender loader must not open a second h1');
  assert.ok(render.includes('<h1 style="font-size:26px'), 'the page body keeps the single h1');
});

test('the Organization node publishes a telephone and a postal address', () => {
  const src = readFileSync(new URL('../server/seo/render.ts', import.meta.url), 'utf8');
  assert.ok(src.includes('telephone: BUSINESS_TELEPHONE'));
  assert.ok(src.includes('address: BUSINESS_ADDRESS'));
  assert.equal(BUSINESS_TELEPHONE, '+917389654447');
  assert.equal(BUSINESS_ADDRESS.addressLocality, 'Indore');
  assert.equal(BUSINESS_ADDRESS.postalCode, '452012');
  assert.equal(BUSINESS_ADDRESS.addressCountry, 'IN');
  const card: any = serverCard();
  assert.equal(card.contact.telephone, BUSINESS_TELEPHONE);
  assert.equal(card.contact.address.postalCode, '452012');
});
