import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  BarChart3,
  Target,
  Sparkles,
  Zap,
  ShieldCheck,
  CheckCircle2,
  Building2,
  Calculator,
  Layers,
  Plus,
  CreditCard,
  Utensils,
  ShoppingBag,
  Plane,
  Car,
  Landmark,
  Film,
  Bus,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { INITIAL_MERCHANT_METRICS } from '../../data/merchantData';
import { VerticalId } from '../../types';

interface SubCategoryBenchmark {
  category: string;
  cpl: string;
  volume: string;
  bar: string;
  color: string;
  note: string;
}

interface FunnelStep {
  label: string;
  count: string;
  note: string;
}

interface CategoryAnalyticsConfig {
  title: string;
  badge: string;
  description: string;
  growthText: string;
  ctrText: string;
  deliveredText: string;
  cplTitle: string;
  averageCpl: number;
  averageCplSub: string;
  turnoverLabel: string;
  turnoverValue: string;
  turnoverSub: string;
  breakdownTitle: string;
  funnelSteps: [FunnelStep, FunnelStep, FunnelStep, FunnelStep];
  benchmarks: SubCategoryBenchmark[];
  roiDefaults: {
    volume: number;
    volumeLabel: string;
    volumeMin: number;
    volumeMax: number;
    volumeStep: number;
    costPerUnit: number;
    costLabel: string;
    costMin: number;
    costMax: number;
    costStep: number;
    conversionRate: number;
    conversionLabel: string;
    avgTicket: number;
    ticketLabel: string;
    ticketMin: number;
    ticketMax: number;
    ticketStep: number;
    marginPercent: number;
    marginLabel: string;
    outputVolumeLabel: string;
    outputGrossLabel: string;
  };
  proofPointTitle: string;
  proofPointText: string;
}

