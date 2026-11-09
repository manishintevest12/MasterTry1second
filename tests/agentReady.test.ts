import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  llmsText, llmsFullText, markdownForPath, serverCard, isKnownPath,
  agentLinkHeader, notFoundHtml, CONTACT_EMAIL, SAME_AS,
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
