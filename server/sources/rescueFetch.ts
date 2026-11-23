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
 *   3. own         - our own browser render service (T1S_RENDER_URL) or Cloudflare Browser Rendering
 *                    (CF_ACCOUNT_ID + CF_BROWSER_TOKEN). Free at the margin, so it runs before the paid rung.
 *   4. scraperapi  - SCRAPER_API_KEY (verified working 10 Nov after the quoting residue was stripped).
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

export type RescueVia = 'direct' | 'relay' | 'own' | 'scraperapi' | 'reader';

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
  /** run the browser rung (ScraperAPI render=true) first: needed for client-rendered listings */
  render?: boolean;
  /** host used for scoreboard learning; defaults to the URL host */
  host?: string;
  /**
   * Content contract for THIS fetch. When provided and it returns false, the rung is treated as a failure
   * and the ladder moves on - that is what stops a 202/ScraperAPI shell from pretending to be a document.
   */
  validate?: (body: string, status: number) => boolean;
}

/** Rung order learned per host, defaulting to the canonical cheapest-first ladder. */
const CANONICAL: RescueVia[] = ['direct', 'relay', 'own', 'scraperapi', 'reader'];
const _order = new Map<string, RescueVia[]>();

function scraperKey(): string {
  return String(process.env.SCRAPER_API_KEY || '').trim();
}

function readerEnabled(): boolean {
  return String(process.env.T1S_READER_RESCUE || '1').trim() !== '0';
}

/**
 * OUR OWN RENDER RUNG (owner 23 Nov: "scrapper api charge krega hume apna scrapper api jaisa kaam chaiye").
 *
 * ScraperAPI is a paid per-call browser proxy. The job it does for us is narrow: run one page in a real browser
 * from a clean IP and hand back the HTML. That is a ~150-line service (tools/render-service) we can host on any
 * cheap VPS, or Cloudflare's Browser Rendering API on its free tier — so the paid rung becomes optional instead of
 * required. Both shapes are supported here behind one rung:
 *   T1S_RENDER_URL   + T1S_RENDER_TOKEN   -> our own service: POST {url, timeoutMs, waitUntil} -> {html} | text
 *   CF_ACCOUNT_ID    + CF_BROWSER_TOKEN   -> Cloudflare browser-rendering/content (free tier, no server to run)
 * The rung sits BEFORE scraperapi: our own capacity is free at the margin, so it should always be spent first.
 */
function ownRenderConfigured(): boolean {
  return Boolean(
    String(process.env.T1S_RENDER_URL || '').trim()
    || (String(process.env.CF_ACCOUNT_ID || '').trim() && String(process.env.CF_BROWSER_TOKEN || '').trim()),
  );
}

async function viaOwn(url: string, timeoutMs: number): Promise<{ status: number; body: string }> {
  const ownUrl = String(process.env.T1S_RENDER_URL || '').trim();
  const budget = Math.max(timeoutMs, 30_000);
  if (ownUrl) {
    const token = String(process.env.T1S_RENDER_TOKEN || '').trim();
    const res = await cffiFetch(`${ownUrl.replace(/\/+$/, '')}/render`, {
      method: 'POST',
      impersonate: 'chrome',
      timeoutMs: budget,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ url, timeoutMs: budget, waitUntil: 'networkidle2' }),
    });
    const body = String((res as any).body || '');
    const status = Number((res as any).status || 0);
    // Our service answers JSON {status, html}; a plain body is accepted too so a hand-rolled service works.
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed.html === 'string') return { status: Number(parsed.status) || 200, body: parsed.html };
      if (parsed && typeof parsed.content === 'string') return { status: Number(parsed.status) || 200, body: parsed.content };
    } catch { /* not JSON: use as-is */ }
    return { status, body };
  }
  const account = String(process.env.CF_ACCOUNT_ID || '').trim();
  const token = String(process.env.CF_BROWSER_TOKEN || '').trim();
  if (!account || !token) throw new Error('own render not configured');
  const res = await cffiFetch(`https://api.cloudflare.com/client/v4/accounts/${account}/browser-rendering/content`, {
    method: 'POST',
    impersonate: 'chrome',
    timeoutMs: budget,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ url, gotoOptions: { waitUntil: 'networkidle0', timeout: budget } }),
  });
  const raw = String((res as any).body || '');
  try {
    const parsed = JSON.parse(raw);
    const html = parsed?.result;
    if (typeof html === 'string') return { status: 200, body: html };
    if (parsed?.success === false) return { status: 500, body: raw.slice(0, 400) };
  } catch { /* fall through */ }
  return { status: Number((res as any).status || 0), body: raw };
}

export function ownRenderAvailable(): boolean { return ownRenderConfigured(); }

export function rescueRungs(): RescueVia[] {
  const out: RescueVia[] = ['direct'];
  if (relayConfigured()) out.push('relay');
  if (ownRenderConfigured()) out.push('own');
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

async function viaScraperApi(url: string, timeoutMs: number, render = false): Promise<{ status: number; body: string }> {
  const key = scraperKey();
  if (!key) throw new Error('SCRAPER_API_KEY missing');
  // render=true makes ScraperAPI run a real browser: the only rung that returns MakeMyTrip's dated hotel
  // listing (verified 10 Nov: 685KB, server-rendered cards with its own rupee prices and taxes).
  const target = `https://api.scraperapi.com/?api_key=${encodeURIComponent(key)}&country_code=in${render ? '&render=true' : ''}&url=${encodeURIComponent(url)}`;
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
  // A render-only source (a React listing) cannot be served by a plain HTTP rung, so the browser rung goes
  // first instead of being wasted at the end of the ladder.
  if (opts.render) {
    // A render-only source needs a browser: our own rung first (free at the margin), then the paid one.
    const first = order.includes('own') ? 'own' : order.includes('scraperapi') ? 'scraperapi' : null;
    if (first) order.sort((a, b) => (a === first ? -1 : b === first ? 1 : 0));
  }
  const attempts: RescueAttempt[] = [];
  let best: { status: number; body: string } = { status: 0, body: '' };

  for (const via of order) {
    const started = Date.now();
    try {
      const res = via === 'direct' ? await viaDirect(url, timeoutMs)
        : via === 'relay' ? await viaRelay(url, timeoutMs)
        : via === 'own' ? await viaOwn(url, timeoutMs)
        : via === 'scraperapi' ? await viaScraperApi(url, timeoutMs, opts.render)
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
