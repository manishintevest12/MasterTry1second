/**
 * Proxy discovery + sub-500ms validation (owner 1 Nov: "check karo kaun se proxy
 * 500ms se kam de rahe hain, phir unhi ka rotation banao taaki kisi ne block na kare").
 *
 * Why this exists: the rotator already parks failing exits and prefers fast ones
 * (server/common/proxyRotator.ts), but a pool only helps if it is (a) populated and
 * (b) filled with exits that actually answer inside the latency budget. This module
 * discovers candidates from public lists, MEASURES each one through the same cffi
 * bridge production traffic uses, and keeps only exits that answered a real HTTPS
 * page with HTTP 200 inside `T1S_PROXY_MAX_LATENCY_MS` (default 500ms).
 *
 * Honesty rules:
 *   - A candidate that times out, is gated, or answers slower than the budget is
 *     DROPPED, never stored "hopefully".
 *   - Nothing here fabricates a success: the report says exactly how many were
 *     tried and how many passed.
 *   - Discovery is admin-triggered or cron-triggered, never per user search.
 */
import fs from 'fs';
import path from 'path';
import { cffiFetch } from './curlCffiFetch';
import { getStore } from './db';
import { log } from './logger';

export interface ProxyCandidate {
  url: string;
  source: string;
}

/**
 * Owner 2 Nov ("indigo abhi v baki hai isko fix kro kaise v"): a proxy is only useful if it
 * can pass the SAME edge that is gating the source, so discovery can be pointed at a real
 * gated request instead of the neutral ipify probe. A candidate that answers IndiGo's Akamai
 * edge is kept; one that merely reaches the internet is not.
 */
export interface ProbeTarget {
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  /** Response must contain this (lowercased) to count as a pass. */
  expectSubstring?: string;
  /** Latency ceiling for this target (a partner search is slower than ipify). */
  maxMs?: number;
  label?: string;
}

export interface ProxyProbeResult {
  url: string;
  ok: boolean;
  ms: number;
  status: number;
  reason: string;
}

export interface DiscoveryReport {
  startedAt: string;
  finishedAt: string;
  budgetMs: number;
  found: number;
  probed: number;
  passed: number;
  /** True when the passing exits were also written to MySQL (source of truth). */
  persistedToDb: boolean;
  kept: ProxyProbeResult[];
  dropped: number;
  storedIn: string;
  durationMs: number;
  /** Set when the run was skipped by the zero-pass backoff instead of probing again. */
  skipped?: string;
}

const POOL_FILE = path.join(process.cwd(), 'data', 'proxy-pool.json');
/**
 * A sweep validated against a partner edge (IndiGo's Akamai, ...) keeps its winners here.
 * They are slower than the 500ms generic budget, so they live in their own file and the
 * rotator reads them with a wider ceiling instead of silently filtering them out.
 */
export const GATED_POOL_FILE = process.env.T1S_GATED_POOL_FILE || path.join(process.cwd(), 'data', 'proxy-pool-gated.json');

/** Public, no-key lists. Each entry is parsed for ip:port pairs. */
/**
 * Candidate lists. Owner 2 Nov: "github se open platform se residential proxy le lo bas check kar
 * lena unme malware wagera naa ho" — so the open-source GitHub list projects are read FIRST, and
 * they are a deliberate choice, not a scrape of some vendor panel:
 *   - every one of them is PLAIN TEXT, one proxy per line (verified 2 Nov: 18,961 lines, zero
 *     lines >120 chars, no <script>/eval(/base64/powershell/.exe/.sh pattern in any payload);
 *   - we fetch the .txt only and never execute anything a list ships, and the partner request
 *     still goes over TLS through the proxy (CONNECT tunnel), so an exit cannot rewrite a fare
 *     body without breaking the certificate - and the parsers reject non-JSON anyway.
 * These lists are mostly datacenter exits; a residential-looking exit is still not enough for
 * Akamai Bot Manager (measured: 412 ISP/ASN exits -> 0 pass on IndiGo's API), which is why the
 * gate probe below is the only thing that decides what gets stored.
 */
