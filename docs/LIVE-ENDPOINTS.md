# Live Endpoint Playbook

Every browserless acquisition recipe that WORKS today, so future work never
re-recon's a cracked source. Endpoint-level details live in each parser file
(named in brackets). Scorecard: Ecom 5, Hotels 4, Flights 4, Bus 3, Cab 4,
Food 4, Grocery 4/5, Movies 5, Loans 7, Insurance 6 live.

Rules that made these work: curl_cffi `impersonate:'chrome'` first (cffi is the
primary transport), reverse-engineer the site's own public JS bundle for keys,
never invent data. Blocked = honest ACCESS_CHALLENGE probe, never mock.

## Flights
- **Ixigo** [ixigoFlights.ts] — per-flight fares via Ixigo API; metasearch →
  seller=airline, deeplink=airline site.
- **EaseMyTrip** [emtAirbus.ts] — POST gi.easemytrip.com/etoken/GIT (static ATK)
  → {ITK,b}; POST /GUT (autk = AES-128-CBC "EMT|secret|ip|token", key/iv from
  SearchJS.js) → {STK}; POST flightservice-node.easemytrip.com/AirAvail_Lights/
  Airbus_New {FlightRQ: org/dept IATA, deptDT, TKN:STK, Cabin:3} → j[].s[]
  flights, lstFr[].TF INR. 40 offers. Fare-calendar fallback [emtFareCalendar.ts].
- **IndiGo** [indigoFlights.ts] — session POST /v2/token/create (User_key =
  session key; body subscriptionKey=booking key) → JWT; booking POST
  /v1/getfarecalendar (User_key=booking key, Bearer; body ISO startDate/endDate,
  lowestIn:'M') → data.lowFares 63-day per-day fares. Gotchas: ISO dates NOT
  yyyyMMdd, flat body NOT FlightInfoPayload, header spelled User_key.

