import React from 'react';
import { ArrowRight, Clock, Heart, ExternalLink, ChevronDown } from 'lucide-react';
import type { ComparisonItem } from '../types';
import type { OfferGroup } from '../utils/offerGroups';
import { useApp } from '../context/AppContext';
import { brandLogoUrl, initials } from '../utils/brandLogo';

/** Skyscanner-style compact deal row for flights, bus and cab: carrier logo, times, duration, stops, price + Book. */

const spec = (item: ComparisonItem, ...keys: string[]): string | undefined => {
  for (const k of keys) {
    const v = item.specs?.[k] ?? item.specs?.[k.toLowerCase()];
    if (v && String(v).trim() && String(v) !== 'undefined') return String(v);
  }
  return undefined;
};

const fmtMins = (m?: string) => {
  const n = Number(m);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return `${Math.floor(n / 60)}h ${String(n % 60).padStart(2, '0')}m`;
};

const hhmm = (v?: string) => {
  if (!v) return undefined;
  const m = String(v).match(/(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : String(v);
};

export const TravelDealRow: React.FC<{ item?: ComparisonItem; group?: OfferGroup }> = ({ item: itemProp, group }) => {
  const { trackedItemIds, toggleTrackPrice, startRedirection } = useApp();
  // Grouped mode: the card shows the flight/bus/cab once, priced by its cheapest site; the arrow
  // reveals every other website's price for the SAME trip (cheapest first).
  const item = (group ? group.best.item : itemProp) as ComparisonItem;
  const [open, setOpen] = React.useState(false);
  const tracked = trackedItemIds.includes(item.id);
  const quote = item.sellerQuotes.find((q) => q.isLowest) || item.sellerQuotes[0];
  const extraRows = group && group.rows.length > 1 ? group.rows : [];
  const [logoOk, setLogoOk] = React.useState(true);
  const logo = brandLogoUrl(item);

  // Times
  let dep = hhmm(spec(item, 'departure time', 'departure'));
  let arr = hhmm(spec(item, 'arrival time', 'arrival'));
  const range = spec(item, 'departure');
  if (range && range.includes('→')) {
    const [a, b] = range.split('→');
    dep = hhmm(a); arr = hhmm(b);
  }
  const duration = fmtMins(spec(item, 'duration minutes')) || spec(item, 'duration');
  const stopsRaw = spec(item, 'stops');
  const stops = stopsRaw !== undefined && stopsRaw !== '' ? (Number(stopsRaw) === 0 ? 'Direct' : `${stopsRaw} stop${Number(stopsRaw) > 1 ? 's' : ''}`) : undefined;
  const flightNo = spec(item, 'flight number');
  const route = spec(item, 'Route', 'route') || '';
  const [from, to] = route.split(/\s*(?:→|to)\s*/i);
  const date = spec(item, 'Date', 'travel date', 'departure date');
  const busType = item.vertical === 'bus' ? spec(item, 'seat type', 'bus type') || item.features?.[0] : undefined;
  const seats = spec(item, 'seats available');
  const operator = spec(item, 'operator') || item.provider;
  const carrier = item.vertical === 'flights' ? item.provider : operator;
  const hasTimes = !!(dep && arr);
  const priceNote = item.vertical === 'cab' ? 'estimated fare' : item.vertical === 'bus' ? 'per seat, from' : 'per adult, from';
  const appOnlyFares = spec(item, 'price basis', 'price_basis') === 'app_only_fares';

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs hover:shadow-md hover:border-slate-300 transition-all overflow-hidden">
    <div className="flex flex-col sm:flex-row">
      {/* LEFT: carrier + journey */}
      <div className="flex-1 p-4 sm:p-5 min-w-0">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl border border-slate-200 bg-white flex items-center justify-center shrink-0 overflow-hidden">
            {logo && logoOk ? (
              <img src={logo} alt={`${carrier} logo`} className="w-8 h-8 object-contain" loading="lazy" referrerPolicy="no-referrer" onError={() => setLogoOk(false)} />
            ) : (
              <span className="text-xs font-black text-slate-600">{initials(carrier)}</span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">{carrier}</p>
            <p className="text-[11px] text-slate-500 truncate">
              {[flightNo, busType, date].filter(Boolean).join(' · ') || item.subtitle}
            </p>
          </div>
          {(item as any).freshnessStatus === 'LIVE_VERIFIED' && (
            <span className="ml-auto hidden sm:inline-flex text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">Live</span>
          )}
        </div>

        {hasTimes ? (
          <div className="mt-4 grid grid-cols-[auto_1fr_auto] items-center gap-3">
            <div>
              <p className="text-xl font-black text-slate-900 leading-none font-mono">{dep}</p>
              <p className="text-[11px] text-slate-500 mt-1 truncate max-w-[110px]">{from}</p>
            </div>
            <div className="flex flex-col items-center min-w-0">
              <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3" />{duration || '—'}</span>
              <div className="w-full flex items-center gap-1 my-0.5"><span className="h-px flex-1 bg-slate-300" /><ArrowRight className="w-3.5 h-3.5 text-slate-400" /></div>
              <span className={`text-[11px] font-bold ${stops === 'Direct' ? 'text-emerald-600' : 'text-slate-500'}`}>{stops || (seats ? `${seats} seats left` : '')}</span>
            </div>
            <div className="text-right">
              <p className="text-xl font-black text-slate-900 leading-none font-mono">{arr}</p>
              <p className="text-[11px] text-slate-500 mt-1 truncate max-w-[110px] ml-auto">{to}</p>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-700 font-semibold">
            <span className="truncate">{from || item.title}</span>
            {to && <><ArrowRight className="w-4 h-4 text-slate-400 shrink-0" /><span className="truncate">{to}</span></>}
            {duration && <span className="ml-auto text-[11px] text-slate-500 font-medium flex items-center gap-1"><Clock className="w-3 h-3" />{duration}</span>}
          </div>
        )}

        {/* Provenance note ("Fare acquired via ...") intentionally NOT rendered
            on cards per owner request 15 Oct; the data_note itself stays stored
            on the backend row for honesty/audit. */}
      </div>

      {/* RIGHT: price + Book (like Skyscanner's "Choose a deal") */}
      <div className="sm:w-52 shrink-0 border-t sm:border-t-0 sm:border-l border-slate-100 bg-slate-50/60 p-4 sm:p-5 flex sm:flex-col items-center sm:items-stretch justify-between gap-3">
        <div className="sm:text-right">
          {item.priceAvailable ? (
            <>
              <p className="text-2xl font-black text-slate-900 leading-none">₹{(item.primaryPrice || 0).toLocaleString('en-IN')}</p>
              <p className="text-[10px] text-slate-500 mt-1">{priceNote}</p>
            </>
          ) : appOnlyFares ? (
            <p className="text-sm font-bold text-slate-500">Fare on app</p>
          ) : (
            <p className="text-sm font-bold text-slate-500">Price unavailable</p>
          )}
        </div>
        <div className="flex items-center gap-2 sm:flex-col sm:items-stretch">
          <button
            type="button"
            disabled={!quote}
            onClick={() => quote && startRedirection(item, quote)}
            className="px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-sm font-black flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/20 cursor-pointer disabled:opacity-50"
          >
            <span>Book</span><ExternalLink className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => toggleTrackPrice(item.id)}
            title={tracked ? 'Stop tracking price' : 'Track price drops'}
            className={`p-2 rounded-xl border cursor-pointer sm:self-end ${tracked ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-white border-slate-200 text-slate-400 hover:text-slate-700'}`}
          >
            <Heart className={`w-4 h-4 ${tracked ? 'fill-rose-500' : ''}`} />
          </button>
        </div>
        {quote && <p className="hidden sm:block text-[10px] text-slate-400 text-right truncate">on {quote.sourceDomain || quote.sellerName}</p>}
      </div>
    </div>

    {extraRows.length > 1 && (
      <>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 sm:px-5 py-2.5 border-t border-slate-100 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
        >
          <span>Compare {extraRows.length} websites{group?.highest && group.highest > group.best.price ? ` · save up to ₹${(group.highest - group.best.price).toLocaleString('en-IN')}` : ''}</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="border-t border-slate-100 divide-y divide-slate-100">
            {extraRows.map((r, i) => {
              const q = r.item.sellerQuotes.find((x) => x.isLowest) || r.item.sellerQuotes[0];
              return (
                <div key={r.item.id + i} className="flex items-center gap-3 px-4 sm:px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-800 truncate">{r.site}</p>
                    {i === 0 && r.priceAvailable && <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">Lowest price</span>}
                  </div>
                  <p className={`text-base font-black ${i === 0 && r.priceAvailable ? 'text-emerald-700' : 'text-slate-900'}`}>
                    {r.priceAvailable ? `₹${r.price.toLocaleString('en-IN')}` : 'Price on site'}
                  </p>
                  <button
                    type="button"
                    disabled={!q}
                    onClick={() => q && startRedirection(r.item, q)}
                    className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-black flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <span>Book</span><ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </>
    )}
    </div>
  );
};