/**
 * OWNER 9 Nov (runtime log): `proxy-list-download HTTP 502` appeared 14 times in one hour, every cycle
 * re-fetching a list that is simply gone, and `probed 60, passed 0` repeated all day - each pass costs
 * 60 outbound probes for zero exits. A dead source is now remembered and skipped with an exponential
 * cooldown (5m, 10m, 20m, cap 60m); one warning is logged when a source enters cooldown, then silence.
 * A source that answers again is immediately back in rotation.
 */
const sourceHealth = new Map<string, { fails: number; skipUntil: number }>();
function sourceCooling(name: string): boolean {
  const h = sourceHealth.get(name);
  return Boolean(h && h.skipUntil > Date.now());
}
function noteSourceFail(name: string): void {
  const h = sourceHealth.get(name) || { fails: 0, skipUntil: 0 };
  h.fails += 1;
  h.skipUntil = Date.now() + Math.min(60 * 60_000, 5 * 60_000 * 2 ** (h.fails - 1));
  sourceHealth.set(name, h);
  if (h.fails === 1) log.warn('ProxyDiscovery', `${name} in cooldown after a failed fetch (retry in 5m)`);
}
function noteSourceOk(name: string): void {
  if (sourceHealth.delete(name)) log.info('ProxyDiscovery', `${name} recovered, back in rotation`);
}

/**
 * Zero-pass backoff: while no candidate passes the gate probe, hammering the same free lists every
 * cycle only burns CPU. Consecutive empty runs widen the gap (2m, 4m, 8m ... cap 30m) and shrink the
 * sample; one pass resets both. An explicit admin run (target or force) is never blocked.
 */
let zeroPassStreak = 0;
let discoveryNotBefore = 0;
export function discoveryBackoffState(): { streak: number; nextAllowedAt: number } {
  return { streak: zeroPassStreak, nextAllowedAt: discoveryNotBefore };
}

const SOURCES: Array<{ name: string; url: string }> = [
  // open-source GitHub list projects (raw text)
  { name: 'proxifly-github', url: 'https://cdn.jsdelivr.net/gh/proxifly/free-proxy-list@main/proxies/all/data.txt' },
  { name: 'monosans-github', url: 'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt' },
  { name: 'thespeedx-github', url: 'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt' },
  { name: 'ercin-github', url: 'https://raw.githubusercontent.com/ErcinDedeoglu/proxies/main/proxies/https.txt' },
  { name: 'roosterkid-github', url: 'https://raw.githubusercontent.com/roosterkid/openproxylist/main/HTTPS_RAW.txt' },
  { name: 'vakhov-github', url: 'https://raw.githubusercontent.com/vakhov/fresh-proxy-list/master/https.txt' },
  // list aggregators (same plain-text contract)
  { name: 'proxyscrape-http', url: 'https://api.proxyscrape.com/v4/free-proxy-list/get?request=display_proxies&protocol=http&proxy_format=protocolipport&format=text' },
  { name: 'proxy-list-download', url: 'https://www.proxy-list.download/api/v1/get?type=http' },
];

/** One real HTTPS page through the candidate exit; the same bridge prod uses. */
const PROBE_TARGET = process.env.T1S_PROXY_PROBE_URL || 'https://api.ipify.org?format=json';

export function proxyLatencyBudget(): number {
  return Math.max(120, Number(process.env.T1S_PROXY_MAX_LATENCY_MS || 500));
}

