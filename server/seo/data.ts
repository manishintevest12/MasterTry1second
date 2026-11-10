/**
 * Try1Second — programmatic SEO corpus (owner 25 Oct: "sab ka SEO automatic tagra").
 *
 * Every path below is a REAL, functional page: the SPA opens the matching
 * vertical (and pre-fills the search) when a user lands on it, while crawlers
 * get a server-rendered head + content block. Data is static (cities/routes/
 * categories change rarely); sitemap.ts derives the full URL list from here.
 *
 * Rules (self-healing SEO):
 * - No fake claims: copy talks about comparison features, not made-up prices.
 * - One canonical per URL; www.try1second.com is the canonical host.
 * - Any new vertical/city/route added here flows into sitemap + prerender
 *   automatically — no separate wiring.
 */

export const SEO_HOST = 'https://www.try1second.com';

import { GUIDE_SLUGS } from './guides';
import { ANSWER_STATES } from './answerStates';

export interface SeoFaq { q: string; a: string }
export interface SeoPage {
  path: string;
  title: string;
  description: string;
  h1: string;
  intro: string[];
  faqs: SeoFaq[];
  breadcrumbs: { name: string; path: string }[];
  links: { label: string; href: string }[];
}

// ============ Corpus ============

const CITIES: { slug: string; name: string }[] = [
  { slug: 'mumbai', name: 'Mumbai' }, { slug: 'delhi', name: 'Delhi' },
  { slug: 'bengaluru', name: 'Bengaluru' }, { slug: 'hyderabad', name: 'Hyderabad' },
  { slug: 'chennai', name: 'Chennai' }, { slug: 'kolkata', name: 'Kolkata' },
  { slug: 'pune', name: 'Pune' }, { slug: 'ahmedabad', name: 'Ahmedabad' },
  { slug: 'jaipur', name: 'Jaipur' }, { slug: 'lucknow', name: 'Lucknow' },
  { slug: 'indore', name: 'Indore' }, { slug: 'bhopal', name: 'Bhopal' },
  { slug: 'nagpur', name: 'Nagpur' }, { slug: 'patna', name: 'Patna' },
  { slug: 'surat', name: 'Surat' }, { slug: 'vadodara', name: 'Vadodara' },
  { slug: 'gurugram', name: 'Gurugram' }, { slug: 'noida', name: 'Noida' },
  { slug: 'kochi', name: 'Kochi' }, { slug: 'coimbatore', name: 'Coimbatore' },
  { slug: 'vijayawada', name: 'Vijayawada' }, { slug: 'visakhapatnam', name: 'Visakhapatnam' },
  { slug: 'guwahati', name: 'Guwahati' }, { slug: 'chandigarh', name: 'Chandigarh' },
  { slug: 'dehradun', name: 'Dehradun' }, { slug: 'ludhiana', name: 'Ludhiana' },
  { slug: 'agra', name: 'Agra' }, { slug: 'varanasi', name: 'Varanasi' },
  { slug: 'kanpur', name: 'Kanpur' }, { slug: 'ranchi', name: 'Ranchi' },
  { slug: 'nashik', name: 'Nashik' }, { slug: 'rajkot', name: 'Rajkot' },
  { slug: 'jabalpur', name: 'Jabalpur' }, { slug: 'amritsar', name: 'Amritsar' },
  { slug: 'udaipur', name: 'Udaipur' }, { slug: 'jodhpur', name: 'Jodhpur' },
  { slug: 'goa', name: 'Goa' }, { slug: 'shimla', name: 'Shimla' },
];

const IATA: Record<string, string> = {
  mumbai: 'BOM', delhi: 'DEL', bengaluru: 'BLR', hyderabad: 'HYD', chennai: 'MAA',
  kolkata: 'CCU', pune: 'PNQ', ahmedabad: 'AMD', jaipur: 'JAI', lucknow: 'LKO',
  indore: 'IDR', bhopal: 'BHO', nagpur: 'NAG', patna: 'PAT', surat: 'STV',
  vadodara: 'BDQ', gurugram: 'DEL', noida: 'DEL', kochi: 'COK', coimbatore: 'CJB',
  vijayawada: 'VGA', visakhapatnam: 'VTZ', guwahati: 'GAU', chandigarh: 'IXC',
  dehradun: 'DED', ludhiana: 'LUH', agra: 'AGR', varanasi: 'VNS', kanpur: 'KNU',
  ranchi: 'IXR', nashik: 'ISK', rajkot: 'RAJ', jabalpur: 'JLR', amritsar: 'ATQ',
  udaipur: 'UDR', jodhpur: 'JDH', goa: 'GOI', shimla: 'SLV',
};

const FLIGHT_ROUTES: [string, string][] = [
  ['delhi', 'mumbai'], ['delhi', 'bengaluru'], ['mumbai', 'bengaluru'], ['delhi', 'goa'],
  ['mumbai', 'goa'], ['delhi', 'hyderabad'], ['delhi', 'chennai'], ['mumbai', 'delhi'],
  ['bengaluru', 'hyderabad'], ['delhi', 'kolkata'], ['mumbai', 'kolkata'],
  ['bengaluru', 'chennai'], ['delhi', 'pune'], ['mumbai', 'hyderabad'],
  ['chennai', 'hyderabad'], ['delhi', 'srinagar'], ['mumbai', 'jaipur'],
  ['delhi', 'jaipur'], ['bengaluru', 'kolkata'], ['pune', 'delhi'],
  ['indore', 'delhi'], ['indore', 'mumbai'], ['delhi', 'indore'], ['bhopal', 'delhi'],
  ['jaipur', 'mumbai'], ['kochi', 'delhi'], ['guwahati', 'delhi'], ['patna', 'delhi'],
  ['varanasi', 'delhi'], ['lucknow', 'delhi'], ['chandigarh', 'delhi'],
  ['nagpur', 'delhi'], ['surat', 'delhi'], ['amritsar', 'delhi'], ['ranchi', 'delhi'],
  ['dehradun', 'delhi'], ['udaipur', 'delhi'], ['vadodara', 'delhi'],
  ['coimbatore', 'delhi'], ['visakhapatnam', 'delhi'],
];

