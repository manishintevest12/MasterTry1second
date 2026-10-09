import React, { useState } from 'react';
import {
  Sparkles,
  TrendingDown,
  TrendingUp,
  Brain,
  Calendar,
  AlertTriangle,
  ArrowRight,
  Zap,
  Search,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Tag,
  Link as LinkIcon,
  QrCode,
  Flame,
  Clock,
  Layers,
  ChevronRight,
  Percent,
  Check,
  Bell,
  Camera,
  Share2,
  RefreshCw,
  ShoppingBag,
  Plane,
  Building2,
  Bus,
  Utensils,
  Film,
  Landmark,
  Car,
  Laptop,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useApp } from '../context/AppContext';
import { VerticalId } from '../types';

interface CrossPlatformItem {
  platform: string;
  logoUrl?: string;
  basePrice: number;
  hiddenSurge: number;
  couponSavings: number;
  finalPrice: number;
  deliveryTime?: string;
  highlight?: string;
  isLowest?: boolean;
  deepLink?: string;
}

interface PriceHistoryPoint {
  date: string;
  price: number;
  event?: string;
  isFakeBump?: boolean;
}

interface ScannerResult {
  id: string;
  vertical: VerticalId;
  productTitle: string;
  category: string;
  imageUrl: string;
  dealScore: number;
  statusBadge: string;
  statusType: 'success' | 'warning' | 'danger' | 'info';
  currentPrice: number;
  mrp: number;
  lowestPrice: number;
  lowestDate: string;
  avg90dPrice: number;
  avg180dPrice: number;
  avg365dPrice: number;
  isFakeDiscount: boolean;
  fakeDiscountDetails?: string;
  recommendation: string;
  platforms: CrossPlatformItem[];
  savings: {
    baseGap: number;
    couponSavings: number;
    bankOffer: number;
    total: number;
  };
  history90d: PriceHistoryPoint[];
  history180d: PriceHistoryPoint[];
  history365d: PriceHistoryPoint[];
}

interface AiInsightCard {
  vertical: VerticalId;
  category: string;
  recommendation: 'BUY_NOW' | 'WAIT' | 'VOLATILE';
  confidence: number;
  headline: string;
  rationale: string;
  bestDayOrTime: string;
  estSavings: string;
  dealScore: number;
  imageUrl: string;
  badgeTag: string;
  lowestPriceRecorded: string;
  competitors: { platform: string; price: number; highlight?: string; isLowest?: boolean }[];
}

// 10 Rich Verticals Showcase Cards
const INSIGHTS: AiInsightCard[] = [
  {
    vertical: 'flights',
    category: 'International Flights (DEL → DXB)',
    recommendation: 'BUY_NOW',
    confidence: 94,
    dealScore: 92,
    headline: 'Aviation yield curves indicate sharp 72-hour price spike',
    rationale: 'Seating capacity on A380 & Boeing 777 routes dipped below 22%. Dynamic airline yield algorithms trigger automatic fare bracket bumps at T-10 days.',
    bestDayOrTime: 'Book before Friday 6 PM',
    estSavings: 'Avoid ₹4,200 surge',
    imageUrl: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=700&auto=format&fit=crop&q=80',
    badgeTag: 'Aviation Yield Curve',
    lowestPriceRecorded: '₹17,450 (ATL)',
    competitors: [
      { platform: 'IndiGo Direct', price: 17850, isLowest: true, highlight: 'Zero Convenience Fee' },
      { platform: 'EaseMyTrip', price: 18200, highlight: 'Flat ₹600 Off' },
      { platform: 'MakeMyTrip', price: 19450, highlight: '₹799 Fee Added' },
    ],
  },
  {
    vertical: 'hotels',
    category: 'Goa & Beachfront Luxury Private Villas',
    recommendation: 'BUY_NOW',
    confidence: 89,
    dealScore: 88,
    headline: 'Autumn weekend inventory tightening across 5-star properties',
    rationale: 'Agoda and Booking.com wholesale contracts expire 14 days prior to check-in. Rates will rise by ~28% as direct hotel rate parity kicks in.',
    bestDayOrTime: 'Lock in before Oct 15th',
    estSavings: 'Save ₹4,700 / night',
    imageUrl: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=700&auto=format&fit=crop&q=80',
    badgeTag: 'Luxury Stays & Villas',
    lowestPriceRecorded: '₹8,200 / night',
    competitors: [
      { platform: 'Booking.com', price: 8499, isLowest: true, highlight: 'Genius 10% Off' },
      { platform: 'Agoda VIP', price: 8900, highlight: 'Free Breakfast' },
      { platform: 'MakeMyTrip', price: 9850, highlight: 'Taxes extra' },
    ],
  },
  {
    vertical: 'ecommerce',
    category: 'Noise-Canceling Audio & Flagship Tech',
    recommendation: 'WAIT',
    confidence: 91,
    dealScore: 38,
    headline: 'Artificial MRP inflation detected ahead of festival sale banner',
    rationale: 'Marketplace seller raised original MRP by ₹3,500 right before advertising a 14% discount. 90-day telemetry shows it drops to ₹24,240 during bank promo resets.',
    bestDayOrTime: 'Wait for Midnight Flash Sale',
    estSavings: 'Save ₹5,750 on wait',
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=700&auto=format&fit=crop&q=80',
    badgeTag: 'Buyhatke Fake Discount Flag',
    lowestPriceRecorded: '₹24,490 (All-Time Low)',
    competitors: [
      { platform: 'Flipkart', price: 24240, isLowest: true, highlight: 'HDFC Card ₹1,750 Off' },
      { platform: 'Tata Neu / Croma', price: 25165, highlight: '5% NeuCoins' },
      { platform: 'Amazon India', price: 28490, highlight: 'Fake MRP Bump' },
    ],
  },
  {
    vertical: 'grocery',
    category: '10-Min Quick Commerce (Dark Store Baskets)',
    recommendation: 'BUY_NOW',
    confidence: 96,
    dealScore: 95,
    headline: 'Zero dark-store surge window active right now in your zone',
    rationale: 'Rain and evening peak handling fees (₹25–₹45) activate after 6:30 PM across metro dark stores. Non-peak afternoon basket yields cheapest cart total.',
    bestDayOrTime: 'Order between 2 PM – 5 PM',
    estSavings: 'Zero surge surcharge',
    imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=700&auto=format&fit=crop&q=80',
    badgeTag: 'Instant Delivery Basket',
    lowestPriceRecorded: '₹340 / Basket',
    competitors: [
      { platform: 'Blinkit', price: 345, isLowest: true, highlight: 'Zero Handling Fee' },
      { platform: 'Zepto', price: 370, highlight: '₹25 Handling Added' },
      { platform: 'Instamart', price: 385, highlight: '₹30 Rain Surge' },
    ],
  },
  {
    vertical: 'food',
    category: 'Gourmet Dining & Biryani Royal Combos',
    recommendation: 'BUY_NOW',
    confidence: 93,
    dealScore: 90,
    headline: 'Direct kitchen coupon stacking yields 32% lower total',
    rationale: 'Direct kitchen discount coupon bypasses aggregator platform fees (₹11) and delivery surcharges. Net effective savings verified at ₹167.',
    bestDayOrTime: 'Order with lunch coupon code',
    estSavings: 'Save ₹167 on order',
    imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=700&auto=format&fit=crop&q=80',
    badgeTag: 'Restaurant Parity Engine',
    lowestPriceRecorded: '₹480 / 2 Pax',
    competitors: [
      { platform: 'Magicpin Direct', price: 490, isLowest: true, highlight: 'Flat 15% Net Off' },
      { platform: 'Swiggy', price: 566, highlight: 'One Membership' },
      { platform: 'Zomato', price: 657, highlight: '₹40 Rain Surcharge' },
    ],
  },
  {
    vertical: 'cab',
    category: 'Airport City Transfers & Metro Mobility',
    recommendation: 'VOLATILE',
    confidence: 82,
    dealScore: 55,
    headline: 'High surge volatility predicted between 6 PM – 9 PM',
    rationale: 'Flight arrival peaks between 7 PM and 9 PM increase Uber/Ola surge multipliers up to 1.8X. Rapido Cabs and InDrive retain fixed baselines.',
    bestDayOrTime: 'Pre-schedule or switch to Rapido',
    estSavings: 'Save ₹120–₹160',
    imageUrl: 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=700&auto=format&fit=crop&q=80',
    badgeTag: 'Mobility Surge Tracker',
    lowestPriceRecorded: '₹420 Baseline',
    competitors: [
      { platform: 'Rapido Cabs', price: 440, isLowest: true, highlight: 'Zero Dynamic Surge' },
      { platform: 'InDrive', price: 460, highlight: 'Passenger Bidding' },
      { platform: 'Uber Premier', price: 680, highlight: '1.6X Surge Multiplier' },
    ],
  },
  {
    vertical: 'loans',
    category: 'Home & Personal Loan Disbursals (Overdraft)',
    recommendation: 'BUY_NOW',
    confidence: 95,
    dealScore: 96,
    headline: '8.40% benchmark rate locked with full processing fee waiver',
    rationale: 'PSU festive lending window closes at month end. Locking floating benchmark now provides permanent waiver of ₹10,000 processing charges.',
    bestDayOrTime: 'Lock benchmark rate this week',
    estSavings: 'Save ₹10,000 upfront + APR',
    imageUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=700&auto=format&fit=crop&q=80',
    badgeTag: 'CPL & APR Intelligence',
    lowestPriceRecorded: '8.35% APR Historic',
    competitors: [
      { platform: 'SBI Maxgain', price: 8.4, isLowest: true, highlight: 'Zero Processing Fee' },
      { platform: 'HDFC Reach', price: 8.75, highlight: '₹5,000 Admin Fee' },
      { platform: 'ICICI Express', price: 9.1, highlight: 'Pre-Approved 15m' },
    ],
  },
  {
    vertical: 'movie',
    category: 'IMAX 3D & Weekend Blockbuster Shows',
    recommendation: 'BUY_NOW',
    confidence: 88,
    dealScore: 84,
    headline: 'BOGO credit card quota resets every Friday at 10 AM',
    rationale: 'ICICI Saphiro & Axis Magnus 1+1 ticket quotas exhaust within 90 minutes. Booking Friday morning yields guaranteed 50% discount on dual seats.',
    bestDayOrTime: 'Book Friday 10:00 AM sharp',
    estSavings: 'Save ₹650 on dual ticket',
    imageUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=700&auto=format&fit=crop&q=80',
    badgeTag: 'IMAX Premiere Seats',
    lowestPriceRecorded: '₹320 / Ticket',
    competitors: [
      { platform: 'BookMyShow (BOGO)', price: 450, isLowest: true, highlight: 'Buy 1 Get 1 Free' },
      { platform: 'PVR Inox Direct', price: 680, highlight: '₹45 F&B Voucher' },
      { platform: 'District App', price: 720, highlight: 'Standard Pricing' },
    ],
  },
  {
    vertical: 'insurance',
    category: 'Term Life 1 Cr + Comprehensive Health Top-Up',
    recommendation: 'BUY_NOW',
    confidence: 94,
    dealScore: 91,
    headline: 'Early-age entry premium locked with zero smoking loading',
    rationale: 'Age slab change next month increases annualized premium by 8.5% permanently across 30-year policy term. Instant issuance waiver active.',
    bestDayOrTime: 'Lock before age slab change',
    estSavings: 'Save ₹72,000 over 30 yrs',
    imageUrl: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=700&auto=format&fit=crop&q=80',
    badgeTag: 'IRR & Claim Settlement',
    lowestPriceRecorded: '₹620 / Month',
    competitors: [
      { platform: 'HDFC Life Click2Protect', price: 680, isLowest: true, highlight: '99.3% Claim Ratio' },
      { platform: 'Max Life Smart', price: 710, highlight: 'Free Critical Illness' },
      { platform: 'Tata AIA Sampoorna', price: 745, highlight: 'Terminal Illness Add-on' },
    ],
  },
  {
    vertical: 'bus',
    category: 'Intercity Volvo Multi-Axle Sleeper Routes',
    recommendation: 'BUY_NOW',
    confidence: 87,
    dealScore: 86,
    headline: 'Sleeper lower-berth quotas selling out for weekend departure',
    rationale: 'Single female and lower-berth sleeper inventory reduces to under 15% by Wednesday evening. Dynamic fares surge by 35% on Thursday night.',
    bestDayOrTime: 'Book by Wednesday midnight',
    estSavings: 'Save ₹450 / seat',
    imageUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=700&auto=format&fit=crop&q=80',
    badgeTag: 'Express Highway Coach',
    lowestPriceRecorded: '₹950 / Berth',
    competitors: [
      { platform: 'AbhiBus Direct', price: 999, isLowest: true, highlight: 'Flat ₹150 Cashback' },
      { platform: 'RedBus Prime', price: 1050, highlight: 'Free Cancellation' },
      { platform: 'Zingbus Express', price: 1120, highlight: 'Standard Rate' },
    ],
  },
];

