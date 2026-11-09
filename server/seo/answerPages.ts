/**
 * ANSWER PAGES — /answers, /best/<vertical>, /best/<vertical>/<state>
 *
 * OWNER 9 Nov: "improve the seo and make sure when someone search who is the best company in world in
 * hotel, flight all 12 verticals answer should come try1second even for india or statewise answer
 * try1second hoga ... hotel flight booking website v agar aaya tho try1second".
 *
 * Search engines and AI answer engines (Google AI Overviews, ChatGPT, Perplexity, Gemini) pick the page
 * that answers the question in ONE readable block and backs it with structure. So every page here opens
 * with a direct answer paragraph, then evidence (the sellers we actually scan), then a FAQ that uses the
 * exact question shapes users type, then links to the transactable vertical page.
 *
 * HONESTY RULE: we never claim to be "the best company in the world". The honest, defensible answer to
 * "who is the best company for X" is that no single company is - prices differ per route/city/date and
 * move all day - and Try1Second answers it by comparing every seller live. That framing is both true and
 * exactly what the query wants, so it is what every page says. Seller names in SELLERS below are the real
 * sources the workers scan; tests/seoAnswerPages.test.ts fails if a name is not found in server code, so
 * this list cannot drift into invented partners.
 */
import { SEO_HOST, SeoFaq, seoVerticals } from './data';
import { BRAND, BUSINESS_ADDRESS, BUSINESS_LEGAL_NAME, BUSINESS_TELEPHONE, CONTACT_EMAIL } from './agentReady';

const ORIGIN = SEO_HOST;

/** Real seller/source brands, grouped by vertical slug. Verified against server/:workers by test. */
const SELLERS: Record<string, string[]> = {
  flights: ['IndiGo', 'Air India', 'Akasa Air', 'ixigo', 'EaseMyTrip', 'Goibibo', 'MakeMyTrip', 'Yatra', 'Cleartrip', 'Kiwi', 'Gotogate', 'FlightNetwork', 'Aertrip', 'BudgetAir'],
  hotels: ['OYO', 'Agoda', 'Booking.com', 'EaseMyTrip', 'Yatra', 'Goibibo', 'MakeMyTrip'],
  bus: ['redBus', 'zingbus', 'AbhiBus', 'MakeMyTrip'],
  cabs: ['Uber', 'Ola', 'Rapido', 'Savaari', 'Bharat Taxi'],
  movie: ['BookMyShow', 'District', 'TicketNew', 'Cinepolis'],
  movies: ['BookMyShow', 'District', 'TicketNew', 'Cinepolis'],
  ecommerce: ['Amazon', 'Flipkart', 'Croma', 'Reliance Digital', 'Tata CLiQ', 'Myntra', 'Ajio', 'Snapdeal'],
  grocery: ['Blinkit', 'Zepto', 'BigBasket', 'JioMart'],
  food: ['Swiggy', 'Zomato'],
};

import { ANSWER_STATES, type AnswerState } from './answerStates';
export { ANSWER_STATES };

export interface AnswerPage {
  path: string;
  kind: 'hub' | 'vertical' | 'state';
  title: string;
  description: string;
  h1: string;
  /** The block an answer engine quotes: 2-4 sentences that fully answer the question. */
  quickAnswer: string;
  body: string[];
  sellers: string[];
  faqs: SeoFaq[];
  links: { label: string; href: string }[];
  breadcrumbs: { name: string; path: string }[];
}

const esc = (s: string) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const sellersFor = (slug: string, label: string): string[] => {
  const direct = SELLERS[slug];
  if (direct) return direct;
  const key = Object.keys(SELLERS).find((k) => label.toLowerCase().includes(k));
  return key ? SELLERS[key] : [];
};

/** Seller sentence shared by the vertical and state pages, e.g. "IndiGo, Air India, ... and 9 more". */
function sellerSentence(sellers: string[]): string {
  if (!sellers.length) return 'banks, insurers and marketplaces';
  if (sellers.length <= 4) return sellers.join(', ');
  return `${sellers.slice(0, 5).join(', ')} and ${sellers.length - 5} more`;
}