const BUS_ROUTES: [string, string][] = [
  ['delhi', 'jaipur'], ['delhi', 'agra'], ['delhi', 'lucknow'], ['delhi', 'chandigarh'],
  ['delhi', 'dehradun'], ['delhi', 'varanasi'], ['mumbai', 'pune'], ['mumbai', 'goa'],
  ['mumbai', 'surat'], ['mumbai', 'ahmedabad'], ['bengaluru', 'hyderabad'],
  ['bengaluru', 'chennai'], ['bengaluru', 'mangaluru'], ['bengaluru', 'coimbatore'],
  ['chennai', 'coimbatore'], ['chennai', 'madurai'], ['chennai', 'bengaluru'],
  ['hyderabad', 'vijayawada'], ['hyderabad', 'nagpur'], ['pune', 'nagpur'],
  ['indore', 'bhopal'], ['indore', 'ujjain'], ['bhopal', 'jabalpur'],
  ['jaipur', 'udaipur'], ['ahmedabad', 'udaipur'], ['ahmedabad', 'mumbai'],
  ['kolkata', 'puri'], ['patna', 'ranchi'], ['lucknow', 'kanpur'],
  ['surat', 'vadodara'], ['amritsar', 'chandigarh'], ['delhi', 'haridwar'],
];

interface VerticalMeta {
  id: string; slug: string; label: string;
  title: string; description: string; h1: string; intro: string[];
  faqs: SeoFaq[];
}

