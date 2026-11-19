# Play Store ASO — Try1Second (`com.try1second.try1second`)

Last refreshed: 19 Nov 2026 (app v1.8.102+109, 13 verticals incl. Nearby).

Everything here is paste-ready. The only parts a person must do are in the Play Console
checklist at the bottom — Play has no API for listing copy, screenshots or reviews.

---

## 1. App title (30 char limit)

**`Try1Second: Compare Prices`** (28/30)

Why this instead of "Compare Flights": the app now covers 13 verticals, and "compare prices"
matches the highest-volume generic query while the short description carries the verticals.
Brand stays first so the listing still ranks for "try1second".

Alternate if you want the travel angle back (one or the other, never both):
`Try1Second: Flights & Prices` (28/30)

## 2. Short description (80 char limit)

**`Compare live prices: flights, hotels, cabs, food, movies, grocery & nearby.`** (75/80)

Alternate with the "one second" hook:
`India's one-second price comparison: flights, hotels, food, movies, grocery.` (74/80)

## 3. Category, tags, contact

- Category: **Travel & Local** (primary). Secondary surface: **Shopping**.
- Content rating: Everyone.
- Tags (choose 5): price comparison, flight booking, hotel booking, deals, food delivery
- Contact email + website must be filled; Play weighs a complete listing.

## 4. Full description (4000 char limit)

```
Try1Second — India's one-second price comparison engine.

One search. Every live price. Always lowest first. Compare flights, hotels, cabs, buses, food delivery, groceries, online shopping, movie tickets, loans, insurance, credit cards and bank accounts — then book on the seller you already trust.

NEW · NEARBY
Open Nearby and the app uses your location straight away: restaurants, cafes, cinemas, stores, petrol pumps, CNG and EV charging, car and bike repair, tyres, battery, denting, car wash, detailing, PUCC centres, RTO offices, insurance offices, rentals and scrapping — all around you, with the cheapest option first. Every card opens the partner site or Google Maps, never a dead end.

COMPARE LIVE FLIGHT FARES
Any route — Indore to Delhi, Delhi to Mumbai, Bangalore to Goa — with live airfares from IndiGo, Akasa, Air India, SpiceJet, Expedia, Cleartrip, Yatra, Goibibo, Kiwi.com and more, side by side. Filter by price, stops, time and airline, then book direct. We never resell tickets.

COMPARE HOTEL PRICES
Live rates for any Indian city and your exact dates, lowest first, with a direct link to the booking site.

COMPARE CAB FARES
Ola, Uber, Rapido and regional operators for the same pickup and drop — city rides, airport runs, outstation.

COMPARE BUS TICKETS
redBus, zingbus, AbhiBus and state carriers for your route, with operator and timing filters.

COMPARE FOOD DELIVERY AND GROCERIES
The same dish or the same cart across Swiggy, Zomato, Blinkit, Zepto, Instamart and more — including DigiHaat — for your pincode. Delivery fee and surge included where the platform publishes them.

COMPARE MOVIE TICKETS
BookMyShow, TicketNew, District by Zomato and PVR for the same show. See the cheapest seat class per cinema, and which theatre that price belongs to, before you pay the convenience fee.

COMPARE SHOPPING PRICES
Amazon, Flipkart, Croma, Reliance Digital, Tata CLiQ, JioMart and the 10-minute stores for the exact product, with price history.

FINANCE WITHOUT GUESSWORK
Loans, credit cards, bank accounts and insurance compared on what you actually pay — interest, fees, eligibility — not on marketing claims.

EARN WHILE YOU COMPARE
Refer & Earn gives you a personal link. Every friend who joins with it adds 1 point, and 100 points unlock a prize spin. One referral, one point — nothing is credited without a real sign-up.

WHY TRY1SECOND
• Live prices, not cached guesses — every row is a price a seller reported now
• Lowest first, always, with the seller named next to the price
• No booking fee, no resale — you pay the seller directly
• Honest by design: if a source has no price, we show nothing rather than invent one

Built in India, for Indian routes, cities, pincodes and fees. Works from anywhere in the world for India bookings.

Questions or a price we missed: support@try1second.com
```

## 5. Visuals (conversion, not just ranking)

Screenshots convert on a clear promise plus a visible price. Order them this way, each
with a 3-6 word caption burned into the image (Play shows captions on the listing):

| # | Screen | Caption |
|---|--------|---------|
| 1 | Nearby list with a restaurant card and "Visit / book" | `Everything near you, cheapest first` |
| 2 | Movies compare with BEST PRICE + theatre name | `Same show, every platform's price` |
| 3 | Flight results, lowest fare on top | `Live airfares, ranked by price` |
| 4 | Grocery cart across Blinkit / Zepto / Instamart | `One cart, every store's total` |
| 5 | Rewards / Refer & Earn with a real link | `Invite a friend, earn a point` |
| 6 | Nearby vehicle services (petrol, CNG, EV) | `Fuel, repair, RTO around you` |
| 7 | Finance compare (loan / card) | `Fees and interest, side by side` |
| 8 | Search across verticals | `13 categories, one search` |

Feature graphic (1024×500): the words **"One search. Every price."** over the app UI, not a logo alone.
App icon: keep the stopwatch mark, high contrast at 48px, no text inside the icon.

## 6. What's new (release notes for the next upload)

```
v1.8.102+109
• Nearby now opens on your location with 18 vehicle-service categories, cinemas, stores and restaurants
• Every Nearby card opens the partner site or Google Maps
• Movies: the cheapest price now names the theatre it belongs to
• Refer & Earn shows your own link instantly; 100 points still needed for a spin
• Faster search, fewer blank cards, sharper photos
```

Keep each release note about the user, not the commit log. Play shows the last ~500 chars.

## 7. Ratings and reviews

- Ask inside the app after a successful comparison, not on launch.
- Reply to every 1-2 star review within 48h; Play's ranking uses response rate.
- Fix crashes before new features: Play down-ranks listings with a bad ANR/crash rate.
  Watch Android vitals weekly; the current build targets SDK 36 with a stable release keystore.

## 8. Play Console checklist (manual, one time)

1. **Store listing**: title, short + full description above; screenshots in the order above.
2. **App content**: privacy policy URL (`https://www.try1second.com/privacy`), data safety form
   (declare location for Nearby, email for sign-in, no ad ID if unused).
3. **App Links**: `https://www.try1second.com/.well-known/assetlinks.json` is live and lists the
   release keystore SHA-256 (`BC:22:41:...:5C:DE`) plus the debug/upload keys. Verify in
   Play Console → App Links that `/r/*` and `/?ref=` show as verified.
4. **Release**: upload the `.aab` (Play does not accept `.apk`), versionCode must increase.
5. **Store presence per country**: India primary; add UAE, Singapore, UK, US, Canada, Australia
   for the NRI flight audience.

## 9. How ASO and SEO reinforce each other

- The store listing and the site describe the same 13 verticals with the same words, so a search
  for "compare movie ticket prices" finds both.
- `/r/<code>` is the bridge: a shared link opens the app when installed and Play with the referrer
  when not, so web traffic becomes installs and referrals are attributed in both directions.
- City hubs on the site (`/flights/indore`, `/bus/indore`, `/nearby/restaurants/indore`) are the
  pages people land on from search; the app deep-links to the same verticals.
