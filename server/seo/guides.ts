/**
 * EDITORIAL GUIDES (owner 2 Nov: AdSense "Low value content" - "a site must provide substantial
 * unique value ... authentic, high-quality information, tools, or services").
 *
 * WHY THESE PAGES: a price-comparison app on its own is mostly dynamic numbers, and Google's thin
 * content policy treats a page that only republishes partner data as low value. These guides are
 * written for Try1Second, explain how the comparison actually works, and give the practical
 * checklist a buyer needs before paying - the "substantial unique value" a reviewer looks for.
 *
 * RULES FOLLOWED IN THIS COPY (keep them if you edit):
 *  - No invented statistics, no fake reviews, no made-up user counts, no claims about partner
 *    contracts. Everything here is mechanics a buyer can verify on the partner's own checkout.
 *  - No prices in the copy - prices change every minute and stale numbers are the fastest way to
 *    look low quality. The live comparison shows the current number; the guide explains what that
 *    number does and does not include.
 *  - Each guide ends with the same honest caveat: we are a metasearch engine, the transaction
 *    happens on the partner's site and their terms apply.
 *  - No ad unit is placed on these routes, so no ad renders next to thin or empty content.
 */

export type GuideBlock =
  | { t: 'h2' | 'h3' | 'p'; x: string }
  | { t: 'ul'; items: string[] };

export interface Guide {
  slug: string;
  title: string;
  description: string;
  /** One-line summary shown on the /guides index and in the Article JSON-LD. */
  headline: string;
  verticals: string[];
  updated: string;
  blocks: GuideBlock[];
}