export const VERTICALS: VerticalMeta[] = [
  {
    id: 'flights', slug: 'flights', label: 'Flights',
    title: 'Compare Flight Prices Live in India — Cheapest Airfare Scanner | Try1Second',
    description: 'Scan 16+ airline and OTA fares side by side in one second. Compare IndiGo, Akasa, Air India, Vistara and travel-site prices live, then book on the seller you trust.',
    h1: 'Flight Price Comparison — Live Fares Across Airlines and Travel Sites',
    intro: [
      'Try1Second scans airlines and online travel agencies at the same time and lines every fare up in one list, so the cheapest flight is never buried on page four of an OTA.',
      'Every result is a live price from a real seller with a direct booking link. No dark patterns, no fake discounts — just the lowest verified fare we can find in one second.',
    ],
    faqs: [
      { q: 'How does Try1Second find cheap flights?', a: 'We query airlines and travel sites in parallel for your exact route and date, then rank every returned fare lowest-first. Each row links straight to the seller.' },
      { q: 'Can I book this flight from outside India?', a: 'Yes. NRIs and travellers in Dubai, Singapore, London, New York and the Gulf compare the same live INR fares here and pay on the airline or OTA checkout from any country.' },
      { q: 'Is Try1Second a travel agent?', a: 'No. We are an independent metasearch engine. We show you live fares and send you to the airline or OTA to book — we never resell tickets.' },
      { q: 'Are the flight prices live or cached?', a: 'Prices are fetched live from each source on every search. A completed scan shows exact fares at scan time; re-run the search before booking to confirm.' },
    ],
  },
  {
    id: 'hotels', slug: 'hotels', label: 'Hotels',
    title: 'Compare Hotel Prices — Live Rates Across Booking Sites | Try1Second',
    description: 'One-second hotel price comparison across top booking sites for your city and dates. See live rates side by side and book on the site with the real lowest price.',
    h1: 'Hotel Price Comparison — Live Rates Across Booking Sites',
    intro: [
      'The same hotel room can cost very different amounts on different booking sites. Try1Second checks them together and shows you the live rate from each, lowest first.',
      'Pick your city and dates, and the scanner returns real, current rates with direct links to book — no inflated "discounts" from a single seller.',
    ],
    faqs: [
      { q: 'Does Try1Second book hotel rooms?', a: 'No — we compare live rates across booking sites and link you to the one with the best price. Booking happens on the seller site you choose.' },
      { q: 'How current are the hotel rates?', a: 'Rates are pulled live at search time from each booking site for your chosen city and stay dates.' },
    ],
  },
  {
    id: 'bus', slug: 'bus', label: 'Bus',
    title: 'Compare Bus Tickets — Live Fares Across redBus, zingbus & More | Try1Second',
    description: 'Compare live bus fares and operators across redBus, zingbus, AbhiBus and more state carriers in one scan. Filter by operator, timing and price, then book direct.',
    h1: 'Bus Ticket Price Comparison — Live Fares, All Operators',
    intro: [
      'Bus fares for the same route vary wildly between operators and booking platforms. Try1Second queries them together so you see every live option on one screen.',
      'Filter by operator, departure time and price, then jump straight to the booking page. Works for state RTCs and private operators alike.',
    ],
    faqs: [
      { q: 'Which bus booking sites do you compare?', a: 'redBus, zingbus, AbhiBus and more, including state road transport corporation results where available for your route.' },
      { q: 'Do you charge a booking fee?', a: 'Never. Comparison is free; you book on the operator or platform site at their normal price.' },
    ],
  },
  {
    id: 'ecommerce', slug: 'ecommerce', label: 'Online Shopping',
    title: 'Compare Product Prices — Amazon, Flipkart, Myntra & More | Try1Second',
    description: 'Compare live product prices across Amazon, Flipkart, Myntra, Shopsy and more Indian stores in one second. One product, every price, lowest first.',
    h1: 'Product Price Comparison Across India\u2019s Biggest Online Stores',
    intro: [
      'Search any product and Try1Second asks Amazon, Flipkart, Myntra and other major stores for its current price at the same moment — then ranks them lowest first.',
      'Every row is a real listing from a real store with a direct product link, so you can verify the deal in one tap before buying.',
    ],
    faqs: [
      { q: 'Is Try1Second a shopping site?', a: 'No — we are a price comparison engine. We show live listings from Indian ecommerce stores and link you to the store to buy.' },
      { q: 'Why is a price sometimes different on the store site?', a: 'Prices change constantly. We show the live price at scan time; the store page always has the final word at checkout.' },
    ],
  },
  {
    id: 'grocery', slug: 'grocery', label: '10-Minute Grocery',
    title: 'Compare Quick-Commerce Grocery Prices — Blinkit, Zepto & More | Try1Second',
    description: 'One-second grocery price comparison across quick-commerce and supermarket apps for your pincode. Same cart, every store, lowest total first.',
    h1: 'Grocery Price Comparison — Quick Commerce vs Supermarkets',
    intro: [
      'Blinkit, Zepto, BigBasket and supermarkets all price the same packet differently. Try1Second checks your pincode\u2019s stores together and shows each live price side by side.',
      'Build your SmartCart and we total it across every store, so you know exactly where the full basket is cheapest — not just one headline item.',
    ],
    faqs: [
      { q: 'Does Try1Second deliver groceries?', a: 'No. We compare live prices from quick-commerce and supermarket apps for your location and send you to the app with the best price.' },
      { q: 'How do you know which stores serve my area?', a: 'Your city and pincode drive the scan — only sources that actually deliver to you are queried.' },
    ],
  },
  {
    id: 'food', slug: 'food', label: 'Food Delivery',
    title: 'Compare Food Delivery Prices — Swiggy, Zomato & More | Try1Second',
    description: 'Compare the same dish across Swiggy, Zomato and other delivery apps live. Same biryani, every app\u2019s price, fees included, lowest first.',
    h1: 'Food Delivery Price Comparison — Same Dish, Every App',
    intro: [
      'The same dish from the same restaurant can cost differently on Swiggy and Zomato. Try1Second shows both live prices, plus menu prices from the restaurant itself.',
      'Search a dish or restaurant near you and compare delivered prices in one second — then order in the app that is genuinely cheapest.',
    ],
    faqs: [
      { q: 'Does Try1Second deliver food?', a: 'No — we compare live prices across delivery apps and restaurant menus, then link you to the cheapest way to order.' },
      { q: 'Are delivery fees included?', a: 'We compare the prices each app reports live; final checkout totals on the app are always the source of truth.' },
    ],
  },
  {
    id: 'movie', slug: 'movies', label: 'Movies',
    title: 'Compare Movie Ticket Prices — BookMyShow & More | Try1Second',
    description: 'Compare live movie ticket prices across cinema booking platforms for your city. Same show, every platform\u2019s price, cheapest seat first.',
    h1: 'Movie Ticket Price Comparison — Same Show, Best Price',
    intro: [
      'Ticket prices for the same movie and showtime differ across booking platforms. Try1Second scans them together for your city and ranks the cheapest seat first.',
      'See upcoming movies, compare showtime prices, and jump straight to the booking page with the best deal.',
    ],
    faqs: [
      { q: 'Which platforms do you compare for movie tickets?', a: 'Cinema booking platforms serving your city, compared live per showtime. You book on the platform you pick.' },
      { q: 'Can I see upcoming releases?', a: 'Yes — the movies vertical lists upcoming films with expected booking availability for your city.' },
    ],
  },
  {
    id: 'loans', slug: 'loans', label: 'Loans',
    title: 'Compare Loan Interest Rates — Personal, Home, Car & More | Try1Second',
    description: 'Compare live personal, home, car and education loan interest rates from Indian banks and NBFCs in one second. Real rates, lowest first, apply direct.',
    h1: 'Loan Interest Rate Comparison — Banks and NBFCs Side by Side',
    intro: [
      'Interest rates for the same loan type move bank to bank and week to week. Try1Second tracks live published rates from Indian banks and NBFCs and ranks them lowest first.',
      'Pick a loan type, see the current rate table, and apply on the lender\u2019s own page. Your lead goes to the lender — never to a resale broker.',
    ],
    faqs: [
      { q: 'Are the loan rates live?', a: 'Yes — rates are the lenders\u2019 current published rates, scanned live and shown newest-first with the source link.' },
      { q: 'Does Try1Second lend money?', a: 'No. We are an independent comparison engine. Your application is submitted to the bank or NBFC you choose.' },
    ],
  },
  {
    id: 'insurance', slug: 'insurance', label: 'Insurance',
    title: 'Compare Insurance — Health, Car, Bike & Term Plans | Try1Second',
    description: 'Compare live premiums and plans across Indian insurers — health, motor, travel and term life. Real quotes, side by side, buy on the insurer\u2019s site.',
    h1: 'Insurance Comparison — Live Premiums Across Insurers',
    intro: [
      'Insurance premiums for the same cover vary sharply between insurers. Try1Second compares live health, car, bike, travel and term plans in one scan.',
      'See what each insurer actually charges before you buy, then go straight to the insurer\u2019s page. We never resell your data.',
    ],
    faqs: [
      { q: 'Is Try1Second an insurance broker?', a: 'No — we compare live published plans and premiums from insurers and marketplaces. You buy directly from the insurer.' },
      { q: 'How fresh are the premiums shown?', a: 'Premiums are scanned live from insurer and marketplace sources at search time.' },
    ],
  },
  {
    id: 'cab', slug: 'cabs', label: 'Cabs',
    title: 'Compare Cab Fares — Ola, Uber, Rapido & More | Try1Second',
    description: 'Compare live cab fares for your route across Ola, Uber, Rapido and regional operators in one second. Same ride, every app\u2019s fare, cheapest first.',
    h1: 'Cab Fare Comparison — Ola, Uber, Rapido, All Apps',
    intro: [
      'The same ride can cost very different fares on Ola, Uber and Rapido. Try1Second estimates your route across all of them at once and shows the fare list lowest first.',
      'Pick your pickup and drop, compare every category — bike, auto, sedan, SUV — then open the app with the best fare.',
    ],
    faqs: [
      { q: 'How accurate are the cab fares?', a: 'Fares are live estimates for your exact pickup and drop points, calculated from each app\u2019s current rate card. The app shows the final fare before you confirm.' },
      { q: 'Can Try1Second book my ride?', a: 'No — we compare fares and deep-link you to the winning app with your route pre-filled.' },
    ],
  },
  {
    id: 'creditcards', slug: 'credit-cards', label: 'Credit Cards',
    title: 'Compare Credit Cards — Fees, Rewards & Benefits Live | Try1Second',
    description: 'Compare Indian credit cards live: annual fees, reward rates, fuel and travel benefits side by side. Find the right card, apply on the bank\u2019s own site.',
    h1: 'Credit Card Comparison — Fees and Rewards Side by Side',
    intro: [
      'Credit card value depends on your spend pattern — fuel, travel, cashback. Try1Second compares live card terms from Indian banks side by side so you can match the card to your wallet.',
      'No ranking is paid for. Cards are listed by how they fit what you searched, with the bank\u2019s official application link.',
    ],
    faqs: [
      { q: 'Does Try1Second issue credit cards?', a: 'No. We compare live card details from bank and card-network sources; you apply on the issuing bank\u2019s site.' },
      { q: 'Are card recommendations sponsored?', a: 'No — results are ranked by fit for your search, not by bank payments.' },
    ],
  },
  {
    id: 'account', slug: 'bank-accounts', label: 'Bank Accounts',
    title: 'Compare Savings Accounts & Bank Offers Live | Try1Second',
    description: 'Compare savings account interest rates, minimum balances and benefits across Indian banks live. Highest rate first, open on the bank\u2019s own page.',
    h1: 'Savings Account Comparison — Rates and Benefits Across Banks',
    intro: [
      'Savings account rates and minimum-balance rules differ widely between banks. Try1Second compares them live and ranks the best returns first.',
      'See the rate, the fine print and the bank\u2019s own opening page — then decide with the full picture.',
    ],
    faqs: [
      { q: 'Are the interest rates live?', a: 'Yes — rates shown are the banks\u2019 current published savings rates, scanned live.' },
      { q: 'Does Try1Second open accounts?', a: 'No. We link you to the bank\u2019s official account-opening page.' },
    ],
  },
  {
    id: 'banking', slug: 'banking', label: 'Banking',
    title: 'Compare Banking Products — FDs, Deposits & More | Try1Second',
    description: 'Compare fixed deposit rates, savings rates and banking products across Indian banks live. Best returns first, straight from the bank\u2019s published rates.',
    h1: 'Banking Product Comparison — FDs, Deposits, Best Rates',
    intro: [
      'Fixed deposit and savings rates move often and differ bank to bank. Try1Second compares published rates across banks live, best return first.',
      'Compare, then open on the bank\u2019s own site — your money and your data stay between you and the bank.',
    ],
    faqs: [
      { q: 'Which banks do you compare?', a: 'Major Indian banks and small-finance banks with published rates, compared live at search time.' },
      { q: 'Is Try1Second affiliated with any bank?', a: 'No — we are an independent comparison engine with no bank\u2019s ranking for sale.' },
    ],
  },
];

