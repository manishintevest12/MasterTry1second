/**
 * Server-rendered editorial guide pages (/guides and /guides/<slug>).
 *
 * Written for the AdSense "low value content" review: a comparison app that only republishes
 * partner prices reads as thin content, so these pages carry original explanatory copy, Article +
 * FAQ structured data, a visible "last updated" date and internal links into the matching vertical.
 * These routes carry NO ad code at all: the only ad surface on Try1Second is the AdSense interstitial
 * on an outbound exit, never a unit next to thin or empty content, which is what Google's content
 * policy asks for.
 */
import { GUIDES, GUIDE_BY_SLUG, type Guide } from './guides';

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const STYLE = `
:root{--ink:#0f172a;--muted:#5b6473;--line:#e5e7eb;--brand:#f97316}
*{box-sizing:border-box}
body{margin:0;background:#fff;color:var(--ink);font:16px/1.7 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
header{border-bottom:1px solid var(--line);padding:14px 20px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
header a.brand{font-weight:800;text-decoration:none;color:var(--ink);font-size:17px}
header a.brand span{color:var(--brand)}
header .spacer{flex:1}
header nav a{color:var(--muted);text-decoration:none;font-size:14px;margin-left:14px;white-space:nowrap}
header nav a:hover{color:var(--brand)}
main{max-width:780px;margin:0 auto;padding:28px 20px 56px}
h1{font-size:27px;line-height:1.25;margin:0 0 6px}
h2{font-size:19px;margin:28px 0 8px}
p{margin:12px 0;color:#1f2937}
ul{margin:10px 0 18px;padding-left:22px}
li{margin:7px 0;color:#1f2937}
.meta{color:var(--muted);font-size:13px;margin:0 0 18px}
.lede{font-size:17px;color:#111827;margin:0 0 20px}
.cta{display:inline-block;margin:6px 0 4px;background:var(--brand);color:#fff;text-decoration:none;font-weight:700;padding:10px 16px;border-radius:10px}
.card{border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin:12px 0}
.card h3{margin:0 0 4px;font-size:16px}
.card a{color:var(--brand);text-decoration:none;font-weight:600}
.card p{margin:4px 0 0;font-size:14px;color:var(--muted)}
footer{border-top:1px solid var(--line);padding:18px 20px 34px;color:var(--muted);font-size:13px;text-align:center}
footer a{color:var(--muted);text-decoration:none;margin:0 6px}
`;

const head = (title: string, description: string, canonical: string, extra = ''): string => `<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<link rel="canonical" href="${esc(canonical)}" />
<meta name="robots" content="index,follow,max-image-preview:large" />
<meta property="og:type" content="article" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${esc(canonical)}" />
<style>${STYLE}</style>
${extra}</head>`;

const nav = (): string => `<header>
  <a class="brand" href="/">Try1<span>Second</span></a>
  <span class="spacer"></span>
  <nav><a href="/">Compare prices</a><a href="/guides">Guides</a><a href="/about">About</a><a href="/contact">Contact</a></nav>
</header>`;

const footer = (): string => `<footer>
  <p><a href="/guides">All guides</a><a href="/answers">Compare answers (all verticals &amp; states)</a><a href="/about">About</a><a href="/privacy-policy">Privacy</a><a href="/terms">Terms</a><a href="/affiliate-disclosure">Affiliate disclosure</a><a href="/faq">FAQ</a><a href="/contact">Contact</a></p>
  <p>Try1Second is a metasearch engine. We compare prices; the purchase and its terms belong to the partner you choose.</p>
</footer>`;

function blocksHtml(g: Guide): string {
  return g.blocks
    .map((b) => {
      if (b.t === 'ul') return `<ul>${b.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
      if (b.t === 'p') return `<p>${esc(b.x)}</p>`;
      return `<${b.t}>${esc(b.x)}</${b.t}>`;
    })
    .join('\n');
}

function faqJsonLd(g: Guide): string {
  // Only real questions answered in the guide become FAQPage entries; nothing is invented.
  const qa = g.blocks.filter((b): b is { t: 'h2'; x: string } => b.t === 'h2' && b.x.includes('?'));
  if (!qa.length) return '';
  const entries = qa.map((q) => {
    const src = g.blocks[g.blocks.indexOf(q) + 1];
    const answer = src
      ? src.t === 'p'
        ? src.x
        : src.t === 'ul'
          ? src.items.join(' ')
          : g.description
      : g.description;
    return {
      '@type': 'Question',
      name: q.x,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    };
  });
  return `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entries,
  })}</script>\n`;
}

function articleJsonLd(g: Guide, origin: string): string {
  return `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: g.headline,
    description: g.description,
    dateModified: g.updated,
    datePublished: g.updated,
    inLanguage: 'en-IN',
    mainEntityOfPage: `${origin}/guides/${g.slug}`,
    author: { '@type': 'Organization', name: 'Try1Second' },
    publisher: { '@type': 'Organization', name: 'Try1Second', url: origin },
  })}</script>\n`;
}

export function renderGuidePage(slug: string, origin: string): string | undefined {
  const g = GUIDE_BY_SLUG[slug];
  if (!g) return undefined;
  const canonical = `${origin}/guides/${slug}`;
  const related = GUIDES.filter((x) => x.slug !== slug).slice(0, 3);
  const verticalLinks = g.verticals
    .map((v) => `<a class="cta" href="/${v}">Compare ${esc(v)} prices</a>`)
    .join(' ');
  return `${head(g.title, g.description, canonical, articleJsonLd(g, origin) + faqJsonLd(g))}
<body>
${nav()}
<main>
<h1>${esc(g.title)}</h1>
<p class="meta">Try1Second editorial · Updated ${esc(g.updated)} · ${g.verticals.length} vertical${g.verticals.length > 1 ? 's' : ''} covered</p>
<p class="lede">${esc(g.headline)} — ${esc(g.description)}</p>
${blocksHtml(g)}
<p>${verticalLinks}</p>
<h2>More buying guides</h2>
${related
  .map(
    (r) =>
      `<div class="card"><h3><a href="/guides/${r.slug}">${esc(r.title)}</a></h3><p>${esc(r.description)}</p></div>`,
  )
  .join('')}
</main>
${footer()}
</body>
</html>`;
}

export function renderGuidesIndex(origin: string): string {
  const canonical = `${origin}/guides`;
  return `${head(
    'Buying Guides: What Comparison Prices Leave Out — Try1Second',
    'Practical guides to Indian price comparison: flight fare rules, hotel charges, cab surge, quick-commerce fees, food delivery costs and cinema ticket fees.',
    canonical,
  )}
<body>
${nav()}
<main>
<h1>Buying guides</h1>
<p class="meta">Try1Second editorial · ${GUIDES.length} guides · Updated ${GUIDES[0]?.updated || ''}</p>
<p class="lede">Every guide explains how a price is built, which fees the headline number leaves out, and what to check before you pay. We write these from the mechanics of each marketplace, not from sponsored placements.</p>
${GUIDES.map(
  (g) =>
    `<div class="card"><h3><a href="/guides/${g.slug}">${esc(g.title)}</a></h3><p>${esc(g.description)}</p></div>`,
).join('\n')}
</main>
${footer()}
</body>
</html>`;
}

export const GUIDE_SLUGS = GUIDES.map((g) => g.slug);
