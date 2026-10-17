import React, { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight, MapPin, Star, Heart, ExternalLink, Coffee, Wifi, Waves, Check, Camera, ImageOff } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { type HotelGroup } from '../utils/hotelGroups';
import { initials } from '../utils/brandLogo';
import { SiteLogo } from './HotelDealCard';

/**
 * Booking.com-style hotel detail overlay (17 Oct owner request): photo grid with thin
 * gutters, a "Show all photos" tile opening a full lightbox, plus every site's live
 * price with its own Book button. Everything rendered comes from the grouped real
 * offers — no photo, no amenity, no price is ever invented.
 */

const ratingWord = (r: number) => (r >= 9 ? 'Exceptional' : r >= 8.5 ? 'Excellent' : r >= 8 ? 'Very good' : r >= 7 ? 'Good' : r >= 6 ? 'Pleasant' : 'Rated');
const ratingColor = (r: number) => (r >= 8 ? 'bg-emerald-600' : r >= 7 ? 'bg-lime-600' : r >= 6 ? 'bg-amber-500' : 'bg-slate-500');

const amenityIcon = (a: string) => {
  const s = a.toLowerCase();
  if (s.includes('breakfast')) return <Coffee className="w-3 h-3" />;
  if (s.includes('wifi') || s.includes('wi-fi')) return <Wifi className="w-3 h-3" />;
  if (s.includes('pool')) return <Waves className="w-3 h-3" />;
  if (s.includes('cancel')) return <Check className="w-3 h-3" />;
  return null;
};

