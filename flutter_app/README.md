# Try1Second — Flutter App (Android + iOS)

The official Try1Second mobile app. Same design language as
www.try1second.com — red gradient badge, gold ring, white/slate cards,
Plus Jakarta Sans, bold type — and the same core promise: **every price
shown is verified live by the Try1Second engine; unavailable sources are
reported honestly, never mocked.**

## v1.5.0 — Full website parity (14 Oct 2026)

Complete rebuild of the app shell to mirror try1second.com screen-for-screen:

- **Home** — dark `#0D0714` hero (engine pill, 4 stat tiles, gradient
  headline, Price Lens bar with Find Cheapest → in-app product page),
  Ask Try1Second AI (text + voice), Quick Apps rail, 11 vertical cards,
  referral teaser.
- **Compare** — vertical tabs + per-vertical search forms. Route fields
  use the website's exact city autocomplete dataset (180 cities with
  badges/subtext) and per-vertical preset suggestion lists; text fields
  drive live `/api/scrape/live` searches with grouped cards (one product =
  one card, cheapest site first): TravelTile (flights/bus/cab), HotelCard
  (Trivago-style), CreditCardTile (full-width card art, fees/rewards/APR),
  GroupCard (ecommerce/grocery/food/movies/loans/insurance, % rates for
  loans/insurance), sort tabs + filter, site rows with server-masked
  `/api/out` redirects, price-alert sheet.
- **AI Insights** — URL price scanner (`/api/scan/url`) + Deal Score tab
  (score ring 0-100, buy/wait verdict, real history chart from
  `/api/product-page`).
- **Product page** — offers, real price history, deal score, related
  products, alert creation.
- **Rewards** — Deals & Coupons hub (store tiles with UP TO X% OFF, deal
  cards with codes, all via `/api/out`), real Spin & Earn wheel
  (`/api/rewards/spin`), referral link.
- **Price Tracker** — server-side alerts (list/delete, target prices).
- **Notifications** — price drops + announcements with unread badge,
  mark-read, radar shortcut.
- **Scanner Radar** — live source health from `/api/status` + verified
  fetch log from `/api/provenance`.
- **Profile** — Google sign-in (RS256 ID token → `/api/auth/google-mobile`
  → session token in secure storage), wallet, logout clears everything.
- **Auth lifecycle** — SplashGate verifies the saved session against
  `/auth/me` before entering the shell.

## Features

- **Metasearch across 11 verticals** — e-commerce, hotels, flights, bus,
  trains, 10-min grocery, food, movies, cab, loans, insurance.
- **Grouped results** — offers are grouped per canonical product; the
  cheapest verified price leads each card.
- **Product detail** — all sites compared, REAL price-history chart
  (CustomPainter, mirrors the web SVG), Buy now / Wait / Fair verdict
  computed only from recorded history, honest empty states.
- **Watchlist** — track products; re-checked against the live engine on
  open/refresh with explicit drop/rise deltas.
- **Safe redirects** — every "Open" resolves through the server-side
  `/api/go` pointer (clicks recorded, affiliate applied server-side).
- **Settings** — city/pincode for local live pricing, backend URL
  override, dark mode (slate-950 surfaces, same red accent).
- **Responsive** — phones: bottom navigation, 2-column vertical grid;
  tablets/desktop: NavigationRail, wider grids, centered 760dp content.

## Run it

The repository ships the complete Dart code (`lib/`, `test/`, `pubspec.yaml`).
Generate the native platform folders once with the Flutter SDK:

```bash
cd flutter_app
flutter create . --org com.try1second --project-name try1second \
  --platforms android,ios
flutter pub get
flutter test          # runs the core test suite
flutter run           # on a connected device or emulator
flutter build apk --release
flutter build ipa    # on macOS with Xcode, for App Store distribution
```

Note: `flutter create .` keeps existing files and only adds the missing
`android/` and `ios/` scaffolding.

## Architecture

```
lib/
  main.dart                  App entry, theme mode switching
  core/
    api.dart                 Pure-Dart models + client + matching/verdict
                             logic (same rules as web + extension:
                             canonical-entity or >=60% title overlap,
                             zero-price = unknown, no fabrication)
    theme.dart               Brand colors/text/themes (light + dark)
    verticals.dart           The 11 verticals with icons & placeholders
    storage.dart             Settings + watchlist via shared_preferences
  ui/
    main_shell.dart          Adaptive nav (bottom bar / NavigationRail)
    widgets/                 Logo, history chart, cards, buttons
    screens/                 Home, Results, Product, Watchlist, Settings
test/
  core_api_test.dart        Unit tests: parsing, grouping, matching,
                            verdict, ₹ formatting, MockClient API tests
```

### Backend endpoints (all real)

| Endpoint | Purpose |
| --- | --- |
| `POST /api/search` | Verified offers for a query (11 verticals) |
| `GET /api/history?entity=` | Recorded price history for the product |
| `GET /api/go?url=&offerId=` | Safe, click-recorded, affiliate-applied redirect |

Default backend: `https://www.try1second.com` (changeable in Settings).

### Honest-data guarantees (mirrored from the master rules)

1. No mock/synthetic prices or history — API data only.
2. `effectivePrice == 0` renders as unknown, never as ₹0.
3. A group's "best" is always the cheapest offer that actually owns a price.
4. Verdicts require ≥3 recorded history points.
5. The watchlist updates a price only from a live engine match.
