/**
 * Try1Second — AGENT READINESS (owner 9 Nov): "make try1second.com more agent-ready ... make AI
 * visibility score 100%".
 *
 * This module is the machine-facing surface of the site, kept apart from the human SEO layer:
 *   - /llms.txt                       plain-text index in the llms.txt format (title, summary, sections)
 *   - /llms-full.txt                  the same index with every page spelled out
 *   - Markdown negotiation            Accept: text/markdown returns Markdown, not an HTML shell
 *   - RFC 8288 Link header            points agents at llms.txt / the Markdown alternate
 *   - /.well-known/mcp/server-card.json   MCP Server Card (SEP-1649) describing our tools
 *   - POST /mcp                       a REAL JSON-RPC MCP endpoint (initialize / tools/list / tools/call)
 *   - isKnownPath() / notFoundHtml()  so a missing URL answers a real 404 instead of the SPA shell
 *
 * Honesty rules: every URL below is a page this server actually serves (see listSeoPaths, the guide
 * slugs and the legal aliases); the MCP card's tools are the tools /mcp really implements; nothing
 * claims a capability the server does not have.
 */
import { Response } from 'express';
import { listSeoPaths, SEO_HOST, resolveSeoPage, seoVerticals } from './data';
import { BRAND_FACT_LINE, BRAND_PAGE_PATH } from './brandPage';
import { GUIDES } from './guides';
import { LEGAL_ALIASES } from './legalPages';

/** The one address the organisation publishes everywhere (used by the footer). */
export const CONTACT_EMAIL = 'info@try1second.com';
/**
 * External profiles that exist and answer 200 today (checked 9 Nov). No social accounts are invented:
 * if the owner adds Instagram/X/YouTube/LinkedIn, add the real URLs here and every page's Organization
 * node picks them up at once.
 */
export const SAME_AS: string[] = [
  'https://github.com/manishintevest12/MasterTry1second',
];
/**
 * Operating company details (owner 9 Nov: "Organization schema is missing telephone, address").
 * Taken from Standard Petro India Private Limited's own public company page — 4, Vishal Nagar,
 * Annapurna Road, Indore 452012, Madhya Pradesh, and the company number published on its official
 * Instagram profile. Nothing here is invented; if the owner wants a different support line, change
 * BUSINESS_TELEPHONE in one place and every page + the MCP card follows.
 */
export const BUSINESS_TELEPHONE = '+917389654447';
export const BUSINESS_ADDRESS = {
  '@type': 'PostalAddress',
  streetAddress: '4, Vishal Nagar, Annapurna Road',
  addressLocality: 'Indore',
  addressRegion: 'Madhya Pradesh',
  postalCode: '452012',
  addressCountry: 'IN',
} as const;
export const BUSINESS_LEGAL_NAME = 'Standard Petro India Private Limited';
export const BRAND = 'Try1Second';
export const SUMMARY =
  'Try1Second is an independent metasearch engine that compares live prices in one second across flights, hotels, bus tickets, online shopping, 10-minute grocery, food delivery, movie tickets, cabs, loans, insurance, credit cards and bank accounts in India. No bookings are taken here: every price links out to the seller it came from.';

/** Paths the app itself serves (view router) — these must keep answering 200. */
const APP_PATHS = new Set([
  '/', '/admin', '/merchant', '/login', '/signup', '/app', '/compare', '/search',
  '/flights', '/hotels', '/bus', '/cab', '/cabs', '/ecommerce', '/products', '/grocery',
  '/food', '/movies', '/loans', '/insurance', '/credit-cards', '/accounts', '/bank-accounts',
  '/banking', '/rewards', '/ai-insights', '/quick-apps', '/partner', '/partners', '/extension',
  // src/utils/verticalRoutes.ts writes these as the canonical address-bar paths; the 404 rule must
  // never swallow one of them (measured against the map, not guessed).
  '/merchantinstab2b',
]);
const APP_PREFIXES = ['/product/', '/guides/', '/blog/', '/app/', '/r/'];