const Lightbox: React.FC<{ photos: string[]; idx: number; onIdx: (i: number) => void; onClose: () => void }> = ({ photos, idx, onIdx, onClose }) => {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onIdx((idx - 1 + photos.length) % photos.length);
      if (e.key === 'ArrowRight') onIdx((idx + 1) % photos.length);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [idx, photos.length, onIdx, onClose]);
  return (
    <div className="fixed inset-0 z-[70] bg-black/95 flex items-center justify-center" role="dialog" aria-modal="true">
      <button type="button" onClick={onClose} aria-label="Close gallery" className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer"><X className="w-5 h-5" /></button>
      <div className="absolute top-5 left-1/2 -translate-x-1/2 text-white/90 text-xs font-bold tracking-wide">{idx + 1} / {photos.length}</div>
      {photos.length > 1 && (
        <>
          <button type="button" onClick={() => onIdx((idx - 1 + photos.length) % photos.length)} aria-label="Previous photo" className="absolute left-3 sm:left-6 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer"><ChevronLeft className="w-6 h-6" /></button>
          <button type="button" onClick={() => onIdx((idx + 1) % photos.length)} aria-label="Next photo" className="absolute right-3 sm:right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer"><ChevronRight className="w-6 h-6" /></button>
        </>
      )}
      <img src={photos[idx]} alt={`Photo ${idx + 1}`} className="max-w-[94vw] max-h-[84vh] object-contain select-none" referrerPolicy="no-referrer" />
      {photos.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 max-w-[90vw] overflow-x-auto">
          {photos.map((p, i) => (
            <button key={p + i} type="button" onClick={() => onIdx(i)} className={`w-10 h-10 rounded-md overflow-hidden shrink-0 border-2 cursor-pointer ${i === idx ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100'}`}>
              <img src={p} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const HotelDetailModal: React.FC<{ group: HotelGroup; nights?: number; onClose: () => void }> = ({ group, nights, onClose }) => {
  const { trackedItemIds, toggleTrackPrice, startRedirection } = useApp();
  const [lightbox, setLightbox] = useState<number | null>(null);
  const best = group.best;
  const tracked = trackedItemIds.includes(best.item.id);
  const photos = group.gallery.length ? group.gallery : group.image ? [group.image] : [];
  // Reference layout: grid of tiles; when more photos exist than tiles, the last tile
  // is the "Show all photos" opener (Booking.com pattern).
  const GRID_TILES = 8;
  const gridPhotos = photos.slice(0, photos.length > GRID_TILES ? GRID_TILES : photos.length);
  const showAllTile = photos.length > gridPhotos.length;

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && lightbox === null) onClose(); };
    window.addEventListener('keydown', h);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = ''; };
  }, [onClose, lightbox]);

  const go = (row: typeof best) => {
    const q = row.item.sellerQuotes.find((x) => x.isLowest) || row.item.sellerQuotes[0];
    if (q) startRedirection(row.item, q);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-sm flex items-stretch sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white w-full sm:max-w-4xl sm:rounded-2xl shadow-2xl overflow-y-auto max-h-full sm:max-h-[92vh] flex flex-col">
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-100 px-4 sm:px-6 py-3.5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">{group.name}</h2>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
              <span className="text-xs text-slate-600 flex items-center gap-1 min-w-0">
                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="truncate"><b>{group.locality || group.city || 'Location on site'}</b>{group.locality && group.city ? `, ${group.city}` : ''}</span>
              </span>
              {group.propertyType && <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold">{group.propertyType}</span>}
              {group.stars ? <span className="flex items-center text-amber-500">{Array.from({ length: Math.min(5, group.stars) }).map((_, i) => <Star key={i} className="w-3 h-3 fill-amber-400" />)}</span> : null}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close details" className="p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-800 shrink-0 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-4 sm:px-6 pb-6">
          {/* PHOTO GRID — thin white gutters, "Show all photos" last tile */}
          {photos.length > 0 ? (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-1 rounded-xl overflow-hidden">
              {gridPhotos.map((p, i) => (
                <button key={p + i} type="button" onClick={() => setLightbox(i)} className="relative aspect-square sm:aspect-[4/3] bg-slate-100 overflow-hidden group cursor-pointer">
                  <img src={p} alt={`${group.name} photo ${i + 1}`} loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300" />
                </button>
              ))}
              {(showAllTile || photos.length > 1) && (
                <button type="button" onClick={() => setLightbox(gridPhotos.length)} className={`relative bg-slate-900/80 text-white flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:bg-slate-900 ${photos.length % 2 === 1 ? 'col-span-2 sm:col-span-1' : ''}`}>
                  <Camera className="w-5 h-5" />
                  <span className="text-xs font-bold">Show all photos ({photos.length})</span>
                </button>
              )}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 aspect-[16/6] flex flex-col items-center justify-center text-slate-400 gap-1">
              <ImageOff className="w-7 h-7" />
              <span className="text-xs font-semibold">No photo published by any source yet</span>
            </div>
          )}

          {/* RATING */}
          <div className="flex flex-wrap items-center gap-2 mt-4">
            {group.rating10 ? (
              <>
                <span className={`px-2 py-1 rounded-lg text-white text-sm font-black ${ratingColor(group.rating10)}`}>{group.rating10.toFixed(1)}</span>
                <span className="text-sm text-slate-700 font-semibold">{group.ratingLabel || ratingWord(group.rating10)}{group.ratingCount ? <span className="text-slate-500 font-normal"> ({group.ratingCount.toLocaleString('en-IN')} reviews)</span> : ''}</span>
              </>
            ) : <span className="text-xs text-slate-400 font-semibold">No rating published by sources</span>}
            <button type="button" onClick={() => toggleTrackPrice(best.item.id)} className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${tracked ? 'border-rose-300 bg-rose-50 text-rose-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              <Heart className={`w-3.5 h-3.5 ${tracked ? 'fill-rose-500 text-rose-500' : ''}`} />
              {tracked ? 'Tracking price' : 'Track price drops'}
            </button>
          </div>

          {/* AMENITIES */}
          {group.amenities.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide mb-2">Amenities from sources</h3>
              <div className="flex flex-wrap gap-1.5">
                {group.amenities.map((a) => (
                  <span key={a} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold">{amenityIcon(a)}{a}</span>
                ))}
              </div>
            </div>
          )}

          {/* SITE PRICES */}
          <div className="mt-5">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide mb-2">Live prices across {group.rows.length} site{group.rows.length > 1 ? 's' : ''}</h3>
            <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
              {group.rows.map((r, i) => (
                <div key={r.item.id} className="flex items-center gap-3 px-3 sm:px-4 py-3 hover:bg-slate-50">
                  <div className="w-32 sm:w-44 shrink-0"><SiteLogo site={r.site} hotelName={group.name} /></div>
                  <span className="flex-1 min-w-0 text-xs text-slate-600 truncate hidden sm:block">
                    {r.freeCancellation ? <span className="text-emerald-700 font-semibold">Free cancellation</span> : r.breakfast ? 'Breakfast included' : 'Standard rate'}
                  </span>
                  <span className={`text-sm font-black shrink-0 ${i === 0 ? 'text-emerald-700' : 'text-slate-900'}`}>₹{r.price.toLocaleString('en-IN')}<span className="text-[10px] font-semibold text-slate-400">/night</span></span>
                  <button type="button" onClick={() => go(r)} className="px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-black inline-flex items-center gap-1 shrink-0 cursor-pointer">
                    Book<ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              {best.item.specs?.['price basis'] || 'Nightly rates as published by each site'}{nights && nights > 1 ? ` · ₹${(best.price * nights).toLocaleString('en-IN')} for ${nights} nights at the best site` : ''}
            </p>
          </div>
        </div>
      </div>

      {lightbox !== null && photos.length > 0 && (
        <Lightbox photos={photos} idx={lightbox % photos.length} onIdx={setLightbox} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
};
