# Quick-commerce recon (in-house acquisition, NO third-party API) — 13 Oct 2026 (updated)

Owner directive: replicate how Actowiz-type companies get real-time quick-commerce data,
ourselves, with no third-party API and no proxy.

## The technique, verified: APK reverse-engineering
Their method = extract the mobile app's API routes/keys, call the app backends directly
(app backends are NOT behind the web-edge bot managers). Pipeline that now works:
Aptoide public API (ws75.aptoide.com/api/7/apps/search?query=) → direct APK from
pool.apk.aptoide.com (plain CDN, NO captcha, sandbox-curlable) → unzip → grep
classes*.dex + assets/index.android.bundle (RN Hermes) for hosts/routes.

## Zepto (APK com.zeptoconsumerapp v26.9.2 from Aptoide — analyzed)
- Gateway: api-gateway.zepto.co.in (AWS CloudFront + Kong) — microservices:
  user-search-service, product-assortment-service, serviceability-service, cart-service,
  coupon-service, payment-service, oms, rewards-service, chat-service, etc.
- Search route (from RN bundle): POST api-gateway.zepto.co.in/api/v3/search
  (+ /v3/search/bulk, /v3/search/filters), also api.zepto.co.in/api base.
- STATUS: route EXISTS but CloudFront WAF returns 429 empty from datacenter IP.
  Try from Hostinger prod IP + real app headers (x-platform/app-version tried).
  zeptonow.com and zepto.com web = 202 challenge; bouncer.zepto.co.in = 400 invalid request.

## Swiggy Instamart (OLD APK v3.22.5 analyzed + instamart web bundle) — LIVE ENDPOINTS FOUND
- instamart.swiggy.com web app JS is on instamart-media-assets.swiggy.com (Cloudinary,
  OPEN). Bundle: dash-front-assets/js/app.c63a1a8dcf92208ee153.js
- KNOWN LIVE (200, real JSON widgets, NO challenge from datacenter IP):
  POST https://instamart.swiggy.com/api/instamart/home/select-location/v2
       body {"data":{"lat":19.076,"lng":72.8777,"address":"Mumbai","clientId":"INSTAMART-APP"}}
  GET  https://instamart.swiggy.com/api/instamart/home/v2?clientId=INSTAMART-APP&lat=..&lng=..
  GET  https://instamart.swiggy.com/api/instamart/launch?clientId=INSTAMART-APP...
  home/v2 returns storeId (1403030 Mumbai) + collectionId/category deeplinks.
- Gated (202 challenge): /api/instamart/search*, listing endpoints (in lazy chunks).
- Also from old APK: stores.swiggy.com/api/customsearch/v1 (live, 400 validation —
  needs correct params), stores.swiggy.com/generate-token.
- NEXT: find the search/listing XHR in lazy chunk or via runtime capture; item API
  /api/instamart/item/v2/{id}/widgets is known — feed it IDs.

## Blinkit
- Not on Aptoide; uptodown has no Blinkit; apkpure browser download can't transfer file
  (d.apkpure.com Cloudflare-403 from sandbox); apksum download is reCAPTCHA+CF-gated.
- Web routes known via Wayback (docs below). api.blinkit.com Kong reachable, routes unknown.

## BigBasket / DMart / JioMart
- bigbasket.en.uptodown.com/android EXISTS (v8.42.0) but download = Cloudflare Turnstile.
- JioMart: www.jiomart.com NOT IP-blocked; API host api.jiomartjcp.com reachable (nginx);
  Fynd config in page source: applicationID 685945f46c8c7aee3f3af605,
  applicationToken TpKw7wD9h, domain https://api.jiomartjcp.com; routes still unknown.

## Open app API hosts (all reachable, no challenge): api.blinkit.com (Kong),
api.zepto.com, api.bigbasket.com, api.jiomartjcp.com, api-gateway.zepto.co.in (WAF 429),
instamart.swiggy.com (home APIs), stores.swiggy.com

## Earlier banked findings (see git history)
- Blinkit web routes from Wayback: /v1/layout/feed, /v1/layout/product_suggestion,
  /v1/layout/listing_widgets, /v1/consumerweb/eta, /v5/carts (edge-gated on www).