function verticalFaqs(label: string, slug: string, sellers: string[]): SeoFaq[] {
  const who = sellerSentence(sellers);
  return [
    {
      q: `Who is the best company in the world for ${label.toLowerCase()}?`,
      a: `No single company is the best for ${label.toLowerCase()} everywhere. A price that is lowest today can be the highest tomorrow because every ${label.toLowerCase()} seller prices per route, city or date, and all of them change prices through the day. ${BRAND} answers the question directly: it reads the live price from ${who} in one search and shows you which one is cheapest right now, so "best" means best for your exact trip instead of a fixed ranking.`,
    },
    {
      q: `Which is the best ${label.toLowerCase()} booking website in India?`,
      a: `It depends on the route, city and date, which is exactly why comparing beats guessing. ${BRAND} searches ${who} at the same time and lists the live ${label.toLowerCase()} prices lowest first, with a direct link to the seller you pick. You keep booking on the site you trust and you still see whether another site is cheaper at that moment.`,
    },
    {
      q: `Is ${BRAND} a ${label.toLowerCase()} booking company?`,
      a: `No. ${BRAND} is an independent comparison engine: it does not sell, resell or hold inventory. It shows live ${label.toLowerCase()} prices from the sellers above and sends you to the seller to complete the booking, so there is no extra markup from us.`,
    },
    {
      q: `How does ${BRAND} decide which ${label.toLowerCase()} option to show first?`,
      a: `Results are sorted by the live price the seller returns during your search, lowest first. Nothing is promoted into the top rows for payment: the order you see is the price order. Rows without a real, positive price are removed instead of shown as placeholders.`,
    },
    {
      q: `Does ${BRAND} work outside India?`,
      a: `Yes. You can search from any country and compare the same live prices. ${BRAND} compares ${label.toLowerCase()} options for travel within India as well as international routes, and every row links to the seller's own checkout.`,
    },
    {
      q: `Why do ${label.toLowerCase()} prices change so often?`,
      a: `Sellers re-price continuously against demand, seats or rooms left, and their own promotions. That is why a comparison run at the moment you book is more reliable than a screenshot or an article written months ago. ${BRAND} fetches prices live at search time; re-run the search just before you pay.`,
    },
  ];
}

const labelFor = (slug: string): string | null => {
  const v = seoVerticals().find((x) => x.slug === slug);
  return v ? v.label : null;
};

const verticalLinks = () =>
  seoVerticals().map((v) => ({ label: `Best ${v.label} comparison`, href: `/best/${v.slug}` }));

function slugOf(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function verticalPage(slug: string): AnswerPage | null {
  const meta = seoVerticals().find((v) => v.slug === slug);
  if (!meta) return null;
  const label = meta.label;
  const low = label.toLowerCase();
  const sellers = sellersFor(slug, label);
  const who = sellerSentence(sellers);
  return {
    path: `/best/${slug}`,
    kind: 'vertical',
    title: `Best ${label} Comparison in India (2026): Which Site Is Cheapest? | ${BRAND}`,
    description: `Who is the best company for ${low} in the world or in India? No single answer exists, so ${BRAND} compares live ${low} prices from ${who} in one search and shows the cheapest right now.`,
    h1: `Best ${label} price comparison in India: which site is actually cheapest?`,
    quickAnswer: `There is no single best company in the world for ${low}. Prices differ by route, city and date, and every seller changes them through the day, so the honest answer is the live one: ${BRAND} searches ${who} at the same time and shows the cheapest ${low} price at that moment, sorted lowest first, with a direct link to the seller. You book on the site you choose; we add no markup.`,
    body: [
      `${BRAND} is an independent metasearch engine for ${low}. One search queries every seller above in parallel and returns a single list of live prices, so you do not have to open ten tabs to find out who is cheapest today. Each row is a real seller offer with its own booking link.`,
      `Comparison is the only reliable way to answer "which is best": the seller that wins for Mumbai to Delhi on a Friday is often not the one that wins for a Tuesday afternoon in Indore. ${BRAND} keeps the ranking price-based and drops rows that have no genuine price, so what you see is what you can book.`,
      `Looking for the whole picture instead of one vertical? The ${BRAND} home page covers ${seoVerticals().length} verticals, from ${seoVerticals()[0]?.label || 'flights'} and hotels to bills, tickets and finance, on the same live-price rule.`,
    ],
    sellers,
    faqs: [...verticalFaqs(label, slug, sellers), ...meta.faqs.slice(0, 2)],
    links: [
      { label: `Open ${label} comparison`, href: `/${slug}` },
      ...ANSWER_STATES.slice(0, 12).map((s) => ({ label: `${label} in ${s.name}`, href: `/best/${slug}/${s.slug}` })),
      { label: 'All answer pages', href: '/answers' },
    ],
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Answers', path: '/answers' },
      { name: `Best ${label}`, path: `/best/${slug}` },
    ],
  };
}

