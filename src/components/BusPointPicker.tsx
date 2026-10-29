/**
 * Bus boarding / dropping point picker (owner 29 Oct, reference screenshots).
 *
 * Flow the owner asked for, on web and app:
 *   city typed -> that city's points listed ("All boarding points" for the origin,
 *   "All dropping points" for the destination) -> pick one -> search for exactly that point.
 *
 * Data is redBus's own point registry (server: /api/bus/stops, cached 24h) which is the same
 * list the redBus app shows: Indore returns 20 points starting Vijay Nagar, Teen Imli Square,
 * AICTSL Campus, Sarwate Bus Stand, Navlakha, Rajendra Nagar, Chhotigwaltoli — matching the
 * owner's screenshot order exactly.
 *
 * No invented points and no fake filtering: the chosen point is written back as
 * "<point>, <city>", which the search pipeline resolves to that AREA location id on the
 * platform, so the results really are for the point the user picked.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, X, Building2, Bus, Clock, Search } from 'lucide-react';

export interface BusPoint {
  id: number | null;
  name: string;
  fullName: string;
  city: string;
}

interface BusPointPickerProps {
  open: boolean;
  city: string;
  kind: 'boarding' | 'dropping';
  onClose: () => void;
  onSelect: (point: BusPoint) => void;
}

const RECENT_KEY = 'try1.busPoints.recent';
const LAST_ROUTE_KEY = 'try1.busLastRoute';

function readRecent(): BusPoint[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((p) => p && p.name) .slice(0, 6) : [];
  } catch { return []; }
}

function pushRecent(point: BusPoint) {
  try {
    const list = readRecent().filter((p) => !(p.name === point.name && p.city === point.city));
    localStorage.setItem(RECENT_KEY, JSON.stringify([point, ...list].slice(0, 8)));
  } catch { /* storage may be blocked; the picker still works */ }
}

function readLastRoute(): { from?: string; to?: string } {
  try { return JSON.parse(localStorage.getItem(LAST_ROUTE_KEY) || '{}') || {}; } catch { return {}; }
}

export default function BusPointPicker({ open, city, kind, onClose, onSelect }: BusPointPickerProps) {
  const [query, setQuery] = useState('');
  const [points, setPoints] = useState<BusPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const cityName = String(city || '').replace(/\(.*?\)/g, '').split(',')[0].trim();
  const label = kind === 'boarding' ? 'All boarding points' : 'All dropping points';

  useEffect(() => {
    if (!open) return;
    setQuery(cityName);
    setError(null);
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, [open, cityName]);

  useEffect(() => {
    if (!open || cityName.length < 2) { setPoints([]); return; }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/bus/stops?city=${encodeURIComponent(cityName)}&kind=${kind}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const list: BusPoint[] = Array.isArray(d?.points) ? d.points : [];
        setPoints(list);
        setError(list.length ? null : (d?.error || `No ${kind} points listed for ${cityName} yet`));
      })
      .catch(() => { if (!cancelled) { setPoints([]); setError('Could not load points for this city'); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, cityName, kind]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Keep the city word itself from filtering everything out: typing "indore" shows all.
    if (!q || q === cityName.toLowerCase()) return points;
    return points.filter((p) => p.fullName.toLowerCase().includes(q) || p.name.toLowerCase().includes(q));
  }, [points, query, cityName]);

  const recent = useMemo(() => (open ? readRecent() : []), [open]);
  const lastRoute = useMemo(() => (open ? readLastRoute() : {}), [open]);

  if (!open) return null;

  const choose = (point: BusPoint) => {
    pushRecent(point);
    onSelect(point);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-start sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header: back arrow + search field + clear (screenshot 1 & 2) */}
        <div className="flex items-center gap-2 px-3 py-3 border-b border-slate-200 bg-[#f6f6f6]">
          <button type="button" onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-200" aria-label="Back">
            <ArrowLeft className="w-5 h-5 text-slate-800" />
          </button>
          <div className="flex-1 flex items-center gap-2 bg-[#f2f2f2] rounded-full px-3 py-2">
            <Search className="w-4 h-4 text-slate-500" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none"
              placeholder={kind === 'boarding' ? 'Boarding city' : 'Dropping city'}
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="Clear">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* City row: building icon + city + "All ... points" */}
          <div className="flex items-center gap-3 px-4 py-3">
            <Building2 className="w-5 h-5 text-slate-800" />
            <div>
              <p className="text-sm font-bold text-slate-900">{cityName || city}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          </div>

          {loading && <p className="px-4 pb-3 text-xs text-slate-500">Loading {kind} points…</p>}
          {!loading && error && <p className="px-4 pb-3 text-xs text-slate-500">{error}</p>}

          {/* Point rows: bus icon with the connecting line, name + city underneath */}
          <ul className="pb-2">
            {filtered.map((p, i) => (
              <li key={`${p.name}-${i}`} className="relative">
                <button
                  type="button"
                  onClick={() => choose(p)}
                  className="w-full flex items-start gap-3 pl-4 pr-4 py-3 text-left hover:bg-slate-50 active:bg-slate-100"
                >
                  <span className="relative flex flex-col items-center self-stretch pt-0.5">
                    <Bus className="w-4 h-4 text-slate-600" />
                    {i < filtered.length - 1 && <span className="w-px flex-1 bg-slate-300 mt-1" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-900 truncate">{p.name}</span>
                    <span className="block text-xs text-slate-500 truncate">{p.city}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {recent.length > 0 && (
            <div className="border-t border-slate-200 px-4 py-3">
              <p className="text-xs font-bold text-slate-700 mb-2">Recent searches</p>
              <ul className="space-y-2">
                {recent.map((p, i) => (
                  <li key={`r-${p.name}-${i}`}>
                    <button type="button" onClick={() => choose(p)} className="w-full flex items-center gap-2 text-left">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <span className="text-xs text-slate-600 truncate">
                        {kind === 'boarding'
                          ? `${p.name}, ${p.city}${lastRoute.to ? ` - ${lastRoute.to}` : ''}`
                          : `${lastRoute.from ? `${lastRoute.from} - ` : ''}${p.name}, ${p.city}`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Popular destinations footer (screenshot 2) — only when we really know the pair */}
          {kind === 'boarding' && lastRoute.to && (
            <div className="border-t border-slate-200 px-4 py-3">
              <p className="text-xs font-bold text-slate-700 mb-2">Popular destinations from {cityName}</p>
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-800">{lastRoute.to}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