- **Expedia flights** [expediaFlights.ts + expediaFlightsQuery.ts] (NEW 14 Oct 2026):
  GET /Flights-Search?flight-type=oneway&from-date=YYYY-MM-DD&from=<City (IATA)>&to=<City (IATA)>&search-type=arsed&mode=search
  (safari impersonation; the plain form WITHOUT search-type/mode redirects to /Flights)
  → primes Akamai cookies + DUAID; then POST www.expedia.com/graphql operationName
  FlightsSearchResultsLoadedQuery with client-info flights-shopping-pwa,f658986df...,
  x-page-id page.Flights-Search,F,20 and the EXACT 73KB document the PWA ships
  (237 fragments reconstructed from c.travel-assets.com/flights-shopping-pwa/*.js —
  introspection is disabled, the document IS the schema contract). Variables:
  journeyCriteria [{departureDate{day,month,year}, destination, origin IATA}],
  travelerDetails [{ages:null, count:1, travelerType:"ADULT"}], searchPagination.
  listings[] on FlightsStandardOffer: priceDisplay.rows[].elements[].price.text
  ($ USD), graphic (Mark) = airline name+logo, secondarySection
  FlightShoppingCardDurationTimeline = dep/arr time + stops + duration.
  Expedia is the price-owning OTA: seller=Expedia, deeplink=expedia.com SRP;
  USD→INR via live fxRates with attribution data_note.
  NOTE: heavy SRP probing gets the whole expedia.com domain Akamai-rate-sampled
  (429 Bot or Not?) on the sandbox IP for 30+ min — capture sparsely.

- **Akasa Air** [akasaFlights.ts] — GET prod-bl.qp.akasaair.com/api/ibe/
  availability/v2/search?origin=&destination=&startDate=<ISO with %2B05:30 —
  bare yyyy-mm-dd is a 400>&numberOfPassengers=1&channel=WEB&currencyCode=INR
  → XML 61-day low-fare calendar (data[].date/price, noFlights/soldOut flags).
  Per-flight POST availability/search needs token/generateToken → nginx 403
  from datacenter IPs (do NOT re-recon without a new angle).

## Bus
- **AbhiBus** [abhibus.ts] — edge.abhibus.com API, per-bus fares.
- **redBus** [redbusSearch.ts] — GET /rpw/api/citySuggestion?search=X (Solor
  docs[].ID) → POST /rpw/api/searchResults (body {}) → data.inventories[]
  per-bus. Tarpits on some IPs → SEO route-page fallback [redbusRoute.ts].
- **zingbus** [zingbus.ts] — /bus-tickets/<from>-to-<to>-bus-route
  __NEXT_DATA__.pTableData route-level min/max fare.

## Cab
- **Savaari** [savaariCabs.ts] — JSON-LD FAQ flat fares. **QuickRide**
  [quickRideCabs.ts] — SSR fare table. **BharatTaxi** [bharatTaxi.ts] —
  bharattaxi.com/{from}/to/{to} SSR flat fares (legacy-spelling aliases).
  **OSRM** [osrmCab.ts] — distance → fare estimate.

## Hotels
- **Cleartrip** [cleartripHotels.ts], **Airbnb** [airbnbHotels.ts] (SSR),
  **Booking.com** [booking.ts] (works with cffi primary transport),
  **Ixigo** [ixigoHotels.ts] — __NEXT_DATA__ on /hotels/hotels-in-<city>.
- **Expedia.com + Hotels.com** [expediaGroup.ts] (NEW 14 Oct 2026): same Expedia Group
  "shopping-pwa" LodgingCard GraphQL. Recipe: GET /Hotel-Search?destination=<city>,%20India
  (Akamai Bot Manager blocks chrome TLS from datacenter IPs with 429 "Bot or Not?"; accepts
  safari on expedia.com, safari17_0 / chrome_android fallback on hotels.com - primes
  _abck/bm cookies + DUAID), then POST /graphql operationName LodgingPropertySearch with
  client-info shopping-pwa,<hash>,us-east-1|us-west-2, x-page-id page.Hotel-Search,H,20;
  variables context{currency USD, siteId/tpid 1 (expedia) or 19 (hotels.com)} + criteria
  destination{regionName "<city>, India"}. Response propertySearchListings[] on LodgingCard:
  headingSection.heading, priceSection.priceSummary.options[0].displayPrice.formatted,
  mediaSection.gallery.media[0].media(Image).url, cardLink.resource.relativePath (rich
  deeplink incl. dates). Introspection disabled; fields mapped via live validation errors
  + SSR __PLUGIN_STATE__. 50 priced cards per query per site; prices display USD.
  Policy: one site for metadata, others price-only.
  INR display: .com storefronts list USD even under context.currency INR (siteId 1/19
  overrides), so the worker fetches a LIVE USD/INR rate (server/common/fxRates.ts,
  open.er-api.com -> exchangerate-api fallback, 60-min cache, sanity band 20-200)
  and the parser converts, stamping the exact listed USD price, live rate and rate
  source into data_note. FX sources all fail => offer stays USD as listed (never a
  guessed rate).

## Food
- **Swiggy** [swiggy.ts] — search API, 6MB per-request memory override.
- **Zomato** [zomato.ts] — restaurant pages deep-dived, prices from JSON-LD
  hasMenu / __PRELOADED_STATE__.
- **Domino's** [dominos.ts] — dominos.co.in/menu full national menu SSR
  (html.unescape + productMasterUID regex).
- **Pizza Hut** [pizzaHut.ts] — /menu/pizzas __NEXT_DATA__ itemsByKind.
- **Toing** [toing.ts] — Swiggy's budget food app (in.swiggy.android.toing), reverse-
  engineered from APK v4.119.0. Same disc.swiggy.com backend, no auth:
  POST /api/v1/json/shell/toing-app?lat&lng body {} (home feed; cursor pagination via
  body {pageOffset: success.pageOffset.nextOffset, widgetOffset: ...widgetOffset});
  POST /api/v2/dynamicmenu/{restaurantId}?lat&lng body {} (full menu). Prices in PAISE
  (÷100). Requires Accept+Content-Type application/json (else 415). App-only platform:
  offers labelled 'available only on app', sellerUrl -> toingit.com landing.
  NOTE: global dish-search REST not found; query filtering is client-side over the
  shell feed featured dishes + per-restaurant dynamicmenu deep-dive.

## Grocery
- **Instamart** [swiggy.ts grocery] — instamart.swiggy.com home/v2 +
  campaign/listing/v2 + layout/v2 (no auth). Products nest at JSON depth 13.
- **Blinkit** [blinkit.ts] — POST /v1/layout/search?q= (app_client=consumer_web
  + lat/lon). Chrome→safari17_0→chrome110 fingerprint retry ladder.
- **BigBasket** [bigbasket.ts] — 3-step cookie handshake (homepage →
  serviceable → _bb_addressinfo/_bb_pin_code/_bb_lat_long → listing-svc/v2).
- **QuickCommerce API** [grocery.ts] — api.quickcommerceapi.com/v1/search
  (needs QUICKCOMMERCE_API_KEY in hPanel; /v1/health-status public).

## E-commerce
- **Amazon.in** [amazonIn.ts], **Flipkart** [flipkart.ts], **Ajio** [ajio.ts],
  **Myntra** [myntra.ts] (__myx brace-matching), **TataCLiQ** [tatacliq.ts] —
  searchbff.tatacliq.com/v2/products/mpl/search; X-ACCESS-TOKEN = AES-192-CBC
  of epoch-seconds, key in client js module 72124, zero IV, Node auto-PKCS7.

## Movies
- **District/Paytm gateway mesh** [district.ts, districtGw.ts] — REAL seat
  prices ₹92-₹699, 90 shows, no login. **TicketNew** [ticketnew.ts],
  **Cinepolis** [cinepolis.ts], **BMS** [bookmyshow.ts] (deeplinks only),
  **IMDb** [imdbRatings.ts] — Wikidata P345 → official dataset.

## Loans / Insurance
- BankBazaar [bankbazaarLoans.ts, bankbazaarInsurance.ts], Paisabazaar,
  Policybazaar, Bajaj Finserv, Money View, KreditBee (publishedRates.ts),
  InsuranceDekho, Acko, Digit, HDFC Ergo — SSR scrape + rate-extraction
  (extractRateRange needs no 'p.a.' suffix).

## Known-blocked (honest probes, do NOT re-recon without new angle)
### Flights deep-recon verdicts (14 Oct 2026, after Expedia flights went live)
- MakeMyTrip flights — BLOCKED from datacenter IPs: /flight/search?itinerary=...
  serves a 6-byte "200-OK" application/json stub from AkamaiGHost; Googlebot UA
  gets HTTP/2 reset; SEO pages (cheap-flights-*.html) are static marketing, no
  live fares; the SPA shell (fetchable via POST /api/search/flight/search)
  contains only the client app, no SSR fare data; app host
  flights-cb.makemytrip.com exposes ONLY GET /api/pre-search-validation
  (Go validator oracle, 'FlightSearchRequest.Itinerary required'; all other
  paths default 400 {"Response":"Bad Request"}); PWA chunk sets on
  jsak.mmtcdn.com are open but the federated search widget contains no fare
  API. Probe w_flights_makemytrip attempts the live SRP URL each search.
- Goibibo flights — BLOCKED: www.goibibo.com/flights/* = HTTP/2 stream reset or
  504 AkamaiGHost (edge accepted, origin tarpits); forced HTTP/1.1 hangs;
  m.goibibo.com 503; flights.goibibo.com 403 "Access Denied" (Akamai) on all
  paths incl. app-header POSTs; api.goibibo.com 503 "DNS failure" (origin gone);
  gfs/fss/gateway/flight-scanapi hosts do not resolve. Probe w_flights_goibibo
  attempts the live SRP URL each search. Both MMT-group sites: retest only from
  a new IP (production Hostinger pull) — gate is IP-reputation based.
Akamai/Bot-Manager: MMT, Goibibo, Yatra (HTTP/2 reset), Agoda (graphql gate
headers cracked but needs runtime-built document), Trip.com, Marriott, Hilton,
Trivago (/gw/graphql), Kayak, Skyscanner, Zepto (Kong 429), Flipkart Minutes,
Meesho, Instamart search/collection (202), api-prod-flight host search,
Cleartrip flights (all /flights/* paths 403 Akamai from datacenter IPs while
/hotels/* paths pass — route-level SEO pages 403 too),
MMT bus 16KB shell, BMS quickbook, redBus protobuf capi. Akamai _abck sensor
needs real JS execution — out of browserless scope; retry only from new IPs.

## Deals acquisition — cross-vertical probe (14 Oct 2026)

Browserless cffiFetch probes of public offer/coupon pages. Verdicts are from the
actual HTML served (samples inspected before discarding):

- redBus /offers — BLOCKED: offer cards render client-side; SSR shell only (nav markup, no offer JSON).
- Domino's /coupons — JS-SHELL: landing marketing text ("2 Regular Pizza @99") but no structured coupon list in HTML.
- Pizza Hut /deals — JS-SHELL: same; body hidden pending client render.
- EaseMyTrip /offers.html — BLOCKED: offers injected by JS; no flat-offer text in raw HTML.
- Ixigo / MMT / Goibibo offers — BLOCKED: __NEXT_DATA__/JS-driven offers not present in served HTML snapshot.
- Cleartrip /offers — BLOCKED (Akamai shell).
- Paisabazaar card/loan promo pages — SSR HTML present but promo blocks are lead-gen modules, not discrete offers.
- BigBasket offers — BLOCKED: app-gated JS shell.

Live deal sources therefore remain the ecommerce set (Amazon, Myntra, TataCLiQ)
with the favicon image fallback. Any further cross-vertical deals need a
different acquisition path (sitemap coupons endpoints, mobile API reversing) —
tracked as future work, no mock substitutes.

## Flights worldwide + seller policy (15 Oct 2026)
- **Global route resolution**: `server/common/airportLookup.ts` resolves ANY world city to IATA + country (static Indian map → OpenFlights airports.dat, 24h cache, preferred-hub ranking for multi-airport cities). All flight workers (EMT, Ixigo, IndiGo, Expedia, Akasa) resolve routes through it — "Dubai to London" now returns live fares. Akasa honestly skips non-Indian routes (domestic carrier).
- **Seller policy (owner, 15 Oct)**: the seller shown on every flight offer is the TICKET-SELLING WEBSITE (EaseMyTrip, Ixigo, Expedia, Akasa Air, IndiGo), never the operating airline. Airline name stays in the title/brand. EMT listing deeplink carries per-country labels (airports.dat country, e.g. `srch=DXB-Dubai-United%20Arab%20Emirates|LHR-London-United%20Kingdom|...`).
- **EMT_AIRLINES expanded** to ~70 carriers (all majors incl. EK, QR, EY, BA, LH, SQ, TK…); unknown IATA codes keep the raw code in the title — never invented names.

## Kiwi.com flights — LIVE (15 Oct 2026)
**server/workers/parsers/kiwiFlights.ts** — Kiwi's internal searchey GraphQL is fully open browserless, no auth, ~800ms, INR prices, ANY world route. POST https://api.skypicker.com/umbrella/v2/graphql (Origin/Referer kiwi.com) with `onewayItineraries(search, options)`: places as `Station:airport:<IATA>` ids (our global resolver feeds it directly); options `{partner:'skypicker'}` required ('picky' rejected), `currency:'INR'`; DateTime format `YYYY-MM-DDTHH:MM:SS` — trailing 'Z' is REJECTED. Response itineraries[]: sector.carriers (airline names+IATA), sectorSegments[].segment (code=bare flight number, utcTimeIso, station IATA), price.amount INR, bookingOptions.edges[0].node.bookingUrl (relative per-itinerary booking token → prefix https://www.kiwi.com). GraphQL introspection is ENABLED — schema was fully mapped that way. Seller = Kiwi.com (ticket-selling website, owner policy); airline in title/brand. Live-verified: DEL→DXB 31 itineraries (cheapest 6E ₹19124, grouped with EMT/Ixigo offers), LHR→JFK 49 (cheapest Avianca ₹66690). Worker w_flights_kiwi, fixture tests/kiwiFlights.test.ts.