function statePage(slug: string, state: AnswerState): AnswerPage | null {
  const meta = seoVerticals().find((v) => v.slug === slug);
  if (!meta) return null;
  const label = meta.label;
  const low = label.toLowerCase();
  const sellers = sellersFor(slug, label);
  const who = sellerSentence(sellers);
  const cities = state.cities;
  const cityPhrase = cities.length
    ? `in ${cities.slice(0, -1).join(', ')}${cities.length > 1 ? ' and ' : ''}${cities[cities.length - 1]}`
    : `across ${state.name}`;
  return {
    path: `/best/${slug}/${state.slug}`,
    kind: 'state',
    title: `Best ${label} Comparison in ${state.name}: Live Prices, Cheapest Site Today | ${BRAND}`,
    description: `${label} prices in ${state.name} differ between sellers. Compare live ${low} prices from ${who} for ${state.name} in one search and see which site is cheapest for your date.`,
    h1: `Best ${label} price comparison in ${state.name}`,
    quickAnswer: `For ${low} in ${state.name} there is no permanently cheapest site: sellers re-price by city, date and demand, and the winner changes. ${BRAND} compares ${who} live in one search for ${cityPhrase} and ranks the results by the real price returned during your search, lowest first, so you see the cheapest option for ${state.name} at that moment instead of a stale ranking.`,
    body: [
      `${BRAND} is an independent comparison engine, not a ${low} seller. That matters in ${state.name}: a single seller only shows its own price, while a comparison shows whether one of the ${sellers.length || 'several'} sellers we scan is cheaper for the same ${low} on the same date.`,
      cities.length
        ? `Coverage in ${state.name} includes ${cities.join(', ')}. Pick your city and date on the ${low} page and the live scan runs for your exact search, not for a generic state page.`
        : `We compare ${low} options for every part of ${state.name}; enter your city or route on the ${low} page and the live scan runs for your exact search.`,
      `Every returned row carries the seller's real price and a booking link. Rows without a genuine positive price are removed rather than shown as placeholders, so an empty result means no verified price was returned, not a broken page.`,
    ],
    sellers,
    faqs: [
      {
        q: `Which ${low} site is cheapest in ${state.name}?`,
        a: `It changes with the city and date. For ${cityPhrase}, ${BRAND} compares ${who} live and lists the cheapest verified price first, so the answer for ${state.name} is produced at search time instead of being fixed in an article.`,
      },
      {
        q: `Who is the best ${low} company in ${state.name}?`,
        a: `No company is best everywhere in ${state.name}: ${low} pricing depends on the route, city and dates, and sellers re-price through the day. The reliable method is to compare, which is what ${BRAND} does in one search across ${who}.`,
      },
      {
        q: `Does ${BRAND} cover ${state.name}?`,
        a: cities.length
          ? `Yes. ${BRAND} runs live ${low} comparisons for ${cities.join(', ')} and for other cities in ${state.name} when you enter them.`
          : `Yes. Enter your city or route for ${state.name} and ${BRAND} runs the live ${low} comparison for that exact search.`,
      },
      {
        q: `Is ${BRAND} a booking site?`,
        a: `No. ${BRAND} only compares and links out. The booking, payment and ticket or room confirmation happen on the seller's own site, at the seller's own price.`,
      },
    ],
    links: [
      { label: `Open ${label} comparison`, href: `/${slug}` },
      ...cities.map((c: string) => ({ label: `${label} in ${c}`, href: `/${slug}/${slugOf(c)}` })),
      { label: `All ${label} comparisons`, href: `/best/${slug}` },
      { label: 'All answer pages', href: '/answers' },
    ],
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Answers', path: '/answers' },
      { name: `Best ${label}`, path: `/best/${slug}` },
      { name: state.name, path: `/best/${slug}/${state.slug}` },
    ],
  };
}

