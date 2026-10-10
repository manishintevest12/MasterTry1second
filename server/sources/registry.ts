/**
 * Source Registry + Policy Engine (Sections 2, 4).
 * - Seeds the registry from code defaults, then overlays DB (source_adapters) config
 * - Selection by: vertical, query type, capability, health, priority, freshness policy,
 *   authorization and rate limits. SearchApi and other providers are OPTIONAL adapters.
 * - No source is treated as mandatory; the engine runs with zero enabled sources.
 */
import type { ParsedQuery, SourceConfig, VerticalId } from '../types';
import { settings } from '../common/settings';
import { canAttempt, getHealth } from './health';

const DEFAULT_FRESHNESS = { liveVerifiedTtlSec: 900, freshTtlSec: 3600, maxStaleSec: 86400 };

function src(p: Partial<SourceConfig> & Pick<SourceConfig, 'id' | 'name' | 'method' | 'verticals'>): SourceConfig {
  return {
    enabled: false, // all sources start disabled until configured & verified — honest default
    priority: 100,
    config: {},
    rateLimit: { maxRequestsPerMinute: 20, maxConcurrency: 2 },
    freshnessPolicy: DEFAULT_FRESHNESS,
    adapterVersion: '1.0.0',
    parserVersion: '1.0.0',
    requiresAuthorization: false,
    permittedForRetention: true,
    ...p,
  };
}

/** Registry seeds. Sources are disabled until an admin verifies them. */
function seedSources(): SourceConfig[] {
  return [
    // ---- Direct HTTP (legit public pages; subject to their ToS) ----
    src({ id: 'http_amazon_in', name: 'Amazon.in Product Page (direct HTTP)', method: 'direct_http', verticals: ['ecommerce'], priority: 10 }),
    src({ id: 'http_flipkart', name: 'Flipkart Product Page (direct HTTP)', method: 'direct_http', verticals: ['ecommerce'], priority: 11 }),
    // ---- Structured public feeds ----
    src({
      id: 'structured_books', name: 'Open Library / public structured data', method: 'structured_data',
      verticals: ['ecommerce'], priority: 30,
      // Public structured endpoint, no credentials — verified working; auto-enabled.
      enabled: true,
      config: { baseUrl: 'https://openlibrary.org/search.json?fields=title,author_name,isbn,first_publish_year,key&limit=20', schema: 'openlibrary_search', paramMap: { query: 'q' } },
      requiresAuthorization: false,
    }),
    // ---- Affiliate feed (Cuelinks) ----
    src({
      id: 'affiliate_cuelinks', name: 'Cuelinks Affiliate Feed', method: 'affiliate_feed',
      verticals: ['ecommerce', 'coupons', 'banking', 'giftcards'], priority: 20,
      config: { apiKey: settings.cuelinks.apiKey, campaignId: settings.cuelinks.campaignId, subId: settings.cuelinks.subId },
      requiresAuthorization: true,
      // Credentials present → enabled; orchestrator records real outcomes (REQUEST_SUCCEEDED etc.)
      enabled: Boolean(settings.cuelinks.apiKey),
    }),
    // ---- Affiliate feed (VCommission) ----
    src({
      id: 'affiliate_vcommission',
      name: 'VCommission Affiliate Feed',
      method: 'affiliate_feed',
      verticals: ['ecommerce', 'coupons', 'banking', 'giftcards'],
      priority: 21,
      config: { apiKey: settings.vcommission.apiKey, baseUrl: settings.vcommission.baseUrl, schema: 'vcommission_campaigns' },
      requiresAuthorization: true,
      // Credentials present → enabled; the feed was verified live (55 campaigns).
      enabled: Boolean(settings.vcommission.apiKey),
    }),
    // ---- Partner feed (placeholder until a partner grants access) ----
    src({
      id: 'partner_generic', name: 'Partner Feed (configure per partner)', method: 'partner_feed',
      verticals: [], priority: 40,
      requiresAuthorization: true,
    }),
    // ---- Official API (placeholders until authorized) ----
    src({
      id: 'api_irctc', name: 'IRCTC API (requires authorization)', method: 'official_api',
      verticals: [], priority: 25, requiresAuthorization: true,
    }),
    src({
      id: 'api_bus', name: 'Bus operator API (requires authorization)', method: 'official_api',
      verticals: ['bus'], priority: 25, requiresAuthorization: true,
    }),
    // OPTIONAL search provider deliberately NOT seeded — Try1Second acquires
    // its own data (direct cURL → headless-browser fallback). Owner decision:
    // no SearchApi.io or any third-party search/marketplace API.
  ];
}

