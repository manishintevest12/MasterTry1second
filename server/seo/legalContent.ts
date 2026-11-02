/**
 * CRAWLABLE LEGAL / SUPPORT PAGES (owner 2 Nov: AdSense flagged try1second.com as
 * "Needs attention - Low value content").
 *
 * WHY THIS FILE EXISTS: /about, /privacy-policy, /terms, /contact and /disclaimer returned the
 * bare SPA shell - measured on production, each answered HTTP 200 with 27 words and the homepage
 * <title>, because the real text only lived inside the in-app InfoAndLegalModal. A reviewer (or a
 * crawler that does not run our bundle) therefore saw a site with no privacy policy, no terms and
 * no contact information, which is one of the standard triggers for a low-value-content verdict.
 *
 * The copy below is the owner's own approved text, taken verbatim from src/components/
 * InfoAndLegalModal.tsx (about / privacy / terms / affiliate / faq / contact tabs) - no new claims,
 * no new prices, nothing invented. Only the delivery changed: it is now real server-rendered HTML
 * at its own URL instead of a modal hidden behind JavaScript.
 */

export type LegalBlock = { t: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'li'; x: string };

export interface LegalPage {
  slug: string;
  title: string;
  description: string;
  blocks: LegalBlock[];
}

export const LEGAL_PAGES: Record<string, LegalPage> = {
  'about': {
    slug: 'about',
    title: "About Try1Second \u2014 Independent Multi-Vertical Price Comparison",
    description: "Who we are: an independent Indian metasearch engine comparing live prices across flights, hotels, bus, cabs, groceries, food, movies, loans and cards in about a second.",
    blocks: [
      { t: 'h2', x: "Welcome to Try1Second" },
      { t: 'p', x: "India's 1-Second Unified Multi-Vertical Comparison & Rewards Engine" },
      { t: 'p', x: "Every day, millions of Indian consumers juggle between 10+ different apps—checking MakeMyTrip for flights, Booking.com for hotels, Amazon and Flipkart for gadgets, Blinkit and Zepto for groceries, Zomato and Swiggy for meals, and Uber vs Ola for rides. In doing so, shoppers lose 30–45 minutes per purchase and overpay by an average of ₹14,000 every year due to fragmented surge pricing, obscured delivery fees, and unapplied bank discounts." },
      { t: 'h4', x: "1-Second Latency" },
      { t: 'p', x: "Direct low-latency API handshakes scan 25+ partner databases simultaneously in sub-second response times." },
      { t: 'h4', x: "Zero Hidden Fees" },
      { t: 'p', x: "Final checkout prices include taxes, convenience charges, and real-time bank cashback comparisons." },
      { t: 'h4', x: "Spin & Earn Rewards" },
      { t: 'p', x: "Every outbound click awards 1 Point. Hit 100 Points to spin the jackpot wheel for real merchant vouchers." },
      { t: 'h3', x: "Our 10 Core Verticals" },
      { t: 'p', x: "We cover all high-frequency consumer sectors with verified partner APIs:" },
    ],
  },
  'privacy-policy': {
    slug: 'privacy-policy',
    title: "Privacy Policy \u2014 Try1Second",
    description: "How Try1Second handles your data: DPDP Act 2023 aligned, no sale of personal data, lead forms stored on our own MySQL servers and shared only with the partner you pick.",
    blocks: [
      { t: 'h2', x: "Privacy Policy" },
      { t: 'p', x: "Last updated: October 2026 · Compliant with DPDP Act 2023" },
      { t: 'h4', x: "1. Information We Collect" },
      { t: 'li', x: "Hyper-Local Location (GPS / Pincode): When you enable location permissions, your latitude/longitude or 6-digit postal code is used strictly to query hyper-local dark stores (Blinkit, Zepto), restaurant menus (Zomato, Swiggy), and cab pickup ETAs (Uber, Ola). Location data is never stored on permanent third-party servers." },
      { t: 'li', x: "Redirection & Referral Tracking: When you click \"Select Deal\" or \"Book & Earn\", a referral tag is appended to the merchant URL to verify click attribution and credit your 1 Point towards the Spin & Win wheel." },
      { t: 'li', x: "Price Alerts & Watchlist: Desired target prices and notifications are cached locally in your browser storage." },
      { t: 'li', x: "Finance Enquiry Forms (Loans, Insurance, Credit Cards, Bank Accounts): When you submit an enquiry (name, age, salary, location and contact details), it is stored on our own servers in a MySQL database and shared ONLY with the specific partner bank, insurer or lender whose offer you selected, so they can contact you about that product. We never sell or rent this data, and you can request deletion anytime at info@try1second.com." },
      { t: 'h4', x: "2. Cookie & Session Policy" },
      { t: 'p', x: "We use strictly functional cookies to preserve your accumulated points, saved wishlist, and active price tracking thresholds across sessions." },
      { t: 'h4', x: "3. Security & Encryption" },
      { t: 'p', x: "All API handshakes are secured using TLS 1.3 with 256-bit encryption. Financial and credit card calculations are performed client-side; Try1Second does not store credit card numbers or banking CVVs." },
    ],
  },
  'terms': {
    slug: 'terms',
    title: "Terms of Service \u2014 Try1Second",
    description: "Try1Second terms: we are a metasearch engine, not a merchant. Fulfilment, cancellation and refunds follow the partner you book with.",
    blocks: [
      { t: 'h2', x: "Terms of Service" },
      { t: 'p', x: "Effective Date: October 2026" },
      { t: 'h4', x: "1. Metasearch Role & Non-Merchant Status" },
      { t: 'p', x: "Try1Second operates as an unbiased metasearch aggregation engine. When you select a flight, hotel, ride, product, loan, or policy, transaction fulfillment occurs on the verified third-party partner's platform (e.g., MakeMyTrip, Amazon, Blinkit, HDFC Bank). The partner's cancellation, refund, and service terms apply to your final purchase." },
      { t: 'h4', x: "2. Price Accuracy Guarantee & Real-Time Sync" },
      { t: 'p', x: "While our sub-second algorithms fetch real-time seller pricing, partner fares may fluctuate dynamically based on concurrent inventory changes, dynamic airline yield algorithms, or instantaneous dark-store surges. Always confirm the final price on the merchant's checkout screen before payment." },
      { t: 'h4', x: "3. Point Economy & Spin & Earn Mechanics" },
      { t: 'li', x: "Users earn 1 Try1Second Point per verified merchant redirection." },
      { t: 'li', x: "Accumulating 100 Points unlocks 1 Spin on the prize wheel." },
      { t: 'li', x: "Vouchers awarded from the prize wheel (Amazon, Swiggy, MakeMyTrip, Blinkit) carry unique redemption promo codes with individual merchant terms and expiry dates." },
      { t: 'li', x: "Points hold no standalone fiat currency value and cannot be exchanged for direct cash withdrawal." },
    ],
  },
  'affiliate-disclosure': {
    slug: 'affiliate-disclosure',
    title: "Affiliate Disclosure \u2014 Try1Second",
    description: "How Try1Second stays free: verified affiliate partnerships, clearly disclosed, with no effect on the prices you see.",
    blocks: [
      { t: 'h2', x: "Affiliate Disclosure & Transparency" },
      { t: 'p', x: "100% Consumer-First Pricing Transparency" },
      { t: 'p', x: "How does Try1Second make money without charging users?" },
      { t: 'p', x: "Try1Second is 100% free for consumers. We participate in verified direct affiliate partnerships with merchants such as MakeMyTrip, Amazon, Agoda, Blinkit, Uber, and PolicyBazaar. When you compare prices on our platform and complete a purchase through our redirection link, the partner merchant pays Try1Second a modest referral commission." },
      { t: 'p', x: "Crucial note: This never increases your price by even a single paisa. In fact, our comparison engine guarantees you find the absolute lowest published price, with exclusive coupons applied." },
      { t: 'h4', x: "Our Algorithmic Independence Policy" },
      { t: 'p', x: "Sellers cannot pay to rank higher in our default \"Cheapest\" or \"Best\" metasearch sorting algorithms. Rankings are strictly dictated by mathematically verified prices, live travel durations, user review sentiments, and verified criteria scores." },
    ],
  },
  'faq': {
    slug: 'faq',
    title: "Frequently Asked Questions \u2014 Try1Second",
    description: "Answers about how fast prices update, where prices come from, hidden fees, cashback and rewards on Try1Second.",
    blocks: [
      { t: 'h2', x: "Frequently Asked Questions" },
      { t: 'p', x: "Quick answers to common questions" },
      { t: 'h4', x: "How quickly are prices updated?" },
      { t: 'p', x: "Try1Second queries partner APIs in real-time. Flight fares, grocery dark-store stocks, and cab surge prices are updated every 30 to 60 seconds or instantaneously upon user search." },
      { t: 'h4', x: "How do I earn points for the Spin Wheel?" },
      { t: 'p', x: "You earn 1 point for every new friend who joins Try1Second using your personal referral link! Once your wallet reaches 100 points, the prize wheel unlocks for guaranteed gift vouchers & cashback. You can also use the tester buttons in the Spin tab to simulate referrals and test spins instantly." },
      { t: 'h4', x: "Why does Try1Second request my GPS location?" },
      { t: 'p', x: "For 10-Min Grocery, Food Delivery, and Cabs, prices and delivery times vary by exact street address. Providing your GPS or entering your 6-digit Pincode ensures you see exact dark-store availability and accurate cab pickup fares." },
      { t: 'h4', x: "Are hotel and airline quotes inclusive of taxes?" },
      { t: 'p', x: "Yes! Our primary price shows the total estimated price inclusive of base fare, airport fees, GST, and mandatory service charges so there are no surprise jumps at checkout." },
    ],
  },
  'contact': {
    slug: 'contact',
    title: "Contact Try1Second Support",
    description: "Reach the Try1Second support desk. We respond within 24 hours, 7 days a week.",
    blocks: [
      { t: 'h2', x: "Contact Us & Support Desk" },
      { t: 'p', x: "We respond within 24 hours · 7 days a week" },
    ],
  },
};

/** Slugs served as static HTML. Kept in one place so the server routes, the sitemap and the
 * cross-page footer links can never drift apart. */
export const LEGAL_SLUGS = Object.keys(LEGAL_PAGES);
