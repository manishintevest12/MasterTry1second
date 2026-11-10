import { rescueFetch } from '../server/sources/rescueFetch';

const sites: [string, string][] = [
  ['akasa', 'https://www.akasaair.com/'],
  ['indigo', 'https://www.goindigo.in/'],
];

for (const [name, home] of sites) {
  const h = await rescueFetch(home, { timeoutMs: 15000, minHtmlBytes: 2000, maxRungs: 3 });
  const html = h.body;
  const scripts = Array.from(html.matchAll(/<script[^>]+src="([^"]+\.js[^"]*)"/g)).map((m) => m[1])
    .filter((u) => !/gtm|analytics|hotjar|clarity|facebook/.test(u));
  const abs = scripts.map((u) => (u.startsWith('http') ? u : new URL(u, home).toString()));
  const hostTokens = Array.from(html.matchAll(/https?:\/\/[a-z0-9.-]*(?:api|graphql|booking)[a-z0-9.-]*/gi)).map((m) => m[0]);
  console.log(`\n## ${name} scripts=${abs.length} apiHosts=${Array.from(new Set(hostTokens)).slice(0,4).join(',')}`);
  const hits = new Set<string>();
  for (const js of abs.slice(0, 8)) {
    const r = await rescueFetch(js, { timeoutMs: 15000, minHtmlBytes: 500, maxRungs: 2 });
    const body = r.body;
    for (const m of body.matchAll(/["'`](\/?[a-z0-9][a-z0-9\-_/.]{2,60}(?:availability|lowestfare|lowest-fare|fare|flightsearch|flight-search|searchflights)[a-z0-9\-_/.]{0,40})["'`]/gi)) {
      const s = m[1];
      if (!/^(node_modules|\.\/|\.\.)/.test(s) && s.length < 90) hits.add(s.toLowerCase());
    }
    for (const m of body.matchAll(/https?:\/\/[a-z0-9.-]*(?:api|graphql)[a-z0-9.-]*\/[a-z0-9\-_/.]{2,60}/gi)) hits.add(m[0]);
    if (hits.size > 24) break;
  }
  Array.from(hits).slice(0, 24).forEach((s) => console.log('   ', s));
}
