import React, { useEffect, useState } from 'react';
import { Heart, Tag, MapPin, Star, ChevronLeft, ChevronRight, Check, ExternalLink, Coffee, Wifi, Waves, ChevronDown } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { type HotelGroup, dealPercent } from '../utils/hotelGroups';
import { brandLogoUrl, initials } from '../utils/brandLogo';
import { HotelDetailModal } from './HotelDetailModal';
import { Images } from 'lucide-react';

/** Trivago-style hotel card: photo gallery | name, area, rating, amenities + per-site price rows | best deal + View Deal. */

const ratingWord = (r: number) => (r >= 9 ? 'Exceptional' : r >= 8.5 ? 'Excellent' : r >= 8 ? 'Very good' : r >= 7 ? 'Good' : r >= 6 ? 'Pleasant' : 'Rated');
const ratingColor = (r: number) => (r >= 8 ? 'bg-emerald-600' : r >= 7 ? 'bg-lime-600' : r >= 6 ? 'bg-amber-500' : 'bg-slate-500');

export const SiteLogo: React.FC<{ site: string; hotelName?: string }> = ({ site, hotelName }) => {
  const [ok, setOk] = useState(true);
  const direct = site === 'Hotel website';
  const url = direct ? undefined : brandLogoUrl({ vertical: 'hotels', provider: site, subtitle: site });
  return (
    <div className="flex items-center gap-2 min-w-0">
      {direct ? (
        <span className="w-5 h-5 rounded bg-orange-100 text-orange-700 flex items-center justify-center shrink-0" title={`Book direct with ${hotelName || 'the hotel'}`}><Tag className="w-3 h-3" /></span>
      ) : url && ok ? (
        <img src={url} alt="" className="w-5 h-5 object-contain shrink-0" referrerPolicy="no-referrer" onError={() => setOk(false)} />
      ) : (
        <span className="w-5 h-5 rounded bg-slate-100 text-[9px] font-black text-slate-500 flex items-center justify-center shrink-0">{initials(site)}</span>
      )}
      <span className="text-sm font-bold text-slate-800 truncate">{direct ? 'Book direct' : site}</span>
    </div>
  );
};

const amenityIcon = (a: string) => {
  const s = a.toLowerCase();
  if (s.includes('breakfast')) return <Coffee className="w-3 h-3" />;
  if (s.includes('wifi') || s.includes('wi-fi')) return <Wifi className="w-3 h-3" />;
  if (s.includes('pool')) return <Waves className="w-3 h-3" />;
  if (s.includes('cancel')) return <Check className="w-3 h-3" />;
  return null;
};

