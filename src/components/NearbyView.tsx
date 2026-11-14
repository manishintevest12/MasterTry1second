import { useCallback, useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, Star, Loader2, Compass, ChevronDown } from 'lucide-react';

/**
 * Nearby & local discovery (owner 13 Nov).
 *
 * Cards carry ONLY what the source actually supplies: Google Places gives rating/reviews/price level when the
 * server key exists, OpenStreetMap gives name, address and distance and nothing else. That is why a card can
 * legitimately show "rating unknown" - we never print an invented star count.
 */
type Category = 'all' | 'restaurants' | 'cafes' | 'hotels' | 'stays' | 'cabs' | 'stores' | 'movies';

interface NearbyRow {
  id: string; name: string; category: string; subcategory?: string | null;
  rating: number | null; ratingCount: number | null; priceLabel: string | null; price: number | null;
  address: string | null; distanceKm: number | null; imageUrl: string | null;
  source: 'google' | 'osm' | 'catalogue'; honesty: string; exitUrl: string; directionsUrl: string;
}

const PILLS: { key: Category; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'restaurants', label: 'Restaurants' },
  { key: 'hotels', label: 'Hotels' },
  { key: 'stays', label: 'Stays' },
  { key: 'cafes', label: 'Cafes' },
  { key: 'cabs', label: 'Cabs' },
  { key: 'movies', label: 'Cinemas' },
  { key: 'stores', label: 'Stores' },
];

