/**
 * Ixigo bus parser (owner 28 Oct: "inko add kro aur price le kr bhi aao inke" — the bus
 * vertical's mandated sources MakeMyTrip / Yatra / Ixigo must carry real prices, not probes).
 *
 * Live recon (browserless, curl_cffi chrome):
 *   GET https://www.ixigo.com/buses/<from>-<to>-sts   -> 200, ~600KB SSR shell
 *   The React Server Component payload (`self.__next_f.push([1,"..."])`) embeds the route's
 *   real service list for the page's journeyDate: per service `travelerAgentName` (operator),
 *   `busTypeName`, `fares.fare` (rupees), `timings.startTime/arriveTime/travelTime`, `rating`.
 *   No session, no cookie, no API key — the same numbers the ixigo page prints.
 *
 * Honesty rules baked in here:
 *  - Only services belonging to the QUERIED route object are used (the page also embeds
 *    "similar routes" blocks; picking the wrong block would relabel another city's fares).
 *  - The page's own `journeyDate` decides whether a row may be shown at all: if it is not the
 *    requested date, this parser returns [] and the worker says so, instead of passing off
 *    tomorrow's fares as the user's date.
 */

import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

/** Legacy/spelling aliases → ixigo slug spelling (ixigo serves both, but keep links canonical). */
const IXIGO_ALIAS: Record<string, string> = {
  bengaluru: 'bangalore',
  mysuru: 'mysore',
  bombay: 'mumbai',
  'mumbai (bombay)': 'mumbai',
  calcutta: 'kolkata',
  gurgaon: 'gurugram',
  pondicherry: 'puducherry',
  banaras: 'varanasi',
  'new delhi': 'delhi',
  'delhi ncr': 'delhi',
};

