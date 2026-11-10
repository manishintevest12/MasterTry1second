/**
 * QUERY-INTENT PAGES (owner 10 Nov, GSC report section 3.2): eleven searches where try1second.com had
 * "Koi URL nahi" - no page at all, so Google had nothing to rank. Each page below answers ONE search
 * phrase head-on (the phrase is in the title, the H1 slot and the first paragraph), is specific enough to
 * beat generic listicles, and then hands the reader to the live comparison.
 *
 * HONESTY RULES (same as guides.ts): no invented statistics, no prices, no claim to be "the best" or
 * "cheapest" - the defensible answer is that prices differ per route, date and seller and we show them
 * side by side. Seller names are the real sources the workers scan, and every page ends with the
 * metasearch caveat. Wording avoids naming a competitor as bad; it only describes how each category works.
 *
 * They are plain Guide objects, so routing (/guides/<slug>), sitemap, Article + FAQ JSON-LD and the
 * thin-content tests in tests/guidePages.test.ts apply to them without any new plumbing.
 */
import type { Guide } from './guides';

const UPDATED = '2026-11-10';
const CAVEAT =
  'Try1Second is a metasearch engine. We read the price each seller publishes and show them side by side; the booking, the payment and the terms belong to the seller you choose, and the seller page always wins if a price has moved.';

