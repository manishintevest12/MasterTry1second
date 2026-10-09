import React, { useState } from 'react';
import {
  ExternalLink,
  Star,
  Sparkles,
  ShieldCheck,
  Info,
  Heart,
  Share2,
  ChevronDown,
  ChevronUp,
  MapPin,
  Check,
} from 'lucide-react';
import { VerticalId, UserLocationState } from '../types';
import { useApp } from '../context/AppContext';

interface NativeAdCardProps {
  vertical: VerticalId;
  userLocation?: UserLocationState;
}

interface AdData {
  adSlotId: string;
  advertiser: string;
  adTitle: string;
  adSubtitle: string;
  category: string;
  rating: number;
  reviewCount: number;
  provider: string;
  providerLogoText: string;
  logoBg: string;
  logoColor: string;
  primaryPrice: number;
  originalPrice: number;
  unit: string;
  savingsText: string;
  features: string[];
  destinationUrl: string;
  imageUrl?: string;
  ctaText: string;
}

const VERTICAL_ADS: Record<VerticalId, AdData> = {
  flights: {
    adSlotId: 't1s-adsense-flights-01',
    advertiser: 'Cleartrip Flight SuperSaver',
    adTitle: 'Domestic & International Flight SuperSaver Pass',
    adSubtitle: 'Flat ₹2,500 Off with HDFC & ICICI Cards + Free Date Reschedule',
    category: 'Featured Travel Partner',
    rating: 4.8,
    reviewCount: 14200,
    provider: 'Cleartrip',
    providerLogoText: 'CT',
    logoBg: 'bg-orange-600',
    logoColor: 'text-white',
    primaryPrice: 2499,
    originalPrice: 4999,
    unit: 'exclusive sponsor fare',
    savingsText: 'Save ₹2,500 with Bank Offer',
    features: ['Zero Convenience Fee on First 2 Bookings', 'Free Reschedule Protection', 'Instant E-Ticket SMS'],
    destinationUrl: 'https://www.cleartrip.com/flights?ref=try1second_adsense',
    ctaText: 'Claim Flight Offer',
  },
  hotels: {
    adSlotId: 't1s-adsense-hotels-01',
    advertiser: 'Booking.com Genius VIP',
    adTitle: '5-Star Luxury Resorts & Heritage Boutique Stays',
    adSubtitle: 'Complimentary Buffet Breakfast + 20% Off on Taj, Marriott & Hyatt',
    category: 'Genius Hotel Partner',
    rating: 4.9,
    reviewCount: 28900,
    provider: 'Booking.com',
    providerLogoText: 'BK',
    logoBg: 'bg-blue-900',
    logoColor: 'text-white',
    primaryPrice: 3899,
    originalPrice: 6500,
    unit: 'per night + tax included',
    savingsText: 'Save ₹2,601 (40% Off)',
    features: ['Complimentary Buffet Breakfast', 'Free Late Check-out to 4 PM', 'Zero Cancellation Penalty'],
    destinationUrl: 'https://www.booking.com?aid=try1second_adsense',
    imageUrl: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=600&q=80',
    ctaText: 'Book VIP Stay',
  },
  bus: {
    adSlotId: 't1s-adsense-bus-01',
    advertiser: 'redBus Prime Plus',
    adTitle: 'Luxury AC Multi-Axle Sleeper & Volvo Intercity Express',
    adSubtitle: 'Live GPS Satellite Tracking · Sanitized Blankets & Individual Charging',
    category: 'Prime Coach Partner',
    rating: 4.7,
    reviewCount: 18400,
    provider: 'redBus Prime',
    providerLogoText: 'RB',
    logoBg: 'bg-red-600',
    logoColor: 'text-white',
    primaryPrice: 699,
    originalPrice: 1199,
    unit: 'single lower berth',
    savingsText: 'Save ₹500 Today',
    features: ['Live GPS Tracking for Family', 'Emergency SOS on Board', 'Free Water & Snack Kit'],
    destinationUrl: 'https://www.redbus.in?partner=try1second_adsense',
    ctaText: 'Book Prime Seat',
  },
  ecommerce: {
    adSlotId: 't1s-adsense-ecom-01',
    advertiser: 'Amazon India Prime Deals',
    adTitle: 'Flagship Electronics & Gadgets Flash Sale',
    adSubtitle: 'Up to 45% Off on Apple iPhone 16, Sony WH-1000XM5, & M3 MacBooks',
    category: 'Official Shopping Sponsor',
    rating: 4.9,
    reviewCount: 42100,
    provider: 'Amazon India',
    providerLogoText: 'AMZ',
    logoBg: 'bg-[#232f3e]',
    logoColor: 'text-amber-400',
    primaryPrice: 19999,
    originalPrice: 29999,
    unit: 'free 1-day delivery',
    savingsText: 'Save ₹10,000 + No-Cost EMI',
    features: ['Prime Same-Day Delivery', '1-Year Official Brand Warranty', '7-Day Hassle-Free Replacement'],
    destinationUrl: 'https://www.amazon.in?tag=try1second_adsense-21',
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80',
    ctaText: 'Shop Prime Deals',
  },
  grocery: {
    adSlotId: 't1s-adsense-grocery-01',
    advertiser: 'Zepto Daily Pass Special',
    adTitle: 'Farm-Fresh Alphonso Mangoes, Organic Milk & Breakfast Basket',
    adSubtitle: '10-Minute Doorstep Delivery Guarantee with Zero Surge Pricing',
    category: 'Quick Commerce Sponsor',
    rating: 4.8,
    reviewCount: 32000,
    provider: 'Zepto Daily',
    providerLogoText: 'ZP',
    logoBg: 'bg-purple-900',
    logoColor: 'text-white',
    primaryPrice: 199,
    originalPrice: 399,
    unit: '10-min doorstep ETA',
    savingsText: 'Flat 50% Off Welcome Basket',
    features: ['Delivered in 8-12 Minutes', 'Cold-Chain Fresh Produce', 'Zero Delivery Fee with Pass'],
    destinationUrl: 'https://www.zeptonow.com?ref=try1second_adsense',
    imageUrl: 'https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&w=600&q=80',
    ctaText: 'Get 10-Min Delivery',
  },
  food: {
    adSlotId: 't1s-adsense-food-01',
    advertiser: 'Zomato Gold Gourmet',
    adTitle: 'Royal Hyderabadi Dum Biryani & Kebabs Feast Pack',
    adSubtitle: 'Unlimited Free Delivery + Extra 25% Off at Top-Rated Cloud Kitchens',
    category: 'Food Delivery Partner',
    rating: 4.8,
    reviewCount: 38700,
    provider: 'Zomato Gold',
    providerLogoText: 'ZG',
    logoBg: 'bg-red-600',
    logoColor: 'text-white',
    primaryPrice: 349,
    originalPrice: 599,
    unit: 'serves 2-3 people',
    savingsText: 'Save ₹250 with Code GOLD25',
    features: ['Zero Delivery Surge', 'Complimentary Gulab Jamuns', 'VIP Priority Delivery Allocation'],
    destinationUrl: 'https://www.zomato.com?partner=try1second_adsense',
    imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80',
    ctaText: 'Order Sponsored Deal',
  },
  movie: {
    adSlotId: 't1s-adsense-movie-01',
    advertiser: 'BookMyShow Blockbuster Weekend',
    adTitle: 'IMAX 3D & 4DX Weekend Movie Tickets',
    adSubtitle: 'Buy 1 Get 1 Free on Blockbuster Titles with Partner Credit Cards',
    category: 'Cinema Entertainment Sponsor',
    rating: 4.7,
    reviewCount: 19500,
    provider: 'BookMyShow',
    providerLogoText: 'BMS',
    logoBg: 'bg-rose-700',
    logoColor: 'text-white',
    primaryPrice: 250,
    originalPrice: 500,
    unit: '2 tickets combo',
    savingsText: 'Buy 1 Get 1 Free',
    features: ['IMAX Laser Dolby Atmos', 'Recliner Premium Seating', 'Free Snack Popcorn Coupon'],
    destinationUrl: 'https://in.bookmyshow.com?ref=try1second_adsense',
    imageUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=600&q=80',
    ctaText: 'Claim 1+1 Tickets',
  },
  loans: {
    adSlotId: 't1s-adsense-loans-01',
    advertiser: 'HDFC Bank EasyEMI Instant Loan',
    adTitle: 'Pre-Approved Instant Personal Loan with Paperless KYC',
    adSubtitle: 'Disbursal in 10 seconds to your bank account · Attractive 10.25% APR',
    category: 'Banking & Lending Sponsor',
    rating: 4.9,
    reviewCount: 15300,
    provider: 'HDFC Bank',
    providerLogoText: 'HDFC',
    logoBg: 'bg-blue-900',
    logoColor: 'text-white',
    primaryPrice: 1025,
    originalPrice: 1350,
    unit: 'p.a. starting APR',
    savingsText: 'Lowest APR · Zero Foreclosure',
    features: ['Instant 100% Digital Approval', 'No Physical Paperwork Required', 'Flexible Tenure up to 60 Months'],
    destinationUrl: 'https://www.hdfcbank.com/personal/borrow/popular-loans/personal-loan?partner=try1second_adsense',
    ctaText: 'Check Loan Eligibility',
  },
  insurance: {
    adSlotId: 't1s-adsense-insurance-01',
    advertiser: 'PolicyBazaar Comprehensive Health Cover',
    adTitle: '₹1 Crore Cashless Health Insurance Shield',
    adSubtitle: 'Zero room rent capping · Cashless treatment across 14,000+ top hospitals',
    category: 'Verified IRDAI Partner',
    rating: 4.9,
    reviewCount: 24600,
    provider: 'PolicyBazaar',
    providerLogoText: 'PB',
    logoBg: 'bg-blue-700',
    logoColor: 'text-white',
    primaryPrice: 490,
    originalPrice: 750,
    unit: 'per month cashless cover',
    savingsText: 'Save ₹3,120 Annually',
    features: ['99.1% Claim Settlement Ratio', 'Zero Co-Payment on Hospitalization', 'Free Annual Full-Body Health Check'],
    destinationUrl: 'https://www.policybazaar.com?utm_source=try1second_adsense',
    ctaText: 'View 1-Cr Quotes',
  },
  cab: {
    adSlotId: 't1s-adsense-cab-01',
    advertiser: 'Uber Premier Airport Express',
    adTitle: 'Priority AC Sedan Airport & Intercity Transfers',
    adSubtitle: 'Flat 20% Off on Airport Pickups · Guaranteed Zero Driver Cancellation',
    category: 'Rideshare Partner',
    rating: 4.8,
    reviewCount: 21900,
    provider: 'Uber Premier',
    providerLogoText: 'UBER',
    logoBg: 'bg-black',
    logoColor: 'text-white',
    primaryPrice: 450,
    originalPrice: 650,
    unit: 'sedan with AC on',
    savingsText: 'Save ₹200 on Airport Ride',
    features: ['Top-Rated Chauffeur Drivers', 'No Surge Pricing Guarantee', 'Live GPS Tracking & Share Trip'],
    destinationUrl: 'https://www.uber.com/in/en/?partner=try1second_adsense',
    ctaText: 'Book Premier Ride',
  },
};

