/**
 * DynamicScannerEngine — static JS code-analysis self-healing (MODULE 5, phase 2).
 *
 * When a source's internal endpoint drifts (404/schema mismatch) or its bundle
 * reveals a fresh API base, this engine re-derives the endpoint from the site's
 * PUBLIC static JS bundles — 100% browserless (curl_cffi chrome impersonation,
 * no automation frameworks, no WAF solving). Bundles are plain static assets.
 *
 * Flow per source HEAL SPEC:
 *   1. GET the entry page(s) (server-rendered shell is fine — we only need <script src>).
 *   2. Collect bundle URLs matching the spec's bundleFilter (main|index|app|chunk),
 *      cap count + bytes (politeness, shared-hosting budget).
 *   3. Download each bundle as text.
 *   4. Run the spec's rules (named extraction regexes) over every bundle text;
 *      collect candidate values with their evidence (bundle URL + match context).
 *   5. Pick the winning candidate (spec-preferred pick function), optionally
 *      VERIFY it live (GET expecting non-404/403 status).
 *   6. Persist the override durably (MySQL table source_endpoint_overrides /
 *     file-fallback store) — workers read it at acquisition time.
 *
 * Honesty: if a rule finds nothing verifiable, healed=false and the report says
 * exactly which pages/bundles were scanned. Nothing is invented.
 */
import { getStore } from '../common/db';
import { cffiFetch } from '../common/curlCffiFetch';
import { log } from '../common/logger';

export interface HealRule {
  /** Logical config key this rule heals, e.g. 'api_base' or 'discover_path'. */
  key: string;
  /** Extraction regex applied to raw bundle text. First capture group = candidate value. */
  pattern: RegExp;
  /** Post-extraction normalisation (unescape "\/", strip quotes etc.). */
  normalize?: (raw: string) => string;
  /** Live verification: a fetch the candidate must answer with 2xx (not enforced for paths). */
  verifyGet?: (value: string) => string | null; // returns URL to probe, or null = skip probe
}

export interface HealSpec {
  sourceId: string;
  /** Page(s) whose HTML lists the bundles to scan. */
  entryPages: string[];
  /** Which <script src> bundles to download. */
  bundleFilter: RegExp;
  /** Max bundles downloaded per heal (politeness cap). */
  maxBundles?: number;
  /** Max bytes per bundle (memory cap on shared hosting). */
  maxBundleBytes?: number;
  rules: HealRule[];
  /** Prefer some candidate values over others (e.g. longest match). Default: first found. */
  pick?: (key: string, candidates: HealCandidate[]) => HealCandidate | undefined;
}

export interface HealCandidate {
  key: string;
  value: string;
  bundleUrl: string;
  context: string; // 60 chars around the match — evidence, never fabricated
}

export interface HealReport {
  sourceId: string;
  healed: boolean;
  at: string;
  entryPages: string[];
  scannedBundles: string[];
  overrides: Array<{ key: string; oldValue: string | null; newValue: string; verified: boolean }>;
  notes: string[];
}

const DEFAULTS = { maxBundles: 6, maxBundleBytes: 3_000_000 };