const ECOM_CATS: { slug: string; label: string; query: string }[] = [
  { slug: 'mobile-phones', label: 'Mobile Phones', query: 'mobile phone' },
  { slug: 'laptops', label: 'Laptops', query: 'laptop' },
  { slug: 'televisions', label: 'Televisions', query: 'television' },
  { slug: 'washing-machines', label: 'Washing Machines', query: 'washing machine' },
  { slug: 'refrigerators', label: 'Refrigerators', query: 'refrigerator' },
  { slug: 'air-conditioners', label: 'Air Conditioners', query: 'air conditioner' },
  { slug: 'headphones-earbuds', label: 'Headphones & Earbuds', query: 'wireless earbuds' },
  { slug: 'smartwatches', label: 'Smartwatches', query: 'smartwatch' },
  { slug: 'sports-shoes', label: 'Sports Shoes', query: 'sports shoes' },
  { slug: 'kitchen-appliances', label: 'Kitchen Appliances', query: 'kitchen appliance' },
  { slug: 'air-fryers', label: 'Air Fryers', query: 'air fryer' },
  { slug: 'water-purifiers', label: 'Water Purifiers', query: 'water purifier' },
  { slug: 'cameras', label: 'Cameras', query: 'camera' },
  { slug: 'power-banks', label: 'Power Banks', query: 'power bank' },
];

const LOAN_TYPES: { slug: string; label: string; query: string }[] = [
  { slug: 'personal-loan', label: 'Personal Loan', query: 'personal loan' },
  { slug: 'home-loan', label: 'Home Loan', query: 'home loan' },
  { slug: 'car-loan', label: 'Car Loan', query: 'car loan' },
  { slug: 'education-loan', label: 'Education Loan', query: 'education loan' },
  { slug: 'gold-loan', label: 'Gold Loan', query: 'gold loan' },
  { slug: 'business-loan', label: 'Business Loan', query: 'business loan' },
  { slug: 'two-wheeler-loan', label: 'Two-Wheeler Loan', query: 'two wheeler loan' },
];

const INSURANCE_TYPES: { slug: string; label: string; query: string }[] = [
  { slug: 'health-insurance', label: 'Health Insurance', query: 'health insurance' },
  { slug: 'car-insurance', label: 'Car Insurance', query: 'car insurance' },
  { slug: 'bike-insurance', label: 'Bike Insurance', query: 'bike insurance' },
  { slug: 'term-life-insurance', label: 'Term Life Insurance', query: 'term life insurance' },
  { slug: 'travel-insurance', label: 'Travel Insurance', query: 'travel insurance' },
  { slug: 'home-insurance', label: 'Home Insurance', query: 'home insurance' },
];

const CARD_TYPES: { slug: string; label: string; query: string }[] = [
  { slug: 'best-credit-cards', label: 'Best Credit Cards', query: 'best credit card' },
  { slug: 'fuel-credit-cards', label: 'Fuel Credit Cards', query: 'fuel credit card' },
  { slug: 'travel-credit-cards', label: 'Travel Credit Cards', query: 'travel credit card' },
  { slug: 'cashback-credit-cards', label: 'Cashback Credit Cards', query: 'cashback credit card' },
  { slug: 'shopping-credit-cards', label: 'Shopping Credit Cards', query: 'shopping credit card' },
];

const BANKING_TYPES: { slug: string; label: string; query: string }[] = [
  { slug: 'savings-account', label: 'Savings Account', query: 'savings account' },
  { slug: 'fixed-deposit', label: 'Fixed Deposit', query: 'fixed deposit' },
  { slug: 'demat-account', label: 'Demat Account', query: 'demat account' },
  { slug: 'current-account', label: 'Current Account', query: 'current account' },
];

const titleCase = (s: string) => s.replace(/(^|\s|-)\w/g, (m) => m.toUpperCase());
const cityName = (slug: string) => CITIES.find((c) => c.slug === slug)?.name || titleCase(slug.replace(/-/g, ' '));
const cityList = () => CITIES.slice(0, 8).map((c) => c.name).join(', ');

/** Read-only view of the vertical corpus for the answer-page layer (server/seo/answerPages.ts).
 *  Kept as a function so the array itself stays private to this module. */
export function seoVerticals(): { slug: string; label: string; title: string; description: string; h1: string; intro: string[]; faqs: SeoFaq[] }[] {
  return VERTICALS.map((v) => ({ slug: v.slug, label: v.label, title: v.title, description: v.description, h1: v.h1, intro: v.intro, faqs: v.faqs }));
}

function verticalBySlug(slug: string): VerticalMeta | undefined {
  return VERTICALS.find((v) => v.slug === slug.replace(/\/$/, ''));
}

function routeSlug(a: string, b: string, noun: string): string {
  return `${a}-to-${b}-${noun}`;
}

// ============ Path resolution ============

export function listSeoPaths(): string[] {
  // Editorial guides (server/seo/guides.ts) are part of the AdSense "unique value" surface.
  const guidePaths = GUIDE_SLUGS.map((s) => `/guides/${s}`);
  // OWNER 2 Nov (AdSense "Low value content"): the support/legal URLs are now real pages, so the
  // sitemap lists every one of them instead of a lone '/privacy' that answered the SPA shell.
  const paths: string[] = [
    ...guidePaths,
    '/',
    '/about',
    '/privacy-policy',
    '/privacy',
    '/terms',
    '/affiliate-disclosure',
    '/faq',
    '/contact',
    '/guides',
  ];
  // Answer pages: /answers + /best/<vertical> + /best/<vertical>/<state> (28 states + 8 UTs).
  paths.push('/answers');
  for (const v of VERTICALS) {
    paths.push(`/best/${v.slug}`);
    for (const st of ANSWER_STATES) paths.push(`/best/${v.slug}/${st.slug}`);
  }
  for (const v of VERTICALS) {
    paths.push(`/${v.slug}`);
    if (v.id === 'hotels' || v.id === 'grocery' || v.id === 'food' || v.id === 'movie' || v.id === 'cab') {
      for (const c of CITIES) paths.push(`/${v.slug}/${c.slug}`);
    }
    if (v.id === 'ecommerce') for (const c of ECOM_CATS) paths.push(`/${v.slug}/${c.slug}`);
    if (v.id === 'loans') for (const t of LOAN_TYPES) paths.push(`/${v.slug}/${t.slug}`);
    if (v.id === 'insurance') for (const t of INSURANCE_TYPES) paths.push(`/${v.slug}/${t.slug}`);
    if (v.id === 'creditcards') for (const t of CARD_TYPES) paths.push(`/${v.slug}/${t.slug}`);
    if (v.id === 'banking') for (const t of BANKING_TYPES) paths.push(`/${v.slug}/${t.slug}`);
  }
  for (const [a, b] of FLIGHT_ROUTES) paths.push(`/flights/${routeSlug(a, b, 'flights')}`);
  for (const [a, b] of BUS_ROUTES) paths.push(`/bus/${routeSlug(a, b, 'bus')}`);
  return [...new Set(paths)];
}

