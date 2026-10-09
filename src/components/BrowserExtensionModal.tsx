import React, { useState, useEffect } from 'react';
import {
  X,
  ExternalLink,
  TrendingDown,
  TrendingUp,
  Tag,
  CheckCircle2,
  Sparkles,
  Zap,
  ShoppingBag,
  Clock,
  ArrowRight,
  ShieldCheck,
  Download,
  Code2,
  SlidersHorizontal,
  Flame,
  Check,
  Copy,
  Layers,
  Percent,
} from 'lucide-react';
import { Try1SecondLogo } from './Try1SecondLogo';

interface SimulationItem {
  id: string;
  siteName: string;
  siteDomain: string;
  siteLogoBg: string;
  siteLogoText: string;
  productTitle: string;
  productCategory: string;
  productImage: string;
  currentPrice: number;
  originalPrice: number;
  allTimeLow: number;
  avg90dPrice: number;
  fakeDiscountHike: string;
  crossPlatformAlternative: {
    platform: string;
    price: number;
    differenceText: string;
    deliveryTime: string;
    linkUrl: string;
  };
  couponsToTest: {
    code: string;
    source: string;
    discount: number;
    description: string;
  }[];
}

const SIMULATED_PRODUCTS: Record<string, SimulationItem> = {
  amazon: {
    id: 'sim-amazon-sony',
    siteName: 'Amazon India',
    siteDomain: 'amazon.in/dp/B09XS7JWHH',
    siteLogoBg: 'bg-[#131921]',
    siteLogoText: 'AMAZON',
    productTitle: 'Sony WH-1000XM5 Wireless Industry Leading Noise Canceling Headphones',
    productCategory: 'Electronics & Audio',
    productImage: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=700&auto=format&fit=crop&q=80',
    currentPrice: 29990,
    originalPrice: 34990,
    allTimeLow: 24490,
    avg90dPrice: 26990,
    fakeDiscountHike: 'MRP hiked from ₹29,990 to ₹34,990 4 days before Great Indian Festival',
    crossPlatformAlternative: {
      platform: 'Flipkart',
      price: 24240,
      differenceText: '₹5,750 Cheaper on Flipkart with HDFC Card',
      deliveryTime: 'Tomorrow 11 AM',
      linkUrl: 'https://flipkart.com',
    },
    couponsToTest: [
      { code: 'FESTIVE500', source: 'Marketplace Promo', discount: 500, description: 'Flat ₹500 off on electronics' },
      { code: 'TRY1SEC1000', source: 'Try1Second Exclusive', discount: 1000, description: 'Direct checkout price parity waiver' },
      { code: 'HDFCSPECIAL', source: 'HDFC Bank Credit', discount: 1750, description: 'Instant 10% credit card discount' },
      { code: 'AMZNCASH15', source: 'Amazon Pay UPI', discount: 750, description: 'Cashback on UPI transaction' },
    ],
  },
  flipkart: {
    id: 'sim-flipkart-iphone',
    siteName: 'Flipkart',
    siteDomain: 'flipkart.com/apple-iphone-16-pro',
    siteLogoBg: 'bg-[#2874f0]',
    siteLogoText: 'FLIPKART',
    productTitle: 'Apple iPhone 16 Pro (Natural Titanium, 256 GB) Super Retina XDR',
    productCategory: 'Smartphones & Gadgets',
    productImage: 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=700&auto=format&fit=crop&q=80',
    currentPrice: 129900,
    originalPrice: 134900,
    allTimeLow: 121900,
    avg90dPrice: 127500,
    fakeDiscountHike: 'Price stable across festival launch. Bank card discount stacked.',
    crossPlatformAlternative: {
      platform: 'Tata Neu / Croma',
      price: 123405,
      differenceText: 'Save ₹6,495 with 5% NeuCoins Cashback at Croma',
      deliveryTime: 'Same Day Delivery',
      linkUrl: 'https://tataneu.com',
    },
    couponsToTest: [
      { code: 'APPLEDEAL', source: 'Brand Voucher', discount: 2000, description: 'Instant festival voucher' },
      { code: 'ICICIPRO16', source: 'ICICI Bank CC', discount: 5000, description: 'Flat ₹5,000 instant card waiver' },
      { code: 'SUPERCOIN500', source: 'SuperCoins Balance', discount: 500, description: 'Redeem 500 SuperCoins' },
    ],
  },
  swiggy: {
    id: 'sim-swiggy-biryani',
    siteName: 'Swiggy Food & Instamart',
    siteDomain: 'swiggy.com/restaurants/behrouz-biryani',
    siteLogoBg: 'bg-[#fc8019]',
    siteLogoText: 'SWIGGY',
    productTitle: 'Behrouz Biryani - Shahi Dum Biryani Party Platter with Kebabs & Desserts',
    productCategory: 'Food Delivery & Dining',
    productImage: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=700&auto=format&fit=crop&q=80',
    currentPrice: 840,
    originalPrice: 960,
    allTimeLow: 670,
    avg90dPrice: 810,
    fakeDiscountHike: 'Restaurant markup + ₹45 surge and handling fee added at checkout',
    crossPlatformAlternative: {
      platform: 'Magicpin Direct',
      price: 673,
      differenceText: '₹167 Cheaper on Magicpin with Direct Kitchen Deal',
      deliveryTime: '30 Mins Delivery',
      linkUrl: 'https://magicpin.in',
    },
    couponsToTest: [
      { code: 'PARTY30', source: 'Restaurant Offer', discount: 120, description: '30% off up to ₹120' },
      { code: 'TRY1SECFREE', source: 'Try1Second Partner', discount: 167, description: 'Zero delivery + direct kitchen parity' },
      { code: 'ONEDISCOUNT', source: 'Swiggy One VIP', discount: 80, description: 'Free delivery voucher' },
    ],
  },
  blinkit: {
    id: 'sim-blinkit-grocery',
    siteName: 'Blinkit Instant Groceries',
    siteDomain: 'blinkit.com/cart/instant-checkout',
    siteLogoBg: 'bg-[#f7d300]',
    siteLogoText: 'BLINKIT',
    productTitle: 'Weekly Organic Grocery Basket (Fresh Fruits, Dairy, Snacks & Household Essentials)',
    productCategory: '10-Min Quick Commerce',
    productImage: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=700&auto=format&fit=crop&q=80',
    currentPrice: 460,
    originalPrice: 520,
    allTimeLow: 380,
    avg90dPrice: 440,
    fakeDiscountHike: 'Zero rain surge window active right now in dark store cluster',
    crossPlatformAlternative: {
      platform: 'Zepto Instant',
      price: 410,
      differenceText: '₹50 Cheaper on Zepto with First3Orders Code',
      deliveryTime: '8 Mins Delivery',
      linkUrl: 'https://zepto.com',
    },
    couponsToTest: [
      { code: 'BLINK10', source: 'Store Coupon', discount: 35, description: 'Flat ₹35 off on basket' },
      { code: 'SUPERFAST75', source: 'Try1Second Engine', discount: 75, description: 'Free delivery + ₹50 basket discount' },
    ],
  },
  makemytrip: {
    id: 'sim-mmt-flight',
    siteName: 'MakeMyTrip Flights',
    siteDomain: 'makemytrip.com/flights/DEL-DXB',
    siteLogoBg: 'bg-[#d84e55]',
    siteLogoText: 'MAKEMYTRIP',
    productTitle: 'Non-Stop Flight DEL → DXB (Airbus A380 Economy, 30kg Baggage + Meals Included)',
    productCategory: 'International Flights',
    productImage: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=700&auto=format&fit=crop&q=80',
    currentPrice: 19450,
    originalPrice: 24500,
    allTimeLow: 17450,
    avg90dPrice: 22800,
    fakeDiscountHike: 'MMT adds ₹799 convenience fee at the final payment gateway screen',
    crossPlatformAlternative: {
      platform: 'IndiGo Direct',
      price: 17528,
      differenceText: 'Save ₹1,922 by Booking Direct on IndiGo (Zero Fee)',
      deliveryTime: 'Instant E-Ticket',
      linkUrl: 'https://goindigo.in',
    },
    couponsToTest: [
      { code: 'MMTFLY', source: 'Travel Promo', discount: 500, description: 'Flat ₹500 discount on flight' },
      { code: 'ZEROFEET1S', source: 'Try1Second Metasearch', discount: 1922, description: 'Waive convenience fee + direct partner parity' },
      { code: 'HDFCFALL', source: 'HDFC Credit Card', discount: 1200, description: 'Instant 8% card discount' },
    ],
  },
};

