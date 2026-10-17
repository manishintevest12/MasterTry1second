import React, { useEffect, useRef, useState } from 'react';
import { MapPin, X, ChevronDown, Navigation } from 'lucide-react';

/**
 * Food vertical address input (owner request 17 Oct, Zomato-style reference):
 * an editable white location pill over the food bar with a live address suggestion
 * dropdown — "Use my current location" header row (GPS), "SEARCH RESULT" section
 * header, place rows (pin icon + bold name + grey address) and a "Show More"
 * expander footer. Suggestions come from the open geo proxy (GET /api/geo/search →
 * Nominatim, India-bounded, 1 req/s throttle + 24h cache). No invented places.
 * Selecting a place reverse-geocodes it (/api/geo/reverse) so the pincode/city
 * context stays honest, then hands it to onPicked (same shape as the map picker).
 */

export interface FoodAddressPick {
  lat: number;
  lng: number;
  address: string;
  locality: string;
  city: string;
  pincode?: string;
}

interface GeoSuggestion {
  name: string;
  address: string;
  label: string;
  lat: number;
  lng: number;
}

interface FoodLocationHintProps {
  value: string;
  onChange: (v: string) => void;
  onPicked: (spot: FoodAddressPick) => void;
  onUseGps: () => void;
  gpsBusy?: boolean;
  placeholder?: string;
  className?: string;
}

const SHOW_COUNT = 6;

export const FoodLocationHint: React.FC<FoodLocationHintProps> = ({
  value, onChange, onPicked, onUseGps, gpsBusy = false,
  placeholder = 'Search delivery address...', className = '',
}) => {
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [active, setActive] = useState(-1);
  const [resolving, setResolving] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const seqRef = useRef(0);

  // Debounced typeahead (250ms) against the geo proxy.
  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) { setSuggestions([]); setLoading(false); return; }
    const seq = ++seqRef.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/geo/search?q=${encodeURIComponent(q)}`);
        const j = await r.json();
        if (seq !== seqRef.current) return;
        const rows: GeoSuggestion[] = (j.results || []).map((p: any) => {
          const label = String(p.label || '');
          const comma = label.indexOf(',');
          return { name: comma > 0 ? label.slice(0, comma) : label, address: comma > 0 ? label.slice(comma + 1).trim() : '', label, lat: p.lat, lng: p.lng };
        });
        setSuggestions(rows);
        setExpanded(false);
        setActive(rows.length ? 0 : -1);
        setOpen(true);
      } catch { /* hints are best-effort; typing still works */ }
      finally { if (seq === seqRef.current) setLoading(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [value]);

  // Outside click closes the card.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const choose = async (s: GeoSuggestion) => {
    setOpen(false);
    onChange(s.name);
    // Reverse-geocode the picked point so pincode/city stay real (never guessed).
    setResolving(true);
    try {
      const r = await fetch(`/api/geo/reverse?lat=${s.lat.toFixed(6)}&lng=${s.lng.toFixed(6)}`);
      const d = await r.json();
      const place = d?.place || {};
      onPicked({
        lat: s.lat, lng: s.lng,
        address: place.address || s.label,
        locality: place.locality || s.name,
        city: place.city || '',
        pincode: place.pincode,
      });
    } catch {
      onPicked({ lat: s.lat, lng: s.lng, address: s.label, locality: s.name, city: '', pincode: undefined });
    } finally { setResolving(false); }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || !suggestions.length) return;
    const rows = expanded ? suggestions : suggestions.slice(0, SHOW_COUNT);
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, rows.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && active >= 0 && rows[active]) { e.preventDefault(); void choose(rows[active]); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  const visible = expanded ? suggestions : suggestions.slice(0, SHOW_COUNT);
  const hasMore = suggestions.length > SHOW_COUNT;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <div className="flex items-center bg-white rounded-2xl px-4 py-3.5 shadow-md hover:shadow-lg transition-all text-left">
        <MapPin className="w-5 h-5 text-[#fc8019] fill-[#fc8019] shrink-0" />
        <div className="flex-1 min-w-0 mx-2.5">
          <input
            type="text"
            value={resolving ? 'Detecting pincode…' : value}
            placeholder={placeholder}
            disabled={resolving}
            onChange={(e) => { onChange(e.target.value); setActive(-1); }}
            onFocus={() => { if (suggestions.length) setOpen(true); }}
            onKeyDown={onKeyDown}
            className="w-full bg-transparent focus:outline-hidden text-sm font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal"
          />
        </div>
        {loading && <span className="w-3.5 h-3.5 border-2 border-slate-300 border-t-[#fc8019] rounded-full animate-spin mr-2 shrink-0" />}
        {value && !resolving && (
          <button type="button" title="Clear" onClick={() => { onChange(''); setSuggestions([]); setOpen(false); }} className="p-1 text-slate-400 hover:text-slate-700 shrink-0 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        )}
        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-slate-900">
          <div className="max-h-80 overflow-y-auto">
            {/* Header action row — exact GPS, one tap */}
            <button
              type="button"
              disabled={gpsBusy}
              onClick={() => { onUseGps(); setOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 cursor-pointer disabled:opacity-60"
            >
              <Navigation className={`w-4 h-4 text-[#fc8019] shrink-0 ${gpsBusy ? 'animate-pulse' : ''}`} />
              <span className="text-sm font-bold text-[#fc8019]">Use my current location</span>
            </button>
            <div className="border-t border-slate-100" />
            <p className="px-4 pt-2.5 pb-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase">Search result</p>
            {visible.map((s, i) => (
              <button
                type="button" key={`${s.label}-${i}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => void choose(s)}
                className={`w-full flex items-start gap-3 px-4 py-2.5 text-left cursor-pointer ${i === active ? 'bg-slate-50' : 'bg-white'}`}
              >
                <span className="w-7 h-7 rounded-full bg-orange-50 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-[#fc8019]" />
                </span>
                <span className="min-w-0">
                  <span className="block font-bold text-sm truncate">{s.name}</span>
                  {s.address && <span className="block text-xs text-slate-500 line-clamp-2">{s.address}</span>}
                </span>
              </button>
            ))}
            {hasMore && (
              <button
                type="button"
                onClick={() => setExpanded((x) => !x)}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-left border-t border-slate-100 cursor-pointer hover:bg-slate-50"
              >
                <span className="text-sm font-bold text-[#fc8019]">{expanded ? 'Show Less' : 'Show More'}</span>
                <ChevronDown className={`w-4 h-4 text-[#fc8019] transition-transform ${expanded ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
        </div>
      )}
      {open && !loading && suggestions.length === 0 && value.trim().length >= 2 && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white rounded-2xl shadow-2xl border border-slate-200 px-4 py-3 text-xs text-slate-500 text-left">
          <span className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5" /> No matching address found — try a nearby landmark or city.</span>
        </div>
      )}
    </div>
  );
};
