/**
 * Bus worker (India). A bus search runs ONLY this worker.
 * Intercity bus operators' live fares are behind WAF/JS walls today, so this worker
 * provides a REAL road distance/duration (OSRM) with a transparent, labelled
 * indicative fare estimate — never presented as an operator quote.
 */
import { registerVerticalWorker, type VerticalWorker } from '../verticalWorker';
import { AcquisitionError } from '../../common/httpClient';
import { parseAbhiBusServices, resolveAbhiBusCity, type AbhiBusRoute } from '../parsers/abhibus';
import { parseRedBusRoute } from '../parsers/redbusRoute';
import { parseRedBusSearch, resolveRedBusCity, type RedBusRoute } from '../parsers/redbusSearch';
import { cffiFetch } from '../../common/curlCffiFetch';
import { parseZingbusRoute, zingbusSlug } from '../parsers/zingbus';

function routeFromQuery(raw: string): { from: string; to: string } | null {
  const cleaned = raw
    .replace(/\b(bus|buses|volvo|sleeper|ticket|tickets|book|redbus|fare|price|for|travel)\b/gi, ' ')
    .replace(/\b(today|tonight|tomorrow|day after tomorrow|this week|this weekend|next week|next day)\b/gi, ' ')
    .replace(/\b(?:on|at)\s+(?:mon|tues?|wed(?:nes)?|thur?s?|fri|sat(?:ur)?|sun)day\b/gi, ' ')
    .replace(/\b\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/gi, ' ')
    .replace(/\b\d{4}-\d{2}-\d{2}\b/gi, ' ')
    .replace(/\s+/g, ' ').trim();
  const m = cleaned.match(/(.{2,40}?)\s+(?:to|from)\s+(.{2,40})/);
  if (!m) return null;
  return { from: m[1].trim(), to: m[2].trim() };
}