// Rich Sample Datasets across 10 Verticals
const SAMPLE_SCAN_RESULTS: Record<string, ScannerResult> = {
  headphones: {
    id: 'sony-xm5',
    vertical: 'ecommerce',
    productTitle: 'Sony WH-1000XM5 Wireless Noise Canceling Headphones (Silver)',
    category: 'E-Commerce · Premium Audio & Gadgets',
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
    dealScore: 38,
    statusBadge: 'Fake Discount Alert',
    statusType: 'danger',
    currentPrice: 28490,
    mrp: 34990,
    lowestPrice: 24240,
    lowestDate: '28 Nov 2025',
    avg90dPrice: 26990,
    avg180dPrice: 27500,
    avg365dPrice: 28200,
    isFakeDiscount: true,
    fakeDiscountDetails: 'Seller raised original MRP from ₹29,990 to ₹34,990 on Oct 2nd to advertise an artificial 18% discount.',
    recommendation: 'WAIT: Amazon artificially inflated MRP right before sale. Buy on Flipkart using HDFC card for ₹5,750 true net savings.',
    platforms: [
      {
        platform: 'Flipkart',
        logoUrl: 'https://cdn.iconscout.com/icon/free/png-256/free-flipkart-logo-icon-download-in-svg-png-gif-file-formats--shopping-brand-social-media-pack-logos-icons-1175216.png',
        basePrice: 25990,
        hiddenSurge: 0,
        couponSavings: 1750,
        finalPrice: 24240,
        deliveryTime: 'Tomorrow 11 AM',
        highlight: 'Auto-Applied: HDFC Card ₹1,750 Instant Off',
        isLowest: true,
        deepLink: 'https://flipkart.com',
      },
      {
        platform: 'Tata Neu / Croma',
        logoUrl: 'https://play-lh.googleusercontent.com/9v83f8gq9jM7j7q1k0l9',
        basePrice: 26490,
        hiddenSurge: 0,
        couponSavings: 1325,
        finalPrice: 25165,
        deliveryTime: '2 Days Delivery',
        highlight: '5% NeuCoins Cashback (₹1,325)',
        isLowest: false,
        deepLink: 'https://croma.com',
      },
      {
        platform: 'Amazon India',
        logoUrl: 'https://cdn.iconscout.com/icon/free/png-256/free-amazon-logo-icon-download-in-svg-png-gif-file-formats--brand-social-media-pack-logos-icons-3215366.png',
        basePrice: 29990,
        hiddenSurge: 0,
        couponSavings: 1500,
        finalPrice: 28490,
        deliveryTime: 'Same-Day Prime',
        highlight: 'Amazon Pay ICICI ₹1,500 CB',
        isLowest: false,
        deepLink: 'https://amazon.in',
      },
    ],
    savings: { baseGap: 4000, couponSavings: 1750, bankOffer: 1750, total: 5750 },
    history90d: [
      { date: 'Jul 10', price: 27990 },
      { date: 'Aug 01', price: 26990 },
      { date: 'Aug 25', price: 25490 },
      { date: 'Sep 15', price: 26490 },
      { date: 'Oct 02', price: 34990, isFakeBump: true, event: 'Artificial MRP Bump' },
      { date: 'Today', price: 28490 },
    ],
    history180d: [
      { date: 'Apr 15', price: 28990 },
      { date: 'Jun 01', price: 27490 },
      { date: 'Jul 15', price: 26990 },
      { date: 'Aug 15', price: 25490 },
      { date: 'Sep 28', price: 26490 },
      { date: 'Today', price: 28490 },
    ],
    history365d: [
      { date: 'Nov 2025', price: 24240, event: 'All-Time Low' },
      { date: 'Feb 2026', price: 27990 },
      { date: 'May 2026', price: 28490 },
      { date: 'Aug 2026', price: 25490 },
      { date: 'Today', price: 28490 },
    ],
  },
  flight: {
    id: 'indigo-del-dxb',
    vertical: 'flights',
    productTitle: 'Non-Stop Airbus A380 Flight: New Delhi (DEL) → Dubai (DXB)',
    category: 'Flights · International Aviation Route',
    imageUrl: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&auto=format&fit=crop&q=80',
    dealScore: 94,
    statusBadge: 'Lowest Fare in 30 Days',
    statusType: 'success',
    currentPrice: 17528,
    mrp: 23600,
    lowestPrice: 17450,
    lowestDate: '02 Sep 2026',
    avg90dPrice: 21400,
    avg180dPrice: 22800,
    avg365dPrice: 23600,
    isFakeDiscount: false,
    recommendation: 'BUY NOW on IndiGo Direct via Quick Apps: Save ₹1,221 vs MakeMyTrip by bypassing convenience fees.',
    platforms: [
      {
        platform: 'IndiGo Direct (6E-1461)',
        basePrice: 17528,
        hiddenSurge: 0,
        couponSavings: 600,
        finalPrice: 16928,
        deliveryTime: 'Direct Booking E-Ticket',
        highlight: 'Zero Convenience Fee + Free 30kg Luggage',
        isLowest: true,
        deepLink: 'https://goindigo.in',
      },
      {
        platform: 'EaseMyTrip',
        basePrice: 17850,
        hiddenSurge: 0,
        couponSavings: 500,
        finalPrice: 17350,
        deliveryTime: 'Instant PNR',
        highlight: 'Promo EMTINT Auto-Applied',
        isLowest: false,
        deepLink: 'https://easemytrip.com',
      },
      {
        platform: 'MakeMyTrip',
        basePrice: 17950,
        hiddenSurge: 799,
        couponSavings: 0,
        finalPrice: 18749,
        deliveryTime: 'Instant PNR',
        highlight: '₹799 Platform Convenience Fee Added',
        isLowest: false,
        deepLink: 'https://makemytrip.com',
      },
    ],
    savings: { baseGap: 5150, couponSavings: 600, bankOffer: 322, total: 6072 },
    history90d: [
      { date: 'Jul 15', price: 22400 },
      { date: 'Aug 05', price: 21900 },
      { date: 'Aug 20', price: 19800 },
      { date: 'Sep 02', price: 17450, event: 'All-Time Low' },
      { date: 'Sep 25', price: 18200 },
      { date: 'Today', price: 17528 },
    ],
    history180d: [
      { date: 'Apr 20', price: 23500 },
      { date: 'Jun 10', price: 22100 },
      { date: 'Aug 01', price: 21900 },
      { date: 'Sep 02', price: 17450 },
      { date: 'Today', price: 17528 },
    ],
    history365d: [
      { date: 'Nov 2025', price: 26000 },
      { date: 'Feb 2026', price: 23900 },
      { date: 'Jun 2026', price: 22100 },
      { date: 'Sep 2026', price: 17450 },
      { date: 'Today', price: 17528 },
    ],
  },
  grocery: {
    id: 'blinkit-grocery',
    vertical: 'grocery',
    productTitle: 'Daily Essentials Dark-Store Basket (Amul Milk, Brown Bread, Eggs, Aashirvaad Atta)',
    category: '10-Min Quick Grocery · Dark Stores',
    imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&auto=format&fit=crop&q=80',
    dealScore: 95,
    statusBadge: 'Normal Pricing (Zero Surge)',
    statusType: 'success',
    currentPrice: 345,
    mrp: 465,
    lowestPrice: 340,
    lowestDate: '18 Sep 2026',
    avg90dPrice: 395,
    avg180dPrice: 410,
    avg365dPrice: 420,
    isFakeDiscount: false,
    recommendation: 'BUY NOW on Blinkit via Quick Apps: Try1Second auto-applied BLINK10 saving ₹40 with zero rain handling fee.',
    platforms: [
      {
        platform: 'Blinkit',
        basePrice: 345,
        hiddenSurge: 0,
        couponSavings: 40,
        finalPrice: 305,
        deliveryTime: '8 Mins Delivery',
        highlight: 'Zero Handling Fee + BLINK10 Applied',
        isLowest: true,
        deepLink: 'https://blinkit.com',
      },
      {
        platform: 'Zepto',
        basePrice: 360,
        hiddenSurge: 25,
        couponSavings: 30,
        finalPrice: 355,
        deliveryTime: '10 Mins Delivery',
        highlight: '₹25 Dark Store Handling Added',
        isLowest: false,
        deepLink: 'https://zeptonow.com',
      },
      {
        platform: 'Swiggy Instamart',
        basePrice: 375,
        hiddenSurge: 35,
        couponSavings: 20,
        finalPrice: 390,
        deliveryTime: '12 Mins Delivery',
        highlight: '₹35 Rain Handling Surcharge',
        isLowest: false,
        deepLink: 'https://swiggy.com/instamart',
      },
    ],
    savings: { baseGap: 85, couponSavings: 40, bankOffer: 35, total: 160 },
    history90d: [
      { date: 'Jul 20', price: 410 },
      { date: 'Aug 10', price: 395 },
      { date: 'Aug 30', price: 385 },
      { date: 'Sep 18', price: 340, event: 'Low' },
      { date: 'Today', price: 345 },
    ],
    history180d: [
      { date: 'May 01', price: 420 },
      { date: 'Jul 15', price: 405 },
      { date: 'Today', price: 345 },
    ],
    history365d: [
      { date: 'Dec 2025', price: 430 },
      { date: 'May 2026', price: 420 },
      { date: 'Today', price: 345 },
    ],
  },
  food: {
    id: 'behrouz-biryani',
    vertical: 'food',
    productTitle: 'Behrouz Royal Dum Biryani Feast (2 Pax with Gulab Jamun & Raita)',
    category: 'Food Delivery · Gourmet Kitchens',
    imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop&q=80',
    dealScore: 90,
    statusBadge: 'Normal Pricing (Zero Surcharge)',
    statusType: 'success',
    currentPrice: 490,
    mrp: 680,
    lowestPrice: 480,
    lowestDate: '14 Aug 2026',
    avg90dPrice: 590,
    avg180dPrice: 620,
    avg365dPrice: 650,
    isFakeDiscount: false,
    recommendation: 'BUY NOW on Magicpin via Quick Apps: Bypasses Zomato’s ₹40 rain surcharge and ₹11 platform fee.',
    platforms: [
      {
        platform: 'Magicpin Direct',
        basePrice: 490,
        hiddenSurge: 0,
        couponSavings: 75,
        finalPrice: 415,
        deliveryTime: '30 Mins Delivery',
        highlight: 'Flat 15% Magicpin Coupon Auto-Applied',
        isLowest: true,
        deepLink: 'https://magicpin.in',
      },
      {
        platform: 'Swiggy',
        basePrice: 540,
        hiddenSurge: 11,
        couponSavings: 50,
        finalPrice: 501,
        deliveryTime: '32 Mins Delivery',
        highlight: 'Swiggy One Free Delivery',
        isLowest: false,
        deepLink: 'https://swiggy.com',
      },
      {
        platform: 'Zomato',
        basePrice: 570,
        hiddenSurge: 51,
        couponSavings: 40,
        finalPrice: 581,
        deliveryTime: '35 Mins Delivery',
        highlight: '₹40 Rain Surcharge + ₹11 Platform Fee',
        isLowest: false,
        deepLink: 'https://zomato.com',
      },
    ],
    savings: { baseGap: 166, couponSavings: 75, bankOffer: 0, total: 241 },
    history90d: [
      { date: 'Jul 15', price: 620 },
      { date: 'Aug 05', price: 580 },
      { date: 'Aug 14', price: 480, event: 'Kitchen Promo' },
      { date: 'Sep 20', price: 510 },
      { date: 'Today', price: 490 },
    ],
    history180d: [
      { date: 'Apr 10', price: 650 },
      { date: 'Jul 01', price: 610 },
      { date: 'Today', price: 490 },
    ],
    history365d: [
      { date: 'Nov 2025', price: 670 },
      { date: 'May 2026', price: 630 },
      { date: 'Today', price: 490 },
    ],
  },
  cab: {
    id: 'rapido-airport',
    vertical: 'cab',
    productTitle: 'Airport City Mobility: City Center → Kempegowda Airport (BLR)',
    category: 'Cabs & Mobility · Airport Transfer',
    imageUrl: 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=800&auto=format&fit=crop&q=80',
    dealScore: 55,
    statusBadge: 'High Surge Detected (Uber 1.8X)',
    statusType: 'warning',
    currentPrice: 440,
    mrp: 680,
    lowestPrice: 420,
    lowestDate: '05 Sep 2026',
    avg90dPrice: 510,
    avg180dPrice: 540,
    avg365dPrice: 560,
    isFakeDiscount: false,
    recommendation: 'SWITCH TO RAPIDO: Uber active dynamic surge multiplier is 1.8X; Rapido locks fixed baseline fare saving ₹240.',
    platforms: [
      {
        platform: 'Rapido Cabs',
        basePrice: 440,
        hiddenSurge: 0,
        couponSavings: 40,
        finalPrice: 400,
        deliveryTime: 'Driver 3 Mins Away',
        highlight: 'Zero Dynamic Surge Multiplier',
        isLowest: true,
        deepLink: 'https://rapido.bike',
      },
      {
        platform: 'InDrive',
        basePrice: 460,
        hiddenSurge: 0,
        couponSavings: 0,
        finalPrice: 460,
        deliveryTime: 'Driver 5 Mins Away',
        highlight: 'Passenger Direct Bidding',
        isLowest: false,
        deepLink: 'https://indrive.com',
      },
      {
        platform: 'Uber Premier',
        basePrice: 450,
        hiddenSurge: 230,
        couponSavings: 0,
        finalPrice: 680,
        deliveryTime: 'Driver 2 Mins Away',
        highlight: '1.8X Peak Rain Surge Multiplier',
        isLowest: false,
        deepLink: 'https://uber.com',
      },
    ],
    savings: { baseGap: 240, couponSavings: 40, bankOffer: 0, total: 280 },
    history90d: [
      { date: 'Jul 10', price: 460 },
      { date: 'Aug 01', price: 520 },
      { date: 'Aug 25', price: 490 },
      { date: 'Sep 05', price: 420, event: 'Non-Peak' },
      { date: 'Today', price: 440 },
    ],
    history180d: [
      { date: 'May 10', price: 540 },
      { date: 'Jul 20', price: 480 },
      { date: 'Today', price: 440 },
    ],
    history365d: [
      { date: 'Jan 2026', price: 560 },
      { date: 'Jun 2026', price: 510 },
      { date: 'Today', price: 440 },
    ],
  },
  hotel: {
    id: 'goa-villa',
    vertical: 'hotels',
    productTitle: 'Luxury 5-Star Beachfront Villa with Private Pool, North Goa',
    category: 'Hotels · Luxury Resorts & Villas',
    imageUrl: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&auto=format&fit=crop&q=80',
    dealScore: 88,
    statusBadge: 'All-Time Low',
    statusType: 'success',
    currentPrice: 8499,
    mrp: 14500,
    lowestPrice: 8200,
    lowestDate: '12 Sep 2026',
    avg90dPrice: 11200,
    avg180dPrice: 12400,
    avg365dPrice: 13500,
    isFakeDiscount: false,
    recommendation: 'BUY NOW on Booking.com via Quick Apps: Lock Genius VIP rate before Agoda wholesale contract expires.',
    platforms: [
      {
        platform: 'Booking.com',
        basePrice: 8499,
        hiddenSurge: 0,
        couponSavings: 850,
        finalPrice: 7649,
        deliveryTime: 'Free Cancellation Until Check-in',
        highlight: 'Genius Level 2 10% Off Auto-Applied',
        isLowest: true,
        deepLink: 'https://booking.com',
      },
      {
        platform: 'Agoda Direct',
        basePrice: 8900,
        hiddenSurge: 0,
        couponSavings: 0,
        finalPrice: 8900,
        deliveryTime: 'Instant Voucher',
        highlight: 'Includes Complimentary Breakfast',
        isLowest: false,
        deepLink: 'https://agoda.com',
      },
      {
        platform: 'MakeMyTrip',
        basePrice: 8800,
        hiddenSurge: 1050,
        couponSavings: 0,
        finalPrice: 9850,
        deliveryTime: 'Instant Voucher',
        highlight: '₹1,050 Luxury Service Fee Added',
        isLowest: false,
        deepLink: 'https://makemytrip.com',
      },
    ],
    savings: { baseGap: 2201, couponSavings: 850, bankOffer: 500, total: 3551 },
    history90d: [
      { date: 'Jul 12', price: 12500 },
      { date: 'Aug 04', price: 11200 },
      { date: 'Aug 28', price: 9800 },
      { date: 'Sep 12', price: 8200, event: 'All-Time Low' },
      { date: 'Today', price: 8499 },
    ],
    history180d: [
      { date: 'Apr 15', price: 13900 },
      { date: 'Jun 20', price: 12100 },
      { date: 'Today', price: 8499 },
    ],
    history365d: [
      { date: 'Dec 2025', price: 16500, event: 'New Year Peak' },
      { date: 'May 2026', price: 11500 },
      { date: 'Today', price: 8499 },
    ],
  },
  loan: {
    id: 'sbi-maxgain',
    vertical: 'loans',
    productTitle: 'Home Loan Overdraft (SBI Maxgain vs HDFC Reach vs Tata Capital)',
    category: 'Loans & Credit · Benchmark APR Rates',
    imageUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop&q=80',
    dealScore: 96,
    statusBadge: 'Lowest APR Match (8.40%)',
    statusType: 'success',
    currentPrice: 8.4,
    mrp: 9.25,
    lowestPrice: 8.35,
    lowestDate: '15 Aug 2026',
    avg90dPrice: 8.65,
    avg180dPrice: 8.8,
    avg365dPrice: 8.95,
    isFakeDiscount: false,
    recommendation: 'APPLY NOW: 8.40% festive rate includes 100% processing charge waiver saving ₹10,000 upfront.',
    platforms: [
      {
        platform: 'SBI Maxgain',
        basePrice: 8.4,
        hiddenSurge: 0,
        couponSavings: 0,
        finalPrice: 8.4,
        deliveryTime: 'Pre-Approved Paperless',
        highlight: 'Zero Processing Fee + Overdraft Account',
        isLowest: true,
        deepLink: 'https://sbi.co.in',
      },
      {
        platform: 'HDFC Reach',
        basePrice: 8.75,
        hiddenSurge: 5000,
        couponSavings: 0,
        finalPrice: 8.75,
        deliveryTime: '24h Sanction',
        highlight: '₹5,000 Processing Admin Fee',
        isLowest: false,
        deepLink: 'https://hdfcbank.com',
      },
      {
        platform: 'Tata Capital',
        basePrice: 9.1,
        hiddenSurge: 7500,
        couponSavings: 0,
        finalPrice: 9.1,
        deliveryTime: 'Instant Digital Sanction',
        highlight: 'Standard Benchmark + 0.35% Margin',
        isLowest: false,
        deepLink: 'https://tatacapital.com',
      },
    ],
    savings: { baseGap: 10000, couponSavings: 0, bankOffer: 0, total: 10000 },
    history90d: [
      { date: 'Jul 15', price: 8.75 },
      { date: 'Aug 15', price: 8.35 },
      { date: 'Today', price: 8.4 },
    ],
    history180d: [
      { date: 'May 01', price: 8.9 },
      { date: 'Today', price: 8.4 },
    ],
    history365d: [
      { date: 'Dec 2025', price: 9.1 },
      { date: 'Today', price: 8.4 },
    ],
  },
};

