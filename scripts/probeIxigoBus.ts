/** Live check for the Ixigo bus source (browserless, curl_cffi chrome impersonation). */
import { cffiFetch } from '../server/common/curlCffiFetch';
import { ixigoRoutePath, parseIxigoBusPage } from '../server/workers/parsers/ixigoBuses';

const source = { sourceId: 'w_bus_ixigo', name: 'Ixigo bus', vertical: 'bus' } as any;

async function main() {
  const [from, to, depart] = [process.argv[2] || 'Indore', process.argv[3] || 'Bhopal', process.argv[4] || ''];
  const pageUrl = `https://www.ixigo.com${ixigoRoutePath(from, to)}`;
  const r = await cffiFetch(pageUrl, { impersonate: 'chrome', timeoutMs: 20_000 });
  console.log('HTTP', r.status, 'bytes', r.body.length, pageUrl);
  const parsed = parseIxigoBusPage(r.body, source, pageUrl, from, to, depart);
  console.log('journeyDate', parsed.journeyDate, '| services', parsed.serviceCount, '| rows', parsed.items.length, parsed.reason ? `| reason: ${parsed.reason}` : '');
  for (const it of parsed.items.slice(0, 5)) {
    console.log(`  Rs${it.price}  ${it.attributes?.operator}  ${it.attributes?.bus_type}  ${it.attributes?.departure}  ${it.attributes?.duration}`);
  }
}
main().catch((e) => { console.error('ERR', e?.message || e); process.exit(1); });