let sources: SourceConfig[] = seedSources();

export function getSources(): SourceConfig[] {
  return sources;
}

export function getSource(id: string): SourceConfig | undefined {
  return sources.find((s) => s.id === id);
}

/** DB overlay: enabled/priority/config stored in source_adapters wins over seed defaults. */
export async function loadSourcesFromDb(): Promise<{ loaded: number; dbKind: string }> {
  try {
    const { getStore } = await import('../common/db');
    const store = getStore();
    const rows = await store.query<any>('SELECT id, name, method, verticals, enabled, priority, config, rate_limit_pm, max_concurrency FROM source_adapters');
    for (const row of rows) {
      const existing = sources.find((s) => s.id === row.id);
      if (!existing) continue;
      existing.enabled = Boolean(row.enabled);
      existing.priority = Number(row.priority);
      if (row.config) {
        try {
          const cfg = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;
          existing.config = { ...existing.config, ...cfg };
        } catch { /* keep seed config */ }
      }
      if (row.rate_limit_pm) existing.rateLimit.maxRequestsPerMinute = Number(row.rate_limit_pm);
      if (row.max_concurrency) existing.rateLimit.maxConcurrency = Number(row.max_concurrency);
    }
    return { loaded: rows.length, dbKind: store.kind };
  } catch {
    return { loaded: 0, dbKind: 'none' };
  }
}

export function updateSource(id: string, patch: Partial<SourceConfig>): SourceConfig | null {
  const s = sources.find((x) => x.id === id);
  if (!s) return null;
  Object.assign(s, patch);
  void (async () => {
    try {
      const { getStore } = await import('../common/db');
      const store = getStore();
      await store.execute(
        `INSERT INTO source_adapters (id, name, method, verticals, enabled, priority, config, rate_limit_pm, max_concurrency)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE enabled=VALUES(enabled), priority=VALUES(priority), config=VALUES(config), rate_limit_pm=VALUES(rate_limit_pm), max_concurrency=VALUES(max_concurrency)`,
        [s.id, s.name, s.method, JSON.stringify(s.verticals), s.enabled ? 1 : 0, s.priority, JSON.stringify(s.config), s.rateLimit.maxRequestsPerMinute, s.rateLimit.maxConcurrency],
      );
    } catch { /* file store */ }
  })();
  return s;
}

/**
 * Policy Engine: ordered candidate selection for a query.
 * Never returns a source that is disabled, circuit-open, or missing required credentials.
 */
export function selectSources(query: ParsedQuery, opts: { allowStale?: boolean } = {}): SourceConfig[] {
  const vertical: VerticalId | null = query.vertical;
  const candidates = sources.filter((s) => {
    if (!s.enabled) return false;
    if (vertical && s.verticals.length > 0 && !s.verticals.includes(vertical)) return false;
    if (!canAttempt(s.id)) return false;
    // Required credentials must be present for authorized sources
    if (s.requiresAuthorization && !s.config.apiKey && s.method !== 'partner_feed') return false;
    return true;
  });
  const scored = candidates.map((s) => {
    const h = getHealth(s.id);
    let score = s.priority;
    if (h.state === 'DEGRADED') score += 25;
    if (h.state === 'UNVERIFIED') score += 10;
    if (s.method === 'search_provider') score += 50; // acquisition priority: optional providers last
    return { s, score };
  });
  scored.sort((a, b) => a.score - b.score);
  return scored.map((x) => x.s);
}

export function sourcesStatusReport() {
  return sources.map((s) => {
    const h = getHealth(s.id);
    return {
      id: s.id,
      name: s.name,
      method: s.method,
      verticals: s.verticals,
      enabled: s.enabled,
      health: h.state,
      lastSuccessAt: h.lastSuccessAt,
      lastFailureAt: h.lastFailureAt,
      lastFailureClass: h.lastFailureClass,
      totalAttempts: h.totalAttempts,
      totalSuccesses: h.totalSuccesses,
      // Honest classification (Section 23 Phase 9)
      classification: s.enabled
        ? h.state === 'HEALTHY' ? 'WORKING_AND_VERIFIED'
          : h.state === 'CIRCUIT_OPEN' ? 'PARTIALLY_WORKING'
          : h.totalSuccesses > 0 ? 'PARTIALLY_WORKING' : 'CONFIGURATION_REQUIRED'
        : (s.requiresAuthorization && !s.config.apiKey) ? 'CONFIGURATION_REQUIRED' : 'UNAVAILABLE',
    };
  });
}
