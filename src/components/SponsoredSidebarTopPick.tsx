import React, { useState } from 'react';
import {
  ExternalLink,
  Sparkles,
  ShieldCheck,
  Star,
  Award,
  ArrowRight,
  TrendingDown,
  Tag,
  CheckCircle2,
} from 'lucide-react';
import { VerticalId, UserLocationState } from '../types';
import { useApp } from '../context/AppContext';

interface SponsoredSidebarTopPickProps {
  vertical: VerticalId;
  userLocation?: UserLocationState;
}

interface B2BSponsorData {
  partnerName: string;
  partnerCode: string;
  badgeText: string;
  headline: string;
  offerText: string;
  priceBadge: string;
  perks: string[];
  ctaText: string;
  destinationUrl: string;
  imageUrl: string;
  logoBg: string;
  logoText: string;
  rating: number;
}

const B2B_SPONSORED_DATA: Record<VerticalId, B2BSponsorData> = {
  flights: {
    partnerName: 'MakeMyTrip',
    partnerCode: 'MMT',
    badgeText: 'Sponsored Top Pick',
    headline: 'MakeMyTrip Flight Special',
    offerText: 'Flat ₹2,500 Off on International & ₹1,200 Off Domestic Flights with Code MMTTRY1',
    priceBadge: 'From ₹2,899',
    perks: ['Zero Convenience Fee on Partner Cards', 'Free Date Change Protection'],
    ctaText: 'Book on MakeMyTrip',
    destinationUrl: 'https://www.makemytrip.com/flights/?partner=try1second_b2b',
    imageUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=400&q=80',
    logoBg: 'bg-[#d84e55]',
    logoText: 'MMT',
    rating: 4.9,
  },
  hotels: {
    partnerName: 'Taj Hotels & Palaces',
    partnerCode: 'TAJ',
    badgeText: 'Sponsored Top Pick',
    headline: 'Taj Luxury Heritage Stays',
    offerText: 'Complimentary Suite Upgrade + ₹2,000 Dining Credit on Stays in Goa & Jaipur',
    priceBadge: 'From ₹6,500/night',
    perks: ['Complimentary Gourmet Buffet Breakfast', 'Flexible 24-Hr Free Cancellation'],
    ctaText: 'Reserve on Taj Portal',
    destinationUrl: 'https://www.tajhotels.com?partner=try1second_b2b',
    imageUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=400&q=80',
    logoBg: 'bg-[#8c6239]',
    logoText: 'TAJ',
    rating: 4.9,
  },
  bus: {
    partnerName: 'ZingBus Smart AC',
    partnerCode: 'ZING',
    badgeText: 'Sponsored Top Pick',
    headline: 'ZingBus Multi-Axle Sleeper',
    offerText: 'Flat ₹150 Instant Cashback with Live GPS Satellite Tracking & Emergency SOS',
    priceBadge: 'Seats from ₹499',
    perks: ['Free Lounge Access at Boarding Points', 'Sanitized Blankets & Bottle of Water'],
    ctaText: 'Book ZingBus Sleeper',
    destinationUrl: 'https://www.zingbus.com?ref=try1second_b2b',
    imageUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=400&q=80',
    logoBg: 'bg-emerald-600',
    logoText: 'ZING',
    rating: 4.8,
  },
  ecommerce: {
    partnerName: 'Croma by Tata',
    partnerCode: 'CROMA',
    badgeText: 'Sponsored Top Pick',
    headline: 'Croma Electronics Fest',
    offerText: 'Extra 10% Instant Bank Discount on Laptops, OLED TVs & Noise-Cancelling Headphones',
    priceBadge: 'Up to 50% Off',
    perks: ['5% Tata Neu Coins Rewards', '3-Hour Express Doorstep Delivery'],
    ctaText: 'Shop Croma Deals',
    destinationUrl: 'https://www.croma.com?partner=try1second_b2b',
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=400&q=80',
    logoBg: 'bg-teal-700',
    logoText: 'CR',
    rating: 4.8,
  },
  grocery: {
    partnerName: 'Zepto Quick Fresh',
    partnerCode: 'ZEPTO',
    badgeText: 'Sponsored Top Pick',
    headline: 'Zepto 10-Minute Fresh',
    offerText: 'Flat ₹150 Off + Free 1-Month Delivery Pass for Fresh Produce, Milk & Daily Staples',
    priceBadge: '8-10 Min Delivery',
    perks: ['Zero Surge Fee Guaranteed', 'Fresh Farm QC Certified Produce'],
    ctaText: 'Order on Zepto',
    destinationUrl: 'https://www.zeptonow.com?partner=try1second_b2b',
    imageUrl: 'https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&w=400&q=80',
    logoBg: 'bg-purple-800',
    logoText: 'ZP',
    rating: 4.9,
  },
  food: {
    partnerName: 'Swiggy Gourmet',
    partnerCode: 'SWIGGY',
    badgeText: 'Sponsored Top Pick',
    headline: 'Swiggy Gourmet Kitchens',
    offerText: 'Flat ₹120 Off + Unlimited Free Deliveries on Top 500 Rated Restaurants',
    priceBadge: 'Dishes from ₹199',
    perks: ['VIP Priority Driver Dispatch', 'Zero Rain & Delivery Surge'],
    ctaText: 'Order on Swiggy',
    destinationUrl: 'https://www.swiggy.com?partner=try1second_b2b',
    imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=400&q=80',
    logoBg: 'bg-orange-600',
    logoText: 'SW',
    rating: 4.8,
  },
  movie: {
    partnerName: 'PVR INOX Cinemas',
    partnerCode: 'PVR',
    badgeText: 'Sponsored Top Pick',
    headline: 'PVR INOX Movie Passport',
    offerText: 'Watch 10 Movies for Just ₹699 + 20% Off F&B Popcorn Combos on Weekdays',
    priceBadge: '₹69/ticket deal',
    perks: ['Valid on IMAX 2D & Recliner Seats', 'Direct QR Code Entry at Gate'],
    ctaText: 'Get Movie Passport',
    destinationUrl: 'https://www.pvrcinemas.com?partner=try1second_b2b',
    imageUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=400&q=80',
    logoBg: 'bg-amber-600',
    logoText: 'PVR',
    rating: 4.7,
  },
  loans: {
    partnerName: 'HDFC Bank Lending',
    partnerCode: 'HDFC',
    badgeText: 'Sponsored Top Pick',
    headline: 'HDFC EasyLoan Pre-Approved',
    offerText: 'Instant Paperless Personal Loan Disbursal in 10 Seconds directly to your account',
    priceBadge: '10.25% p.a. APR',
    perks: ['Zero Foreclosure Prepayment Penalty', 'No Branch Visit Required'],
    ctaText: 'Apply on HDFC Bank',
    destinationUrl: 'https://www.hdfcbank.com/personal/borrow/popular-loans/personal-loan?partner=try1second_b2b',
    imageUrl: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=400&q=80',
    logoBg: 'bg-blue-900',
    logoText: 'HDFC',
    rating: 4.9,
  },
  insurance: {
    partnerName: 'Acko Direct Cover',
    partnerCode: 'ACKO',
    badgeText: 'Sponsored Top Pick',
    headline: 'Acko 100% Digital Health',
    offerText: '₹1 Crore Cashless Health Insurance Shield with Zero Room Rent Limit & No Paperwork',
    priceBadge: 'From ₹390/month',
    perks: ['100% Cashless at 12,000+ Hospitals', 'Instant In-App Claim Settlement'],
    ctaText: 'Get Quote on Acko',
    destinationUrl: 'https://www.acko.com?partner=try1second_b2b',
    imageUrl: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=400&q=80',
    logoBg: 'bg-purple-900',
    logoText: 'ACKO',
    rating: 4.8,
  },
  cab: {
    partnerName: 'BluSmart EV Mobility',
    partnerCode: 'BLUSMART',
    badgeText: 'Sponsored Top Pick',
    headline: 'BluSmart 100% EV Cabs',
    offerText: 'Zero Surge Pricing Ever · Zero Driver Cancellations · Premium Quiet Electric Sedans',
    priceBadge: 'Rides from ₹99',
    perks: ['On-Time Arrival Guarantee', 'Pre-Cooled AC Clean Interior'],
    ctaText: 'Book on BluSmart',
    destinationUrl: 'https://blu-smart.com?partner=try1second_b2b',
    imageUrl: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=400&q=80',
    logoBg: 'bg-cyan-700',
    logoText: 'BLU',
    rating: 4.9,
  },
};

