-- ============================================================================
-- MODULE 1 — DATA SPECIFICATION MODEL (PostgreSQL)
-- Try1Second browserless acquisition engine: one unified backend for the
-- 10 verticals (hotels, flights, e-commerce, grocery, bus, cab, movie, food,
-- loan, insurance). Mirrors production MySQL migration 007_affiliate_configs.
--
-- Design notes:
--   * scraper_configs is the SELF-HEALING CACHE. The DynamicScannerEngine
--     (Module 2) rewrites api_endpoint / regex_healing_rules in place when a
--     target platform drifts (403/404/schema validation failures).
--   * affiliate_configs holds ONE canonical tracking template per company
--     (per network), set up ONCE in admin. Module 4 never invents parameters:
--     a company without an active profile deep-links directly.
-- ============================================================================

CREATE TABLE IF NOT EXISTS verticals (
    id          SERIAL PRIMARY KEY,
    slug        VARCHAR(64) UNIQUE NOT NULL,          -- 'hotels', 'bus', ...
    name        VARCHAR(120) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS companies (
    id           SERIAL PRIMARY KEY,
    slug         VARCHAR(64) UNIQUE NOT NULL,          -- 'abhibus', 'swiggy-instamart'
    name         VARCHAR(160) NOT NULL,                 -- 'AbhiBus'
    vertical_id  INT NOT NULL REFERENCES verticals(id) ON DELETE CASCADE,
    base_domain  VARCHAR(190) NOT NULL,                -- 'abhibus.com'
    active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Self-healing acquisition cache: exactly one live acquisition profile per
-- company. `api_endpoint` is the CURRENT known internal JSON endpoint;
-- `target_js_keywords` locate the production bundle(s) to scan;
-- `regex_healing_rules` (JSONB array of {pattern, priority}) are the Module 2
-- candidate-extraction rules the scanner applies to minified JS.
CREATE TABLE IF NOT EXISTS scraper_configs (
    id                    SERIAL PRIMARY KEY,
    company_id            INT NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
    api_endpoint          TEXT NOT NULL,                -- current live endpoint URL
    http_method           VARCHAR(10) NOT NULL DEFAULT 'GET',
    request_template      JSONB NOT NULL DEFAULT '{}', -- body/qs skeleton per vertical
    headers               JSONB NOT NULL DEFAULT '{}', -- impersonation headers
    target_js_keywords    TEXT[] NOT NULL DEFAULT ARRAY['main','app','index','chunk'],
    regex_healing_rules   JSONB NOT NULL DEFAULT '[]',
    js_bundle_allowlist   TEXT[] NOT NULL DEFAULT '{}', -- optional exact src allowlist
    max_bundle_bytes      INT NOT NULL DEFAULT 4_000_000,
    consecutive_failures  SMALLINT NOT NULL DEFAULT 0,
    last_healed_at        TIMESTAMPTZ,
    last_success_at       TIMESTAMPTZ,
    status                VARCHAR(24) NOT NULL DEFAULT 'active'
                               CHECK (status IN ('active','healing','blocked','disabled')),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One active affiliate tracking template per company. Network-specific
-- encodings are applied by Module 4 (Cuelinks = single-encoded url=,
-- vCommission = double-encoded u=, Admitad = ulp= single-encoded + subid=).
CREATE TABLE IF NOT EXISTS affiliate_configs (
    id                 SERIAL PRIMARY KEY,
    company_id         INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    network            VARCHAR(24) NOT NULL
                          CHECK (network IN ('cuelinks','vcommission','admitad','direct')),
    tracking_template  TEXT NOT NULL,      -- contains {url},{url2},{subid},{campaign},{click}
    campaign_key       VARCHAR(160),        -- network campaign/advertiser id (never invented)
    subid_param        VARCHAR(40) NOT NULL DEFAULT 'subid',
    extra_params       JSONB NOT NULL DEFAULT '{}',
    active             BOOLEAN NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (company_id, network)
);

CREATE INDEX IF NOT EXISTS idx_companies_vertical ON companies(vertical_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_active   ON affiliate_configs(company_id) WHERE active;

-- ---- Seed: the 10 verticals (exact targets are owned by the operator) ----
INSERT INTO verticals (slug, name) VALUES
    ('hotels','Hotels'), ('flights','Flights'), ('ecommerce','E-Commerce'),
    ('grocery','10-Minute Grocery'), ('bus','Bus'), ('cab','Cab'),
    ('movies','Movies'), ('food','Food Delivery'), ('loans','Loans'),
    ('insurance','Insurance')
ON CONFLICT (slug) DO NOTHING;
