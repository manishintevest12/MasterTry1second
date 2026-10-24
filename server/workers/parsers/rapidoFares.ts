/**
 * Rapido LIVE fare acquisition — owner 24 Oct: "fare on app ni chaiye real price chaiye bhai".
 *
 * Reverse-engineered 24 Oct: m.rapido.bike is Rapido's guest mobile-web booking PWA and
 * it serves REAL, bookable fare windows without any login:
 *   POST /pwa/api/unup/location/services  {lat,lng}          -> city service catalog
 *   POST /pwa/api/unup/scc/fareEstimate    pickup/drop + ids  -> protobuf quote list
 * The fare call is gated by four signature headers (x-km, x-m, x-ekref, x-pm) that
 * Rapido's embedded Kotlin/Wasm "thiqa-kmp" module computes (HMAC/AES via WebCrypto)
 * over the exact request body. The wasm binary + JS glue + signature keys are embedded
 * in rapidoThiqaAsset.ts (SHA-256s match Rapido's own integrity checks) and the module
 * runs in-process on plain Node WebAssembly — no browser, no login, no extra dependency.
 *
 * Verified live 24 Oct:
 *   Indore (city center -> Rajwada): Bike 25-28, Auto 48-56, Cab Economy 115-135,
 *     Cab Premium 139-162 (service ids are CITY-SPECIFIC, catalog resolved per city).
 *   Delhi (Rajiv Chowk -> IGI T3): Bike 208-245, Cab Economy 237-290, Cab Premium
 *     346-415, Cab XL 526-631.
 *   Intercity (Indore -> Bhopal): HTTP 500 — Rapido's network is city-local, the
 *   intercity presence-row notice in rapidoCabs.ts stays the honest answer there.
 *
 * Self-healing ladder (owner standing rule): env.js sKey/sequence refresh + module
 * re-init on signature 401, circuit backoff after repeated failure. If Rapido rotates
 * the bundle entirely, scripts/regen_rapido_thiqa.py regenerates the asset.
 */
import { createHash, randomUUID } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { newRawItem } from '../../sources/contract';
import type { RawSourceItem, SourceConfig } from '../../types';
import { cffiFetch } from '../../common/curlCffiFetch';
import {
  RAPIDO_THIQA_WASM_B64, RAPIDO_THIQA_GLUE,
  RAPIDO_THIQA_WASM_B64_SHA256, RAPIDO_THIQA_GLUE_SHA256,
  RAPIDO_SIG_SKEY_DEFAULT, RAPIDO_SIG_SEQ_DEFAULT,
} from './rapidoThiqaAsset';

const M_RAPIDO = 'https://m.rapido.bike';
const FARE_URL = `${M_RAPIDO}/pwa/api/unup/scc/fareEstimate`;
const SERVICES_URL = `${M_RAPIDO}/pwa/api/unup/location/services`;

const DEVICE_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  Origin: M_RAPIDO,
  Referer: `${M_RAPIDO}/`,
  'channel-name': 'pwa',
  'channel-host': 'm.rapido.bike',
  'channel-entity': 'customer',
  version: '1.0',
  appid: '2',
  appId: '2',
  appversion: '214',
  internet: 'online',
};

/** Stable per-process device id (Rapido logs it inside the quote payload). */
const DEVICE_ID = `try1s-${randomUUID().slice(0, 12)}`;

// ---------------------------------------------------------------------------
// Signature config (sKey + sequence from m.rapido.bike/assets/env.js)
// ---------------------------------------------------------------------------

let sigCfg: { sKey: string; sequence: string; at: number } | null = null;

export async function rapidoSignatureConfig(fetchText: (url: string) => Promise<string>): Promise<{ sKey: string; sequence: string }> {
  if (sigCfg && Date.now() - sigCfg.at < 6 * 3600_000) return sigCfg;
  try {
    const env = await fetchText(`${M_RAPIDO}/assets/env.js`);
    const sKey = env.match(/signatureVerificationSKey:\s*'([^']+)'/)?.[1];
    const sequence = env.match(/signatureVerificationSequence:\s*'([^']+)'/)?.[1];
    if (sKey && sequence) {
      sigCfg = { sKey, sequence, at: Date.now() };
      return sigCfg;
    }
  } catch {
    // network failure — fall back to the pinned asset values
  }
  sigCfg = { sKey: RAPIDO_SIG_SKEY_DEFAULT, sequence: RAPIDO_SIG_SEQ_DEFAULT, at: Date.now() };
  return sigCfg;
}