export const SponsoredSidebarTopPick: React.FC<SponsoredSidebarTopPickProps> = ({
  vertical,
  userLocation,
}) => {
  const { addToast } = useApp();
  const [isRedirecting, setIsRedirecting] = useState<boolean>(false);

  const sponsor = B2B_SPONSORED_DATA[vertical] || B2B_SPONSORED_DATA.flights;

  const handleRedirect = () => {
    setIsRedirecting(true);
    addToast(
      'info',
      `Connecting to ${sponsor.partnerName}`,
      `Activating Try1Second B2B Sponsored Top Pick rate for ${sponsor.headline}...`
    );

    setTimeout(() => {
      window.open(sponsor.destinationUrl, '_blank', 'noopener,noreferrer');
      setIsRedirecting(false);
    }, 800);
  };

  return (
    <div className="w-full">
      {/* Clear Visual Divider between functional filters and sponsored advertisement */}
      <div className="pt-2 pb-3">
        <div className="relative flex items-center justify-center">
          <div className="w-full border-t border-slate-200" />
          <span className="absolute bg-slate-50 px-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Sponsored Partner
          </span>
        </div>
      </div>

      {/* Responsive LHS Sidebar Card with Subtle Premium Gold / Brand Highlight */}
      <div className="w-full bg-gradient-to-b from-amber-50/90 via-amber-50/40 to-orange-50/60 rounded-2xl border border-amber-300/80 shadow-xs hover:border-amber-400 hover:shadow-md transition-all p-4 space-y-3 relative overflow-hidden group">
        {/* Decorative subtle gold light badge on corner */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-400/10 rounded-full blur-xl pointer-events-none" />

        {/* Top Header Row with Badge & Partner Logo */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* Compact Brand Badge */}
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-2xs text-white ${sponsor.logoBg}`}
            >
              <span>{sponsor.logoText}</span>
            </div>

            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-900 block truncate leading-tight">
                {sponsor.partnerName}
              </span>
              <div className="flex items-center gap-1 text-[11px] text-amber-700 font-semibold mt-0.5">
                <Star className="w-3 h-3 text-amber-500 fill-amber-400" />
                <span>{sponsor.rating}</span>
                <span className="text-[10px] text-slate-400">· Verified</span>
              </div>
            </div>
          </div>

          {/* Premium Sponsored Badge */}
          <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-slate-950 bg-gradient-to-r from-amber-400 to-amber-300 border border-amber-400 px-2 py-0.5 rounded-full shadow-2xs shrink-0">
            <Sparkles className="w-2.5 h-2.5 fill-slate-950" />
            <span>Top Pick</span>
          </span>
        </div>

        {/* Compact Visual Image Strip */}
        <div className="relative h-24 w-full rounded-xl overflow-hidden border border-amber-200/80 bg-slate-100 shadow-2xs">
          <img
            src={sponsor.imageUrl}
            alt={sponsor.headline}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent flex items-end p-2">
            <span className="text-white text-[11px] font-bold truncate leading-tight drop-shadow-xs">
              {sponsor.headline}
            </span>
          </div>
        </div>

        {/* Short Offer / Price Text */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1">
              <Tag className="w-3 h-3 text-orange-600" />
              <span>Exclusive Rate</span>
            </span>
            <span className="text-xs font-mono font-black text-slate-950 bg-white px-2 py-0.5 rounded-md border border-amber-200">
              {sponsor.priceBadge}
            </span>
          </div>

          <p className="text-xs text-slate-700 font-medium leading-snug line-clamp-2">
            {sponsor.offerText}
          </p>
        </div>

        {/* Perks Checklist */}
        <div className="space-y-1 pt-1 border-t border-amber-200/60 text-[11px] text-slate-600">
          {sponsor.perks.map((p, idx) => (
            <div key={idx} className="flex items-center gap-1.5 truncate">
              <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
              <span className="truncate">{p}</span>
            </div>
          ))}
        </div>

        {/* Prominent Full-Width Call-to-Action (CTA) Button */}
        <button
          type="button"
          disabled={isRedirecting}
          onClick={handleRedirect}
          className="w-full py-2.5 px-3 bg-gradient-to-r from-orange-600 via-amber-600 to-orange-600 hover:from-orange-700 hover:to-amber-700 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-75 active:scale-[0.99]"
        >
          {isRedirecting ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Connecting...</span>
            </>
          ) : (
            <>
              <span>{sponsor.ctaText}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </>
          )}
        </button>

        {/* Subtext info */}
        <div className="flex items-center justify-between text-[10px] text-slate-400 px-0.5">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            Verified B2B Sponsor
          </span>
          <span>Zero Extra Fee</span>
        </div>
      </div>
    </div>
  );
};
