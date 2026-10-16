import React, { useState, useMemo } from 'react';
import {
  Snowflake, BedDouble, Armchair, Star, ShieldCheck, LocateFixed, Clock, MapPin, ChevronDown, X,
} from 'lucide-react';

/**
 * Bus filter chips + boarding-point picker (owner reference UI, 16 Oct).
 * Every facet is computed from REAL offer attributes persisted by the bus
 * parsers (ac/sleeper/seater/premium/free cancellation/live tracking/mTicket/
 * boarding point) — a chip with zero matches is simply not offered, and counts
 * always reflect the live result set, never invented numbers.
 */

interface BusItem { specs?: Record<string, string>; [k: string]: any }

/** One predicate per facet id — used both for counting and filtering. */
export function busFacetPred(chipId: string, it: BusItem): boolean {
  const specs = it.specs || {};
  const dep = String(specs['departure time'] || specs['departure'] || '');
  const hm = dep.match(/^(\d{1,2}):(\d{2})/);
  const hour = hm ? Number(hm[1]) : NaN;
  switch (chipId) {
    case 'ac': return specs['ac'] === 'yes';
    case 'nonac': return specs['ac'] === 'no';
    case 'sleeper': return specs['sleeper'] === 'yes';
    case 'seater': return specs['seater'] === 'yes';
    case 'premium': return specs['premium'] === 'yes';
    case 'free_cancellation': return specs['free cancellation'] === 'yes';
    case 'live_tracking': return specs['live tracking'] === 'yes';
    case 'mticket': return specs['mticket'] === 'yes';
    case 'direct_bus': return specs['direct bus'] === 'yes';
    case 'slot_00_06': return Number.isFinite(hour) && hour >= 0 && hour < 6;
    case 'slot_06_12': return Number.isFinite(hour) && hour >= 6 && hour < 12;
    case 'slot_12_18': return Number.isFinite(hour) && hour >= 12 && hour < 18;
    case 'slot_18_24': return Number.isFinite(hour) && hour >= 18 && hour < 24;
    default: return false;
  }
}