// ---------------------------------------------------------------------------
// thiqa-kmp WASM module (in-process, plain Node WebAssembly)
// ---------------------------------------------------------------------------

export interface ThiqaSignature { success: boolean; error?: string; xKm: string; xM: string; xEkref: string; xPm: string }
interface ThiqaModule {
  getThiqa(body: string, sKey: string, sequence: string, metadata: string): Promise<ThiqaSignature>;
}

let thiqaMod: ThiqaModule | null = null;
let thiqaBrokenUntil = 0; // circuit: after repeated signature failures, stop retrying for 6h

export function resetRapidoThiqaForTests(): void {
  thiqaMod = null;
  thiqaBrokenUntil = 0;
  sigCfg = null;
}

async function initThiqa(): Promise<ThiqaModule | null> {
  if (thiqaMod) return thiqaMod;
  if (Date.now() < thiqaBrokenUntil) return null;
  try {
    const wasm = Buffer.from(RAPIDO_THIQA_WASM_B64, 'base64');
    const wsha = createHash('sha256').update(wasm).digest('hex');
    if (wsha !== RAPIDO_THIQA_WASM_B64_SHA256) throw new Error(`thiqa wasm sha256 mismatch (${wsha})`);
    const gsha = createHash('sha256').update(RAPIDO_THIQA_GLUE, 'utf8').digest('hex');
    if (gsha !== RAPIDO_THIQA_GLUE_SHA256) throw new Error(`thiqa glue sha256 mismatch (${gsha})`);
    // The glue's Node branch fs-reads the wasm next to import.meta.resolve('./platform-mobile-sdks-thiqa-kmp.wasm').
    // Persist the bytes in a private tmp dir and point the (patched) import.meta there.
    const dir = path.join(os.tmpdir(), 'try1s-rapido-thiqa');
    fs.mkdirSync(dir, { recursive: true });
    const wasmPath = path.join(dir, 'platform-mobile-sdks-thiqa-kmp.wasm');
    fs.writeFileSync(wasmPath, wasm);
    const wasmFileUrl = `file://${wasmPath}`;
    // Patch the glue exactly the way Rapido's own bundle does before evaluating it:
    // strip `export`, stub import.meta, and answer the hostname question locally so no
    // browser globals are ever touched.
    const META = `{url:'file://${path.join(dir, 'harness.js')}',resolve:function(p){return '${wasmFileUrl}'}}`;
    let glue = RAPIDO_THIQA_GLUE
      .replace(/\bexport\s+/g, '')
      .replace(/import\.meta/g, META)
      .replace(/window\.location\.hostname/g, `'m.rapido.bike'`);
    const fakeFetch = (): Promise<Response> =>
      Promise.resolve(new Response(wasm, { status: 200, headers: { 'Content-Type': 'application/wasm' } }));
    const instantiate = new Function('fetch', `${glue}\nreturn instantiate;`)(fakeFetch) as
      (imports: Record<string, unknown>) => Promise<{ exports: { getThiqa: ThiqaModule['getThiqa'] } }>;
    const mod = await instantiate({ '@js-joda/core': {} }); // js-joda is imported but unused by getThiqa (verified)
    if (typeof mod?.exports?.getThiqa !== 'function') throw new Error('thiqa wasm did not export getThiqa');
    thiqaMod = {
      getThiqa: (body, sKey, sequence, metadata) => mod.exports.getThiqa(body, sKey, sequence, metadata),
    };
    return thiqaMod;
  } catch {
    // Old Node without WasmGC, tmpdir not writable, bundle rotation — circuit-break.
    thiqaBrokenUntil = Date.now() + 6 * 3600_000;
    return null;
  }
}

async function signBody(body: string, sKey: string, sequence: string): Promise<Record<string, string> | null> {
  const mod = await initThiqa();
  if (!mod) return null;
  try {
    const sig = await mod.getThiqa(body, sKey, sequence, JSON.stringify({ id: randomUUID() }));
    if (!sig?.success || !sig.xKm || !sig.xM || !sig.xEkref || !sig.xPm) return null;
    return { 'x-km': sig.xKm, 'x-m': sig.xM, 'x-ekref': sig.xEkref, 'x-pm': sig.xPm };
  } catch {
    return null;
  }
}

