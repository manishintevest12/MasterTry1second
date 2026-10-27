import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, ExternalLink, Bell, BellRing, Loader2, AlertCircle, TrendingDown, ShieldCheck, Copy, Share2,
  ChevronRight, Star, Search, Check, Link2, Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

/**
 * In-site product page (opened from the home Price Lens "Find Cheapest").
 * Everything shown is real: same-product offers from our live pipeline, recorded price history,
 * a deal score computed from that history, related products from the same search.
 * When history is missing we say so. Nothing is invented.
 */

interface Offer {
  id: string; title: string; seller: string; price: number; listPrice: number;
  image: string | null; images: string[]; availability: string; rating: number | null; reviews: number | null;
  canonicalEntityId: number | string | null; goUrl: string; variantCount?: number;
}
interface Deal {
  hasHistory: boolean; points: number; current: number; allTimeLow: number | null; allTimeHigh: number | null;
  average: number | null; vsAveragePct: number | null; score: number | null;
  verdict: 'great' | 'good' | 'fair' | 'wait' | 'unknown'; headline: string;
  breakup: Array<{ label: string; pts: number; max: number }>;
}
interface PageData {
  success: boolean; found?: boolean; error?: string; message?: string; searchedAs?: string;
  product?: { title: string | null; merchant: string; domain: string; pagePrice: number | null; image: string | null };
  images?: string[]; cheapest?: Offer | null; offers?: Offer[]; related?: Offer[];
  history?: Array<{ price: number; capturedAt: string }>; deal?: Deal;
  pageVsCheapest?: { pagePrice: number; cheapest: number; saving: number } | null;
}

const inr = (n: number) => `\u20B9${Math.round(n).toLocaleString('en-IN')}`;
const FAV = (name: string) => {
  const map: Record<string, string> = {
    amazon: 'amazon.in', flipkart: 'flipkart.com', myntra: 'myntra.com', ajio: 'ajio.com', 'tata cliq': 'tatacliq.com',
    meesho: 'meesho.com', croma: 'croma.com', nykaa: 'nykaa.com', 'reliance digital': 'reliancedigital.in',
    snapdeal: 'snapdeal.com', jiomart: 'jiomart.com', blinkit: 'blinkit.com', zepto: 'zeptonow.com',
    instamart: 'swiggy.com', bigbasket: 'bigbasket.com',
  };
  const k = Object.keys(map).find((m) => name.toLowerCase().includes(m));
  return k ? `https://www.google.com/s2/favicons?domain=${map[k]}&sz=64` : '';
};

const RANGES = [{ id: '1m', label: '1 Month', days: 30 }, { id: '3m', label: '3 Month', days: 90 }, { id: 'max', label: 'Max', days: 100000 }] as const;