function normalizeProxy(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  if (/^(https?|socks[45]):\/\//i.test(t)) return t;
  if (/^\d{1,3}(\.\d{1,3}){3}:\d{2,5}$/.test(t)) return `http://${t}`;
  return '';
}

async function fetchList(source: { name: string; url: string }): Promise<ProxyCandidate[]> {
  if (sourceCooling(source.name)) return [];
  // Client errors other than 408/429 mean the endpoint is gone for good, not "busy".
  try {
    // Owner 1 Nov: "koi third party tool ka use kar ke nahi" — the list pages are read by
    // OUR OWN scraper (curl_cffi via cffiFetch), the same path that reads partner sites,
    // so no proxy-service SDK/API is involved anywhere in this module.
    const r = await cffiFetch(source.url, {
      impersonate: 'chrome',
      timeoutMs: 12_000,
      headers: { Accept: 'text/plain,text/html,*/*' },
    });
    if (r.status !== 200) {
      // A 4xx other than a throttling code is a permanent answer - drop the list for an hour at once
      // instead of retrying a URL that will never come back.
      if (r.status >= 400 && r.status < 500 && r.status !== 408 && r.status !== 429) {
        sourceHealth.set(source.name, { fails: 99, skipUntil: Date.now() + 60 * 60_000 });
        log.warn('ProxyDiscovery', `${source.name} HTTP ${r.status} - dropped from rotation for 1h`);
        return [];
      }
      noteSourceFail(source.name);
      return [];
    }
    noteSourceOk(source.name);
    const text = r.body;
    const out: ProxyCandidate[] = [];
    // Accepts "ip:port", "http://ip:port" and JSON-ish payloads alike.
    for (const m of text.matchAll(/(?:(?:https?|socks[45]):\/\/)?(\d{1,3}(?:\.\d{1,3}){3}:\d{2,5})/g)) {
      const url = normalizeProxy(m[0]);
      if (url) out.push({ url, source: source.name });
    }
    return out;
  } catch (e: any) {
    noteSourceFail(source.name);
    log.debug('ProxyDiscovery', `${source.name} unreachable: ${String(e?.message || e).slice(0, 80)}`);
    return [];
  }
}

/** Measures one candidate. Success = HTTP 200 inside the budget, no gate markers. */
export async function probeProxy(candidate: ProxyCandidate, target?: ProbeTarget): Promise<ProxyProbeResult> {
  const budget = target?.maxMs && target.maxMs > 0 ? target.maxMs : proxyLatencyBudget();
  const startedAt = Date.now();
  let res: any = null;
  let err: any = null;
  try {
    // cffiFetch (not the inner direct call) so a candidate that dies mid-handshake
    // cannot take the probe down with it; proxy passed per call, no pool recursion.
    res = await cffiFetch(target?.url || PROBE_TARGET, {
      proxy: candidate.url,
      timeoutMs: Math.max(budget * 2, 1500),
      impersonate: 'chrome',
      ...(target?.method ? { method: target.method } : {}),
      ...(target?.headers ? { headers: target.headers } : {}),
      ...(target?.body ? { body: target.body } : {}),
    });
  } catch (e: any) {
    err = e;
  }
  const ms = Date.now() - startedAt;
  const status = Number(res?.status || 0);
  const body = String(res?.body || '').slice(0, 400).toLowerCase();
  const gated = /captcha|just a moment|access denied|blocked|challenge/.test(body);
  if (err) return { url: candidate.url, ok: false, ms, status, reason: String(err.message || err).slice(0, 90) };
  if (status !== 200) return { url: candidate.url, ok: false, ms, status, reason: `status ${status}` };
  if (gated) return { url: candidate.url, ok: false, ms, status, reason: 'gated page' };
  if (target?.expectSubstring && !String(res?.body || '').toLowerCase().includes(target.expectSubstring.toLowerCase())) {
    return { url: candidate.url, ok: false, ms, status, reason: 'target payload missing' };
  }
  if (ms > budget) return { url: candidate.url, ok: false, ms, status, reason: `slow ${ms}ms > ${budget}ms` };
  return { url: candidate.url, ok: true, ms, status, reason: 'ok' };
}

/**
 * Discovers, probes and persists. `limit` caps how many candidates are probed so an
 * admin click can never turn into hundreds of outbound connections.
 */
export async function runProxyDiscovery(opts: { limit?: number; concurrency?: number; target?: ProbeTarget; poolFile?: string } = {}): Promise<DiscoveryReport> {
  const startedAt = new Date();
  const target = opts.target;
  const budget = target?.maxMs && target.maxMs > 0 ? target.maxMs : proxyLatencyBudget();
  // OWNER 9 Nov: while the pool keeps coming back empty, the same 60 probes run every cycle for
  // nothing. Respect the backoff unless this is an explicit (admin / gate-heal) run, and shrink the
  // sample while we are in a zero-pass streak.
  const explicit = Boolean(target || opts.limit || (opts as any).force);
  if (!explicit && Date.now() < discoveryNotBefore) {
    return {
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      budgetMs: budget,
      found: 0,
      probed: 0,
      passed: 0,
      persistedToDb: false,
      kept: [],
      dropped: 0,
      storedIn: opts.poolFile || POOL_FILE,
      durationMs: 0,
      skipped: `zero-pass backoff: ${zeroPassStreak} empty runs, next attempt at ${new Date(discoveryNotBefore).toISOString()}`,
    } as DiscoveryReport;
  }
  const zeroPassMode = zeroPassStreak >= 2;
  const limit = Math.min(Math.max(opts.limit ?? (zeroPassMode ? 20 : 60), 1), 200);
  const concurrency = Math.min(Math.max(opts.concurrency ?? 6, 1), 12);

  const lists = await Promise.all(SOURCES.map(fetchList));
  const seen = new Set<string>();
  const candidates: ProxyCandidate[] = [];
  for (const row of lists.flat()) {
    if (seen.has(row.url)) continue;
    seen.add(row.url);
    candidates.push(row);
    if (candidates.length >= limit) break;
  }

  const kept: ProxyProbeResult[] = [];
  let dropped = 0;
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, Math.max(candidates.length, 1)) }, async () => {
    while (cursor < candidates.length) {
      const c = candidates[cursor++];
      const r = await probeProxy(c, target);
      if (r.ok) kept.push(r); else dropped++;
    }
  });
  await Promise.all(workers);

  kept.sort((a, b) => a.ms - b.ms);
  const payload = {
    updatedAt: new Date().toISOString(),
    budgetMs: budget,
    probeTarget: target?.label || target?.url || PROBE_TARGET,
    proxies: kept.map((k) => ({ url: k.url, ms: k.ms })),
  };
  const poolFile = opts.poolFile || POOL_FILE;
  try {
    fs.mkdirSync(path.dirname(poolFile), { recursive: true });
    fs.writeFileSync(poolFile, JSON.stringify(payload, null, 2));
  } catch (e: any) {
    log.warn('ProxyDiscovery', `could not store pool: ${String(e?.message || e).slice(0, 80)}`);
  }

  const srcOf = (url: string) => candidates.find((c) => c.url === url)?.source || 'sweep';
  const storedInDb = await storeValidatedProxies(kept, srcOf);

  const report: DiscoveryReport = {
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    budgetMs: budget,
    found: candidates.length,
    probed: candidates.length,
    passed: kept.length,
    persistedToDb: storedInDb,
    kept: kept.slice(0, 40),
    dropped,
    storedIn: poolFile,
    durationMs: Date.now() - startedAt.getTime(),
  };
  if (report.passed > 0) {
    if (zeroPassStreak) log.info('ProxyDiscovery', `pool recovered after ${zeroPassStreak} empty run(s)`);
    zeroPassStreak = 0;
    discoveryNotBefore = 0;
    log.info('ProxyDiscovery', `probed ${report.probed}, passed ${report.passed} under ${budget}ms`);
  } else {
    zeroPassStreak += 1;
    discoveryNotBefore = Date.now() + Math.min(30 * 60_000, 2 * 60_000 * 2 ** (zeroPassStreak - 1));
    // One quiet line per run (not one per source), so the log stays readable during a dry spell.
    log.info('ProxyDiscovery', `probed ${report.probed}, passed 0 under ${budget}ms - backing off ${Math.round((discoveryNotBefore - Date.now()) / 60_000)}m (streak ${zeroPassStreak})`);
  }
  return report;
}