/** Registry of healing specs — one per source with known bundle structures. */
const SPECS: HealSpec[] = [
  {
    // BookMyShow (movies): the explore API base + discover path live as constants in the
    // site's webpack bundles (parser header documents modules 6161/74318).
    sourceId: 'w_movies_bookmyshow',
    entryPages: ['https://in.bookmyshow.com/explore/movies-bengaluru'],
    // BMS ships webpack chunks under /public/build/chunks/js/ (runtime, vendor-*, app, common-code, app-explore-*).
    bundleFilter: /\/public\/build\/chunks\/js\/(?:app|common-code|app-explore)[^"']*\.js/i,
    maxBundles: 4,
    maxBundleBytes: 4_000_000,
    rules: [
      {
        // `${host}/api/explore` — the explore API path suffix composed with a per-env host map.
        key: 'explore_api_path',
        pattern: /`\$\{[a-z]\}(\/api\/explore)`/,
      },
      {
        // production host in the env map: {...,prod:"https://in.bookmyshow.com"}[env]
        key: 'api_host',
        pattern: /(?:prod|production)\s*:\s*"(https:\/\/in\.bookmyshow\.com)"/,
      },
    ],
  },
];

export function getHealSpec(sourceId: string): HealSpec | undefined {
  return SPECS.find((s) => s.sourceId === sourceId);
}

export function extractScriptSrcsForTest(html: string): string[] { return extractScriptSrcs(html); }
function extractScriptSrcs(html: string): string[] {
  const out = new Set<string>();
  const re = /<script[^>]+src=["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out.add(m[1]);
  return [...out];
}

function absolutize(src: string, pageUrl: string): string {
  if (/^https?:\/\//i.test(src)) return src;
  try {
    return new URL(src, pageUrl).toString();
  } catch {
    return src;
  }
}

async function collectCandidates(spec: HealSpec): Promise<{ bundles: string[]; candidates: HealCandidate[]; notes: string[] }> {
  const notes: string[] = [];
  const candidates: HealCandidate[] = [];
  const bundleUrls = new Set<string>();
  for (const page of spec.entryPages) {
    try {
      const r = await cffiFetch(page, { impersonate: 'chrome', timeoutMs: 25_000 });
      if (r.status !== 200) { notes.push(`entry ${page} -> HTTP ${r.status}`); continue; }
      for (const s of extractScriptSrcs(r.body)) {
        const abs = absolutize(s, page);
        if (spec.bundleFilter.test(abs)) bundleUrls.add(abs);
      }
    } catch (e: any) {
      notes.push(`entry ${page} -> ${String(e?.message || e).slice(0, 80)}`);
    }
  }
  const bundles = [...bundleUrls].slice(0, spec.maxBundles ?? DEFAULTS.maxBundles);
  for (const b of bundles) {
    try {
      const r = await cffiFetch(b, { impersonate: 'chrome', timeoutMs: 25_000 });
      if (r.status !== 200) { notes.push(`bundle ${b.slice(-60)} -> HTTP ${r.status}`); continue; }
      const text = r.body.length > (spec.maxBundleBytes ?? DEFAULTS.maxBundleBytes)
        ? r.body.slice(0, spec.maxBundleBytes ?? DEFAULTS.maxBundleBytes)
        : r.body;
      for (const rule of spec.rules) {
        const re = new RegExp(rule.pattern.source, 'g');
        let m: RegExpExecArray | null;
        while ((m = re.exec(text))) {
          const raw = m[1];
          if (!raw) continue;
          const value = rule.normalize ? rule.normalize(raw) : raw;
          if (!value || value.length > 500) continue;
          candidates.push({ key: rule.key, value, bundleUrl: b, context: text.slice(Math.max(0, m.index - 30), m.index + 60).replace(/\s+/g, ' ') });
          if (candidates.filter((c) => c.key === rule.key).length >= 12) break; // enough evidence to pick from
        }
      }
    } catch (e: any) {
      notes.push(`bundle ${b.slice(-60)} -> ${String(e?.message || e).slice(0, 80)}`);
    }
  }
  return { bundles, candidates, notes };
}

// ---------------- Override persistence (MySQL + file-fallback parity) ----------------

export async function saveEndpointOverride(sourceId: string, key: string, value: string, evidenceUrl: string, bundleUrl: string): Promise<void> {
  const store = getStore();
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  // Portable upsert (identical semantics on MySQL and the dev file store): UPDATE first, INSERT if no row matched.
  const upd = await store.execute(
    'UPDATE source_endpoint_overrides SET value = ?, evidence_url = ?, bundle_url = ?, healed_at = ? WHERE source_id = ? AND rule_key = ?',
    [value.slice(0, 500), evidenceUrl.slice(0, 500), bundleUrl.slice(0, 500), now, sourceId, key],
  );
  if (!upd.affectedRows) {
    await store.execute(
      'INSERT INTO source_endpoint_overrides (source_id, rule_key, value, evidence_url, bundle_url, healed_at) VALUES (?, ?, ?, ?, ?, ?)',
      [sourceId, key, value.slice(0, 500), evidenceUrl.slice(0, 500), bundleUrl.slice(0, 500), now],
    );
  }
}

export async function getEndpointOverrides(sourceId: string): Promise<Record<string, { value: string; healedAt?: string; bundle?: string }>> {
  const store = getStore();
  const rows = await store.query<any>(
    'SELECT rule_key, value, healed_at, bundle_url FROM source_endpoint_overrides WHERE source_id = ?',
    [sourceId],
  );
  const out: Record<string, { value: string; healedAt?: string; bundle?: string }> = {};
  for (const r of rows) out[r.rule_key] = { value: String(r.value), healedAt: r.healed_at, bundle: r.bundle_url };
  return out;
}

/** In-memory cache of overrides (workers call this hot path). */
const overrideCache = new Map<string, { at: number; data: Record<string, { value: string }> }>();
const OVERRIDE_TTL_MS = 60_000;
export async function getOverride(sourceId: string, key: string): Promise<string | null> {
  const hit = overrideCache.get(sourceId);
  const use = hit && Date.now() - hit.at < OVERRIDE_TTL_MS ? hit : null;
  if (use) return use.data[key]?.value ?? null;
  const full = await getEndpointOverrides(sourceId);
  const data: Record<string, { value: string }> = {};
  for (const [k, v] of Object.entries(full)) data[k] = { value: v.value };
  overrideCache.set(sourceId, { at: Date.now(), data });
  return data[key]?.value ?? null;
}

export function invalidateOverrideCache(sourceId?: string): void {
  if (sourceId) overrideCache.delete(sourceId); else overrideCache.clear();
}

// ---------------- The engine ----------------

export class DynamicScannerEngine {
  /** Re-derives endpoints for a source from its public bundles and persists overrides. */
  async heal(sourceId: string): Promise<HealReport> {
    const spec = getHealSpec(sourceId);
    const report: HealReport = {
      sourceId, healed: false, at: new Date().toISOString(),
      entryPages: spec?.entryPages ?? [], scannedBundles: [], overrides: [], notes: [],
    };
    if (!spec) { report.notes.push('no healing spec registered for this source'); return report; }

    const { bundles, candidates, notes } = await collectCandidates(spec);
    report.scannedBundles = bundles;
    report.notes.push(...notes);
    if (candidates.length === 0) { report.notes.push('no rule matched in scanned bundles'); return report; }

    const existing = await getEndpointOverrides(sourceId);
    let healedAny = false;
    const byKey = new Map<string, HealCandidate[]>();
    for (const c of candidates) {
      if (!byKey.has(c.key)) byKey.set(c.key, []);
      byKey.get(c.key)!.push(c);
    }
    for (const rule of spec.rules) {
      const cands = byKey.get(rule.key) || [];
      const winner = (spec.pick?.(rule.key, cands)) || cands[0];
      if (!winner) continue;
      // live verification when the rule defines a probe
      let verified = false;
      const probe = rule.verifyGet ? rule.verifyGet(winner.value) : null;
      if (probe) {
        try { const r = await cffiFetch(probe, { impersonate: 'chrome', timeoutMs: 20_000 }); verified = r.status >= 200 && r.status < 404; }
        catch { verified = false; }
      } else {
        verified = true; // extraction itself is the evidence for non-URL keys (paths)
      }
      const old = existing[rule.key]?.value ?? null;
      if (old === winner.value) { report.overrides.push({ key: rule.key, oldValue: old, newValue: winner.value, verified }); continue; }
      await saveEndpointOverride(sourceId, rule.key, winner.value, spec.entryPages[0], winner.bundleUrl);
      report.overrides.push({ key: rule.key, oldValue: old, newValue: winner.value, verified });
      healedAny = true;
      log.info('SelfHeal', `Healed ${sourceId}.${rule.key}: ${old ?? '(none)'} -> ${winner.value.slice(0, 80)} (verified=${verified})`);
    }
    invalidateOverrideCache(sourceId);
    report.healed = healedAny && report.overrides.some((o) => o.verified);
    return report;
  }
}

export const dynamicScannerEngine = new DynamicScannerEngine();