export const ProductPageView: React.FC = () => {
  const { productPageRequest, setActiveNavTab, openProductPage, authUser, loginWithGoogle, addToast } = useApp();
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeImg, setActiveImg] = useState(0);
  const [range, setRange] = useState<(typeof RANGES)[number]['id']>('max');
  const [alertPrice, setAlertPrice] = useState('');
  const [alertBusy, setAlertBusy] = useState(false);
  const [alertSet, setAlertSet] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [searchBox, setSearchBox] = useState('');

  useEffect(() => {
    if (!productPageRequest) return;
    let cancelled = false;
    setLoading(true); setError(null); setData(null); setActiveImg(0); setAlertSet(null);
    (async () => {
      try {
        const res = await fetch('/api/product-page', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: productPageRequest.input, query: productPageRequest.query, seed: productPageRequest.seed, gallery: productPageRequest.gallery }),
        });
        const d: PageData = await res.json();
        if (cancelled) return;
        if (!res.ok || d.success === false) throw new Error(d.error || 'Could not load this product');
        setData(d);
        const cur = d.cheapest?.price ?? d.product?.pagePrice ?? 0;
        if (cur) setAlertPrice(String(Math.round(cur * 0.95)));
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message || e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [productPageRequest?.nonce]);

  const cheapest = data?.cheapest || null;
  const offers = data?.offers || [];
  const title = cheapest?.title || data?.product?.title || '';
  const current = cheapest?.price ?? data?.product?.pagePrice ?? 0;
  const listPrice = cheapest?.listPrice && cheapest.listPrice > current ? cheapest.listPrice : 0;
  const off = listPrice ? Math.round(((listPrice - current) / listPrice) * 100) : 0;
  const images = useMemo(() => {
    // Merge the gallery from the clicked card with the server images (real photos only).
    const merged = [...(data?.images || [])];
    for (const g of productPageRequest?.gallery || []) if (g.startsWith('https://') && !merged.includes(g)) merged.push(g);
    return merged.slice(0, 8);
  }, [data, productPageRequest?.nonce]);

  // history filtered by range
  const hist = useMemo(() => {
    const pts = (data?.history || []).map((h) => ({ t: new Date(h.capturedAt).getTime(), p: h.price })).filter((h) => Number.isFinite(h.t));
    const days = RANGES.find((r) => r.id === range)!.days;
    const from = Date.now() - days * 86_400_000;
    return pts.filter((h) => h.t >= from);
  }, [data, range]);

  const setAlert = async () => {
    if (!authUser) { addToast('alert', 'Sign in first', 'Sign in with Google to get price-drop alerts by email.'); await loginWithGoogle(); return; }
    const target = Math.round(Number(alertPrice));
    if (!target || target <= 0) { addToast('alert', 'Enter a target price', 'Type the price you want to buy at.'); return; }
    setAlertBusy(true);
    try {
      const token = localStorage.getItem('try1_session') || '';
      const res = await fetch('/api/alerts', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          productTitle: title, searchQuery: data?.searchedAs || title, sourceUrl: productPageRequest?.input || null,
          image: images[0] || null, targetPrice: target, priceAtSet: current || null,
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || 'Could not save the alert');
      setAlertSet(target);
      addToast('success', 'Price alert set', `We will email ${authUser.email} when a verified price is at or below ${inr(target)}.`);
    } catch (e: any) {
      addToast('alert', 'Alert not saved', String(e?.message || e));
    } finally {
      setAlertBusy(false);
    }
  };

  const share = async () => {
    const text = `${title} - ${inr(current)} (cheapest found on Try1Second)`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(productPageRequest?.input || title); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };
  const goSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const v = searchBox.trim();
    if (!v) return;
    openProductPage(/^https?:\/\//i.test(v) ? { input: v } : { query: v });
    setSearchBox('');
  };

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5">
      {/* top bar: back + search any product */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <button onClick={() => setActiveNavTab('home')} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-red-600 cursor-pointer">
          <span className="w-8 h-8 rounded-full border border-slate-200 bg-white flex items-center justify-center"><ArrowLeft className="w-4 h-4" /></span>
          Home
          {title && <span className="text-slate-400 font-semibold truncate max-w-[40vw] hidden sm:inline"> / {title}</span>}
        </button>
        <form onSubmit={goSearch} className="sm:ml-auto flex items-center gap-2 bg-white border border-slate-200 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/15 rounded-xl px-3 py-2 w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400" />
          <input value={searchBox} onChange={(e) => setSearchBox(e.target.value)} placeholder="Search a product or paste any product link" className="flex-1 min-w-0 bg-transparent outline-hidden text-sm" aria-label="Search another product" />
        </form>
      </div>

      {loading && (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="w-7 h-7 animate-spin text-red-600" />
          <style>{`@keyframes t1s-pulse-subtle-kf { 0%,100% { opacity:1; } 50% { opacity:0.78; } } .animate-pulse-subtle { animation: t1s-pulse-subtle-kf 1.8s ease-in-out infinite; }`}</style>
          <p className="text-sm font-bold text-slate-900">Comparing prices across the web at warp speed...</p>
          <p className="text-xs text-slate-500 font-semibold animate-pulse-subtle">Your ultimate steal is arriving in <span className="font-black text-red-600 tabular-nums">3, 2, 1...</span></p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span>
        </div>
      )}

      {data && data.found === false && (
        <div className="flex items-start gap-2 text-sm text-slate-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" /><span>{data.message}</span>
        </div>
      )}

      {data && data.found && (
        <>
          <div className="grid grid-cols-1 min-w-0 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)_minmax(0,0.95fr)] gap-5 items-start">
            {/* ---------- gallery ---------- */}
            <div className="bg-white rounded-2xl border border-slate-200 p-3 min-w-0">
              <div className="aspect-square rounded-xl bg-slate-50 flex items-center justify-center overflow-hidden">
                {images[activeImg] ? <img src={images[activeImg]} alt={title} className="w-full h-full object-contain" /> : <span className="text-xs text-slate-400">No photo available</span>}
              </div>
              {images.length > 1 && (
                <div className="flex gap-2 mt-3 overflow-x-auto">
                  {images.map((u, i) => (
                    <button key={u + i} onClick={() => setActiveImg(i)} className={`w-14 h-14 shrink-0 rounded-lg border bg-white p-1 cursor-pointer ${i === activeImg ? 'border-red-500 ring-2 ring-red-500/20' : 'border-slate-200'}`}>
                      <img src={u} alt="" className="w-full h-full object-contain" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ---------- price + compare ---------- */}
            <div className="space-y-4 min-w-0">
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                {cheapest && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-black text-slate-700 bg-slate-50 border border-slate-200 rounded-full px-2.5 py-1">
                    {FAV(cheapest.seller) && <img src={FAV(cheapest.seller)} alt="" className="w-4 h-4" />}{cheapest.seller}
                  </span>
                )}
                <h1 className="mt-2 text-base sm:text-lg font-black text-slate-900 leading-snug">
                  {title || (productPageRequest?.query || productPageRequest?.input || '')}
                </h1>
                {loading && (
                  <p className="mt-1 text-[11px] font-bold text-slate-500 inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full border-2 border-slate-300 border-t-transparent animate-spin" />
                    Comparing prices across the web at warp speed…
                  </p>
                )}
                {cheapest?.rating ? (
                  <div className="mt-1 flex items-center gap-1.5 text-xs font-bold text-slate-600">
                    <span className="inline-flex items-center gap-0.5 bg-emerald-600 text-white rounded px-1.5 py-0.5"><Star className="w-3 h-3 fill-white" />{cheapest.rating.toFixed(1)}</span>
                    {cheapest.reviews ? <span className="text-slate-400">{cheapest.reviews.toLocaleString('en-IN')} ratings</span> : null}
                  </div>
                ) : null}
                <div className="mt-3 flex items-baseline gap-2 flex-wrap">
                  {loading ? (
                    // Owner 27 Oct: the wait used to be a silent blank card. A live
                    // skeleton + message shows the comparison is running.
                    <span className="inline-flex items-center gap-2">
                      <span className="h-9 w-28 rounded-lg bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 animate-pulse" />
                      <span className="text-xs font-bold text-slate-500">Comparing prices…</span>
                    </span>
                  ) : (
                    <span className="text-3xl font-black text-slate-900">{current ? inr(current) : 'Price unavailable'}</span>
                  )}
                  {listPrice > 0 && <span className="text-sm text-slate-400 line-through">{inr(listPrice)}</span>}
                </div>
                {off > 0 && <p className="mt-1 text-xs font-black text-emerald-600 inline-flex items-center gap-1"><TrendingDown className="w-3.5 h-3.5" />{off}% OFF</p>}
                {data.pageVsCheapest && data.pageVsCheapest.saving > 0 && (
                  <p className="mt-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5">
                    You save {inr(data.pageVsCheapest.saving)} versus the link you pasted ({inr(data.pageVsCheapest.pagePrice)}).
                  </p>
                )}
                <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
                  <span className="font-bold">Share on</span>
                  <button onClick={share} className="w-7 h-7 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center cursor-pointer" aria-label="Share on WhatsApp"><Share2 className="w-3.5 h-3.5" /></button>
                  <button onClick={copy} className="w-7 h-7 rounded-full border border-slate-200 hover:bg-slate-50 flex items-center justify-center cursor-pointer" aria-label="Copy link">{copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}</button>
                </div>
                {cheapest?.goUrl && (
                  <a href={cheapest.goUrl} target="_blank" rel="noopener noreferrer sponsored"
                    className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-black transition-colors">
                    Buy on {cheapest.seller} <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>

              {offers.length > 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-4">
                  <h2 className="text-sm font-black text-slate-900 mb-2">Compare {offers.length} Available {offers.length === 1 ? 'Price' : 'Prices'}</h2>
                  <ul className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                    {offers.map((o, i) => {
                      const cheaper = current && o.price > current ? 0 : 0;
                      const pct = cheapest && i > 0 ? Math.round(((o.price - cheapest.price) / o.price) * 100) : 0;
                      return (
                        <li key={o.id || i}>
                          <a href={o.goUrl || undefined} target="_blank" rel="noopener noreferrer sponsored" className="flex items-center gap-3 py-2.5 hover:bg-slate-50 px-1 rounded-lg">
                            <span className="w-8 h-8 rounded-full border border-slate-200 bg-white flex items-center justify-center overflow-hidden shrink-0">
                              {FAV(o.seller) ? <img src={FAV(o.seller)} alt="" className="w-5 h-5" /> : <span className="text-[10px] font-black text-slate-500">{o.seller.slice(0, 2).toUpperCase()}</span>}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-slate-900 truncate">{o.seller}</p>
                              <p className="text-[11px] text-slate-400 truncate">{o.availability === 'out_of_stock' ? 'Out of stock' : o.title}{(o.variantCount || 0) > 1 ? ` · ${o.variantCount} variants` : ''}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-black text-slate-900">{inr(o.price)}</p>
                              {i === 0 ? <p className="text-[10px] font-black text-emerald-600">Lowest price</p> : pct > 0 ? <p className="text-[10px] font-bold text-slate-400">{pct}% costlier</p> : null}
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-300" />
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 p-4 text-sm text-slate-600">{data.message}</div>
              )}
            </div>

            {/* ---------- deal scanner + alert ---------- */}
            <div className="space-y-4 min-w-0">
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="grid grid-cols-2 text-center text-xs font-black border-b border-slate-200">
                  <span className="py-2.5 text-red-600 border-b-2 border-red-600">Deal Scanner</span>
                  <span className="py-2.5 text-slate-400">Price Drop</span>
                </div>
                <DealPanel deal={data.deal} />
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">{alertSet ? <BellRing className="w-4 h-4 text-emerald-600" /> : <Bell className="w-4 h-4 text-red-600" />} Set price drop alert to buy later</h3>
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 flex items-center border border-slate-200 focus-within:border-red-500 rounded-xl px-3 py-2 bg-slate-50">
                    <span className="text-slate-400 mr-1">{'\u20B9'}</span>
                    <input value={alertPrice} onChange={(e) => setAlertPrice(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" aria-label="Target price" className="w-full bg-transparent outline-hidden text-sm font-bold" />
                  </div>
                  <button onClick={setAlert} disabled={alertBusy} className="px-3.5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-xs font-black cursor-pointer whitespace-nowrap">
                    {alertBusy ? 'Saving\u2026' : authUser ? 'Set Price Alert' : 'Login & Set Alert'}
                  </button>
                </div>
                {alertSet ? (
                  <p className="mt-2 text-xs font-bold text-emerald-700">Alert active at {inr(alertSet)}. We email you once a verified price reaches it.</p>
                ) : (
                  <p className="mt-2 text-[11px] text-slate-400">We re-check live prices every 30 minutes and email you once when it hits your price.</p>
                )}
                {cheapest?.goUrl && (
                  <a href={cheapest.goUrl} target="_blank" rel="noopener noreferrer sponsored" className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 text-red-700 hover:bg-red-50 text-sm font-black">
                    Buy on {cheapest.seller}
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* ---------- price history ---------- */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-black text-slate-900">Price History</h2>
              <div className="inline-flex bg-slate-100 rounded-full p-0.5 text-[11px] font-black">
                {RANGES.map((r) => (
                  <button key={r.id} onClick={() => setRange(r.id)} className={`px-3 py-1 rounded-full cursor-pointer ${range === r.id ? 'bg-white text-red-600 shadow-2xs' : 'text-slate-500'}`}>{r.label}</button>
                ))}
              </div>
            </div>
            <HistoryChart points={hist} total={(data.history || []).length} current={current} />
          </div>

          {/* ---------- related ---------- */}
          {(data.related || []).length > 0 && (
            <div>
              <h2 className="text-base font-black text-slate-900 mb-3">Related products</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {(data.related || []).slice(0, 10).map((r, i) => (
                  <button key={r.id || i} onClick={() => openProductPage({ query: r.title })}
                    className="text-left bg-white rounded-2xl border border-slate-200 hover:border-red-300 hover:shadow-md transition-all p-3 cursor-pointer">
                    <div className="aspect-square rounded-xl bg-slate-50 flex items-center justify-center overflow-hidden">
                      {r.image ? <img src={r.image} alt={r.title} className="w-full h-full object-contain" loading="lazy" /> : <Link2 className="w-6 h-6 text-slate-300" />}
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">{FAV(r.seller) && <img src={FAV(r.seller)} alt="" className="w-4 h-4" />}<span className="text-[10px] font-bold text-slate-400 truncate">{r.seller}</span></div>
                    <p className="mt-1 text-xs font-bold text-slate-800 line-clamp-2 min-h-[2rem]">{r.title}</p>
                    <p className="mt-1 text-sm font-black text-slate-900">{inr(r.price)}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="text-[11px] text-slate-400 flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> Every price here was observed live by Try1Second. If a site has no verified listing for this exact product we show nothing for it.</p>
        </>
      )}
    </section>
  );
};

/* ------------------------------------------------------------------ deal scanner */
const DealPanel: React.FC<{ deal?: Deal }> = ({ deal }) => {
  if (!deal || !deal.hasHistory || deal.score === null) {
    return (
      <div className="p-4 text-sm text-slate-600">
        <p className="font-black text-slate-900 flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-red-600" /> Deal score building up</p>
        <p className="mt-1 text-xs">{deal?.headline || 'Not enough recorded price history yet to score this deal. We never guess.'}</p>
        <p className="mt-2 text-[11px] text-slate-400">Every search records the live price, so the score appears as history grows.</p>
      </div>
    );
  }
  const tone = deal.verdict === 'great' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : deal.verdict === 'good' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : deal.verdict === 'fair' ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-red-700 bg-red-50 border-red-200';
  const label = deal.verdict === 'great' ? 'Hot Deal' : deal.verdict === 'good' ? 'Good Deal' : deal.verdict === 'fair' ? 'Fair Price' : 'Better to wait';
  return (
    <div className="p-4">
      <div className="flex items-center gap-3">
        <span className={`text-xs font-black border rounded-full px-3 py-1.5 ${tone}`}>{label}</span>
        <Gauge score={deal.score} />
      </div>
      <p className={`mt-3 text-xs font-bold border rounded-lg px-3 py-2 ${tone}`}>{deal.headline}</p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="All-time low" value={deal.allTimeLow ? inr(deal.allTimeLow) : '-'} />
        <Stat label="Average" value={deal.average ? inr(deal.average) : '-'} />
        <Stat label="All-time high" value={deal.allTimeHigh ? inr(deal.allTimeHigh) : '-'} />
      </div>
      <p className="mt-3 text-[11px] font-black text-slate-500 uppercase tracking-wide">Deal Score Breakup</p>
      <ul className="mt-1 space-y-1.5">
        {deal.breakup.map((b) => (
          <li key={b.label} className="flex items-center justify-between text-xs">
            <span className="text-slate-600">{b.label}</span>
            <span className="font-black text-slate-900">{b.pts}<span className="text-slate-400">/{b.max}</span></span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-slate-400">Computed from {deal.points} recorded prices plus live prices on other sites.</p>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="bg-slate-50 rounded-lg py-2"><p className="text-[10px] text-slate-400 font-bold">{label}</p><p className="text-xs font-black text-slate-900">{value}</p></div>
);

/** Semi-circle gauge, 0-100, in our red theme. */
const Gauge: React.FC<{ score: number }> = ({ score }) => {
  const r = 38, cx = 50, cy = 48;
  const ang = Math.PI * (1 - Math.min(100, Math.max(0, score)) / 100);
  const x = cx + r * Math.cos(ang), y = cy - r * Math.sin(ang);
  const arc = (a0: number, a1: number) => {
    const p = (a: number) => `${cx + r * Math.cos(Math.PI * (1 - a))} ${cy - r * Math.sin(Math.PI * (1 - a))}`;
    return `M ${p(a0)} A ${r} ${r} 0 0 1 ${p(a1)}`;
  };
  return (
    <svg viewBox="0 0 100 62" className="w-28 ml-auto" role="img" aria-label={`Deal score ${score} out of 100`}>
      <path d={arc(0, 0.34)} stroke="#E7000B" strokeWidth="8" fill="none" />
      <path d={arc(0.34, 0.67)} stroke="#F59E0B" strokeWidth="8" fill="none" />
      <path d={arc(0.67, 1)} stroke="#16A34A" strokeWidth="8" fill="none" />
      <line x1={cx} y1={cy} x2={x} y2={y} stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="3.5" fill="#0F172A" />
      <text x={cx} y={60} textAnchor="middle" fontSize="9" fontWeight="800" fill="#0F172A">Deal Score {score}</text>
    </svg>
  );
};

/* ------------------------------------------------------------------ price history chart */
const HistoryChart: React.FC<{ points: Array<{ t: number; p: number }>; total: number; current: number }> = ({ points, total, current }) => {
  if (points.length < 2) {
    return (
      <div className="rounded-xl bg-slate-50 border border-dashed border-slate-200 py-10 px-4 text-center">
        <p className="text-sm font-black text-slate-700">{total < 2 ? 'Price history is just starting for this product' : 'No recorded prices in this range'}</p>
        <p className="mt-1 text-xs text-slate-500">
          We only chart prices we actually recorded{current ? `. Today's lowest is ${inr(current)}` : ''}. Come back soon, every search adds a real data point.
        </p>
      </div>
    );
  }
  const W = 800, H = 240, padL = 56, padR = 12, padT = 12, padB = 28;
  const t0 = points[0].t, t1 = points[points.length - 1].t || t0 + 1;
  const ps = points.map((x) => x.p);
  const lo = Math.min(...ps), hi = Math.max(...ps);
  const span = Math.max(1, hi - lo);
  const yMin = Math.max(0, lo - span * 0.15), yMax = hi + span * 0.15;
  const X = (t: number) => padL + ((t - t0) / Math.max(1, t1 - t0)) * (W - padL - padR);
  const Y = (v: number) => padT + (1 - (v - yMin) / (yMax - yMin)) * (H - padT - padB);
  const line = points.map((q, i) => `${i ? 'L' : 'M'} ${X(q.t).toFixed(1)} ${Y(q.p).toFixed(1)}`).join(' ');
  const area = `${line} L ${X(t1).toFixed(1)} ${H - padB} L ${X(t0).toFixed(1)} ${H - padB} Z`;
  const yTicks = [0, 0.5, 1].map((f) => yMin + (yMax - yMin) * f);
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => t0 + (t1 - t0) * f);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Price history chart">
        <defs><linearGradient id="phFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#E7000B" stopOpacity="0.22" /><stop offset="100%" stopColor="#E7000B" stopOpacity="0.02" /></linearGradient></defs>
        {yTicks.map((v) => (<g key={v}><line x1={padL} x2={W - padR} y1={Y(v)} y2={Y(v)} stroke="#E2E8F0" strokeDasharray="3 4" /><text x={padL - 8} y={Y(v) + 3} textAnchor="end" fontSize="10" fill="#94A3B8">{inr(v)}</text></g>))}
        {xTicks.map((t) => (<text key={t} x={X(t)} y={H - 8} textAnchor="middle" fontSize="10" fill="#94A3B8">{new Date(t).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</text>))}
        <path d={area} fill="url(#phFill)" />
        <path d={line} fill="none" stroke="#E7000B" strokeWidth="2.2" strokeLinejoin="round" />
        <circle cx={X(points[points.length - 1].t)} cy={Y(points[points.length - 1].p)} r="4" fill="#E7000B" />
      </svg>
      <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-slate-500">
        <span>Lowest <strong className="text-slate-900">{inr(lo)}</strong></span>
        <span>Highest <strong className="text-slate-900">{inr(hi)}</strong></span>
        <span>{points.length} recorded prices</span>
      </div>
    </div>
  );
};