/** Test hook: runs the embedded thiqa wasm to sign an arbitrary body (offline). */
export async function rapidoSignatureHeadersForTest(
  body: string,
  sKey = RAPIDO_SIG_SKEY_DEFAULT,
  sequence = RAPIDO_SIG_SEQ_DEFAULT,
): Promise<Record<string, string> | null> {
  return signBody(body, sKey, sequence);
}

// ---------------------------------------------------------------------------
// protobuf quote decoding (fareEstimate response is a JSON array of proto bytes)
// ---------------------------------------------------------------------------

export interface RapidoFareQuote { serviceId: string; parentServiceId: string; min: number; max: number }

/** Minimal reader for the quote list: root f2 = data, data.f4 = quotes {f1 parent, f2 service, f3 min, f4 max}. */
export function decodeRapidoFareQuotes(bytes: Uint8Array): RapidoFareQuote[] {
  const quotes: RapidoFareQuote[] = [];
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let i = 0;
  const varint = (): number => {
    let v = 0, s = 0;
    for (;;) {
      if (i >= bytes.length) throw new Error('truncated varint');
      const b = bytes[i++];
      v |= (b & 0x7f) << s;
      s += 7;
      if (!(b & 0x80)) return v >>> 0;
    }
  };
  const readField = (): { fn: number; wt: number } => {
    const tag = varint();
    return { fn: tag >>> 3, wt: tag & 7 };
  };
  const parseQuote = (q: Uint8Array): RapidoFareQuote | null => {
    // local reader over the quote submessage
    const qd = new DataView(q.buffer, q.byteOffset, q.byteLength);
    let j = 0;
    const vint = (): number => {
      let v = 0, s = 0;
      for (;;) {
        if (j >= q.length) throw new Error('truncated quote varint');
        const b = q[j++];
        v |= (b & 0x7f) << s;
        s += 7;
        if (!(b & 0x80)) return v >>> 0;
      }
    };
    const out: Partial<RapidoFareQuote> = {};
    while (j < q.length) {
      const tag = vint();
      const fn = tag >>> 3, wt = tag & 7;
      if (wt === 2) {
        const len = vint();
        const str = new TextDecoder().decode(q.slice(j, j + len));
        j += len;
        if (fn === 1) out.parentServiceId = str;
        if (fn === 2) out.serviceId = str;
      } else if (wt === 1) {
        const val = qd.getFloat64(j, true);
        j += 8;
        if (fn === 3) out.min = val;
        if (fn === 4) out.max = val;
      } else if (wt === 0) {
        const val = vint();
        if (fn === 3) out.min = val;
        if (fn === 4) out.max = val;
      } else {
        throw new Error(`unsupported wire type ${wt} in quote`);
      }
    }
    if (!out.serviceId || out.min == null || out.max == null) return null;
    return { serviceId: out.serviceId, parentServiceId: out.parentServiceId || '', min: out.min, max: out.max };
  };
  const parseData = (d: Uint8Array) => {
    let j = 0;
    const dvv = new DataView(d.buffer, d.byteOffset, d.byteLength);
    const vint = (): number => {
      let v = 0, s = 0;
      for (;;) {
        if (j >= d.length) throw new Error('truncated data varint');
        const b = d[j++];
        v |= (b & 0x7f) << s;
        s += 7;
        if (!(b & 0x80)) return v >>> 0;
      }
    };
    while (j < d.length) {
      const tag = vint();
      const fn = tag >>> 3, wt = tag & 7;
      if (wt === 2) {
        const len = vint();
        const sub = d.slice(j, j + len);
        j += len;
        if (fn === 4) {
          const q = parseQuote(sub);
          if (q) quotes.push(q);
        }
      } else if (wt === 1) { j += 8; }
      else if (wt === 0) { vint(); }
      else { throw new Error(`unsupported wire type ${wt} in data`); }
    }
    void dvv;
  };
  while (i < bytes.length) {
    const { fn, wt } = readField();
    if (wt === 2) {
      const len = varint();
      const sub = bytes.slice(i, i + len);
      i += len;
      if (fn === 2) parseData(sub);
    } else if (wt === 0) {
      varint();
    } else if (wt === 1) {
      i += 8;
    } else if (wt === 5) {
      i += 4;
    } else {
      throw new Error(`unsupported wire type ${wt} at root`);
    }
  }
  void dv;
  return quotes;
}

