import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, Search, X, Navigation } from 'lucide-react';

/**
 * Uber-style location hint input (owner request 17 Oct): editable pickup/drop field with a
 * live suggestion dropdown — pin icon, bold place name, grey address line, hover highlight,
 * clear (X) button and a "Search in a different city" footer row that keeps the raw text.
 * Suggestions come from the open geo proxy (GET /api/geo/search → Nominatim, India-bounded,
 * 1 req/s server-side throttle + 24h cache). No invented places, ever.
 */

interface GeoSuggestion {
  name: string; // bold first line ("New Market")
  address: string; // grey second line ("STT Nagar, TT Nagar, Bhopal, Madhya Pradesh, India")
  label: string; // full display name
  lat: number;
  lng: number;
  street?: string; // colony/street-level parts (owner 24 Oct)
  colony?: string;
  city?: string;
  pincode?: string;
}

interface LocationHintInputProps {
  value: string;
  onChange: (val: string) => void;
  onSelect: (short: string, full: GeoSuggestion) => void;
  placeholder?: string;
  label: string;
  mode?: 'pickup' | 'drop';
  onEnter?: () => void;
  inputClassName?: string;
  className?: string;
  /** Extra buttons rendered inside the field row, right of the clear X. */
  rightExtra?: React.ReactNode;
  /** User coordinates: biases the colony/street typeahead near the user. */
  coords?: { lat: number; lng: number } | null;
}

export const LocationHintInput: React.FC<LocationHintInputProps> = ({
  value, onChange, onSelect, placeholder, label, mode = 'drop', onEnter,
  inputClassName = '', className = '', rightExtra, coords = null,
}) => {
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1); // highlighted row for keyboard nav
  const rootRef = useRef<HTMLDivElement>(null);
  const seqRef = useRef(0);

  // Debounced typeahead (250ms) — the geo proxy already throttles Nominatim to 1 req/s.
  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) { setSuggestions([]); setLoading(false); return; }
    const seq = ++seqRef.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        // Owner 24 Oct: colony/street typeahead (/api/geo/suggest, Photon/OSM).
        const bias = coords ? `&lat=${coords.lat.toFixed(5)}&lng=${coords.lng.toFixed(5)}` : '';
        const r = await fetch(`/api/geo/suggest?q=${encodeURIComponent(q)}${bias}`);
        const j = await r.json();
        if (seq !== seqRef.current) return; // a newer keystroke won the race
        const rows: GeoSuggestion[] = (j.results || []).map((p: any) => ({
          name: String(p.name || ''),
          address: String(p.address || ''),
          label: [p.name, p.address].filter(Boolean).join(', '),
          lat: p.lat, lng: p.lng,
          street: p.street, colony: p.colony, city: p.city, pincode: p.pincode,
        }));
        setSuggestions(rows);
        setActive(rows.length ? 0 : -1);
        setOpen(true);
      } catch { /* geo hints are best-effort; typing still works */ }
      finally { if (seq === seqRef.current) setLoading(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [value]);

  // Close on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const choose = useCallback((s: GeoSuggestion | null) => {
    if (s) onSelect(s.name, s);
    else onChange(value); // "Search in a different city" — keep raw typed text
    setOpen(false);
    setSuggestions([]);
  }, [onSelect, onChange, value]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || !suggestions.length) { if (e.key === 'Enter') onEnter?.(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, suggestions.length)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, -1)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      choose(active >= 0 && active < suggestions.length ? suggestions[active] : null);
      if (active < 0 || active >= suggestions.length) onEnter?.();
    } else if (e.key === 'Escape') { setOpen(false); }
  };

  const rows = useMemo(() => suggestions.slice(0, 6), [suggestions]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <div className="flex items-center bg-slate-800 rounded-xl px-3 py-1.5 text-xs border border-slate-700 focus-within:border-red-400/60 transition-colors">
        {mode === 'pickup'
          ? <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 mr-2.5 shrink-0" />
          : <span className="w-2.5 h-2.5 rounded-full bg-red-500 mr-2.5 shrink-0" />}
        <div className="flex-1 min-w-0">
          <span className="text-[9px] text-slate-400 uppercase font-bold block mb-0.5">{label}</span>
          <input
            type="text"
            value={value}
            placeholder={placeholder}
            onChange={(e) => { onChange(e.target.value); setActive(-1); }}
            onFocus={() => { if (rows.length) setOpen(true); }}
            onKeyDown={onKeyDown}
            className={`w-full bg-transparent focus:outline-hidden font-bold text-white placeholder:text-slate-500 ${inputClassName}`}
          />
        </div>
        {loading && <span className="w-3 h-3 border-2 border-slate-500 border-t-red-400 rounded-full animate-spin ml-2 shrink-0" />}
        {value && (
          <button
            type="button" title="Clear"
            onClick={() => { onChange(''); setSuggestions([]); setOpen(false); }}
            className="p-1 text-slate-400 hover:text-white shrink-0 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        {rightExtra}
      </div>

      {open && rows.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white rounded-b-xl shadow-2xl border border-slate-200 overflow-hidden text-slate-900">
          <div className="max-h-72 overflow-y-auto">
            {rows.map((s, i) => (
              <button
                type="button" key={`${s.label}-${i}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(s)}
                className={`w-full flex items-start gap-3 px-3 py-2.5 text-left cursor-pointer ${i === active ? 'bg-slate-100' : 'bg-white'}`}
              >
                <span className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-700" />
                </span>
                <span className="min-w-0">
                  <span className="block font-bold text-sm truncate">{s.name}</span>
                  {s.address && <span className="block text-xs text-slate-500 truncate">{s.address}</span>}
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => choose(null)}
              onMouseEnter={() => setActive(-1)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left border-t border-slate-200 cursor-pointer ${active === -1 ? 'bg-slate-100' : 'bg-white'}`}
            >
              <span className="w-7 h-7 rounded-full bg-slate-900 flex items-center justify-center shrink-0">
                <Search className="w-3.5 h-3.5 text-white" />
              </span>
              <span className="text-sm font-bold">Search in a different city</span>
            </button>
          </div>
        </div>
      )}
      {open && !loading && rows.length === 0 && value.trim().length >= 2 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white rounded-b-xl shadow-2xl border border-slate-200 px-3 py-2.5 text-xs text-slate-500 text-left">
          <span className="flex items-center gap-2"><Navigation className="w-3.5 h-3.5" /> No matching place found — try a nearby landmark or city.</span>
        </div>
      )}
    </div>
  );
};