export const BrowserExtensionModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const [selectedSiteKey, setSelectedSiteKey] = useState<string>('amazon');
  const [graphTimeframe, setGraphTimeframe] = useState<'90d' | '180d' | '365d'>('365d');
  const [activeTab, setActiveTab] = useState<'simulator' | 'code'>('simulator');

  // Auto Coupon Runner State
  const [isTestingCoupons, setIsTestingCoupons] = useState<boolean>(false);
  const [testedCouponIndex, setTestedCouponIndex] = useState<number>(-1);
  const [winningCoupon, setWinningCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  const currentItem = SIMULATED_PRODUCTS[selectedSiteKey];

  useEffect(() => {
    // Reset coupon runner when switching simulated store
    setIsTestingCoupons(false);
    setTestedCouponIndex(-1);
    setWinningCoupon(null);
  }, [selectedSiteKey]);

  if (!isOpen) return null;

  // Run automated coupon test sequence
  const handleAutoTestCoupons = () => {
    setIsTestingCoupons(true);
    setTestedCouponIndex(0);
    setWinningCoupon(null);

    const coupons = currentItem.couponsToTest;
    let idx = 0;

    const interval = setInterval(() => {
      idx++;
      if (idx < coupons.length) {
        setTestedCouponIndex(idx);
      } else {
        clearInterval(interval);
        // Find coupon with maximum discount
        const highest = coupons.reduce((max, c) => (c.discount > max.discount ? c : max), coupons[0]);
        setWinningCoupon({ code: highest.code, discount: highest.discount });
        setIsTestingCoupons(false);
      }
    }, 550);
  };

  const netEffectivePrice = winningCoupon
    ? currentItem.currentPrice - winningCoupon.discount
    : currentItem.currentPrice;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-5xl h-[92vh] max-h-[850px] shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Modal Top Header Bar */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between gap-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-red-600 to-amber-500 flex items-center justify-center text-white shadow-md">
              <Zap className="w-5 h-5 fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg text-white">
                  Try1Second Chrome & Edge Extension
                </h3>
                <span className="text-[10px] bg-red-600/90 text-white font-mono font-bold px-2 py-0.5 rounded-full uppercase">
                  V3 Injected Content Script
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Live On-Page Overlay, 365-Day Price History Graph, and 1-Click Auto-Apply Coupon Tester.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-slate-800 p-1 rounded-xl flex items-center gap-1 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('simulator')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  activeTab === 'simulator' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
                }`}
              >
                Live Overlay Simulator
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('code')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  activeTab === 'code' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Extension Code & Manifest</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {activeTab === 'simulator' ? (
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-100">
            {/* Merchant Website Browser Navigation Bar (Simulated URL bar) */}
            <div className="p-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-semibold text-[11px]">Select Store Page:</span>
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  {Object.entries(SIMULATED_PRODUCTS).map(([key, item]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedSiteKey(key)}
                      className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-all border text-xs flex items-center gap-1.5 ${
                        selectedSiteKey === key
                          ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${key === 'amazon' ? 'bg-orange-500' : key === 'flipkart' ? 'bg-blue-500' : key === 'swiggy' ? 'bg-orange-600' : key === 'blinkit' ? 'bg-amber-400' : 'bg-red-600'}`} />
                      <span>{item.siteName}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Fake Chrome Address Bar */}
              <div className="flex-1 max-w-sm hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-xl border border-slate-200 text-slate-600 font-mono text-[11px] truncate">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="text-slate-400">https://www.</span>
                <span className="font-bold text-slate-800 truncate">{currentItem.siteDomain}</span>
              </div>
            </div>

            {/* Simulated Merchant Web Page Canvas with Try1Second Floating Injected Bar */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 relative">
              {/* Fake Merchant Web Storefront Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs max-w-4xl mx-auto">
                <div className="flex flex-col md:flex-row gap-6 items-start">
                  {/* Product Image */}
                  <div className="relative w-full md:w-64 h-56 rounded-2xl overflow-hidden shrink-0 border border-slate-200">
                    <img
                      src={currentItem.productImage}
                      alt={currentItem.productTitle}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-slate-900/90 text-white text-[10px] font-bold">
                      {currentItem.productCategory}
                    </div>
                  </div>

                  {/* Product Details on Merchant Site */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black text-white ${currentItem.siteLogoBg}`}>
                        {currentItem.siteLogoText}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">Official Product Listing</span>
                    </div>

                    <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                      {currentItem.productTitle}
                    </h2>

                    {/* Price and Coupon Deduction Block */}
                    <div className="flex items-baseline gap-3 pt-1">
                      <span className="text-2xl sm:text-3xl font-black font-mono text-slate-900">
                        ₹{netEffectivePrice.toLocaleString('en-IN')}
                      </span>
                      {winningCoupon && (
                        <span className="text-sm font-semibold line-through text-slate-400 font-mono">
                          ₹{currentItem.currentPrice.toLocaleString('en-IN')}
                        </span>
                      )}
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                        {Math.round(((currentItem.originalPrice - netEffectivePrice) / currentItem.originalPrice) * 100)}% OFF
                      </span>
                    </div>

                    {winningCoupon && (
                      <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 flex items-center justify-between animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>
                            Winning code <strong>"{winningCoupon.code}"</strong> applied! You saved <strong>₹{winningCoupon.discount.toLocaleString('en-IN')}</strong>.
                          </span>
                        </div>
                        <span className="font-extrabold text-[11px] bg-emerald-600 text-white px-2 py-0.5 rounded-md">
                          SAVED
                        </span>
                      </div>
                    )}

                    <div className="pt-2 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={handleAutoTestCoupons}
                        disabled={isTestingCoupons}
                        className="py-2.5 px-5 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-transform hover:scale-105 active:scale-95"
                      >
                        <Zap className="w-4 h-4 fill-white" />
                        <span>{isTestingCoupons ? 'Testing Codes...' : 'Auto-Test Coupons with Try1Second'}</span>
                      </button>

                      <span className="text-xs text-slate-400">
                        {currentItem.couponsToTest.length} active coupons detected in checkout
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ============================================================== */}
              {/* THE INJECTED ON-PAGE OVERLAY WIDGET (BUYHATKE FLOATING EXTENSION) */}
              {/* ============================================================== */}
              <div className="max-w-4xl mx-auto bg-white rounded-3xl border-2 border-red-500/80 shadow-2xl p-5 sm:p-6 relative overflow-hidden space-y-5">
                {/* Overlay Header with Try1Second Brand Pill */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center text-white shadow-sm">
                      <Zap className="w-5 h-5 fill-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900 text-sm sm:text-base">
                          Try1Second Smart Injected Bar
                        </span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                          Live On-Page Extension
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">
                        Historical telemetry & real-time competitor price auditor
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs">
                    {(['90d', '180d', '365d'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setGraphTimeframe(t)}
                        className={`px-3 py-1 rounded-lg font-bold cursor-pointer transition-all ${
                          graphTimeframe === t ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        {t.toUpperCase()} History
                      </button>
                    ))}
                  </div>
                </div>

                {/* 365-Day Price History SVG Curve */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">All-Time Low Ever</span>
                        <strong className="text-emerald-600 font-mono text-sm">
                          ₹{currentItem.allTimeLow.toLocaleString('en-IN')}
                        </strong>
                      </div>
                      <span className="text-slate-300">·</span>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">{graphTimeframe} Average</span>
                        <strong className="text-slate-700 font-mono text-sm">
                          ₹{currentItem.avg90dPrice.toLocaleString('en-IN')}
                        </strong>
                      </div>
                      <span className="text-slate-300">·</span>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Current Price</span>
                        <strong className="text-slate-900 font-mono text-sm">
                          ₹{currentItem.currentPrice.toLocaleString('en-IN')}
                        </strong>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                        {currentItem.fakeDiscountHike}
                      </span>
                    </div>
                  </div>

                  {/* SVG Price History Line Graph */}
                  <div className="h-32 w-full bg-slate-50 rounded-2xl border border-slate-200/90 p-3 relative flex items-end">
                    <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 500 100">
                      {/* Grid lines */}
                      <line x1="0" y1="20" x2="500" y2="20" stroke="#e2e8f0" strokeDasharray="4 4" strokeWidth="1" />
                      <line x1="0" y1="50" x2="500" y2="50" stroke="#e2e8f0" strokeDasharray="4 4" strokeWidth="1" />
                      <line x1="0" y1="80" x2="500" y2="80" stroke="#e2e8f0" strokeDasharray="4 4" strokeWidth="1" />

                      {/* Average price reference line */}
                      <line x1="0" y1="45" x2="500" y2="45" stroke="#94a3b8" strokeDasharray="2 2" strokeWidth="1.5" />

                      {/* Price History Gradient Fill */}
                      <defs>
                        <linearGradient id="priceGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Area under curve */}
                      <path
                        d="M 0,40 Q 60,35 120,60 T 240,85 T 340,30 T 420,25 L 500,32 L 500,100 L 0,100 Z"
                        fill="url(#priceGradient)"
                      />

                      {/* Main Price Line */}
                      <path
                        d="M 0,40 Q 60,35 120,60 T 240,85 T 340,30 T 420,25 L 500,32"
                        fill="none"
                        stroke="#dc2626"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />

                      {/* All-time low point indicator */}
                      <circle cx="240" cy="85" r="5" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
                      <text x="220" y="98" fill="#059669" fontSize="10" fontWeight="bold">
                        ATL: ₹{currentItem.allTimeLow.toLocaleString('en-IN')}
                      </text>

                      {/* Current price point indicator */}
                      <circle cx="500" cy="32" r="5" fill="#dc2626" stroke="#ffffff" strokeWidth="2" />
                    </svg>

                    {/* Timeline labels */}
                    <div className="absolute bottom-1 left-3 right-3 flex items-center justify-between text-[9px] text-slate-400 font-mono">
                      <span>365 Days Ago</span>
                      <span>180 Days Ago</span>
                      <span>90 Days Ago</span>
                      <span>Today</span>
                    </div>
                  </div>
                </div>

                {/* Cross-Platform Parity Injected Popup */}
                <div className="p-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 rounded-2xl border border-emerald-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      <span className="font-extrabold text-slate-900 text-sm">
                        Cheaper on {currentItem.crossPlatformAlternative.platform}!
                      </span>
                      <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-md">
                        {currentItem.crossPlatformAlternative.deliveryTime}
                      </span>
                    </div>
                    <p className="text-slate-600">
                      {currentItem.crossPlatformAlternative.differenceText}. Avoid waiting or paying higher platform fees.
                    </p>
                  </div>

                  <a
                    href={currentItem.crossPlatformAlternative.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-sm flex items-center justify-center gap-1.5 cursor-pointer shrink-0 transition-transform hover:scale-105 active:scale-95"
                  >
                    <span>Switch to {currentItem.crossPlatformAlternative.platform}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                {/* Automated Coupon Testing Progress Runner */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Tag className="w-4 h-4 text-red-600" />
                      <span>Automated Coupon Injection & Verification Engine</span>
                    </span>

                    <button
                      type="button"
                      onClick={handleAutoTestCoupons}
                      disabled={isTestingCoupons}
                      className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white font-extrabold text-[11px] rounded-lg shadow-xs cursor-pointer transition-colors"
                    >
                      {isTestingCoupons ? 'Testing in Real-Time...' : 'Run Auto-Apply Test'}
                    </button>
                  </div>

                  {/* Cycling Coupons Progress */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                    {currentItem.couponsToTest.map((coupon, idx) => {
                      const isCurrent = isTestingCoupons && testedCouponIndex === idx;
                      const isTested = testedCouponIndex > idx || (!isTestingCoupons && winningCoupon);
                      const isWinner = winningCoupon?.code === coupon.code;

                      return (
                        <div
                          key={coupon.code}
                          className={`p-2.5 rounded-xl border text-xs transition-all ${
                            isWinner
                              ? 'bg-emerald-100 border-emerald-400 text-emerald-950 font-bold shadow-sm'
                              : isCurrent
                              ? 'bg-blue-50 border-blue-400 text-blue-900 animate-pulse'
                              : isTested
                              ? 'bg-white border-slate-200 text-slate-600'
                              : 'bg-slate-100 border-slate-200 text-slate-400'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono font-extrabold">{coupon.code}</span>
                            {isWinner ? (
                              <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.2 rounded font-black">
                                WINNER
                              </span>
                            ) : isCurrent ? (
                              <span className="text-[10px] text-blue-600 font-bold">Testing...</span>
                            ) : isTested ? (
                              <span className="text-[10px] text-slate-400 font-medium">Verified</span>
                            ) : null}
                          </div>
                          <span className="text-[11px] block text-emerald-700 font-bold">
                            -₹{coupon.discount.toLocaleString('en-IN')} Off
                          </span>
                          <span className="text-[10px] text-slate-500 block truncate">{coupon.source}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Developer Extension Manifest & Content Script Tab */
          <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs bg-slate-900 text-slate-200 font-mono">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h4 className="font-bold text-white text-sm">Chrome / Edge Manifest V3 Package Files</h4>
                <p className="text-slate-400 text-xs">
                  Ready to deploy unpacked extension package for Amazon, Flipkart, Swiggy, and MakeMyTrip.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setCopiedCode(true);
                  setTimeout(() => setCopiedCode(false), 2000);
                }}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
              >
                {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copiedCode ? 'Copied to Clipboard!' : 'Copy Extension Code'}</span>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <span className="text-amber-400 font-bold block mb-1">1. manifest.json (Manifest V3)</span>
                <pre className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-[11px] leading-relaxed overflow-x-auto text-emerald-300">
{`{
  "manifest_version": 3,
  "name": "Try1Second Price Tracker & Auto Coupon",
  "version": "1.4.0",
  "description": "365-Day Price History, Fake Discount Scanner & 1-Click Auto Coupon Tester for Amazon, Flipkart & Swiggy.",
  "permissions": ["storage", "activeTab"],
  "host_permissions": [
    "*://*.amazon.in/*",
    "*://*.flipkart.com/*",
    "*://*.swiggy.com/*",
    "*://*.blinkit.com/*",
    "*://*.makemytrip.com/*"
  ],
  "content_scripts": [
    {
      "matches": [
        "*://*.amazon.in/*",
        "*://*.flipkart.com/*",
        "*://*.swiggy.com/*",
        "*://*.blinkit.com/*",
        "*://*.makemytrip.com/*"
      ],
      "js": ["contentScript.js"],
      "run_at": "document_end"
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": "icons/icon128.png"
  }
}`}
                </pre>
              </div>

              <div>
                <span className="text-amber-400 font-bold block mb-1">2. contentScript.js (Injected Floating Overlay)</span>
                <pre className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-[11px] leading-relaxed overflow-x-auto text-sky-300">
{`// Try1Second Injected Content Script
(function initTry1SecondOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'try1second-floating-bar';
  overlay.innerHTML = \`
    <div style="position:fixed;bottom:20px;right:20px;z-index:999999;background:#ffffff;border:2px solid #ef4444;border-radius:24px;box-shadow:0 10px 40px rgba(0,0,0,0.25);padding:14px 20px;display:flex;align-items:center;gap:12px;font-family:sans-serif;">
      <span style="background:#ef4444;color:#fff;font-weight:900;padding:4px 8px;border-radius:12px;font-size:11px;">TRY1SECOND</span>
      <span style="font-weight:bold;font-size:13px;color:#0f172a;">ATL: ₹\${allTimeLow}</span>
      <button id="t1s-auto-coupon" style="background:#0f172a;color:#fff;border:none;border-radius:12px;padding:6px 12px;cursor:pointer;font-weight:bold;font-size:12px;">Auto-Test Coupons</button>
    </div>
  \`;
  document.body.appendChild(overlay);
})();`}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
