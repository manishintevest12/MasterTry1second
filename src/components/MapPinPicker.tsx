/**
 * MapPinPicker (owner request 17 Oct): Uber-style drag-and-drop map pin for the
 * Cab & Ride vertical — the user drops a pin anywhere on a live map and the exact
 * point becomes the pickup (or drop). Leaflet + OpenStreetMap tiles (open data,
 * no API keys); address text comes from the backend's Nominatim proxy
 * (/api/geo/search, /api/geo/reverse) which enforces the usage policy (UA,
 * 1 req/s throttle, 24h cache). If Nominatim has no name for a spot we still
 * keep the exact coordinates — we never invent an address.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, MapPin, Navigation, Search, X } from 'lucide-react';

export interface PickedSpot {
  lat: number;
  lng: number;
  address: string;
  locality: string;
  city: string;
  pincode?: string;
}

interface MapPinPickerProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'pickup' | 'drop';
  onApply: (spot: PickedSpot) => void;
  /** Where to center the map first (e.g. the user's current location). */
  initial?: { lat: number; lng: number };
  /** Fallback center label for the first geocode (e.g. the user's city). */
  initialLabel?: string;
}

const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function pinIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:30px;height:30px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.5))">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="1.4">
        <path d="M12 22s-7.5-7.1-7.5-12.2A7.5 7.5 0 0 1 12 2.3a7.5 7.5 0 0 1 7.5 7.5C19.5 14.9 12 22 12 22Z"/>
        <circle cx="12" cy="9.6" r="2.6" fill="white" stroke="none"/>
      </svg></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 28],
  });
}

