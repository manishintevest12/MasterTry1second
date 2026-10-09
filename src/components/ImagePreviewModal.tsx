import React from 'react';
import { X, ExternalLink, Star, ShieldCheck, MapPin } from 'lucide-react';
import { ComparisonItem } from '../types';

interface ImagePreviewModalProps {
  item: ComparisonItem | null;
  onClose: () => void;
  onSelectDeal?: (quote: any) => void;
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  item,
  onClose,
  onSelectDeal,
}) => {
  if (!item) return null;

  const bestQuote = item.sellerQuotes.find((q) => q.isLowest) || item.sellerQuotes[0];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col md:flex-row max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left: High-Res Photo Container */}
        <div className="md:w-3/5 bg-slate-900 relative flex items-center justify-center overflow-hidden min-h-[260px] md:min-h-[420px]">
          <img
            src={item.imageUrl}
            alt={item.title}
            className="w-full h-full object-cover max-h-[450px]"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src =
                'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent pointer-events-none" />

          {/* Badges on Image */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5">
            <span className="px-2.5 py-1 rounded-md bg-slate-900/80 backdrop-blur-xs text-white text-[11px] font-bold uppercase tracking-wider">
              {item.category}
            </span>
          </div>

          <div className="absolute bottom-3 left-3 right-3 text-white">
            <h4 className="font-bold text-sm leading-tight drop-shadow-md">{item.title}</h4>
            <p className="text-[11px] text-slate-300 drop-shadow-xs">{item.subtitle}</p>
          </div>
        </div>

        {/* Right: Deal Details & Sellers */}
        <div className="md:w-2/5 p-5 flex flex-col justify-between overflow-y-auto">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
                <span className="font-bold text-slate-900">{item.rating}</span>
                <span className="text-slate-400">({item.reviewCount.toLocaleString('en-IN')} reviews)</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Price block */}
            <div className="py-4">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Lowest Available Deal
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-slate-900 font-mono">
                  ₹{item.primaryPrice.toLocaleString('en-IN')}
                </span>
                {item.originalPrice > item.primaryPrice && (
                  <span className="text-xs text-slate-400 line-through font-mono">
                    ₹{item.originalPrice.toLocaleString('en-IN')}
                  </span>
                )}
                {item.unit && <span className="text-xs text-slate-500">/ {item.unit}</span>}
              </div>
            </div>

            {/* Specifications Snapshot */}
            <div className="space-y-2 mb-4">
              <span className="text-[11px] font-bold text-slate-900 uppercase tracking-wider block">
                Key Highlights
              </span>
              <div className="space-y-1.5 text-xs text-slate-600">
                {item.features.slice(0, 4).map((f, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Seller Quotes */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-900 uppercase tracking-wider block">
                Compared Sellers ({item.sellerQuotes.length})
              </span>
              <div className="space-y-1.5">
                {item.sellerQuotes.slice(0, 3).map((sq) => (
                  <div
                    key={sq.id}
                    className="p-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-800">{sq.sellerName}</span>
                      {sq.badge && (
                        <span className="ml-1.5 text-[10px] text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded-xs font-semibold">
                          {sq.badge}
                        </span>
                      )}
                    </div>
                    <span className="font-bold font-mono text-slate-900">
                      ₹{sq.price.toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onSelectDeal && bestQuote) {
                  onSelectDeal(bestQuote);
                }
              }}
              className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>View Deal on {bestQuote.sellerName}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