export default function NearbyView() {
  const [category, setCategory] = useState<Category>('all');
  const [city, setCity] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [rows, setRows] = useState<NearbyRow[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [where, setWhere] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  // OWNER 14 Nov: "load more button is not there". The server has paged this list since 1.8.83 (it answers
  // offset/limit/total/hasMore), but the website still fetched one page and stopped, so the list simply ended
  // at 20 with no way forward. These three pieces of state hold the honest count and the next page.
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [moreLoading, setMoreLoading] = useState(false);

  // OWNER 13 Nov: "jab ye tab open hota hai to time lagta hai aane mai isko fix karo".
  // Two client-side layers on top of the server's stale-while-revalidate:
  //  1. the last real answer for this city+category is painted from sessionStorage on the first frame, so the tab
  //     is never blank while the network is in flight;
  //  2. the in-flight request is abortable, so switching pills quickly cannot land an old answer on top of a new
  //     one (which used to look like the tab "loading forever").
  const abortRef = useRef<AbortController | null>(null);
  const memoryKey = (cat: string, cityName: string, c: { lat: number; lng: number } | null) =>
    `t1s-nearby|${cat}|${c ? `${c.lat.toFixed(2)},${c.lng.toFixed(2)}` : cityName.trim().toLowerCase()}`;

  const load = useCallback(async (next: { category?: Category; lat?: number; lng?: number; city?: string } = {}) => {
    const cat = String(next.category || category);
    const cityName = next.city !== undefined ? next.city : city;
    const useCoords = next.lat !== undefined && next.lng !== undefined
      ? { lat: next.lat, lng: next.lng }
      : coords;
    const key = memoryKey(cat, cityName, useCoords);

    // Instant paint from the last answer for this exact question.
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const snap = JSON.parse(raw);
        if (Array.isArray(snap?.results) && snap.results.length) {
          setRows(snap.results);
          setNotes(snap.notes || []);
          setWhere(snap.where || cityName || 'your area');
          setTotal(Number(snap.total) || snap.results.length);
          setHasMore(snap.hasMore === true);
        }
      }
    } catch { /* a broken snapshot just means skeletons this time */ }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setError(''); setHasMore(false); setTotal(0);
    try {
      const q = new URLSearchParams();
      q.set('category', cat);
      if (useCoords) { q.set('lat', String(useCoords.lat)); q.set('lng', String(useCoords.lng)); }
      if (cityName.trim()) q.set('city', cityName.trim());
      const res = await fetch(`/api/nearby?${q.toString()}`, { signal: ctrl.signal });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      const whereName = data.location?.city || cityName || 'your area';
      const pageRows = data.results || [];
      // hasMore is the server's word; when an older deploy omits it, a full page still means there is more.
      const more = data.hasMore === true || (typeof data.hasMore !== 'boolean' && pageRows.length >= (Number(data.limit) || 20));
      const nextTotal = Number(data.total) || pageRows.length;
      setRows(pageRows);
      setNotes(data.notes || []);
      setWhere(whereName);
      setTotal(nextTotal);
      setHasMore(more && pageRows.length > 0);
      try {
        sessionStorage.setItem(key, JSON.stringify({ results: pageRows, notes: data.notes || [], where: whereName, total: nextTotal, hasMore: more && pageRows.length > 0, at: Date.now() }));
      } catch { /* quota: the paint cache is optional */ }
    } catch (e: any) {
      if (e?.name === 'AbortError') return; // superseded by a newer search
      setError(String(e?.message || e).slice(0, 120));
      setRows([]);
    } finally { if (!ctrl.signal.aborted) setLoading(false); }
  }, [category, city, coords]);

  useEffect(() => { void load({ category: 'all' }); /* first paint uses the fallback city */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /// Next page for the SAME anchor, appended after the cards already on screen (deduped by id), so "Load more"
  /// never re-paints the page or shuffles what is already read.
  const loadMore = useCallback(async () => {
    if (moreLoading || !hasMore) return;
    setMoreLoading(true); setError('');
    try {
      const q = new URLSearchParams();
      q.set('category', category);
      if (coords) { q.set('lat', String(coords.lat)); q.set('lng', String(coords.lng)); }
      if (city.trim()) q.set('city', city.trim());
      q.set('offset', String(rows.length));
      const res = await fetch(`/api/nearby?${q.toString()}`);
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      const seen = new Set(rows.map((r) => r.id));
      const appended = (data.results || []).filter((r: NearbyRow) => !seen.has(r.id));
      const nextTotal = Number(data.total) || rows.length;
      setRows((prev) => [...prev, ...appended]);
      setTotal(nextTotal);
      // No new rows means the tail is genuinely exhausted, so the button goes instead of asking again.
      setHasMore(appended.length > 0 && (data.hasMore === true || rows.length + appended.length < nextTotal));
    } catch (e: any) {
      setError(String(e?.message || e).slice(0, 120));
    } finally {
      setMoreLoading(false);
    }
  }, [category, city, coords, hasMore, moreLoading, rows]);

  const useMyLocation = () => {
    if (!navigator.geolocation) { setError('This browser has no location support, use the city box.'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(c); setLocating(false);
        void load({ lat: c.lat, lng: c.lng, city: '' });
      },
      () => { setLocating(false); setError('Location permission denied, so we used the city instead.'); },
      { timeout: 8000, maximumAge: 120000 },
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Compass className="w-5 h-5 text-[#E7000B]" /> Nearby & local discovery
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Restaurants, cafes, hotels, stays, cabs and stores around {where || 'you'}. Everything is real data:
            each card says where it came from.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void load({ city }); }}
            placeholder="City or area (e.g. Pune)"
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white w-44"
          />
          <button
            type="button"
            onClick={() => void load({ city })}
            className="px-3 py-2 text-xs font-bold rounded-xl bg-slate-900 text-white cursor-pointer"
          >
            Search
          </button>
          <button
            type="button"
            onClick={useMyLocation}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-700 cursor-pointer"
          >
            {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
            Use my location
          </button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto mt-4 pb-1">
        {PILLS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => { setCategory(p.key); void load({ category: p.key }); }}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border whitespace-nowrap cursor-pointer ${
              category === p.key ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {error ? <p className="mt-3 text-xs font-semibold text-red-600">{error}</p> : null}
      {notes.length ? (
        <ul className="mt-3 text-[11px] text-slate-500 list-disc pl-4 space-y-0.5">
          {notes.slice(0, 3).map((n) => <li key={n}>{n}</li>)}
        </ul>
      ) : null}

      {loading ? (
        <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : rows.length === 0 ? (
        <p className="mt-8 text-sm text-slate-500">
          Nothing live for this spot right now, so we show nothing instead of invented ratings or prices.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
          {rows.map((r) => (
            <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col gap-2">
              {r.imageUrl ? (
                /* Owner 14 Nov: real photos differ in size and shape, so the CARD sets the frame and the photo is
                   cropped into it. Whatever the source resolution, every tile is the same 16:10 and no photo is
                   ever skipped for its dimensions - only a source that genuinely fails falls back to the tile,
                   once. */
                <div className="relative w-full aspect-[16/10] overflow-hidden rounded-xl bg-slate-100">
                  <img
                    src={r.imageUrl}
                    alt={r.name}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover"
                    onError={(e) => {
                      const img = e.currentTarget as HTMLImageElement;
                      if (!img.src.includes('/nearby-assets/all.jpg')) img.src = '/nearby-assets/all.jpg';
                    }}
                  />
                </div>
              ) : null}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 leading-snug">{r.name}</h3>
                  <p className="text-[11px] text-slate-500 capitalize">{r.subcategory || r.category}</p>
                </div>
                {r.distanceKm !== null ? (
                  <span className="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    {r.distanceKm} km
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                {r.rating !== null ? (
                  <span className="inline-flex items-center gap-1 font-bold text-amber-600">
                    <Star className="w-3 h-3 fill-amber-500 text-amber-500" /> {r.rating.toFixed(1)}
                    {r.ratingCount ? <span className="text-slate-400 font-medium">({r.ratingCount})</span> : null}
                  </span>
                ) : (
                  <span className="text-slate-400">rating unknown</span>
                )}
                {r.priceLabel ? <span className="text-slate-600 font-semibold">{r.priceLabel}</span> : null}
                {r.price !== null ? <span className="text-slate-900 font-black">₹{Math.round(r.price).toLocaleString('en-IN')}</span> : null}
              </div>
              {r.address ? <p className="text-[11px] text-slate-500 flex items-start gap-1"><MapPin className="w-3 h-3 mt-0.5 shrink-0" /> {r.address}</p> : null}
              <p className="text-[10px] text-slate-400 leading-snug">{r.honesty}</p>
              <div className="flex gap-2 mt-auto pt-1">
                {r.exitUrl ? (
                  <a href={r.exitUrl} rel="nofollow sponsored noopener" className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-[11px] font-bold">
                    Visit / book
                  </a>
                ) : null}
                <a href={r.directionsUrl} rel="nofollow noopener" className="px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-700">
                  Get directions
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* The end of the honest list, and the only way past it. It states how many of how many are on screen,
          because the server holds at most 60 rows for one spot - this is not an infinite feed. */}
      {!loading && rows.length > 0 && hasMore ? (
        <div className="mt-4 flex flex-col items-center gap-1.5">
          <span className="text-[10.5px] text-slate-500">
            {rows.length} of {Math.max(total, rows.length)} places shown
          </span>
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={moreLoading}
            className="w-full max-w-sm px-4 py-3 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-900 cursor-pointer disabled:opacity-60 inline-flex items-center justify-center gap-1"
          >
            {moreLoading ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : <ChevronDown className="w-4 h-4" />}
            Load more
          </button>
        </div>
      ) : null}
    </div>
  );
}