/** Map a URL path to the SPA vertical id + optional pre-filled search query. */
export function resolveAppRoute(path: string): { vertical?: string; query?: string } | null {
  const seg = path.replace(/\/+$/, '').split('/').filter(Boolean);
  if (seg.length === 0) return null;
  const head = seg[0];
  const tail = seg[1];
  const vmap: Record<string, string> = {
    flights: 'flights', hotels: 'hotels', bus: 'bus', ecommerce: 'ecommerce',
    grocery: 'grocery', food: 'food', movies: 'movie', loans: 'loans',
    insurance: 'insurance', cabs: 'cab', 'credit-cards': 'creditcards',
    'bank-accounts': 'account', banking: 'banking',
  };
  const vid = vmap[head];
  if (!vid) return null;
  if (!tail) return { vertical: vid };
  if (head === 'flights' || head === 'bus') {
    const m = /^([a-z]+(?:-[a-z]+)*?)-to-([a-z]+(?:-[a-z]+)*?)-(flights|bus)$/.exec(tail);
    if (m) {
      const A = m[1].replace(/-/g, ' '), B = m[2].replace(/-/g, ' ');
      const pretty = (x: string) => titleCase(x);
      if (head === 'flights') {
        const aI = IATA[m[1]] ? ` (${IATA[m[1]]})` : '';
        const bI = IATA[m[2]] ? ` (${IATA[m[2]]})` : '';
        return { vertical: 'flights', query: `${pretty(A)}${aI} to ${pretty(B)}${bI}` };
      }
      return { vertical: 'bus', query: `${pretty(A)} to ${pretty(B)}` };
    }
    return { vertical: vid };
  }
  // City / category pages: any tail under a city-driven vertical is a city;
  // under finance verticals it is the type query.
  if (['hotels', 'cabs', 'grocery', 'food', 'movies'].includes(head)) {
    return { vertical: vid, query: cityName(tail) };
  }
  const table: Record<string, { slug: string; query: string }[]> = {
    ecommerce: ECOM_CATS, loans: LOAN_TYPES, insurance: INSURANCE_TYPES,
    'credit-cards': CARD_TYPES, banking: BANKING_TYPES,
  };
  if (table[head]) {
    const t = table[head].find((x) => x.slug === tail);
    if (t) return { vertical: vid, query: t.query };
    return { vertical: vid };
  }
  return { vertical: vid };
}

// ============ Page content ============