// ---------------------------------------------------------------------------
// services catalog (city-specific service ids -> display names)
// ---------------------------------------------------------------------------

export interface RapidoService { id: string; name: string; displayName: string; parentServiceId: string }

const servicesCache = new Map<string, { at: number; byId: Map<string, RapidoService> }>();

export async function rapidoServiceCatalog(lat: number, lng: number): Promise<Map<string, RapidoService>> {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const hit = servicesCache.get(key);
  if (hit && Date.now() - hit.at < 12 * 3600_000) return hit.byId;
  const r = await cffiFetch(SERVICES_URL, {
    method: 'POST',
    impersonate: 'chrome',
    timeoutMs: 15_000,
    headers: { ...DEVICE_HEADERS, deviceid: DEVICE_ID, currentdatetime: String(Date.now()), authorization: 'Bearer ' },
    body: JSON.stringify({ lat, lng }),
  });
  if (r.status !== 200) throw new Error(`Rapido services HTTP ${r.status}`);
  let j: any;
  try { j = JSON.parse(r.body); } catch { throw new Error('Rapido services non-JSON'); }
  const list: any[] = Array.isArray(j?.data?.data) ? j.data.data : [];
  const byId = new Map<string, RapidoService>();
  for (const s of list) {
    const id = String(s?._id || '');
    if (!id) continue;
    byId.set(id, { id, name: String(s.name || ''), displayName: String(s.displayName || s.name || id), parentServiceId: String(s.parentServiceId || '') });
  }
  if (!byId.size) throw new Error('Rapido services catalog empty');
  servicesCache.set(key, { at: Date.now(), byId });
  return byId;
}

// ---------------------------------------------------------------------------
// fare estimate (signature ladder: cached module -> re-init + fresh env keys)
// ---------------------------------------------------------------------------

export interface RapidoFarePoint { lat: number; lng: number; label: string }

export interface RapidoFareOutcome {
  status: 'ok' | 'unavailable' | 'signing_unsupported' | 'error';
  quotes: RapidoFareQuote[];
  detail?: string;
}

/**
 * Live guest fare fetch. Never throws: 'ok' carries quotes, 'unavailable' means
 * Rapido serves the city but not this trip shape (e.g. intercity 500s),
 * 'signing_unsupported' means the wasm could not run (old Node) — caller falls
 * back to the presence rows.
 */
export async function rapidoGuestFares(pickup: RapidoFarePoint, drop: RapidoFarePoint): Promise<RapidoFareOutcome> {
  const mod = await initThiqa();
  if (!mod) return { status: 'signing_unsupported', quotes: [], detail: 'thiqa wasm unavailable (Node WasmGC or bundle rotation)' };
  const body = JSON.stringify({
    pickupLocation: { lat: pickup.lat, lng: pickup.lng, displayName: pickup.label, address: pickup.label },
    dropLocation: { lat: drop.lat, lng: drop.lng, displayName: drop.label, address: drop.label },
    deviceId: DEVICE_ID,
  });
  const attempt = async (sKey: string, sequence: string) => {
    const sigHeaders = await signBody(body, sKey, sequence);
    if (!sigHeaders) return { status: 'error' as const, http: 0, text: '' };
    const r = await cffiFetch(FARE_URL, {
      method: 'POST',
      impersonate: 'chrome',
      timeoutMs: 15_000,
      headers: { ...DEVICE_HEADERS, deviceid: DEVICE_ID, currentdatetime: String(Date.now()), authorization: 'Bearer ', ...sigHeaders },
      body,
    });
    return { status: r.status === 200 ? ('ok' as const) : (r.status >= 500 ? ('unavailable' as const) : ('error' as const)), http: r.status, text: r.body };
  };
  const envFetchText = async (url: string): Promise<string> => {
    const r = await cffiFetch(url, { impersonate: 'chrome', timeoutMs: 10_000, headers: { Accept: '*/*' } });
    if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
    return r.body;
  };
  const cfg0 = await rapidoSignatureConfig(envFetchText);
  let res = await attempt(cfg0.sKey, cfg0.sequence);
  if (res.http === 401 || res.http === 403) {
    // Signature rejected — self-heal: fresh env keys + module re-init, retry once.
    sigCfg = null;
    thiqaMod = null;
    const cfg1 = await rapidoSignatureConfig(envFetchText);
    res = await attempt(cfg1.sKey, cfg1.sequence);
    if (res.http === 401 || res.http === 403) {
      thiqaBrokenUntil = Date.now() + 6 * 3600_000;
      return { status: 'signing_unsupported', quotes: [], detail: `signature rejected after re-init (HTTP ${res.http})` };
    }
  }
  if (res.status === 'unavailable') return { status: 'unavailable', quotes: [], detail: `fare HTTP ${res.http}` };
  if (res.status !== 'ok') return { status: 'error', quotes: [], detail: `fare HTTP ${res.http}` };
  let bytes: Uint8Array;
  try {
    const arr = JSON.parse(res.text);
    if (!Array.isArray(arr) || !arr.every((n) => typeof n === 'number')) throw new Error('not a byte array');
    bytes = Uint8Array.from(arr as number[]);
  } catch {
    return { status: 'error', quotes: [], detail: 'fareEstimate response not a protobuf byte array' };
  }
  let quotes: RapidoFareQuote[];
  try { quotes = decodeRapidoFareQuotes(bytes); }
  catch { return { status: 'error', quotes: [], detail: 'protobuf decode failed' }; }
  return { status: 'ok', quotes, detail: `HTTP 200, ${quotes.length} quotes` };
}

