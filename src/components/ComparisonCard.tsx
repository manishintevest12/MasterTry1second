import React, { useState } from 'react';
import {
  Heart,
  Share2,
  ChevronDown,
  ChevronUp,
  Star,
  ExternalLink,
  ShieldCheck,
  TrendingDown,
  Clock,
  Sparkles,
  MessageSquarePlus,
  ThumbsUp,
  Copy,
  Check,
  MapPin,
  Camera,
} from 'lucide-react';
import { ComparisonItem, SellerQuote } from '../types';
import { useApp } from '../context/AppContext';
import { ImagePreviewModal } from './ImagePreviewModal';

const DEFAULT_VERTICAL_IMAGES: Record<string, string> = {
  flights: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=600&q=80',
  hotels: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80',
  bus: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=600&q=80',
  ecommerce: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80',
  food: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80',
  grocery: 'https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&w=600&q=80',
  movie: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=600&q=80',
  loans: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80',
  insurance: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=600&q=80',
  cab: 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&w=600&q=80',
};

const getItemImage = (item: ComparisonItem): string => {
  if (item.imageUrl) return item.imageUrl;
  if (item.id === 'ht-1') return 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80';
  if (item.id === 'ht-2') return 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=600&q=80';
  if (item.id === 'ec-1') return 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80';
  if (item.id === 'ec-2') return 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80';
  if (item.id === 'gr-1') return 'https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&w=600&q=80';
  if (item.id === 'gr-2') return 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80';
  if (item.id === 'fd-1') return 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80';
  if (item.id === 'fd-2') return 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80';
  if (item.id === 'mv-1') return 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=600&q=80';
  if (item.id === 'mv-2') return 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=600&q=80';
  return DEFAULT_VERTICAL_IMAGES[item.vertical] || DEFAULT_VERTICAL_IMAGES.hotels;
};

const getLogoStyle = (item: ComparisonItem) => {
  if (item.logoBg && item.logoColor) {
    return { bg: item.logoBg, color: item.logoColor, tag: item.brandTag || 'Verified' };
  }
  const prov = item.provider.toLowerCase();
  if (prov.includes('spicejet')) return { bg: 'bg-red-600', color: 'text-white', tag: 'Direct Airline' };
  if (prov.includes('emirates')) return { bg: 'bg-red-700', color: 'text-amber-300', tag: 'Official Carrier' };
  if (prov.includes('indigo')) return { bg: 'bg-blue-900', color: 'text-white', tag: 'Direct Airline' };
  if (prov.includes('air india')) return { bg: 'bg-red-800', color: 'text-yellow-300', tag: 'Star Alliance' };
  if (prov.includes('intrcity')) return { bg: 'bg-amber-400', color: 'text-slate-900', tag: 'Smart AC Sleeper' };
  if (prov.includes('zingbus')) return { bg: 'bg-emerald-600', color: 'text-white', tag: 'Live GPS Coach' };
  if (prov.includes('nuego')) return { bg: 'bg-emerald-600', color: 'text-white', tag: '100% Electric EV' };
  if (prov.includes('hdfc')) return { bg: 'bg-blue-900', color: 'text-white', tag: 'RBI Bank' };
  if (prov.includes('sbi')) return { bg: 'bg-sky-800', color: 'text-white', tag: 'State Bank' };
  if (prov.includes('bajaj')) return { bg: 'bg-blue-950', color: 'text-white', tag: 'Pre-Approved' };
  if (prov.includes('policybazaar')) return { bg: 'bg-blue-700', color: 'text-white', tag: 'IRDAI Approved' };
  if (prov.includes('acko')) return { bg: 'bg-purple-800', color: 'text-white', tag: '100% Digital' };
  if (prov.includes('uber')) return { bg: 'bg-black', color: 'text-white', tag: 'Direct Dispatch' };
  if (prov.includes('ola')) return { bg: 'bg-lime-500', color: 'text-slate-950', tag: 'Zero Surge' };
  if (prov.includes('blusmart')) return { bg: 'bg-cyan-600', color: 'text-white', tag: '100% EV' };
  if (prov.includes('rapido')) return { bg: 'bg-amber-400', color: 'text-black', tag: 'Fast Pickup' };
  return { bg: 'bg-slate-900', color: 'text-white', tag: 'Verified' };
};