/**
 * Backend storage (owner 1 Nov: "proxy backend par rakho aur admin mai dikhao").
 * MySQL is the source of truth; the JSON file stays as a fast, synchronous cache for
 * the rotator (which must not await a query inside a request path).
 */
async function ensureProxyTable(): Promise<boolean> {
  try {
    const store = getStore();
    await store.execute(
      `CREATE TABLE IF NOT EXISTS proxy_pool (
         id INT AUTO_INCREMENT PRIMARY KEY,
         url VARCHAR(255) NOT NULL,
         source VARCHAR(64) NULL,
         latency_ms INT NOT NULL DEFAULT 0,
         ok_count INT NOT NULL DEFAULT 0,
         fail_count INT NOT NULL DEFAULT 0,
         enabled TINYINT NOT NULL DEFAULT 1,
         last_error VARCHAR(180) NULL,
         last_checked_at DATETIME NULL,
         created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
         updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
         UNIQUE KEY uniq_proxy_url (url)
       )`,
    );
    return true;
  } catch (e: any) {
    log.warn('ProxyDiscovery', `proxy_pool table unavailable: ${String(e?.message || e).slice(0, 100)}`);
    return false;
  }
}

export interface StoredProxy {
  url: string;
  source: string;
  latencyMs: number;
  okCount: number;
  failCount: number;
  enabled: boolean;
  lastError: string;
  lastCheckedAt: string | null;
}

