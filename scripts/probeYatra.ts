import { cffiFetch } from '../server/common/curlCffiFetch';
async function tryUrl(url: string, opts: any) {
  const t = Date.now();
  try {
    const r = await cffiFetch(url, opts);
    console.log(`${r.status} ${r.body.length}B ${Date.now() - t}ms ${JSON.stringify(opts)} ${url}`);
    return r;
  } catch (e: any) {
    console.log(`ERR ${String(e?.message || e).slice(0, 90)} ${Date.now() - t}ms ${JSON.stringify(opts)}`);
    return null;
  }
}
for (const url of ['https://www.yatra.com/bus-booking', 'https://www.yatra.com/buses/indore-to-bhopal']) {
  for (const o of [{ impersonate: 'chrome', httpVersion: '1.1', timeoutMs: 15000 }, { impersonate: 'safari17_0', httpVersion: '1.1', timeoutMs: 15000 }, { impersonate: 'chrome', timeoutMs: 15000 }]) {
    const r = await tryUrl(url, o);
    if (r && r.status === 200 && r.body.length > 20000) {
      const apis = [...new Set((r.body.match(/["'][^"']*(?:bus)[^"']*(?:api|Search|search)[^"']*["']/g) || []))].slice(0, 6);
      console.log('hints:', apis);
      process.exit(0);
    }
  }
}