const CATEGORY_ANALYTICS: Record<string, CategoryAnalyticsConfig> = {
  food: {
    title: 'Food Delivery Orders & Unit Economics Analytics',
    badge: 'Food Delivery B2B Performance & Attribution',
    description: 'Directly measuring metasearch restaurant delivery conversions, average order basket economics, lunch & dinner peak rush order volume.',
    growthText: '↑ 28.4% MoM across Dining & Delivery Orders',
    ctrText: '14.2% Menu Item Clicks to Cart Addition',
    deliveredText: 'Zero duplicate / 100% verified food orders',
    cplTitle: 'Average Cost Per Order (CPO)',
    averageCpl: 18,
    averageCplSub: 'Blended Acquisition Cost per Fulfilled Order',
    turnoverLabel: 'Gross Order Value (GMV)',
    turnoverValue: '₹18.6 Cr',
    turnoverSub: 'Delivered food & dining cart revenue',
    breakdownTitle: 'Cost-Per-Order (CPO) by Food Cuisine & Format',
    benchmarks: [
      {
        category: 'Weekend Gourmet & Biryani Feast Orders',
        cpl: '₹18 / order',
        volume: '42% share',
        bar: 'w-[84%]',
        color: 'bg-orange-500',
        note: 'High basket average > ₹650',
      },
      {
        category: 'Corporate Tech Lunch Combos (B2B Catering)',
        cpl: '₹24 / order',
        volume: '26% share',
        bar: 'w-[52%]',
        color: 'bg-emerald-600',
        note: 'Bulk meals avg ticket ₹1,800+',
      },
      {
        category: 'Late-Night Munchies & Pizza Delivery',
        cpl: '₹15 / order',
        volume: '20% share',
        bar: 'w-[40%]',
        color: 'bg-blue-600',
        note: 'Peak midnight surge demand',
      },
      {
        category: 'Healthy Salads & Keto Meal Subscription',
        cpl: '₹22 / order',
        volume: '12% share',
        bar: 'w-[24%]',
        color: 'bg-purple-600',
        note: 'High 30-day recurring reorder rate',
      },
    ],
    funnelSteps: [
      { label: 'Step 1: Restaurant Impressions', count: '312,400 Views', note: '100% Top of Funnel' },
      { label: 'Step 2: Menu Clicks & Item Views', count: '44,360 Clicks', note: '14.2% CTR' },
      { label: 'Step 3: Cart Additions & Checkout Starts', count: '8,870 Carts', note: '20% Intent Rate' },
      { label: 'Step 4: Final Delivered Food Orders', count: '7,980 Delivered', note: '90% Order Fulfillment' },
    ],
    roiDefaults: {
      volume: 1500,
      volumeLabel: 'Monthly Inbound Orders:',
      volumeMin: 100,
      volumeMax: 5000,
      volumeStep: 100,
      costPerUnit: 18,
      costLabel: 'CPO / Acquisition Bid (₹):',
      costMin: 10,
      costMax: 60,
      costStep: 2,
      conversionRate: 35,
      conversionLabel: 'Cart-to-Delivery Rate (%):',
      avgTicket: 520,
      ticketLabel: 'Average Order Basket (₹):',
      ticketMin: 150,
      ticketMax: 2500,
      ticketStep: 50,
      marginPercent: 18,
      marginLabel: 'Platform Commission / Take-Rate (%):',
      outputVolumeLabel: 'Delivered Food Orders:',
      outputGrossLabel: 'Gross Food Merchandise Value (GMV):',
    },
    proofPointTitle: 'B2B Food Merchant Sales Proof Point:',
    proofPointText:
      'By capturing high-intent consumers actively comparing food delivery menus and coupon codes on Try1Second, merchant partners achieve 2.8X higher repeat reorder rates compared to cold social ads.',
  },

  grocery: {
    title: '10-Min Quick-Commerce Basket & CAC Analytics',
    badge: 'Quick-Commerce B2B Performance & Attribution',
    description: 'Directly measuring dark-store instant delivery conversions, pantry basket ticket sizes, and locality delivery speed yield.',
    growthText: '↑ 36.2% MoM across Dark Store Deliveries',
    ctrText: '18.4% Product Clicks to Cart Addition',
    deliveredText: '100% geo-fenced pin-code instant deliveries',
    cplTitle: 'Average Cost Per Order (CPO)',
    averageCpl: 14,
    averageCplSub: 'Blended Cost per Instant Grocery Delivery',
    turnoverLabel: 'Grocery Basket Turnover',
    turnoverValue: '₹22.4 Cr',
    turnoverSub: 'Delivered staples, dairy & fresh produce',
    breakdownTitle: 'Cost-Per-Order (CPO) by Grocery Category',
    benchmarks: [
      {
        category: 'Daily Fresh Vegetables & Farm Fruits',
        cpl: '₹12 / order',
        volume: '38% share',
        bar: 'w-[76%]',
        color: 'bg-emerald-600',
        note: 'Daily recurring morning essential',
      },
      {
        category: 'Dairy, Eggs, Bread & Breakfast Staples',
        cpl: '₹10 / order',
        volume: '30% share',
        bar: 'w-[60%]',
        color: 'bg-blue-600',
        note: 'Top household frequency driver',
      },
      {
        category: 'Snacks, Cold Drinks & Party Munchies',
        cpl: '₹16 / order',
        volume: '20% share',
        bar: 'w-[40%]',
        color: 'bg-amber-600',
        note: 'High margin impulse basket item',
      },
      {
        category: 'Home Care, Detergents & Personal Hygiene',
        cpl: '₹18 / order',
        volume: '12% share',
        bar: 'w-[24%]',
        color: 'bg-purple-600',
        note: 'Higher ticket bulk pack purchases',
      },
    ],
    funnelSteps: [
      { label: 'Step 1: Grocery Search Impressions', count: '480,000 Views', note: '100% Top of Funnel' },
      { label: 'Step 2: Instant Deal & SKU Clicks', count: '88,320 Clicks', note: '18.4% CTR' },
      { label: 'Step 3: 10-Min Delivery Checkouts', count: '18,540 Orders', note: '21% Cart Conversion' },
      { label: 'Step 4: Fulfilled Dark Store Deliveries', count: '17,610 Fulfilled', note: '95% On-Time Fulfillment' },
    ],
    roiDefaults: {
      volume: 2500,
      volumeLabel: 'Monthly Inbound Grocery Orders:',
      volumeMin: 200,
      volumeMax: 10000,
      volumeStep: 100,
      costPerUnit: 14,
      costLabel: 'Acquisition Cost per Order (₹):',
      costMin: 8,
      costMax: 40,
      costStep: 2,
      conversionRate: 42,
      conversionLabel: 'Cart-to-Delivery Rate (%):',
      avgTicket: 680,
      ticketLabel: 'Average Grocery Basket (₹):',
      ticketMin: 200,
      ticketMax: 2000,
      ticketStep: 20,
      marginPercent: 15,
      marginLabel: 'Retail Margin / Commission (%):',
      outputVolumeLabel: 'Fulfilled Grocery Deliveries:',
      outputGrossLabel: 'Gross Grocery GMV Fulfilled:',
    },
    proofPointTitle: 'B2B Quick Commerce Sales Proof Point:',
    proofPointText:
      'Hyper-local 10-minute grocery comparison on Try1Second converts high-intent shoppers searching for out-of-stock items, securing immediate dark store checkout velocity.',
  },

  ecommerce: {
    title: 'E-Commerce SKU Conversion & Cart Value Analytics',
    badge: 'E-Commerce Catalog B2B Performance',
    description: 'Tracking consumer price parity searches, electronics and fashion conversions, and multi-channel marketplace return-on-ad-spend.',
    growthText: '↑ 22.8% MoM across Electronics & Apparel',
    ctrText: '11.5% Product Clicks to Storefront',
    deliveredText: '100% verified click-outs to official storefront',
    cplTitle: 'Average Cost Per Click (CPC)',
    averageCpl: 16,
    averageCplSub: 'Blended Acquisition Cost per Storefront Visit',
    turnoverLabel: 'Catalog Merchandise Value',
    turnoverValue: '₹34.1 Cr',
    turnoverSub: 'Attributed e-commerce marketplace orders',
    breakdownTitle: 'Acquisition Unit Economics by Category',
    benchmarks: [
      {
        category: 'Smartphones, Audio & Laptops',
        cpl: '₹22 / click',
        volume: '45% share',
        bar: 'w-[90%]',
        color: 'bg-blue-600',
        note: 'Avg basket value ₹18,000+',
      },
      {
        category: 'Fashion, Sneakers & Seasonal Apparel',
        cpl: '₹14 / click',
        volume: '25% share',
        bar: 'w-[50%]',
        color: 'bg-emerald-600',
        note: 'High repeat seasonal purchases',
      },
      {
        category: 'Home Appliances & Smart Kitchen',
        cpl: '₹18 / click',
        volume: '18% share',
        bar: 'w-[36%]',
        color: 'bg-amber-600',
        note: 'Multi-brand feature comparisons',
      },
      {
        category: 'Beauty, Skincare & Grooming',
        cpl: '₹12 / click',
        volume: '12% share',
        bar: 'w-[24%]',
        color: 'bg-rose-600',
        note: 'High organic retention rate',
      },
    ],
    funnelSteps: [
      { label: 'Step 1: Product Deal Impressions', count: '520,000 Views', note: '100% Top of Funnel' },
      { label: 'Step 2: Price Comparison Clicks', count: '59,800 Clicks', note: '11.5% CTR' },
      { label: 'Step 3: Merchant Storefront Landing', count: '14,950 Qualified', note: '25% Add to Cart' },
      { label: 'Step 4: Completed Purchases', count: '3,880 Orders', note: '26% Checkout Rate' },
    ],
    roiDefaults: {
      volume: 2000,
      volumeLabel: 'Monthly Inbound Shopper Visits:',
      volumeMin: 200,
      volumeMax: 8000,
      volumeStep: 100,
      costPerUnit: 16,
      costLabel: 'CPC Bid Price (₹):',
      costMin: 6,
      costMax: 50,
      costStep: 2,
      conversionRate: 18,
      conversionLabel: 'Visit-to-Purchase Rate (%):',
      avgTicket: 2400,
      ticketLabel: 'Average Cart Basket (₹):',
      ticketMin: 500,
      ticketMax: 25000,
      ticketStep: 100,
      marginPercent: 12,
      marginLabel: 'Gross Margin / Commission (%):',
      outputVolumeLabel: 'Purchases Generated:',
      outputGrossLabel: 'Total E-Commerce GMV Attributed:',
    },
    proofPointTitle: 'B2B Retail Partner Proof Point:',
    proofPointText:
      'Shoppers comparing retail price tags on Try1Second show a 3.1X higher purchase intent than casual social browsers, drastically cutting bounce rates.',
  },

  flights: {
    title: 'Airline Flights & Route Yield Acquisition Analytics',
    badge: 'Aviation B2B Metasearch Performance',
    description: 'Measuring domestic and international flight route price comparisons, passenger seat conversions, and booking commissions.',
    growthText: '↑ 26.5% MoM across Metro & Leisure Routes',
    ctrText: '9.8% Route Search to Fare Lock',
    deliveredText: '100% verified passenger route inquiries',
    cplTitle: 'Average Cost Per Booking Inquiry (CAC)',
    averageCpl: 45,
    averageCplSub: 'Cost per High-Intent Fare Search Intent',
    turnoverLabel: 'Passenger Booking Volume',
    turnoverValue: '₹58.2 Cr',
    turnoverSub: 'Attributed flight ticket reservations',
    breakdownTitle: 'Attribution by Route Category',
    benchmarks: [
      {
        category: 'Tier-1 Metro Corridors (DEL-BOM, BLR-DEL)',
        cpl: '₹42 / inquiry',
        volume: '48% share',
        bar: 'w-[96%]',
        color: 'bg-blue-600',
        note: 'Frequent business flyers',
      },
      {
        category: 'Holiday & Leisure Flights (Goa, Srinagar, Kerala)',
        cpl: '₹55 / inquiry',
        volume: '24% share',
        bar: 'w-[48%]',
        color: 'bg-emerald-600',
        note: 'Multi-passenger family bookings',
      },
      {
        category: 'Short-Haul International (Dubai, Bangkok, Singapore)',
        cpl: '₹68 / inquiry',
        volume: '18% share',
        bar: 'w-[36%]',
        color: 'bg-purple-600',
        note: 'High ticket international bookings',
      },
      {
        category: 'Regional UDAN & Tier-2 Connect Routes',
        cpl: '₹35 / inquiry',
        volume: '10% share',
        bar: 'w-[20%]',
        color: 'bg-amber-600',
        note: 'Fast growing emerging traffic',
      },
    ],
    funnelSteps: [
      { label: 'Step 1: Route Fare Searches', count: '290,000 Views', note: '100% Top of Funnel' },
      { label: 'Step 2: Airline Choice & Fare Locks', count: '28,420 Clicks', note: '9.8% CTR' },
      { label: 'Step 3: Passenger Details Entry', count: '7,105 Inquiries', note: '25% Form Rate' },
      { label: 'Step 4: Ticket Issue & PNR Generation', count: '2,270 Bookings', note: '32% Conversion' },
    ],
    roiDefaults: {
      volume: 800,
      volumeLabel: 'Monthly Route Bookings Inbound:',
      volumeMin: 100,
      volumeMax: 3000,
      volumeStep: 50,
      costPerUnit: 45,
      costLabel: 'Acquisition Bid per Fare (₹):',
      costMin: 20,
      costMax: 150,
      costStep: 5,
      conversionRate: 22,
      conversionLabel: 'Fare-to-Booking Rate (%):',
      avgTicket: 8500,
      ticketLabel: 'Average Flight Ticket (₹):',
      ticketMin: 3000,
      ticketMax: 40000,
      ticketStep: 500,
      marginPercent: 5.5,
      marginLabel: 'OTA / Airline Commission (%):',
      outputVolumeLabel: 'Flight Tickets Issued:',
      outputGrossLabel: 'Gross Passenger Booking Volume:',
    },
    proofPointTitle: 'Aviation Metasearch Proof Point:',
    proofPointText:
      'Travelers benchmarking real-time airfares across airlines on Try1Second book within an average window of 14 minutes, giving airline partners immediate route fill rate.',
  },

  hotels: {
    title: 'Hotels & Luxury Resorts Booking Yield Analytics',
    badge: 'Hospitality B2B Performance & Direct Bookings',
    description: 'Analyzing direct room bookings, seasonal occupancy, average daily rate (ADR), and OTA price parity yield.',
    growthText: '↑ 24.1% MoM across Business & Leisure Stays',
    ctrText: '10.2% Hotel Listing to Date Availability',
    deliveredText: '100% confirmed check-in reservation leads',
    cplTitle: 'Cost Per Room Booking Intent',
    averageCpl: 65,
    averageCplSub: 'Cost per Qualified Stay Inquiry',
    turnoverLabel: 'Room Reservation Revenue',
    turnoverValue: '₹28.9 Cr',
    turnoverSub: 'Attributed luxury and business hotel stays',
    breakdownTitle: 'Acquisition Yield by Property Class',
    benchmarks: [
      {
        category: 'Business Executive Stays (Bangalore, Mumbai, NCR)',
        cpl: '₹55 / stay',
        volume: '40% share',
        bar: 'w-[80%]',
        color: 'bg-blue-600',
        note: 'Avg stay 2.4 nights, corporate billings',
      },
      {
        category: '5-Star Luxury Resorts (Udaipur, Goa, Coorg)',
        cpl: '₹85 / stay',
        volume: '30% share',
        bar: 'w-[60%]',
        color: 'bg-emerald-600',
        note: 'High basket average ₹18,000+/night',
      },
      {
        category: 'Boutique Stays & Heritage Villas',
        cpl: '₹60 / stay',
        volume: '20% share',
        bar: 'w-[40%]',
        color: 'bg-amber-600',
        note: 'Weekend group getaways',
      },
      {
        category: 'Transit & Airport Express Hotels',
        cpl: '₹45 / stay',
        volume: '10% share',
        bar: 'w-[20%]',
        color: 'bg-purple-600',
        note: 'Fast turnaround same-day bookings',
      },
    ],
    funnelSteps: [
      { label: 'Step 1: Hotel Listing Impressions', count: '180,000 Views', note: '100% Top of Funnel' },
      { label: 'Step 2: Room Choice & Date Availability', count: '18,360 Clicks', note: '10.2% CTR' },
      { label: 'Step 3: Reservation Checkout Initiations', count: '4,590 Stays', note: '25% Checkout Intent' },
      { label: 'Step 4: Confirmed Paid Guest Check-Ins', count: '1,420 Stays', note: '31% Final Booking' },
    ],
    roiDefaults: {
      volume: 500,
      volumeLabel: 'Monthly Room Stay Inquiries:',
      volumeMin: 50,
      volumeMax: 2000,
      volumeStep: 25,
      costPerUnit: 65,
      costLabel: 'Acquisition Cost per Stay (₹):',
      costMin: 30,
      costMax: 200,
      costStep: 5,
      conversionRate: 24,
      conversionLabel: 'Inquiry-to-Booking Rate (%):',
      avgTicket: 12500,
      ticketLabel: 'Average Stay Booking Value (₹):',
      ticketMin: 2500,
      ticketMax: 50000,
      ticketStep: 500,
      marginPercent: 14,
      marginLabel: 'Direct Booking Commission / Margin (%):',
      outputVolumeLabel: 'Confirmed Hotel Bookings:',
      outputGrossLabel: 'Gross Hotel Booking Revenue:',
    },
    proofPointTitle: 'Hospitality Partner Proof Point:',
    proofPointText:
      'Hotel brands achieve lower customer acquisition costs on Try1Second compared to standard OTA commissions by capturing travelers comparing room rates side-by-side.',
  },

  loans: {
    title: 'High-Ticket Cost-Per-Lead (CPL) Lending Analytics',
    badge: 'Banking & Lending B2B Performance',
    description: 'Directly measuring metasearch lead conversion quality, acquisition unit economics, and multi-bank portfolio disbursals across India\'s top lending institutions.',
    growthText: '↑ 24.5% MoM across Loans & Mortgages',
    ctrText: '8.9% Lead Form Completion Rate',
    deliveredText: 'Zero duplicate / 100% salary & CIBIL verified',
    cplTitle: 'Average Blended CPL',
    averageCpl: 750,
    averageCplSub: 'Fixed Cost per Qualified Loan Submission',
    turnoverLabel: 'Portfolio Disbursal Volume',
    turnoverValue: '₹42.8 Cr',
    turnoverSub: 'Estimated loan disbursal book value',
    breakdownTitle: 'Cost-Per-Lead (CPL) by Loan Product',
    benchmarks: [
      {
        category: 'Unsecured Personal Loans (Salaried > ₹50k)',
        cpl: '₹750 / lead',
        volume: '42% share',
        bar: 'w-[84%]',
        color: 'bg-blue-600',
        note: 'Avg loan size ₹6.5 Lakhs',
      },
      {
        category: 'Prime Home Mortgages & Balance Transfer',
        cpl: '₹950 / lead',
        volume: '28% share',
        bar: 'w-[56%]',
        color: 'bg-emerald-600',
        note: 'Avg ticket ₹48 Lakhs, prime CIBIL > 760',
      },
      {
        category: 'Used Car & Auto Refinance Loans',
        cpl: '₹620 / lead',
        volume: '18% share',
        bar: 'w-[36%]',
        color: 'bg-orange-600',
        note: 'Quick 24-hr disbursal turnaround',
      },
      {
        category: 'SME Business Working Capital Term Loans',
        cpl: '₹850 / lead',
        volume: '12% share',
        bar: 'w-[24%]',
        color: 'bg-purple-600',
        note: 'GST return verified balance sheets',
      },
    ],
    funnelSteps: [
      { label: 'Step 1: Loan Comparison Views', count: '184,520 Views', note: '100% Top of Funnel' },
      { label: 'Step 2: Interest Rate Checks & Clicks', count: '23,640 Clicks', note: '12.8% CTR' },
      { label: 'Step 3: Multi-Bank CPL Form Leads', count: '2,116 Leads', note: '8.9% Form Completion' },
      { label: 'Step 4: Final Sanctioned & Disbursed Loans', count: '465 Disbursals', note: '22% Approval Rate' },
    ],
    roiDefaults: {
      volume: 500,
      volumeLabel: 'Monthly Inbound Leads:',
      volumeMin: 50,
      volumeMax: 2500,
      volumeStep: 50,
      costPerUnit: 750,
      costLabel: 'CPL Bid Price (₹):',
      costMin: 300,
      costMax: 1500,
      costStep: 50,
      conversionRate: 24,
      conversionLabel: 'Lead-to-Disbursal Rate (%):',
      avgTicket: 650000,
      ticketLabel: 'Average Loan Ticket (₹):',
      ticketMin: 100000,
      ticketMax: 5000000,
      ticketStep: 50000,
      marginPercent: 2.75,
      marginLabel: 'NIM / Payout Commission (%):',
      outputVolumeLabel: 'Disbursed Borrowers:',
      outputGrossLabel: 'Total Disbursed Portfolio Value:',
    },
    proofPointTitle: 'B2B Banking Partner Proof Point:',
    proofPointText:
      'By ingesting high-intent metasearch users who specifically compared interest rates on Try1Second, institutional partners achieve a 3.4X higher sanction rate than cold call centers.',
  },

  insurance: {
    title: 'Insurance Policy Issuance & Actuarial CAC Analytics',
    badge: 'Insurance Metasearch B2B Attribution',
    description: 'Measuring health, term life, and motor insurance quote comparisons, underwriting pass rates, and premium portfolio yield.',
    growthText: '↑ 21.4% MoM across Life & Health Covers',
    ctrText: '9.4% Premium Quote Completion Rate',
    deliveredText: '100% pre-underwritten verified submissions',
    cplTitle: 'Average Blended CPL',
    averageCpl: 620,
    averageCplSub: 'Cost per Qualified Policy Application',
    turnoverLabel: 'Gross Written Premium (GWP)',
    turnoverValue: '₹31.5 Cr',
    turnoverSub: 'Attributed annualized premium portfolio',
    breakdownTitle: 'Cost-Per-Lead (CPL) by Policy Type',
    benchmarks: [
      {
        category: '₹1 Crore Cashless Health Insurance Floater',
        cpl: '₹680 / lead',
        volume: '40% share',
        bar: 'w-[80%]',
        color: 'bg-emerald-600',
        note: 'Avg annual premium ₹22,000',
      },
      {
        category: 'Term Life Comprehensive Cover (Age 25-45)',
        cpl: '₹720 / lead',
        volume: '30% share',
        bar: 'w-[60%]',
        color: 'bg-blue-600',
        note: 'Long-term 30-year policy persistence',
      },
      {
        category: 'Zero-Dep Private Motor Insurance Covers',
        cpl: '₹480 / lead',
        volume: '20% share',
        bar: 'w-[40%]',
        color: 'bg-orange-600',
        note: 'Instant online policy issuance',
      },
      {
        category: 'Senior Citizen Critical Illness Riders',
        cpl: '₹590 / lead',
        volume: '10% share',
        bar: 'w-[20%]',
        color: 'bg-purple-600',
        note: 'High premium margin category',
      },
    ],
    funnelSteps: [
      { label: 'Step 1: Policy Premium Searches', count: '210,000 Views', note: '100% Top of Funnel' },
      { label: 'Step 2: Benefit Comparison Clicks', count: '24,360 Clicks', note: '11.6% CTR' },
      { label: 'Step 3: Pre-Underwriting Submissions', count: '2,289 Leads', note: '9.4% Form Rate' },
      { label: 'Step 4: Active Issued Insurance Policies', count: '595 Policies', note: '26% Issuance Rate' },
    ],
    roiDefaults: {
      volume: 600,
      volumeLabel: 'Monthly Inbound Policy Leads:',
      volumeMin: 50,
      volumeMax: 3000,
      volumeStep: 50,
      costPerUnit: 620,
      costLabel: 'CPL Bid Price (₹):',
      costMin: 250,
      costMax: 1200,
      costStep: 50,
      conversionRate: 26,
      conversionLabel: 'Lead-to-Issuance Rate (%):',
      avgTicket: 24000,
      ticketLabel: 'Average Annual Premium (₹):',
      ticketMin: 5000,
      ticketMax: 100000,
      ticketStep: 1000,
      marginPercent: 16,
      marginLabel: 'Brokerage / Commission Yield (%):',
      outputVolumeLabel: 'Issued Insurance Policies:',
      outputGrossLabel: 'Gross Written Premium (GWP) Book:',
    },
    proofPointTitle: 'Insurance Partner Proof Point:',
    proofPointText:
      'Comparing deductibles and hospital network inclusions on Try1Second produces policyholders with 40% lower first-year claim friction and higher renewal persistency.',
  },

  cab: {
    title: 'Cabs & Ride-Hailing Booking Fulfillment Analytics',
    badge: 'Ride-Hailing Metasearch B2B Performance',
    description: 'Analyzing city rides, airport pickups, intercity round-trip pricing, and driver dispatch unit economics.',
    growthText: '↑ 31.8% MoM across City & Airport Trips',
    ctrText: '16.4% Fare Comparison to Ride Dispatch',
    deliveredText: '100% GPS-verified ride booking intents',
    cplTitle: 'Average Cost Per Ride Booking',
    averageCpl: 22,
    averageCplSub: 'Cost per Completed Ride Dispatch',
    turnoverLabel: 'Gross Ride Bookings GMV',
    turnoverValue: '₹14.2 Cr',
    turnoverSub: 'Attributed fulfilled trip meter fares',
    breakdownTitle: 'Cost-Per-Ride by Trip Type',
    benchmarks: [
      {
        category: 'Airport Transfer & Express Terminal Drop',
        cpl: '₹28 / ride',
        volume: '44% share',
        bar: 'w-[88%]',
        color: 'bg-blue-600',
        note: 'Avg fare ₹950+, zero cancellation',
      },
      {
        category: 'Peak Office Rush Hour City Commute',
        cpl: '₹18 / ride',
        volume: '30% share',
        bar: 'w-[60%]',
        color: 'bg-emerald-600',
        note: 'Daily recurring commuter base',
      },
      {
        category: 'Outstation Weekend Intercity Cabs',
        cpl: '₹35 / ride',
        volume: '16% share',
        bar: 'w-[32%]',
        color: 'bg-amber-600',
        note: 'High ticket round trip ₹3,800+',
      },
      {
        category: 'Hourly Rental & Multi-Stop Packages',
        cpl: '₹25 / ride',
        volume: '10% share',
        bar: 'w-[20%]',
        color: 'bg-purple-600',
        note: 'Dedicated driver 4-8 hour bookings',
      },
    ],
    funnelSteps: [
      { label: 'Step 1: Cab Fare Estimates', count: '340,000 Views', note: '100% Top of Funnel' },
      { label: 'Step 2: Platform Selection Clicks', count: '55,760 Clicks', note: '16.4% CTR' },
      { label: 'Step 3: Ride Request Dispatch', count: '13,940 Requests', note: '25% Booking Start' },
      { label: 'Step 4: Completed Arrived Rides', count: '12,260 Completed', note: '88% Trip Completion' },
    ],
    roiDefaults: {
      volume: 1800,
      volumeLabel: 'Monthly Inbound Ride Inquiries:',
      volumeMin: 200,
      volumeMax: 8000,
      volumeStep: 100,
      costPerUnit: 22,
      costLabel: 'Acquisition Bid per Ride (₹):',
      costMin: 10,
      costMax: 60,
      costStep: 2,
      conversionRate: 38,
      conversionLabel: 'Inquiry-to-Trip Rate (%):',
      avgTicket: 580,
      ticketLabel: 'Average Ride Fare (₹):',
      ticketMin: 150,
      ticketMax: 3000,
      ticketStep: 50,
      marginPercent: 20,
      marginLabel: 'Platform Commission Take-Rate (%):',
      outputVolumeLabel: 'Completed Rides Fulfilled:',
      outputGrossLabel: 'Gross Ride Fares GMV:',
    },
    proofPointTitle: 'Ride-Hailing Partner Proof Point:',
    proofPointText:
      'Commuters comparing ETAs and surge multipliers on Try1Second book immediately with nearest available cabs, cutting passenger wait times by 4.2 minutes.',
  },

  movie: {
    title: 'Cinema & Movie Ticket Box Office Analytics',
    badge: 'Entertainment & IMAX B2B Performance',
    description: 'Tracking blockbuster weekend showtimes, IMAX and 3D screen ticket bookings, and concession F&B bundle sales.',
    growthText: '↑ 25.0% MoM across Multiplex Screenings',
    ctrText: '15.8% Show Selection to Seat Layout',
    deliveredText: '100% verified cinema box office bookings',
    cplTitle: 'Average Cost Per Seat Booking',
    averageCpl: 15,
    averageCplSub: 'Acquisition Cost per Movie Ticket Sold',
    turnoverLabel: 'Box Office Ticket Revenue',
    turnoverValue: '₹9.8 Cr',
    turnoverSub: 'Attributed cinema seats & F&B combos',
    breakdownTitle: 'Cost-Per-Ticket by Cinema Experience',
    benchmarks: [
      {
        category: 'IMAX, 4DX & Luxury Recliner Shows',
        cpl: '₹18 / seat',
        volume: '45% share',
        bar: 'w-[90%]',
        color: 'bg-purple-600',
        note: 'Avg ticket ₹650+, high concession spend',
      },
      {
        category: 'Weekend Prime Evening Blockbusters',
        cpl: '₹14 / seat',
        volume: '30% share',
        bar: 'w-[60%]',
        color: 'bg-blue-600',
        note: 'Housefull Friday-Sunday demand',
      },
      {
        category: 'Weekday Matinee & College Discount Shows',
        cpl: '₹10 / seat',
        volume: '15% share',
        bar: 'w-[30%]',
        color: 'bg-emerald-600',
        note: 'Filling off-peak auditorium seats',
      },
      {
        category: 'Movie + Popcorn & Drink Combo Packages',
        cpl: '₹16 / seat',
        volume: '10% share',
        bar: 'w-[20%]',
        color: 'bg-amber-600',
        note: 'High margin food & beverage sales',
      },
    ],
    funnelSteps: [
      { label: 'Step 1: Movie Trailer & Show Searches', count: '260,000 Views', note: '100% Top of Funnel' },
      { label: 'Step 2: Cinema Showtime & Seat Clicks', count: '41,080 Clicks', note: '15.8% CTR' },
      { label: 'Step 3: Seat Layout Selection', count: '10,270 Starts', note: '25% Cart Rate' },
      { label: 'Step 4: Confirmed E-Tickets Issued', count: '8,420 Tickets', note: '82% Payment Success' },
    ],
    roiDefaults: {
      volume: 2000,
      volumeLabel: 'Monthly Inbound Ticket Searches:',
      volumeMin: 200,
      volumeMax: 8000,
      volumeStep: 100,
      costPerUnit: 15,
      costLabel: 'Acquisition Cost per Ticket (₹):',
      costMin: 8,
      costMax: 40,
      costStep: 2,
      conversionRate: 40,
      conversionLabel: 'Search-to-Ticket Rate (%):',
      avgTicket: 420,
      ticketLabel: 'Average Seat Ticket Price (₹):',
      ticketMin: 150,
      ticketMax: 1500,
      ticketStep: 25,
      marginPercent: 12,
      marginLabel: 'Convenience Fee & Ticket Margin (%):',
      outputVolumeLabel: 'Cinema Tickets Sold:',
      outputGrossLabel: 'Gross Box Office Ticket Sales:',
    },
    proofPointTitle: 'Cinema Exhibitor Proof Point:',
    proofPointText:
      'Moviegoers benchmarking nearby theater showtimes and recliner availability on Try1Second book tickets 40 minutes ahead of show start, optimizing seat occupancy.',
  },

  bus: {
    title: 'Intercity Bus Sleeper Bookings & Route Analytics',
    badge: 'Intercity Bus Metasearch Performance',
    description: 'Monitoring overnight AC sleeper route occupancy, boarding point passenger yield, and bus operator seat yield.',
    growthText: '↑ 27.2% MoM across Intercity Highway Routes',
    ctrText: '11.0% Route Search to Seat Selection',
    deliveredText: '100% confirmed passenger boarding reservations',
    cplTitle: 'Average Cost Per Bus Reservation',
    averageCpl: 25,
    averageCplSub: 'Cost per Fulfilled Bus Passenger Seat',
    turnoverLabel: 'Bus Ticket GMV',
    turnoverValue: '₹16.5 Cr',
    turnoverSub: 'Attributed interstate AC bus reservations',
    breakdownTitle: 'Acquisition Cost by Bus Route Category',
    benchmarks: [
      {
        category: 'Overnight Multi-Axle AC Sleeper Routes',
        cpl: '₹28 / seat',
        volume: '46% share',
        bar: 'w-[92%]',
        color: 'bg-blue-600',
        note: 'Avg ticket ₹1,450+, prime comfort',
      },
      {
        category: 'High-Frequency Intercity Express (4-6 Hrs)',
        cpl: '₹20 / seat',
        volume: '28% share',
        bar: 'w-[56%]',
        color: 'bg-emerald-600',
        note: 'Weekly commuter weekend rush',
      },
      {
        category: 'Pilgrimage & Heritage Routes (Tirupati, Shirdi)',
        cpl: '₹24 / seat',
        volume: '16% share',
        bar: 'w-[32%]',
        color: 'bg-amber-600',
        note: 'Multi-seat family reservations',
      },
      {
        category: 'Last-Minute Same Day Departure Seats',
        cpl: '₹22 / seat',
        volume: '10% share',
        bar: 'w-[20%]',
        color: 'bg-purple-600',
        note: 'Filling unsold bus inventory',
      },
    ],
    funnelSteps: [
      { label: 'Step 1: Intercity Route Searches', count: '230,000 Views', note: '100% Top of Funnel' },
      { label: 'Step 2: Bus Operator & Timing Clicks', count: '25,300 Clicks', note: '11.0% CTR' },
      { label: 'Step 3: Boarding Point & Berth Selection', count: '6,325 Starts', note: '25% Checkout Intent' },
      { label: 'Step 4: Confirmed Bus E-Tickets Issued', count: '4,870 Bookings', note: '77% Booking Rate' },
    ],
    roiDefaults: {
      volume: 1200,
      volumeLabel: 'Monthly Inbound Bus Searches:',
      volumeMin: 100,
      volumeMax: 5000,
      volumeStep: 100,
      costPerUnit: 25,
      costLabel: 'Acquisition Bid per Seat (₹):',
      costMin: 12,
      costMax: 70,
      costStep: 2,
      conversionRate: 32,
      conversionLabel: 'Search-to-Seat Rate (%):',
      avgTicket: 1150,
      ticketLabel: 'Average Bus Seat Fare (₹):',
      ticketMin: 350,
      ticketMax: 3500,
      ticketStep: 50,
      marginPercent: 10,
      marginLabel: 'Bus Operator Commission (%):',
      outputVolumeLabel: 'Bus Passenger Seats Issued:',
      outputGrossLabel: 'Gross Bus Ticket Booking GMV:',
    },
    proofPointTitle: 'Bus Fleet Operator Proof Point:',
    proofPointText:
      'Travelers comparing departure timings and sleeper comfort on Try1Second book verified seats with 92% show-up rates, minimizing empty bus inventory on long-distance routes.',
  },
};

