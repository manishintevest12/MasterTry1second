/** Live check for the MakeMyTrip bus source (browserless Apollo GraphQL). */
import { cffiFetch } from '../server/common/curlCffiFetch';
import {
  MMT_AUTOSUGGEST_URL, MMT_GRAPHQL_URL, mmtBusDeeplink, mmtBusRequest, parseMmtBusListing, parseMmtCitySuggestion,
} from '../server/workers/parsers/makemytripBus';

const source: any = { id: 'w_bus_makemytrip', method: 'direct_http', vertical: 'bus' };

async function code(city: string) {
  const r = await cffiFetch(`${MMT_AUTOSUGGEST_URL}?query=${encodeURIComponent(city)}`, {
    impersonate: 'chrome', timeoutMs: 12_000, headers: { accept: 'application/json', origin: 'https://www.makemytrip.com' },
  });
  const hit = parseMmtCitySuggestion(JSON.parse(r.body), city);
  if (!hit) throw new Error(`no code for ${city} (HTTP ${r.status})`);
  return hit;
}

async function main() {
  const from = process.argv[2] || 'Indore';
  const to = process.argv[3] || 'Bhopal';
  const depart = process.argv[4] || new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  const [a, b] = await Promise.all([code(from), code(to)]);
  console.log(`codes ${a.name}=${a.code} ${b.name}=${b.code} date ${depart}`);
  const t0 = Date.now();
  const r = await cffiFetch(MMT_GRAPHQL_URL, {
    method: 'POST', impersonate: 'chrome', timeoutMs: 25_000,
    headers: { 'content-type': 'application/json', accept: 'application/json', origin: 'https://www.makemytrip.com', referer: 'https://www.makemytrip.com/' },
    body: JSON.stringify(mmtBusRequest(a.code, b.code, depart)),
  });
  const ms = Date.now() - t0;
  const parsed = parseMmtBusListing(JSON.parse(r.body), source, mmtBusDeeplink(a.name, b.name, depart), a.name, b.name, depart);
  console.log(`HTTP ${r.status} ${r.body.length}B ${ms}ms | status ${parsed.status} | services ${parsed.busCount} | rows ${parsed.items.length}${parsed.reason ? ` | ${parsed.reason}` : ''}`);
  for (const it of parsed.items.slice(0, 6)) {
    console.log(`  Rs${it.price}  ${it.attributes?.operator}  ${it.attributes?.bus_type}  ${it.attributes?.departure}  ${it.attributes?.duration || ''}  seats ${it.attributes?.seats_available || '?'}`);
  }
}
main().catch((e) => { console.error('ERR', e?.message || e); process.exit(1); });
