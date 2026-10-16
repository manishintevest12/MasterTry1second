import { cffiFetch } from '../server/common/curlCffiFetch';
(async () => {
  const base = 'https://www.rapido.bike';
  for (const f of ['/_next/static/v3k7V54EhKLSM7SMoorvB/pages/_app.js', '/_next/static/chunks/commons.8baa46e9a6a2cc313b52.js', '/_next/static/runtime/main-46327364255845c21614.js']) {
    const r = await cffiFetch(base + f, { impersonate: 'chrome', timeoutMs: 20000 });
    const b = r.body || '';
    const hosts = [...new Set([...b.matchAll(/https?:\/\/([a-z0-9.-]*rapido[a-z0-9.-]*)\//gi)].map((m) => m[1]))];
    const apis = [...new Set([...b.matchAll(/["'](\/api\/[a-z0-9\/_-]{2,50})["']/gi)].map((m) => m[1]))];
    console.log(f.split('/').pop(), 'len', b.length, '| hosts:', hosts.slice(0, 8).join(','), '| apis:', apis.slice(0, 10).join(','));
  }
  process.exit(0);
})();
