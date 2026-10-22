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
### Rapido (Cab & Ride) — app-only, honest empty source (re-verified 15 Oct)
- www.rapido.bike is a Next.js marketing site. Full bundle scan (Home.js 116KB, commons 592KB, main 38KB): the ONLY web APIs are captain (DRIVER) signup flows (/api/captainSignup, /api/otp, /api/event) plus internal hosts (rapido-entities.svc.production.internal, darwinbox HR, param.ai). No rider fare/estimate API exists on the web surface.
- Policy: rider fares stay an honest EMPTY_RESPONSE ("available only on app"); do not re-recon the web bundles without a new angle (e.g. app APK API map).

### InDrive (Cab & Ride) — LIVE via intercity web guest API (no auth)
- intercity.indrive.com (InDrive's intercity booking web app) exposes its API gateway in Next.js runtimeConfig: NEXT_PUBLIC_HOST_API = ic3-gw-cf.euce1.indriverapp.com. Guest, no WAF, no auth (verified 15 Oct).
- GET /web/v1/cities?search=<q>&country_id=14 — India city registry (id, name, sub_name, INR). Search may rank loosely (search "agra" first returns "Konappana Agrahara") — parser prefers a name-includes match.
- GET /web/v1/prices?city_from_id=<id>&city_to_id=<id> — published price bands: [{min_price,max_price,order_type:"private"|"parcel"|"pool"}]. Delhi NCR(5233)→Jaipur(5250): private ₹1600–₹5600, pool ₹1000–₹5600; Mumbai(5243)→Pune: private ₹500, pool ₹300.
- /web/v1/popular/routes?limit=6&country_id=14 also works (limit >6 returns 400).
- Offers emit private+pool only (parcel = package delivery, dropped); price = band minimum, the full ₹min–₹max range is in price_basis; data_note states rides are name-your-price so the band is indicative, never a fixed fare. Deeplink = intercity.indrive.com.
- DEAD ENDS: intra-city rides have NO web surface (app-only, offer-based); indrive.com main site is a marketing Next.js shell; my.indrive.com is the logged-in app shell.

### Ola (Cab & Ride) — LIVE via BPD rate-card database (no API key needed)
- Official devapi.olacabs.com/v1/products stays the primary stage (OLA_API_KEY; X-APP-TOKEN header) — absent/rejected key falls back automatically.
- FALLBACK (live, verified 15 Oct): Ola's own merchandising web app exposes the BPD rate-card DB.
  1. GET https://webapps.olacabs.com/fleet/bpdproxy/bpd/rest/v1/city?country_code=IN with headers X-Client-Key: a3abb50bbd6p4bcdb519df4f0a140f53jfkhqfad (public web client token from window.owConfig on /merchandising/rate-card) — 417 IN cities with id/name/timezone. Ungated GET.
  2. Fetch https://webapps.olacabs.com/merchandising/rate-card?api_ver=v1 once for the cookie jar (_csrf, XSRF-TOKEN, OSRN_v1) — ALL THREE cookies are required; XSRF-only returns 500 EBADCSRFTOKEN.
  3. POST https://webapps.olacabs.com/fleet/pricing/v1/ratecard/all body {city_id, country:"IN", service_type:{p2p:null}, user_request_time:null}, headers X-Client-Key + csrf-token:<XSRF-TOKEN cookie> + x-timezone — returns EVERY p2p rate card for the city (Delhi: 2,923, incl. actively-maintained all-day "AL"/peak WP/EP/MP/WL cards updated same-day).
- Fare formula (approved, non-deleted, rate_card_type=base, threshold_type=distance_based): base_fare + distance slabs (rate_per_km to threshold_1, rate_after_threshold_1 to threshold_2, rate_after_threshold_2 beyond; minus inclusive_km) + rate_per_trip_minute * mins; floor min_fare. Picker prefers time_of_day AL (all-day) cards, newest created wins.
- Categories mapped: auto, bike, mini_non_ac, compact, prime_play, prime_plus (labelled Ola Prime), economy_suv, luxury_sedan, erick. micro EXCLUDED (cards are 25km-inclusive pass products).
- Offers are labelled estimates: Ola's own published rate card applied to OSRM road distance; NOT a live surge-adjusted quote (runtime surge/wait can raise the in-app fare).
- Deeplink: https://book.olacabs.com/?lat=<pickup>&lng=<pickup> via /api/out (web booking; finish ride in app).
- DEAD ENDS: OLA_API_KEY path 401 until owner supplies real token; book.olacabs.com is a webpack shell with no guest fare RPC; www.olacabs.com is a Magento marketing site.

### Uber (Cab & Ride) — LIVE via SSR city-guide fare tables + universal deep link (no API creds)
- Official API /v1.2/estimates/price stays the primary stage (UBER_APPLICATION_ID+UBER_CLIENT_SECRET OAuth2 client_credentials, or UBER_SERVER_TOKEN; UBER_API_HOST=sandbox-api.uber.com for sandbox testing) but the registered app's secret mismatches, so the worker falls back automatically.
- FALLBACK (live, verified 15 Oct): www.uber.com/global/en/r/cities/<slug>/ SSR pages carry "Average price with UberX*" tables. Verified slugs: new-delhi-new-delhi-in, mumbai-maharashtra-in, bangalore-karnataka-in, chennai-tamil-nadu-in, hyderabad-telangana-in, kolkata-west-bengal-in, ahmedabad-gujarat-in, jaipur-rajasthan-in, lucknow-uttar-pradesh-in. Parse: cmln__paragraph">TEXT</p> pairs; a name followed by a "₹NNN" text = destination fare row.
- Matching rule: only the DROP side of the route may match a published destination (matching pickup produced absurd offers). No match => honest EMPTY_RESPONSE.
- Deeplink: m.uber.com/ul/?client_id=<UBER_CLIENT_ID>&action=setPickup&pickup[my_location]=true&dropoff[lat/lon/nickname] routed via /api/out so an affiliate campaign (direct or network, e.g. a future Uber affiliate program) attaches server-side when available.
- DEAD ENDS (do not re-recon): m.uber.com/go/graphql guest data queries return 400 "something went wrong" (IP-gated; only __typename works unauthenticated); RefreshShoppingOrder mutation needs auth; www.uber.com/graphql is a marketing schema with no PUDO/fare types; www /api/ RPC has getPlaceDetails + getDirections but no fare handler; cities index /global/en/r/cities/ is a JS shell.

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
- **Instamart** [grocery.ts w_grocery_instamart] — instamart.swiggy.com home/v2 +
  campaign/listing/v2 + layout/v2 (no auth). Products nest at JSON depth 13.
  15 Oct: worker now also collects the ~100 product cards embedded in home/v2
  itself + layout/v2 for raw layoutId JSON fields (90→150 products). Search/v2,
  search/v3 and collection/listing/v2+3 stay 202 edge-gated (retested 15 Oct) —
  no milk in curated deal grids, so rare terms honestly return EMPTY_RESPONSE.
- **Blinkit** [blinkit.ts] — POST /v1/layout/search?q= (app_client=consumer_web
  + lat/lon). Chrome→safari17_0→chrome110 fingerprint retry ladder. 15 Oct:
  Cloudflare 403s BOTH sandbox and Hostinger prod IPs on all 3 fingerprints
  (worked 13 Oct from sandbox). **15 Oct 23:50: BLOCK LIFTED — recipe verified
  LIVE again from sandbox**: milk/Mumbai, atta/Gurgaon, maggi/Delhi each returned
  12 real items via the existing w_grocery_blinkit worker. Worker hardened with
  a 1.5s cooldown between TLS profiles (CF samples per-request). api.blinkit.com
  stays a dead end: OPEN Kong gateway but /v1/* route probes all 404 (no Route
  matched) — app routes are not served there. APK not on any browserless mirror.
  If CF re-samples on the Hostinger prod IP, the honest ACCESS_CHALLENGE fail
  fires after the 3-fingerprint ladder; retest after quiet time.
- **BigBasket** [bigbasket.ts] — 3-step cookie handshake (homepage →
  serviceable → _bb_addressinfo/_bb_pin_code/_bb_lat_long → listing-svc/v2).
  15 Oct: RECIPE CONFIRMED, NO DRIFT — ps-page chunk (bbassets.com, ungated)
  shows the app calls exactly /listing-svc/v2/products?type=ps&slug=<q> (slug
  = query, not q=). Sandbox IP re-sampled by Akamai after recon bursts
  (~15 req/10min → 403); the worker's low-volume 3-request handshake self-
  heals via the ACCESS_CHALLENGE backoff ladder. DRIFT-REPAIR TRICK: read
  www.bbassets.com/monsters-inc/static/_next/static/chunks/... any time (even
  while the site 403s) — chunk 2263-*.js holds getListingQuery. Full recon:
  recon-bigbasket.md.
- **QuickCommerce API** [grocery.ts] — api.quickcommerceapi.com/v1/search
  (needs QUICKCOMMERCE_API_KEY in hPanel; /v1/health-status public).
- **Zepto** — LIVE (17 Oct breakthrough): zepto.com SSR rails + browserless AWS WAF PoW solver. THE RECIPE: (1) GET any zepto.com page without a token returns HTTP 202 + a 2KB shell with `window.gokuProps {key,iv,context}` and a challenge.js script URL on `<id>.<hash>.us-east-1.token.awswaf.com`. (2) `server/common/awsWafChallenge.ts` runs that challenge.js in a jsdom sandbox (no browser, no native deps; window.crypto.subtle = Node webcrypto, location.reload stubbed, in-page fetch() routed through cffiFetch with FormData serialized to REAL multipart boundary — the 400 "Invalid boundary" bug). It solves the PoW, POSTs multipart to `.../mp_verify?region=us-east-1` (200), and jsdom's document.cookie gains `aws-waf-token` (domain .zepto.com, ~minutes freshness, NOT IP-bound — minted from the sandbox datacenter IP and accepted). (3) With `Cookie: aws-waf-token=<token>`, these SSR pages return 200 with REAL priced product JSON inside the double-escaped RSC payload (`\"discountedSellingPrice\":56800` paise, `\"product\":{\"brand\":...,\"name\":...}`, `\"productVariant\":{\"formattedPacksize\":\"1 pack (5 kg)\",\"id\":<pvid>,\"images\":[{\"path\":\"cms/product_variant/...jpeg\"}],\"mrp\":78000}`; images at https://cdn.zeptonow.com/production/<path>): homepage `/` (~60 rail products, IP-city), `/delivery-in-<city-slug>` city rails (68 cities, Indore verified 200), `/brand/<slug>` brand catalog (~45-60 products; amul/nestle/britannia/dove/aashirvaad/fortune/mother-dairy all verified 200). `/search?query=` is a client-side shell (no products) and api-gateway v3/search stays 429 from everywhere incl. real browsers — the worker (w_grocery_zepto, priority 14, 90s) fetches city/home + up to 3 brand pages (ZEPTO_TERM_BRANDS keyword routing: milk->amul/mother-dairy, atta->aashirvaad/fortune) and filters client-side (plural-stem). Parser: server/workers/parsers/zeptoSsr.ts. VERIFIED LIVE from sandbox: milk@Indore 18 offers (Amul Gold ₹27), atta@Mumbai 13 (Aashirvaad 5kg ₹107, mrp ₹358). jsdom is a REAL npm dependency now — deploy needs npm install on the target.
- **Zepto (older app-gateway recon, superseded by the SSR recipe above)** — PARTIALLY CRACKED (16 Oct, post-midnight session): (1) SERVICEABILITY SOLVED — GET api-gateway.zepto.co.in/serviceability-service/api/v1/serviceability?lat=<lat>&long=<lng> — param is `long` NOT `lng` (earlier 500s/regionId dead-end was this typo). Returns serviceable:true + PRIMARY/SECONDARY/TERTIARY store UUIDs per location (Gurgaon f5e682bc-1124-4bcf-8fca-734bd8b59d7f, Mumbai 4a54d5f5-0bd9-4b8f-b08a-120d8e7926d7). (2) Live category taxonomy: v2/category/grid?latitude&longitude + v1/category?category_id=<cat>&store_id=<store> -> availableSubcategories UUIDs (Fruits&Veg All=e78a8422-5f20-4e4b-9a9f-22a0e53962e3), l1Ids/merchIds/subcatL1Mapping. (3) PRODUCTS STILL BLOCKED: v2/store-products-by-store-subcategory-id returns 200 but storeProducts=[] for EVERY combo (fresh IDs, real stores Gurgaon/Mumbai, page 0/1, page_size, with/without compatible_components header, with cookie jar) — guest-gating at the service level, NOT stale IDs. v3/store-products needs "SP IDs or PV IDs". vertical-feed is DEPRECATED (Kong 503 message). user-search WAF 429 unchanged. bff-gateway.zeptonow.com/.zepto.com = 202 challenge everything; auth/create-csrf-token is site-internal (404 on Kong). Web bundle: widget calls send `compatible_components` flag list; signed headers x-xsrf-token/x-csrf-secret/request-signature derive from zeptonow.com cookies the 202 shell never sets. NEXT ANGLES: (a) lms get_page widget resolver params may hold the missing store-products input; (b) reverse the request-signature algorithm (m() in chunk 24645) and forge a guest signature; (c) re-scan the APK Hermes bundle for newer assortment routes; (d) retest search WAF after IP quiet time.
- **Amazon.in** [amazonIn.ts] — SRP s?k=<term> (bm-verify cookie-session bounce,
  503 retry). MULTI-IMAGE (17 Oct): SRP gives one hero shot, so the worker fetches
  the PDP (/dp/<asin>, same jar, top 3 offers, 900ms spacing, strict soft-fail) and
  extractAmazonGallery() lifts colorImages hiRes[] (large[] fallback) into
  attributes.image_urls (deduped, https m.media-amazon.com only, cap 6). Verified
  live: nike shoes top 3 offers 6 photos each.
- **Flipkart** [flipkart.ts], **Ajio** [ajio.ts],
  **Myntra** [myntra.ts] (__myx brace-matching), **TataCLiQ** [tatacliq.ts] —
  searchbff.tatacliq.com/v2/products/mpl/search; X-ACCESS-TOKEN = AES-192-CBC
  of epoch-seconds, key in client js module 72124, zero IV, Node auto-PKCS7.
- **Nykaa** [nykaa.ts] — LIVE (17 Oct): GET www.nykaa.com/search/result/?q=<term>
  (cffi chrome) serves SSR with the full result set in
  <script id="__PRELOADED_STATE__" type="application/json"> at
  listingV2.products[]: title (brand only) + subTitle (product name) joined,
  discountedPrice = selling price, price = MRP, discount, imageUrl,
  plp_pdp_bridge.images[] gallery, isOutOfStock. PDP deeplinks come from the
  rendered anchors (/slug/p/<id>, query string stripped) matched by product id;
  identifiers sku=<nykaa sku> + vendorProductId=<id> (identity rule accepts both).
  Worker w_ecom_nykaa, priority 17. Verified live: nike shoes 36 offers, e.g.
  Nike Men's Downshifter 14 Rs 2,937 (MRP 4,895) with PDP link + 6-photo gallery.

### Ecommerce source verdicts (17 Oct 2026, owner-requested sources)
- **Croma** [croma.ts] — LIVE (22 Oct): Tata electronics retailer. The PWA search BFF is an
  unauthenticated GET extracted from the SPA main chunk (function E(e) on /searchB routes):
  GET https://api.croma.com/searchservices/v1/search?currentPage=0&query=<term>:relevance&fields=FULL&channel=WEB&channelCode=400001
  (channelCode = pincode; 400001/Mumbai works unauthenticated). Items: name, manufacturer
  (brand), price.value (selling INR), mrp.value, plpImage (hero), url (PDP path), code (SKU),
  stockFlag (array of store codes; non-empty = in stock), averageRating, numberOfReviews.
  Multi-image (owner rule): search gives 1 hero shot; worker fetches top-3 PDPs
  (www.croma.com<pdp>, 900ms spacing, soft-fail) and extractCromaGallery() lifts the
  media.tatacroma.com/.../Images/<code>_<n>_<hash>.png gallery (regex GOTCHA: the path class
  must include '/' AND the pattern is plain 'Images' — 'Images%20?' never matched because '%'
  was required). mergeCromaGallery unions hero+shots into attributes.image_urls (cap 6).
  Worker w_ecom_croma, priority 18, maxPerMinute 8. Verified live 22 Oct: iphone 21 offers
  (iPhone 17 Pro Rs 1,27,990 / MRP 1,34,900, top-3 with 6 photos each); samsung tv, washing
  machine, smart watch, macbook, headphones, refrigerator all 21 rows each.
- **Xiaomi (mi.com, Redmi/Poco)** [xiaomi.ts] — LIVE (22 Oct): owner-requested source. The
  mi.com/in storefront SPA (SPPS bundle, chunk 33572 + Search.chunk) fetches search results from
  the goSite BFF: GET https://in-go.buy.mi.com/in/v2/search/result?word=<term>&type=2&page_index=0&page_size=24&v2_page_index=0&v2_page_size=24&from=pc
  (type=2 = product list, from=pc marks web client; unauthenticated, plain GET). Items:
  data.data_provider.data.product_list[] with product{ id, name, price_min_num (live sales INR),
  market_price_min_num (MRP), image (hero), item_link (PDP), spu_id, has_store, is_sale,
  categories[{title, category_tag}] } + commodity[] (purchasable variants, each with own image).
  Multi-image (owner rule): commodity[] colour shots are distinct photos, so the parser unions
  hero + distinct variant images into attributes.image_urls (cap 6) — no PDP round trip needed.
  Brand inferred from name (Redmi/Poco/Xiaomi). Worker w_ecom_xiaomi, priority 18, maxPerMinute 8.
  Verified live 22 Oct: phone 32 offers (Redmi A7 Rs 12,999 / MRP 25,999, 3-colour galleries),
  tv 35 offers (Xiaomi TV FX Mini LED 75 Rs 74,999 / MRP 1,39,999).
- **JioMart** [jiomart.ts] — LIVE (17 Oct): Fynd/JCP catalog
  GET www.jiomart.com/api/service/application/catalog/v1.0/products/?q=<term>&page_no=1&page_size=40&pincode=<pin>
  browserless, NO guest-JWT mint needed. Two headers discovered in the web theme bundle
  (themeBundle.umd.js FDK ApplicationConfig.execute): Authorization: Bearer
  base64(applicationID:applicationToken) = base64('685945f46c8c7aee3f3af605:TpKw7wD9h'),
  plus x-location-detail {"pincode","city","country_code":"91"} — pincode+city MUST be a
  valid matching pair (else 400 'invalid pincode'; auth itself needs no JWT). Items:
  name, slug (PDP = /p/<slug>), uid, item_code, brand.name, price.effective.min (selling,
  rupees), price.marked.min (MRP), medias[].url (https-only deduped gallery, owner
  multi-image rule), sellable (stock flag). Worker w_ecom_jiomart, priority 17, tries
  user pincode+city (or pin-prefix->city map) then verified default 400070/Mumbai.
  Verified live: nike shoes (NIKE Air Max 270 Rs 13,995, 5-photo gallery), aashirvaad
  atta (Rs 249), Indore 452010 + Bengaluru 560001.
- **Snapdeal** — WAF 403 on ALL TLS fingerprints (chrome110/120/123/124, edge99/101,
  safari15_5/17_0/18_0, safari iOS) for www.snapdeal.com/search and all API paths;
  m.snapdeal.com returns 200 but a 73KB client-rendered shell (JS from
  i*.sdlcdn.com, no product JSON). Probe w_ecom_snapdeal attempts live each
  search. NEXT ANGLE: Snapdeal APK recon for app API host.
- **Tata Neu** — app-only commerce: tataneu.com is a 13KB marketing shell with
  no web search/pricing; neu.tatadigital.com / shop.tatadigital.com do not
  resolve; tata.com/shop is 404. Tata Neu's web storefront arm IS Tata CLiQ
  (already a live source, w_ecom_tatacliq). Probe w_ecom_tataneu reports
  'available only on app' per owner deeplink policy. NEXT ANGLE: UCP app-API
  recon only if owner wants in-app Tata Neu prices surfaced as app-only rows.
- **Meesho** — unchanged (client-rendered shell; prices only via session-gated
  app APIs). Probe w_ecom_meesho attempts live each search.

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
- MakeMyTrip flights — LIVE CALENDAR (21 Oct): flights-cb.makemytrip.com/api/fareCalendar
  ?apiCallTimestamp&crId=<uuid>&it=BOM-DEL-20261028&tripType=O&pfm=DESKTOP&src=desktop&region=in
  &cur=INR&currency=INR&language=eng&pax=A-1_C-0_I-0&cc=E&cmpId=&dfs=0&forwardFlowRequired=true
  &shd=true&sortBy=rhino with the standard flights-cb app headers (app-ver 1.0.0, device-id,
  entity-name india, domain in, user-country IN, region in, pfm DESSKTOP, src desktop,
  profile-type b2c, Origin www.makemytrip.com) is OPEN browserless from datacenter IPs:
  364 per-date lowest fares in one GET, each with the cheapest airline named
  (fares["281026"] = DDMMYY -> "Wed, Oct 28", "fr":"6,638", airlineInfo.name "IndiGo").
  Parser mmtFareCalendar.ts; worker w_flights_makemytrip emits the exact depart-date fare
  (honest cheapest-upcoming fallback), redirect to MMT's own SRP. NOTE: the calendar needs
  crId as a QUERY PARAM (Kong rejects without it).
  The per-flight SSE flow remains IP-gated (below) — full-flight MMT listing still needs
  the SRP preauth from a clean IP.
- MakeMyTrip flights per-flight SSE — recipe CRACKED (17 Oct browser recon), IP-gated: the flow is
  GET www.makemytrip.com/flight/search?itinerary=DEL-BOM-25/10/2026... (SSR HTML embeds
  window.__PRE_AUTH__=<token>) then GET flights-cb.makemytrip.com/api/search-stream-dt
  ?apiCallTimestamp&cc=E&crId=<uuid>&cur=INR&it=DEL-BOM-20261025&pax=A-1_C-0_I-0
  &pfm=DESKTOP&region=in&sortBy=rhino&src=desktop with headers app-ver 1.0.0,
  X-Cb-Preauth <token>, device-id/mcid <uuid>, entity-name india, domain in,
  user-country IN, currency INR, pfm DESKTOP, region in, src desktop,
  accept text/event-stream. SSE events: "response-headers" + "response" (chunked JSON,
  possibly compressed). flights-cb ALSO serves /api/client-config and
  /api/pre-search-validation browserless (Go validator oracles for payload fuzzing:
  FlightSearchRequest.Itinerary, FareCalendarRequest.CrID/Itinerary).
  From burned datacenter IPs (sandbox, Browserbase) the SRP HTML is a 6-byte stub
  and the stream 403s — probe w_flights_makemytrip now runs the FULL flow each
  search (preauth extract -> stream call) so a clean production Hostinger IP is
  detected; the stream sample it logs then maps the SSE shape for the real parser.
- **Yatra flights** [yatraFlights.ts] — LIVE FULL PER-FLIGHT (17 Oct): the
  air-service JSON API behind the Angular SRP is OPEN browserless (no cookies,
  no sensor, no guest token; verified from datacenter IPs). Flow: GET
  flight.yatra.com/air-service/dom2/trigger?ADT=1&...&destination=BOM&flight_depart_date=25/10/2026
  &origin=DEL&type=O&unique=<ms> mints the searchId AND returns the first batch
  (resultData[0].fltSchedule[DELBOM20261025][], fareDetails[][].O.ADT.tf INR);
  then per-airline polls GET /air-service/dom2/poll?polling_id=<searchId>_<QPAPI|6EAPI|AIRASIAAPI|1AWS4|SGAPI>
  add the remaining batches (6E poll alone carries ~180 flights). Fallback:
  GET /lowest-fare-service/dom2/get-fare?origin&destination&from&to(dd-MM-yyyy,~60d)&tripType=O&airlines=all
  = per-day per-airline lowest fare with ow[] flight number/times. Seller=Yatra
  (ticket-selling-site policy), deeplink to Yatra's own air-search-ui SRP URL.
  Worker w_flights_yatra, priority 8: trigger -> 5 polls -> cheapest-40 dedupe,
  calendar fallback, empty 200 for unserved routes = success. Verified live:
  DEL-BOM 25 Oct 40 offers (Air India Express Rs6476, Akasa QP-1805 Rs6675,
  IndiGo 6E-353 Rs6845; matches EMT/Ixigo price levels). Discovered via live-browser
  network capture (Browserbase+CDP), replayed/verified curl_cffi-only.
- **Goibibo flights** [goibiboFlights.ts] — LIVE (17 Oct): the SPA search tarpits
  datacenter IPs (HTTP/2 reset, m-site 503, flights.goibibo 403 — old verdict stands
  for the app itself) but the SEO route landing pages are SERVER-RENDERED with the
  full listing state: GET www.goibibo.com/flights/<from>-to-<to>-flights/ (legacy
  spellings: bangalore, mysore, gurugram; goibiboRouteUrl aliases) embeds a ~1.5MB
  Next.js __NEXT_DATA__ -> props.pageProps.data.state.listing with
  journeys.allJourneys[0][] per-flight offers: fare (total INR), simpleAirlineHeading.nm
  (airline), flightNumber, journeyKeys "ORIG$DEST$YYYY-MM-DD HH:MM$FLNO" (legs joined |),
  journeyMap.data[] depTime/arrTime/duration/stops. The page picks its own nearest
  service date (itinerary DEL-BOM-20/10/2026) — every offer carries that real date.
  Seller=Goibibo, deeplink = the same route page. Worker w_flights_goibibo priority 9,
  cheapest-40, 404 route page = honest empty. Verified live: DEL-BOM 15 offers
  (Akasa QP-1833 Rs6675, IndiGo 6E-5096 Rs6757), BLR-GOI 13 offers.
  a new IP (production Hostinger pull) — gate is IP-reputation based.
Akamai/Bot-Manager: MMT, Agoda (graphql gate
headers cracked but needs runtime-built document), Trip.com, Marriott, Hilton,
Trivago (/gw/graphql), Kayak, Skyscanner, Zepto (Kong 429), Flipkart Minutes,
Meesho, Instamart search/collection (202), api-prod-flight host search,
Cleartrip flights SUPERSEDED 17 Oct: the desktop search API
GET www.cleartrip.com/flight/search/v2?from=DEL&to=BOM&depart_date=25/10/2026&adults=1
with headers (x-client-id cleartrip, x-source-type Desktop, channel desktop, app-agent
DESKTOP, caller UI, x-unified-header {"platform":"desktop","trackingId":<uuid>,"source":"CLEARTRIP"})
returns the FULL fare matrix browserless (194 cards DEL-BOM): cards.J1[] ->
subTravelOptionIds[0] -> subTravelOptions[].fareIds[0] ->
fares[].pricing.totalPricing.totalPrice INR (+totalBaseFare, totalTax, coupon message
"₹934 off with BBDHDFC"). Worker w_flights_cleartrip priority 8, cheapest-40.
Verified live: DEL-BOM Rs6675 Akasa, BLR-GOI Rs3176 (1 "IC" code card is Cleartrip's
own data, shown raw), IDR-BHO 11 connecting offers,
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

## Production log fixes (15 Oct, commit pending)
1. **Duplicate w_flights_akasa removed**: an obsolete Akasa probe task (priority 18, always-throw EMPTY_RESPONSE) shared the sourceId with the LIVE Akasa fare-calendar worker (priority 7) — its constant failures fed the same circuit breaker, repeatedly opening the live calendar's circuit ("Circuit OPEN for w_flights_akasa after 3/5/7 failures" in prod logs).
2. **affiliate_cuelinks registry feed source disabled**: `sources/registry.ts` registered a Cuelinks "affiliate_feed" source with NO feedUrl configured, so every ecommerce/coupons search failed EXPIRED_CREDENTIALS ("feed URL/API key not configured") and poisoned the affiliate_cuelinks circuit — while the REAL offers sync (aggregator → CuelinksProvider → /offers, 599 live offers) runs separately and upserts fine. Pure noise; disabled.
3. **Singleton lock hardened** (double-instance boot, prod logs 15 Oct: two boots 1s apart, BOTH ran workers+boot-warm+keep-warm, doubling site hits and racing circuits open): mysqlLock now returns held/other/error — only 'error' (MySQL unreachable) falls back to the file lock, 'other' defers quietly (previously an error silently returned false, skipping the file-lock fallback); a 60s heartbeat pings the lock connection and re-asserts IS_USED_LOCK==threadId, logging CRITICAL if the lock is silently lost (wait_timeout connection drop = both instances believe they are the background owner); lock mode + pid now logged on acquisition so the next prod boot reveals the cause.
4. **redBus SEO route page fetch timeout 15s→25s**: repeated "This operation was aborted" every warm cycle from Hostinger (page loads slower than 15s from datacenter IP).


### PVR INOX (Movies) — edge-gated, honest probe registered (16 Oct)
- www.pvrinox.com + www.inoxmovies.com = 403 on every path from datacenter IPs; pvrx.io, m.inoxmovies.com, api.inoxmovies.com DNS-dead; pvrmovies.in cert-broken. Showtimes/seat prices are app-only.
- w_movies_pvrinox probes pvrinox.com live on every movie search and reports ACCESS_CHALLENGE honestly; a 200 would flag parsing work. Paytm movies remains covered via District's gw gateway mesh (worker w_movies_district).

- **Yatra hotels** [yatraHotels.ts] — LIVE (17 Oct, supersedes old SPA-shell verdict): Yatra's hotel platform is TravelGuru; GET hotel.yatra.com/tgapi/hotels/v1/pageSearch?checkInDate=DD/MM/YYYY&checkOutDate=DD/MM/YYYY&city=<City>&source=BOOKING_ENGINE&tenant=B2C&page=N&offset=N*10&rooms[0].id=1&rooms[0].noOfAdults=2&rooms[0].noOfChildren=0&type=all&otherRateplans=all&allImages=true&showBOR=true&loggedIn=false with headers x-api-key JN9aWyj7hJ1ZrExC7Ozo (public, sent by Yatra's own web app), x-customer-ip, accept application/json. Response data.content.hotels[] (n=name, id, hsk, gr={rating,reviews}, loc={c,a,la,lo}, cldImage.url, ctg, r=rack rate) JOINED with data.rates.hotels[] (id, price=per-night ALL-INCLUSIVE total, basePrice, roomName, bookable, roomsLeft, freeCancel). OFFSET CONVENTION: offset = page*10 (page 1 = offset 10, offset 0 returns empty). Worker w_hotels_yatra fetches 3 pages (60 offers). Deeplink = Yatra SRP (property URL format not guessable — all hsk variants 404). Discovered via Playwright CDP interception of the real booking flow; replay is browserless curl_cffi. Autosuggest key (cdn.travelguru.com/api/v4/autosuggest): G0O6MHNGv9HU4kIfRIWm. Verified live: Goa 60 offers (cheapest 1707, Golden Landmark 5003 incl taxes), Indore 60 (1420), Ujjain 10/256-788 results tier-2/3.
- **EaseMyTrip hotels** [emtHotels.ts] — LIVE (17 Oct): city SEO pages https://www.easemytrip.com/hotels/hotels-in-<city>/?checkin=DD-MM-YYYY&checkout=DD-MM-YYYY&c=IN&num_rooms=1&adults=2 are full SSR with a JSON-LD ItemList of ~20 hotels: name, starRating.ratingValue, address.streetAddress 'Area>Locality', geo, priceRange (INR/night), image on img.easemytrip.com/emthotel-<id>/..., checkIn/Out times. No auth/WAF, curl_cffi chrome. Deeplink: image segment id joined with page's /hotels/<slug>-<id>/ anchors; fallback city SRP. Worker w_hotels_emt priority 9. Verified live: Goa 20 (cheapest 2499, Estrela Do Mar 5693), Indore 20 (1819), Ujjain 20 (2004).
- **MMT hotel registry autosuggest** [mmtAutosuggest.ts + api/routes.ts] — LIVE (17 Oct): GET https://mapi.makemytrip.com/autosuggest/v5/search?t=city|hotel&q=<text> — OPEN browserless from datacenter IPs (Kong gateway, no auth). t=hotel returns REAL properties (hotelId, srating, lat/lng: Taj Mahal Palace id 201709071828297454, srating 5); t=city returns destinations (CTGOI). NO prices (registry only). Wired into /api/hotels/locations: TravelGuru + MMT fetched in parallel, destinations first then hotels, MMT names dedup-segmented ('The Taj Mahal Palace, Mumbai, Maharashtra'), starRating + registry fields exposed.
- **MMT/Goibibo hotel SRP recon verdict (17 Oct)** — BOTH hotel listing surfaces are Akamai path-scoped gated from sandbox AND Browserbase (US) IPs: literal 6-8 byte '200 - OK'/'200-OK' stubs on www.makemytrip.com/hotels/*, /pwa/hotel-listing, m.goibibo.com/hotels, hermes.goibibo.com (403), cbdom searchHotels GET-pass/POST-403, makemytrip.global hotels-international — while MMT /flights/*.html SEO (402KB) and Goibibo /flights/* SEO (1.5MB __NEXT_DATA__) serve FULL data from the SAME IPs. So the gate is hotel-path + IP-reputation scoped, not a global burn. MMT root-path city landings www.makemytrip.com/hotels-in-<city>/ ARE OPEN (159KB PWA shell, geoHeaders edge-visible country_code=US) but carry no listings ($hotelReducerResponse {}). Goibibo worker w_hotels_goibibo is now a SELF-DETECTING full-flow probe (MMT-flights pattern): fetches /hotels/hotels-in-<slug>[-ct]/ each search, stub (<500B) => honest ACCESS_CHALLENGE, real HTML => shape-tolerant __NEXT_DATA__ hotel walker (goibiboHotels.ts) self-activates on production Hostinger IP.
- **Hotel typeahead (hotels autocomplete)** [api/routes.ts + AutocompleteInput.tsx + flutter hotel_picker_screen.dart] — LIVE (17 Oct): GET /api/hotels/locations?q=<text> proxies TravelGuru autosuggest (cdn.travelguru.com/api/v4/autosuggest?key=<q>&filter=all&count=12&propertyType=all with x-api-key JN9aWyj7hJ1ZrExC7Ozo, Origin hotel.yatra.com). Returns REAL hotel names + destinations (type HOTEL with cityName/stateName). Fixes: hotels search previously suggested AIRPORTS (New Delhi (DEL) etc. — it shared the flights city pool). Web: AutocompleteInput type 'hotel-location' = curated destinations first + live hotel rows, Bed icons, never airports; Flutter mirrors via Try1SecondApi.hotelLocations + debounced typeahead in hotel_picker_screen.
- **SaffronStays villas** [saffronStays.ts] — LIVE (17 Oct): POST https://ecapi4.saffronstays.com/api/search-advance (no auth), body {location:'<City>',page:1,no_of_guest:2,no_of_room:1,suitables:[],amenities:[],sort_by:'',signature:'',min_price:0,max_price:2500000,pocket:false,same_day:false,non_shared:false,new_home:false,top_rated:false,lat:null,long:null,mint_fresh:false,is_agent:'',distance:125}. Response {data[],total}: title, price_per_night, per_night_price_after_discount, total_amount_with_tax, rating, total_reviews, location, lat/lon, images (ids), seo_url, max_capacity, bedrooms, signature, is_available. Images: https://ik.imagekit.io/5tgxhsqev/saffronstays-media/<id>?tr=w-640,q-75. Deeplink /villas/<seo_url> (verified 200). Captured via Playwright CDP, replayed browserless curl_cffi. Verified live: Goa 9 villas/page of 62 (Araqila 28800/night), Karjat 9 (9363), Alibaug 9 (8024). Worker w_hotels_saffronstays priority 10.
- **OYO hotels** [oyoHotels.ts] — LIVE (17 Oct): city SEO listing pages https://www.oyorooms.com/hotels-in-<city>/?checkin=DD/MM/YYYY&checkout=DD/MM/YYYY&guests=2&rooms=1 are FULL SSR — window.__PRELOADED_STATE__ JSON carries listing.hotels[] with real per-night bookingPrice (tax-exclusive; taxInfo.final_price_with_tax = inclusive total), slashedPrice, discount %, rating {value,count}, hotel_images[] CDN gallery, /<id>/ property deeplink. No auth, no WAF, curl_cffi chrome. Sold-out (isSoldOut) and price-less rows never published. Verified live: Goa 20 offers (cheapest ₹1084, Sand Castles Miramar ₹1410+₹149 tax), Indore 20 (₹721), New Delhi 20 (₹612). Worker w_hotels_oyo priority 8.

## Hotels — Goibibo SEO city pages LIVE BROWSERLESS (21 Oct, supersedes the gated-SSR verdict)
- `GET https://www.goibibo.com/hotels/hotels-in-<city>[-ct]/` with the FULL real-Chrome
  header set (sec-ch-ua v130, Sec-Fetch-Site none/Mode navigate/User ?1/Dest document,
  Upgrade-Insecure-Requests, avif Accept, Accept-Language en-US) — the page is Gatsby-style
  SSR carrying the whole listing in `window.__initial_state__` (NOT __NEXT_DATA__ — the
  legacy walker parsed 0 rows even on the big page):
  srpUnif.srpData.personalizedSections.RECOMMENDED_HOTELS.hotels[] → priceDetail.discountedPrice
  (per-night INR, tax-exclusive), priceWithTax/totalTax, reviewSummaryUgc.hotelRating,
  media[].url (//rNimghtlak.ibcdn.com → https:), locationPersuasion[0], detailDeeplinkUrl,
  soldOut/showCallToBook (skip honestly). common.checkin/checkout = the page's OWN service
  dates (labelled on offers). Parser `server/workers/parsers/goibiboHotelSsr.ts` (balanced-brace
  extractor + new Date()/:undefined sanitization; fixed slice-position bug).
- CRITICAL: Akamai SAMPLES this path from datacenter IPs — alternating 8-byte "200 - OK"
  stubs and the real 1.3MB page. Worker ladder: up to 3 attempts per slug with short
  backoff, -ct spelling second. Verified live: Goa 20 hotels Rs 1,891-6,156.
- hermes.goibibo.com/hotels/v12/search/data/v3 remains FIRST attempt (gives requested
  dates when the IP is clean); it tarpits datacenter IPs but self-detects on Hostinger.
- MMT hotels stay IP-gated everywhere (hotel-listing 6B stub even with the full Chrome
  header set; hotels.makemytrip.com tarpit; mapi has NO hotel search routes; detail pages
  0-byte stub; real browser gets "Uh Oh! Looks like our servers took too long").
  w_hotels_mmt is a self-detecting probe: both landing spellings with the Chrome header
  set + `server/workers/parsers/mmtHotelLanding.ts` shape-tolerant $hotelReducerResponse
  walker — hotels appear automatically the day the gate lifts for the production IP.

## Hotels — Goibibo hermes v12 (self-detecting recipe, 21 Oct)
- `GET https://hermes.goibibo.com/hotels/v12/search/data/v3?searchQuery={"Companion":{"TA":"1DA"},"Pax":{"A":"2"},"RoomCnt":"1","City":"<slug>","CheckIn":"YYYYMMDD","CheckOut":"YYYYMMDD"}`
- parser: `server/workers/parsers/goibiboHermes.ts` (shape-tolerant walker; unpriced hotels skipped)
- Akamai denies datacenter IPs (sandbox tarpit-timeout, Browserbase 403 Access Denied ref 18.1f794668) — but Goibibo flights SSR passes from the Hostinger IP, so hotels hermes is attempted EVERY search by w_hotels_goibibo (circuit probe exemption). If Hostinger is clean: live fares. Failure snippet logs the raw body for shape pinning.
- SSR fallback unchanged: www.goibibo.com/hotels/hotels-in-<slug>[-ct]/ (`goibiboHotels.ts` __NEXT_DATA__ walker).
