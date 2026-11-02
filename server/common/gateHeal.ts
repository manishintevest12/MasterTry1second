/**
 * Gate healing — self-repair for a partner edge that blocks our egress (owner rule 21 Oct:
 * "system must detect and fix source breakages/gating without owner intervention").
 *
 * Concrete trigger (owner 2 Nov: "indigo abhi v baki hai isko fix kro kaise v"): IndiGo's
 * mobile fare API sits behind Akamai, which answers HTTP 403 to datacenter IPs no matter the
 * TLS fingerprint. The rotator in cffiFetch can already route around that — but it can only
 * use legs that exist, and `data/proxy-pool.json` was empty, so every IndiGo call fell through
 * to the daily fare-calendar and no per-flight row ever appeared.
 *
 * This module closes that loop: when a source is seen gated, it sweeps public proxy lists,
 * probes each candidate against the SAME gated request, and stores only the winners in
 * `data/proxy-pool-gated.json` (read by proxyRotator with a wider latency ceiling). The next
 * IndiGo call then rotates through a hop that Akamai accepts.
 *
 * Rate limited per source so a fleet-wide gating event cannot turn into a proxy-sweep storm.
 */
import fs from 'node:fs';
import path from 'node:path';
import { log } from './logger';
import { runProxyDiscovery, GATED_POOL_FILE } from './proxyDiscovery';
import type { ProbeTarget } from './proxyDiscovery';

const STATE_FILE = path.join(process.cwd(), 'data', 'gate-heal.json');

/** How long a heal attempt is trusted before another one may run for the same source. */
const HEAL_COOLDOWN_MS = Number(process.env.T1S_GATE_HEAL_COOLDOWN_MS || 30 * 60_000);

/**
 * Owner rule (resource budget) + measured reality 2 Nov: IndiGo's edge needs a valid Akamai
 * cookie, not a nicer IP, so repeated sweeps keep finding nothing. A source that yields 0 hops
 * N times in a row therefore backs off instead of re-sweeping every 30 minutes.
 *   0-1 zero runs  -> normal cooldown
 *   2-3 zero runs  -> 6h
 *   4+  zero runs  -> 24h
 * Any sweep that finds a hop resets the streak.
 */
function cooldownFor(zeroStreak: number): number {
  if (zeroStreak >= 4) return 24 * 60 * 60_000;
  if (zeroStreak >= 2) return 6 * 60 * 60_000;
  return HEAL_COOLDOWN_MS;
}

export interface GateHealResult {
  source: string;
  ran: boolean;
  reason: string;
  tried: number;
  kept: number;
  storedAt?: string;
}

/** The exact gated request each source needs to pass before a proxy counts as healed. */
export const GATE_TARGETS: Record<string, ProbeTarget> = {
  indigo: {
    label: 'indigo-mobile-search',
    url: 'https://api-prod-mobile-skyplus6e.goindigo.in/flightsearch/v1/flight/search',
    method: 'POST',
    headers: {
      user_key: '43b557c03fc85cc213e91df0f526cc7a',
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    // A real IDR->DEL search a week out: cheap, deterministic, and answered by the same edge.
    body: JSON.stringify({
      criteria: [{
        dates: {
          beginDate: new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10).replace(/-/g, ''),
          endDate: new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10).replace(/-/g, ''),
        },
        flightFilters: { type: 'All' },
        stations: { originStationCodes: ['IDR'], destinationStationCodes: ['DEL'] },
      }],
      tripType: 'ONE_WAY',
      currencyCode: 'INR',
      paxInfo: { travelPurpose: '', adultCount: 1, childrenCount: 0, infantCount: 0, seniorCitizenCount: 0, extraSeat: 0 },
      specialFare: '',
      promoCode: '',
      bookingPurpose: '',
      marketType: '',
      doubleSeatSelected: false,
      tripleSeatSelected: false,
      selectedTripIndex: 0,
    }),
    // Any real answer carries flight data; a challenge/empty page does not.
    expectSubstring: 'flight',
    maxMs: 8000,
  },
};

