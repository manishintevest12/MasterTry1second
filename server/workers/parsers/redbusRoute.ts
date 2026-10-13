/**
 * redBus route-page parser — bus vertical.
 *
 * redBus SEO route pages (https://www.redbus.in/bus-tickets/{from}-to-{to}.aspx)
 * embed a real `dataInfo` JSON with the route's live summary: minimum fare across
 * all services, service count, operator count, first/last departure and average
 * duration. Per-bus listing requires a protobuf API (capi.redbus.com), so we
 * honestly surface route-level facts only — never a fabricated per-bus offer.
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

interface RedBusRouteInfo {
  source: string;
  destination: string;
  minFare: string;         // "INR 93.00"
  servicecount: number;     // 353
  operators: string;       // "103"
  avgDuration: string;     // "5 hrs 47 mins"
  firstBus: string;         // "00:00"
  lastBus: string;          // "23:59"
}

export function extractRedBusRouteInfo(html: string): RedBusRouteInfo | null {
  // dataInfo JSON contains nested LanguageMap braces — grab each flat field individually
  const field = (key: string): string | null => {
    const m = new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`).exec(html);
    return m ? m[1] : null;
  };
  const num = (key: string): string | null => {
    const m = new RegExp(`"${key}"\\s*:\\s*([0-9]+)`).exec(html);
    return m ? m[1] : null;
  };
  const minFare = field('minFare');
  const source = field('source');
  if (!minFare || !source) return null;
  return {
    source,
    destination: field('destination') || '',
    minFare,
    servicecount: Number(num('servicecount')) || 0,
    operators: field('operators') || num('operators') || '',
    avgDuration: field('avgDuration') || '',
    firstBus: field('firstBus') || '',
    lastBus: field('lastBus') || '',
  };
}

export function parseRedBusRoute(html: string, source: SourceConfig, pageUrl: string): RawSourceItem[] {
  const info = extractRedBusRouteInfo(html);
  if (!info) return [];
  const fareM = /([\d,]+(?:\.\d{1,2})?)/.exec(info.minFare);
  const fare = fareM ? Math.round(Number(fareM[1].replace(/,/g, ''))) : null;
  if (!fare || fare <= 0) return [];
  const today = new Date().toISOString().slice(0, 10);
  const route = `${info.source} to ${info.destination}`.toLowerCase();
  return [newRawItem(source, {
    title: `${info.source} to ${info.destination} bus (lowest fare across ${info.servicecount || 'all'} services)`,
    brand: 'redBus',
    price: fare,
    currency: 'INR',
    seller: 'redBus',
    sellerUrl: pageUrl,
    travel: { route, seatType: 'varies (seater/sleeper/AC)' },
    attributes: {
      route: `${info.source} to ${info.destination}`,
      min_fare: String(fare),
      service_count: String(info.servicecount),
      operator_count: info.operators,
      avg_duration: info.avgDuration,
      first_departure: info.firstBus,
      last_departure: info.lastBus,
      image: '',
      price_basis: `minimum route fare as published by redbus.in on ${today}`,
      data_note: `Route-level fare summary (min fare across ${info.servicecount} services from ${info.operators} operators) scraped from redbus.in on ${today}`,
    },
    identifiers: { sku: `redbus-${route.replace(/\s+/g, '-')}` },
    evidence: { sourceUrl: pageUrl, extractedFields: ['dataInfo minFare', 'servicecount', 'operators', 'avgDuration'] },
  })];
}