interface ComparisonCardProps {
  item: ComparisonItem;
}

export const ComparisonCard: React.FC<ComparisonCardProps> = ({ item }) => {
  const {
    trackedItemIds,
    toggleTrackPrice,
    startRedirection,
    openReviewModal,
    openPriceAlertModal,
    userLocation,
  } = useApp();

  const [expanded, setExpanded] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'sellers' | 'trend' | 'reviews' | 'specs'>('sellers');
  const [copiedCoupon, setCopiedCoupon] = useState<string | null>(null);
  const [showImagePreview, setShowImagePreview] = useState<boolean>(false);

  const isTracked = trackedItemIds.includes(item.id);
  const bestQuote = item.sellerQuotes.find((q) => q.isLowest) || item.sellerQuotes[0];
  const isImageVertical = true;
  const logoStyle = getLogoStyle(item);

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(
        `Check out ${item.title} on OmniCompare for ₹${item.primaryPrice.toLocaleString('en-IN')}: ${window.location.href}`
      );
    }
  };

  const handleCopyCoupon = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopiedCoupon(code);
      setTimeout(() => setCopiedCoupon(null), 2000);
    }
  };

  // Sparkline calculation for Price History
  const history = item.pricePrediction.priceHistory;
  const minPrice = Math.min(...history.map((h) => h.price));
  const maxPrice = Math.max(...history.map((h) => h.price));
  const priceRange = maxPrice - minPrice || 1;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all overflow-hidden mb-4">
      {/* Main Card Row (Replicating Kayak Flight/Product Card) */}
      <div className="p-4 sm:p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Left & Center Information */}
        <div className="flex-1">
          {/* Top Metadata & Utility Row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {item.category}
              </span>
              <span className="text-slate-300 font-light">·</span>
              <span className="text-xs font-medium text-slate-600 flex items-center gap-1">
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                <strong className="text-slate-900 font-bold">{item.rating}</strong>
                <span className="text-slate-400">({item.reviewCount.toLocaleString('en-IN')})</span>
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {item.isLiveScraped ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100/90 border border-emerald-300 px-2 py-0.5 rounded-full shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>⚡ Live Scraped</span>
                  {item.scrapedLatencyMs && (
                    <span className="text-[10px] text-emerald-700 font-mono">({item.scrapedLatencyMs}ms)</span>
                  )}
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-sm">
                  Cheapest
                </span>
              )}

              {item.scrapedLocation ? (
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                  <MapPin className="w-3 h-3 text-red-500" />
                  <span className="truncate max-w-[140px]">{item.scrapedLocation}</span>
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-sm">
                  Verified
                </span>
              )}

              {/* Heart Price Track Watchlist */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleTrackPrice(item.id);
                }}
                title={isTracked ? 'Stop tracking price' : 'Track price drops for this item'}
                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                  isTracked
                    ? 'bg-rose-50 border-rose-200 text-rose-600'
                    : 'bg-white border-slate-200 text-slate-400 hover:text-slate-700'
                }`}
              >
                <Heart className={`w-4 h-4 ${isTracked ? 'fill-rose-500' : ''}`} />
              </button>

              {/* Share Button */}
              <button
                type="button"
                onClick={handleShare}
                title="Share this deal"
                className="p-1.5 bg-white border border-slate-200 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Core Entity Row: Image Section for (Hotels, Ecom, Food, Grocery, Movies) OR Logo Section for (Flights, Bus, Loans, Insurance, Cab) */}
          {isImageVertical ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              {/* IMAGE SECTION */}
              <div
                onClick={() => setShowImagePreview(true)}
                title="Click to view full photo & gallery"
                className="w-full sm:w-44 md:w-48 h-32 sm:h-32 shrink-0 relative rounded-xl overflow-hidden border border-slate-200 group bg-slate-100 cursor-pointer shadow-2xs"
              >
                <img
                  src={getItemImage(item)}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src =
                      DEFAULT_VERTICAL_IMAGES[item.vertical] ||
                      'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent pointer-events-none" />

                {/* Vertical Category Tag */}
                <div className="absolute top-2 left-2">
                  <span className="px-2 py-0.5 rounded-md bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-bold uppercase tracking-wider">
                    {item.vertical === 'hotels'
                      ? '5★ Hotel'
                      : item.vertical === 'movie'
                      ? 'IMAX 3D'
                      : item.vertical === 'food'
                      ? "Chef's Special"
                      : item.vertical === 'grocery'
                      ? '⚡ 10m Fresh'
                      : item.vertical === 'flights'
                      ? '✈️ Flight'
                      : item.vertical === 'bus'
                      ? '🚌 AC Sleeper'
                      : item.vertical === 'cab'
                      ? '🚖 Instant Ride'
                      : item.vertical === 'loans'
                      ? '💳 Low APR'
                      : item.vertical === 'insurance'
                      ? '🛡️ 1 Cr Cover'
                      : 'Gadget Deal'}
                  </span>
                </div>

                {/* Provider Pill Badge */}
                <div className="absolute top-2 right-2">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider shadow-xs ${logoStyle.bg} ${logoStyle.color}`}>
                    {item.provider}
                  </span>
                </div>

                {/* View Photos Pill */}
                <div className="absolute bottom-2 right-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-white text-[10px] font-semibold group-hover:bg-orange-600 transition-colors">
                    <Camera className="w-3 h-3" />
                    <span>Photos</span>
                  </span>
                </div>
              </div>

              {/* Text Info Beside Image */}
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-slate-900 leading-tight">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  {item.subtitle}
                </p>

                {/* Hyper-local Pincode & GPS Delivery Badge */}
                {['food', 'grocery'].includes(item.vertical) && (
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 mt-1 rounded-md bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-800">
                    <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span>
                      {item.vertical === 'food'
                        ? `Delivering to ${userLocation.locality} (${userLocation.pincode}) in ~26 mins`
                        : `Dark Store servicing ${userLocation.pincode} · ETA 8-12 mins`}
                    </span>
                  </div>
                )}

                {/* Quick specs pill tags / badges */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-2">
                  {item.features.slice(0, 3).map((feat, i) => (
                    <span key={i} className="flex items-center gap-1">
                      {i > 0 && <span className="text-slate-300">·</span>}
                      <span>{feat}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-start sm:items-center gap-4">
              {/* LOGO SECTION */}
              <div className="flex flex-col items-center justify-center shrink-0">
                <div
                  className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex flex-col items-center justify-center font-black text-center shadow-2xs border border-slate-200/80 relative overflow-hidden transition-transform ${
                    logoStyle.bg
                  } ${logoStyle.color}`}
                >
                  <span className="text-sm sm:text-base font-black tracking-tight leading-none px-1">
                    {item.logoText || item.providerLogo || item.provider.substring(0, 3).toUpperCase()}
                  </span>
                  <span className="text-[9px] uppercase tracking-wider opacity-85 mt-1 font-semibold truncate max-w-[65px] px-1">
                    {item.provider}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-slate-600 mt-1 px-1.5 py-0.5 rounded bg-slate-100 text-center max-w-[85px] truncate">
                  {item.brandTag || logoStyle.tag}
                </span>
              </div>

              {/* Text Info Beside Logo */}
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-slate-900 leading-tight">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  {item.subtitle}
                </p>

                {/* Hyper-local Pincode & GPS Delivery Badge for Cab */}
                {item.vertical === 'cab' && (
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 mt-1 rounded-md bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-800">
                    <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span>
                      Pickup at {userLocation.locality} ({userLocation.pincode}) · Nearest cab 2 mins away
                    </span>
                  </div>
                )}

                {/* Quick specs pill tags / badges */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-2">
                  {item.features.slice(0, 3).map((feat, i) => (
                    <span key={i} className="flex items-center gap-1">
                      {i > 0 && <span className="text-slate-300">·</span>}
                      <span>{feat}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Zone: Price & Select CTA */}
        <div className="md:w-64 shrink-0 flex flex-col items-start md:items-end justify-center pt-3 md:pt-0 border-t md:border-t-0 md:border-l border-slate-100 md:pl-6">
          <div className="flex md:flex-col items-baseline md:items-end justify-between w-full md:w-auto gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-2xl font-extrabold text-slate-900 font-mono tracking-tight tabular-nums">
                  ₹{item.primaryPrice.toLocaleString('en-IN')}
                </span>
                {item.originalPrice > item.primaryPrice && (
                  <span className="text-xs text-slate-400 line-through tabular-nums font-mono">
                    ₹{item.originalPrice.toLocaleString('en-IN')}
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-500 font-medium block md:text-right">
                {item.unit || 'inclusive of taxes'}
              </span>
            </div>

            {/* Savings indicator */}
            {item.originalPrice > item.primaryPrice && (
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-sm">
                Save ₹{(item.originalPrice - item.primaryPrice).toLocaleString('en-IN')}
              </span>
            )}
          </div>

          {/* Primary CTA (Kayak Orange Select Button) */}
          <div className="w-full mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => startRedirection(item, bestQuote)}
              className="flex-1 py-2.5 px-4 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-lg shadow-xs hover:shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>
                {item.vertical === 'loans'
                  ? 'Check Eligibility & Match'
                  : item.vertical === 'insurance'
                  ? 'Instant Policy Match'
                  : 'Select Deal'}
              </span>
              <span className="text-[10px] bg-white/20 font-bold px-1.5 py-0.2 rounded-full">
                {item.vertical === 'loans' || item.vertical === 'insurance' ? 'Pre-Approved' : 'Best Price'}
              </span>
            </button>

            {/* Expand details arrow */}
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              title={expanded ? 'Collapse details' : 'Compare sellers, price trend & reviews'}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          <div className="mt-1.5 flex items-center justify-between w-full text-[11px] text-slate-400">
            <span>via {bestQuote.sellerName}</span>
            <button
              onClick={() => setExpanded(true)}
              className="text-orange-600 hover:underline font-semibold"
            >
              {item.sellerQuotes.length} Sellers Compared
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Accordion Drawer */}
      {expanded && (
        <div className="border-t border-slate-200 bg-slate-50/70 p-4 sm:p-5">
          {/* Drawer Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3 mb-4 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('sellers')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                activeTab === 'sellers'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              Compare Sellers ({item.sellerQuotes.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('trend')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                activeTab === 'trend'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              Price History & Forecast
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('reviews')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                activeTab === 'reviews'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              User Reviews ({item.reviews.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('specs')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                activeTab === 'specs'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              Full Specifications
            </button>
          </div>

          {/* TAB 1: COMPARE ALL SELLERS TABLE */}
          {activeTab === 'sellers' && (
            <div className="space-y-2.5">
              <div className="text-xs text-slate-600 mb-2 flex items-center justify-between">
                <span>
                  All prices updated in real-time. Choose a seller to checkout at verified lowest price.
                </span>
                <span className="text-emerald-700 font-semibold text-[11px]">
                  ✓ Best Price Guarantee
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs bg-white rounded-lg border border-slate-200 overflow-hidden">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">Seller / Platform</th>
                      <th className="py-2.5 px-3">Price</th>
                      <th className="py-2.5 px-3">Delivery / ETA</th>
                      <th className="py-2.5 px-3">Available Offers & Coupon</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {item.sellerQuotes.map((quote) => {
                      const diff = quote.price - item.primaryPrice;
                      return (
                        <tr
                          key={quote.id}
                          className={`hover:bg-slate-50 transition-colors ${
                            quote.isLowest ? 'bg-orange-50/20' : ''
                          }`}
                        >
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{quote.sellerName}</span>
                              {quote.isLiveScraped && (
                                <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-1.5 py-0.2 rounded-full flex items-center gap-0.5">
                                  <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                                  <span>Live</span>
                                </span>
                              )}
                              {quote.badge && (
                                <span className="text-[10px] font-semibold text-orange-700 bg-orange-100 px-1.5 py-0.2 rounded-sm">
                                  {quote.badge}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <div className="font-mono font-bold text-slate-900 text-sm tabular-nums">
                              ₹{quote.price.toLocaleString('en-IN')}
                            </div>
                            {diff > 0 ? (
                              <span className="text-[10px] text-slate-400">
                                +₹{diff.toLocaleString('en-IN')}
                              </span>
                            ) : (
                              <span className="text-[10px] text-emerald-600 font-semibold">
                                Best Price
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3 text-slate-600">
                            <div>{quote.deliveryOrEta || 'Standard'}</div>
                            {quote.scrapedLocation && (
                              <div className="text-[10px] text-emerald-700 font-medium">📍 {quote.scrapedLocation}</div>
                            )}
                          </td>

                          <td className="py-3 px-3">
                            <div className="space-y-1">
                              {quote.cashbackText && (
                                <div className="text-[11px] text-emerald-700 font-semibold">
                                  {quote.cashbackText}
                                </div>
                              )}
                              {quote.couponCode && (
                                <button
                                  type="button"
                                  onClick={(e) => handleCopyCoupon(quote.couponCode!, e)}
                                  className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 px-2 py-0.5 rounded-sm border border-slate-200 transition-colors"
                                >
                                  {copiedCoupon === quote.couponCode ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-600" />
                                      <span className="text-emerald-700 font-bold">Copied!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3 text-slate-400" />
                                      <span>{quote.couponCode}</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => startRedirection(item, quote)}
                              className="py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-md shadow-2xs transition-colors inline-flex items-center gap-1 cursor-pointer"
                            >
                              <span>
                                {item.vertical === 'loans'
                                  ? 'Check Eligibility'
                                  : item.vertical === 'insurance'
                                  ? 'Instant Match'
                                  : 'Select Deal'}
                              </span>
                              <span className="text-[10px] text-orange-300 font-bold">
                                {item.vertical === 'loans' || item.vertical === 'insurance' ? 'Instant' : 'Direct'}
                              </span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: PRICE TREND & PREDICTION CHART */}
          {activeTab === 'trend' && (
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">
                    Real-time Price History (Last 30 Days)
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Historical Low: <strong className="text-emerald-600 font-mono">₹{item.pricePrediction.historicalLow.toLocaleString('en-IN')}</strong> · Historical High: <strong className="text-slate-700 font-mono">₹{item.pricePrediction.historicalHigh.toLocaleString('en-IN')}</strong>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => openPriceAlertModal(item)}
                  className="px-3 py-1.5 text-xs font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg transition-colors cursor-pointer"
                >
                  Set Custom Target Alert
                </button>
              </div>

              {/* Sparkline Price Graph */}
              <div className="py-2">
                <div className="h-32 w-full flex items-end gap-3 sm:gap-6 pt-6 pb-2 px-2">
                  {history.map((pt, index) => {
                    const heightPercent = Math.max(
                      15,
                      Math.min(100, Math.round(((pt.price - minPrice) / priceRange) * 80 + 20))
                    );
                    const isLatest = index === history.length - 1;

                    return (
                      <div
                        key={index}
                        className="flex-1 flex flex-col items-center gap-1.5 group relative"
                      >
                        {/* Tooltip on Hover */}
                        <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] py-0.5 px-1.5 rounded-sm whitespace-nowrap pointer-events-none z-10 font-mono">
                          ₹{pt.price.toLocaleString('en-IN')}
                        </div>

                        <div className="w-full flex items-end justify-center h-20">
                          <div
                            style={{ height: `${heightPercent}%` }}
                            className={`w-full max-w-[28px] rounded-t-md transition-all ${
                              isLatest
                                ? 'bg-orange-500 shadow-xs'
                                : 'bg-slate-200 group-hover:bg-slate-300'
                            }`}
                          />
                        </div>

                        <span className="text-[10px] text-slate-500 whitespace-nowrap font-medium">
                          {pt.date}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Advice Box */}
              <div className="mt-3 p-3 bg-slate-50 rounded-lg text-xs text-slate-700 border border-slate-100 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900 block font-bold mb-0.5">
                    {item.pricePrediction.headline}
                  </strong>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    {item.pricePrediction.details}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: VERIFIED USER REVIEWS */}
          {activeTab === 'reviews' && (
            <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-black text-slate-900 font-mono">
                      {item.rating}
                    </span>
                    <div className="flex items-center">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-4 h-4 ${
                            s <= Math.round(item.rating)
                              ? 'text-amber-500 fill-amber-400'
                              : 'text-slate-200'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-slate-500 font-medium">
                      Based on {item.reviewCount.toLocaleString('en-IN')} verified customer experiences
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 italic">
                    "{item.sentimentSummary}"
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => openReviewModal(item)}
                  className="px-3.5 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <MessageSquarePlus className="w-3.5 h-3.5" />
                  <span>Write Review (+2 Pts)</span>
                </button>
              </div>

              {/* Criteria Scorecard */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 pb-3">
                {item.criteriaRatings.map((crit, i) => (
                  <div key={i} className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <div className="text-[11px] text-slate-500 font-medium truncate">
                      {crit.name}
                    </div>
                    <div className="text-sm font-bold text-slate-900 font-mono mt-0.5">
                      {crit.score} / 5.0
                    </div>
                  </div>
                ))}
              </div>

              {/* Reviews List */}
              <div className="space-y-3 pt-2">
                <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                  Recent Verified Community Reviews
                </h5>

                {item.reviews.length === 0 ? (
                  <p className="text-xs text-slate-500 py-3">No reviews yet. Be the first to review!</p>
                ) : (
                  item.reviews.map((rev) => (
                    <div
                      key={rev.id}
                      className="p-3.5 rounded-lg border border-slate-100 bg-slate-50/50 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{rev.author}</span>
                          {rev.verifiedPurchase && (
                            <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.2 rounded-sm flex items-center gap-0.5">
                              <ShieldCheck className="w-3 h-3 text-emerald-600" />
                              Verified
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400">{rev.date}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-3 h-3 ${
                              s <= rev.rating
                                ? 'text-amber-500 fill-amber-400'
                                : 'text-slate-200'
                            }`}
                          />
                        ))}
                        <strong className="text-xs text-slate-800 ml-1.5">{rev.title}</strong>
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed">{rev.comment}</p>

                      {(rev.pros || rev.cons) && (
                        <div className="text-[11px] pt-1 space-y-0.5 text-slate-500">
                          {rev.pros && (
                            <div>
                              <strong className="text-emerald-700">Pros:</strong> {rev.pros}
                            </div>
                          )}
                          {rev.cons && (
                            <div>
                              <strong className="text-rose-600">Cons:</strong> {rev.cons}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 4: SPECIFICATIONS */}
          {activeTab === 'specs' && (
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h4 className="text-xs font-bold text-slate-900 mb-3">
                Full Technical & Route Parameters
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {Object.entries(item.specs).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-start justify-between py-1.5 border-b border-slate-100"
                  >
                    <span className="text-slate-500 font-medium">{key}</span>
                    <span className="text-slate-900 font-semibold text-right max-w-[60%]">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lightbox Photo Preview Modal for Image Verticals */}
      {showImagePreview && isImageVertical && (
        <ImagePreviewModal
          item={item}
          onClose={() => setShowImagePreview(false)}
          onSelectDeal={(quote) => startRedirection(item, quote)}
        />
      )}
    </div>
  );
};