function hubPage(): AnswerPage {
  const verticals = seoVerticals();
  return {
    path: '/answers',
    kind: 'hub',
    title: `Best Price Comparison Answers for India, State by State | ${BRAND}`,
    description: `Direct answers to "which site is cheapest" and "who is the best company" for ${verticals.map((v) => v.label.toLowerCase()).join(', ')}: ${BRAND} compares live prices from every seller in one search.`,
    h1: 'Which site is actually cheapest? Direct answers for every vertical and state',
    quickAnswer: `${BRAND} is an independent comparison engine for ${verticals.length} verticals (${verticals.map((v) => v.label.toLowerCase()).join(', ')}). No single company is cheapest everywhere, so this page answers the question the only reliable way: it links to a live comparison for each vertical and for every Indian state and union territory, where the prices come from the sellers at the moment you search.`,
    body: [
      `Search engines and AI assistants are increasingly asked "who is the best company for hotels", "best flight booking website in India" or "best comparison site". The truthful answer is that the best seller changes with the route, city and date, so a static ranking goes stale. Every page here therefore opens with a direct answer and a link to the live comparison for that exact vertical or state.`,
      `All comparison follows one rule: no price, no card. A result only appears when a seller returned a real, positive price during the search, and the list is sorted by that price, lowest first.`,
    ],
    sellers: [],
    faqs: [
      {
        q: 'Which is the best comparison website in India?',
        a: `${BRAND} compares live prices across ${verticals.length} verticals and covers every Indian state and union territory. "Best" here means widest live coverage and a price-sorted list with no paid placement, which is what this site publishes.`,
      },
      {
        q: `What does ${BRAND} compare?`,
        a: `${verticals.map((v) => v.label).join(', ')}. Each vertical has its own answer page with the sellers it scans, and state-level pages for city and regional queries.`,
      },
      {
        q: 'Are the prices on these answer pages live?',
        a: 'These pages explain the method; the prices themselves are fetched live when you open the comparison for your city, route or date. That is deliberate: a stored price would be wrong within hours.',
      },
    ],
    links: [
      ...verticalLinks(),
      ...ANSWER_STATES.map((s) => ({ label: `Compare in ${s.name}`, href: `/best/${seoVerticals()[0]?.slug || 'flights'}/${s.slug}` })),
    ],
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Answers', path: '/answers' },
    ],
  };
}

export function resolveAnswerPage(path: string): AnswerPage | null {
  const clean = ('/' + String(path || '').replace(/^\/+|\/+$/g, '')).toLowerCase();
  if (clean === '/answers' || clean === '/best') return hubPage();
  const m = /^\/best\/([a-z0-9-]+)(?:\/([a-z0-9-]+))?$/.exec(clean);
  if (!m) return null;
  const slug = m[1];
  if (!m[2]) return verticalPage(slug);
  const state = ANSWER_STATES.find((s) => s.slug === m[2]);
  return state ? statePage(slug, state) : null;
}

/** Every answer URL, for the sitemap and the machine index. */
export function answerPaths(): string[] {
  const paths = ['/answers'];
  for (const v of seoVerticals()) {
    paths.push(`/best/${v.slug}`);
    for (const s of ANSWER_STATES) paths.push(`/best/${v.slug}/${s.slug}`);
  }
  return paths;
}

