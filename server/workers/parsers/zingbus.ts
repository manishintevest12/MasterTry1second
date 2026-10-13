/**
 * Zingbus parser. https://www.zingbus.com/bus-tickets/<from>-to-<to>-bus-route
 * is a Next.js SEO route page: __NEXT_DATA__ carries pTableData with the
 * route's real minFare/maxFare (rupees), busCount, travelTime, first/last
 * departure and busTypeArr. Per-bus inventory loads via sessioned XHR only;
 * this is route-level fare data (same honesty as the redBus route source).
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

interface ZingRouteTable {
  fromCityName?: string;
  toCityName?: string;
  minFare?: number;
  maxFare?: number;
  busCount?: number;
  travelTime?: string;
  firstBusTime?: string;
  lastBusTime?: string;
  busTypeArr?: string[];
}

/** Legacy/spelling aliases → zingbus slug spelling. */
const ZING_ALIAS: Record<string, string> = {
  bengaluru: 'bangalore',
  mysuru: 'mysore',
  'mumbai (bombay)': 'mumbai',
  bombay: 'mumbai',
  calcutta: 'kolkata',
  gurgaon: 'gurugram',
  pondicherry: 'puducherry',
  varanasi: 'banaras',
  'new delhi': 'delhi',
  'delhi ncr': 'delhi',
};

export function zingbusSlug(city: string): string {
  let c = city.toLowerCase().trim()
    .replace(/\s*\((?:[a-z]{3})\)\s*/g, ' ') // strip IATA "(del)"
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  c = ZING_ALIAS[c] || c;
  return c.replace(/\s+/g, '-');
}

export function parseZingbusRoute(html: string, source: SourceConfig, pageUrl: string, fromCity: string, toCity: string): RawSourceItem[] {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return [];
  let root: any;
  try { root = JSON.parse(m[1]); } catch { return []; }
  let pt: ZingRouteTable | null = null;
  const find = (o: any, depth: number): any => {
    if (pt || depth > 10 || o == null) return;
    if (Array.isArray(o)) { for (const v of o.slice(0, 60)) find(v, depth + 1); return; }
    if (typeof o === 'object') {
      if (o.pTableData && typeof o.pTableData === 'object') { pt = o.pTableData; return; }
      for (const v of Object.values(o)) find(v, depth + 1);
    }
  };
  find(root, 0);
  if (!pt) return [];
  const fare = Number(pt.minFare);
  if (!Number.isFinite(fare) || fare <= 0) return [];
  const from = String(pt.fromCityName || fromCity);
  const to = String(pt.toCityName || toCity);
  const today = new Date().toISOString().slice(0, 10);
  const route = `${from} to ${to}`.toLowerCase();
  const busTypes = Array.isArray(pt.busTypeArr) ? pt.busTypeArr.slice(0, 4).join('; ') : '';
  return [newRawItem(source, {
    title: `${from} to ${to} zingbus (lowest fare across ${pt.busCount || 'all'} services)`,
    brand: 'zingbus',
    price: fare,
    currency: 'INR',
    seller: 'zingbus',
    sellerUrl: pageUrl,
    travel: { route, seatType: busTypes || 'varies (seater/sleeper/AC)' },
    attributes: {
      route,
      min_fare: String(fare),
      max_fare: String(pt.maxFare ?? ''),
      service_count: String(pt.busCount ?? ''),
      avg_duration: String(pt.travelTime ?? ''),
      first_departure: String(pt.firstBusTime ?? ''),
      last_departure: String(pt.lastBusTime ?? ''),
      image: '',
      price_basis: `minimum route fare as published by zingbus.com on ${today}`,
      data_note: `Route-level fare summary (min Rs${fare}/max Rs${pt.maxFare ?? '?'} across ${pt.busCount ?? '?'} services) scraped from zingbus.com on ${today}`,
    },
    identifiers: { sku: `zingbus-${route.replace(/\s+/g, '-')}` },
    evidence: { sourceUrl: pageUrl, extractedFields: ['pTableData minFare', 'maxFare', 'busCount', 'travelTime', 'firstBusTime'] },
  })];
}
