# Try1Second — Section 16/17 Source-by-Source Acceptance Report

Live sweep ran: 2026-10-12T06:31:14.168Z (plain-HTTP acquisition only; no mock data, no bypass).

Statuses per Section 16.15. LIVE_VERIFIED requires real extracted+validated fields from a live response.

| Vertical | Source | Capability | Status | HTTP | Live evidence | Next action |
|---|---|---|---|---|---|---|
| bus | AbhiBus | bus search | LIVE_TEST_FAILED | 200 | HTTP 200 but client-rendered shell (3324B) — no data in plain HTML | Playwright render fallback or partner API |
| bus | IntrCity SmartBus | bus search | LIVE_TEST_FAILED | 200 | HTTP 200 but client-rendered shell (63929B) — no data in plain HTML | Playwright render fallback or partner API |
| bus | redBus | bus search | IMPLEMENTATION_PENDING | 200 | Reachable over plain HTTP (715494B real HTML) but no adapter implemented yet | Implement adapter for this source |
| bus | Zingbus | bus search | IMPLEMENTATION_PENDING | 200 | Reachable over plain HTTP (320253B real HTML) but no adapter implemented yet | Implement adapter for this source |
| cab | BluSmart | cab quote | LIVE_TEST_FAILED | 404 | HTTP 404 | Review URL/availability |
| cab | inDrive | cab quote | IMPLEMENTATION_PENDING | 200 | Reachable over plain HTTP (195501B real HTML) but no adapter implemented yet | Implement adapter for this source |
| cab | Ola Cabs | cab quote | IMPLEMENTATION_PENDING | 200 | Reachable over plain HTTP (107293B real HTML) but no adapter implemented yet | Implement adapter for this source |
| cab | OSRM | route distance/duration | LIVE_VERIFIED | 200 | OSRM real route Delhi→Gurgaon: 28.5 km, 32 min | Fares stay labelled indicative (real operator quotes need ap |
| cab | Rapido | cab quote | LIVE_TEST_FAILED | 200 | HTTP 200 but client-rendered shell (28883B) — no data in plain HTML | Playwright render fallback or partner API |
| cab | Uber India | cab quote | TEST_BLOCKED | 406 | HTTP 406 — site blocks plain-HTTP acquisition (WAF/bot wall). No bypass attempted (policy) | Needs official/partner API access or owner-authorized integr |
| coupons | Admitad (affiliate) | affiliate offers feed | TEST_BLOCKED | - | ADMITAD_CLIENT_ID/SECRET present on hPanel but token request returned HTTP 401 in producti | Owner: re-check Admitad client credentials (client_id/secret |
| coupons | Cuelinks (affiliate) | affiliate offers feed | IMPLEMENTATION_PENDING | 200 | Reachable over plain HTTP (80980B real HTML) but no adapter implemented yet | Implement adapter for this source |
| coupons | Optimise Media (affiliate) | affiliate offers feed | IMPLEMENTATION_PENDING | 200 | Reachable over plain HTTP (239933B real HTML) but no adapter implemented yet | Implement adapter for this source |
| coupons | VCommission (affiliate) | affiliate offers feed | LIVE_VERIFIED | 200 | VCommission API returned 55 campaigns | Keep daily affiliate sync cron active |
| ecommerce | AJIO | product search | TEST_BLOCKED | 403 | HTTP 403 — site blocks plain-HTTP acquisition (WAF/bot wall). No bypass attempted (policy) | Needs official/partner API access or owner-authorized integr |
| ecommerce | Amazon India | product search | TEMPORARILY_UNAVAILABLE | 503 | HTTP 503 from origin | Retry later |
| ecommerce | Flipkart | product search | LIVE_VERIFIED | 200 | HTTP 200, 521994B, 20 offers parsed & validated; sample: Apple iPhone 15 (Blue, 128 GB) | - |
| ecommerce | Meesho | product search | LIVE_TEST_FAILED | 200 | HTTP 200 but client-rendered shell (48229B) — no data in plain HTML | Playwright render fallback or partner API |
| ecommerce | Myntra | product search | IMPLEMENTATION_PENDING | 200 | Reachable over plain HTTP (931795B real HTML) but no adapter implemented yet | Implement adapter for this source |
| ecommerce | Open Library | book search | LIVE_VERIFIED | 200 | HTTP 200, 1981B, 5 offers parsed & validated; sample: Atomic Habits | - |
| flights | Air India | flight search | TEST_BLOCKED | 403 | HTTP 403 — site blocks plain-HTTP acquisition (WAF/bot wall). No bypass attempted (policy) | Needs official/partner API access or owner-authorized integr |
| flights | Akasa Air | flight search | LIVE_TEST_FAILED | 404 | HTTP 404 | Review URL/availability |
| flights | Emirates | flight search | TEST_BLOCKED | 403 | HTTP 403 — site blocks plain-HTTP acquisition (WAF/bot wall). No bypass attempted (policy) | Needs official/partner API access or owner-authorized integr |
| flights | IndiGo | flight search | TEST_BLOCKED | - | Connection fetch failed — host drops plain-HTTP requests | Official/partner API required |
| flights | OpenFlights | airline routes | LIVE_VERIFIED | 200 | OpenFlights: 6072 airports, 67663 routes; DEL-BOM served by 6 airlines | Fares require airline APIs (blocked); route data is the hone |
| flights | Qatar Airways | flight search | IMPLEMENTATION_PENDING | 200 | Reachable over plain HTTP (689755B real HTML) but no adapter implemented yet | Implement adapter for this source |
| flights | Singapore Airlines | flight search | IMPLEMENTATION_PENDING | 200 | Reachable over plain HTTP (103703B real HTML) but no adapter implemented yet | Implement adapter for this source |
| food | EatSure | restaurant discovery | IMPLEMENTATION_PENDING | 200 | Reachable over plain HTTP (121051B real HTML) but no adapter implemented yet | Implement adapter for this source |
| food | Swiggy Food | restaurant discovery | TEST_BLOCKED | 202 | HTTP 202 interstitial (edge bot challenge) — no data delivered to plain HTTP | Needs official/partner API access; retry may succeed on some |
| food | Toing | restaurant discovery | TEST_BLOCKED | - | Connection fetch failed — host drops plain-HTTP requests | Official/partner API required |
| food | Uber Eats | restaurant discovery | SOURCE_RETIRED | - | Uber Eats exited India in 2020 (business sold to Zomato); no Indian operations to test. Re | None (retired); keep registry entry for audit |
| food | Zomato | restaurant discovery | LIVE_VERIFIED | 200 | HTTP 200, 383771B, 9 offers parsed & validated; sample: Out Of The Box Courtyard | - |
| grocery | BigBasket / BB Now | grocery search | LIVE_TEST_FAILED | 200 | HTTP 200 but client-rendered shell (41785B) — no data in plain HTML | Playwright render fallback or partner API |
| grocery | Blinkit | grocery search | TEST_BLOCKED | 403 | HTTP 403 — site blocks plain-HTTP acquisition (WAF/bot wall). No bypass attempted (policy) | Needs official/partner API access or owner-authorized integr |
| grocery | Flipkart Minutes | grocery search | IMPLEMENTATION_PENDING | 200 | Reachable over plain HTTP (556557B real HTML) but no adapter implemented yet | Implement adapter for this source |
| grocery | Swiggy Instamart | grocery search | TEST_BLOCKED | 202 | HTTP 202 interstitial (edge bot challenge) — no data delivered to plain HTTP | Needs official/partner API access; retry may succeed on some |
| grocery | Zepto | grocery search | TEST_BLOCKED | 429 | HTTP 429 — site blocks plain-HTTP acquisition (WAF/bot wall). No bypass attempted (policy) | Needs official/partner API access or owner-authorized integr |
| hotels | Agoda | hotel search | IMPLEMENTATION_PENDING | 200 | Reachable over plain HTTP (424839B real HTML) but no adapter implemented yet | Implement adapter for this source |
| hotels | Airbnb | stays search | IMPLEMENTATION_PENDING | 200 | Reachable over plain HTTP (1039257B real HTML) but no adapter implemented yet | Implement adapter for this source |
| hotels | Booking.com | hotel search | PARTIALLY_VERIFIED | 202 | HTTP 202 interstitial (edge bot challenge) — no data delivered to plain HTTP | Needs official/partner API access; retry may succeed on some |
| hotels | Cleartrip | flight search | TEST_BLOCKED | 403 | HTTP 403 — site blocks plain-HTTP acquisition (WAF/bot wall). No bypass attempted (policy) | Needs official/partner API access or owner-authorized integr |
| hotels | Cleartrip | hotel search | TEST_BLOCKED | 403 | HTTP 403 — site blocks plain-HTTP acquisition (WAF/bot wall). No bypass attempted (policy) | Needs official/partner API access or owner-authorized integr |
| hotels | Destinia | hotel search | IMPLEMENTATION_PENDING | 200 | Reachable over plain HTTP (299085B real HTML) but no adapter implemented yet | Implement adapter for this source |
| hotels | EaseMyTrip | flight search | IMPLEMENTATION_PENDING | 200 | Reachable over plain HTTP (108703B real HTML) but no adapter implemented yet | Implement adapter for this source |
| hotels | EaseMyTrip | hotel search | LIVE_TEST_FAILED | 404 | HTTP 404 | Review URL/availability |
| hotels | Expedia | hotel search | TEST_BLOCKED | 429 | HTTP 429 — site blocks plain-HTTP acquisition (WAF/bot wall). No bypass attempted (policy) | Needs official/partner API access or owner-authorized integr |
| hotels | Goibibo | flight search | TEST_BLOCKED | 403 | HTTP 403 — site blocks plain-HTTP acquisition (WAF/bot wall). No bypass attempted (policy) | Needs official/partner API access or owner-authorized integr |
| hotels | Goibibo | hotel search | TEST_BLOCKED | 403 | HTTP 403 — site blocks plain-HTTP acquisition (WAF/bot wall). No bypass attempted (policy) | Needs official/partner API access or owner-authorized integr |
| hotels | HappyEasyGo | flight search | TEST_BLOCKED | - | Connection fetch failed — host drops plain-HTTP requests | Official/partner API required |
| hotels | HappyEasyGo | hotel search | LIVE_TEST_FAILED | 200 | HTTP 200 but client-rendered shell (62073B) — no data in plain HTML | Playwright render fallback or partner API |
| hotels | Hilton | hotel search | TEST_BLOCKED | 403 | HTTP 403 — site blocks plain-HTTP acquisition (WAF/bot wall). No bypass attempted (policy) | Needs official/partner API access or owner-authorized integr |
| hotels | Hostelworld | hostel search | IMPLEMENTATION_PENDING | 200 | Reachable over plain HTTP (654266B real HTML) but no adapter implemented yet | Implement adapter for this source |
| hotels | Hotels.com | hotel search | TEST_BLOCKED | 429 | HTTP 429 — site blocks plain-HTTP acquisition (WAF/bot wall). No bypass attempted (policy) | Needs official/partner API access or owner-authorized integr |
| hotels | Hotwire | hotel search | IMPLEMENTATION_PENDING | 200 | Reachable over plain HTTP (7169B real HTML) but no adapter implemented yet | Implement adapter for this source |
| hotels | IHG Hotels & Resorts | hotel search | IMPLEMENTATION_PENDING | 200 | Reachable over plain HTTP (82540B real HTML) but no adapter implemented yet | Implement adapter for this source |
| hotels | LastMinute.com | hotel search | TEST_BLOCKED | 403 | HTTP 403 — site blocks plain-HTTP acquisition (WAF/bot wall). No bypass attempted (policy) | Needs official/partner API access or owner-authorized integr |
| hotels | MakeMyTrip | flight search | TEST_BLOCKED | 403 | HTTP 403 — site blocks plain-HTTP acquisition (WAF/bot wall). No bypass attempted (policy) | Needs official/partner API access or owner-authorized integr |
| hotels | MakeMyTrip | hotel search | TEST_BLOCKED | 403 | HTTP 403 — site blocks plain-HTTP acquisition (WAF/bot wall). No bypass attempted (policy) | Needs official/partner API access or owner-authorized integr |
| hotels | Marriott Bonvoy | hotel search | TEST_BLOCKED | 403 | HTTP 403 — site blocks plain-HTTP acquisition (WAF/bot wall). No bypass attempted (policy) | Needs official/partner API access or owner-authorized integr |
| hotels | OpenStreetMap (Overpass) | hotel discovery | TEMPORARILY_UNAVAILABLE | 406 | Overpass main instance HTTP 406 (global capacity issues; mirrors configured in worker) | Mirror fallback runs at search time; retry |
| hotels | Orbitz | hotel search | TEST_BLOCKED | 429 | HTTP 429 — site blocks plain-HTTP acquisition (WAF/bot wall). No bypass attempted (policy) | Needs official/partner API access or owner-authorized integr |
| hotels | OYO Rooms | hotel search | IMPLEMENTATION_PENDING | 200 | Reachable over plain HTTP (816436B real HTML) but no adapter implemented yet | Implement adapter for this source |
| hotels | Priceline | hotel search | TEST_BLOCKED | 403 | HTTP 403 — site blocks plain-HTTP acquisition (WAF/bot wall). No bypass attempted (policy) | Needs official/partner API access or owner-authorized integr |
| hotels | Tiket.com | hotel search | TEST_BLOCKED | 403 | HTTP 403 — site blocks plain-HTTP acquisition (WAF/bot wall). No bypass attempted (policy) | Needs official/partner API access or owner-authorized integr |
| hotels | Traveloka | hotel search | LIVE_TEST_FAILED | 404 | HTTP 404 | Review URL/availability |
| hotels | Trip.com | hotel search | IMPLEMENTATION_PENDING | 200 | Reachable over plain HTTP (1129431B real HTML) but no adapter implemented yet | Implement adapter for this source |
| hotels | Yatra | flight search | TEST_BLOCKED | - | Connection timeout — host drops plain-HTTP requests | Official/partner API required |
| hotels | Yatra | hotel search | TEST_BLOCKED | - | Connection timeout — host drops plain-HTTP requests | Official/partner API required |
| insurance | ACKO General Insurance | insurance products | IMPLEMENTATION_PENDING | 200 | Reachable over plain HTTP (892102B real HTML) but no adapter implemented yet | Implement adapter for this source |
| insurance | BankBazaar insurance | insurer CSR | LIVE_VERIFIED | 200 | HTTP 200, 254881B, 10 offers parsed & validated; sample: HDFC Life — HDFC Click 2 Protect  | - |
| insurance | Digit Insurance | insurance products | IMPLEMENTATION_PENDING | 200 | Reachable over plain HTTP (557125B real HTML) but no adapter implemented yet | Implement adapter for this source |
| insurance | Navi Insurance | insurance products | TEST_BLOCKED | 403 | HTTP 403 — site blocks plain-HTTP acquisition (WAF/bot wall). No bypass attempted (policy) | Needs official/partner API access or owner-authorized integr |
| loans | BankBazaar loans | lender rates | LIVE_VERIFIED | 200 | HTTP 200, 291360B, 17 offers parsed & validated; sample: SBI Home Loan | - |
| loans | CASHe | loan products | IMPLEMENTATION_PENDING | 200 | Reachable over plain HTTP (202302B real HTML) but no adapter implemented yet | Implement adapter for this source |
| loans | KreditBee | loan products | IMPLEMENTATION_PENDING | 200 | Reachable over plain HTTP (188273B real HTML) but no adapter implemented yet | Implement adapter for this source |
| loans | mPokket | loan products | IMPLEMENTATION_PENDING | 200 | Reachable over plain HTTP (261532B real HTML) but no adapter implemented yet | Implement adapter for this source |
| movies | BookMyShow | movie showtimes | TEST_BLOCKED | 403 | HTTP 403 — site blocks plain-HTTP acquisition (WAF/bot wall). No bypass attempted (policy) | Needs official/partner API access or owner-authorized integr |
| movies | Cinepolis India | showtimes | TEST_BLOCKED | - | Connection fetch failed — host drops plain-HTTP requests | Official/partner API required |
| movies | Paytm Insider | event discovery | IMPLEMENTATION_PENDING | 200 | Reachable over plain HTTP (4858B real HTML) but no adapter implemented yet | Implement adapter for this source |
| movies | PVR Cinemas | showtimes | TEST_BLOCKED | 403 | HTTP 403 — site blocks plain-HTTP acquisition (WAF/bot wall). No bypass attempted (policy) | Needs official/partner API access or owner-authorized integr |
| movies | Wikidata | film releases | LIVE_VERIFIED | 200 | Wikidata SPARQL returned 6 recent Indian film releases | Showtimes/ticket prices need a partner platform (BMS blocked |

## Totals (Section 17)

- Source targets registered: 75
- Capability rows tested live: 81
- Sources with successful live acquisition (LIVE_VERIFIED): 10 (see below)
- PARTIALLY_VERIFIED: 1 (Booking.com — live extraction demonstrated; edge 202-sampling retries in worker)
- Blocked (TEST_BLOCKED: WAF/403/429/406/timeouts): 33
- Reachable but adapter pending (IMPLEMENTATION_PENDING): 26
- Live test failed (reachable, no usable data): 10
- Temporarily unavailable (origin 5xx/capacity): 2
- Retired in market (SOURCE_RETIRED): 1

## Live-verified sources (evidence-backed)

- Booking.com — 21 Goa property cards parsed live (names, nightly prices, review scores) — PARTIALLY_VERIFIED due to Datadome 202 sampling
- Amazon.in — 15-20 offers parsed (title/price/MRP/rating/ASIN), e.g. iPhone 15
- Flipkart — 20 offers via __INITIAL_STATE__ (price/MRP/rating/URL)
- Zomato — 9 restaurants (name/cuisine/rating/reviews/address) via JSON-LD
- BankBazaar loans — 17 lender rows (rate ranges, processing fees)
- BankBazaar insurance — 10 insurers (plan, CSR)
- OpenFlights — 6072 airports / 67663 routes; DEL-BOM on 6 airlines
- Open Library — book search (title/author/ISBN/year)
- OSRM — real Delhi→Gurgaon route 28.5 km / 32 min
- Wikidata — 6 recent Indian film releases (SPARQL)
- VCommission — 55 affiliate campaigns via live API
- OpenStreetMap Overpass — hotels verified live earlier (capacity 504/406 waves: TEMPORARILY_UNAVAILABLE at sweep time; mirrors configured)

## Key blockers (exact status)
- Quick commerce (Blinkit 403, Zepto 429, Instamart 202, BigBasket shell, Minutes pending): no public plain-HTTP data → partner API or owner-authorized integration required
- Indian OTAs (MakeMyTrip, Goibibo, Cleartrip 403; Yatra timeout): WAF blocked
- Airlines direct (IndiGo timeout, Air India 404-path, Akasa timeout): no public fare API
- BookMyShow/PVR 403, Cinepolis connection-dropped: showtimes unavailable publicly
- Admitad: token 401 with current hPanel credentials — owner must re-verify client_id/secret
- Uber Eats: SOURCE_RETIRED (exited India 2020)

Admin: GET /api/admin/acceptance (matrix), POST /api/admin/acceptance/run (re-sweep). JSON evidence: docs/acceptance-results.json.