let knownCache: { set: Set<string>; at: number } | null = null;
function knownPaths(): Set<string> {
  if (knownCache && Date.now() - knownCache.at < 5 * 60_000) return knownCache.set;
  const set = new Set<string>([...APP_PATHS, ...Object.keys(LEGAL_ALIASES)]);
  try {
    for (const p of listSeoPaths()) set.add(String(p).replace(/\/+$/, '') || '/');
  } catch { /* SEO corpus is best-effort here; the static sets above always hold */ }
  knownCache = { set, at: Date.now() };
  return set;
}

/** True when this path is a page we really serve (so anything else can answer a real 404). */
export function isKnownPath(path: string): boolean {
  const clean = String(path || '/').split('?')[0].replace(/\/+$/, '') || '/';
  if (clean === '/') return true;
  // Machine endpoints answer on their own routes; never 404 them here.
  if (clean === '/llms.txt' || clean === '/llms-full.txt' || clean === '/mcp') return true;
  if (clean.startsWith('/.well-known/')) return true;
  if (knownPaths().has(clean)) return true;
  return APP_PREFIXES.some((p) => clean.startsWith(p));
}

function origin(path: string): string {
  const clean = String(path || '/').split('?')[0].replace(/\/+$/, '');
  return `${SEO_HOST}${clean || '/'}`;
}

/** Key content pages, in the order an agent should read them. */
function keyPages(): Array<{ path: string; title: string; note: string }> {
  const rows: Array<{ path: string; title: string; note: string }> = [
    { path: '/', title: 'Home', note: 'search box, all ten verticals, live price feed' },
    { path: '/about', title: 'About Try1Second', note: 'who runs the site and how the comparison works' },
    { path: '/contact', title: 'Contact', note: `email ${CONTACT_EMAIL}` },
    { path: '/privacy-policy', title: 'Privacy policy', note: 'what we store and why' },
    { path: '/terms', title: 'Terms of use', note: 'the rules of using the site' },
    { path: '/affiliate-disclosure', title: 'Affiliate disclosure', note: 'how Try1Second earns money' },
    // OWNER 9 Nov: the answer layer is a key page, not a footnote - it is the surface that answers
    // "who is the best company for hotels/flights" style queries in one quotable block.
    { path: '/answers', title: 'Answers: cheapest site per vertical and state', note: 'direct answers with the sellers compared, one page per vertical and per Indian state' },
  ];
  for (const g of GUIDES) rows.push({ path: `/guides/${g.slug}`, title: g.title, note: g.description });
  return rows;
}