const CHIP_DEFS: { id: string; label: string; icon: React.ReactNode }[] = [
  { id: 'premium', label: 'Primo Bus', icon: <Star className="w-3.5 h-3.5" /> },
  { id: 'free_cancellation', label: 'Free Cancellation', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
  { id: 'ac', label: 'AC', icon: <Snowflake className="w-3.5 h-3.5" /> },
  { id: 'sleeper', label: 'SLEEPER', icon: <BedDouble className="w-3.5 h-3.5" /> },
  { id: 'seater', label: 'SEATER', icon: <Armchair className="w-3.5 h-3.5" /> },
  { id: 'nonac', label: 'NONAC', icon: <Snowflake className="w-3.5 h-3.5 line-through opacity-60" /> },
  { id: 'live_tracking', label: 'Live Tracking', icon: <LocateFixed className="w-3.5 h-3.5" /> },
  { id: 'mticket', label: 'm-Ticket', icon: <Clock className="w-3.5 h-3.5" /> },
  { id: 'direct_bus', label: 'Direct Bus', icon: <MapPin className="w-3.5 h-3.5" /> },
  { id: 'slot_18_24', label: '18:00-24:00', icon: <Clock className="w-3.5 h-3.5" /> },
  { id: 'slot_12_18', label: '12:00-18:00', icon: <Clock className="w-3.5 h-3.5" /> },
  { id: 'slot_06_12', label: '06:00-12:00', icon: <Clock className="w-3.5 h-3.5" /> },
  { id: 'slot_00_06', label: '00:00-06:00', icon: <Clock className="w-3.5 h-3.5" /> },
];

interface BusFiltersBarProps {
  baseItems: BusItem[];               // result set AFTER smart filter, BEFORE chips
  activeChips: string[];
  onToggleChip: (id: string) => void;
  boardingPoint: string | null;
  onSelectBoardingPoint: (bp: string | null) => void;
  cityLabel?: string;
}

export const BusFiltersBar: React.FC<BusFiltersBarProps> = ({
  baseItems, activeChips, onToggleChip, boardingPoint, onSelectBoardingPoint, cityLabel,
}) => {
  const [bpOpen, setBpOpen] = useState(false);

  // facet counts over the live set — a chip with 0 matches is hidden (honest)
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const def of CHIP_DEFS) c[def.id] = 0;
    for (const it of baseItems) {
      for (const def of CHIP_DEFS) if (busFacetPred(def.id, it)) c[def.id]++;
    }
    return c;
  }, [baseItems]);

  // popular boarding points (with per-point service counts) from the live set
  const boardingPoints = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of baseItems) {
      const bp = String(it.specs?.['boarding point'] || '').trim();
      if (bp) m.set(bp, (m.get(bp) || 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [baseItems]);

  const visibleChips = CHIP_DEFS.filter((d) => counts[d.id] > 0);
  if (!visibleChips.length && !boardingPoints.length) return null;

  return (
    <div className="relative">
      {/* filter chips — stacked flex like the reference UI */}
      <div className="flex flex-wrap gap-2">
        {visibleChips.map((def) => {
          const active = activeChips.includes(def.id);
          return (
            <button
              key={def.id}
              type="button"
              onClick={() => onToggleChip(def.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                active
                  ? 'bg-[#d84e55] text-white border-[#d84e55] shadow-sm'
                  : 'bg-white text-slate-900 border-slate-300 hover:border-[#d84e55] hover:text-[#d84e55]'
              }`}
            >
              {def.icon}
              <span>{def.label} ({counts[def.id]})</span>
            </button>
          );
        })}

        {/* boarding points dropdown trigger */}
        {boardingPoints.length > 0 && (
          <button
            type="button"
            onClick={() => setBpOpen((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
              boardingPoint
                ? 'bg-[#d84e55] text-white border-[#d84e55] shadow-sm'
                : 'bg-white text-slate-900 border-slate-300 hover:border-[#d84e55] hover:text-[#d84e55]'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>{boardingPoint ? `Board at ${boardingPoint}` : 'Boarding Points'}</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${bpOpen ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {/* Popular Boarding Points dropdown card (reference UI: bold point, city below, "Board at" pill) */}
      {bpOpen && boardingPoints.length > 0 && (
        <div className="absolute left-0 right-0 sm:right-auto sm:min-w-[340px] z-40 mt-1.5 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#d84e55]" />
              Popular Boarding Points{cityLabel ? ` near ${cityLabel}` : ' near you'}
            </span>
            <button type="button" onClick={() => setBpOpen(false)} className="p-0.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {boardingPoint && (
            <button
              type="button"
              onClick={() => { onSelectBoardingPoint(null); setBpOpen(false); }}
              className="w-full px-4 py-2 text-left text-xs font-bold text-[#d84e55] bg-red-50/60 hover:bg-red-50 border-b border-slate-100 cursor-pointer"
            >
              Clear boarding point filter
            </button>
          )}
          <div className="divide-y divide-slate-100">
            {boardingPoints.map(([bp, n]) => (
              <button
                key={bp}
                type="button"
                onClick={() => { onSelectBoardingPoint(bp === boardingPoint ? null : bp); setBpOpen(false); }}
                className={`w-full px-4 py-2.5 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                  bp === boardingPoint ? 'bg-red-50/80' : 'hover:bg-slate-50'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs font-black text-slate-900 truncate">{bp}</div>
                  <div className="text-[10px] text-slate-500">{n} service{n > 1 ? 's' : ''} board here</div>
                </div>
                <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                  bp === boardingPoint
                    ? 'bg-[#d84e55] text-white'
                    : 'bg-slate-100 text-slate-500'
                }`}>
                  {bp === boardingPoint ? 'Boarding here' : 'Board at'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