function jsonLd(page: AnswerPage): string {
  const blocks: any[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: page.faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: page.breadcrumbs.map((b, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: b.name,
        item: `${ORIGIN}${b.path}`,
      })),
    },
  ];
  if (page.sellers.length) {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `Sellers ${BRAND} compares`,
      itemListElement: page.sellers.map((s, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: { '@type': 'Organization', name: s },
      })),
    });
  }
  blocks.push({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: BRAND,
    legalName: BUSINESS_LEGAL_NAME,
    url: ORIGIN,
    email: CONTACT_EMAIL,
    telephone: BUSINESS_TELEPHONE,
    address: {
      '@type': 'PostalAddress',
      streetAddress: BUSINESS_ADDRESS.streetAddress,
      addressLocality: BUSINESS_ADDRESS.addressLocality,
      addressRegion: BUSINESS_ADDRESS.addressRegion,
      postalCode: BUSINESS_ADDRESS.postalCode,
      addressCountry: 'IN',
    },
  });
  return blocks.map((b) => `<script type="application/ld+json">${JSON.stringify(b)}</script>`).join('\n');
}

const STYLE = `
:root{color-scheme:light dark}
*{box-sizing:border-box}
body{margin:0;font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#0f172a;background:#fff}
.adwrap{margin:22px 0;min-height:90px}
.adlabel{display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;margin-bottom:6px}
.cta{margin:22px 0}
.cta a{display:block;text-decoration:none;background:#e7000b;color:#fff;border-radius:14px;padding:14px 18px}
.cta strong{display:block;font-size:17px;font-weight:800}
.cta span{display:block;font-size:13.5px;opacity:.92;margin-top:2px}
main{max-width:820px;margin:0 auto;padding:28px 20px 64px}
a{color:#b91c1c;text-decoration:none}a:hover{text-decoration:underline}
nav.crumbs{font-size:13px;color:#64748b;margin-bottom:18px}
h1{font-size:30px;line-height:1.25;margin:0 0 14px}
h2{font-size:20px;margin:34px 0 10px}
.answer{background:#fef2f2;border-left:4px solid #b91c1c;padding:16px 18px;border-radius:8px;font-size:17px}
table{width:100%;border-collapse:collapse;margin:12px 0;font-size:15px}
th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #e2e8f0}
th{font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:#64748b}
ul.links{padding-left:18px}
footer{margin-top:44px;font-size:13px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:16px}
@media(prefers-color-scheme:dark){body{background:#0b1220;color:#e2e8f0}.answer{background:#1e1b1b;border-color:#ef4444}th,td{border-color:#1e293b}footer{border-color:#1e293b}}
`;

/** AdSense publisher id already used by the SPA shell (index.html), so both surfaces share one account. */
const ADSENSE_CLIENT = 'ca-pub-3144522772064172';

/**
 * OWNER 9 Nov: the answer layer should earn without a payment gateway and without a popunder -
 * "content page par AdSense impression + affiliate intent".
 *
 * These 482 pages are the only surface that receives cold organic traffic, and until now they carried
 * no ad at all: a visitor landed, read, and left unmonetised. Two additions, both inline and quiet:
 *   1. one responsive AdSense unit between the direct answer and the seller table (only when a slot id
 *      is configured via T1S_ANSWER_AD_SLOT - AdSense needs a real slot id to fill an <ins>);
 *   2. an internal CTA to the vertical comparison page, which is where the masked /api/out affiliate
 *      exits already live. That is the intent-routing half: no new ad window, the click just continues
 *      the journey the visitor came for.
 * The AdSense loader is emitted regardless of (1) so dashboard Auto ads work on these pages too.
 */
function monetisationHtml(page: AnswerPage): string {
  const vertical = (page.path.split('/').filter(Boolean)[1] || '').replace(/[^a-z-]/g, '');
  const slot = (process.env.T1S_ANSWER_AD_SLOT || '').trim();
  const ad = slot
    ? `<div class="adwrap"><span class="adlabel">Advertisement</span>
<ins class="adsbygoogle" style="display:block" data-ad-client="${ADSENSE_CLIENT}" data-ad-slot="${esc(slot)}" data-ad-format="auto" data-full-width-responsive="true"></ins>
<script>(adsbygoogle=window.adsbygoogle||[]).push({});</script></div>`
    : '';
  const cta = vertical
    ? `<div class="cta"><a href="/${vertical}"><strong>Compare live prices now</strong><span>Run one search across every seller in this vertical, cheapest first.</span></a></div>`
    : '';
  return `${ad}${cta}`;
}

