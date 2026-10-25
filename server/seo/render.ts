/**
 * Try1Second — SEO HTML enhancer.
 *
 * The site is an SPA, so by default every URL serves the same index.html —
 * crawlers saw one title for the whole site. This module rewrites the shell
 * per URL at serve time:
 *   - unique <title>, meta description, canonical, OG/Twitter tags per path
 *   - JSON-LD structured data (Organization / WebSite / Breadcrumb / FAQ)
 *   - a server-rendered content block inside #root that React replaces on
 *     hydration (Googlebot and link previews read it; users get the app).
 */
import { resolveSeoPage, listSeoPaths, SEO_HOST } from './data';

const esc = (s: string) => s
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function jsonLd(path: string): string[] {
  const page = resolveSeoPage(path);
  const blocks: string[] = [];
  const org = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Try1Second',
    url: SEO_HOST,
    logo: `${SEO_HOST}/logo-icon.webp`,
    description: 'Independent metasearch engine comparing live prices across flights, hotels, bus, shopping, grocery, food, movies, loans, insurance, cabs, cards and banking in India.',
  };
  blocks.push(JSON.stringify(org));
  if (path === '/') {
    blocks.push(JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Try1Second',
      url: SEO_HOST,
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: `${SEO_HOST}/#vertical=ecommerce&q={search_term_string}` },
        'query-input': 'required name=search_term_string',
      },
    }));
  }
  if (page) {
    blocks.push(JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: page.title,
      description: page.description,
      url: `${SEO_HOST}${page.path}`,
    }));
    if (page.breadcrumbs.length > 1) {
      blocks.push(JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: page.breadcrumbs.map((b, i) => ({
          '@type': 'ListItem', position: i + 1, name: b.name, item: `${SEO_HOST}${b.path}`,
        })),
      }));
    }
    if (page.faqs.length) {
      blocks.push(JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: page.faqs.map((f) => ({
          '@type': 'Question', name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      }));
    }
  }
  return blocks;
}

function prerenderBody(path: string): string {
  const page = resolveSeoPage(path);
  if (!page) return '';
  const faqHtml = page.faqs.map((f) => `
    <dt>${esc(f.q)}</dt><dd>${esc(f.a)}</dd>`).join('');
  const links = page.links.slice(0, 10).map((l) =>
    `<a href="${esc(l.href)}">${esc(l.label)}</a>`).join('');
  return [
    `<section style="font-family:system-ui,sans-serif;max-width:720px;margin:0 auto;padding:24px 16px 40px">`,
    `<nav aria-label="Breadcrumb" style="font-size:12px;color:#6b7280;margin-bottom:8px">`,
    page.breadcrumbs.map((b, i) => (i ? ' &rsaquo; ' : '') + (i === page.breadcrumbs.length - 1
      ? esc(b.name)
      : `<a href="${esc(b.path)}" style="color:#6b7280">${esc(b.name)}</a>`)).join(''),
    `</nav>`,
    `<h1 style="font-size:26px;line-height:1.2;margin:0 0 12px">${esc(page.h1)}</h1>`,
    ...page.intro.map((p) => `<p style="font-size:14.5px;line-height:1.65;color:#374151;margin:0 0 12px">${esc(p)}</p>`),
    `<h2 style="font-size:15px;margin:20px 0 8px">Frequently asked questions</h2>`,
    `<dl style="font-size:13.5px;line-height:1.6;color:#374151">${faqHtml}</dl>`,
    links ? `<h2 style="font-size:15px;margin:20px 0 8px">Popular comparisons</h2><p style="font-size:13px;line-height:2">${links}</p>` : '',
    `<p style="font-size:13px;color:#6b7280;margin-top:24px">Try1Second is an independent metasearch engine — live prices, lowest first, direct links to the seller. <a href="/" style="color:#dc2626;font-weight:600">Open the live comparison app</a> &middot; <a href="/about" style="color:#6b7280">About</a> &middot; <a href="/privacy" style="color:#6b7280">Privacy</a>.</p>`,
    `</section>`,
  ].join('');
}

const DEFAULT_TITLE = 'Try1Second — One Second Is All It Takes to Find the Lowest Price';
const DEFAULT_DESC = 'Compare live prices across flights, hotels, bus, shopping, grocery, food, movies, loans, insurance, cabs, cards and banking in one second.';

/**
 * Rewrite the SPA index.html for a URL. Falls back to the default shell for
 * non-SEO paths (e.g. /admin). `noindex` paths (admin/merchant) get an
 * explicit robots noindex so they never enter the index.
 */
export function enhanceHtml(html: string, path: string): string {
  const page = resolveSeoPage(path);
  const isNoindex = /^\/(admin|merchant|api)/.test(path);
  const title = page ? page.title : DEFAULT_TITLE;
  const desc = page ? page.description : DEFAULT_DESC;
  const canonical = `${SEO_HOST}${(path || '/').split('?')[0].replace(/\/+$/, '') || '/'}`;

  let out = html;

  // 1. Unique title + description (replace the static ones)
  out = out.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`);
  out = out.replace(/<meta name="description" content="[^"]*" \/>/,
    `<meta name="description" content="${esc(desc)}" />`);
  out = out.replace(/<meta property="og:title" content="[^"]*" \/>/,
    `<meta property="og:title" content="${esc(title)}" />`);
  out = out.replace(/<meta property="og:description" content="[^"]*" \/>/,
    `<meta property="og:description" content="${esc(desc)}" />`);

  // 2. Per-path SEO head block
  const head: string[] = [
    `<link rel="canonical" href="${esc(canonical)}" />`,
    `<meta property="og:url" content="${esc(canonical)}" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(desc)}" />`,
    `<meta name="robots" content="${isNoindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1'}" />`,
    `<meta name="geo.region" content="IN" />`,
    `<meta name="geo.placename" content="India" />`,
    `<meta property="og:site_name" content="Try1Second" />`,
    `<meta property="og:locale" content="en_IN" />`,
    `<meta property="og:image" content="${SEO_HOST}/og-image.jpg" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="Try1Second — live price comparison across flights, hotels, cabs, groceries and finance in India" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:image" content="${SEO_HOST}/og-image.jpg" />`,
    `<link rel="alternate" hreflang="en-in" href="${esc(canonical)}" />`,
    `<link rel="alternate" hreflang="x-default" href="${esc(canonical)}" />`,
  ];
  if (!isNoindex) for (const b of jsonLd(path)) head.push(`<script type="application/ld+json">${b}</script>`);
  out = out.replace('</head>', `${head.join('\n')}\n</head>`);

  // 3. Prerendered content into #root (React replaces it on hydration)
  if (!isNoindex) {
    const body = prerenderBody(path);
    if (body) {
      out = out.replace(/<div id="root"><\/div>/, `<div id="root">${body}</div>`);
      // Keep splash short for deep links: content is already painted.
    }
  }
  return out;
}

export { listSeoPaths };