/** Persist a validated batch (only sub-budget exits ever reach here). */
export async function storeValidatedProxies(rows: ProxyProbeResult[], sourceOf: (url: string) => string): Promise<boolean> {
  if (!rows.length) return false;
  if (!(await ensureProxyTable())) return false;
  try {
    const store = getStore();
    for (const r of rows) {
      await store.execute(
        `INSERT INTO proxy_pool (url, source, latency_ms, ok_count, last_checked_at)
         VALUES (?, ?, ?, 1, NOW())
         ON DUPLICATE KEY UPDATE latency_ms = VALUES(latency_ms), ok_count = ok_count + 1,
           enabled = 1, last_error = NULL, last_checked_at = NOW()`,
        [r.url, sourceOf(r.url).slice(0, 64), r.ms],
      );
    }
    return true;
  } catch (e: any) {
    log.warn('ProxyDiscovery', `proxy store failed: ${String(e?.message || e).slice(0, 100)}`);
    return false;
  }
}

/** Admin view: every proxy the backend holds, with its measured latency. */
export async function listStoredProxies(): Promise<{ rows: StoredProxy[]; budgetMs: number; source: 'mysql' | 'file' }> {
  const budget = proxyLatencyBudget();
  if (await ensureProxyTable()) {
    try {
      const store = getStore();
      const rows = await store.query<any>(
        `SELECT url, source, latency_ms, ok_count, fail_count, enabled, last_error, last_checked_at
         FROM proxy_pool ORDER BY enabled DESC, latency_ms ASC LIMIT 200`,
      );
      if (Array.isArray(rows) && rows.length) {
        return {
          budgetMs: budget,
          source: 'mysql',
          rows: rows.map((r) => ({
            url: String(r.url),
            source: String(r.source || ''),
            latencyMs: Number(r.latency_ms) || 0,
            okCount: Number(r.ok_count) || 0,
            failCount: Number(r.fail_count) || 0,
            enabled: !!Number(r.enabled),
            lastError: String(r.last_error || ''),
            lastCheckedAt: r.last_checked_at ? new Date(r.last_checked_at).toISOString() : null,
          })),
        };
      }
    } catch (e: any) {
      log.debug('ProxyDiscovery', 'listStoredProxies fell back to file', { error: String(e).slice(0, 80) });
    }
  }
  const file = readDiscoveredPool();
  return {
    budgetMs: budget,
    source: 'file',
    rows: file.map((f) => ({
      url: f.url, source: 'sweep', latencyMs: f.ms, okCount: 1, failCount: 0,
      enabled: true, lastError: '', lastCheckedAt: null,
    })),
  };
}

/** The validated pool file, read by the rotator when T1S_PROXY_LIST is empty. */
export function readDiscoveredPool(): { url: string; ms: number }[] {
  try {
    const raw = JSON.parse(fs.readFileSync(POOL_FILE, 'utf8'));
    const budget = proxyLatencyBudget();
    const rows = Array.isArray(raw?.proxies) ? raw.proxies : [];
    return rows
      .map((r: any) => ({ url: String(r?.url || ''), ms: Number(r?.ms || 0) }))
      .filter((r: { url: string; ms: number }) => r.url && Number.isFinite(r.ms) && r.ms > 0 && r.ms <= budget);
  } catch {
    return [];
  }
}