export const MapPinPicker: React.FC<MapPinPickerProps> = ({
  isOpen, onClose, mode, onApply, initial, initialLabel,
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const revTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [spot, setSpot] = useState<PickedSpot | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<PickedSpot[]>([]);
  const [searching, setSearching] = useState(false);
  const [geolocating, setGeolocating] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState('');

  const isPickup = mode === 'pickup';
  const accent = isPickup ? '#10b981' : '#e11d48';

  // Move the marker + resolve the address (debounced).
  const setPinAt = useCallback((lat: number, lng: number) => {
    if (!mapRef.current) return;
    if (!markerRef.current) {
      markerRef.current = L.marker([lat, lng], { draggable: true, icon: pinIcon(accent) }).addTo(mapRef.current);
      markerRef.current.on('dragend', () => {
        const p = markerRef.current!.getLatLng();
        setPinAt(p.lat, p.lng);
      });
    } else {
      markerRef.current.setLatLng([lat, lng]);
    }
    setSpot((prev) => ({ lat, lng, address: prev?.address || '', locality: prev?.locality || '', city: prev?.city || '', pincode: prev?.pincode }));
    if (revTimer.current) clearTimeout(revTimer.current);
    revTimer.current = setTimeout(async () => {
      setResolving(true);
      try {
        const r = await fetch(`/api/geo/reverse?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}`);
        const data = await r.json();
        const place = data?.place;
        if (place) {
          setSpot({ lat, lng, address: place.address, locality: place.locality, city: place.city, pincode: place.pincode });
        } else {
          // Coordinates are exact even when the map has no street name for them.
          setSpot({ lat, lng, address: `${lat.toFixed(5)}, ${lng.toFixed(5)} (unnamed spot)`, locality: '', city: '', pincode: undefined });
        }
      } catch {
        setSpot({ lat, lng, address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, locality: '', city: '', pincode: undefined });
      } finally {
        setResolving(false);
      }
    }, 450);
  }, [accent]);

  // Init / destroy the map with the modal.
  useEffect(() => {
    if (!isOpen || !containerRef.current || mapRef.current) return;
    const start: [number, number] = initial?.lat && initial?.lng
      ? [initial.lat, initial.lng]
      : [28.6139, 77.209]; // Delhi default
    const map = L.map(containerRef.current, { zoomControl: true, attributionControl: true }).setView(start, 15);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: OSM_ATTR }).addTo(map);
    map.on('click', (e: L.LeafletMouseEvent) => setPinAt(e.latlng.lat, e.latlng.lng));
    mapRef.current = map;
    setPinAt(start[0], start[1]);
    // No initial pin yet? Try to center on the user's city via the geo proxy (once).
    if (!initial?.lat && initialLabel) {
      fetch(`/api/geo/search?q=${encodeURIComponent(initialLabel)}&limit=1`)
        .then((r) => r.json())
        .then((data) => {
          const hit = data?.results?.[0];
          if (hit && mapRef.current && !markerRef.current) {
            mapRef.current.setView([hit.lat, hit.lng], 15);
            setPinAt(hit.lat, hit.lng);
          }
        })
        .catch(() => undefined);
    }
    return () => {
      if (revTimer.current) clearTimeout(revTimer.current);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const runSearch = async () => {
    const q = searchQ.trim();
    if (q.length < 2) return;
    setSearching(true);
    setSearchResults([]);
    setError('');
    try {
      const r = await fetch(`/api/geo/search?q=${encodeURIComponent(q)}`);
      const data = await r.json();
      setSearchResults(data?.results || []);
      if (!data?.results?.length) setError('No matching place found in India. Try a nearby landmark.');
    } catch {
      setError('Place search unavailable right now.');
    } finally {
      setSearching(false);
    }
  };

  const useGps = () => {
    if (!navigator.geolocation) { setError('GPS not available in this browser.'); return; }
    setGeolocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (mapRef.current) mapRef.current.setView([pos.coords.latitude, pos.coords.longitude], 17);
        setPinAt(pos.coords.latitude, pos.coords.longitude);
        setGeolocating(false);
      },
      () => { setGeolocating(false); setError('GPS unavailable — drag the pin instead.'); },
      { enableHighAccuracy: true, timeout: 8_000 },
    );
  };

  const jumpTo = (p: { lat: number; lng: number }) => {
    if (mapRef.current) mapRef.current.setView([p.lat, p.lng], 17);
    setPinAt(p.lat, p.lng);
    setSearchResults([]);
  };

  const apply = () => {
    if (!spot) return;
    onApply(spot);
    onClose();
  };

  if (!isOpen) return null;

  const placeLabel = spot
    ? (spot.address || `${spot.lat.toFixed(5)}, ${spot.lng.toFixed(5)}`)
    : 'Drag or tap to place the pin';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-900 w-full sm:max-w-3xl rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: accent }} />
            <div>
              <p className="font-bold text-sm text-slate-900 dark:text-white">
                {isPickup ? 'Pin your exact pickup point' : 'Pin your exact drop point'}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Tap the map or drag the pin to the exact spot</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 cursor-pointer" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search + GPS */}
        <div className="px-4 pt-3 flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); runSearch(); } }}
              placeholder="Search a place, landmark or hotspot…"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/40"
            />
          </div>
          <button
            onClick={useGps}
            disabled={geolocating}
            title="Use my current location"
            className="px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 text-xs font-bold cursor-pointer disabled:opacity-50"
          >
            <Crosshair className={`w-4 h-4 ${geolocating ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">GPS</span>
          </button>
        </div>

        {/* Search results */}
        {(searching || searchResults.length > 0 || error) && (
          <div className="px-4 pt-2">
            {searching && <p className="text-xs text-slate-400 py-1.5">Searching places…</p>}
            <div className="max-h-32 overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
              {searchResults.map((r, i) => (
                <button
                  key={i}
                  onClick={() => jumpTo(r)}
                  className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 cursor-pointer flex items-start gap-2"
                >
                  <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-red-500" />
                  <span className="line-clamp-2">{r.address}</span>
                </button>
              ))}
            </div>
            {error && !searching && <p className="text-xs text-amber-500 py-1.5">{error}</p>}
          </div>
        )}

        {/* Map */}
        <div ref={containerRef} className="w-full h-[46vh] min-h-[280px] bg-slate-200 dark:bg-slate-800 z-0" />

        {/* Footer: selected place + apply */}
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex items-center gap-3 bg-slate-50 dark:bg-slate-900">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1">
              <Navigation className="w-3 h-3" /> {isPickup ? 'Pickup point' : 'Drop point'}
              {resolving && <span className="normal-case font-normal">· naming address…</span>}
            </p>
            <p className="text-xs font-semibold text-slate-900 dark:text-white truncate" title={placeLabel}>{placeLabel}</p>
            {spot?.pincode && <p className="text-[10px] text-slate-400">Pincode {spot.pincode}{spot.city ? ` · ${spot.city}` : ''}</p>}
          </div>
          <button
            onClick={apply}
            disabled={!spot}
            className="px-5 py-2.5 rounded-xl font-black text-xs text-white cursor-pointer disabled:opacity-50 shadow-md"
            style={{ background: accent }}
          >
            {isPickup ? 'Set pickup' : 'Set drop'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MapPinPicker;