export const MerchantAnalyticsTab: React.FC = () => {
  const {
    merchantPrepaidBalance,
    topUpMerchantBalance,
    cplLeads,
    authenticatedVendor,
  } = useApp();

  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState<number>(50000);

  // Determine active category based on authenticated vendor
  const vendorCategory: string = authenticatedVendor?.vertical || 'food';
  const categoryConfig = CATEGORY_ANALYTICS[vendorCategory] || CATEGORY_ANALYTICS.food;

  // Interactive ROI Calculator State initialized with category-tailored defaults
  const [calcLeadVolume, setCalcLeadVolume] = useState<number>(categoryConfig.roiDefaults.volume);
  const [calcCpl, setCalcCpl] = useState<number>(categoryConfig.roiDefaults.costPerUnit);
  const [calcConversionRate, setCalcConversionRate] = useState<number>(categoryConfig.roiDefaults.conversionRate);
  const [calcAvgTicket, setCalcAvgTicket] = useState<number>(categoryConfig.roiDefaults.avgTicket);
  const [calcMarginPercent, setCalcMarginPercent] = useState<number>(categoryConfig.roiDefaults.marginPercent);

  // Sync defaults whenever authenticated vendor changes category
  useEffect(() => {
    const cfg = CATEGORY_ANALYTICS[vendorCategory] || CATEGORY_ANALYTICS.food;
    setCalcLeadVolume(cfg.roiDefaults.volume);
    setCalcCpl(cfg.roiDefaults.costPerUnit);
    setCalcConversionRate(cfg.roiDefaults.conversionRate);
    setCalcAvgTicket(cfg.roiDefaults.avgTicket);
    setCalcMarginPercent(cfg.roiDefaults.marginPercent);
  }, [vendorCategory]);

  // Dynamic Calculations
  const totalMarketingSpend = calcLeadVolume * calcCpl;
  const totalApprovedConversions = Math.round(calcLeadVolume * (calcConversionRate / 100));
  const totalTurnoverVolume = totalApprovedConversions * calcAvgTicket;
  const grossRevenueGenerated = Math.round(totalTurnoverVolume * (calcMarginPercent / 100));
  const netProfit = grossRevenueGenerated - totalMarketingSpend;
  const roiMultiplier = totalMarketingSpend > 0 ? (grossRevenueGenerated / totalMarketingSpend).toFixed(1) : '0.0';

  const handleTopUpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (topUpAmount <= 0) return;
    topUpMerchantBalance(topUpAmount);
    setIsTopUpOpen(false);
  };

  const categoryLeadsCount = cplLeads.filter((l) => l.vertical === vendorCategory).length;
  const totalDelivered = categoryLeadsCount > 0 ? categoryLeadsCount : INITIAL_MERCHANT_METRICS.totalLeadsDelivered;

  return (
    <div className="space-y-6 text-slate-900">
      {/* Category Banner */}
      {authenticatedVendor && (
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-bold text-slate-900">
              Active Category Domain: <span className="text-blue-700 uppercase font-black">{authenticatedVendor.vertical}</span>
            </span>
            <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-mono font-bold border border-blue-200">
              Category-Locked Analytics (Vendor: {authenticatedVendor.companyName})
            </span>
          </div>
          <span className="text-[11px] text-slate-500">
            Performance metrics, CAC benchmarks and ROI calculations are tailored strictly to <strong>{authenticatedVendor.vertical.toUpperCase()}</strong>.
          </span>
        </div>
      )}

      {/* Top Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider mb-2 border border-blue-200">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>{categoryConfig.badge}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
            {categoryConfig.title}
          </h2>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
            {categoryConfig.description}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-right">
            <span className="text-[10px] text-slate-500 block font-semibold">Prepaid Credit Balance</span>
            <span className="text-lg font-mono font-black text-emerald-700">
              ₹{merchantPrepaidBalance.toLocaleString('en-IN')}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsTopUpOpen(true)}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer transition-all hover:scale-105 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Top-Up Credits</span>
          </button>
        </div>
      </div>

      {/* 5 Core Visual Performance Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Impressions & Views</span>
            <Target className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-black text-slate-900 font-mono">
            {INITIAL_MERCHANT_METRICS.totalImpressions.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-emerald-700 font-semibold block">
            {categoryConfig.growthText}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>CTR & Intent</span>
            <TrendingUp className="w-4 h-4 text-orange-600" />
          </div>
          <div className="text-xl font-black text-orange-600 font-mono">
            {INITIAL_MERCHANT_METRICS.ctrPercentage}% CTR
          </div>
          <span className="text-[10px] text-slate-500 block">
            {categoryConfig.ctrText}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Volume Delivered</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-black text-emerald-700 font-mono">
            {totalDelivered.toLocaleString('en-IN')} Units
          </div>
          <span className="text-[10px] text-slate-500 block">
            {categoryConfig.deliveredText}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>{categoryConfig.cplTitle}</span>
            <DollarSign className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-xl font-black text-slate-900 font-mono">
            ₹{categoryConfig.averageCpl}
          </div>
          <span className="text-[10px] text-sky-600 font-semibold block truncate">
            {categoryConfig.averageCplSub}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-1 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>{categoryConfig.turnoverLabel}</span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-black text-amber-600 font-mono">
            {categoryConfig.turnoverValue}
          </div>
          <span className="text-[10px] text-slate-500 block truncate">
            {categoryConfig.turnoverSub}
          </span>
        </div>
      </div>

      {/* Breakdown & Funnel Analysis Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Category Sub-Benchmark Breakdown */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>{categoryConfig.breakdownTitle}</span>
            </h3>
            <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold">
              Category Verified
            </span>
          </div>

          <div className="space-y-3 text-xs">
            {categoryConfig.benchmarks.map((item) => (
              <div key={item.category} className="space-y-1.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">{item.category}</span>
                  <strong className="font-mono text-slate-900 text-xs">{item.cpl}</strong>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                  <div className={`h-full rounded-full ${item.color} ${item.bar}`} />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span>{item.note}</span>
                  <span className="font-medium text-slate-700">{item.volume}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Full Funnel Attribution Overview */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-orange-600" />
              <span>Category Full Conversion Funnel</span>
            </h3>
            <span className="text-[11px] text-slate-500 font-mono">Last 30 Days</span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase tracking-wider font-semibold">
                  {categoryConfig.funnelSteps[0].label}
                </span>
                <strong className="text-sm font-mono font-bold text-slate-900">
                  {categoryConfig.funnelSteps[0].count}
                </strong>
              </div>
              <span className="text-xs font-semibold text-slate-500 font-mono">
                {categoryConfig.funnelSteps[0].note}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase tracking-wider font-semibold">
                  {categoryConfig.funnelSteps[1].label}
                </span>
                <strong className="text-sm font-mono font-bold text-orange-600">
                  {categoryConfig.funnelSteps[1].count}
                </strong>
              </div>
              <span className="text-xs font-semibold text-orange-600 font-mono">
                {categoryConfig.funnelSteps[1].note}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase tracking-wider font-semibold">
                  {categoryConfig.funnelSteps[2].label}
                </span>
                <strong className="text-sm font-mono font-bold text-emerald-700">
                  {categoryConfig.funnelSteps[2].count}
                </strong>
              </div>
              <span className="text-xs font-semibold text-emerald-700 font-mono">
                {categoryConfig.funnelSteps[2].note}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase tracking-wider font-semibold">
                  {categoryConfig.funnelSteps[3].label}
                </span>
                <strong className="text-sm font-mono font-bold text-amber-600">
                  {categoryConfig.funnelSteps[3].count}
                </strong>
              </div>
              <span className="text-xs font-semibold text-amber-600 font-mono">
                {categoryConfig.funnelSteps[3].note}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive ROI Multiplier Calculator */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 text-orange-700 text-xs font-bold border border-orange-200 uppercase tracking-wider mb-2">
              <Calculator className="w-3.5 h-3.5 text-orange-600" />
              <span>Interactive Enterprise ROI Multiplier Calculator</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900">
              Simulate Your Net Return On Investment (ROAS)
            </h3>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
              Adjust inbound volume, average order/ticket sizes, and conversion rates to project verifiable turnover and net revenue return.
            </p>
          </div>

          {/* Big Multiplier Callout */}
          <div className="bg-emerald-50 border-2 border-emerald-300 p-4 rounded-2xl text-center shrink-0 shadow-xs">
            <span className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider block">
              Projected ROI Multiplier
            </span>
            <div className="text-3xl sm:text-4xl font-black text-emerald-700 font-mono mt-0.5">
              {roiMultiplier}x
            </div>
            <span className="text-[10px] text-emerald-800 font-semibold block">
              Net Revenue Return on Spend
            </span>
          </div>
        </div>

        {/* 2-Column Calculator Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Interactive Sliders */}
          <div className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Campaign Assumptions & Controls
            </h4>

            {/* Slider 1: Monthly Volume */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <label className="text-slate-700 font-medium">{categoryConfig.roiDefaults.volumeLabel}</label>
                <span className="font-mono font-bold text-slate-900 text-sm">{calcLeadVolume} Units</span>
              </div>
              <input
                type="range"
                min={categoryConfig.roiDefaults.volumeMin}
                max={categoryConfig.roiDefaults.volumeMax}
                step={categoryConfig.roiDefaults.volumeStep}
                value={calcLeadVolume}
                onChange={(e) => setCalcLeadVolume(Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>

            {/* Slider 2: Cost Per Unit (CPL / CPO / CPC) */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <label className="text-slate-700 font-medium">{categoryConfig.roiDefaults.costLabel}</label>
                <span className="font-mono font-bold text-orange-600 text-sm">₹{calcCpl} / unit</span>
              </div>
              <input
                type="range"
                min={categoryConfig.roiDefaults.costMin}
                max={categoryConfig.roiDefaults.costMax}
                step={categoryConfig.roiDefaults.costStep}
                value={calcCpl}
                onChange={(e) => setCalcCpl(Number(e.target.value))}
                className="w-full accent-orange-600 cursor-pointer"
              />
            </div>

            {/* Slider 3: Conversion Rate */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <label className="text-slate-700 font-medium">{categoryConfig.roiDefaults.conversionLabel}</label>
                <span className="font-mono font-bold text-emerald-700 text-sm">{calcConversionRate}%</span>
              </div>
              <input
                type="range"
                min={5}
                max={60}
                step={1}
                value={calcConversionRate}
                onChange={(e) => setCalcConversionRate(Number(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
            </div>

            {/* Slider 4: Average Ticket / Basket Size */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <label className="text-slate-700 font-medium">{categoryConfig.roiDefaults.ticketLabel}</label>
                <span className="font-mono font-bold text-slate-900 text-sm">₹{calcAvgTicket.toLocaleString('en-IN')}</span>
              </div>
              <input
                type="range"
                min={categoryConfig.roiDefaults.ticketMin}
                max={categoryConfig.roiDefaults.ticketMax}
                step={categoryConfig.roiDefaults.ticketStep}
                value={calcAvgTicket}
                onChange={(e) => setCalcAvgTicket(Number(e.target.value))}
                className="w-full accent-slate-800 cursor-pointer"
              />
            </div>

            {/* Slider 5: Margin / Payout Percentage */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <label className="text-slate-700 font-medium">{categoryConfig.roiDefaults.marginLabel}</label>
                <span className="font-mono font-bold text-purple-700 text-sm">{calcMarginPercent}%</span>
              </div>
              <input
                type="range"
                min={1}
                max={30}
                step={0.5}
                value={calcMarginPercent}
                onChange={(e) => setCalcMarginPercent(Number(e.target.value))}
                className="w-full accent-purple-600 cursor-pointer"
              />
            </div>
          </div>

          {/* Right Column: Output Metrics */}
          <div className="space-y-4 flex flex-col justify-between">
            <div className="space-y-3 bg-slate-50 p-5 rounded-2xl border border-slate-200">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Simulated Financial Output
              </h4>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                  <span className="text-slate-600 font-medium">Total Marketing Investment:</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    ₹{totalMarketingSpend.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                  <span className="text-slate-600 font-medium">{categoryConfig.roiDefaults.outputVolumeLabel}</span>
                  <span className="font-mono font-bold text-blue-700 text-sm">
                    {totalApprovedConversions.toLocaleString('en-IN')} Units
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                  <span className="text-slate-600 font-medium">{categoryConfig.roiDefaults.outputGrossLabel}</span>
                  <span className="font-mono font-black text-amber-700 text-sm">
                    ₹{(totalTurnoverVolume >= 10000000 ? `${(totalTurnoverVolume / 10000000).toFixed(2)} Cr` : totalTurnoverVolume.toLocaleString('en-IN'))}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-emerald-300 shadow-2xs">
                  <span className="text-slate-700 font-medium">Gross Partner Revenue Yield:</span>
                  <span className="font-mono font-black text-emerald-700 text-base">
                    ₹{grossRevenueGenerated.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 shadow-2xs">
                  <span className="text-emerald-900 font-bold">Estimated Net Profit Generated:</span>
                  <span className="font-mono font-black text-emerald-700 text-base">
                    ₹{netProfit.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            {/* Pitch Note Box */}
            <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-xs text-blue-900 space-y-1">
              <strong className="font-bold flex items-center gap-1.5 text-blue-950">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>{categoryConfig.proofPointTitle}</span>
              </strong>
              <p className="text-[11px] text-blue-900 leading-relaxed">
                {categoryConfig.proofPointText}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* TOP-UP MODAL (White Theme) */}
      {isTopUpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                <span>Top-Up Prepaid Lead Credits</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsTopUpOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleTopUpSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Credit Recharge Amount (₹) *
                </label>
                <input
                  type="number"
                  min={10000}
                  step={5000}
                  required
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 text-sm focus:outline-hidden focus:border-emerald-500 font-bold shadow-2xs"
                />
              </div>

              {/* Quick Select Chips */}
              <div className="grid grid-cols-3 gap-2">
                {[25000, 50000, 100000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setTopUpAmount(amt)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      topUpAmount === amt
                        ? 'bg-emerald-600 border-emerald-500 text-white'
                        : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    ₹{(amt / 1000).toFixed(0)}k
                  </button>
                ))}
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-[11px] text-slate-600">
                <div className="flex justify-between">
                  <span>Current Balance:</span>
                  <span className="font-mono text-slate-900 font-bold">₹{merchantPrepaidBalance.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between font-bold text-emerald-700">
                  <span>Post-Recharge Balance:</span>
                  <span className="font-mono">₹{(merchantPrepaidBalance + topUpAmount).toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsTopUpOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 font-bold text-white rounded-xl cursor-pointer shadow-md shadow-emerald-600/20"
                >
                  Add Credits Now
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
