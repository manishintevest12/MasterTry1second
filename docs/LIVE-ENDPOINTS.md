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
  Policy: one site for metadata, others price-only.

## Food
- **Swiggy** [swiggy.ts] — search API, 6MB per-request memory override.
- **Zomato** [zomato.ts] — restaurant pages deep-dived, prices from JSON-LD
  hasMenu / __PRELOADED_STATE__.
- **Domino's** [dominos.ts] — dominos.co.in/menu full national menu SSR
  (html.unescape + productMasterUID regex).
- **Pizza Hut** [pizzaHut.ts] — /menu/pizzas __NEXT_DATA__ itemsByKind.

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
Akamai/Bot-Manager: MMT, Goibibo, Yatra (HTTP/2 reset), Agoda (graphql gate
headers cracked but needs runtime-built document), Trip.com, Marriott, Hilton,
Trivago (/gw/graphql), Kayak, Skyscanner, Zepto (Kong 429), Flipkart Minutes,
Meesho, Instamart search/collection (202), api-prod-flight host search,
Cleartrip flights (all /flights/* paths 403 Akamai from datacenter IPs while
/hotels/* paths pass — route-level SEO pages 403 too),
MMT bus 16KB shell, BMS quickbook, redBus protobuf capi. Akamai _abck sensor
needs real JS execution — out of browserless scope; retry only from new IPs.