export function resolveSeoPage(path: string): SeoPage | null {
  let clean = path.split('?')[0].replace(/\/+$/, '') || '/';
  // Vertical aliases (owner 28 Oct): /movie, /cab and /account are what the app's own
  // ids, sitemap links and users type. They must answer with the same page as the
  // marketing spelling instead of falling back to the generic shell.
  const ALIAS: Record<string, string> = {
    movie: 'movies', cab: 'cabs', creditcards: 'credit-cards', account: 'bank-accounts',
    ecom: 'ecommerce', grocery10: 'grocery',
  };
  const aliasSeg = clean.split('/').filter(Boolean);
  if (aliasSeg.length && ALIAS[aliasSeg[0]]) clean = '/' + [ALIAS[aliasSeg[0]], ...aliasSeg.slice(1)].join('/');

  // Product pages: /product/<slug> is a real, indexable page for one product.
  const prod = /^\/product\/([a-z0-9-]{3,80})$/.exec(clean);
  if (prod) {
    const words = prod[1].split('-').filter((w) => w.length > 1);
    const label = words.map((w) => (/^[0-9]+$/.test(w) ? w : w[0].toUpperCase() + w.slice(1))).join(' ');
    return {
      path: clean,
      title: `${label} — Live Prices From Every Store | Try1Second`,
      description: `Compare live prices for ${label} across Amazon, Flipkart, Croma, Reliance Digital, Tata CLiQ, JioMart and quick-commerce stores. Lowest verified price first, updated continuously.`,
      h1: `${label} — compare live prices`,
      intro: [
        `Try1Second scans every store that sells ${label} and ranks the offers by the price you actually pay, including delivery fees where the seller publishes them.`,
        `Prices on this page come from our own verified catalogue, so the list below is a real snapshot rather than an estimate. Open the live page to watch it update while the scan runs.`,
      ],
      breadcrumbs: [{ name: 'Home', path: '/' }, { name: 'Shopping', path: '/ecommerce' }, { name: label, path: clean }],
      faqs: [
        { q: `Where is ${label} cheapest?`, a: `Try1Second compares Amazon, Flipkart, Croma, Reliance Digital, Tata CLiQ, JioMart and the 10-minute stores, then shows the lowest verified price first. It changes by the hour, so the page is refreshed continuously.` },
        { q: `Are these prices live?`, a: `The snapshot on this page is our last verified read and is stamped with the time it was captured. The live comparison page re-checks every source each time it opens.` },
      ],
      links: [
        { label: 'All shopping deals', href: '/ecommerce' },
        { label: 'Quick-commerce (10 minute) prices', href: '/grocery' },
      ],
    };
  }
  if (clean === '/about' || clean === '/privacy') {
    const isAbout = clean === '/about';
    return {
      path: clean,
      title: isAbout ? 'About Us — Try1Second' : 'Privacy Policy — Try1Second',
      description: isAbout
        ? 'Try1Second is an independent Indian metasearch engine comparing live prices across 13 verticals — travel, shopping, everyday and finance.'
        : 'How Try1Second collects, uses and protects your data: account info, search and location data, cookies, advertising and your rights.',
      h1: isAbout ? 'About Try1Second' : 'Privacy Policy',
      intro: [isAbout
        ? 'Try1Second compares live prices across flights, hotels, bus, shopping, grocery, food, movies, loans, insurance, cabs, cards and banking — ranked lowest first, never sponsored.'
        : 'This policy explains what Try1Second collects (account, search, location and technical data), why, and the rights you have over it.'],
      faqs: isAbout
        ? [{ q: 'What is Try1Second?', a: 'An independent metasearch engine: one search asks every provider for its live price at the same moment and ranks the results lowest first.' },
           { q: 'Is Try1Second free?', a: 'Yes. Comparison is free; we earn from labelled advertising and affiliate commissions, never by selling your data.' }]
        : [{ q: 'What data does Try1Second collect?', a: 'Account info when you sign in with Google, your search queries, approximate location for local searches, and basic technical data to keep the service fast and safe.' },
           { q: 'How do I delete my data?', a: 'Email info@try1second.com and we will delete your account and associated data within a reasonable period.' }],
      breadcrumbs: [{ name: 'Home', path: '/' }, { name: isAbout ? 'About' : 'Privacy', path: clean }],
      links: [{ label: isAbout ? 'Privacy Policy' : 'About Us', href: isAbout ? '/privacy' : '/about' }],
    };
  }
  const app = resolveAppRoute(clean);
  if (clean !== '/' && !app) return null;

  if (clean === '/') {
    return {
      path: '/',
      // OWNER 9 Nov: the old title/H1 said "Compare Anything. One Second Is All It Takes." - pure
      // branding, so the page carried almost no query terms and the bare brand search was lost to the
      // "1 Second Everyday" app. Title, H1 and the first paragraph now carry the brand AND the head
      // terms people type (price comparison / flight / hotel / bus / India), and the FAQ answers the
      // brand-collision question directly.
      title: 'Try1Second: Flight, Hotel, Bus & Grocery Price Comparison in India',
      description: 'Compare live prices in one search: flights, hotels, bus, cabs, shopping, grocery, food, movies, loans, insurance and bank accounts in India, with direct links to each seller.',
      h1: 'Try1Second: live flight, hotel, bus and grocery price comparison in India',
      intro: [
        'Try1Second (also written Try 1 Second, T1S or try1second.com) is an independent metasearch engine for India: one search, and we ask airlines, travel sites, stores, banks, insurers and cab apps for their live price at the same moment — then rank them lowest first.',
        'No aggregator middlemen, no sponsored rankings. Every row is a real offer from a real seller with a direct link to book or buy where the price actually is.',
        'Booking from abroad? NRIs in Dubai, the USA, UK, Singapore and the Gulf get the same live INR fares — compare here, then pay on the airline or travel site in your country of residence.',
      ],
      faqs: [
        // Brand-collision answer: this is the query that currently lands on an unrelated video app.
        { q: 'Is Try1Second the same as the "1 Second Everyday" video app?', a: 'No. Try1Second (try1second.com) is an Indian price comparison website that compares live prices for flights, hotels, bus tickets, cabs, shopping, grocery, food delivery, movie tickets, loans, insurance, credit cards and bank accounts. It is not connected to any one-second video diary app or any other "1 second" product.' },
        { q: 'What is Try1Second?', a: 'A metasearch engine that compares live prices across 13 verticals — flights, hotels, bus, ecommerce, grocery, food delivery, movies, loans, insurance, cabs, credit cards, bank accounts and banking products.' },
        { q: 'Is it free to use?', a: 'Yes, comparison is completely free. We earn from ads and affiliate commissions from sellers — never by selling your data.' },
        { q: 'How fast is a comparison?', a: 'The first live rows arrive in about a second, and the scan keeps enriching results in the background while you look.' },
        { q: 'Can NRIs book flights to and within India from abroad?', a: 'Yes. Compare live INR fares from anywhere in the world, then complete payment on the airline or OTA checkout in your country — the same fare, no India-only restrictions.' },
        { q: 'Is Try1Second available outside India?', a: 'Yes. Anyone can compare prices on try1second.com from any country; flight, hotel and finance comparisons show the same live India prices in INR.' },
      ],
      breadcrumbs: [{ name: 'Home', path: '/' }],
      // OWNER 10 Nov: "traffic homepage se le kr sb page se aana chaiye". The homepage used to link only
      // the comparison apps, so the 482 answer pages were reachable almost exclusively from /answers.
      // It now offers all three doors: the live comparison for each vertical, the "best X" answer hub
      // for each vertical, and the state-by-state answers index. Every one of those is crawlable text,
      // so link equity flows from the strongest page on the site into the whole answer layer.
      links: [
        ...VERTICALS.map((v) => ({ label: `${v.label} comparison`, href: `/${v.slug}` })),
        ...VERTICALS.map((v) => ({ label: `Best ${v.label.toLowerCase()} comparison in India`, href: `/best/${v.slug}` })),
        ...intentLinksFor(''),
        { label: 'Compare answers for every vertical and state', href: '/answers' },
      ],
    };
  }

  const seg = clean.split('/').filter(Boolean);
  const head = seg[0];
  const tail = seg[1];
  const meta = verticalBySlug(head);
  if (!meta) return null;

  // Vertical home
  if (!tail) {
    return {
      path: clean,
      title: meta.title,
      description: meta.description,
      h1: meta.h1,
      intro: meta.intro,
      faqs: meta.faqs,
      breadcrumbs: [{ name: 'Home', path: '/' }, { name: meta.label, path: clean }],
      // OWNER 10 Nov: the vertical hub is the page the homepage links, so it must hand that equity on to
      // the answer layer: its own "best in India" page, the state answers that already name real cities,
      // and the answers index. Order matters - hub first, then states, then the index.
      links: [
        { label: `Best ${meta.label.toLowerCase()} comparison in India`, href: `/best/${head}` },
        ...ANSWER_STATES.filter((st) => st.cities.length).slice(0, 8).map((st) => ({
          label: `Best ${meta.label.toLowerCase()} in ${st.name}`,
          href: `/best/${head}/${st.slug}`,
        })),
        ...intentLinksFor(head),
        ...seoLinksFor(clean),
        { label: 'Best prices in every state', href: '/answers' },
      ],
    };
  }

  // Flights route page
  if (head === 'flights' && /-to-.*-flights$/.test(tail)) {
    const m = /^([a-z]+(?:-[a-z]+)*?)-to-([a-z]+(?:-[a-z]+)*?)-flights$/.exec(tail)!;
    const A = cityName(m[1]), B = cityName(m[2]);
    const aI = IATA[m[1]], bI = IATA[m[2]];
    const routeName = `${A} to ${B}`;
    const codeSuffix = aI && bI ? ` (${aI}–${bI})` : '';
    return {
      path: clean,
      title: `${A} to ${B} Flights — Compare Live Airfares${codeSuffix} | Try1Second`,
      description: `Compare live ${A} to ${B} flight fares across 16+ airlines and OTAs. Every ${routeName} airfare ranked lowest first, direct booking links included.`,
      h1: `${A} to ${B} Flights — Live Fare Comparison`,
      intro: [
        `This page compares live airfares for the ${routeName} route. One search asks airlines and travel sites together, and every fare lands in one ranked list — cheapest first.`,
        `Fares on ${routeName} change through the day and differ between airlines and OTAs. We show the live price each source reports right now, with a direct link to book on that seller.`,
      ],
      faqs: [
        { q: `How do I find the cheapest ${A} to ${B} flight?`, a: `Run the comparison on this page: we query airlines and OTAs live for ${routeName} and rank every returned fare lowest first. Pick the top verified row.` },
        { q: `Are ${A} to ${B} fares shown live?`, a: `Yes. Each fare is fetched live from the seller at scan time. Re-run the search before booking to see the very latest price.` },
        { q: 'Do you add any booking fee?', a: 'No. You book on the airline or OTA site at their price — Try1Second only finds and ranks the fares.' },
        { q: `Can I book ${A} to ${B} flights from outside India?`, a: `Yes. NRIs and travellers in Dubai, Singapore, London, New York and the Gulf see the same live INR fares for ${routeName} and pay on the airline or OTA checkout from any country.` },
      ],
      breadcrumbs: [{ name: 'Home', path: '/' }, { name: 'Flights', path: '/flights' }, { name: `${A} to ${B}`, path: clean }],
      links: [
        { label: 'All flight routes', href: '/flights' },
        ...FLIGHT_ROUTES.filter(([a, b]) => a === m[1] || b === m[2]).slice(0, 5).map(([a, b]) => ({ label: `${cityName(a)} to ${cityName(b)} flights`, href: `/flights/${routeSlug(a, b, 'flights')}` })),
        { label: `${A} hotels`, href: `/hotels/${m[1]}` },
        { label: `${A} cabs`, href: `/cabs/${m[1]}` },
        { label: 'Best flight comparison in India', href: '/best/flights' },
      ],
    };
  }

  // Bus route page
  if (head === 'bus' && /-to-.*-bus$/.test(tail)) {
    const m = /^([a-z]+(?:-[a-z]+)*?)-to-([a-z]+(?:-[a-z]+)*?)-bus$/.exec(tail)!;
    const A = cityName(m[1]), B = cityName(m[2]);
    return {
      path: clean,
      title: `${A} to ${B} Bus Tickets — Compare Live Fares & Operators | Try1Second`,
      description: `Compare live ${A} to ${B} bus fares across redBus, zingbus, AbhiBus and state carriers. Every operator and price on one screen, cheapest seat first.`,
      h1: `${A} to ${B} Bus — Fare and Operator Comparison`,
      intro: [
        `One search compares every bus operator running the ${A} to ${B} route — private carriers and state RTCs together, fares lowest first.`,
        `Filter by operator, departure window and price, then book on the platform with the genuine lowest fare. No single seller decides what you see.`,
      ],
      faqs: [
        { q: `Which operators run ${A} to ${B} buses?`, a: `The comparison on this page lists every operator our sources return live for the route — typically private carriers plus state road transport buses.` },
        { q: 'Are bus fares live?', a: 'Fares are fetched live at search time from the booking platforms we query. Confirm the final fare on the booking page.' },
      ],
      breadcrumbs: [{ name: 'Home', path: '/' }, { name: 'Bus', path: '/bus' }, { name: `${A} to ${B}`, path: clean }],
      links: [
        { label: 'All bus routes', href: '/bus' },
        { label: `${A} to ${B} flights`, href: `/flights/${routeSlug(m[1], m[2], 'flights')}` },
        { label: `${B} hotels`, href: `/hotels/${m[2]}` },
        { label: `${A} cabs`, href: `/cabs/${m[1]}` },
      ],
    };
  }

  // City pages (hotels/grocery/food/movies/cabs)
  if (['hotels', 'cabs', 'grocery', 'food', 'movies'].includes(head)) {
    const c = cityName(tail);
    const vmeta = meta;
    const nounMap: Record<string, string> = {
      hotels: 'hotel rates', cabs: 'cab fares', grocery: 'grocery prices', food: 'food delivery prices', movies: 'movie ticket prices',
    };
    const noun = nounMap[head] || vmeta.label.toLowerCase();
    const others = CITIES.filter((x) => x.slug !== tail).slice(0, 6);
    return {
      path: clean,
      title: `${vmeta.label} in ${c} — Compare Live Prices | Try1Second`,
      description: `Compare live ${noun} in ${c} across every major provider in one second. All of ${c}\u2019s prices side by side, lowest first.`,
      h1: `${vmeta.label} in ${c} — Live Price Comparison`,
      intro: [
        `This page compares live ${noun} for ${c}. One search asks every major provider serving the city at once, and the results land in a single lowest-first list.`,
        `Prices in ${c} move hour to hour. We show what each source reports right now with direct links, so the deal you see is the deal you get.`,
        `${cityList()} and 30+ other cities are covered the same way — change city anytime from inside the app.`,
      ],
      faqs: [
        { q: `How do you get ${c} prices?`, a: `Live queries to every provider that serves ${c} at search time — no stale listings, no manual uploads.` },
        { q: `Is comparing in ${c} free?`, a: `Yes, completely. We never charge for a comparison and never sell your data.` },
      ],
      breadcrumbs: [{ name: 'Home', path: '/' }, { name: vmeta.label, path: `/${head}` }, { name: c, path: clean }],
      links: [
        { label: `${vmeta.label} home`, href: `/${head}` },
        ...others.map((x) => ({ label: `${vmeta.label} in ${x.name}`, href: `/${head}/${x.slug}` })),
        // Link UP to the state answer page and the vertical answer hub (see stateForCity). Without this a
        // city page only pointed sideways at other cities, so the /best pages got no link equity from
        // sites' strongest existing pages.
        ...(stateForCity(c) ? [{ label: `Best ${vmeta.label.toLowerCase()} in ${stateForCity(c)!.name}`, href: `/best/${head}/${stateForCity(c)!.slug}` }] : []),
        { label: `Best ${vmeta.label.toLowerCase()} in India`, href: `/best/${head}` },
        ...(head === 'hotels' ? [{ label: `${c} flights search`, href: '/flights' }] : []),
      ],
    };
  }

  // Category / type pages (ecommerce, loans, insurance, credit-cards, banking)
  const table: Record<string, { slug: string; label: string; query: string }[]> = {
    ecommerce: ECOM_CATS, loans: LOAN_TYPES, insurance: INSURANCE_TYPES,
    'credit-cards': CARD_TYPES, banking: BANKING_TYPES,
  };
  if (table[head]) {
    const t = table[head].find((x) => x.slug === tail);
    if (!t) return null;
    const label = t.label;
    const isEcom = head === 'ecommerce';
    return {
      path: clean,
      title: isEcom
        ? `Compare ${label} Prices Across Amazon, Flipkart & More | Try1Second`
        : `Compare ${label} — Live Rates & Offers Across India | Try1Second`,
      description: isEcom
        ? `Compare live ${label.toLowerCase()} prices across Amazon, Flipkart, Myntra and more in one second. Every store\u2019s price for the same product, lowest first.`
        : `Compare live ${label.toLowerCase()} rates and offers across Indian providers in one second. Real numbers, ranked, with direct apply links.`,
      h1: isEcom ? `${label} Price Comparison — Every Store, One List` : `${label} Comparison — Live Rates Side by Side`,
      intro: isEcom ? [
        `Every store prices the same ${label.toLowerCase().replace(/s$/, '')} differently. This page compares live listings across India\u2019s biggest online stores and ranks them lowest first.`,
        `Each row is a real, current listing with a direct product link — verify the deal in one tap and buy on the store you already trust.`,
      ] : [
        `${label} rates and terms differ provider to provider and change often. This page compares current published offers live and ranks the best first.`,
        `Compare the real numbers here, then apply on the provider\u2019s own page. Your details go to the provider — never to a broker.`,
      ],
      faqs: [
        { q: `How fresh are the ${label.toLowerCase()} results?`, a: 'Every number is scanned live from provider sources at search time — the page never shows stale manual listings.' },
        { q: 'Is this comparison free?', a: 'Yes. Comparison is always free; we may earn a commission when you complete a purchase or application on the provider\u2019s site.' },
      ],
      breadcrumbs: [{ name: 'Home', path: '/' }, { name: meta.label, path: `/${head}` }, { name: label, path: clean }],
      links: [
        { label: `${meta.label} home`, href: `/${head}` },
        ...table[head].filter((x) => x.slug !== tail).slice(0, 6).map((x) => ({ label: x.label, href: `/${head}/${x.slug}` })),
      ],
    };
  }

  return null;
}

