/**
 * Try1Second — standalone static pages: /privacy and /about (owner 25 Oct).
 * Google Play REQUIRES a public privacy-policy URL; these are full HTML
 * documents served directly (no React mount) so they are instant, crawlable,
 * and work even if the SPA bundle fails. Registered before the SPA catch-all.
 */
import { SEO_HOST } from './data';

const STYLE = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; background: #f8fafc; color: #0f172a; line-height: 1.7; }
  header { background: #e7000b; padding: 18px 20px; }
  header a { color: #fff; font-weight: 800; font-size: 20px; text-decoration: none; letter-spacing: -.02em; }
  header span { color: #ffd7d9; font-size: 12px; display: block; font-weight: 500; }
  main { max-width: 780px; margin: 0 auto; padding: 28px 20px 60px; }
  h1 { font-size: 28px; margin: 0 0 6px; letter-spacing: -.02em; }
  .updated { color: #64748b; font-size: 13px; margin-bottom: 26px; }
  h2 { font-size: 17px; margin: 30px 0 8px; }
  p, li { font-size: 15px; color: #334155; }
  ul { padding-left: 22px; }
  a { color: #dc2626; }
  .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px 22px; margin: 14px 0; }
  footer { border-top: 1px solid #e2e8f0; margin-top: 30px; padding-top: 16px; color: #64748b; font-size: 13px; }
`;

const shell = (title: string, description: string, path: string, body: string) => `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
<meta name="description" content="${description}" />
<link rel="canonical" href="${SEO_HOST}${path}" />
<meta name="robots" content="index, follow" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Try1Second" />
<link rel="icon" type="image/x-icon" href="/favicon.ico" />
<style>${STYLE}</style>
</head>
<body>
<header><a href="/">Try1Second</a><span>One second is all it takes to find the lowest price</span></header>
<main>
${body}
<footer>Try1Second is an independent metasearch engine and is not a seller of any product or service shown. &copy; ${new Date().getFullYear()} Try1Second &middot; <a href="/privacy">Privacy Policy</a> &middot; <a href="/about">About Us</a> &middot; info@try1second.com</footer>
</main>
</body>
</html>`;

export function privacyHtml(): string {
  return shell(
    'Privacy Policy — Try1Second',
    'How Try1Second collects, uses and protects your data: account info, search and location data, cookies, advertising and your rights.',
    '/privacy',
    `
<h1>Privacy Policy</h1>
<p class="updated">Last updated: 25 October 2026</p>
<p>This Privacy Policy explains how Try1Second ("we", "our", the website try1second.com and the Try1Second mobile app) collects, uses, shares and protects your information. By using the service you agree to the practices described here.</p>

<h2>1. Information we collect</h2>
<div class="card">
<p><strong>a) Account information.</strong> When you sign in with Google we receive from Firebase Authentication your name, email address and profile photo. We do not receive or store your Google password.</p>
<p><strong>b) Search and comparison data.</strong> The queries you search (e.g. a flight route, a product, a dish) and the results you view. Searches are processed live and logged to keep the comparison working and improve relevance.</p>
<p><strong>c) Location data.</strong> For local searches (grocery, food delivery, cabs, movies) we use the city, pincode and — only if you allow it — device GPS coordinates to query providers that actually serve your area. Precise location is used for your search and is not stored as your identity.</p>
<p><strong>d) Technical data.</strong> Device model, operating system, browser type, language, IP address and basic analytics events (pages viewed, searches run, latency). We use this to keep the service fast and to detect abuse.</p>
<p><strong>e) Leads you submit.</strong> For finance verticals (loans, insurance, credit cards, bank accounts) we store the details you explicitly submit (name, phone, city, requirement) and forward them only to the lender, insurer or bank you chose.</p>
</div>

<h2>2. How we use your information</h2>
<ul>
<li>To run live price comparisons and show you the lowest verified offers.</li>
<li>To create and maintain your account and sign-in session.</li>
<li>To remember your preferences (default city, last searches) on your device.</li>
<li>To send optional notifications you have requested, such as price alerts.</li>
<li>To operate advertising and affiliate commissions that keep the service free.</li>
<li>To detect fraud, abuse and technical problems, and to improve the service.</li>
</ul>

<h2>3. Cookies and advertising</h2>
<p>We use cookies and similar technologies, including Google AdSense and affiliate networks (such as LinkInR, EarnKaro/Ekaro, Admitad, Cuelinks and Amazon Associates). These partners may set their own cookies to show relevant ads and to attribute purchases you complete on a seller's site. You can control personalised advertising in your Google Ads Settings and block cookies in your browser at any time.</p>

<h2>4. When you leave Try1Second</h2>
<p>Our job ends when we send you to the airline, store, bank or restaurant's own website or app. Those sellers have their own privacy policies, which govern what they collect once you are on their platform. We recommend reading their terms before booking or buying.</p>

<h2>5. How we share data</h2>
<p>We do not sell your personal data. We share information only: (a) with the specific provider you choose (e.g. the lender you applied to); (b) with infrastructure providers that host and secure the service (hosting, database, analytics, error monitoring); (c) when required by law or to protect our rights.</p>

<h2>6. Data retention and security</h2>
<p>Account and preference data is kept while your account is active. Search logs are kept for operational improvement and are not linked to your identity in analytics. Lead data is retained for the period required to service your request or as required by law. We use encrypted connections (HTTPS) in transit and restrict access to our systems.</p>

<h2>7. Your rights</h2>
<ul>
<li>Request a copy of the personal data we hold about you.</li>
<li>Ask us to correct or delete your account data.</li>
<li>Withdraw consent or opt out of optional notifications at any time.</li>
<li>Use the service without signing in — comparison works without an account.</li>
</ul>
<p>To exercise any right, email us at <a href="mailto:info@try1second.com">info@try1second.com</a> and we will respond within a reasonable period.</p>

<h2>8. Children</h2>
<p>Try1Second is intended for users aged 18 and above, or younger users with a parent or guardian's consent. We do not knowingly collect data from children.</p>

<h2>9. Changes to this policy</h2>
<p>We may update this policy as the service evolves. The "Last updated" date above will change when we do, and significant changes will be highlighted on this page.</p>

<h2>10. Contact</h2>
<p>Questions about privacy? Write to <a href="mailto:info@try1second.com">info@try1second.com</a>.</p>
`,
  );
}

export function aboutHtml(): string {
  return shell(
    'About Us — Try1Second',
    'Try1Second is an independent Indian metasearch engine comparing live prices across 13 verticals — flights, hotels, bus, shopping, grocery, food, movies, loans, insurance, cabs, cards and banking.',
    '/about',
    `
<h1>About Try1Second</h1>
<p class="updated">One second is all it takes to find the lowest price</p>
<p>Try1Second is an independent metasearch engine for India. One search asks airlines, hotels, stores, quick-commerce apps, banks and insurers for their <strong>live price at the same moment</strong> — then we rank every real offer lowest first. The cheapest option is never buried on page four of a single seller's website.</p>

<div class="card">
<h2 style="margin-top:0">What we compare</h2>
<ul>
<li><strong>Travel:</strong> flights (airlines and OTAs), hotels, bus tickets and cab fares across Ola, Uber, Rapido and more.</li>
<li><strong>Shopping:</strong> products across Amazon, Flipkart, Myntra and other major Indian stores.</li>
<li><strong>Everyday:</strong> 10-minute grocery across Blinkit, Zepto and supermarkets; food delivery across Swiggy, Zomato and restaurant menus; movie tickets across booking platforms.</li>
<li><strong>Finance:</strong> loans, insurance, credit cards, savings accounts and banking products from banks and NBFCs.</li>
</ul>
</div>

<h2>How we are different</h2>
<ul>
<li><strong>Live, not cached:</strong> prices are fetched fresh from each source on every search.</li>
<li><strong>Independent:</strong> rankings are never sold. Sponsored placements, if any, are labelled.</li>
<li><strong>Transparent:</strong> every row is a real offer from a real seller with a direct link — we never resell tickets, rooms, groceries or loans.</li>
<li><strong>Free:</strong> comparison is free. We earn from clearly labelled advertising and affiliate commissions from sellers, never by selling your data.</li>
</ul>

<h2>Our promise</h2>
<p>What you see is what the seller reported at the moment of your search. The seller's page always has the final word at checkout — if a price moved in the seconds between our scan and your booking, the seller's own price applies.</p>

<h2>Contact</h2>
<p>Write to us at <a href="mailto:info@try1second.com">info@try1second.com</a> — for partnerships, feedback or a seller who wants to be included in comparisons.</p>
`,
  );
}