export const GUIDES: Guide[] = [
  {
    slug: 'how-try1second-compares-prices',
    title: 'How Try1Second Compares Live Prices (And What It Cannot See)',
    description:
      'How the scan works, why the same seat or room has a different price on every seller, what our ranking means, and the limits you should know before you book.',
    headline: 'How the comparison works, end to end',
    verticals: ['flights', 'hotels', 'bus', 'cab', 'grocery', 'food', 'movies'],
    updated: '2026-11-02',
    blocks: [
      { t: 'h2', x: 'What actually happens when you search' },
      {
        t: 'p',
        x: 'You type one query. We fan it out to the seller sites and airline, hotel, bus, cab and merchant systems that publish that product, read the price each one returns for the exact route, dates and party size you asked for, and then show the answers side by side. Each row is one seller quoting one option, not an average and not an estimate.',
      },
      {
        t: 'p',
        x: 'The scan is done live. That is why a result page sometimes fills in over a few seconds: the first sellers answer quickly, and slower ones (airline systems, hotel chains, ticketing platforms) arrive after. When a seller refuses to answer, we say so in the scan status instead of quietly filling the gap with an older price.',
      },
      { t: 'h2', x: 'Why the same seat or room is priced differently everywhere' },
      {
        t: 'p',
        x: 'A fare or a room rate is not a single number. It is a set of rules applied to a base price. The rules differ by seller, so the checkout total differs even when the base looks identical.',
      },
      {
        t: 'ul',
        items: [
          'Seller margin and commission: a travel agent and an airline app can sell the same seat with different mark-ups.',
          'Fare class rules: the cheapest bucket sells out first, so two sellers quoting "economy" may be quoting different booking classes with different baggage and change rules.',
          'Taxes, surcharges and convenience fees: some sellers show a fare before fees, others after. Always compare the final payable amount.',
          'Bank offers and cashback: a card discount can change the ranking, and it is usually conditional on a minimum spend or a specific card network.',
          'Time: inventory is repriced continuously. Two scans a minute apart can legitimately differ.',
        ],
      },
      { t: 'h2', x: 'What our ranking means, and what it does not' },
      {
        t: 'p',
        x: 'Our default sort is by the effective price we read from each seller: the number that includes the mandatory fees that seller publishes. Optional extras, seat selection, extra baggage, insurance add-ons and pay-at-hotel surcharges are shown by the partner on their own checkout, not always in the quote we receive. A row is a quote, not a guarantee: the partner is the seller of record.',
      },
      { t: 'h2', x: 'Limits you should know' },
      {
        t: 'ul',
        items: [
          'If a seller hides prices behind a login or a bot check, we cannot read it. We show that the source was attempted and why it failed rather than inventing a number.',
          'Some sellers quote only a starting price for a category. Treat that as "from" pricing, not the price of the specific seat, room or seat class you want.',
          'Our cache exists to answer instantly, and a cached answer is always re-verified against the seller when you open the offer. If the seller has moved on, the seller page wins.',
        ],
      },
      { t: 'h2', x: 'How we make money (and why it does not change your price)' },
      {
        t: 'p',
        x: 'When you leave for a partner site and complete a purchase, the partner may pay us a commission. That commission is paid by the partner out of its own margin; it is not added to your checkout, and it never reorders our results. If a seller pays us nothing, it still appears if it has the better price. Our affiliate disclosure page spells this out in full.',
      },
    ],
  },
  {
    slug: 'flight-fare-checklist-india',
    title: 'Flight Fare Checklist: The Fees That Change Your Real Ticket Price',
    description:
      'A practical checklist for comparing Indian domestic flight fares: baggage, cancellation rules, convenience fees, seat and meal charges, date-change cost and the bank offers that actually apply.',
    headline: 'What to check before you pay for a flight',
    verticals: ['flights'],
    updated: '2026-11-02',
    blocks: [
      { t: 'h2', x: 'Start from the total, then compare the conditions' },
      {
        t: 'p',
        x: 'Two tickets for the same flight can differ by more than the fare difference suggests. Sort by the final payable amount, then use the list below to check that the cheaper row is genuinely cheaper for your trip.',
      },
      { t: 'h2', x: 'The pre-booking checklist' },
      {
        t: 'ul',
        items: [
          'Baggage: check-in allowance and cabin allowance separately. A low fare with cabin-only baggage is often the most expensive option once you add a checked bag.',
          'Cancellation and date change: read the penalty plus the fare difference. "Non-refundable" usually still refunds taxes, but the penalty can exceed the fare.',
          'Convenience fee: charged per passenger per sector by most agents. It is sometimes waived on the airline app and rarely on a metasearch exit.',
          'Seat and meal selection: priced per segment, and usually cheaper before check-in than during it.',
          'Departure airport and terminal: two airports in the same city can be an hour apart. Check the terminal before you choose the cheaper fare.',
          'Onward connection: if you are booking separate tickets, a delay is your risk, not the airline\'s. Leave a real buffer.',
          'Bank offer conditions: minimum spend, specific card network, limited seats per offer, and often no combination with other codes.',
        ],
      },
      { t: 'h2', x: 'Why fares move while you are deciding' },
      {
        t: 'p',
        x: 'Airlines sell in fare buckets. When the cheapest bucket empties, the next one becomes the lowest available price, so the visible fare rises without any promotion ending. This is normal inventory behaviour, not a pricing trick by the comparison site. Booking earlier is the only reliable defence, and flexibility on date or time is worth more than any coupon.',
      },
      { t: 'h2', x: 'When a seller shows a fare we could not confirm' },
      {
        t: 'p',
        x: 'If an airline or agent does not answer our scan, we show that the source failed rather than showing an old price. On the results page, an offer that says the fare could not be confirmed is a routing aid: it takes you to the seller\'s own search, where the live price is authoritative.',
      },
      { t: 'h2', x: 'The one-line rule' },
      {
        t: 'p',
        x: 'Compare the amount that leaves your bank account, including baggage and cancellation risk, not the headline fare. Our comparison gives you the candidates; the partner page is where you confirm.',
      },
    ],
  },
  {
    slug: 'hotel-booking-fees-guide',
    title: 'Hotel Booking Fees Explained: What the Nightly Rate Leaves Out',
    description:
      'How hotel quotes differ across sellers: taxes and service charges, pay-at-hotel versus prepaid, cancellation windows, resort fees, extra-guest charges and why two sellers quote the same room differently.',
    headline: 'The charges that sit behind a hotel nightly rate',
    verticals: ['hotels'],
    updated: '2026-11-02',
    blocks: [
      { t: 'h2', x: 'The room rate is only the starting point' },
      {
        t: 'p',
        x: 'Hotel pricing has more moving parts than any other travel vertical, because the same physical room can be sold as several different products: room only, with breakfast, with dinner, refundable, non-refundable, prepaid, or pay at the property. Two sellers showing a similar nightly figure may be selling different products.',
      },
      { t: 'h2', x: 'Compare these seven things' },
      {
        t: 'ul',
        items: [
          'Total for the stay: nightly rate multiplied by nights, plus taxes and any service charge the seller adds. Some markets quote before tax, some after.',
          'Cancellation window and penalty: "free cancellation until 48 hours before" and "non-refundable" are completely different products at similar prices.',
          'Prepaid or pay at hotel: prepaid is usually cheaper but locks your money; pay-at-hotel may add a deposit or an exchange-rate difference on the final bill.',
          'Occupancy: a room quoted for two adults can add a per-person charge for a third guest or for children above the property\'s age cut-off.',
          'Meal plan: breakfast for two, for the whole stay, can be worth more than a small rate difference.',
          'Resort or city fee: collected by the property at check-in in some destinations and invisible in the online quote.',
          'Room and bed type: the cheapest row is often the base category. Confirm the bed type and smoking preference before paying.',
        ],
      },
      { t: 'h2', x: 'Why the same hotel looks cheaper on one site' },
      {
        t: 'p',
        x: 'Hotels publish negotiated rates to different channels, and chains run member-only rates on their own site. A channel manager may also hold a promotional rate that only one reseller sees. That is why a comparison is worth doing, and why the cheapest row is worth reading carefully rather than clicking immediately: check that the dates, occupancy and cancellation terms match what you intended.',
      },
      { t: 'h2', x: 'Dates matter more than anything else' },
      {
        t: 'p',
        x: 'A hotel search is meaningless without an exact check-in and check-out date and a party size. Every offer we show is requested for the dates and guests you picked; if a seller returns a rate for different dates, we drop it rather than show you a rate you cannot book.',
      },
      { t: 'h2', x: 'What to do if a property does not appear' },
      {
        t: 'p',
        x: 'Some chains block automated reads or answer only a member session. When that happens the scan status names the source that did not answer, and you can go straight to that chain. We would rather show a shorter list than a list with invented rates.',
      },
    ],
  },
  {
    slug: 'cab-fare-surge-guide',
    title: 'Cab Fare Reality Check: Surge, Waiting Charges and the Fare Nobody Quotes',
    description:
      'How ride-hailing quotes are built: base fare, distance and time slabs, surge multipliers, waiting and cancellation fees, tolls and parking, plus why a quote can change the moment you open the app.',
    headline: 'Why ride quotes change, and what to compare',
    verticals: ['cab'],
    updated: '2026-11-02',
    blocks: [
      { t: 'h2', x: 'A cab quote is a live estimate, not a tariff' },
      {
        t: 'p',
        x: 'Ride-hailing prices are computed per request from the route, the traffic model, driver supply in that zone and the product you picked. Two apps quoting the same trip can differ sharply in the same minute, and the same app can quote differently two minutes later. That volatility is the reason a comparison is useful and the reason no comparison can promise a fixed price.',
      },
      { t: 'h2', x: 'What the number on screen includes' },
      {
        t: 'ul',
        items: [
          'Base fare plus distance and time components for the route the app computed.',
          'Surge or peak multiplier, which reflects local demand at that moment.',
          'Taxes and platform fees, which vary by city and by product.',
          'Usually not included: tolls, parking, state permits on intercity trips, and waiting time after the free window.',
        ],
      },
      { t: 'h2', x: 'Compare the product, not just the price' },
      {
        t: 'p',
        x: 'A cheaper quote is often a smaller or shared product. Check the vehicle category, the seating capacity and whether the trip is a shared ride. For airport runs, check the pickup point: kerbside pickups at large Indian airports charge an entry fee that some apps add to your bill and others do not.',
      },
      { t: 'h2', x: 'Cancellation and waiting charges' },
      {
        t: 'p',
        x: 'Most apps charge for cancelling after a driver is assigned, and start billing waiting time after a short free window. Those charges are set by the app, not by us, and they are the most common source of a bill that does not match the quote.',
      },
      { t: 'h2', x: 'Intercity and outstation trips' },
      {
        t: 'p',
        x: 'For outstation travel, ask for the inclusive kilometre allowance, the per-kilometre rate beyond it, the driver allowance and whether return tolls are included. A lower per-kilometre rate with a short included distance can cost more than a slightly higher rate with a longer one.',
      },
      { t: 'h2', x: 'Why one app may show a "fare unavailable" row' },
      {
        t: 'p',
        x: 'Some apps serve fares only to a signed-in session. We say so plainly instead of guessing: the row links you to that app\'s own search, where the live quote is the only one that matters.',
      },
    ],
  },
  {
    slug: 'quick-commerce-price-guide',
    title: 'Quick Commerce: Why Your Grocery Cart Costs More Than the Item Prices',
    description:
      'Delivery fees, handling charges, small-cart fees, rain and peak surcharges, pack-size tricks, member pricing and MRP versus discounted price - the full cost of a ten-minute grocery order.',
    headline: 'The real cost of a ten-minute grocery order',
    verticals: ['grocery'],
    updated: '2026-11-02',
    blocks: [
      { t: 'h2', x: 'Item price is the smallest part of the story' },
      {
        t: 'p',
        x: 'A grocery order\'s total is built from the item total, a delivery fee, a handling or platform fee, sometimes a small-cart fee, and any surge the platform applies during rain, peak hours or high demand. Two apps that show the same item price can land at very different totals for the same basket.',
      },
      { t: 'h2', x: 'Compare per unit, not per pack' },
      {
        t: 'p',
        x: 'Pack sizes change often and are rarely round numbers. A "value pack" can cost more per gram than two smaller packs of the same product. Compare the price per 100 g or per litre, which is what the unit price on our comparison lets you do, and check that the pack size in the row is the one you actually want.',
      },
      { t: 'h2', x: 'Checklist before you pay' },
      {
        t: 'ul',
        items: [
          'Free-delivery threshold: many platforms waive the fee above a cart value. Adding a genuinely needed item can cost less than paying the fee.',
          'Member or subscription pricing: visible only after you sign in, and it can change the ranking of two otherwise identical offers.',
          'MRP versus discounted price: confirm the discount is against the printed MRP, not an inflated reference price.',
          'Substitution policy: if an item is out of stock, does the platform refund or replace? A replacement can quietly change your total.',
          'Freshness and expiry: for dairy, produce and bakery, the cheapest listing is not always the best value if the shelf life is short.',
          'Handling fee on heavy items: water cans, bulk staples and large packs can carry an extra charge at checkout.',
        ],
      },
      { t: 'h2', x: 'Why an item disappears between two searches' },
      {
        t: 'p',
        x: 'Quick-commerce inventory lives in a dark store that serves your pincode. Availability changes as stock moves, and a store can go offline for a few minutes during a reshuffle. If an item vanishes, it is usually the store\'s stock, not the comparison.',
      },
      { t: 'h2', x: 'What we do and do not show' },
      {
        t: 'p',
        x: 'We show the item price each store published for your pincode, along with the pack size we could read. We do not invent a delivery fee or a total we cannot verify: the checkout total is on the store\'s own app, and that is the number you should trust.',
      },
    ],
  },
  {
    slug: 'food-delivery-fee-guide',
    title: 'Food Delivery Charges Explained: Delivery, Packaging, Surge and Menu Mark-up',
    description:
      'Why the same biryani costs more in an app than at the restaurant: menu mark-up, packaging charges, delivery fees by distance, surge, coupon conditions and the minimum order value.',
    headline: 'Why the same dish costs more in an app',
    verticals: ['food'],
    updated: '2026-11-02',
    blocks: [
      { t: 'h2', x: 'The four layers between a menu and a bill' },
      {
        t: 'p',
        x: 'A food order total is the item total plus packaging, plus delivery, plus taxes, minus coupons. Each layer behaves differently, and each platform sets them independently for the same restaurant.',
      },
      { t: 'h2', x: 'Menu price is not always the restaurant price' },
      {
        t: 'p',
        x: 'Many restaurants list a higher price inside delivery apps than on their own menu to cover commission. That is why a dish that costs one amount in the app can cost less when you order directly from the restaurant, and why comparing platforms is only half the job.',
      },
      { t: 'h2', x: 'What to check before ordering' },
      {
        t: 'ul',
        items: [
          'Packaging charge per item: it is not a delivery fee and it does not disappear with a free-delivery coupon.',
          'Distance-based delivery fee: the same restaurant can be cheap or expensive depending on how far the platform routes the order from.',
          'Surge or rain fee: applied at checkout, sometimes only after you add items to the cart.',
          'Coupon conditions: minimum order value, selected restaurants only, new-user only, or capped discount. An "up to 50% off" coupon usually has a ceiling.',
          'Minimum order value: below it, the platform adds a fee instead of refusing the order.',
          'Portion and packaging quality: for a group order, one larger pack is often cheaper per serving than two small ones.',
        ],
      },
      { t: 'h2', x: 'Ordering for a group without overpaying' },
      {
        t: 'p',
        x: 'Group orders are where fee stacking hurts most. Build the cart in one platform first, note the item total, packaging and delivery fee separately, then rebuild the identical cart elsewhere. Per-item packaging usually scales with the number of distinct dishes, not with quantity, so consolidating similar items (one large biryani instead of three small ones) often removes a fee layer. Restaurants also cap the number of free packaging units, so a large order can jump in cost at a pack-size boundary.',
      },
      { t: 'h2', x: 'Dietary and allergy information' },
      {
        t: 'p',
        x: 'Platforms label vegetarian and non-vegetarian dishes, but a label is not a guarantee about the kitchen: shared fryers, shared tandoors and shared prep surfaces are normal in a busy kitchen. For a serious allergy, call the restaurant before ordering and confirm the specific dish, because the app listing rarely carries an ingredients list you can rely on. For Jain or no-onion-no-garlic requests, use the restaurant instructions field and still confirm by phone for a strict requirement.',
      },
      { t: 'h2', x: 'Compare the dish, not the banner' },
      {
        t: 'p',
        x: 'A platform showing a big coupon can still be the more expensive option once packaging and delivery are added. Add the same items in both carts and compare the final payable amount; that is the only number that matters.',
      },
      { t: 'h2', x: 'When a restaurant is missing from one app' },
      {
        t: 'p',
        x: 'Restaurants choose their platforms and can pause delivery during peak hours. A missing listing usually means the restaurant is offline or exclusive elsewhere, not that we dropped it.',
      },
    ],
  },
  {
    slug: 'movie-ticket-fees-guide',
    title: 'Movie Tickets: Convenience Fees, Seat Classes and Where the Money Goes',
    description:
      'How cinema ticket totals are built: base ticket, seat class, convenience fee per ticket, food and beverage rules, cancellation windows and why the same show costs different amounts on different apps.',
    headline: 'Reading a cinema bill correctly',
    verticals: ['movies'],
    updated: '2026-11-02',
    blocks: [
      { t: 'h2', x: 'Three numbers decide what you pay' },
      {
        t: 'p',
        x: 'For a cinema ticket, the base price depends on the seat class and the show time, the platform adds a convenience fee per ticket, and the cinema may charge separately for food and beverage. Two apps selling the same show can therefore differ by the fee alone, while the base ticket stays identical.',
      },
      { t: 'h2', x: 'Checklist' },
      {
        t: 'ul',
        items: [
          'Seat class: recliner, premium and base seats are different products with different prices in the same hall.',
          'Show time: late-night and first-show pricing can differ from prime time on the same day.',
          'Convenience fee: usually per ticket, sometimes capped, rarely refundable along with a cancelled ticket.',
          'Cancellation window: some chains allow cancellation up to a cutoff before the show, others do not. Check before paying for a group.',
          'Food and beverage: outside food rules differ by chain and by state; a combo bought with the ticket is often cheaper than at the counter.',
          'Language and format: 3D, IMAX and dubbed versions carry different pricing for the same film.',
        ],
      },
      { t: 'h2', x: 'Accessible and companion seating' },
      {
        t: 'p',
        x: 'Wheelchair spaces and companion seats are usually sold in a separate quota rather than through the normal seat map, and some chains price them differently. If the seat map will not let you select an accessible seat, the cinema counter is the reliable route; buying a standard seat online and asking at the venue can leave you with a seat that cannot be changed at short notice.',
      },
      { t: 'h2', x: 'If the show is cancelled or you cannot attend' },
      {
        t: 'p',
        x: 'When a cinema cancels a show, the refund path runs through whoever sold the ticket, and the convenience fee is the part most often excluded. When you simply cannot attend, check the cancellation cut-off before the show: some apps allow cancellation until a fixed time before the start, others not at all, and a group booking is refunded as individual tickets rather than as one amount.',
      },
      { t: 'h2', x: 'Why a show sometimes shows no price' },
      {
        t: 'p',
        x: 'Cinema chains publish seat availability and pricing through different systems, and some list a show before pricing is released. When a show has no published price, we show the showtime and the booking link rather than a guessed number.',
      },
      { t: 'h2', x: 'Group bookings' },
      {
        t: 'p',
        x: 'Fees multiply per ticket, so for a family of five the platform fee can exceed the difference between two seat classes. Compare the final amount for the number of seats you actually need, not the single-ticket price.',
      },
    ],
  },
];

/** Lookup used by the renderer and by tests. */
import { INTENT_GUIDES } from './intentGuides';
GUIDES.push(...INTENT_GUIDES);

export const GUIDE_BY_SLUG: Record<string, Guide> = Object.fromEntries(GUIDES.map((g) => [g.slug, g]));

/** Slugs in publication order - used by the sitemap. */
export const GUIDE_SLUGS = GUIDES.map((g) => g.slug);
