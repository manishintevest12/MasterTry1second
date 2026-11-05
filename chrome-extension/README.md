# Try1Second Chrome Extension

Cross-site price comparison, real price-history graphs and price-drop alerts —
powered by the independent Try1Second metasearch engine. The UI is Try1Second's
own design language (white cards, slate borders, red-600 accent, Plus Jakarta Sans).

## Why it's more advanced than Buyhatke-style extensions

- **Cross-site best price on the product page** — the panel matches the product
  you're viewing against Try1Second's verified offers for the *same canonical
  product* across sites (Amazon, Flipkart, Myntra, Ajio, Tata CLiQ, Shopsy + every
  source the Try1Second engine has), not just a single-store price tracker.
- **Real price history** — the graph plots only prices actually recorded by the
  Try1Second backend (`GET /api/history`). If no history exists yet, it says so.
  Synthetic/generated history is never drawn (no-fabrication rule).
- **Buy / wait verdict** — computed only from recorded history (position between
  the real lowest and highest observed prices).
- **Price-drop alerts** — tracked products are re-checked against the live
  backend every 30 minutes; a Chrome notification fires on a verified drop.
- **Honest "unavailable"** — when the backend can't verify an offer, the panel
  states it. It never renders invented prices.
- **Safe affiliate redirects** — "Open" buttons go through Try1Second's server-side
  masking pointer (`/api/go`), which validates the destination, records the click
  and applies affiliate tracking. Tokens never live in the browser.
- **Metasearch popup** — search any product across sites right from the toolbar,
  plus a tracked-items dashboard and settings (city/pincode, backend URL).

## Install (unpacked, developer mode)

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select this `chrome-extension/` folder
4. Open any product page on amazon.in, flipkart.com, myntra.com, ajio.com,
   tatacliq.com or shopsy.in — the Try1Second panel appears bottom-right.

## Architecture

```
chrome-extension/
  manifest.json          MV3 manifest
  lib/api.js             Shared backend client + storage helpers (used by
                         content script, popup AND service worker)
  lib/sites.js           Per-site product extractors (title/price/MRP/image)
  content/content.js     On-page Try1Second panel (comparison, history chart,
                         verdict, tracking)
  content/content.css    Panel styling (Try1Second brand)
  background/service-worker.js
                         Alarm-driven price watcher (30 min), drop
                         notifications, badge, content-script fetch bridge
  popup/                 Toolbar dashboard: search, tracked list, settings
  icons/                 Brand badge icons (16/32/48/128)
```

### Backend endpoints used (all real, all live)

| Endpoint | Purpose |
| --- | --- |
| `POST /api/search` | Cross-site verified offers for a query (vertical `ecommerce`) |
| `GET /api/history?entity=<canonicalEntityId>` | Recorded price history for the matched product |
| `GET /api/go?url=<sellerUrl>&offerId=<id>` | Safe, click-recorded, affiliate-applied redirect |

### Key design points

- **Content scripts cannot fetch cross-origin.** All API calls from content
  scripts are relayed through the service worker via `chrome.runtime`
  messaging (`t1s-fetch` bridge); the worker's `host_permissions` allow the
  cross-origin request.
- **Matching is honest:** a backend offer is shown only when it maps to the same
  canonical entity id, or when ≥60% of its title tokens appear on the product
  page. Otherwise: "no verified offers yet".
- **Alerts compare like-for-like:** the watcher re-runs the same query, matches
  the same canonical entity and only then updates the recorded price.

## Settings

- **City / Pincode** — passed to `/api/search` so live pricing is location-aware.
- **Backend URL** — defaults to `https://www.try1second.com`; change it to test
  against a staging deployment.