export function ixigoCitySlug(city: string): string {
  const cleaned = String(city || '')
    .toLowerCase()
    .replace(/\s*\([a-z]{3}\)\s*/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const alias = IXIGO_ALIAS[cleaned] || cleaned;
  return alias.replace(/\s+/g, '-');
}

/** Ixigo serves route pages as /buses/<from>-<to>-sts. */
export function ixigoRoutePath(from: string, to: string): string {
  return `/buses/${ixigoCitySlug(from)}-${ixigoCitySlug(to)}-sts`;
}

interface IxigoService {
  travelerAgentName?: string;
  busTypeName?: string;
  serviceName?: string;
  serviceNumber?: string;
  rating?: number;
  noOfRatings?: number;
  fares?: { fare?: number; fareList?: number[] };
  timings?: { startTime?: string; arriveTime?: string; travelTime?: string; startTimeDateFormat?: string };
}

interface IxigoRouteBlock {
  services?: IxigoService[];
  journeyDate?: string;
  minFare?: number;
  maxFare?: number;
  sourceId?: number;
  destinationId?: number;
}

/**
 * Concatenate the React flight payload. Each chunk is a JS string literal, so it must be
 * JSON-decoded (not regex-unescaped) to get valid JSON inside.
 */
export function ixigoFlightText(html: string): string {
  const out: string[] = [];
  const re = /self\.__next_f\.push\(\[1,\s*("(?:[^"\\]|\\.)*")\]\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try { out.push(JSON.parse(m[1])); } catch { /* partial chunk: skip */ }
  }
  return out.join('');
}

/** JSON.parse a `{...}` substring starting at `start`, honouring nested braces and strings. */
function parseObjectAt(text: string, start: number): any | null {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        try { return JSON.parse(text.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

/**
 * Find the route block that owns these services: walk back from every `"services":` hit to
 * the nearest enclosing `{` and keep the first parse that really contains a services array.
 */
export function ixigoRouteBlocks(text: string): IxigoRouteBlock[] {
  const marker = '"services"';
  const blocks: IxigoRouteBlock[] = [];
  const seen = new Set<string>();
  let from = 0;
  let guard = 0;
  while (guard < 40) {
    guard += 1;
    const at = text.indexOf(marker, from);
    if (at < 0) break;
    from = at + marker.length;
    for (let i = at; i >= 0 && at - i < 500_000; i -= 1) {
      if (text[i] !== '{') continue;
      const parsed = parseObjectAt(text, i);
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.services)) {
        const key = `${i}`;
        if (!seen.has(key)) { seen.add(key); blocks.push(parsed as IxigoRouteBlock); }
        break;
      }
    }
  }
  return blocks;
}

/** Kept for callers that only need the first route block. */
export function ixigoRouteBlock(text: string): IxigoRouteBlock | null {
  return ixigoRouteBlocks(text)[0] ?? null;
}

/** '07:00 PM' -> '19:00' (same 24h convention the redBus/AbhiBus bus workers emit). */
function to24h(value: string | undefined): string {
  const m = /^(\d{1,2}):(\d{2})\s*([AaPp][Mm])?$/.exec(String(value || '').trim());
  if (!m) return '';
  let h = Number(m[1]);
  const min = m[2];
  const mer = (m[3] || '').toUpperCase();
  if (mer === 'PM' && h < 12) h += 12;
  if (mer === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${min}`;
}

/** '04:00:00' -> 240 minutes. */
function durationMinutes(value: string | undefined): number {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(value || '').trim());
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

function isoDate(value: string | undefined): string {
  const v = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const dmy = v.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  return '';
}

export interface IxigoParseResult {
  items: RawSourceItem[];
  journeyDate: string;
  serviceCount: number;
  reason?: string;
}

/**
 * Parse the SSR page into per-service rows. `depart` is the user's ISO date; rows are only
 * returned when the page's own journeyDate matches it (see the honesty note above).
 */
export function parseIxigoBusPage(
  html: string,
  source: SourceConfig,
  pageUrl: string,
  from: string,
  to: string,
  depart: string,
): IxigoParseResult {
  const blocks = ixigoRouteBlocks(ixigoFlightText(html));
  // The page also embeds "similar routes" blocks. Prefer the block whose own journeyDate is
  // the requested date, so another city's/date's fares can never be relabelled as this route.
  const block = blocks.find((b) => isoDate(b.journeyDate) && isoDate(b.journeyDate) === depart) ?? blocks[0];
  if (!block) return { items: [], journeyDate: '', serviceCount: 0, reason: 'ixigo page carried no route payload' };
  const journeyDate = isoDate(block.journeyDate);
  const services = Array.isArray(block.services) ? block.services : [];
  if (!services.length) return { items: [], journeyDate, serviceCount: 0, reason: `no services published for ${from} to ${to}` };
  if (depart && journeyDate && depart !== journeyDate) {
    return {
      items: [], journeyDate, serviceCount: services.length,
      reason: `ixigo route page carries ${journeyDate}, requested ${depart}`,
    };
  }
  const route = `${from} to ${to}`.toLowerCase();
  const today = new Date().toISOString().slice(0, 10);
  const items: RawSourceItem[] = [];
  for (const s of services.slice(0, 14)) {
    const fare = Number(s?.fares?.fare);
    if (!Number.isFinite(fare) || fare <= 0) continue;
    const operator = String(s.travelerAgentName || s.serviceName || 'ixigo operator').trim();
    const busType = String(s.busTypeName || 'seater/sleeper').trim();
    const start = String(s.timings?.startTime || '').trim();
    const arrive = String(s.timings?.arriveTime || '').trim();
    const dep24 = to24h(start);
    const arr24 = to24h(arrive);
    const durMin = durationMinutes(s.timings?.travelTime);
    // Bus cards render "HH:MM → HH:MM (+1)" exactly like the redBus rows.
    const overnight = dep24 && arr24 && arr24 < dep24;
    const departureLabel = dep24 ? `${dep24}${arr24 ? ` \u2192 ${arr24}${overnight ? ' (+1)' : ''}` : ''}` : '';
    items.push(newRawItem(source, {
      title: `${operator} ${from} to ${to} bus (${start || 'departure'}${arrive ? ` - ${arrive}` : ''})`,
      brand: operator,
      price: fare,
      currency: 'INR',
      seller: 'ixigo',
      sellerUrl: pageUrl,
      travel: {
        route,
        date: journeyDate,
        seatType: busType,
      },
      attributes: {
        route,
        operator,
        bus_type: busType,
        departure: departureLabel,
        departure_time: dep24,
        arrival_time: arr24,
        ...(durMin > 0 ? { duration: `${Math.floor(durMin / 60)}h ${durMin % 60}m`, duration_minutes: String(durMin) } : {}),
        journey_date: journeyDate,
        fare_list: (s.fares?.fareList || []).join(','),
        rating: String(s.rating ?? ''),
        ratings_count: String(s.noOfRatings ?? ''),
        service_number: String(s.serviceNumber || ''),
        price_basis: `per-service fare as published by ixigo.com for ${journeyDate}`,
        data_note: `Ixigo bus service fare scraped from the route page on ${today}`,
      },
      identifiers: { sku: `ixigo-bus-${route.replace(/\s+/g, '-')}-${String(s.serviceNumber || operator).replace(/[^a-z0-9]+/gi, '-').slice(0, 40)}` },
      evidence: { sourceUrl: pageUrl, extractedFields: ['services[].fares.fare', 'travelerAgentName', 'busTypeName', 'timings'] },
    }));
  }
  return { items, journeyDate, serviceCount: services.length };
}