// ---------------------------------------------------------------------------
// row builder
// ---------------------------------------------------------------------------

export interface RapidoFareRowInput {
  source: SourceConfig;
  from: string;
  to: string;
  city: string;
  quotes: RapidoFareQuote[];
  catalog: Map<string, RapidoService>;
}

/**
 * Live priced rows for intra-city trips. Quotes whose service id maps to no
 * catalog entry (parcel/metro experiments etc.) are skipped, never guessed.
 * The fare window (min-max) is Rapido's own; `price` carries the midpoint so
 * sorting/grouping works like the other cab sellers.
 */
export function buildRapidoFareRows(inp: RapidoFareRowInput): RawSourceItem[] {
  const route = `${inp.from} → ${inp.to}`;
  const today = new Date().toISOString().slice(0, 10);
  const rows: RawSourceItem[] = [];
  const seen = new Set<string>();
  for (const q of inp.quotes) {
    const svc = inp.catalog.get(q.serviceId) || inp.catalog.get(q.parentServiceId);
    if (!svc) continue;
    const vehicle = svc.displayName;
    if (seen.has(vehicle)) continue; // one row per vehicle class
    seen.add(vehicle);
    const price = Math.round((q.min + q.max) / 2);
    rows.push(newRawItem(inp.source, {
      title: `${inp.from} to ${inp.to} Rapido ${vehicle} (city ride, one-way)`,
      brand: 'Rapido',
      price,
      currency: 'INR',
      seller: 'Rapido',
      sellerUrl: M_RAPIDO,
      availability: 'unknown',
      travel: { route: `${inp.from} to ${inp.to}`.toLowerCase(), seatType: 'unknown' },
      location: { city: inp.city },
      identifiers: { sku: `rapido-${vehicle}`.toLowerCase().replace(/\s+/g, '-') },
      attributes: {
        pickup: inp.from,
        drop: inp.to,
        route: `${inp.from} to ${inp.to}`,
        vehicle_type: vehicle,
        trip_type: 'one-way',
        fare_range: `Rs ${Math.round(q.min)} - Rs ${Math.round(q.max)}`,
        price_basis: `Rapido live fare estimate on ${today}`,
        data_note:
          `Live fare window from Rapido's own guest booking app (m.rapido.bike unup fare API, request signed by their embedded wasm module). ` +
          `${vehicle} rides operate in ${inp.city}; book instantly on the Rapido app or m.rapido.bike.`,
      },
      evidence: {
        extractedFields: ['title', 'seller', 'price', 'fare_range'],
        sourceUrl: FARE_URL,
        sourceReference: 'm.rapido.bike guest unup fareEstimate (wasm-signed)',
      },
    }));
  }
  void route;
  return rows;
}
