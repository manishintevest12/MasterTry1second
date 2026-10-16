import { cffiFetch } from '../server/common/curlCffiFetch';
(async () => {
  // 1. current recipe one-shot (is IP still blocked?)
  const url = 'https://blinkit.com/v1/layout/search?q=milk&search_type=type_to_search';
  const r = await cffiFetch(url, { impersonate: 'chrome', method: 'POST', body: '{}', timeoutMs: 20000, headers: { app_client: 'consumer_web', lat: '19.076', lon: '72.8777', Accept: 'application/json', 'Content-Type': 'application/json', Origin: 'https://blinkit.com', Referer: 'https://blinkit.com/s/?q=milk' } });
  console.log('[web recipe]', r.status, (r.body || '').slice(0, 120).replace(/\n/g, ' '));
  // 2. Kong gateway route probes
  const routes = ['/', '/v1/layout/search', '/v1/search', '/v1/stores', '/v1/anonymous-device-token', '/v1/auth', '/health', '/v1/home', '/v1/landing', '/v1/serviceability', '/v1/addresses', '/v1/products'];
  for (const p of routes) {
    const rr = await cffiFetch('https://api.blinkit.com' + p, { impersonate: 'chrome', timeoutMs: 12000, headers: { Accept: 'application/json', app_client: 'consumer_web', lat: '19.076', lon: '72.8777' } });
    const b = (rr.body || '').slice(0, 90).replace(/\n/g, ' ');
    console.log('[kong GET]', p, '->', rr.status, b);
  }
  process.exit(0);
})();
