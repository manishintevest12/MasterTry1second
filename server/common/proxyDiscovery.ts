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
import { log } from './logger';

export interface ProxyCandidate {
  url: string;
  source: string;
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
  kept: ProxyProbeResult[];
  dropped: number;
  storedIn: string;
  durationMs: number;
}

const POOL_FILE = path.join(process.cwd(), 'data', 'proxy-pool.json');

/** Public, no-key lists. Each entry is parsed for ip:port pairs. */
const SOURCES: Array<{ name: string; url: string }> = [
  { name: 'proxyscrape-http', url: 'https://api.proxyscrape.com/v4/free-proxy-list/get?request=display_proxies&protocol=http&proxy_format=protocolipport&format=text' },
  { name: 'proxyscrape-https', url: 'https://api.proxyscrape.com/v4/free-proxy-list/get?request=display_proxies&protocol=https&proxy_format=protocolipport&format=text' },
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
  try {
    const r = await fetch(source.url, {
      headers: { 'User-Agent': 'Try1Second/1.9 proxy-discovery' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) {
      log.warn('ProxyDiscovery', `${source.name} HTTP ${r.status}`);
      return [];
    }
    const text = await r.text();
    const out: ProxyCandidate[] = [];
    // Accepts "ip:port", "http://ip:port" and JSON-ish payloads alike.
    for (const m of text.matchAll(/(?:(?:https?|socks[45]):\/\/)?(\d{1,3}(?:\.\d{1,3}){3}:\d{2,5})/g)) {
      const url = normalizeProxy(m[0]);
      if (url) out.push({ url, source: source.name });
    }
    return out;
  } catch (e: any) {
    log.warn('ProxyDiscovery', `${source.name} unreachable: ${String(e?.message || e).slice(0, 80)}`);
    return [];
  }
}

/** Measures one candidate. Success = HTTP 200 inside the budget, no gate markers. */
export async function probeProxy(candidate: ProxyCandidate): Promise<ProxyProbeResult> {
  const budget = proxyLatencyBudget();
  const startedAt = Date.now();
  let res: any = null;
  let err: any = null;
  try {
    // cffiFetch (not the inner direct call) so a candidate that dies mid-handshake
    // cannot take the probe down with it; proxy passed per call, no pool recursion.
    res = await cffiFetch(PROBE_TARGET, {
      proxy: candidate.url,
      timeoutMs: Math.max(budget * 2, 1500),
      impersonate: 'chrome',
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
  if (ms > budget) return { url: candidate.url, ok: false, ms, status, reason: `slow ${ms}ms > ${budget}ms` };
  return { url: candidate.url, ok: true, ms, status, reason: 'ok' };
}

/**
 * Discovers, probes and persists. `limit` caps how many candidates are probed so an
 * admin click can never turn into hundreds of outbound connections.
 */
export async function runProxyDiscovery(opts: { limit?: number; concurrency?: number } = {}): Promise<DiscoveryReport> {
  const startedAt = new Date();
  const budget = proxyLatencyBudget();
  const limit = Math.min(Math.max(opts.limit ?? 60, 1), 200);
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
      const r = await probeProxy(c);
      if (r.ok) kept.push(r); else dropped++;
    }
  });
  await Promise.all(workers);

  kept.sort((a, b) => a.ms - b.ms);
  const payload = {
    updatedAt: new Date().toISOString(),
    budgetMs: budget,
    probeTarget: PROBE_TARGET,
    proxies: kept.map((k) => ({ url: k.url, ms: k.ms })),
  };
  try {
    fs.mkdirSync(path.dirname(POOL_FILE), { recursive: true });
    fs.writeFileSync(POOL_FILE, JSON.stringify(payload, null, 2));
  } catch (e: any) {
    log.warn('ProxyDiscovery', `could not store pool: ${String(e?.message || e).slice(0, 80)}`);
  }

  const report: DiscoveryReport = {
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    budgetMs: budget,
    found: candidates.length,
    probed: candidates.length,
    passed: kept.length,
    kept: kept.slice(0, 40),
    dropped,
    storedIn: POOL_FILE,
    durationMs: Date.now() - startedAt.getTime(),
  };
  log.info('ProxyDiscovery', `probed ${report.probed}, passed ${report.passed} under ${budget}ms`);
  return report;
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