/**
 * Which state a city page belongs to, so /hotels/kolkata can link /best/hotels/west-bengal.
 * OWNER 9 Nov: "kaise improve kre ki top results mai aaye". The answer pages already link DOWN to the
 * city pages, but a city page had no link UP to its state page, so the 482 new answer URLs were only
 * reachable through /answers and the footer. Search engines weight a link by the page it comes from, so
 * every indexed city page now passes relevance to its state answer page, and the two blocks reinforce
 * the same topic in both directions.
 */
/**
 * OWNER 10 Nov (GSC section 3.2: eleven target searches had "Koi URL nahi"): the query-intent pages in
 * server/seo/intentGuides.ts only rank if something crawlable points at them. This maps each page to the
 * vertical hub it belongs to, so /flights, /hotels, /bus ... each hand link equity to the page that
 * answers that vertical's search phrase, and the homepage links the whole set.
 */
const INTENT_LINKS: Record<string, { label: string; slug: string }[]> = {
  flights: [
    { label: 'Best flight booking comparison website in India', slug: 'best-flight-booking-comparison-website-india' },
    { label: 'Compare flight prices across all websites in one search', slug: 'compare-flight-prices-india-all-websites' },
  ],
  hotels: [
    { label: 'Best hotel price comparison site in India', slug: 'best-hotel-price-comparison-site-india' },
    { label: 'Best company for hotel booking in the world', slug: 'best-company-for-hotel-booking-in-the-world' },
    { label: 'Best hotel booking company in Maharashtra', slug: 'best-hotel-company-in-maharashtra' },
  ],
  bus: [
    { label: 'Best bus ticket price comparison site in India', slug: 'best-bus-ticket-price-comparison-site-india' },
    { label: 'Indore to Bhopal bus ticket price comparison', slug: 'indore-to-bhopal-bus-ticket-price-comparison' },
  ],
  grocery: [
    { label: 'Compare grocery prices in Hyderabad: Blinkit, Zepto, Instamart', slug: 'compare-grocery-prices-hyderabad-blinkit-zepto-instamart' },
  ],
  movies: [
    { label: 'Best movie ticket price comparison in India', slug: 'best-movie-ticket-price-comparison-india' },
  ],
};
const INTENT_GENERAL: { label: string; slug: string }[] = [
  { label: 'What is Try1Second price comparison?', slug: 'try1second-price-comparison' },
  { label: 'Best price comparison website in India', slug: 'best-price-comparison-website-india' },
];

