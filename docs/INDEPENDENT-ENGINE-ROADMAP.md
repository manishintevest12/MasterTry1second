# Try1Second — Fully Independent Metasearch Engine Roadmap

Owner decision (2026-10-10): Try1Second is its own metasearch engine. No third-party
search/comparison APIs, no proxies, no middlemen. cURL/direct HTTP is the primary
acquisition technique; headless-browser rendering (Playwright) is the fallback when a
page is JS-rendered. Affiliate networks (VCommission, Cuelinks, Admitad, Optimise)
join later only as MONETIZED data feeds + deeplink generators — never as dependencies
the engine cannot run without.

## Where we are (verified)

- Acquisition chain: direct cURL/HTTP → Playwright render fallback → honest
  CAPABILITY_UNAVAILABLE / ACCESS_CHALLENGE states. Never fabricates.
- Pipeline: normalize → validate → freshness/evidence → persist (MySQL) → rank.
- Three-tier cache already in place (Section 8): L1 in-process (stampede-safe),
  L2 Redis (REDIS_URL), L3 MySQL catalogue. MySQL is the only source of truth.
- Gemini AI assist already wired: gemini-2.5-flash query understanding
  (GEMINI_API_KEY, off unless key present).
- Cron cache-warmer: `server/cron/warm.ts` → `cron.cjs`. Re-runs top queries from
  the last 7 days so new users hit warm cache; only freshness-demanding offers
  re-acquire. hPanel: `30 * * * * node cron.cjs >> cron.log 2>&1`.

## The road to full independence

### Phase 1 — cURL source coverage (current focus)
For each of the 10 comparison verticals, find merchant pages that serve usable
public data to plain cURL (JSON endpoints, JSON-LD in HTML, sitemaps).
- Add candidates per vertical to `server/sources/registry.ts` (direct_http /
  structured_data), disabled until health-checked.
- Respect robots.txt, per-host rate limits, conditional GET (ETag/Last-Modified).
- Sites that block or challenge → honest `ACCESS_CHALLENGE` state. No bypass.

### Phase 2 — Headless render at scale (KVM4 only)
Playwright + chromium on the VPS: bounded browser pool (max N concurrent),
20s render cap, per-host queues. Expands reachable sources to JS-heavy merchants.
Never on shared hosting (memory limits).

### Phase 3 — Merchant partner feeds (the true independence play)
try1second.com/merchantinstab2b: merchants onboard and hand us their catalogues
(via the merchant portal). This is the only source class that can never be
taken away — data given willingly. Prioritize B2B recruitment for the verticals
where crawling is hardest (flights, hotels, loans, insurance).

### Phase 4 — Affiliate monetization layer (data already flowing)
1. `server/affiliate/deeplink.ts` — per-network deeplink adapters:
   - VCommission: campaign `link`/`url` templates from the campaigns API we
     already call; offer.sourceUrl mapped through the campaign's tracking link.
   - Cuelinks / Admitad / OptimiseMedia: same pattern, each needs its own
     publisher key (owner-approved signup).
2. `/go/:offerId` affiliate-safe redirect: 302 through the network's tracking
   URL with sub-ids for attribution (user id, vertical, source click id).
3. Clicks land in a MySQL `clicks` table → commission reconciliation reports.
4. Attribution links validated before redirect (Section 15, affiliate-safe
   redirects); offers without a valid campaign link keep the merchant's direct
   URL (no commission, still honest).

### Phase 5 — Scale & resilience (KVM4)
Redis-backed queue workers for warm/refresh jobs, per-source circuit breakers
(already present), health dashboards on /admininsta, and query-driven cache
priming as traffic grows.

## Non-negotiables
- No fabricated data. Unverified = shown as UNVERIFIED; no source = unavailable.
- No proxies, no CAPTCHA solving, no login bypass — ever.
- MySQL is the source of truth; cache tiers only hold derived, TTL'd data.
- Every acquisition path must degrade honestly when its capability is missing.