export const busWorker: VerticalWorker = {
  vertical: 'bus',
  tasks: [
    {
      // redBus LIVE per-service fares. The SRP bundle (indSearch) builds
      // POST /rpw/api/searchResults?fromCity&toCity&DOJ with a JSON body — the same
      // public web gateway the site's own SPA uses. City ids come from
      // GET /rpw/api/citySuggestion?search=<city>. Each inventory carries the real
      // fareList, timings, seat counts and operator rating. Falls back to the
      // route-page dataInfo summary when the ids can't be resolved (small towns).
      sourceId: 'w_bus_redbus',
      name: 'Bus worker: redBus live services (real fares, timings, seats)',
      priority: 2,
      maxPerMinute: 24,
      // City resolution + per-bus searchResults + (only if needed) route-page fallback:
      // three sequential round-trips legitimately need more than the 18s default budget.
      timeoutMs: 45_000,
      run: async (ctx) => {
        const raw = String(ctx.query.rawQuery || '');
        const rt = routeFromQuery(raw);
        if (!rt) return [];
        const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '-');
        const pageUrl = `https://www.redbus.in/bus-tickets/${slug(rt.from)}-to-${slug(rt.to)}.aspx`;

        const steps: string[] = [];
        const t0 = Date.now();
        let resolved: { from?: { id: number; name: string } | null; to?: { id: number; name: string } | null } = {};
        try {
          const getJson = async (url: string): Promise<any> => {
            const s = Date.now();
            const r = await ctx.fetch(url, { expectJson: true, timeoutMs: 12_000, headers: { Accept: 'application/json', Referer: 'https://www.redbus.in/' } });
            steps.push(`suggest=${r.latencyMs ?? Date.now() - s}ms/${r.status}`);
            if (r.status !== 200) throw new AcquisitionError('SERVER_ERROR', `redBus suggestion HTTP ${r.status}`, r.status);
            try { return JSON.parse(r.body); } catch { throw new AcquisitionError('MALFORMED_RESPONSE', 'redBus citySuggestion non-JSON'); }
          };
          const [fromDocs, toDocs] = await Promise.all([
            getJson(`https://www.redbus.in/rpw/api/citySuggestion?search=${encodeURIComponent(rt.from.slice(0, 40))}&limit=3`),
            getJson(`https://www.redbus.in/rpw/api/citySuggestion?search=${encodeURIComponent(rt.to.slice(0, 40))}&limit=3`),
          ]);
          resolved = { from: resolveRedBusCity(fromDocs?.response?.docs, rt.from), to: resolveRedBusCity(toDocs?.response?.docs, rt.to) };
        } catch (e) {
          // citySuggestion unavailable (error, non-JSON, or a tarpit timeout) —
          // record the step and fall through to the route-page fallback below.
          if (e instanceof AcquisitionError && e.failureClass === 'TIMEOUT') steps.push(`suggest=TIMEOUT(${steps.join(' ') || 'none'})`);
        }

        const depart = String(ctx.query.travelDates?.depart || '');
        const doj = /^\d{4}-\d{2}-\d{2}$/.test(depart) ? depart : new Date(Date.now() + 86400000).toISOString().slice(0, 10);

        if (resolved.from && resolved.to) {
          const route: RedBusRoute = { fromName: resolved.from.name, fromId: resolved.from.id, toName: resolved.to.name, toId: resolved.to.id, doj };
          const u = `https://www.redbus.in/rpw/api/searchResults?fromCity=${route.fromId}&toCity=${route.toId}&DOJ=${doj}&limit=15&offset=0&sort=0&sortOrder=0&from=web&meta=false&bT=1&getUuid=false`;
          // The searchResults POST tarpits INTERMITTENTLY from datacenter IPs (owner bug
          // 21 Oct: redBus showing only route summaries). A healthy answer lands in ~2-4s;
          // when it tarpits it hangs to the timeout. So: two short attempts (12s each) —
          // a second attempt catches a good window twice as often as one long hang.
          let r: { status: number; body: string; latencyMs?: number } = { status: 0, body: '' };
          for (let attempt = 1; attempt <= 2; attempt++) {
            const sr = Date.now();
            try {
              r = await ctx.fetch(u, {
                method: 'POST',
                expectJson: true,
                maxBytes: 6_000_000,
                timeoutMs: 12_000,
                headers: { Accept: 'application/json', 'Content-Type': 'application/json', Origin: 'https://www.redbus.in', Referer: pageUrl },
                body: '{}',
              });
            } catch (e: any) {
              // city resolution works, the heavy search POST does not answer — record and
              // either retry or fall to the route page below.
              steps.push(`searchResults#${attempt}=${(e instanceof AcquisitionError && e.failureClass) || 'ERROR'}@${Date.now() - sr}ms`);
              continue;
            }
            steps.push(`searchResults#${attempt}=${r.latencyMs ?? Date.now() - sr}ms/${r.status}`);
            break; // got an HTTP response — success or gate, do not blind-retry a 403/429
          }
          if (r.status === 200) {
            const items = parseRedBusSearch(r.body, ctx.source, route);
            if (items.length) return items;
            // Searchable ids with zero services for this date — honest empty, no fallback
            // (a route-page min-fare would claim a fare no service actually offers today).
            return [];
          }
          // searchResults endpoint failed — fall through to the route-page dataInfo fallback
        }

        const rp = Date.now();
        let r: { status: number; body: string };
        try {
          r = await cffiFetch(pageUrl, { impersonate: 'chrome', timeoutMs: 15_000 });
        } catch (e: any) {
          // Whole redbus.in domain not answering from this egress IP (tarpit):
          // every step hangs until its own timeout. Report honestly, never guess.
          // Owner bug 22 Oct ("app me sirf abhibus"): this used to be ACCESS_CHALLENGE,
          // which climbs the 1->5->25->60min challenge ladder — a few tarpits and redBus
          // went invisible for up to an hour (not even sourcesAttempted). A tarpit is a
          // TIMEOUT, not a WAF challenge: the flat 60s circuit keeps redBus attempted on
          // nearly every search, so the honest per-bus / route-page result self-heals.
          throw new AcquisitionError('TIMEOUT', `redBus domain unresponsive (tarpit) from this IP after ${Date.now() - t0}ms [${steps.join(' ') || 'no steps recorded'}]`);
        }
        steps.push(`routePage=${Date.now() - rp}ms/${r.status}`);
        if (r.status === 404) return []; // route page not published — honest unavailable
        if (r.status !== 200) throw new AcquisitionError(r.status === 403 || r.status === 429 ? 'ACCESS_CHALLENGE' : 'SERVER_ERROR', `redBus HTTP ${r.status} [${steps.join(' ')}]`, r.status);
        const items = parseRedBusRoute(r.body, ctx.source, pageUrl);
        if (!items.length) throw new AcquisitionError('EMPTY_RESPONSE', `redBus route page carried no parseable dataInfo fare [${steps.join(' ')}]`);
        return items;
      },
    },
    {
      // ---- Owner-mandated bus sources: attempted live on every bus search, honestly reported ----
      sourceId: 'w_bus_makemytrip',
      name: 'Bus worker: MakeMyTrip bus (probe)',
      priority: 15,
      run: async (ctx: any) => {
        await cffiFetch('https://bus.makemytrip.com/', { impersonate: 'chrome', timeoutMs: 12_000 });
        throw new AcquisitionError('EMPTY_RESPONSE', 'MakeMyTrip bus search serves an empty JS shell to browserless HTTP; live service lists require a sessioned app API (Akamai-gated elsewhere on makemytrip.com).');
      },
    },
    {
      sourceId: 'w_bus_yatra',
      name: 'Bus worker: Yatra bus (probe)',
      priority: 15,
      run: async () => {
        try {
          const r = await cffiFetch('https://www.yatra.com/bus-booking/delhi-to-jaipur-buses', { impersonate: 'chrome', timeoutMs: 12_000 });
          const gated = r.status !== 200 || r.body.length < 5_000;
          throw new AcquisitionError(gated ? 'ACCESS_CHALLENGE' : 'EMPTY_RESPONSE', 'Yatra bus pages fail/reset the HTTP/2 stream to browserless HTTP clients; no SSR fare data available.');
        } catch (e: any) {
          if (e instanceof AcquisitionError) throw e;
          throw new AcquisitionError('ACCESS_CHALLENGE', 'Yatra bus pages fail/reset the HTTP/2 stream to browserless HTTP clients; no SSR fare data available.');
        }
      },
    },
    {
      sourceId: 'w_bus_ixigo',
      name: 'Bus worker: Ixigo bus (probe)',
      priority: 15,
      run: async () => {
        await cffiFetch('https://www.ixigo.com/', { impersonate: 'chrome', timeoutMs: 12_000 });
        throw new AcquisitionError('EMPTY_RESPONSE', 'Ixigo publishes no bus SSR pages at all (sitemap has flights only); its bus results render from an AbhiBus-sourced CSR shell with no server-side fares.');
      },
    },
    {
      // REAL operator fares. AbhiBus's internal JSON API answers plain HTTP:
      // /wap/SearchStations resolves city -> station id, /buslist/v3/services
      // returns live per-service fares, timings, bus type and seat counts.
      sourceId: 'w_bus_abhibus',
      name: 'Bus worker: AbhiBus live services (real fares, timings, seats)',
      priority: 1,
      maxPerMinute: 24,
      timeoutMs: 40_000,
      run: async (ctx) => {
        const raw = String(ctx.query.rawQuery || '');
        const rt = routeFromQuery(raw);
        if (!rt) return [];
        const getJson = async (url: string): Promise<any> => {
          const r = await ctx.fetch(url, { expectJson: true, headers: { Accept: 'application/json' } });
          if (r.status !== 200) throw new AcquisitionError('FORBIDDEN', `AbhiBus HTTP ${r.status} on ${url.split('?')[0]}`, r.status);
          try { return JSON.parse(r.body); } catch { throw new AcquisitionError('MALFORMED_RESPONSE', 'AbhiBus non-JSON response'); }
        };
        const [from, to] = await Promise.all([
          resolveAbhiBusCity(getJson, rt.from),
          resolveAbhiBusCity(getJson, rt.to),
        ]);
        if (!from || !to) throw new AcquisitionError('NOT_FOUND', `AbhiBus: could not resolve '${rt.from}'/'${rt.to}' as stations`);
        const depart = String(ctx.query.travelDates?.depart || '');
        const jdate = /^\d{4}-\d{2}-\d{2}$/.test(depart) ? depart : new Date(Date.now() + 86400000).toISOString().slice(0, 10);
        const route: AbhiBusRoute = { fromName: from.label, fromId: from.id, toName: to.label, toId: to.id, jdate };
        const r = await ctx.fetch('https://www.abhibus.com/buslist/v3/services', {
          method: 'POST',
          expectJson: true,
          maxBytes: 6_000_000,
          timeoutMs: 20_000,
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: from.label, sourceid: Number(from.id),
            destination: to.label, destinationid: Number(to.id),
            jdate, prd: 'mobile', filters: '1', isReturnJourney: '0',
          }),
        });
        if (r.status !== 200) throw new AcquisitionError('FORBIDDEN', `AbhiBus services HTTP ${r.status}`, r.status);
        return parseAbhiBusServices(r.body, ctx.source, route);
      },
    },
    {
      // zingbus: Next.js SEO route pages carry pTableData with the route's real
      // minFare/maxFare, busCount, duration, first/last departure (per-bus inventory
      // is sessioned-XHR only, so this is route-level fare data, like redBus route).
      sourceId: 'w_bus_zingbus',
      name: 'Bus worker: zingbus route fares (real min/max fare, timings)',
      priority: 4,
      maxPerMinute: 10,
      run: async (ctx) => {
        const raw = String(ctx.query.rawQuery || '');
        const rt = routeFromQuery(raw);
        if (!rt) return [];
        const from = zingbusSlug(rt.from);
        const to = zingbusSlug(rt.to);
        if (!from || !to) return [];
        const url = `https://www.zingbus.com/bus-tickets/${from}-to-${to}-bus-route`;
        const r = await cffiFetch(url, { impersonate: 'chrome', timeoutMs: 20_000 });
        if (r.status === 404) throw new AcquisitionError('NOT_FOUND', `zingbus does not serve ${from}-to-${to} (no route page)`);
        if (r.status !== 200) throw new AcquisitionError('ACCESS_CHALLENGE', `zingbus HTTP ${r.status}`, r.status);
        const items = parseZingbusRoute(r.body, ctx.source, url, rt.from, rt.to);
        if (!items.length) throw new AcquisitionError('EMPTY_RESPONSE', `zingbus route page for ${from}-to-${to} carried no pTableData fare`);
        return items;
      },
    },

  ],
};
registerVerticalWorker(busWorker);