function intentLinksFor(head: string): { label: string; href: string }[] {
  const list = head === '' ? [...INTENT_GENERAL, ...Object.values(INTENT_LINKS).flat()] : [...(INTENT_LINKS[head] || []), ...INTENT_GENERAL.slice(0, 1)];
  return list.map((l) => ({ label: l.label, href: `/guides/${l.slug}` }));
}

function stateForCity(name: string): { name: string; slug: string } | null {
  const want = name.trim().toLowerCase();
  for (const st of ANSWER_STATES) {
    if (st.cities.some((c) => c.trim().toLowerCase() === want)) return { name: st.name, slug: st.slug };
  }
  return null;
}

function seoLinksFor(verticalPath: string): { label: string; href: string }[] {
  const head = verticalPath.split('/').filter(Boolean)[0];
  const links: { label: string; href: string }[] = [];
  if (head === 'flights') {
    for (const [a, b] of FLIGHT_ROUTES.slice(0, 8)) links.push({ label: `${cityName(a)} to ${cityName(b)} flights`, href: `/flights/${routeSlug(a, b, 'flights')}` });
  } else if (head === 'bus') {
    for (const [a, b] of BUS_ROUTES.slice(0, 8)) links.push({ label: `${cityName(a)} to ${cityName(b)} buses`, href: `/bus/${routeSlug(a, b, 'bus')}` });
  } else if (['hotels', 'cabs', 'grocery', 'food', 'movies'].includes(head)) {
    for (const c of CITIES.slice(0, 8)) links.push({ label: `${cityName(c.slug)}`, href: `/${head}/${c.slug}` });
  }
  // City page -> its state answer page (and the vertical hub), so the new /best pages collect an
  // internal link from every indexed city page instead of waiting for a fresh crawl.
  const segs = verticalPath.split('/').filter(Boolean);
  if (segs.length === 2) {
    const st = stateForCity(cityName(segs[1]));
    if (st) links.push({ label: `Best ${head.replace(/-/g, ' ')} in ${st.name}`, href: `/best/${head}/${st.slug}` });
    links.push({ label: `Best ${head.replace(/-/g, ' ')} in India`, href: `/best/${head}` });
  }
  return links;
}
