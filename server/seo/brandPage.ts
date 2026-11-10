/**
 * Try1Second — BRAND QUERY PAGE (owner 10 Nov).
 *
 * Owner: "abhi kissi ne try 1 second search kiya tho result try1second.com ni aaya fix kro".
 *
 * Why a dedicated page instead of only the home page: the spaced spelling "try 1 second" has real
 * search volume, but the crawlable text of the site carried it exactly once (a parenthetical inside
 * the home intro), so Google had no page whose title, H1, URL and body all answer that spelling. The
 * home page has to keep competing for the money head terms (flight/hotel/price comparison), so it
 * cannot be turned into a brand document. This page is that document, and it is honest about the
 * brand-collision: "1 Second Everyday" is a video-diary app, not a price comparison site.
 *
 * Rules kept: no invented facts, no claim to be "the best", no prices (a brand page has no live
 * search behind it, so a price here would be fabricated), and every link points at a page this
 * server actually serves.
 */
import type { SeoPage } from './data';

export const BRAND_PAGE_PATH = '/try-1-second';

/** Spellings real people and real assistants use for this site. */
export const BRAND_ALIASES = [
  'Try1Second',
  'Try 1 Second',
  'Try1 Second',
  'Try 1Second',
  'try1second.com',
  'T1S',
] as const;

export function isBrandPagePath(path: string): boolean {
  return String(path || '').split('?')[0].replace(/\/+$/, '') === BRAND_PAGE_PATH;
}

export function brandPage(): SeoPage {
  return {
    path: BRAND_PAGE_PATH,
    // The exact query is the title. This is the one page where that is the right choice.
    title: 'Try 1 Second — Live Price Comparison in India (try1second.com)',
    description:
      'Try 1 Second is Try1Second (try1second.com): one search compares live flight, hotel, bus, cab, shopping, grocery and movie prices in India, lowest first.',
    h1: 'Try 1 Second — what try1second.com is and what it compares',
    intro: [
      'Try 1 Second is the spaced spelling of Try1Second, the price comparison site at try1second.com. One search asks the sellers serving your city for their live price at the same moment, and every answer lands in a single lowest-first list with a direct link to the seller where that price actually is.',
      'The site compares thirteen verticals: flights, hotels, bus tickets, cabs, online shopping, grocery, food delivery, movie tickets, loans, insurance, credit cards, bank accounts and banking products. Comparison is free for the user; the site earns from ads and affiliate commissions paid by sellers, and no seller can buy a better position in the list.',
      'Try 1 Second is not an aggregator that resells inventory. Every row is one real seller with its own price and its own checkout, so the fare or price you see is the one you pay on that seller\'s page.',
    ],
    faqs: [
      {
        q: 'Is "Try 1 Second" the same website as try1second.com?',
        a: 'Yes. Try1Second, "Try 1 Second", "Try1 Second" and "T1S" all mean this site, try1second.com. The domain is written without spaces because domains cannot contain them.',
      },
      {
        q: 'Is Try 1 Second the same as the "1 Second Everyday" video app?',
        a: 'No. "1 Second Everyday" is a video diary app for filming one second a day. Try 1 Second (try1second.com) is an Indian price comparison website for flights, hotels, bus tickets, cabs, shopping, grocery, food delivery, movie tickets, loans, insurance, credit cards and bank accounts. The two are unrelated.',
      },
      {
        q: 'What can I compare on Try 1 Second?',
        a: 'Flights, hotels, bus tickets, cabs, ecommerce products, grocery, food delivery, movie tickets, loans, insurance, credit cards, bank accounts and banking products, across the cities and states we cover in India.',
      },
      {
        q: 'Does Try 1 Second charge users anything?',
        a: 'No. Comparison is free and no account is needed to see prices. Booking or buying happens on the seller\'s own site at the seller\'s own price.',
      },
      {
        q: 'Why is the site called Try 1 Second?',
        a: 'Because a single search is meant to answer in about a second: one request reaches every seller in the vertical at once instead of you opening each site in turn.',
      },
    ],
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Try 1 Second', path: BRAND_PAGE_PATH },
    ],
    links: [
      { label: 'Flight price comparison', href: '/flights' },
      { label: 'Hotel price comparison', href: '/hotels' },
      { label: 'Bus ticket price comparison', href: '/bus' },
      { label: 'Cab fare comparison', href: '/cabs' },
      { label: 'Grocery price comparison', href: '/grocery' },
      { label: 'Movie ticket price comparison', href: '/movies' },
      { label: 'Loans and insurance comparison', href: '/best/loans' },
      { label: 'All comparison answers', href: '/answers' },
      { label: 'About Try1Second', href: '/about' },
      { label: 'Contact', href: '/contact' },
    ],
  };
}

/**
 * A one-paragraph brand fact line for machine surfaces (llms.txt, Markdown alternate, MCP card).
 * Kept in this module so the human page and the machine index can never disagree.
 */
export const BRAND_FACT_LINE =
  'Try1Second (also written "Try 1 Second", "Try1 Second", "T1S", try1second.com) is an independent Indian metasearch engine that compares live prices for flights, hotels, bus, cabs, ecommerce, grocery, food delivery, movies, loans, insurance, credit cards, bank accounts and banking products, ranking every seller\'s own offer lowest first. It is unrelated to the "1 Second Everyday" video app.';