export const NativeAdCard: React.FC<NativeAdCardProps> = ({ vertical, userLocation }) => {
  const { addToast } = useApp();
  const [showAdChoicesInfo, setShowAdChoicesInfo] = useState<boolean>(false);
  const [expanded, setExpanded] = useState<boolean>(false);

  const ad = VERTICAL_ADS[vertical] || VERTICAL_ADS.flights;
  const isImageAd = Boolean(ad.imageUrl);

  const handleAdClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToast(
      'info',
      `Connecting to ${ad.advertiser}`,
      'Redirecting via Google AdSense native ad unit to partner portal...'
    );
    window.open(ad.destinationUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      data-ad-client="ca-pub-try1second-native"
      data-ad-slot={ad.adSlotId}
      className="bg-white rounded-xl border-2 border-amber-300/80 shadow-xs hover:border-amber-400 hover:shadow-md transition-all overflow-hidden mb-4 relative"
    >
      {/* Top Ad Identification Bar */}
      <div className="bg-amber-50/70 border-b border-amber-200/60 px-4 py-1.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          {/* Subtle Sponsored / Ad Tag */}
          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-950 bg-amber-200/90 border border-amber-300 px-2 py-0.5 rounded-md shadow-2xs">
            Ad · Sponsored
          </span>
          <span className="text-[11px] text-slate-600 font-semibold truncate max-w-[200px] sm:max-w-xs">
            {ad.advertiser}
          </span>
        </div>

        {/* Google AdChoices Attribution */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowAdChoicesInfo(!showAdChoicesInfo)}
            className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            title="Ad served by Google AdSense"
          >
            <span>Google AdChoices</span>
            <Info className="w-3 h-3 text-slate-400" />
          </button>

          {showAdChoicesInfo && (
            <div className="absolute right-0 top-full mt-1 w-64 bg-slate-900 text-white rounded-xl p-3 shadow-xl z-50 text-[11px] leading-relaxed animate-in fade-in zoom-in-95">
              <strong className="block text-amber-300 mb-1 font-bold">Google AdSense Native Unit</strong>
              This sponsored recommendation is customized for the <strong>{vertical}</strong> vertical to monetize search comparisons while maintaining transparent deal listings.
              <div className="mt-2 pt-2 border-t border-slate-700 flex justify-between text-[10px]">
                <span className="text-slate-400">Slot: #{ad.adSlotId}</span>
                <button
                  type="button"
                  onClick={() => setShowAdChoicesInfo(false)}
                  className="text-amber-400 font-bold hover:underline"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Card Content (Exact Mirror of ComparisonCard) */}
      <div className="p-4 sm:p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Left Information */}
        <div className="flex-1">
          {/* Top Metadata */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                {ad.category}
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-xs font-medium text-slate-600 flex items-center gap-1">
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                <strong className="text-slate-900 font-bold">{ad.rating}</strong>
                <span className="text-slate-400">({ad.reviewCount.toLocaleString('en-IN')})</span>
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100/90 border border-emerald-300 px-2 py-0.5 rounded-full shadow-2xs flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-600" />
                <span>Featured Partner</span>
              </span>

              {userLocation?.city && (
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                  <MapPin className="w-3 h-3 text-red-500" />
                  <span>Valid in {userLocation.city}</span>
                </span>
              )}
            </div>
          </div>

          {/* Visual Entity Row: Image or Logo */}
          {isImageAd && ad.imageUrl ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div
                onClick={handleAdClick}
                className="w-full sm:w-44 md:w-48 h-32 shrink-0 relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer shadow-2xs group"
              >
                <img
                  src={ad.imageUrl}
                  alt={ad.adTitle}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                <div className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-md">
                  {ad.provider}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <h3
                  onClick={handleAdClick}
                  className="text-base font-bold text-slate-900 leading-tight hover:text-orange-600 transition-colors cursor-pointer"
                >
                  {ad.adTitle}
                </h3>
                <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">
                  {ad.adSubtitle}
                </p>

                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-2.5">
                  {ad.features.map((feat, i) => (
                    <span key={i} className="flex items-center gap-1 font-medium">
                      {i > 0 && <span className="text-slate-300">·</span>}
                      <span>{feat}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-start sm:items-center gap-4">
              {/* Brand Logo */}
              <div className="flex flex-col items-center justify-center shrink-0">
                <div
                  className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex flex-col items-center justify-center font-black text-center shadow-2xs border border-slate-200/80 relative overflow-hidden ${ad.logoBg} ${ad.logoColor}`}
                >
                  <span className="text-base sm:text-lg font-black tracking-tight leading-none px-1">
                    {ad.providerLogoText}
                  </span>
                  <span className="text-[9px] uppercase tracking-wider opacity-90 mt-1 font-semibold truncate max-w-[65px] px-1">
                    {ad.provider}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-amber-800 mt-1 px-1.5 py-0.5 rounded bg-amber-100 text-center max-w-[85px] truncate">
                  Sponsored
                </span>
              </div>

              {/* Text Info */}
              <div className="flex-1 min-w-0">
                <h3
                  onClick={handleAdClick}
                  className="text-base font-bold text-slate-900 leading-tight hover:text-orange-600 transition-colors cursor-pointer"
                >
                  {ad.adTitle}
                </h3>
                <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">
                  {ad.adSubtitle}
                </p>

                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-2.5">
                  {ad.features.map((feat, i) => (
                    <span key={i} className="flex items-center gap-1 font-medium">
                      {i > 0 && <span className="text-slate-300">·</span>}
                      <span>{feat}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Zone: Pricing & CTA */}
        <div className="md:w-64 shrink-0 flex flex-col items-start md:items-end justify-center pt-3 md:pt-0 border-t md:border-t-0 md:border-l border-slate-100 md:pl-6">
          <div className="flex md:flex-col items-baseline md:items-end justify-between w-full md:w-auto gap-1">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-2xl font-extrabold text-slate-900 font-mono tracking-tight tabular-nums">
                  ₹{ad.primaryPrice.toLocaleString('en-IN')}
                </span>
                {ad.originalPrice > ad.primaryPrice && (
                  <span className="text-xs text-slate-400 line-through tabular-nums font-mono">
                    ₹{ad.originalPrice.toLocaleString('en-IN')}
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-500 font-medium block md:text-right">
                {ad.unit}
              </span>
            </div>

            {ad.savingsText && (
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-sm">
                {ad.savingsText}
              </span>
            )}
          </div>

          {/* Primary CTA */}
          <div className="w-full mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={handleAdClick}
              className="flex-1 py-2.5 px-4 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-bold text-xs rounded-lg shadow-xs hover:shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>{ad.ctaText}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 transition-colors cursor-pointer"
              title="Show sponsor specifications & details"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          <div className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            <span>Verified Official Partner URL</span>
          </div>
        </div>
      </div>

      {/* Expandable Ad Details Drawer */}
      {expanded && (
        <div className="bg-slate-50/90 border-t border-slate-200 p-4 animate-in fade-in duration-150 text-xs">
          <div className="max-w-3xl space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <Sparkles className="w-3.5 h-3.5 text-orange-600" />
              <span>Sponsor Highlights & Redemption Terms:</span>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-slate-600 text-[11px]">
              {ad.features.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
              <li>Exclusive promotional rate provided by {ad.provider} via Google AdSense programmatic network.</li>
              <li>Offer synchronized in real-time with Try1Second sub-second price radar.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