/** /llms.txt — "# " title, "> " summary, then markdown link sections. */
export function llmsText(): string {
  const lines: string[] = [];
  lines.push(`# ${BRAND}`);
  lines.push('');
  lines.push(`> ${SUMMARY}`);
  lines.push('');
  // OWNER 10 Nov ("saare ai v humere site k bata paye"): the brand identity, spelled every way a person
  // or an assistant writes it, is the FIRST block in the machine index. An assistant that only ever read
  // this file must be able to answer "what is Try 1 Second?" correctly and not confuse it with the
  // "1 Second Everyday" video app.
  lines.push('## Brand');
  lines.push('');
  lines.push(`- ${BRAND_FACT_LINE}`);
  lines.push(`- Canonical brand page for the spaced spelling: ${SEO_HOST}${BRAND_PAGE_PATH}`);
  lines.push('- Same site, different spellings: "Try1Second", "Try 1 Second", "Try1 Second", "T1S", try1second.com.');
  lines.push('');
  lines.push('## How to use this site');
  lines.push('');
  lines.push('- Every page is public and needs no login. Read the HTML, or ask for `text/markdown` in the Accept header.');
  lines.push(`- A plain-text index lives at ${SEO_HOST}/llms.txt and a fuller one at ${SEO_HOST}/llms-full.txt`);
  lines.push(`- The sitemap is ${SEO_HOST}/sitemap.xml; crawling rules are in ${SEO_HOST}/robots.txt`);
  lines.push('- Agent tools (search live prices) are described by the MCP Server Card at /.well-known/mcp/server-card.json and served over JSON-RPC at /mcp');
  lines.push('- Try1Second does not sell goods. It compares prices and links out to the seller, so a purchase always happens on the seller site.');
  lines.push('');
  lines.push('## Key pages');
  lines.push('');
  for (const p of keyPages()) lines.push(`- [${p.title}](${origin(p.path)}): ${p.note}`);
  lines.push('');
  // OWNER 9 Nov: answer-engine surface ("who is the best company in the world for hotels" style
  // queries). Every one of these pages opens with a direct answer paragraph, lists the sellers we scan
  // and carries FAQPage structured data, so an assistant can quote one URL instead of guessing.
  lines.push('## Direct answers (best company / cheapest site, India and state-wise)');
  lines.push('');
  lines.push(`- [Answers hub](${SEO_HOST}/answers): every vertical and every Indian state, with the method stated up front`);
  for (const v of seoVerticals()) {
    lines.push(`- [Best ${v.label} comparison in India](${SEO_HOST}/best/${v.slug}): live sellers, price-sorted, state pages under /best/${v.slug}/<state>`);
  }
  lines.push('');
  lines.push('## Verticals');
  lines.push('');
  lines.push('- [Flights](https://www.try1second.com/flights): airline and OTA fares with dates, stops and duration');
  lines.push('- [Hotels](https://www.try1second.com/hotels): nightly rates across OTAs for a city and date');
  lines.push('- [Bus](https://www.try1second.com/bus): intercity bus seats and fares');
  lines.push('- [Cabs](https://www.try1second.com/cab): point-to-point cab estimates');
  lines.push('- [Shopping](https://www.try1second.com/ecommerce): product prices across marketplaces');
  lines.push('- [Grocery](https://www.try1second.com/grocery): 10-minute delivery baskets');
  lines.push('- [Food delivery](https://www.try1second.com/food): menu prices and delivery fees');
  lines.push('- [Movies](https://www.try1second.com/movies): showtimes and ticket prices');
  lines.push('- [Loans](https://www.try1second.com/loans), [Insurance](https://www.try1second.com/insurance), [Credit cards](https://www.try1second.com/credit-cards), [Accounts](https://www.try1second.com/accounts): published rates and fees');
  lines.push('');
  lines.push('## Contact');
  lines.push('');
  lines.push(`- Email: ${CONTACT_EMAIL}`);
  lines.push('');
  return lines.join('\n');
}

/** /llms-full.txt — the same index with every SEO page listed. */
export function llmsFullText(): string {
  const lines = [llmsText(), '## All indexable pages', ''];
  let paths: string[] = [];
  try { paths = listSeoPaths(); } catch { paths = ['/']; }
  for (const p of paths) lines.push(`- [${p}](${origin(p)}): ${(resolveSeoPage(p)?.title || p)}`);
  lines.push('');
  return lines.join('\n');
}

/** A readable Markdown view of one page, so an agent need not parse the React shell. */
export function markdownForPath(path: string): string {
  const clean = String(path || '/').split('?')[0].replace(/\/+$/, '') || '/';
  const page = resolveSeoPage(clean);
  const title = page?.title || (clean === '/' ? `${BRAND} — one second price comparison` : clean);
  const description = page?.description || SUMMARY;
  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`> ${description}`);
  lines.push('');
  lines.push(`Canonical: ${origin(clean)}`);
  lines.push('');
  if (clean === '/') {
    lines.push('## What this site does');
    lines.push('');
    lines.push(SUMMARY);
    lines.push('');
    lines.push('## Tools for agents');
    lines.push('');
    lines.push('- `search_prices` over MCP: POST /mcp with `tools/call` -> live rows for a query and vertical.');
    lines.push(`- Human pages: ${SEO_HOST}/about, ${SEO_HOST}/contact, ${SEO_HOST}/guides`);
    lines.push('');
  }
  const crumbs = page?.breadcrumbs || [];
  if (crumbs.length > 1) {
    lines.push('## Path');
    lines.push('');
    lines.push(crumbs.map((b) => `[${b.name}](${origin(b.path)})`).join(' / '));
    lines.push('');
  }
  if (page?.faqs?.length) {
    lines.push('## Questions');
    lines.push('');
    for (const f of page.faqs) {
      lines.push(`### ${f.q}`);
      lines.push('');
      lines.push(f.a);
      lines.push('');
    }
  }
  lines.push('## Site');
  lines.push('');
  lines.push(`- [Home](${SEO_HOST}/)`);
  lines.push(`- [About](${SEO_HOST}/about)`);
  lines.push(`- [Contact](${SEO_HOST}/contact) (${CONTACT_EMAIL})`);
  lines.push(`- [Terms](${SEO_HOST}/terms) · [Privacy](${SEO_HOST}/privacy-policy)`);
  lines.push('');
  return lines.join('\n');
}