export const HotelDealCard: React.FC<{ group: HotelGroup; nights?: number }> = ({ group, nights }) => {
  const { trackedItemIds, toggleTrackPrice, startRedirection } = useApp();
  const [imgIdx, setImgIdx] = useState(0);
  // Photos are tried in order: when one fails to load in the visitor's browser
  // (CDN hiccup, geo-blocked image edge, expired token) advance to the next
  // photo instead of collapsing the whole card to the placeholder. Owner bug
  // 17 Oct: one broken Agoda photo blanked 'The Park Indore' while the other
  // gallery photos (Yatra/Cleartrip) rendered fine.
  const [skip, setSkip] = useState(0);
  useEffect(() => { setSkip(0); setImgIdx(0); }, [group.key]);
  const photos = group.gallery.length ? group.gallery : group.image ? [group.image] : [];
  const shown = photos.slice(skip);
  const [showAll, setShowAll] = useState(false);
  const [detail, setDetail] = useState(false);
  const best = group.best;
  const bestQuote = best.item.sellerQuotes.find((q) => q.isLowest) || best.item.sellerQuotes[0];
  const tracked = trackedItemIds.includes(best.item.id);
  const pct = dealPercent(group);
  const rows = showAll ? group.rows : group.rows.slice(0, 3);

  const go = (row = best) => {
    const q = row.item.sellerQuotes.find((x) => x.isLowest) || row.item.sellerQuotes[0];
    if (q) startRedirection(row.item, q);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs hover:shadow-md hover:border-slate-300 transition-all overflow-hidden flex flex-col md:flex-row">
      {/* PHOTO */}
      <button type="button" onClick={() => setDetail(true)} aria-label={`Open ${group.name} details and photos`} className="relative w-full md:w-60 h-48 md:h-auto md:min-h-[220px] shrink-0 bg-slate-100 group block cursor-pointer">
        {shown.length > 0 ? (
          <img src={shown[imgIdx % shown.length]} alt={group.name} loading="lazy" referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover" onError={() => setSkip((v) => v + 1)} />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
            <span className="text-3xl font-black">{initials(group.name)}</span>
            <span className="text-[10px] mt-1">photo not published by source</span>
          </div>
        )}
        <button type="button" onClick={() => toggleTrackPrice(best.item.id)} title={tracked ? 'Stop tracking price' : 'Track price drops'}
          className={`absolute top-3 right-3 p-2 rounded-xl bg-white/95 shadow-xs border border-slate-200 cursor-pointer ${tracked ? 'text-rose-600' : 'text-slate-600 hover:text-slate-900'}`}>
          <Heart className={`w-4 h-4 ${tracked ? 'fill-rose-500' : ''}`} />
        </button>
        {shown.length > 1 && (
          <>
            <button type="button" onClick={() => setImgIdx((i) => (i - 1 + shown.length) % shown.length)} className="absolute left-2 top-1/2 -translate-y-1/2 p-1 rounded-full bg-white/90 shadow cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"><ChevronLeft className="w-4 h-4" /></button>
            <button type="button" onClick={() => setImgIdx((i) => (i + 1) % shown.length)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full bg-white/90 shadow cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"><ChevronRight className="w-4 h-4" /></button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {shown.slice(0, 6).map((_, i) => <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === imgIdx % shown.length ? 'bg-white' : 'bg-white/50'}`} />)}
            </div>
          </>
        )}
        {group.propertyType && <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-slate-900/75 text-white text-[10px] font-bold">{group.propertyType}</span>}
        {shown.length > 0 && <span className="absolute top-3 left-3 px-2 py-1 rounded-lg bg-white/90 shadow-xs text-slate-700 text-[10px] font-bold flex items-center gap-1"><Images className="w-3 h-3" />{photos.length}</span>}
      </button>

      {/* DETAILS + SITE PRICE ROWS */}
      <div className="flex-1 min-w-0 p-4 sm:p-5">
        <button type="button" onClick={() => setDetail(true)} className="text-left cursor-pointer group/title" aria-label="Open hotel details">
          <h3 className="text-lg font-black text-slate-900 leading-tight line-clamp-2 group-hover/title:text-orange-600 transition-colors">{group.name}</h3>
        </button>
        <button type="button" onClick={() => setDetail(true)} className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 hover:underline cursor-pointer">
          <Images className="w-3 h-3" />Details &amp; photos{photos.length ? ` (${photos.length})` : ''}
        </button>
        <p className="text-xs text-slate-600 mt-1 flex items-center gap-1">
          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
          <span className="truncate"><b className="font-bold">{group.locality || group.city || 'Location on site'}</b>{group.locality && group.city ? `, ${group.city}` : ''}</span>
        </p>

        <div className="flex flex-wrap items-center gap-2 mt-2.5">
          {group.rating10 ? (
            <>
              <span className={`px-1.5 py-0.5 rounded-md text-white text-xs font-black ${ratingColor(group.rating10)}`}>{group.rating10.toFixed(1)}</span>
              <span className="text-xs text-slate-700">{group.ratingLabel || ratingWord(group.rating10)}{group.ratingCount ? ` (${group.ratingCount.toLocaleString('en-IN')})` : ''}</span>
            </>
          ) : <span className="text-xs text-slate-400">No rating published</span>}
          {group.stars ? (
            <span className="flex items-center text-amber-500">{Array.from({ length: Math.min(5, group.stars) }).map((_, i) => <Star key={i} className="w-3 h-3 fill-amber-400" />)}</span>
          ) : null}
        </div>

        {group.amenities.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {group.amenities.slice(0, 4).map((a) => (
              <span key={a} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold">{amenityIcon(a)}{a}</span>
            ))}
          </div>
        )}

        {/* per-site price rows */}
        <div className="mt-3 border-t border-slate-100">
          {rows.map((r, i) => (
            <button key={r.item.id} type="button" onClick={() => go(r)}
              className="w-full flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 text-left cursor-pointer">
              <div className="w-32 sm:w-40 shrink-0"><SiteLogo site={r.site} hotelName={group.name} /></div>
              <span className="flex-1 min-w-0 text-xs text-slate-600 truncate">
                {r.freeCancellation ? <span className="text-emerald-700 font-semibold">Free cancellation</span> : r.breakfast ? 'Breakfast included' : 'Standard rate'}
              </span>
              <span className={`text-sm font-black ${i === 0 ? 'text-emerald-700' : 'text-slate-900'}`}>₹{r.price.toLocaleString('en-IN')}</span>
              {/* Owner 23 Oct: flight-parity small Book pill on every seller row */}
              <span className="shrink-0 ml-2 px-2.5 py-1 bg-red-600 text-white text-[10px] font-black rounded-md tracking-wide">Book</span>
            </button>
          ))}
          {group.rows.length > 3 && (
            <button type="button" onClick={() => setShowAll((v) => !v)} className="w-full py-2 text-xs font-bold text-orange-600 hover:underline flex items-center justify-center gap-1 cursor-pointer">
              {showAll ? 'Show fewer' : `Show ${group.rows.length - 3} more site${group.rows.length - 3 > 1 ? 's' : ''}`}
              <ChevronDown className={`w-3 h-3 ${showAll ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* BEST DEAL */}
      <div className="md:w-56 shrink-0 border-t md:border-t-0 md:border-l border-slate-100 p-4 sm:p-5 flex md:flex-col items-center md:items-stretch justify-between gap-3 bg-slate-50/40">
        <div className="md:min-h-[28px] md:flex md:justify-end">
          {pct && pct >= 5 ? <span className="inline-block px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold">{pct}% less than other sites</span> : null}
        </div>
        <div className="md:text-right">
          <div className="md:flex md:justify-end mb-1"><SiteLogo site={best.site} hotelName={group.name} /></div>
          <p className="text-2xl font-black text-slate-900 leading-none">₹{best.price.toLocaleString('en-IN')}</p>
          <p className="text-[11px] text-slate-500 mt-1">{best.item.specs?.['price basis']?.toLowerCase().includes('night') ? 'per night' : 'per night'}{nights && nights > 1 ? ` · ₹${(best.price * nights).toLocaleString('en-IN')} for ${nights} nights` : ''}</p>
          {best.freeCancellation && <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">Free cancellation</p>}
        </div>
        <button type="button" disabled={!bestQuote} onClick={() => go()}
          className="px-4 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-sm font-black flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/20 cursor-pointer disabled:opacity-50">
          <span>View Deal</span><ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>
      {detail && <HotelDetailModal group={group} nights={nights} onClose={() => setDetail(false)} />}
    </div>
  );
};
