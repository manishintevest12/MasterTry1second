import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { brandDomain } from '../utils/brandLogo';
import { CheckCircle2, CircleSlash, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

/** Human names for worker source ids ("w_flights_emt" -> "EaseMyTrip"). Unknown ids are title-cased, never hidden. */
const SOURCE_LABELS: Record<string, string> = {
  ixigo: 'Ixigo', emt: 'EaseMyTrip', openflights: 'OpenFlights schedules', makemytrip: 'MakeMyTrip', mmt: 'MakeMyTrip',
  yatra: 'Yatra', cleartrip: 'Cleartrip', akasa: 'Akasa Air', indigo: 'IndiGo', goibibo: 'Goibibo', booking: 'Booking.com',
  agoda: 'Agoda', airbnb: 'Airbnb', osm: 'OpenStreetMap', wikidata: 'Wikidata', abhibus: 'AbhiBus', redbus: 'redBus',
  osrm: 'Distance estimate', osrm_estimate: 'Distance estimate', affiliate_vcommission: 'VCommission offers', structured_books: 'Books catalogue', savaari: 'Savaari', quickride: 'QuickRide', ola: 'Ola', uber: 'Uber', indrive: 'InDrive',
  meru: 'Meru', fastdeals: 'Fastdeals / Snap-E', amazon_in: 'Amazon.in', flipkart: 'Flipkart', myntra: 'Myntra', ajio: 'Ajio',
  meesho: 'Meesho', tatacliq: 'Tata CLiQ', blinkit: 'Blinkit', zepto: 'Zepto', instamart: 'Swiggy Instamart',
  bigbasket: 'BigBasket', flipkart_minutes: 'Flipkart Minutes', swiggy: 'Swiggy', zomato: 'Zomato', dominos: "Domino's",
  eatsure: 'EatSure', ovenstory: 'Oven Story', bookmyshow: 'BookMyShow', ticketnew: 'TicketNew', cinepolis: 'Cinepolis',
  district: 'District', paisabazaar: 'Paisabazaar', bankbazaar: 'BankBazaar', policybazaar: 'Policybazaar', moneyview: 'Money View',
  kreditbee: 'KreditBee', navi: 'Navi', bajajfinserv: 'Bajaj Finserv', hdfc: 'HDFC Bank', hdfcergo: 'HDFC Ergo', acko: 'Acko',
  digit: 'Digit', insurancedekho: 'InsuranceDekho', ditto: 'Ditto', coverfox: 'Coverfox', vcommission: 'VCommission',
};
export function sourceLabel(sourceId: string): string {
  const key = sourceId.replace(/^w_[a-z]+?_/, '').replace(/^w_/, '');
  if (SOURCE_LABELS[key]) return SOURCE_LABELS[key];
  return key.split('_').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
}
const REASON: Record<string, string> = {
  ACCESS_CHALLENGE: 'Blocked by the site\'s bot protection',
  FORBIDDEN: 'Blocked by the site',
  EMPTY_RESPONSE: 'Site returned no usable prices',
  SERVER_ERROR: 'Site did not respond',
  TIMEOUT: 'Site timed out',
};

export default function SourcesPanel({ vertical }: { vertical: string }) {
  const { sourcesReport, isScrapingLive } = useApp();
  const [open, setOpen] = useState(true);
  const key = vertical === 'movie' ? 'movies' : vertical;
  const rep = sourcesReport[key];
  if (!rep) return isScrapingLive ? (
    <div className="mx-2 mt-2 text-[11px] text-slate-500 animate-pulse">Asking each website for live prices…</div>
  ) : null;

  const ids = Array.from(new Set(rep.attempted.length ? rep.attempted : [...rep.succeeded, ...rep.failed.map((f) => f.sourceId)]))
    // Movies: Wikidata is an open-data reference feed, not a ticket seller — owner asked
    // to keep it out of the movies seller list (its film rows still work in results).
    .filter((id) => !(key === 'movies' && /wikidata/i.test(id)));
  const failed = new Map(rep.failed.map((f) => [f.sourceId, f]));
  const rows = ids.map((id) => {
    const f = failed.get(id);
    const ok = rep.succeeded.includes(id);
    return { id, name: sourceLabel(id), ok, reason: f ? (REASON[f.failureClass || ''] || 'Unavailable') : ok ? '' : 'No result for this search', detail: f?.error };
  }).sort((a, b) => Number(b.ok) - Number(a.ok));
  const live = rows.filter((r) => r.ok).length;

  return (
    <div className="mx-2 mt-2 rounded-xl border border-slate-200 bg-white" data-testid="sources-panel">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-3 py-2 text-left">
        <span className="text-[12px] font-bold text-slate-800">
          Compared across {rows.length} websites <span className="font-medium text-slate-500">· {live} gave live prices · for "{rep.query}"</span>
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {open && (
        <ul className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {rows.map((r) => {
            const dom = brandDomain(r.name);
            return (
              <li key={r.id} title={r.detail || ''} className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-[11px] ${r.ok ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-slate-50'}`}>
                {dom ? <img src={`https://www.google.com/s2/favicons?domain=${dom}&sz=64`} alt="" className="w-4 h-4 rounded-sm" referrerPolicy="no-referrer" onError={(e) => ((e.currentTarget.style.display = 'none'))} /> : <span className="w-4 h-4 rounded-sm bg-slate-200" />}
                <span className="font-semibold text-slate-800 truncate">{r.name}</span>
                <span className="ml-auto flex items-center gap-1 shrink-0">
                  {r.ok ? <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /><span className="text-emerald-700 font-semibold">Live</span></>
                    : r.detail ? <><AlertTriangle className="w-3.5 h-3.5 text-amber-600" /><span className="text-slate-600">{r.reason}</span></>
                    : <><CircleSlash className="w-3.5 h-3.5 text-slate-400" /><span className="text-slate-500">{r.reason}</span></>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
