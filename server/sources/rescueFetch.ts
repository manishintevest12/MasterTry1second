/**
 * Source rescue ladder (owner 10 Nov: "muje unka system yaa architecture implement kro jo v partner site
 * result ni de rahe unke liye. kyunki muje result chaiye kaise v").
 *
 * The owner does not want a vendor (Apify/StayAPI) bolted on; he wants the PRINCIPLE those services run on
 * implemented inside our own stack, so ANY partner site that refuses to answer still ends up in the answer.
 *
 * That principle, made concrete: one request is attempted through a ladder of transports, cheapest and most
 * independent first, and the rung that worked is remembered per host so the next call starts there.
 *
 *   1. direct      - our own cffiFetch (chrome impersonation). Free, fastest, already the default.
 *   2. relay       - our own edge relay workers (aws / cloudflare egress), for hosts that block our server IP.
 *   3. scraperapi  - SCRAPER_API_KEY (verified working 10 Nov after the quoting residue was stripped).
 *   4. reader      - r.jina.ai rendering reader, for client-rendered shells that carry no HTML server-side.
 *
 * Everything is fail-closed and side-effect free: a rung that is not configured is skipped, a rung that
 * returns a challenge/empty page is treated as failure, and when every rung fails the caller gets the
 * original response plus a per-rung report so sourcesFailed says WHY. Prices are never invented here - this
 * module only moves bytes.
 */
import { cffiFetch } from '../common/curlCffiFetch';
import { edgeRelayFetch, isGatedResponse, relayConfigured } from './edgeRelay';
import { getStore } from '../common/db';
import { log } from '../common/logger';

export type RescueVia = 'direct' | 'relay' | 'scraperapi' | 'reader';

export interface RescueAttempt {
  via: RescueVia;
  ok: boolean;
  status: number;
  bytes: number;
  reason?: string;
  ms: number;
}

export interface RescueResult {
  status: number;
  body: string;
  via: RescueVia | 'none';
  attempts: RescueAttempt[];
  /** true when every rung failed and the body is the best (usually blocked) response we got */
  exhausted: boolean;
}

export interface RescueOpts {
  /** minimum HTML bytes that count as a real document rather than a shell/blocks page */
  minHtmlBytes?: number;
  timeoutMs?: number;
  /** try at most this many rungs (1 = direct only) */
  maxRungs?: number;
  /** host used for scoreboard learning; defaults to the URL host */
  host?: string;
  /**
   * Content contract for THIS fetch. When provided and it returns false, the rung is treated as a failure
   * and the ladder moves on - that is what stops a 202/ScraperAPI shell from pretending to be a document.
   */
  validate?: (body: string, status: number) => boolean;
}

/** Rung order learned per host, defaulting to the canonical cheapest-first ladder. */
const CANONICAL: RescueVia[] = ['direct', 'relay', 'scraperapi', 'reader'];
const _order = new Map<string, RescueVia[]>();

function scraperKey(): string {
  return String(process.env.SCRAPER_API_KEY || '').trim();
}

function readerEnabled(): boolean {
  return String(process.env.T1S_READER_RESCUE || '1').trim() !== '0';
}

export function rescueRungs(): RescueVia[] {
  const out: RescueVia[] = ['direct'];
  if (relayConfigured()) out.push('relay');
  if (scraperKey()) out.push('scraperapi');
  if (readerEnabled()) out.push('reader');
  return out;
}

export function rescueOrderFor(host: string): RescueVia[] {
  const enabled = rescueRungs();
  const learned = _order.get(host) || [];
  const merged = [...learned.filter((v) => enabled.includes(v)), ...enabled.filter((v) => !learned.includes(v))];
  return merged.length ? merged : ['direct'];
}

