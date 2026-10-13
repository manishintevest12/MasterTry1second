/**
 * LAST PRICE MEMORY (owner request): when a source is blocked/empty on a later
 * search, the sources panel shows the last price that source actually returned
 * for this vertical, with when it was seen — honest, labelled, never invented.
 * Durable JSON file (same file-store pattern as the catalogue fallback).
 */
import fs from 'node:fs';
import path from 'node:path';
import { dataDir } from './settings';

const FILE = path.join(dataDir, 'last-price.json');
type Entry = { price: number; query: string; at: number };
type Store = Record<string, Entry>; // `${vertical}|${sourceId}` -> last seen price

let cache: Store | null = null;
let lastSave = 0;
let saveTimer: NodeJS.Timeout | null = null;

function load(): Store {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    cache = {};
  }
  return cache!;
}

function persistSoon(): void {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(FILE, JSON.stringify(cache ?? {}));
      lastSave = Date.now();
    } catch { /* file store is best-effort; the panel simply degrades to no last price */ }
  }, 250);
}

/** Record the min real price each source returned for this vertical on this search. */
export function recordSourcePrices(vertical: string, query: string, offers: Array<{ sourceId?: string; prices?: { effectivePrice?: number; mandatoryTotal?: number } }>): void {
  const store = load();
  const perSource = new Map<string, number>();
  for (const o of offers || []) {
    const sid = String((o as any).sourceId || '');
    if (!sid) continue;
    const p = Number(o.prices?.effectivePrice ?? o.prices?.mandatoryTotal ?? 0);
    if (!(p > 0)) continue;
    perSource.set(sid, Math.min(perSource.get(sid) ?? Infinity, p));
  }
  const now = Date.now();
  for (const [sid, price] of perSource) {
    store[`${vertical}|${sid}`] = { price: Math.round(price * 100) / 100, query: String(query || '').slice(0, 80), at: now };
  }
  if (perSource.size) persistSoon();
}

/** Attach lastPrice to failed-source entries so the UI can show "Last: ₹X · when". */
export function enrichFailedWithLastPrice<T extends { sourceId: string }>(vertical: string, failed: T[]): Array<T & { lastPrice?: { price: number; query: string; at: number } }> {
  const store = load();
  return (failed || []).map((f) => {
    const e = store[`${vertical}|${f.sourceId}`];
    return e ? { ...f, lastPrice: { ...e } } : f;
  });
}
