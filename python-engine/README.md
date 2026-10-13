# Try1Second Browserless Acquisition Engine (Python Blueprint)

Production-ready, mass-scale real-time price/product aggregation across the
10 verticals (hotels, flights, e-commerce, grocery, bus, cab, movies, food,
loans, insurance) — pure browserless reverse engineering.

## Non-negotiables
- **NO browser automation** (Selenium/Puppeteer/Playwright/DrissionPage):
  they leak automation fingerprints and die to Cloudflare Turnstile, Akamai,
  Kasada. The only transport is `curl_cffi` with `impersonate="chrome"`
  (byte-identical Chrome TLS/JA3/HTTP2 fingerprint, no browser spawned).
- **Self-healing**: endpoint drift (403/404/schema) triggers static JS bundle
  analysis that rewrites `scraper_configs.api_endpoint` in the database.
- **No fabricated data**: blocked / unparsed / fare-less rows return empty —
  the platform reports "unavailable" honestly.
- **Hidden affiliate deeplinking**: every click-out resolves the company's
  active affiliate profile server-side, applies the network-specific encoding
  (Cuelinks single-encoded `url=`, vCommission double-encoded `u=`, Admitad
  `ulp=`), and serves an HMAC-signed masking pointer. Network tokens never
  reach the frontend.

## Layout
```
models/schema.sql        MODULE 1 — PostgreSQL spec (companies, verticals,
                         scraper_configs, affiliate_configs)
engine/core.py           types + 10-vertical target registry + ConfigStore protocol
engine/http_client.py    BrowserlessSession (curl_cffi, retries, error taxonomy)
engine/scanner.py        MODULE 2 — DynamicScannerEngine (JS self-healing)
engine/factory.py        MODULE 3 — BaseScraper factory + concrete scrapers
engine/deeplink.py       MODULE 4 — build_secure_deeplink + masking pointers
tests/test_engine.py     9 unit tests (offline, injectable fetch)
```

## Quick start
```bash
pip install curl_cffi beautifulsoup4
python -m unittest discover -s python-engine/tests
```

## Production note
The live Node/TypeScript production app (www.try1second.com, Hostinger
shared hosting) implements the same architecture natively — see
`server/affiliate/deeplink.ts` (Module 4 twin), migration
`database/migrations/007_affiliate_configs.sql` (affiliate_configs), and the
`server/workers/*` acquisition tasks. This Python engine is the portable
blueprint/offline batch counterpart: same data model, same healing contract,
same deeplink semantics.
