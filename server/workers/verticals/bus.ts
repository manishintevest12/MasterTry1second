/**
 * Bus worker (India). A bus search runs ONLY this worker.
 * Intercity bus operators' live fares are behind WAF/JS walls today, so this worker
 * provides a REAL road distance/duration (OSRM) with a transparent, labelled
 * indicative fare estimate — never presented as an operator quote.
 */
import { registerVerticalWorker, type VerticalWorker } from '../verticalWorker';
import { AcquisitionError } from '../../common/httpClient';
import { parseAbhiBusServices, resolveAbhiBusCity, type AbhiBusRoute } from '../parsers/abhibus';
import type { RawSourceItem } from '../../types';
import { parseRedBusRoute } from '../parsers/redbusRoute';
import { parseRedBusSearch, resolveRedBusCity, type RedBusRoute } from '../parsers/redbusSearch';
import { cffiFetch } from '../../common/curlCffiFetch';
import { parseZingbusRoute, zingbusSlug } from '../parsers/zingbus';
import { ixigoRoutePath, parseIxigoBusPage } from '../parsers/ixigoBuses';

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
            // Owner 24 Oct (redbus "kabhi aata hai kabhi ni" permanent fix): ALL
            // redBus calls now ride curl_cffi with Chrome impersonation. The old
            // path used ctx.fetch, whose undici TLS/JA3 fingerprint redBus's edge
            // tarpits intermittently — the POST especially (httpAcquire only uses
            // cffi for GET). The same request through Chrome TLS lands in 2-4s.
            const r = await cffiFetch(url, { impersonate: 'chrome', timeoutMs: 10_000, headers: { Accept: 'application/json', Referer: 'https://www.redbus.in/' } });
            steps.push(`suggest=${Date.now() - s}ms/${r.status}`);
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

        // Route-page dataInfo fetch as a REUSABLE promise (owner bug 22 Oct: DEADLINE_CUT —
        // on Hostinger the searchResults POST tarpits 2x12s and the sequential route-page
        // fetch afterwards ran past the 42s search budget, so redBus never answered at all).
        // It now runs IN PARALLEL with the POST: kicked off 4s after the search attempts
        // start (a healthy answer lands in 2-4s, so the fast path costs nothing extra),
        // and awaited only when the POST fails. Same honesty rules as before: 404 = no
        // route page, never a fabricated fare.
        let routeP: Promise<RawSourceItem[]> | null = null;
        const fetchRoutePage = async (): Promise<RawSourceItem[]> => {
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
        };
        const startRoutePage = () => {
          // Attach a no-op catch the moment it starts so a rejection while the POST
          // attempts are still running can never become an unhandled promise error;
          // awaiting routeP later still re-throws the original error honestly.
          if (routeP) return;
          const p = fetchRoutePage();
          p.catch(() => {});
          routeP = p;
        };

        if (resolved.from && resolved.to) {
          const route: RedBusRoute = { fromName: resolved.from.name, fromId: resolved.from.id, toName: resolved.to.name, toId: resolved.to.id, doj };
          const u = `https://www.redbus.in/rpw/api/searchResults?fromCity=${route.fromId}&toCity=${route.toId}&DOJ=${doj}&limit=15&offset=0&sort=0&sortOrder=0&from=web&meta=false&bT=1&getUuid=false`;
          // The searchResults POST tarpits INTERMITTENTLY from datacenter IPs (owner bug
          // 21 Oct: redBus showing only route summaries). A healthy answer lands in ~2-4s;
          // when it tarpits it hangs to the timeout. So: two short attempts (12s each) —
          // a second attempt catches a good window twice as often as one long hang.
          // Route-page warm-up runs from t+4s in parallel (see fetchRoutePage above).
          const warmup = setTimeout(startRoutePage, 3_000);
          let r: { status: number; body: string; latencyMs?: number } = { status: 0, body: '' };
          // THREE cffi attempts (owner 24 Oct permanence fix): a healthy answer
          // lands in 2-4s; a tarpit window can outlast two. 3 x 9s attempts with
          // 800ms gaps catch a good window half again as often, still inside the
          // 42s search deadline (suggest + 3 attempts ~= 38s worst case). The
          // old undici-transport POST stays as a last-resort attempt when the
          // cffi bridge itself is unavailable (python missing on the host).
          for (let attempt = 1; attempt <= 3; attempt++) {
            const sr = Date.now();
            const attemptHeaders = { Accept: 'application/json', 'Content-Type': 'application/json', Origin: 'https://www.redbus.in', Referer: pageUrl };
            try {
              const cr = await cffiFetch(u, { impersonate: 'chrome', method: 'POST', body: '{}', timeoutMs: 9_000, headers: attemptHeaders });
              r = { status: cr.status, body: cr.body, latencyMs: Date.now() - sr };
              steps.push(`searchResults#${attempt}=cffi${Date.now() - sr}ms/${cr.status}`);
              if (r.status === 200) break; // got the payload
              if (r.status === 403 || r.status === 429) break; // gate, do not blind-retry
            } catch (e: any) {
              steps.push(`searchResults#${attempt}=cffi${(e instanceof AcquisitionError && e.failureClass) || 'ERROR'}@${Date.now() - sr}ms`);
            }
            if (attempt === 3) {
              // cffi could not answer at all (bridge down): one honest undici
              // attempt so redBus is never silently skipped on such hosts.
              const sr2 = Date.now();
              try {
                r = await ctx.fetch(u, {
                  method: 'POST',
                  expectJson: true,
                  maxBytes: 6_000_000,
                  timeoutMs: 9_000,
                  headers: attemptHeaders,
                  body: '{}',
                });
                steps.push(`searchResults#fallback=${r.latencyMs ?? Date.now() - sr2}ms/${r.status}`);
              } catch (e: any) {
                steps.push(`searchResults#fallback=${(e instanceof AcquisitionError && e.failureClass) || 'ERROR'}@${Date.now() - sr2}ms`);
              }
            }
            await new Promise((z) => setTimeout(z, 800));
          }
          clearTimeout(warmup);
          if (r.status === 200) {
            const items = parseRedBusSearch(r.body, ctx.source, route);
            // Per-bus rows answered in time: the parallel route-page promise (if the
            // warm-up fired) already has its own no-op catch (see startRoutePage),
            // so it can never become an unhandled promise error.
            if (items.length) return items;
            // Searchable ids with zero services for this date — honest empty, no fallback
            // (a route-page min-fare would claim a fare no service actually offers today).
            return [];
          }
          // searchResults endpoint failed/tarpitted — the route-page fallback is already
          // in flight (started at t+4s); await it instead of restarting it sequentially.
          startRoutePage();
          return await routeP!;
        }

        // City resolution failed — the route page is the only honest source left.
        startRoutePage();
        return await routeP!;
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
      // Ixigo LIVE per-service fares (owner 28 Oct: "inko add kro aur price le kr bhi aao inke").
      // Browserless recon found what the old probe missed: /buses/<from>-<to>-sts is a
      // server-rendered route page whose React flight payload embeds the real service list
      // (operator, bus type, fare in rupees, start/arrive time, duration, rating) for the
      // page's journeyDate. No session, no API key, no CSR shell.
      // Honesty: rows are returned only for the route block that belongs to this route, and
      // only when its journeyDate is the date the user asked for; otherwise the source
      // reports why it contributed nothing instead of relabelling another date's fares.
      sourceId: 'w_bus_ixigo',
      name: 'Bus worker: Ixigo live services (real fares, operator, timings)',
      priority: 3,
      maxPerMinute: 20,
      timeoutMs: 30_000,
      run: async (ctx) => {
        const rt = routeFromQuery(String(ctx.query.rawQuery || ''));
        if (!rt) return [];
        const pageUrl = `https://www.ixigo.com${ixigoRoutePath(rt.from, rt.to)}`;
        const r = await cffiFetch(pageUrl, { impersonate: 'chrome', timeoutMs: 18_000 });
        if (r.status === 404) {
          throw new AcquisitionError('NOT_FOUND', `Ixigo has no route page for ${rt.from} to ${rt.to}`, 404);
        }
        if (r.status !== 200) {
          throw new AcquisitionError(r.status === 403 || r.status === 429 ? 'ACCESS_CHALLENGE' : 'SERVER_ERROR', `Ixigo route page HTTP ${r.status} for ${rt.from} to ${rt.to}`, r.status);
        }
        const depart = String(ctx.query.travelDates?.depart || '');
        const parsed = parseIxigoBusPage(r.body, ctx.source, pageUrl, rt.from, rt.to, depart);
        if (parsed.items.length) return parsed.items;
        throw new AcquisitionError('EMPTY_RESPONSE', `Ixigo: ${parsed.reason || 'no services published for this route'}`);
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
          // Owner 24 Oct (AbhiBus "kabhi aata hai kabhi ni" permanence fix): all
          // AbhiBus calls ride curl_cffi Chrome TLS. httpAcquire uses cffi for GET
          // only, so the /buslist/v3/services POST went out with the undici
          // fingerprint AbhiBus's edge throttles intermittently — same root cause
          // the redBus POST had (fixed earlier today).
          const r = await cffiFetch(url, { impersonate: 'chrome', timeoutMs: 10_000, headers: { Accept: 'application/json', Referer: 'https://www.abhibus.com/' } });
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
        const payload = JSON.stringify({
          source: from.label, sourceid: Number(from.id),
          destination: to.label, destinationid: Number(to.id),
          jdate, prd: 'mobile', filters: '1', isReturnJourney: '0',
        });
        const headers = { Accept: 'application/json', 'Content-Type': 'application/json', Origin: 'https://www.abhibus.com', Referer: 'https://www.abhibus.com/' };
        // THREE cffi attempts (same tarpit-window strategy as redBus, owner 24
        // Oct): a healthy answer lands in 2-4s; 3 x 9s + 800ms gaps catch a good
        // window where the old single 20s undici POST hung. undici stays only as
        // the honest bridge-down fallback (python missing on the host).
        let r: { status: number; body: string } = { status: 0, body: '' };
        const steps: string[] = [];
        for (let attempt = 1; attempt <= 3; attempt++) {
          const sr = Date.now();
          try {
            const cr = await cffiFetch('https://www.abhibus.com/buslist/v3/services', {
              impersonate: 'chrome', method: 'POST', body: payload, timeoutMs: 9_000, headers,
            });
            steps.push(`services#${attempt}=cffi${Date.now() - sr}ms/${cr.status}`);
            r = { status: cr.status, body: cr.body };
            if (r.status === 200) break; // payload in hand
            if (r.status === 403 || r.status === 429) break; // gate, do not blind-retry
          } catch (e: any) {
            steps.push(`services#${attempt}=cffi${(e instanceof AcquisitionError && e.failureClass) || 'ERROR'}@${Date.now() - sr}ms`);
          }
          if (attempt === 3) {
            // cffi unavailable (bridge down): one honest undici attempt so
            // AbhiBus is never silently skipped on such hosts.
            const sr2 = Date.now();
            try {
              const fr = await ctx.fetch('https://www.abhibus.com/buslist/v3/services', {
                method: 'POST', expectJson: true, maxBytes: 6_000_000, timeoutMs: 9_000,
                headers, body: payload,
              });
              r = { status: fr.status, body: fr.body };
              steps.push(`services#fallback=${fr.latencyMs ?? Date.now() - sr2}ms/${fr.status}`);
            } catch (e: any) {
              steps.push(`services#fallback=${(e instanceof AcquisitionError && e.failureClass) || 'ERROR'}@${Date.now() - sr2}ms`);
            }
          }
          await new Promise((z) => setTimeout(z, 800));
        }
        if (r.status !== 200) throw new AcquisitionError('FORBIDDEN', `AbhiBus services HTTP ${r.status || 'no-response'} [${steps.join(' ')}]`, r.status || undefined);
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