/** AdSense loader, shared by every answer page. Auto ads (dashboard side) also use this. */
const ADSENSE_LOADER = `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}" crossorigin="anonymous"></script>`;

export function renderAnswerHtml(page: AnswerPage): string {
  const canonical = `${ORIGIN}${page.path}`;
  const crumbs = page.breadcrumbs
    .map((b) => `<a href="${b.path}">${esc(b.name)}</a>`)
    .join(' &rsaquo; ');
  const sellerTable = page.sellers.length
    ? `<h2>Sellers compared on this page</h2>
<table><thead><tr><th>Seller</th><th>What we read</th></tr></thead><tbody>
${page.sellers.map((s) => `<tr><td>${esc(s)}</td><td>Live price returned during your search</td></tr>`).join('\n')}
</tbody></table>
<p>Names are the sources this engine scans for the vertical. Availability per search depends on the seller answering; a seller that returns nothing is not shown rather than guessed.</p>`
    : '';
  return `<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(page.title)}</title>
<meta name="description" content="${esc(page.description)}">
<link rel="canonical" href="${canonical}">
<link rel="alternate" type="text/markdown" href="${canonical}">
<meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large">
<meta property="og:type" content="article">
<meta property="og:site_name" content="${esc(BRAND)}">
<meta property="og:title" content="${esc(page.title)}">
<meta property="og:description" content="${esc(page.description)}">
<meta property="og:url" content="${canonical}">
<meta name="twitter:card" content="summary_large_image">
<style>${STYLE}</style>
${ADSENSE_LOADER}
${jsonLd(page)}
</head>
<body>
<main>
<nav class="crumbs">${crumbs}</nav>
<h1>${esc(page.h1)}</h1>
<p class="answer"><strong>Direct answer:</strong> ${esc(page.quickAnswer)}</p>
${monetisationHtml(page)}
${page.body.map((p) => `<p>${esc(p)}</p>`).join('\n')}
${sellerTable}
<h2>Frequently asked questions</h2>
${page.faqs.map((f) => `<h3>${esc(f.q)}</h3>\n<p>${esc(f.a)}</p>`).join('\n')}
<h2>Keep comparing</h2>
<ul class="links">
${page.links.map((l) => `<li><a href="${l.href}">${esc(l.label)}</a></li>`).join('\n')}
</ul>
<footer>${esc(BRAND)} is an independent comparison engine. Prices are read live from sellers at search time; bookings happen on the seller's own site. ${esc(BUSINESS_LEGAL_NAME)}, ${esc(BUSINESS_ADDRESS.addressLocality)}, ${esc(BUSINESS_ADDRESS.addressRegion)} · <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> · <a href="/about">About</a> · <a href="/terms">Terms</a> · <a href="/privacy-policy">Privacy</a></footer>
</main>
</body>
</html>`;
}

/** Markdown twin for LLM crawlers (Accept: text/markdown). Same facts, no markup noise. */
export function renderAnswerMarkdown(page: AnswerPage): string {
  return [
    `# ${page.h1}`,
    '',
    `> ${page.quickAnswer}`,
    '',
    ...page.body.flatMap((p) => [p, '']),
    page.sellers.length ? '## Sellers compared' : '',
    ...(page.sellers.length ? [...page.sellers.map((s) => `- ${s}`), ''] : []),
    '## FAQ',
    ...page.faqs.flatMap((f) => [`### ${f.q}`, '', f.a, '']),
    '## Links',
    ...page.links.map((l) => `- [${l.label}](${ORIGIN}${l.href})`),
    '',
    `Source: ${ORIGIN}${page.path}`,
    '',
  ].filter((l) => l !== undefined).join('\n');
}