/** Persist which rung worked so the next call for that host starts there (best-effort, never throws). */
let schemaReady = false;
async function ensureScoreboard(): Promise<void> {
  if (schemaReady) return;
  schemaReady = true;
  try {
    await getStore().execute(`
      CREATE TABLE IF NOT EXISTS rescue_scoreboard (
        host VARCHAR(190) NOT NULL,
        via VARCHAR(20) NOT NULL,
        wins INT NOT NULL DEFAULT 0,
        failures INT NOT NULL DEFAULT 0,
        last_ok_at DATETIME NULL,
        PRIMARY KEY (host, via)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  } catch { schemaReady = false; }
}

async function learn(host: string, via: RescueVia): Promise<void> {
  await ensureScoreboard();
  const current = rescueOrderFor(host);
  const next = [via, ...current.filter((v) => v !== via)];
  _order.set(host, next);
  try {
    await getStore().execute(
      `INSERT INTO rescue_scoreboard (host, via, wins, failures, last_ok_at)
       VALUES (?, ?, 1, 0, NOW())
       ON DUPLICATE KEY UPDATE wins = wins + 1, last_ok_at = NOW()`,
      [host, via],
    );
  } catch { /* scoreboard is an optimisation, not a dependency */ }
}

async function penalise(host: string, via: RescueVia): Promise<void> {
  await ensureScoreboard();
  try {
    await getStore().execute(
      `INSERT INTO rescue_scoreboard (host, via, wins, failures, last_ok_at)
       VALUES (?, ?, 0, 1, NULL)
       ON DUPLICATE KEY UPDATE failures = failures + 1`,
      [host, via],
    );
  } catch { /* ignore */ }
}

function hostOf(url: string): string {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; }
}

async function viaDirect(url: string, timeoutMs: number): Promise<{ status: number; body: string }> {
  const res = await cffiFetch(url, { impersonate: 'chrome', timeoutMs });
  return { status: Number((res as any).status || 0), body: String((res as any).body || '') };
}

async function viaRelay(url: string, timeoutMs: number): Promise<{ status: number; body: string }> {
  const r = await edgeRelayFetch(url, { timeoutMs } as any);
  if (!r) throw new Error('relay unavailable');
  return { status: Number((r as any).status || 0), body: String((r as any).body || '') };
}

async function viaScraperApi(url: string, timeoutMs: number): Promise<{ status: number; body: string }> {
  const key = scraperKey();
  if (!key) throw new Error('SCRAPER_API_KEY missing');
  const target = `https://api.scraperapi.com/?api_key=${encodeURIComponent(key)}&country_code=in&url=${encodeURIComponent(url)}`;
  const res = await cffiFetch(target, { impersonate: 'chrome', timeoutMs: Math.max(timeoutMs, 45_000) });
  return { status: Number((res as any).status || 0), body: String((res as any).body || '') };
}

async function viaReader(url: string, timeoutMs: number): Promise<{ status: number; body: string }> {
  const res = await cffiFetch(`https://r.jina.ai/${url}`, {
    impersonate: 'chrome',
    timeoutMs: Math.max(timeoutMs, 30_000),
  });
  return { status: Number((res as any).status || 0), body: String((res as any).body || '') };
}

function looksUsable(status: number, body: string, minHtmlBytes: number, validate?: (b: string, s: number) => boolean): { ok: boolean; reason?: string } {
  if (!status || status >= 400) return { ok: false, reason: `HTTP ${status}` };
  // Booking.com (and others) answer 202 with a client-rendered shell: the request was "accepted", no
  // document was served. Never treat that as a usable body.
  if (status === 202) return { ok: false, reason: 'HTTP 202 bot wall' };
  if (!body.trim()) return { ok: false, reason: 'empty body' };
  if (isGatedResponse(status, body, { minHtmlBytes })) return { ok: false, reason: 'gated/blocks page' };
  if (body.length < minHtmlBytes) return { ok: false, reason: `short body (${body.length}b)` };
  if (validate && !validate(body, status)) return { ok: false, reason: 'validator rejected body' };
  return { ok: true };
}

/**
 * Run the ladder. Never throws for ordinary network failures - the caller decides what an exhausted result
 * means for its source (probe sources throw ACCESS_CHALLENGE, parsers simply get no rows).
 */
export async function rescueFetch(url: string, opts: RescueOpts = {}): Promise<RescueResult> {
  const host = opts.host || hostOf(url);
  const minHtmlBytes = opts.minHtmlBytes ?? 2000;
  const timeoutMs = opts.timeoutMs ?? 25_000;
  const maxRungs = Math.max(1, opts.maxRungs ?? 4);
  const order = rescueOrderFor(host).slice(0, maxRungs);
  const attempts: RescueAttempt[] = [];
  let best: { status: number; body: string } = { status: 0, body: '' };

  for (const via of order) {
    const started = Date.now();
    try {
      const res = via === 'direct' ? await viaDirect(url, timeoutMs)
        : via === 'relay' ? await viaRelay(url, timeoutMs)
        : via === 'scraperapi' ? await viaScraperApi(url, timeoutMs)
        : await viaReader(url, timeoutMs);
      const verdict = looksUsable(res.status, res.body, minHtmlBytes, opts.validate);
      if (res.body.length > best.body.length) best = res;
      attempts.push({ via, ok: verdict.ok, status: res.status, bytes: res.body.length, reason: verdict.reason, ms: Date.now() - started });
      if (verdict.ok) {
        if (via !== 'direct') await learn(host, via);
        log.info('Rescue', `${host} answered via ${via}`, { bytes: res.body.length, ms: Date.now() - started });
        return { status: res.status, body: res.body, via, attempts, exhausted: false };
      }
      if (via !== 'direct') await penalise(host, via);
    } catch (e: any) {
      attempts.push({ via, ok: false, status: 0, bytes: 0, reason: String(e?.message || e).slice(0, 120), ms: Date.now() - started });
      if (via !== 'direct') await penalise(host, via);
    }
  }

  return { status: best.status, body: best.body, via: 'none', attempts, exhausted: true };
}

/** One-line diagnosis for sourcesFailed / admin views. */
export function describeRescue(r: RescueResult): string {
  const tried = r.attempts.map((a) => `${a.via}:${a.ok ? 'ok' : a.reason || 'fail'}`).join('; ');
  return r.exhausted ? `all transports failed (${tried})` : `via ${r.via} (${tried})`;
}

/** Read the learned scoreboard (admin dashboard / diagnostics). */
export function learnedRescueOrder(host: string): RescueVia[] {
  return rescueOrderFor(host.toLowerCase().replace(/^www\./, ''));
}

export const CANONICAL_LADDER = CANONICAL;