/** Map a worker/source id or failure message to a healable key. */
export function gateKeyFor(sourceId: string, message = ''): string | null {
  const s = `${sourceId} ${message}`.toLowerCase();
  if (s.includes('indigo')) return 'indigo';
  return null;
}

type HealState = { at: number; kept: number; tried: number; zeroStreak?: number };

function readState(file = STATE_FILE): Record<string, HealState> {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) || {};
  } catch {
    return {};
  }
}

function writeState(state: Record<string, HealState>, file = STATE_FILE): void {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(state, null, 2));
  } catch (e: any) {
    log.warn('GateHeal', `state not written: ${String(e?.message || e).slice(0, 80)}`);
  }
}

/** Stored winners, so a caller (or the admin UI) can see whether a heal actually helped. */
export function gatedPoolSize(file = GATED_POOL_FILE): number {
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(raw?.proxies) ? raw.proxies.length : 0;
  } catch {
    return 0;
  }
}

/**
 * Sweep + validate against one gated source. `force` ignores the cooldown (admin button).
 */
export async function healGatedSource(
  key: string,
  opts: {
    force?: boolean; limit?: number; discover?: typeof runProxyDiscovery;
    now?: () => number; stateFile?: string; poolFile?: string;
  } = {},
): Promise<GateHealResult> {
  const target = GATE_TARGETS[key];
  if (!target) return { source: key, ran: false, reason: 'no heal target for this source', tried: 0, kept: 0 };

  const now = (opts.now || Date.now)();
  const stateFile = opts.stateFile || STATE_FILE;
  const poolFile = opts.poolFile || GATED_POOL_FILE;
  const state = readState(stateFile);
  const last = state[key];
  const cooldown = cooldownFor(Number(last?.zeroStreak || 0));
  if (!opts.force && last && now - last.at < cooldown) {
    const left = Math.round((cooldown - (now - last.at)) / 60_000);
    return {
      source: key, ran: false, tried: 0, kept: gatedPoolSize(opts.poolFile),
      reason: `cooling down (${left}m left, ${Number(last.zeroStreak || 0)} empty sweep(s) in a row)`,
    };
  }

  const discover = opts.discover || runProxyDiscovery;
  try {
    const report = await discover({ target, poolFile, limit: opts.limit ?? 60, concurrency: 8 });
    const zeroStreak = report.kept.length ? 0 : Number(last?.zeroStreak || 0) + 1;
    state[key] = { at: now, kept: report.kept.length, tried: report.probed ?? 0, zeroStreak };
    writeState(state, stateFile);
    const result: GateHealResult = {
      source: key,
      ran: true,
      reason: report.kept.length
        ? `${report.kept.length} proxy hop(s) pass ${target.label || key}`
        : 'no candidate passed the gated request',
      tried: report.probed ?? 0,
      kept: report.kept.length,
      storedAt: report.finishedAt ? String(report.finishedAt) : undefined,
    };
    log.info('GateHeal', `${key}: ${result.reason} (tried ${result.tried})`);
    return result;
  } catch (e: any) {
    const msg = String(e?.message || e).slice(0, 120);
    log.warn('GateHeal', `${key} sweep failed: ${msg}`);
    return { source: key, ran: true, reason: `sweep failed: ${msg}`, tried: 0, kept: gatedPoolSize() };
  }
}

/**
 * Fire-and-forget heal for the sources a run reported as gated. Never throws, never blocks the
 * search: the current answer stays honest, the NEXT call has a better chance.
 */
export function autoHealGatedSources(
  failures: Array<{ source?: string; message?: string }>,
  deps: { heal?: typeof healGatedSource } = {},
): Promise<GateHealResult[]> {
  const keys = new Set<string>();
  for (const f of failures || []) {
    const key = gateKeyFor(String(f?.source || ''), String(f?.message || ''));
    if (key) keys.add(key);
  }
  if (!keys.size) return Promise.resolve([]);
  const heal = deps.heal || healGatedSource;
  return Promise.all(Array.from(keys).map((k) => heal(k).catch(() => ({ source: k, ran: false, reason: 'failed', tried: 0, kept: 0 } as GateHealResult))));
}
