# Browserless Acquisition & Unified Engine Blueprint (Try1Second)

Owner-approved architecture addendum. This blueprint formalises the requested
"mass-scale, real-time product & price comparison aggregator" design onto the
ALREADY-DEPLOYED stack: **Node.js/TypeScript modular monolith + MySQL on Hostinger
shared hosting** (not Python/PostgreSQL — the deployed reality wins; every module
below maps 1:1 onto a Python blueprint of the same shape).

## 0. Anti-bot stance (non-negotiable)

- **Primary acquisition is pure browserless direct HTTP** (`httpAcquire`, Node fetch
  with realistic browser headers). No Selenium/Puppeteer/Playwright in the hot path.
- **We do NOT ship TLS-impersonation (curl_cffi-style) or rotating-proxy WAF
  evasion.** Owner's standing decision: no proxies, no CAPTCHA bypass. A source
  that blocks us is reported honestly as `unavailable` (`honestNotice`), never
  faked, and the cache/cron warmer serves the last verified data.
- Rate limits per source (`rateLimit.maxRequestsPerMinute`) keep us a polite
  crawler, which is also what keeps shared-hosting IPs alive long-term.

## 1. Data Specification Model (MySQL DDL)

Adapted from the requested `companies / verticals / scraper_configs /
affiliate_configs` model. `offers` already exists as the price-row source of
truth; the three config tables below are the admin-controlled layer (deploy via
the existing migration bootstrap when activated):

```sql
CREATE TABLE companies (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  slug         VARCHAR(64) NOT NULL UNIQUE,          -- 'flipkart', 'swiggy'
  display_name VARCHAR(120) NOT NULL,
  domain       VARCHAR(190) NOT NULL,               -- 'www.flipkart.com'
  affiliate_config_id INT NULL,                      -- FK affiliate_configs.id
  blocked      TINYINT(1) NOT NULL DEFAULT 0,        -- honest 'unavailable' flag
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE scraper_configs (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  company_id       INT NOT NULL,                     -- FK companies.id
  vertical         VARCHAR(24) NOT NULL,             -- 'ecommerce', 'food', ...
  api_endpoint     VARCHAR(500) NOT NULL,            -- current internal JSON endpoint
  target_js_keywords JSON NULL,                      -- ['search','grid','items']
  regex_healing_rules JSON NULL,                     -- [{"pattern":"apiBase\\\":\\\"(https:[^\"]+)","field":"api_endpoint"}]
  payload_template JSON NULL,                        -- pincode/city-aware query payload
  last_healed_at   TIMESTAMP NULL,
  health           ENUM('ok','drifted','blocked') DEFAULT 'ok',
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_company_vertical (company_id, vertical)
);

CREATE TABLE affiliate_configs (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  network       ENUM('cuelinks','vcommission','admitad','optimise','direct') NOT NULL,
  campaign_key  VARCHAR(120) NOT NULL,               -- network's merchant/company key
  company_id    INT NOT NULL,                        -- FK companies.id
  template      VARCHAR(500) NOT NULL,               -- 'https://linksredirect.com/?cid=CID&source=linkkit&u={encoded_url}'
  subid_param   VARCHAR(40) NULL,                    -- 'subid' / 'subId' / 'sub_id'
  extra_params  JSON NULL,                           -- network-specific params
  active        TINYINT(1) NOT NULL DEFAULT 1,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_network_company (network, company_id)
);
```

## 2. Self-Healing Engine — `DynamicScannerEngine` (TS)

`server/acquisition/selfHeal.ts` (phase 2 build; interfaces frozen here):

```ts
export interface HealReport {
  companyId: number; vertical: string;
  healed: boolean; oldEndpoint?: string; newEndpoint?: string;
  matchedKeyword?: string; scannedBundles: string[]; at: string;
}
export class DynamicScannerEngine {
  /** 1. GET company.domain root (browserless). 2. BeautifulSoup-equivalent:
   *  cheerio over <script src> for bundles matching /main|index|app|chunk/.
   *  3. Download each bundle as text. 4. Apply scraper_configs.regex_healing_rules
   *  to find updated API bases / route arrays. 5. Write the fresh endpoint back
   *  to scraper_configs (immediately) and mark health='ok'. */
  async heal(configId: number): Promise<HealReport>;
}
```

Trigger: a worker sees 403/404/schema-mismatch → emits `SOURCE_DRIFT` → admin
runs (or cron runs) `heal()` → next search uses the recovered endpoint. Bundles
are public static assets; no browser is ever launched.

## 3. Factory pattern — already live

The deployed `VerticalWorker` registry IS the requested factory: a base class owns
session, headers, timeouts, retries, rate limits and honest error taxonomy
(`AcquisitionError` classes), while child workers (`food.ts`, `grocery.ts`, …)
implement only `parse()` for their vertical's JSON schema. All 13 verticals map
onto this single engine; the new strict-token ranker in `routes.ts` is shared too.

## 4. Dynamic Deeplink Interceptor & Generator

```ts
// server/affiliate/deeplink.ts (builds on baseProvider.ts, already deployed)
export async function buildSecureDeeplink(
  companySlug: string, targetProductUrl: string, clickId?: string
): Promise<string> {
  // 1. companies.slug -> active affiliate_configs row (cached in memory, TTL 5m).
  // 2. encodeURIComponent(targetProductUrl) merged into `template` at {encoded_url}.
  // 3. Network nuances: vCommission/Cuelinks want subid + double-encoded u=;
  //    Admitad wants subId + base64-safe clickTag. Handled by per-network adapters.
  // 4. Tokens NEVER reach the frontend: the caller gets a masking pointer
  //    `/go/{companySlug}?t={hmac-signed short id}`; the redirect endpoint
  //    resolves and 302s server-side. Attribution links are validated before use.
}
```

## 5. Critical repairs — status

| Repair | Status |
|---|---|
| Strict query-to-item token sanitisation (every query word must appear as a whole word in the title; no substitutes; honest `no exact matches` notice otherwise) | **Deployed** in `/api/scrape/live` (food, grocery, ecommerce) |
| Dev-phase IP-block fallback | **Deployed** — `server/acquisition/devFixtures.ts` (only `T1S_DEV_FIXTURES=1` + `NODE_ENV=development`; rows labelled `DEV FIXTURE`) |
| Geo/pincode-aware payloads | Partial — workers already receive `pincode/city/locality/coordinates`; Swiggy uses city centroids. Pincode→latlng geocode table is phase 2. |
| Proxy rotation | **Not built, by owner decision** (see §0) |
| Product-specific images + `via {Seller}` badges; clean fallback state when the source published no photo | **Deployed** (previous commits) |
