/**
 * Server-rendered legal / support pages.
 *
 * AdSense reviewers look at /privacy-policy, /terms, /about and /contact before approving a site.
 * Until now all four answered the SPA shell (27 words, homepage title), so the site looked like it
 * had no policies at all even though the copy existed inside the app's InfoAndLegalModal. These
 * routes serve the same approved copy as plain, fast, crawlable HTML with a real <title>,
 * description, canonical and cross-links.
 *
 * Deliberately dependency-free styling (a small inline stylesheet) so a page still renders if the
 * hashed asset bundle is being rebuilt, and so the brand's Tailwind build is untouched.
 */
import { LEGAL_PAGES, LEGAL_SLUGS, type LegalPage } from './legalContent';

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const NAV_LABEL: Record<string, string> = {
  about: 'About',
  'privacy-policy': 'Privacy',
  terms: 'Terms',
  'affiliate-disclosure': 'Affiliate Disclosure',
  faq: 'FAQ',
  contact: 'Contact',
};

function blocksHtml(page: LegalPage): string {
  const out: string[] = [];
  let inList = false;
  const closeList = () => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  };
  let seenFirstHeading = false;
  for (const b of page.blocks) {
    if (b.t === 'li') {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${esc(b.x)}</li>`);
      continue;
    }
    closeList();
    if (b.t === 'p') out.push(`<p>${esc(b.x)}</p>`);
    else {
      // The first heading of the tab is the page's own H1; everything else steps down.
      if (!seenFirstHeading) {
        out.push(`<h1>${esc(b.x)}</h1>`);
        seenFirstHeading = true;
      } else out.push(`<h2>${esc(b.x)}</h2>`);
    }
  }
  closeList();
  return out.join('\n');
}

export function renderLegalPage(slug: string, origin: string): string | undefined {
  const page = LEGAL_PAGES[slug];
  if (!page) return undefined;
  const canonical = `${origin}/${slug}`;
  const others = LEGAL_SLUGS.filter((s) => s !== slug)
    .map((s) => `<a href="/${s}">${NAV_LABEL[s] || s}</a>`)
    .join(' · ');
  return `<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(page.title)}</title>
<meta name="description" content="${esc(page.description)}" />
<link rel="canonical" href="${esc(canonical)}" />
<meta name="robots" content="index,follow,max-image-preview:large" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${esc(page.title)}" />
<meta property="og:description" content="${esc(page.description)}" />
<meta property="og:url" content="${esc(canonical)}" />
<style>
:root{--ink:#0f172a;--muted:#5b6473;--line:#e5e7eb;--brand:#f97316}
*{box-sizing:border-box}
body{margin:0;background:#fff;color:var(--ink);font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
header{border-bottom:1px solid var(--line);padding:14px 20px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
header a.brand{font-weight:800;text-decoration:none;color:var(--ink);font-size:17px}
header a.brand span{color:var(--brand)}
header .spacer{flex:1}
header nav a{color:var(--muted);text-decoration:none;font-size:14px;margin-left:14px;white-space:nowrap}
header nav a:hover{color:var(--brand)}
main{max-width:760px;margin:0 auto;padding:28px 20px 56px}
h1{font-size:26px;line-height:1.25;margin:0 0 6px}
h2{font-size:18px;margin:26px 0 8px}
p{margin:12px 0;color:#1f2937}
ul{margin:10px 0 18px;padding-left:22px}
li{margin:6px 0;color:#1f2937}
table{border-collapse:collapse}
footer{border-top:1px solid var(--line);padding:18px 20px 34px;color:var(--muted);font-size:13px;text-align:center}
footer a{color:var(--muted);text-decoration:none;margin:0 6px}
footer a:hover{color:var(--brand)}
.updated{color:var(--muted);font-size:13px;margin:0 0 18px}
</style>
</head>
<body>
<header>
  <a class="brand" href="/">Try1<span>Second</span></a>
  <span class="spacer"></span>
  <nav><a href="/">Compare prices</a>${LEGAL_SLUGS.filter((s) => s !== slug)
    .slice(0, 4)
    .map((s) => `<a href="/${s}">${NAV_LABEL[s] || s}</a>`)
    .join('')}</nav>
</header>
<main>
<p class="updated">Last updated: November 2026 · Try1Second is an Indian metasearch engine, not a merchant.</p>
${blocksHtml(page)}
</main>
<footer>
  <p>${others}</p>
  <p>© ${new Date().getFullYear()} Try1Second · <a href="/">www.try1second.com</a> · Questions? <a href="/contact">Contact support</a></p>
</footer>
</body>
</html>`;
}

/** Path aliases the AdSense reviewer may try (Google's own checklist names /privacy and /terms). */
export const LEGAL_ALIASES: Record<string, string> = {
  '/privacy': 'privacy-policy',
  '/privacy-policy': 'privacy-policy',
  '/terms': 'terms',
  '/terms-of-service': 'terms',
  '/disclaimer': 'terms',
  '/about': 'about',
  '/about-us': 'about',
  '/contact': 'contact',
  '/contact-us': 'contact',
  '/faq': 'faq',
  '/affiliate-disclosure': 'affiliate-disclosure',
};