export const INTENT_GUIDES: Guide[] = [
  {
    slug: 'try1second-price-comparison',
    title: 'Try1Second Price Comparison: What It Is and How It Works',
    description:
      'Try1Second is an Indian price comparison engine for flights, hotels, buses, cabs, groceries, food, movies and finance. Here is what it compares, how, and what it does not do.',
    headline: 'What Try1Second compares, and how a result is built',
    verticals: ['flights', 'hotels', 'bus', 'cab', 'grocery', 'movies'],
    updated: UPDATED,
    blocks: [
      { t: 'h2', x: 'What is Try1Second?' },
      {
        t: 'p',
        x: 'Try1Second is a price comparison and metasearch site for India. You type one search, for example a flight route, a city for a hotel, or a bus journey, and it asks many sellers for their price for exactly that date and shows the answers on one screen. It covers flights, hotels, buses, cabs, groceries, food delivery, movie tickets, e-commerce, loans, insurance, credit cards and bank accounts.',
      },
      {
        t: 'p',
        x: 'It is not a booking company. When you pick an offer you leave for the seller\'s own site or app and complete the purchase there. That is why the price you see is the seller\'s published price and not a price we set.',
      },
      { t: 'h2', x: 'How does Try1Second price comparison work?' },
      {
        t: 'ul',
        items: [
          'You enter a route or product and a date. A search for one date never shows rows from another date.',
          'We query the sellers that publish that product live, read the price each returns, and drop any result that has no valid price.',
          'Rows are sorted by the effective price, and every row names the seller and opens the seller\'s own page.',
          'If a seller refuses to answer, the scan status says so instead of filling the gap with an old number.',
        ],
      },
      { t: 'h2', x: 'What does Try1Second not do?' },
      {
        t: 'ul',
        items: [
          'It does not sell tickets, rooms or products, so there is no booking fee from us.',
          'It cannot read a seller that hides prices behind a login or a bot check. Those sellers show as attempted, not as a fake price.',
          'It does not guarantee a price: inventory is repriced continuously, so confirm on the seller page before paying.',
        ],
      },
      { t: 'h2', x: 'How does Try1Second earn money?' },
      {
        t: 'p',
        x: 'When you buy through a link, the seller may pay a commission out of its own margin. It is not added to your checkout and it does not reorder results. Our affiliate disclosure page lists this in full.',
      },
      { t: 'p', x: CAVEAT },
    ],
  },
  {
    slug: 'best-flight-booking-comparison-website-india',
    title: 'Best Flight Booking Comparison Website in India: How to Judge One',
    description:
      'What a good flight comparison site in India must do: cover airlines and agents, respect your date, show the final fare and say what it cannot see. A checklist plus a live comparison.',
    headline: 'A checklist for choosing a flight comparison site in India',
    verticals: ['flights'],
    updated: UPDATED,
    blocks: [
      { t: 'h2', x: 'What makes a flight comparison website good in India?' },
      {
        t: 'p',
        x: 'No single flight site is cheapest for every route and every day. The same seat is sold by the airline and by several travel agents, and each adds its own fees and offers. A good comparison site is the one that shows many of them for your exact date and is honest about the ones it cannot read.',
      },
      {
        t: 'ul',
        items: [
          'Coverage: it should list airline sites and travel agents together. Try1Second scans airlines such as Air India, Akasa Air and IndiGo where readable, and agents such as ixigo, EaseMyTrip, MakeMyTrip, Goibibo, Yatra, Cleartrip, Kiwi, Gotogate and Aertrip.',
          'Date discipline: results for the date you searched, not a nearby cheaper date presented as yours.',
          'Final fare: the total after taxes and mandatory fees, not a base fare that grows at checkout.',
          'Transparency: it should tell you when a seller failed to answer.',
        ],
      },
      { t: 'h2', x: 'How do you compare flight prices properly?' },
      {
        t: 'ul',
        items: [
          'Compare the same fare class: a saver fare and a flexible fare are not the same product.',
          'Check baggage and change rules, because the cheapest row often excludes check-in baggage.',
          'Open the cheapest two or three rows on the seller site and compare the payable total.',
          'Re-check close to booking: airline fares move through the day.',
        ],
      },
      { t: 'h2', x: 'Why do two sites show different prices for the same flight?' },
      {
        t: 'p',
        x: 'Each seller applies its own mark-up, convenience fee and bank or wallet offers to the same base fare, and each caches its inventory for a different time. That is the reason to compare rather than to trust one site.',
      },
      { t: 'p', x: CAVEAT },
    ],
  },
  {
    slug: 'compare-flight-prices-india-all-websites',
    title: 'Compare Flight Prices in India Across All Websites in One Search',
    description:
      'How to compare flight prices across airlines and booking sites in one search for India routes, which sellers are included, and what to check before you pay.',
    headline: 'One search, many sellers: comparing flight prices across websites',
    verticals: ['flights'],
    updated: UPDATED,
    blocks: [
      { t: 'h2', x: 'Can I compare flight prices from all websites in one search?' },
      {
        t: 'p',
        x: 'Yes for the sellers that publish a readable price. Enter the route and date once and Try1Second asks the airline sites and the travel agents together, then lists the answers by price. No tool can show literally every website, because some sellers block automated price reads, so the scan status tells you which ones answered.',
      },
      { t: 'h2', x: 'Which sellers does the flight comparison cover?' },
      {
        t: 'ul',
        items: [
          'Airlines: Air India, Akasa Air, IndiGo, SpiceJet and others where their site allows reading the fare.',
          'Indian travel agents: ixigo, EaseMyTrip, MakeMyTrip, Goibibo, Yatra, Cleartrip, Aertrip.',
          'International agents: Kiwi, Gotogate, FlightNetwork, BudgetAir.',
        ],
      },
      { t: 'h2', x: 'How to use the comparison step by step' },
      {
        t: 'ul',
        items: [
          'Pick origin, destination and the exact travel date with the date picker.',
          'Let the scan finish: slower sellers arrive a few seconds after the first ones.',
          'Sort by price, then open the two or three cheapest rows on the seller site.',
          'Compare the payable total including baggage you need, then book on the seller you prefer.',
        ],
      },
      { t: 'h2', x: 'What mistakes make a flight comparison misleading?' },
      {
        t: 'ul',
        items: [
          'Comparing a saver fare on one site with a flexible fare on another. They look like the same flight and are not the same product.',
          'Ignoring baggage. A fare without check-in baggage can end up dearer than a slightly higher fare that includes it.',
          'Reading the first rows before the scan finishes. Slower sellers arrive later and can be cheaper.',
          'Forgetting layovers. A cheaper connecting itinerary costs time and carries a missed-connection risk if the legs are on separate tickets.',
        ],
      },
      { t: 'h2', x: 'When should I book after comparing?' },
      {
        t: 'p',
        x: 'Fares move through the day as seats sell, so a comparison is a snapshot, not a promise. If the cheapest row suits your timing and baggage, book it soon after you have confirmed the total on the seller page. If your date is flexible, repeat the search for the days either side and compare the result yourself, because a different date is a different search.',
      },
      { t: 'p', x: CAVEAT },
    ],
  },
  {
    slug: 'best-hotel-price-comparison-site-india',
    title: 'Best Hotel Price Comparison Site in India: What to Look For',
    description:
      'How to pick a hotel price comparison site in India: which sellers it should cover, why room prices differ, and how to compare the final payable amount for your dates.',
    headline: 'How to judge a hotel price comparison site in India',
    verticals: ['hotels'],
    updated: UPDATED,
    blocks: [
      { t: 'h2', x: 'What is the best hotel price comparison site in India?' },
      {
        t: 'p',
        x: 'The honest answer is the one that shows the most sellers for your dates and the final payable amount. The same room is listed by the hotel, by large booking sites and by budget chains, at different prices and cancellation terms. Try1Second compares OYO, Agoda, Booking.com, EaseMyTrip, Yatra, Goibibo and MakeMyTrip for the city and dates you pick.',
      },
      { t: 'h2', x: 'Why do hotel prices differ between sites?' },
      {
        t: 'ul',
        items: [
          'Taxes and service fees: some sites show a price before tax and some after.',
          'Cancellation rules: the cheaper rate is often non-refundable.',
          'Meal plan and room type: breakfast-included and room-only rates can look similar.',
          'Offers: bank, wallet and first-booking discounts change the payable total.',
        ],
      },
      { t: 'h2', x: 'How do I compare hotel prices for my dates?' },
      {
        t: 'p',
        x: 'Search the city, choose check-in and check-out with the date picker, and compare rows for the same number of guests and nights. Open the cheapest options on the seller site and compare the amount at the final payment step, including taxes and the cancellation rule.',
      },
      { t: 'h2', x: 'What should I check on the hotel page itself?' },
      {
        t: 'ul',
        items: [
          'The exact room name. A "deluxe" room on one site and a "standard" room on another can be the same room or different ones.',
          'The number of guests and nights the price was calculated for, since a per-night price and a total stay price look alike.',
          'Whether payment is online now or at the hotel. Pay-at-hotel often carries a different tax treatment and a different cancellation rule.',
          'Recent guest reviews, because a lower price at a poorly rated property is rarely a saving.',
        ],
      },
      { t: 'h2', x: 'Is the cheapest listed price always the best deal?' },
      {
        t: 'p',
        x: 'Not always. A slightly higher rate with free cancellation or breakfast included can cost less in practice than a non-refundable room you may have to rebook. Use the comparison to find the price range across sellers, then decide on the terms that matter for your trip.',
      },
      { t: 'p', x: CAVEAT },
    ],
  },
  {
    slug: 'best-bus-ticket-price-comparison-site-india',
    title: 'Best Bus Ticket Price Comparison Site in India: redBus, AbhiBus, zingbus and More',
    description:
      'Compare bus ticket prices across redBus, AbhiBus, zingbus and MakeMyTrip for an Indian route and date, and learn which fees and seat types change the fare.',
    headline: 'Comparing bus ticket prices across the main Indian bus sellers',
    verticals: ['bus'],
    updated: UPDATED,
    blocks: [
      { t: 'h2', x: 'Which site is best for comparing bus ticket prices in India?' },
      {
        t: 'p',
        x: 'Bus tickets are sold by several platforms for the same operator and the same seat, so the cheapest platform changes by route and day. Try1Second reads redBus, AbhiBus, zingbus and MakeMyTrip for your route and date and lists the operators with their departure time, bus type and price.',
      },
      { t: 'h2', x: 'What changes the price of a bus ticket?' },
      {
        t: 'ul',
        items: [
          'Bus type: seater, sleeper, AC and non-AC are different products on the same route.',
          'Boarding and drop point: the cheaper row may board far from where you expect.',
          'Convenience fee and offers: platforms add a fee or apply a coupon at checkout.',
          'Demand: weekends and festivals reprice seats during the day.',
        ],
      },
      { t: 'h2', x: 'How do I compare bus tickets for my route?' },
      {
        t: 'p',
        x: 'Enter the two cities and the travel date. Compare rows with the same bus type and a similar departure time, then open the cheapest ones on the platform and check the boarding point and the total payable amount.',
      },
      { t: 'h2', x: 'How do I avoid common bus booking problems?' },
      {
        t: 'ul',
        items: [
          'Confirm the boarding point and a contact number for the operator before the day of travel.',
          'Check the cancellation window. Many operators refund less as departure gets closer.',
          'Pick the seat deliberately: window, aisle, lower berth and upper berth are priced differently on some services.',
          'Read recent ratings for the operator, because buses with the same name can run different quality of service.',
        ],
      },
      { t: 'h2', x: 'Should I book a bus early or on the day?' },
      {
        t: 'p',
        x: 'On busy routes and around weekends and festivals, seats and cheaper fares go first, so booking ahead usually keeps more choice. On quieter weekdays, last-minute prices can be steady. A fresh comparison on the day you travel will show what is actually left and what each platform charges.',
      },
      { t: 'p', x: CAVEAT },
    ],
  },
  {
    slug: 'best-company-for-hotel-booking-in-the-world',
    title: 'Best Company for Hotel Booking in the World: An Honest Answer',
    description:
      'Which company is best for hotel booking worldwide? Why no single site wins every city and date, who the big names are, and how to find the lowest price for your own dates.',
    headline: 'Why there is no single best hotel booking company',
    verticals: ['hotels'],
    updated: UPDATED,
    blocks: [
      { t: 'h2', x: 'Which is the best company for hotel booking in the world?' },
      {
        t: 'p',
        x: 'There is no single best company. The largest hotel booking companies, such as Booking.com, Expedia Group (which includes Hotels.com) and Agoda, each have the deepest inventory in different regions, and each runs its own offers. Which one is cheapest depends on the city, the dates, the cancellation rule and the day you search.',
      },
      { t: 'h2', x: 'How do you pick the right hotel booking company?' },
      {
        t: 'ul',
        items: [
          'Regional strength: some companies list more properties in Asia, others in Europe or the Americas.',
          'Cancellation terms: free cancellation is worth more than a small saving on a fixed rate.',
          'Loyalty and offers: member prices and bank offers can beat the public price.',
          'Final payable amount: compare after taxes and fees, not the headline rate.',
        ],
      },
      { t: 'h2', x: 'How can I find the lowest hotel price for my dates?' },
      {
        t: 'p',
        x: 'Instead of choosing one company, compare them for your own dates. Try1Second shows the same stay across sellers like Booking.com, Agoda, OYO, MakeMyTrip, Goibibo, Yatra and EaseMyTrip side by side, so the cheapest for your dates is visible at once.',
      },
      { t: 'h2', x: 'What do "best" lists usually leave out?' },
      {
        t: 'ul',
        items: [
          'Many rankings measure company size or revenue, which says nothing about the price of your specific room on your specific night.',
          'Some lists are built from affiliate earnings, so the order can reflect who pays the publisher rather than who is cheapest for you.',
          'Customer-service quality matters when a booking goes wrong, and it differs by company and by country.',
          'The hotel\'s own website can be cheaper, particularly for direct-booking offers, and a booking-site comparison does not always include it.',
        ],
      },
      { t: 'h2', x: 'What is a sensible way to choose?' },
      {
        t: 'p',
        x: 'Shortlist the property first, then compare the total payable price and cancellation rule across sellers for your dates. If two options are close, prefer the one with free cancellation and clear terms. That approach does not depend on any single company being the best.',
      },
      { t: 'p', x: CAVEAT },
    ],
  },
  {
    slug: 'best-hotel-company-in-maharashtra',
    title: 'Best Hotel Booking Company for Maharashtra: Mumbai, Pune, Nagpur and More',
    description:
      'How to find the best hotel price in Maharashtra across booking sites for Mumbai, Pune, Nagpur, Nashik and other cities, and what makes rates differ by city and date.',
    headline: 'Finding the best hotel price across Maharashtra cities',
    verticals: ['hotels'],
    updated: UPDATED,
    blocks: [
      { t: 'h2', x: 'Which hotel company is best in Maharashtra?' },
      {
        t: 'p',
        x: 'It depends on the city and the dates. Mumbai and Pune have deep inventory on every large booking site, while smaller cities such as Nashik, Aurangabad or Kolhapur lean on budget chains and local listings. Rather than trusting one name, compare the same stay across the sellers that list that city.',
      },
      { t: 'h2', x: 'Why do hotel rates in Maharashtra change so much?' },
      {
        t: 'ul',
        items: [
          'Events and weekends: Mumbai and Pune rates move sharply around weekends, conferences and festivals.',
          'Season: hill and coastal stays such as Lonavala and Alibag reprice with the monsoon and holiday weeks.',
          'Locality: rooms near stations, airports and business districts cost more than a few kilometres away.',
        ],
      },
      { t: 'h2', x: 'How do I compare hotels in a Maharashtra city?' },
      {
        t: 'p',
        x: 'Search the city, set check-in and check-out, and compare rows for the same guests and nights. Open the cheapest few on the seller site and compare the final payable amount and the cancellation rule. Try1Second lists OYO, Agoda, Booking.com, MakeMyTrip, Goibibo, Yatra and EaseMyTrip where they have inventory for your dates.',
      },
      { t: 'h2', x: 'What should I check for a Maharashtra stay?' },
      {
        t: 'ul',
        items: [
          'Distance to your actual destination. Mumbai in particular is long, and a cheaper hotel in a distant suburb can add hours of travel.',
          'Check-in and check-out times, which matter for early flights and late trains.',
          'Parking and access if you are driving, especially in dense areas of Pune and South Mumbai.',
          'Cancellation rules for monsoon and festival weeks, when plans change often.',
        ],
      },
      { t: 'h2', x: 'Is it better to book a chain or an independent hotel?' },
      {
        t: 'p',
        x: 'Chains offer consistency and easier rebooking; independent properties can offer better value or location. The comparison shows both side by side with the seller and price, so you can weigh price against terms. Read recent reviews for the specific property rather than relying on the brand name alone.',
      },
      { t: 'p', x: CAVEAT },
    ],
  },
  {
    slug: 'indore-to-bhopal-bus-ticket-price-comparison',
    title: 'Indore to Bhopal Bus Ticket Price Comparison: Operators, Types and Fares',
    description:
      'Compare Indore to Bhopal bus tickets across redBus, AbhiBus, zingbus and more: bus types, departure times, boarding points and how to pick the right fare.',
    headline: 'Comparing Indore to Bhopal bus tickets across platforms',
    verticals: ['bus'],
    updated: UPDATED,
    blocks: [
      { t: 'h2', x: 'How do I compare Indore to Bhopal bus ticket prices?' },
      {
        t: 'p',
        x: 'Indore to Bhopal is one of the busiest intercity bus routes in Madhya Pradesh, with seater, sleeper and AC services through the day and night. Choose your travel date on Try1Second and it lists the operators with departure time, bus type and price from redBus, AbhiBus, zingbus and the other platforms that sell the route.',
      },
      { t: 'h2', x: 'What should I check before choosing a bus?' },
      {
        t: 'ul',
        items: [
          'Bus type and seat: an AC sleeper and a non-AC seater are very different journeys.',
          'Boarding point: Indore services board at different points across the city, so check it against where you will be.',
          'Departure and arrival time: night buses reach Bhopal early morning, day services run through the afternoon.',
          'Cancellation and refund policy on the platform you book through.',
        ],
      },
      { t: 'h2', x: 'Is it cheaper to book on one platform than another?' },
      {
        t: 'p',
        x: 'It can be. The same operator is often listed on more than one platform, and each applies its own convenience fee and offers. That is why the comparison shows the same bus across sellers, so you can open the cheapest one and confirm the total at checkout.',
      },
      { t: 'h2', x: 'How long is the journey and what affects it?' },
      {
        t: 'p',
        x: 'The road journey between the two cities typically takes a few hours, and the exact time depends on the service, the number of stops and traffic at the start and end of the trip. Express and direct services run faster than those that stop at several towns, so read the arrival time on the listing, not just the departure.',
      },
      { t: 'h2', x: 'What are good habits for this route?' },
      {
        t: 'ul',
        items: [
          'Search the exact date, because weekend and festival evenings fill earlier than weekday services.',
          'Compare at least two platforms for the same operator and time before paying.',
          'Reach the boarding point early and keep the operator\'s contact number to hand.',
          'If you travel often, compare both day and night services, since the price and bus type can differ.',
        ],
      },
      { t: 'p', x: CAVEAT },
    ],
  },
  {
    slug: 'compare-grocery-prices-hyderabad-blinkit-zepto-instamart',
    title: 'Compare Grocery Prices in Hyderabad: Blinkit, Zepto, Instamart and BigBasket',
    description:
      'How to compare grocery prices in Hyderabad across Blinkit, Zepto, Swiggy Instamart and BigBasket: delivery fees, pack sizes, minimum order and why basket totals differ.',
    headline: 'Comparing a Hyderabad grocery basket across quick-commerce apps',
    verticals: ['grocery'],
    updated: UPDATED,
    blocks: [
      { t: 'h2', x: 'How do I compare grocery prices in Hyderabad?' },
      {
        t: 'p',
        x: 'Quick-commerce apps price the same item differently by dark store, pack size and time of day. Search the product on Try1Second with your Hyderabad location and it lists the price from Blinkit, Zepto, BigBasket and the other grocery sellers that deliver to that area, so you can pick the cheapest for each item.',
      },
      { t: 'h2', x: 'Why does a grocery basket cost different amounts on each app?' },
      {
        t: 'ul',
        items: [
          'Pack size: a 500 g and a 1 kg pack of the same brand are different unit prices.',
          'Delivery, handling and small-cart fees: a cheaper item can lose to a lower fee.',
          'Minimum order value and free-delivery thresholds differ per app.',
          'Local stock: each store carries a different range, so an item can be missing.',
        ],
      },
      { t: 'h2', x: 'How do I compare fairly?' },
      {
        t: 'p',
        x: 'Compare the price per unit (per kg or per litre) for the same brand and size, then add the delivery and handling fees at checkout. For a large basket one app may win; for one or two items another often does.',
      },
      { t: 'h2', x: 'What else should I check before ordering?' },
      {
        t: 'ul',
        items: [
          'Expiry and freshness information on perishables, which differs by store and batch.',
          'Brand and variant. Two listings with similar names can be different products.',
          'Delivery slot and surge. Late-night and rain-time orders may carry extra charges.',
          'Substitution policy: some apps replace an out-of-stock item with another brand unless you decline.',
        ],
      },
      { t: 'h2', x: 'Is it worth splitting an order across apps?' },
      {
        t: 'p',
        x: 'Only when the saving outweighs the second delivery fee. For a large weekly basket a single app is usually simpler; for a few high-priced items, the price difference between apps can justify ordering them separately. Compare the per-unit price and the fees first, then decide.',
      },
      { t: 'p', x: CAVEAT },
    ],
  },
  {
    slug: 'best-price-comparison-website-india',
    title: 'Best Price Comparison Website in India: What to Compare and Where',
    description:
      'A practical look at price comparison websites in India: what categories exist, how they earn money, how to tell a useful one from a listicle, and where a multi-category comparison fits.',
    headline: 'How to choose a price comparison website in India',
    verticals: ['flights', 'hotels', 'grocery', 'ecommerce'],
    updated: UPDATED,
    blocks: [
      { t: 'h2', x: 'What is the best price comparison website in India?' },
      {
        t: 'p',
        x: 'It depends on what you are buying. Some sites specialise in one category such as phones or flights, and some compare several. The signs of a useful one are live prices for your exact date or location, the name of every seller, a visible final price, and honesty about sellers it cannot read.',
      },
      { t: 'h2', x: 'What should a price comparison website show?' },
      {
        t: 'ul',
        items: [
          'The seller on every row, with a link to the seller\'s own page.',
          'A price that is read live, not a static list from last month.',
          'Date or location awareness: a flight or hotel price is meaningless without a date.',
          'A clear disclosure of how the site earns money.',
        ],
      },
      { t: 'h2', x: 'Where does Try1Second fit?' },
      {
        t: 'p',
        x: 'Try1Second compares across categories in one place: flights, hotels, buses, cabs, groceries, food, movie tickets, e-commerce and finance products. It shows the seller on each row, hides results that have no valid price, and tells you when a seller could not be read.',
      },
      { t: 'h2', x: 'How can I tell a useful comparison page from a generic list?' },
      {
        t: 'ul',
        items: [
          'A useful page lets you search your own product, route or city and returns prices, not just a list of site names.',
          'It says when it was last updated and when a price was read.',
          'It shows which seller each price belongs to and links to that seller.',
          'It admits what it cannot see, instead of implying that it covers the entire market.',
        ],
      },
      { t: 'h2', x: 'How should I use a comparison site?' },
      {
        t: 'p',
        x: 'Treat it as a fast way to find the two or three sellers worth opening, then confirm the final payable amount on the seller page. A comparison saves the time of opening a dozen tabs; it does not replace reading the seller\'s terms for fees, delivery, cancellation and returns.',
      },
      { t: 'p', x: CAVEAT },
    ],
  },
  {
    slug: 'best-movie-ticket-price-comparison-india',
    title: 'Best Movie Ticket Price Comparison in India: BookMyShow, District and TicketNew',
    description:
      'How to compare movie ticket prices in India across BookMyShow, District, TicketNew and cinema chains: convenience fees, seat categories and show timings that change the total.',
    headline: 'Comparing movie ticket prices across booking apps',
    verticals: ['movies'],
    updated: UPDATED,
    blocks: [
      { t: 'h2', x: 'How do I compare movie ticket prices in India?' },
      {
        t: 'p',
        x: 'The same show can be sold by more than one app, each with its own convenience fee and offers. Choose your city and film on Try1Second and it lists the cinemas and shows with the seller, so you can see which app sells that showtime and at what seat price.',
      },
      { t: 'h2', x: 'Why do movie ticket totals differ between apps?' },
      {
        t: 'ul',
        items: [
          'Convenience fee: it is added on top of the ticket and differs by app.',
          'Seat category: recliner, premium and regular seats are different prices in the same hall.',
          'Offers: bank, wallet and membership discounts apply on some apps only.',
          'Timing: weekend and evening shows are priced higher than weekday matinees.',
        ],
      },
      { t: 'h2', x: 'What should I check before paying?' },
      {
        t: 'p',
        x: 'Match the same cinema, showtime and seat category, then compare the total at the final payment step including the convenience fee. Some sellers show only a starting seat price, so treat a quoted figure as a starting point until the seat map confirms it.',
      },
      { t: 'h2', x: 'Which shows cost less?' },
      {
        t: 'ul',
        items: [
          'Weekday matinee shows are usually priced below weekend evening shows at the same cinema.',
          'Standard seats cost less than recliners and premium seats, so compare the same category.',
          'Smaller multiplexes and single screens can price below large premium chains for the same film.',
          'New releases on opening weekend often carry higher prices and fill fast.',
        ],
      },
      { t: 'h2', x: 'How do I avoid paying more than needed?' },
      {
        t: 'p',
        x: 'Check the convenience fee at the last step, look for card or wallet offers on the app you are using, and compare the total with a second seller if the same show is listed there. Booking early for popular shows also keeps your seat choice, which can matter more than a small difference in fee.',
      },
      { t: 'p', x: CAVEAT },
    ],
  },
];