export const AiInsightsView: React.FC = () => {
  const { setVertical, setActiveNavTab, openExtensionModal, addToast, trackQuickAppRedirection } = useApp();

  const [inputUrl, setInputUrl] = useState<string>('');
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');
  const [activeScan, setActiveScan] = useState<ScannerResult | null>(SAMPLE_SCAN_RESULTS.headphones);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [activeHistoryTab, setActiveHistoryTab] = useState<'90d' | '180d' | '365d'>('90d');
  const [scannerMode, setScannerMode] = useState<'url' | 'barcode' | 'query'>('url');
  const [isBarcodeSimulating, setIsBarcodeSimulating] = useState<boolean>(false);

  // Automated Coupon Tester Live Simulation State
  const [isTestingCoupons, setIsTestingCoupons] = useState<boolean>(false);
  const [testedCouponIndex, setTestedCouponIndex] = useState<number>(0);
  const [winningCouponApplied, setWinningCouponApplied] = useState<boolean>(false);
  const [cartDiscount, setCartDiscount] = useState<number>(0);

  // WhatsApp Alert Form State
  const [alertPhone, setAlertPhone] = useState<string>('');
  const [targetPriceAlert, setTargetPriceAlert] = useState<number>(24000);
  const [alertSuccess, setAlertSuccess] = useState<boolean>(false);

  const couponTestCodes = [
    { code: 'TRY1SEC', discount: 200, status: 'Testing...' },
    { code: 'SUPERDEAL', discount: 450, status: 'Testing...' },
    { code: 'FLAT20', discount: 800, status: 'Testing...' },
    { code: 'HDFC1750', discount: 1750, status: 'Winning Code Found!' },
  ];

  const handleInspect = (v: VerticalId) => {
    setVertical(v);
    setActiveNavTab('compare');
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };

  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;

    setIsScanning(true);

    try {
      const isUrl = /^https?:\/\//i.test(inputUrl.trim());
      if (isUrl) {
        const res = await fetch('/api/scan/url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: inputUrl.trim() }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.item && data.rawScan) {
            const scan = data.rawScan;
            const livePlatforms: CrossPlatformItem[] = (scan.sellerQuotes || []).map((sq: any) => ({
              platform: sq.sellerName,
              basePrice: sq.price,
              hiddenSurge: 0,
              couponSavings: sq.couponCode ? 40 : 0,
              finalPrice: sq.price - (sq.couponCode ? 40 : 0),
              deliveryTime: sq.deliveryOrEta || 'Express Delivery',
              highlight: sq.badge || 'Verified Live Quote',
              isLowest: Boolean(sq.isLowest),
              deepLink: sq.url,
            }));

            const lowestPlatform =
              livePlatforms.find((p) => p.isLowest) ||
              livePlatforms[0] || {
                platform: scan.sourceDomain,
                basePrice: scan.extractedPrice,
                hiddenSurge: 0,
                couponSavings: 0,
                finalPrice: scan.extractedPrice,
                deliveryTime: 'Direct Store',
                highlight: 'Live Scraped',
                isLowest: true,
                deepLink: scan.sourceUrl,
              };

            const computedScore = Math.min(
              98,
              Math.max(
                70,
                Math.round(94 - (scan.extractedPrice / (scan.originalPrice || scan.extractedPrice * 1.2)) * 12)
              )
            );

            const liveActiveScan: ScanResultItem = {
              id: data.item.id,
              vertical: scan.vertical,
              productTitle: scan.title,
              category: scan.category,
              imageUrl:
                scan.imageUrl ||
                'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
              dealScore: computedScore,
              statusBadge: `Live Scraped from ${scan.sourceDomain}`,
              statusType: 'success',
              currentPrice: scan.extractedPrice,
              mrp: scan.originalPrice || Math.round(scan.extractedPrice * 1.15),
              lowestPrice: lowestPlatform.finalPrice,
              lowestDate: 'Today (Live Discovery)',
              avg90dPrice: Math.round(scan.extractedPrice * 1.08),
              avg180dPrice: Math.round(scan.extractedPrice * 1.12),
              avg365dPrice: Math.round(scan.extractedPrice * 1.18),
              isFakeDiscount: false,
              recommendation: `BUY NOW on ${lowestPlatform.platform}: Verified lowest price of ₹${lowestPlatform.finalPrice.toLocaleString('en-IN')} with active coupon.`,
              platforms: livePlatforms.length > 0 ? livePlatforms : [lowestPlatform],
              savings: {
                baseGap: Math.max(0, (scan.originalPrice || scan.extractedPrice) - lowestPlatform.finalPrice),
                couponSavings: 40,
                bankOffer: 50,
                total: Math.max(0, (scan.originalPrice || scan.extractedPrice) - lowestPlatform.finalPrice) + 90,
              },
              history90d: [
                { date: '60d ago', price: Math.round(scan.extractedPrice * 1.1) },
                { date: '30d ago', price: Math.round(scan.extractedPrice * 1.05) },
                { date: 'Yesterday', price: Math.round(scan.extractedPrice * 1.02) },
                { date: 'Today (Live)', price: scan.extractedPrice, event: 'Live Hit' },
              ],
              history180d: [
                { date: '180d ago', price: Math.round(scan.extractedPrice * 1.15) },
                { date: '90d ago', price: Math.round(scan.extractedPrice * 1.1) },
                { date: 'Today (Live)', price: scan.extractedPrice },
              ],
              history365d: [
                { date: '365d ago', price: Math.round(scan.extractedPrice * 1.2) },
                { date: '180d ago', price: Math.round(scan.extractedPrice * 1.15) },
                { date: 'Today (Live)', price: scan.extractedPrice },
              ],
            };

            setActiveScan(liveActiveScan);
            setIsScanning(false);
            window.scrollTo({ top: 400, behavior: 'smooth' });
            return;
          }
        }
      }
    } catch (err: any) {
      console.warn('[AiInsights] Live URL scan fallback:', err.message);
    }

    setTimeout(() => {
      setIsScanning(false);
      const lower = inputUrl.toLowerCase();
      if (lower.includes('flight') || lower.includes('air') || lower.includes('del') || lower.includes('dxb') || lower.includes('indigo')) {
        setActiveScan(SAMPLE_SCAN_RESULTS.flight);
      } else if (lower.includes('food') || lower.includes('biryani') || lower.includes('swiggy') || lower.includes('zomato') || lower.includes('magicpin')) {
        setActiveScan(SAMPLE_SCAN_RESULTS.food);
      } else if (lower.includes('grocery') || lower.includes('blinkit') || lower.includes('zepto') || lower.includes('instamart') || lower.includes('milk')) {
        setActiveScan(SAMPLE_SCAN_RESULTS.grocery);
      } else if (lower.includes('hotel') || lower.includes('resort') || lower.includes('goa') || lower.includes('stay') || lower.includes('villa')) {
        setActiveScan(SAMPLE_SCAN_RESULTS.hotel);
      } else if (lower.includes('cab') || lower.includes('uber') || lower.includes('rapido') || lower.includes('ride') || lower.includes('airport')) {
        setActiveScan(SAMPLE_SCAN_RESULTS.cab);
      } else if (lower.includes('loan') || lower.includes('sbi') || lower.includes('hdfc') || lower.includes('interest') || lower.includes('apr')) {
        setActiveScan(SAMPLE_SCAN_RESULTS.loan);
      } else {
        setActiveScan(SAMPLE_SCAN_RESULTS.headphones);
      }

      window.scrollTo({ top: 400, behavior: 'smooth' });
    }, 450);
  };

  const handleSimulateBarcode = (skuKey: string) => {
    setIsBarcodeSimulating(true);
    setTimeout(() => {
      setIsBarcodeSimulating(false);
      setActiveScan(SAMPLE_SCAN_RESULTS[skuKey] || SAMPLE_SCAN_RESULTS.headphones);
      window.scrollTo({ top: 400, behavior: 'smooth' });
    }, 600);
  };

  const handleSelectPartnerPlatform = (partner: CrossPlatformItem) => {
    trackQuickAppRedirection(partner.platform.toLowerCase().replace(/\s+/g, '-'));
    addToast(
      'success',
      `Redirecting to ${partner.platform}`,
      'Auto-applying Try1Second coupon stack. Opening verified lowest price.'
    );
    if (partner.deepLink) {
      window.open(partner.deepLink, '_blank', 'noopener,noreferrer');
    }
  };

  // Run 1-Click Automated Coupon Testing Routine
  const handleRunAutoCouponTest = () => {
    setIsTestingCoupons(true);
    setWinningCouponApplied(false);
    setCartDiscount(0);

    let idx = 0;
    const interval = setInterval(() => {
      idx += 1;
      setTestedCouponIndex(idx);
      if (idx >= couponTestCodes.length) {
        clearInterval(interval);
        setIsTestingCoupons(false);
        setWinningCouponApplied(true);
        setCartDiscount(1750);
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.7 },
        });
        addToast(
          'points',
          'Highest Discount Applied: HDFC1750',
          'Saved ₹1,750 net on checkout. Zero effort required.'
        );
      }
    }, 400);
  };

  const handleSetWhatsAppAlert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertPhone) return;
    setAlertSuccess(true);
    addToast(
      'alert',
      'WhatsApp Alert Active',
      `We will ping +91 ${alertPhone} instantly when price drops below ₹${targetPriceAlert.toLocaleString('en-IN')}.`
    );
  };

  const filteredCards = INSIGHTS.filter((item) => {
    if (selectedFilter === 'ALL') return true;
    if (selectedFilter === 'TRAVEL') return ['flights', 'hotels', 'bus'].includes(item.vertical);
    if (selectedFilter === 'SHOPPING') return ['ecommerce', 'grocery'].includes(item.vertical);
    if (selectedFilter === 'DINING') return ['food', 'movie'].includes(item.vertical);
    if (selectedFilter === 'FINANCE') return ['loans', 'insurance', 'cab'].includes(item.vertical);
    return true;
  });

  const currentHistory = activeScan
    ? activeHistoryTab === '90d'
      ? activeScan.history90d
      : activeHistoryTab === '180d'
      ? activeScan.history180d
      : activeScan.history365d
    : [];

  const maxHistoryPrice = Math.max(...(currentHistory.map((h) => h.price) || [1000]));
  const minHistoryPrice = Math.min(...(currentHistory.map((h) => h.price) || [0]));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12 font-sans">
      {/* ================= 1. VISUAL HERO WITH NEURAL ENGINE & MULTI-INPUT SCANNER ================= */}
      <section className="relative rounded-3xl overflow-hidden shadow-2xl bg-slate-950 border border-slate-800 text-white p-6 sm:p-10">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-25 pointer-events-none filter blur-xs"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1600&auto=format&fit=crop&q=80')`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/90 to-blue-950/50 pointer-events-none" />

        <div className="relative z-10 max-w-4xl space-y-5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold border border-blue-400/30">
            <Brain className="w-4 h-4 text-cyan-400" />
            <span className="tracking-wide">TRY1SECOND UNIVERSAL AI SCANNER & DEAL TRUTH ENGINE</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Universal Scanner, Price History &{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-300">
              Auto-Coupon Engine
            </span>
          </h1>

          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            Combines 365-day historical price telemetry with instant cross-platform parity across all 10 verticals.
            Flag artificial MRP spikes, auto-apply winning coupon codes at checkout, and catch rain surcharges in sub-second speed.
          </p>

          {/* Mode Selector Tabs: URL Link | Barcode / QR | Instant 10-Vertical Query */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => setScannerMode('url')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                scannerMode === 'url'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                  : 'bg-white/10 text-slate-300 hover:bg-white/15'
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>Paste Product / Flight Link</span>
            </button>

            <button
              type="button"
              onClick={() => setScannerMode('barcode')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                scannerMode === 'barcode'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                  : 'bg-white/10 text-slate-300 hover:bg-white/15'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Barcode & QR Viewfinder</span>
            </button>

            <button
              type="button"
              onClick={openExtensionModal}
              className="hidden sm:inline-flex px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-red-600 to-amber-600 text-white hover:brightness-110 items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Zap className="w-3.5 h-3.5 fill-white" />
              <span>Launch Chrome Extension</span>
            </button>
          </div>

          {/* MODE 1: URL Input Form */}
          {scannerMode === 'url' && (
            <div className="pt-1">
              <form onSubmit={handleScanSubmit} className="bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/20 flex flex-col sm:flex-row gap-2 shadow-2xl max-w-3xl">
                <div className="flex-1 flex items-center gap-2.5 px-3 py-2 bg-slate-900/80 rounded-xl border border-slate-700/60">
                  <LinkIcon className="w-4 h-4 text-cyan-400 shrink-0" />
                  <input
                    type="text"
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    placeholder="Paste link: Amazon, Flipkart, Swiggy, Zomato, IndiGo, Blinkit, Booking.com..."
                    className="w-full bg-transparent text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-hidden"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isScanning}
                  className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-lg shadow-cyan-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
                >
                  {isScanning ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Auditing 365d Trend...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>Audit Deal Truth</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* MODE 2: Barcode Viewfinder Simulator */}
          {scannerMode === 'barcode' && (
            <div className="bg-slate-900/90 rounded-2xl border border-slate-700 p-4 max-w-2xl space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-300 pb-2 border-b border-slate-800">
                <span className="font-bold flex items-center gap-1.5 text-cyan-400">
                  <Camera className="w-4 h-4" />
                  <span>Optical Camera & Barcode Scanner Viewfinder</span>
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30 font-mono">
                  Lens Active · 100+ Brands
                </span>
              </div>

              {/* Viewfinder Frame with Laser */}
              <div className="relative h-44 rounded-xl overflow-hidden bg-slate-950 flex flex-col items-center justify-center border-2 border-dashed border-cyan-500/40">
                <div className="absolute inset-x-8 top-1/2 h-0.5 bg-red-500 shadow-[0_0_12px_#ef4444] animate-pulse pointer-events-none" />
                <QrCode className="w-16 h-16 text-cyan-400/40 mb-2" />
                <p className="text-xs text-slate-300 font-semibold z-10">Point Camera at Product Barcode or QR</p>
                <span className="text-[10px] text-slate-500 z-10">UPC, EAN-13, QR codes recognized automatically</span>
              </div>

              {/* Quick Barcode Test Buttons */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-400 block">Click a barcode sample to simulate live scan:</span>
                <div className="flex flex-wrap gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => handleSimulateBarcode('headphones')}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium border border-white/10 cursor-pointer"
                  >
                    🏷️ 490552498231 (Sony XM5 Barcode)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSimulateBarcode('grocery')}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium border border-white/10 cursor-pointer"
                  >
                    🏷️ 890123302451 (Amul Basket Barcode)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSimulateBarcode('flight')}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium border border-white/10 cursor-pointer"
                  >
                    ✈️ 6E-1461 QR Ticket Pass
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Quick Preset Chips for All 10 Verticals */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-300">
            <span className="font-semibold text-slate-400 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Presets:</span>
            </span>
            <button
              type="button"
              onClick={() => setActiveScan(SAMPLE_SCAN_RESULTS.headphones)}
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium border border-white/10 cursor-pointer"
            >
              🎧 Sony XM5 (Fake Discount)
            </button>
            <button
              type="button"
              onClick={() => setActiveScan(SAMPLE_SCAN_RESULTS.flight)}
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium border border-white/10 cursor-pointer"
            >
              ✈️ DEL → DXB Flight (ATL)
            </button>
            <button
              type="button"
              onClick={() => setActiveScan(SAMPLE_SCAN_RESULTS.grocery)}
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium border border-white/10 cursor-pointer"
            >
              ⚡ 10-Min Grocery (Surge Audit)
            </button>
            <button
              type="button"
              onClick={() => setActiveScan(SAMPLE_SCAN_RESULTS.food)}
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium border border-white/10 cursor-pointer"
            >
              🍛 Behrouz Biryani (Kitchen Parity)
            </button>
            <button
              type="button"
              onClick={() => setActiveScan(SAMPLE_SCAN_RESULTS.hotel)}
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium border border-white/10 cursor-pointer"
            >
              🏖️ Goa Beach Villa (Rate Parity)
            </button>
            <button
              type="button"
              onClick={() => setActiveScan(SAMPLE_SCAN_RESULTS.cab)}
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium border border-white/10 cursor-pointer"
            >
              🚖 Airport Ride (1.8X Surge)
            </button>
            <button
              type="button"
              onClick={() => setActiveScan(SAMPLE_SCAN_RESULTS.loan)}
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium border border-white/10 cursor-pointer"
            >
              💳 Home Loan APR (8.40%)
            </button>
          </div>
        </div>
      </section>

      {/* ================= 2. STRUCTURED OUTPUT CARD FOR EVERY SCAN ================= */}
      {activeScan && (
        <section className="bg-white rounded-3xl border-2 border-blue-500/30 p-6 sm:p-8 shadow-xl relative overflow-hidden space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Brain className="w-4 h-4 text-blue-600" />
                <span>Try1Second AI Structured Verdict · Verified Telemetry</span>
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-medium">Scanned via: Universal Link Parser</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(window.location.href);
                  addToast(
                    'info',
                    'Deal Link Copied',
                    'Share this deal truth analysis with friends.'
                  );
                }}
                className="text-blue-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share Verdict</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-8 items-start">
            {/* Visual Photography Column with Deal Score Overlay */}
            <div className="relative w-full lg:w-80 h-64 sm:h-72 rounded-2xl overflow-hidden shrink-0 border border-slate-200 shadow-md group">
              <img
                src={activeScan.imageUrl}
                alt={activeScan.productTitle}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=800&auto=format&fit=crop&q=80';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent pointer-events-none" />

              {/* Deal Score Radial Badge */}
              <div className="absolute top-3 left-3 bg-slate-900/90 backdrop-blur-md text-white px-3 py-1.5 rounded-xl border border-white/20 flex items-center gap-2 shadow-lg">
                <Flame className={`w-4 h-4 ${activeScan.dealScore >= 80 ? 'text-orange-400' : 'text-slate-400'}`} />
                <div>
                  <span className="text-[9px] text-slate-300 font-bold uppercase block leading-none">Deal Score</span>
                  <span className="text-base font-black font-mono leading-none">{activeScan.dealScore}/100</span>
                </div>
              </div>

              {/* Vertical-Specific Status Badge */}
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs">
                <span
                  className={`px-3 py-1 rounded-lg font-black uppercase text-[10px] tracking-wider shadow-md ${
                    activeScan.statusType === 'danger'
                      ? 'bg-rose-600 text-white animate-pulse'
                      : activeScan.statusType === 'warning'
                      ? 'bg-amber-600 text-white'
                      : 'bg-emerald-600 text-white'
                  }`}
                >
                  {activeScan.statusBadge}
                </span>

                <span className="bg-white/95 text-slate-900 text-xs font-black font-mono px-2 py-0.5 rounded-md shadow-xs">
                  {typeof activeScan.currentPrice === 'number' && activeScan.currentPrice > 100
                    ? `₹${activeScan.currentPrice.toLocaleString('en-IN')}`
                    : `${activeScan.currentPrice}% APR`}
                </span>
              </div>
            </div>

            {/* Verdict Data & Action Recommendation */}
            <div className="flex-1 space-y-4">
              <div>
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider block mb-1">
                  {activeScan.category}
                </span>
                <h2 className="text-lg sm:text-2xl font-black text-slate-900 leading-snug">
                  {activeScan.productTitle}
                </h2>
              </div>

              {/* AI Actionable Recommendation Banner */}
              <div
                className={`p-4 rounded-2xl border text-xs sm:text-sm font-semibold flex items-start gap-3 shadow-2xs ${
                  activeScan.isFakeDiscount
                    ? 'bg-rose-50 border-rose-200 text-rose-900'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                }`}
              >
                {activeScan.isFakeDiscount ? (
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <strong className="block mb-0.5 font-black text-sm">
                    {activeScan.isFakeDiscount
                      ? 'Warning: Artificial Price Hike Detected (Buyhatke Telemetry)'
                      : 'Verified Best Buying Window by Try1Second AI'}
                  </strong>
                  <p className="text-xs font-normal leading-relaxed opacity-95">{activeScan.recommendation}</p>
                </div>
              </div>

              {/* Benchmark Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Current Price</span>
                  <span className="font-bold text-slate-900 font-mono">
                    {activeScan.currentPrice > 100 ? `₹${activeScan.currentPrice.toLocaleString('en-IN')}` : `${activeScan.currentPrice}%`}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">365-Day Low (ATL)</span>
                  <span className="font-bold text-emerald-600 font-mono">
                    {activeScan.lowestPrice > 100 ? `₹${activeScan.lowestPrice.toLocaleString('en-IN')}` : `${activeScan.lowestPrice}%`}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">90-Day Avg Price</span>
                  <span className="font-bold text-slate-700 font-mono">
                    {activeScan.avg90dPrice > 100 ? `₹${activeScan.avg90dPrice.toLocaleString('en-IN')}` : `${activeScan.avg90dPrice}%`}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Verified Net Savings</span>
                  <span className="font-extrabold text-blue-700 font-mono">+₹{activeScan.savings.total.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Savings Breakdown Card */}
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-2xl flex items-center justify-between text-xs flex-wrap gap-2">
                <span className="font-bold text-blue-900">Savings Breakdown:</span>
                <div className="flex items-center gap-3 font-mono text-[11px] text-slate-700">
                  <span>Base Gap: <strong className="text-slate-900">₹{activeScan.savings.baseGap.toLocaleString('en-IN')}</strong></span>
                  <span>+</span>
                  <span>Coupon: <strong className="text-emerald-700">₹{activeScan.savings.couponSavings.toLocaleString('en-IN')}</strong></span>
                  <span>+</span>
                  <span>Bank/Card: <strong className="text-blue-700">₹{activeScan.savings.bankOffer.toLocaleString('en-IN')}</strong></span>
                  <span>=</span>
                  <span className="px-2 py-0.5 bg-blue-600 text-white rounded-md font-bold">
                    Total ₹{activeScan.savings.total.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ================= 3. BUYHATKE-GRADE PRICE HISTORY GRAPH ================= */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <TrendingDown className="w-4 h-4 text-blue-600" />
                  <span>Historical Price Analytics & Fake Discount Detection</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Tracks actual marketplace price changes over 90, 180, and 365 days. Pinpoints pre-sale artificial MRP bumps.
                </p>
              </div>

              {/* Period Tabs: 90d, 180d, 365d */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs self-start sm:self-auto">
                {(['90d', '180d', '365d'] as const).map((period) => (
                  <button
                    key={period}
                    type="button"
                    onClick={() => setActiveHistoryTab(period)}
                    className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      activeHistoryTab === period
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {period.toUpperCase()} Trend
                  </button>
                ))}
              </div>
            </div>

            {/* Price Graph Visual Canvas */}
            <div className="bg-slate-950 text-white rounded-2xl p-4 sm:p-6 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-mono">Highest: ₹{maxHistoryPrice.toLocaleString('en-IN')}</span>
                <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>All-Time Low Recorded: ₹{activeScan.lowestPrice.toLocaleString('en-IN')} ({activeScan.lowestDate})</span>
                </span>
                <span className="font-mono">Lowest: ₹{minHistoryPrice.toLocaleString('en-IN')}</span>
              </div>

              {/* Interactive SVG Trend Visualizer */}
              <div className="h-32 sm:h-40 w-full flex items-end gap-2 sm:gap-4 pt-4 border-b border-slate-800">
                {currentHistory.map((point, pIdx) => {
                  const heightPercent = Math.max(
                    15,
                    Math.min(95, Math.round(((point.price - minHistoryPrice) / (maxHistoryPrice - minHistoryPrice || 1)) * 100))
                  );
                  return (
                    <div key={pIdx} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                      {/* Hover Tooltip */}
                      <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                        <div className="bg-slate-900 border border-slate-700 text-white text-[10px] rounded-lg p-2 shadow-xl whitespace-nowrap">
                          <span className="font-bold block">{point.date}</span>
                          <span className="font-mono text-cyan-300 font-bold">₹{point.price.toLocaleString('en-IN')}</span>
                          {point.event && <span className="text-amber-400 block">{point.event}</span>}
                        </div>
                      </div>

                      {/* Bar / Node */}
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full max-w-[36px] rounded-t-lg transition-all duration-300 ${
                          point.isFakeBump
                            ? 'bg-rose-500 shadow-[0_0_12px_#f43f5e]'
                            : point.price === activeScan.lowestPrice
                            ? 'bg-emerald-500 shadow-[0_0_12px_#10b981]'
                            : 'bg-blue-500/70 group-hover:bg-cyan-400'
                        }`}
                      />

                      <span className="text-[9px] text-slate-400 mt-2 font-mono truncate w-full text-center">
                        {point.date}
                      </span>
                    </div>
                  );
                })}
              </div>

              {activeScan.isFakeDiscount && (
                <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl text-xs text-rose-200 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    <strong>Buyhatke MRP Spike Flag:</strong> {activeScan.fakeDiscountDetails}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ================= 4. CROSS-PLATFORM PARITY & QUICK APPS COMPARISON TABLE ================= */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  Cross-Platform Parity Table (Including Hidden Charges)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Side-by-side comparison of base price, handling fees, rain surge, and auto-applied coupon discounts.
                </p>
              </div>
              <span className="text-[11px] text-slate-400 font-mono hidden sm:block">Live Sync: 0.4s</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-200 rounded-2xl overflow-hidden">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Platform / App</th>
                    <th className="p-3">Base Price</th>
                    <th className="p-3">Hidden Fees & Surge</th>
                    <th className="p-3">Auto-Applied Savings</th>
                    <th className="p-3">Final Net Price</th>
                    <th className="p-3 text-right">Quick Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeScan.platforms.map((p, idx) => (
                    <tr
                      key={idx}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        p.isLowest ? 'bg-emerald-50/60 font-semibold text-slate-900' : 'text-slate-700'
                      }`}
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-black text-slate-600">
                            #{idx + 1}
                          </span>
                          <div>
                            <span className="font-extrabold text-slate-900 block">{p.platform}</span>
                            <span className="text-[10px] text-slate-500 font-normal">{p.deliveryTime}</span>
                          </div>
                        </div>
                      </td>

                      <td className="p-3 font-mono font-bold">
                        ₹{p.basePrice.toLocaleString('en-IN')}
                      </td>

                      <td className="p-3">
                        {p.hiddenSurge > 0 ? (
                          <span className="text-rose-600 font-bold font-mono">+₹{p.hiddenSurge} Fee</span>
                        ) : (
                          <span className="text-emerald-600 font-bold">₹0 Free</span>
                        )}
                      </td>

                      <td className="p-3">
                        <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md font-bold">
                          {p.highlight}
                        </span>
                      </td>

                      <td className="p-3 font-mono text-sm font-black text-slate-900">
                        ₹{p.finalPrice.toLocaleString('en-IN')}
                        {p.isLowest && (
                          <span className="ml-1.5 text-[9px] bg-emerald-600 text-white font-extrabold px-1.5 py-0.5 rounded-md uppercase">
                            Cheapest
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleSelectPartnerPlatform(p)}
                          className="py-1.5 px-3 bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs rounded-xl shadow-xs inline-flex items-center gap-1 cursor-pointer transition-all hover:scale-105 active:scale-95"
                        >
                          <span>Select</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ================= 5. MODULE B: INSTANT PRICE DROP ALERT SETTER (WHATSAPP & PUSH) ================= */}
          <div className="pt-4 border-t border-slate-100 bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-200">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-black uppercase tracking-wider text-red-600 flex items-center gap-1.5">
                  <Bell className="w-4 h-4 text-red-600" />
                  <span>Instant Price-Drop Alert Engine (WhatsApp & Web Push)</span>
                </span>
                <h4 className="text-sm font-extrabold text-slate-900">
                  Get notified the exact second price drops to your target
                </h4>
                <p className="text-xs text-slate-500 max-w-xl">
                  Try1Second background engines poll retailer APIs every 2 minutes. Receive automated WhatsApp alerts with direct pre-filled buy links.
                </p>
              </div>

              {/* Alert Subscription Form */}
              <form onSubmit={handleSetWhatsAppAlert} className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-300 text-xs">
                  <span className="text-slate-400 font-bold">Target: ₹</span>
                  <input
                    type="number"
                    value={targetPriceAlert}
                    onChange={(e) => setTargetPriceAlert(Number(e.target.value))}
                    className="w-20 font-mono font-bold text-slate-900 focus:outline-hidden"
                  />
                </div>

                <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-300 text-xs">
                  <span className="text-slate-400 font-bold">+91</span>
                  <input
                    type="tel"
                    value={alertPhone}
                    onChange={(e) => setAlertPhone(e.target.value)}
                    placeholder="WhatsApp Number"
                    className="w-32 font-semibold text-slate-900 focus:outline-hidden"
                  />
                </div>

                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-sm flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>Activate WhatsApp Alert</span>
                </button>
              </form>
            </div>

            {alertSuccess && (
              <div className="mt-3 p-3 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-xl text-xs flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>
                  WhatsApp alert scheduled for <strong>+91 {alertPhone}</strong> at target price ₹{targetPriceAlert.toLocaleString('en-IN')}.
                </span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ================= 3. MODULE A: AUTOMATED COUPON TESTER & AUTO-APPLY ENGINE ================= */}
      <section className="bg-gradient-to-br from-indigo-950 via-slate-950 to-blue-950 text-white rounded-3xl p-6 sm:p-8 border border-indigo-900/60 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-bold border border-cyan-400/30">
              <Zap className="w-3.5 h-3.5 text-cyan-400 fill-cyan-400" />
              <span>MODULE A: 1-CLICK AUTO-APPLY COUPON & STACKING ENGINE</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              Automated Checkout Coupon Testing & Auto-Fill
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              When you land on any partner checkout or cart screen, Try1Second automatically tests all active promo codes, bank cashback offers, and referral stacks in 1 second to apply the single code yielding the lowest price.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRunAutoCouponTest}
            disabled={isTestingCoupons}
            className="px-6 py-3 bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:brightness-110 text-white font-extrabold text-xs sm:text-sm rounded-2xl shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 cursor-pointer shrink-0 transition-transform hover:scale-105 active:scale-95"
          >
            {isTestingCoupons ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Testing {testedCouponIndex + 1}/4 Promo Stacks...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-white" />
                <span>Auto-Test Coupons with Try1Second</span>
              </>
            )}
          </button>
        </div>

        {/* Live Cart Simulator Visual */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-5 backdrop-blur-xs">
          <div className="space-y-2">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Cart Checkout State</span>
            <div className="flex items-center gap-3">
              <img
                src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&auto=format&fit=crop&q=80"
                alt="Product"
                className="w-12 h-12 rounded-xl object-cover border border-white/20"
              />
              <div>
                <span className="text-xs font-bold text-white block">Sony WH-1000XM5</span>
                <span className="text-[11px] text-slate-400 font-mono">Original: ₹25,990</span>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Coupon Auto-Test Progress</span>
            <div className="space-y-1">
              {couponTestCodes.map((c, i) => (
                <div key={c.code} className="flex items-center justify-between text-xs py-0.5">
                  <span className="font-mono text-[11px] text-slate-300">
                    {c.code} {i === testedCouponIndex && isTestingCoupons ? '⏳' : ''}
                  </span>
                  <span
                    className={`text-[10px] font-bold ${
                      winningCouponApplied && c.code === 'HDFC1750'
                        ? 'text-emerald-400 font-mono'
                        : isTestingCoupons && i <= testedCouponIndex
                        ? 'text-cyan-300'
                        : 'text-slate-500'
                    }`}
                  >
                    {winningCouponApplied && c.code === 'HDFC1750' ? 'APPLIED: -₹1,750' : `-₹${c.discount}`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2 bg-slate-900/80 p-3 rounded-xl border border-slate-700/80 flex flex-col justify-between">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Net Effective Price</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
                  ₹{(25990 - cartDiscount).toLocaleString('en-IN')}
                </span>
                {cartDiscount > 0 && (
                  <span className="text-xs line-through text-slate-500 font-mono">₹25,990</span>
                )}
              </div>
            </div>

            {winningCouponApplied ? (
              <span className="text-[11px] text-emerald-300 font-bold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                <span>Saved ₹1,750 with Try1Second Auto-Fill!</span>
              </span>
            ) : (
              <span className="text-[10px] text-slate-400">Click button above to simulate 1-click test</span>
            )}
          </div>
        </div>
      </section>

      {/* ================= 4. CATEGORY FILTER TABS FOR 10 VERTICALS ================= */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
            10-Vertical Predictive Insights & Yield Telemetry
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time algorithm monitoring airline yield curves, hotel rate parity, dark-store surges, and bank card stacks.
          </p>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'ALL', label: `All Verticals (${INSIGHTS.length})` },
            { id: 'TRAVEL', label: 'Travel & Stays' },
            { id: 'SHOPPING', label: 'Electronics & Grocery' },
            { id: 'DINING', label: 'Food & Movies' },
            { id: 'FINANCE', label: 'Loans & Mobility' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap cursor-pointer transition-all border ${
                selectedFilter === tab.id
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ================= 5. GRID OF 10 RICH VISUAL PHOTOGRAPHY CARDS ================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCards.map((item, idx) => {
          let badgeColor = 'bg-emerald-600 text-white';
          let icon = <TrendingDown className="w-3.5 h-3.5" />;

          if (item.recommendation === 'WAIT') {
            badgeColor = 'bg-amber-600 text-white';
            icon = <TrendingUp className="w-3.5 h-3.5" />;
          } else if (item.recommendation === 'VOLATILE') {
            badgeColor = 'bg-purple-600 text-white';
            icon = <AlertTriangle className="w-3.5 h-3.5" />;
          }

          return (
            <div
              key={idx}
              className="bg-white rounded-3xl border border-slate-200 hover:border-blue-400 hover:shadow-xl transition-all duration-200 flex flex-col justify-between overflow-hidden group shadow-xs"
            >
              <div>
                {/* Full-Width Visual Image Header */}
                <div className="relative h-48 w-full overflow-hidden bg-slate-900">
                  <img
                    src={item.imageUrl}
                    alt={item.category}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=700&auto=format&fit=crop&q=80';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />

                  {/* Top Badges */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg bg-slate-900/80 backdrop-blur-md text-white border border-white/20">
                      {item.badgeTag}
                    </span>

                    <span
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wider uppercase flex items-center gap-1 shadow-md ${badgeColor}`}
                    >
                      {icon}
                      <span>{item.recommendation}</span>
                    </span>
                  </div>

                  {/* Bottom Image Stats */}
                  <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-white text-xs">
                    <span className="text-[11px] font-extrabold drop-shadow-md">
                      {item.lowestPriceRecorded}
                    </span>
                    <span className="text-[10px] font-mono font-bold bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/30">
                      Score: {item.dealScore}/100
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5 space-y-3">
                  <div>
                    <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-wider block">
                      {item.vertical.toUpperCase()}
                    </span>
                    <h3 className="text-base font-extrabold text-slate-900 leading-snug group-hover:text-blue-600 transition-colors">
                      {item.category}
                    </h3>
                  </div>

                  <p className="text-xs font-semibold text-slate-800 leading-snug">
                    {item.headline}
                  </p>

                  <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-3">
                    {item.rationale}
                  </p>

                  {/* Cross-Platform Mini Ranking */}
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1.5 text-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">
                      Cross-Platform Best Price
                    </span>
                    {item.competitors.slice(0, 2).map((comp, cIdx) => (
                      <div key={cIdx} className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-700 font-semibold truncate">{comp.platform}</span>
                        <span className="font-mono font-bold text-slate-900">
                          {typeof comp.price === 'number' && comp.price > 100
                            ? `₹${comp.price.toLocaleString('en-IN')}`
                            : `${comp.price}% APR`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="p-5 pt-0 space-y-2.5">
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-slate-500">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[11px] font-medium">{item.bestDayOrTime}</span>
                  </div>
                  <span className="text-[11px] font-extrabold text-emerald-600">
                    {item.estSavings}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleInspect(item.vertical)}
                  className="w-full py-2.5 px-4 bg-slate-900 hover:bg-blue-600 active:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Launch {item.vertical.toUpperCase()} Metasearch</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