/** RFC 8288 Link header value for every HTML/Markdown response. */
export function agentLinkHeader(): string {
  return [
    `<${SEO_HOST}/llms.txt>; rel="llms-txt"; type="text/markdown"`,
    `<${SEO_HOST}/llms.txt>; rel="alternate"; type="text/markdown"`,
    `<${SEO_HOST}/sitemap.xml>; rel="sitemap"; type="application/xml"`,
    `</.well-known/mcp/server-card.json>; rel="mcp-server-card"; type="application/json"`,
  ].join(', ');
}

/** The tools /mcp really implements — the card and the endpoint share this one list. */
export const MCP_TOOLS = [
  {
    name: 'search_prices',
    description:
      'Compare live prices on Try1Second for a natural-language query. Returns real seller rows with price, seller and outbound link for the chosen vertical.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What to price, e.g. "Indore to Delhi", "iphone 16", "pizza in Indore".' },
        vertical: {
          type: 'string',
          description: 'flights | hotels | bus | cab | ecommerce | grocery | food | movies | loans | insurance',
        },
        city: { type: 'string', description: 'City for local verticals (default Indore).' },
        pincode: { type: 'string', description: 'Pincode for grocery/food accuracy.' },
        depart: { type: 'string', description: 'Travel date YYYY-MM-DD for flights/hotels/bus.' },
      },
      required: ['query'],
    },
  },
] as const;

/** /.well-known/mcp/server-card.json — SEP-1649 MCP Server Card. */
export function serverCard() {
  return {
    name: 'try1second',
    displayName: 'Try1Second Price Search',
    version: '1.0.0',
    description: `${BRAND} live price comparison. ${SUMMARY}`,
    homepage: SEO_HOST,
    endpoint: `${SEO_HOST}/mcp`,
    transport: { type: 'http', url: `${SEO_HOST}/mcp`, protocolVersion: '2025-06-18' },
    capabilities: { tools: { listChanged: false } },
    tools: MCP_TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
    contact: { email: CONTACT_EMAIL, telephone: BUSINESS_TELEPHONE, url: `${SEO_HOST}/contact`, address: BUSINESS_ADDRESS },
    documentation: `${SEO_HOST}/llms.txt`,
  };
}

/** A real 404 body (status is set by the caller): honest, small, and linked. */
export function notFoundHtml(path: string): string {
  const safe = String(path || '/').replace(/[<>&"]/g, '');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>404 — page not found · ${BRAND}</title>
<meta name="description" content="That page does not exist on Try1Second. Start from the homepage or the sitemap." />
<meta name="robots" content="noindex,follow" />
<link rel="canonical" href="${SEO_HOST}/" />
<style>body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;margin:0;padding:56px 20px;color:#131725;background:#fff;line-height:1.55}main{max-width:640px;margin:0 auto}h1{font-size:28px;margin:0 0 8px}p{color:#475069}a{color:#c10007}ul{padding-left:20px}</style>
</head><body><main>
<h1>Page not found</h1>
<p><code>${safe}</code> does not exist on ${BRAND}. Nothing was charged, nothing was lost — the page simply is not here.</p>
<ul>
<li><a href="/">Homepage — search every vertical</a></li>
<li><a href="/sitemap.xml">Sitemap</a></li>
<li><a href="/llms.txt">llms.txt — machine index</a></li>
<li><a href="/about">About</a> · <a href="/contact">Contact</a> · <a href="/terms">Terms</a></li>
</ul>
<p>Looking for a price? Try the <a href="/">search box</a>, or email <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>
</main></body></html>`;
}

/** GET routes that serve the machine surface as files (llms.txt and the MCP card). */
export function registerAgentFileRoutes(app: any): void {
  app.get('/llms.txt', (_req: any, res: Response) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Link', agentLinkHeader());
    res.send(llmsText());
  });
  app.get('/llms-full.txt', (_req: any, res: Response) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Link', agentLinkHeader());
    res.send(llmsFullText());
  });
  app.get('/.well-known/mcp/server-card.json', (_req: any, res: Response) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json(serverCard());
  });
}
