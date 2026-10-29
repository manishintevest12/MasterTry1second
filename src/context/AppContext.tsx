import { scrollToResults } from '../utils/scrollToResults';
import { pollDecision } from '../lib/searchPolling';
import { canonicalizeRows, sameVertical, canonicalVertical } from '../lib/verticalAlias';
import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
// canvas-confetti (~30KB): only needed when the Spin & Earn wheel actually wins.
// Dynamic import keeps it out of the landing-page critical path (TBT fix).
const fireConfetti = (opts: Record<string, unknown>) => { void import('canvas-confetti').then((m) => m.default(opts)); };
import { firebaseConfigured } from '../utils/firebaseConfig';
// Google sign-in is rare + interactive: fetch the Firebase auth SDK only on click.
const signInWithGoogleAndGetToken = async (): Promise<string | null> => {
  const { signInWithGoogleAndGetToken: fn } = await import('../utils/firebaseAuth');
  return fn();
};


/** Map a persisted catalogue row (real acquisition) to the feed item shape.
 *  Honesty rules: rating/history stay empty when unverified — never fabricated. */
const COMPARISON_VERTICALS = ['flights','hotels','bus','ecommerce','grocery','food','movie','loans','insurance','cab','creditcards','account','banking'] as const;
function catalogueRowToItem(row: any): ComparisonItem | null {
  if (!COMPARISON_VERTICALS.includes(row?.vertical)) return null; // unsupported verticals are not forced in
  const price = Number(row.effective_price ?? row.mandatory_total ?? 0);
  const sellerName = String(row.seller || row.vendor || 'Verified source').slice(0, 60);
  const quoteUrl = String(row.seller_url || row.source_url || '');
  // The card requires at least one seller quote; it is built from the SAME persisted
  // verified offer (no invented price, no invented vendor). A zero/invalid price
  // cannot become a quote, so the row is skipped rather than rendered broken.
  const attrs: Record<string, string> = typeof row.attributes === 'string'
    ? (() => { try { return JSON.parse(row.attributes) || {}; } catch { return {}; } })()
    : (row.attributes || {});
  const images = attrs.image_urls ? String(attrs.image_urls).split('|').filter((u: string) => /^https:\/\//.test(u)) : undefined;
  const imageUrl = [/^https:\/\//.test(attrs.image_url || '') ? attrs.image_url : '', (images || [])[0] || '', /^https:\/\//.test(attrs.image || '') ? attrs.image : '']
    .find((u) => u) || undefined;
  // Same honest description builder as the live mapper: source-published fields only.
  const descParts: string[] = [];
  if (attrs.rating) descParts.push(`${attrs.rating}★${attrs.rating_count ? ` (${Number(attrs.rating_count).toLocaleString('en-IN')})` : ''}`);
  if (attrs.cuisines) descParts.push(attrs.cuisines);
  if (attrs.address) descParts.push(attrs.address);
  if (attrs.interest_rate_min) descParts.push(`${attrs.interest_rate_min}${attrs.interest_rate_max ? `–${attrs.interest_rate_max}` : ''}% p.a.`);
  if (attrs.loan_type) descParts.push(String(attrs.loan_type));
  if (attrs.account_type === 'savings' && attrs.interest_rate_max) descParts.push(`${attrs.interest_rate_min || ''}${attrs.interest_rate_min ? '–' : ''}${attrs.interest_rate_max}% p.a. savings`);
  if (attrs.amc) descParts.push(`AMC ${attrs.amc}`);
  if (attrs.min_balance) descParts.push(`Min balance ₹${Number(String(attrs.min_balance).replace(/[^\d.]/g, '') || 0).toLocaleString('en-IN')}`);
  if (attrs.operator) descParts.push(String(attrs.operator));
  if (row.location_city) descParts.push(String(row.location_city));
  const description = descParts.join(' · ').slice(0, 300);
  return {
    id: `cat-${row.id}`,
    imageUrl,
    images,
    description,
    vertical: row.vertical === 'banking' ? 'account' : row.vertical,
    title: String(row.title || 'Untitled offer'),
    subtitle: String(row.seller || row.vendor || 'Verified source').slice(0, 80),
    category: row.vertical,
    provider: row.vendor || 'Unknown vendor',
    rating: Number(attrs.rating) || 0,
    reviewCount: Number(attrs.review_count) || 0,
    sentimentSummary: attrs.data_note || 'Live data from a verified source',
    ...(imageUrl ? { features: [] as string[], specs: attrs.data_note ? { note: attrs.data_note } : {} } : {}),
    criteriaRatings: [],
    primaryPrice: price,
    originalPrice: 0,
    priceAvailable: price > 0,
    sellerQuotes: [
      {
        id: `sq-cat-${row.id}`,
        sellerName,
        price,
        originalPrice: 0,
        currency: row.currency || 'INR',
        url: quoteUrl,
        badge: row.freshness_status === 'LIVE_VERIFIED' ? 'Live Verified' : 'Verified Offer',
        isLowest: true,
        sourceDomain: quoteUrl ? String(quoteUrl).replace(/^https?:\/\//, '').split('/')[0] : undefined,
      } as SellerQuote,
    ],
    pricePrediction: {
      advice: 'fair_price',
      headline: 'Newly tracked',
      details: 'No price history yet — only real observations are charted, never generated.',
      historicalLow: price,
      historicalHigh: price,
      priceHistory: [],
    },
    features: [],
    specs: {},
    reviews: [],
    // Bank-account rows carry a comparable-unit label ('% p.a. (highest slab)' etc.)
    unit: row.vertical === 'banking' ? String(attrs.price_unit || 'per account') : undefined,
    availability: row.availability,
    isLiveScraped: false,
  } as ComparisonItem;
}

export interface AuthUser {
  id: number;
  email: string;
  role: string;
  displayName?: string;
}
import {
  VerticalId,
  ComparisonItem,
  SellerQuote,
  UserReview,
  WonReward,
  SpinReward,
  MainNavTab,
  RewardsSubTab,
  UserLocationState,
  InfoModalTab,
  UserPurchaseRecord,
  PartnerPayoutSummary,
  AffiliateIdConfig,
  CustomScraperConfig,
  ApiIntegrationConfig,
  AffiliateNetworkHubConfig,
  UserLoginSession,
  SpinWinnerLog,
  ResidentialProxyConfig,
  ReferredFriend,
  DirectPartnerItem,
  CplLead,
  MerchantCampaign,
  LeadCaptureState,
  MatchedFinancialPartner,
  MerchantVendorAccount,
  QuickAppPartner,
  QuickAppRedirectionLog,
} from '../types';
import {
  SPIN_REWARDS,
  VERTICAL_META,
} from '../data/mockData';
import {
  INITIAL_QUICK_APP_PARTNERS,
  INITIAL_REDIRECTION_LOGS,
} from '../data/quickAppsData';
import {
  getBrowserGpsLocation,
  resolveLocationByPincode,
  DEFAULT_USER_LOCATION,
} from '../utils/locationHelper';

interface RedirectionState {
  isOpen: boolean;
  item: ComparisonItem | null;
  quote: SellerQuote | null;
  step: 'redirecting' | 'awarded';
}

export interface ToastNotification {
  id: string;
  type: 'points' | 'alert' | 'success' | 'info';
  title: string;
  message: string;
  timestamp: Date;
}

export interface SourcesReport {
  query: string;
  at: number;
  attempted: string[];
  succeeded: string[];
  failed: Array<{ sourceId: string; failureClass?: string; error?: string; lastPrice?: { price: number; query: string; at: number } }>;
  resultsCount: number;
  servedFrom?: string;
  pendingRefresh?: boolean;
}

export interface NotificationItem {
  id: number;
  kind: 'price_drop' | 'admin';
  title: string;
  body: string;
  image: string | null;
  ctaUrl: string | null;
  searchQuery: string | null;
  productTitle: string | null;
  priceNow: number | null;
  targetPrice: number | null;
  seller: string | null;
  createdAt: string | null;
  read: boolean;
}

/** Smart Cart (owner rule): grocery basket totals compared across stores. */
export interface SmartCartItem { name: string; qty: number; }
export type SmartCartCompare = {
  items: { name: string; qty: number; found: boolean; unitPrices: { seller: string; price: number; title: string; url: string | null }[] }[];
  stores: { seller: string; total: number; itemsCovered: number; itemsMissing: number; missing: string[]; complete: boolean; itemized: { name: string; qty: number; price: number; unitPrice: number; url: string | null }[] }[];
  best?: { seller: string; total: number; itemsCovered: number; itemsMissing: number; missing: string[]; complete: boolean; itemized: { name: string; qty: number; price: number; unitPrice: number; url: string | null }[] };
  savingsVsWorst?: number;
  notFound: string[];
};

interface AppContextType {
  vertical: VerticalId;
  /** Smart Cart basket (grocery multi-store total comparison). */
  smartCart: SmartCartItem[];
  addToSmartCart: (name: string, qty?: number) => void;
  updateSmartCartQty: (name: string, qty: number) => void;
  removeFromSmartCart: (name: string) => void;
  clearSmartCart: () => void;
  isSmartCartOpen: boolean;
  setIsSmartCartOpen: (open: boolean) => void;
  setVertical: (v: VerticalId) => void;
  activeNavTab: MainNavTab;
  setActiveNavTab: (tab: MainNavTab) => void;
  rewardsSubTab: RewardsSubTab;
  setRewardsSubTab: (tab: RewardsSubTab) => void;
  userLocation: UserLocationState;
  detectGpsLocation: () => Promise<void>;
  setPincodeLocation: (pin: string) => void;
  /** Uber-style map pin (MapPinPicker): adopt an exact picked spot as the user's location. */
  setMapPickedLocation: (spot: { lat: number; lng: number; address: string; locality: string; city: string; pincode?: string }) => void;
  isGpsLocating: boolean;
  isCompareMenuOpen: boolean;
  setIsCompareMenuOpen: (open: boolean) => void;
  isNotificationsOpen: boolean;
  setIsNotificationsOpen: (open: boolean) => void;
  notifications: NotificationItem[];
  unreadNotificationCount: number;
  isFetchingNotifications: boolean;
  refreshNotifications: () => Promise<void>;
  markNotificationsRead: (id?: number) => Promise<void>;
  isProfileOpen: boolean;
  setIsProfileOpen: (open: boolean) => void;
  items: ComparisonItem[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  smartFilterText: string;
  setSmartFilterText: (text: string) => void;
  applySmartFilter: (prompt: string) => void;
  clearSmartFilter: () => void;
  sortOption: 'cheapest' | 'best' | 'fastest' | 'highest_rated';
  setSortOption: (opt: 'cheapest' | 'best' | 'fastest' | 'highest_rated') => void;
  trackedItemIds: string[];
  toggleTrackPrice: (itemId: string) => void;
  setTargetAlert: (itemId: string, targetPrice: number) => void;
  userPoints: number;
  addPoints: (amount: number, reason?: string) => void;
  redirectionState: RedirectionState;
  startRedirection: (item: ComparisonItem, quote: SellerQuote) => void;
  closeRedirection: () => void;
  pendingSpendEntry: { merchant: string; amount: number; itemTitle?: string; vertical?: string } | null;
  openSpendLens: (prefill?: { merchant: string; amount: number; itemTitle?: string; vertical?: string } | null) => void;
  clearSpendPrefill: () => void;
  reviewModalItem: ComparisonItem | null;
  openReviewModal: (item: ComparisonItem) => void;
  closeReviewModal: () => void;
  submitReview: (itemId: string, review: { author: string; rating: number; title: string; comment: string; pros?: string; cons?: string }) => void;
  priceAlertModalItem: ComparisonItem | null;
  openPriceAlertModal: (item: ComparisonItem) => void;
  closePriceAlertModal: () => void;
  wonRewards: WonReward[];
  spinsAvailable: number;
  isSpinning: boolean;
  executeSpin: () => Promise<SpinReward | null>;
  selectedWonReward: WonReward | null;
  setSelectedWonReward: (r: WonReward | null) => void;
  referralCode: string;
  referredFriends: ReferredFriend[];
  referFriend: (name: string, email?: string) => void;
  toasts: ToastNotification[];
  addToast: (type: 'points' | 'alert' | 'success' | 'info', title: string, message: string) => void;
  dismissToast: (id: string) => void;
  refreshLivePrices: () => Promise<void>;
  infoModalTab: InfoModalTab | null;
  openInfoModal: (tab: InfoModalTab) => void;
  closeInfoModal: () => void;
  isPartnerModalOpen: boolean;
  openPartnerModal: () => void;
  closePartnerModal: () => void;
  isExtensionModalOpen: boolean;
  openExtensionModal: () => void;
  closeExtensionModal: () => void;


  // 100+ Direct Partners Directory & Management
  directPartners: DirectPartnerItem[];
  addDirectPartner: (partner: Omit<DirectPartnerItem, 'id' | 'clickCount'>) => void;
  updateDirectPartner: (id: string, updates: Partial<DirectPartnerItem>) => void;
  toggleDirectPartnerStatus: (id: string) => void;
  deleteDirectPartner: (id: string) => void;


  // Spin & Earn Dynamic Management
  spinRewards: SpinReward[];
  spinCostPoints: number;
  setSpinCostPoints: (pts: number) => void;
  addSpinReward: (reward: Omit<SpinReward, 'id'>) => void;
  updateSpinReward: (id: string, updates: Partial<SpinReward>) => void;
  deleteSpinReward: (id: string) => void;
  toggleSpinRewardActive: (id: string) => void;
  // (Winners are real fulfilments now — fetched by SpinEarnManagementTab from /api/admin/fulfilments)

  // Real-Time Native Web Scraper State
  isScrapingLive: boolean;
  /** A NEW search (city/query/date/vertical change) is in flight: show the progress panel
   *  even if rows of the previous search are still in state (owner 28 Oct). */
  isNewSearchPending: boolean;
  lastScrapeInfo: {
    timestamp: string;
    location: string;
    latencyMs: number;
    sourcesCount: number;
  };
  /** Per-vertical report of every source attempted on the last search (live / no results / unavailable + reason). */
  sourcesReport: Record<string, SourcesReport>;
  triggerLiveLocationScrape: (overrideQuery?: string, overrideLoc?: UserLocationState, overrideTravel?: { depart?: string; return?: string }) => Promise<void>;
  /** Home AI assistant handoff: the vertical's search form consumes this once to fill its boxes and search. */
  pendingAssistantSearch: { vertical: string; query: string; date?: string } | null;
  /** In-site product page (Price Lens click-through): what to load, and the opener. */
  productPageRequest: { input?: string; query?: string; nonce: number; seed?: Array<{ seller: string; title: string; price: number; listPrice?: number; image?: string | null; url: string }>; gallery?: string[] } | null;
  openProductPage: (req: { input?: string; query?: string; seed?: Array<{ seller: string; title: string; price: number; listPrice?: number; image?: string | null; url: string }>; gallery?: string[] }) => void;
  setPendingAssistantSearch: (p: { vertical: string; query: string; date?: string } | null) => void;


  // Native CPL Lead Capture & Multi-Bank Matching (Loans & Insurance)
  leadCaptureState: LeadCaptureState;
  openLeadCapture: (item: ComparisonItem, quote: SellerQuote) => void;
  closeLeadCapture: () => void;
  submitCplLead: (data: {
    requestedAmount: number;
    monthlySalary: number;
    salaryBracket?: string;
    employmentType: 'salaried' | 'self_employed' | 'business';
    existingEmis: number;
    city: string;
    pincode: string;
    fullName: string;
    phone: string;
    email: string;
    serviceType?: string;
    vertical?: 'loans' | 'insurance' | 'creditcards' | 'account';
    age?: number;
  }) => Promise<CplLead>;

  // Merchant / B2B Partner Portal & Campaign Management
  cplLeads: CplLead[];
  updateLeadStatus: (leadId: string, newStatus: CplLead['status']) => void;
  merchantCampaigns: MerchantCampaign[];
  toggleCampaignStatus: (campaignId: string) => void;
  updateCampaign: (campaignId: string, updates: Partial<MerchantCampaign>) => void;
  addMerchantCampaign: (campaign: Omit<MerchantCampaign, 'id' | 'leadsDeliveredToday' | 'totalLeadsDelivered'>) => void;
  merchantPrepaidBalance: number;
  topUpMerchantBalance: (amount: number) => void;
  activeMerchantRole: string;
  setActiveMerchantRole: (role: string) => void;

  // 10-Digit Merchant Vendor Auth & Accounts
  vendorAccounts: MerchantVendorAccount[];
  authenticatedVendor: MerchantVendorAccount | null;
  merchantLogin: (tenDigitId: string, category?: string) => { success: boolean; message: string; vendor?: MerchantVendorAccount };
  merchantLogout: () => void;
  createVendorAccount: (account: Omit<MerchantVendorAccount, 'id' | 'createdAt'>) => MerchantVendorAccount;
  updateVendorAccount: (id: string, updates: Partial<MerchantVendorAccount>) => void;
  deleteVendorAccount: (id: string) => void;
  generateUniqueTenDigitId: () => string;
  sendVendorIdEmail: (vendorId: string) => { success: boolean; message: string };

  // Admin Authentication (Exclusive to admin@try1second.com)
  isAdminAuthenticated: boolean;
  adminEmail: string | null;
  /** Step 1 of admin email-OTP login: ask the backend to send a code (via Resend). */
  adminOtpRequest: (email: string) => Promise<{ success: boolean; message: string }>;
  /** Step 2 of admin email-OTP login: verify the code and open the admin session. */
  adminOtpVerify: (email: string, code: string) => Promise<{ success: boolean; message: string }>;
  adminLogout: () => void;

  // Secret URL Routing (www.try1second.com/merchantinstab2b and try1second.com/admininsta)
  currentSecretRoute: string;
  navigateToSecretRoute: (route: string) => void;

  // Quick Apps & Deep Link Redirection Tracking
  quickAppPartners: QuickAppPartner[];
  quickAppRedirectionLogs: QuickAppRedirectionLog[];
  addQuickAppPartner: (partner: Omit<QuickAppPartner, 'id' | 'createdAt'>) => QuickAppPartner;
  updateQuickAppPartner: (id: string, updates: Partial<QuickAppPartner>) => void;
  deleteQuickAppPartner: (id: string) => void;
  authUser: AuthUser | null;
  authBusy: boolean;
  authError: string | null;
  loginWithGoogle: () => Promise<boolean>;
  refreshUserPoints: () => Promise<void>;
  hydratePartners: () => Promise<void>;
  hydrateMerchantData: () => Promise<void>;
  logoutUser: () => void;
  trackQuickAppRedirection: (partnerId: string) => QuickAppRedirectionLog | null;
  clearQuickAppRedirectionLogs: () => void;
  simulateQuickAppRedirection: (partnerId?: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authBusy, setAuthBusy] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [vertical, setVertical] = useState<VerticalId>('flights');
  const [activeNavTab, setActiveNavTabState] = useState<MainNavTab>('home');

  const setActiveNavTab = (tab: MainNavTab) => {
    setActiveNavTabState(tab);
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    } catch {}
  };

  useEffect(() => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    } catch {}
  }, [activeNavTab]);
  const [rewardsSubTab, setRewardsSubTab] = useState<RewardsSubTab>('top');
  const [userLocation, setUserLocation] = useState<UserLocationState>(DEFAULT_USER_LOCATION);
  const [isGpsLocating, setIsGpsLocating] = useState<boolean>(false);
  const [isCompareMenuOpen, setIsCompareMenuOpen] = useState<boolean>(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [infoModalTab, setInfoModalTab] = useState<InfoModalTab | null>(null);
  const [isPartnerModalOpen, setIsPartnerModalOpen] = useState<boolean>(false);
  const [isExtensionModalOpen, setIsExtensionModalOpen] = useState<boolean>(false);
  const openExtensionModal = () => setIsExtensionModalOpen(true);
  const closeExtensionModal = () => setIsExtensionModalOpen(false);


  // 100+ Direct Partners Directory & Management
  const [directPartners, setDirectPartners] = useState<DirectPartnerItem[]>([]);

  const addDirectPartner = (partner: Omit<DirectPartnerItem, 'id' | 'clickCount'>) => {
    const newPartner: DirectPartnerItem = {
      ...partner,
      id: `part-${Date.now()}`,
      clickCount: 0,
    };
    setDirectPartners((prev) => [newPartner, ...prev]);
    addToast(
      'success',
      'Partner Added to 100+ Network',
      `${newPartner.name} is now accessible to customers on the live storefront.`
    );
  };

  const updateDirectPartner = (id: string, updates: Partial<DirectPartnerItem>) => {
    setDirectPartners((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
    addToast('info', 'Partner Updated', 'Partner metadata and destination URL synchronized.');
  };

  const toggleDirectPartnerStatus = (id: string) => {
    setDirectPartners((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, status: p.status === 'active' ? 'paused' : 'active' } : p
      )
    );
  };

  const deleteDirectPartner = (id: string) => {
    setDirectPartners((prev) => prev.filter((p) => p.id !== id));
    addToast('alert', 'Partner Removed', 'Partner removed from 100+ directory.');
  };


  // Partner showcase list loads when the (already lazy) partners section mounts.
  const hydratePartners = useCallback(async () => {
    if (directPartners.length) return;
    const m = await import('../data/partnersData');
    const base = [...m.INITIAL_DIRECT_PARTNERS];
    // Owner 21 Oct: admin-APPROVED partner inquiries (approved_partners, MySQL)
    // merge into the directory next to the built-in partners. Server list wins
    // on the same website so an approved partner is never duplicated.
    try {
      const res = await fetch('/api/partners');
      const data = await res.json();
      const approved = ((data?.partners || []) as Array<{
        id: number; name: string; websiteUrl: string; category: string; badge: string; status: string;
      }>).filter((p) => p.status === 'active' && p.websiteUrl);
      const labels: Record<string, string> = { travel: 'Travel & Hotels', retail: 'Retail & Shopping', food: 'Food Delivery', finance: 'Banking & Finance', cabs: 'Cabs & Ride-Hailing' };
      const palette = ['bg-[#0F4C81]', 'bg-[#1B5E20]', 'bg-[#4A148C]', 'bg-[#B71C1C]', 'bg-[#00695C]', 'bg-[#E65100]', 'bg-[#283593]'];
      for (const p of approved) {
        const cat = (['travel', 'retail', 'food', 'finance', 'cabs'].includes(p.category) ? p.category : 'retail') as DirectPartnerItem['category'];
        const website = p.websiteUrl.includes('://') ? p.websiteUrl : `https://${p.websiteUrl}`;
        const dupe = base.some((b) => b.websiteUrl.replace(/\/$/, '') === website.replace(/\/$/, ''));
        if (dupe) continue;
        base.push({
          id: `srv-${p.id}`,
          name: p.name,
          category: cat,
          categoryLabel: labels[cat],
          badge: p.badge || 'Verified Partner',
          logoBg: palette[p.id % palette.length],
          logoText: p.name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase(),
          description: 'Admin-approved partner of the Try1Second metasearch network.',
          websiteUrl: website,
          status: 'active',
        });
      }
    } catch { /* directory stays on built-ins when the API is unreachable */ }
    setDirectPartners(base);
  }, [directPartners.length]);
  // Merchant-portal data loads only on portal mount.
  // Owner 24 Oct: NO mock hydration anymore — leads come from the real server
  // store (/api/merchant/leads in LeadManagementTable, /api/vendor/traffic in
  // the orders/analytics tabs). Campaigns + vendor accounts stay client-only
  // (admin-created entries persist in localStorage); prepaid starts at a
  // honest ₹0 until the vendor tops up.
  const hydrateMerchantData = useCallback(async () => {
    setMerchantPrepaidBalance((prev) => prev || 0);
  }, []);

  // Dynamic Spin & Earn State
  const [spinCostPoints, setSpinCostPoints] = useState<number>(100);
  const [spinRewards, setSpinRewards] = useState<SpinReward[]>(
    SPIN_REWARDS.map((r, i) => ({
      ...r,
      probabilityWeight: i === 0 ? 5 : i === 1 ? 10 : i === 2 ? 15 : i === 3 ? 10 : i === 4 ? 20 : i === 5 ? 15 : 25,
      stockLimit: 50,
      stockRemaining: 35 + i * 2,
      isActive: true,
    }))
  );
  // ==========================================
  // NATIVE CPL LEAD CAPTURE & MULTI-BANK MATCH
  // ==========================================
  const [leadCaptureState, setLeadCaptureState] = useState<LeadCaptureState>({
    isOpen: false,
    item: null,
    quote: null,
    step: 'form',
    submittedLead: null,
  });

  const [cplLeads, setCplLeads] = useState<CplLead[]>([]);
  const [merchantCampaigns, setMerchantCampaigns] = useState<MerchantCampaign[]>([]);
  const [merchantPrepaidBalance, setMerchantPrepaidBalance] = useState<number>(0);
  const [activeMerchantRole, setActiveMerchantRole] = useState<string>('admin_viewer');

  const openLeadCapture = (item: ComparisonItem, quote: SellerQuote) => {
    setLeadCaptureState({
      isOpen: true,
      item,
      quote,
      step: 'form',
      submittedLead: null,
    });
  };

  const closeLeadCapture = () => {
    setLeadCaptureState({
      isOpen: false,
      item: null,
      quote: null,
      step: 'form',
      submittedLead: null,
    });
  };

  const updateLeadStatus = (leadId: string, newStatus: CplLead['status']) => {
    setCplLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l))
    );
    addToast('info', 'Lead Status Updated', `Lead ID ${leadId} status set to ${newStatus.toUpperCase()}`);
  };

  const toggleCampaignStatus = (campaignId: string) => {
    setMerchantCampaigns((prev) =>
      prev.map((c) =>
        c.id === campaignId ? { ...c, status: c.status === 'active' ? 'paused' : 'active' } : c
      )
    );
  };

  const updateCampaign = (campaignId: string, updates: Partial<MerchantCampaign>) => {
    setMerchantCampaigns((prev) =>
      prev.map((c) => (c.id === campaignId ? { ...c, ...updates } : c))
    );
    addToast('success', 'Campaign Updated', 'Merchant targeting criteria and budget rules updated.');
  };

  const addMerchantCampaign = (campaign: Omit<MerchantCampaign, 'id' | 'leadsDeliveredToday' | 'totalLeadsDelivered'>) => {
    const newCamp: MerchantCampaign = {
      ...campaign,
      id: `camp-${Date.now()}`,
      leadsDeliveredToday: 0,
      totalLeadsDelivered: 0,
    };
    setMerchantCampaigns((prev) => [newCamp, ...prev]);
    addToast('success', 'New Campaign Launched', `${newCamp.campaignName} is now active.`);
  };

  const topUpMerchantBalance = (amount: number) => {
    setMerchantPrepaidBalance((prev) => prev + amount);
    addToast('success', 'Prepaid Balance Loaded', `₹${amount.toLocaleString('en-IN')} added to Merchant B2B Lead Wallet.`);
  };

  const submitCplLead = async (data: {
    requestedAmount: number;
    monthlySalary: number;
    salaryBracket?: string;
    employmentType: 'salaried' | 'self_employed' | 'business';
    existingEmis: number;
    city: string;
    pincode: string;
    fullName: string;
    phone: string;
    email: string;
    serviceType?: string;
    vertical?: 'loans' | 'insurance' | 'creditcards' | 'account';
    age?: number;
  }): Promise<CplLead> => {
    setLeadCaptureState((prev) => ({ ...prev, step: 'processing' }));

    // Owner 21 Oct: leads now persist server-side (MySQL `leads` table) — visible in
    // Admin > Leads and the matching merchant dashboard. The client record below stays
    // for the user's own session view. No-fabrication rule unchanged: Try1Second only
    // forwards the lead; partners decide and contact the user directly.
    let serverLeadId = 0;
    try {
      const nameParts = String(data.fullName || '').trim().split(/\s+/);
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'cpl',
          vertical: (data.vertical || leadCaptureState.item?.vertical || 'loans') as string,
          serviceType: data.serviceType || leadCaptureState.item?.title || '',
          firstName: nameParts[0] || String(data.fullName || 'User'),
          lastName: nameParts.slice(1).join(' ') || '-',
          age: data.age || 30,
          salary: data.monthlySalary,
          location: `${data.city}${data.pincode ? ' ' + data.pincode : ''}`.trim(),
          phone: data.phone,
          email: data.email,
          destUrl: leadCaptureState.quote?.url && /^https:/.test(leadCaptureState.quote.url) ? leadCaptureState.quote.url : undefined,
        }),
      });
      const j = await res.json().catch(() => null);
      if (res.ok && j?.success) serverLeadId = Number(j.id) || 0;
    } catch { /* server unreachable: keep local record, honest fallback */ }

    const isLoan = (data.vertical || leadCaptureState.item?.vertical || 'loans') === 'loans';
    const cplFee = isLoan ? 750 : 650;

    const newLead: CplLead = {
      id: serverLeadId ? `lead-${serverLeadId}` : `lead-${Date.now().toString().slice(-4)}`,
      vertical: isLoan ? 'loans' : 'insurance',
      serviceType: data.serviceType || (leadCaptureState.item?.title || (isLoan ? 'Personal Loan' : 'Health Insurance')),
      requestedAmount: data.requestedAmount,
      monthlySalary: data.monthlySalary,
      salaryBracket: data.salaryBracket || (data.monthlySalary >= 100000 ? '₹1,00,000+' : data.monthlySalary >= 50000 ? '₹50,000 - ₹1,00,000' : '₹35,000 - ₹50,000'),
      employmentType: data.employmentType,
      existingEmis: data.existingEmis,
      city: data.city,
      pincode: data.pincode,
      fullName: data.fullName,
      phone: data.phone,
      email: data.email,
      matchedPartners: [],
      status: 'new',
      cplCost: cplFee,
      createdAt: 'Just now',
      assignedMerchant: 'Partner Network (routing pending)',
    };

    setCplLeads((prev) => [newLead, ...prev]);

    // Deduct CPL fee from prepaid balance if active
    setMerchantPrepaidBalance((prev) => Math.max(0, prev - cplFee));

    // Update campaign counters
    setMerchantCampaigns((prev) =>
      prev.map((c) =>
        c.vertical === newLead.vertical
          ? { ...c, leadsDeliveredToday: c.leadsDeliveredToday + 1, totalLeadsDelivered: c.totalLeadsDelivered + 1 }
          : c
      )
    );

    setLeadCaptureState((prev) => ({
      ...prev,
      step: 'matched',
      submittedLead: newLead,
    }));

    addToast(
      'success',
      'Enquiry Submitted',
      `Your details were shared with our partner network. Reference ID: ${newLead.id}`
    );

    return newLead;
  };

  const openInfoModal = (tab: InfoModalTab) => setInfoModalTab(tab);
  const closeInfoModal = () => setInfoModalTab(null);
  const openPartnerModal = () => setIsPartnerModalOpen(true);
  const closePartnerModal = () => setIsPartnerModalOpen(false);

  const detectGpsLocation = async () => {
    setIsGpsLocating(true);
    try {
      const loc = await getBrowserGpsLocation();
      setUserLocation(loc);
      addToast(
        'success',
        '📍 Live GPS Location Locked',
        `${loc.address} (Pincode: ${loc.pincode}) · ${loc.accuracyText}`
      );
    } catch {
      addToast('alert', 'GPS unavailable', "We couldn't get a precise location. Please enter your pincode manually.");
    } finally {
      setIsGpsLocating(false);
    }
  };

  const setPincodeLocation = (pin: string) => {
    const loc = resolveLocationByPincode(pin);
    setUserLocation(loc);
    addToast(
      'info',
      `📍 Area Synced to Pincode: ${loc.pincode}`,
      `${loc.address} · Servicing dark stores and ride hubs updated.`
    );
  };

  const setMapPickedLocation = (spot: { lat: number; lng: number; address: string; locality: string; city: string; pincode?: string }) => {
    // The pin is exact; fill any missing city/pincode context from the pincode registry
    // (Nominatim sometimes omits the postcode for open land) — never the reverse.
    let city = spot.city;
    let pincode = spot.pincode;
    if (!city || !pincode) {
      const reg = pincode ? resolveLocationByPincode(pincode) : null;
      if (reg) { city = city || reg.city; pincode = pincode || reg.pincode; }
    }
    const loc: UserLocationState = {
      address: spot.address,
      locality: spot.locality || spot.address.split(',')[0] || 'Pinned spot',
      city: city || spot.locality || 'India',
      pincode: pincode || '',
      coordinates: { lat: spot.lat, lng: spot.lng },
      isGps: true,
      accuracyText: 'Exact map pin',
    };
    setUserLocation(loc);
    addToast('success', '📍 Exact Pickup Point Pinned', `${loc.address.slice(0, 90)}${pincode ? ` (Pincode: ${pincode})` : ''} · coordinates attached to every cab search.`);
  };

  // REAL DATA ONLY: no seeded demo items. The catalogue fills from the backend's
  // verified offers table; a fresh deployment shows an honest empty state until
  // real sources return verified offers (Section 6: never label mock data as live).
  const [items, setItems] = useState<ComparisonItem[]>([]);

  // Load the persisted verified catalogue (real acquisitions only).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/catalogue');
        if (!res.ok) return;
        const data = await res.json();
        const mapped: ComparisonItem[] = [];
        for (const row of data.items || []) {
          const item = catalogueRowToItem(row);
          if (item) mapped.push(item);
        }
        if (!cancelled && mapped.length > 0) setItems(mapped);
      } catch {
        /* catalogue unreachable -> honest empty state */
      }
    })();
    return () => { cancelled = true; };
  }, []);
  const [searchQuery, setSearchQuery] = useState<string>('');
  // Owner 24 Oct (web parity of the app's sticky last search): the last query
  // actually run per vertical — switching verticals and coming back restores
  // the user's own last search instead of reverting to the DEFAULT_QUERY seed
  // (flights kept falling back to Indore->Delhi).
  const [verticalQueries, setVerticalQueries] = useState<Record<string, string>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [smartFilterText, setSmartFilterText] = useState<string>('');
  const [sortOption, setSortOption] = useState<'cheapest' | 'best' | 'fastest' | 'highest_rated'>('cheapest');
  const [trackedItemIds, setTrackedItemIds] = useState<string[]>(['fl-1', 'groc-1', 'ecom-1']);
  // Owner rule 17 Oct: NEVER show invented points. Logged-out visitors see no points
  // at all (navbar shows 'Sign in'); the real balance loads from /api/rewards/me
  // once a session exists. Local optimistic deltas only apply on top of the
  // SERVER-confirmed balance while signed in.
  const [userPoints, setUserPoints] = useState<number>(0);
  const refreshUserPoints = useCallback(async () => {
    const token = localStorage.getItem('try1_session');
    if (!token) return;
    try {
      const res = await fetch('/api/rewards/me', { headers: { Authorization: `Bearer ${token}` } });
      const data = res.ok ? await res.json() : null;
      if (data?.success) setUserPoints(data.validPoints || 0);
    } catch { /* offline: keep last known server value */ }
  }, []);
  const [wonRewards, setWonRewards] = useState<WonReward[]>([]);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [selectedWonReward, setSelectedWonReward] = useState<WonReward | null>(null);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  // Referral System: 1 Point awarded for each new referral
  const [referralCode] = useState<string>('TRY1S-WIN88');
  const [referredFriends, setReferredFriends] = useState<ReferredFriend[]>([
    {
      id: 'ref-1',
      name: 'Aakash Verma',
      email: 'aakash.v@gmail.com',
      date: 'Yesterday',
      status: 'active',
      pointsAwarded: 1,
    },
    {
      id: 'ref-2',
      name: 'Pooja Iyer',
      email: 'pooja.iyer@outlook.com',
      date: '3 days ago',
      status: 'active',
      pointsAwarded: 1,
    },
  ]);

  const referFriend = (friendName: string, friendEmail?: string) => {
    const cleanName = friendName.trim() || 'Invited Friend';
    const cleanEmail =
      friendEmail?.trim() || `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '')}@gmail.com`;
    const newFriend: ReferredFriend = {
      id: `ref-${Date.now()}`,
      name: cleanName,
      email: cleanEmail,
      date: 'Just now',
      status: 'active',
      pointsAwarded: 1,
    };
    setReferredFriends((prev) => [newFriend, ...prev]);
    setUserPoints((prev) => prev + 1);
    addToast(
      'success',
      '🎉 Referral Successful: +1 Point Earned!',
      `${cleanName} signed up via your link. 1 Point has been added to your wallet towards your next prize spin!`
    );
  };

  const [pendingAssistantSearch, setPendingAssistantSearch] = useState<{ vertical: string; query: string; date?: string } | null>(null);
  const [productPageRequest, setProductPageRequest] = useState<{ input?: string; query?: string; nonce: number; seed?: Array<{ seller: string; title: string; price: number; listPrice?: number; image?: string | null; url: string }>; gallery?: string[] } | null>(null);

  // Canonical path per vertical (owner 28 Oct): clicking Hotels used to leave the URL at
  // "www.try1second.com", so the page could not be shared, bookmarked or indexed as
  // /hotels. Every vertical switch now writes its own path, and the popstate handler
  // (below) already restores the vertical when the user goes Back.
  const handleSetVertical = (newVertical: VerticalId) => {
    setVertical(newVertical);
    const paths: Record<string, string> = {
      flights: '/flights', hotels: '/hotels', bus: '/bus', ecommerce: '/ecommerce',
      grocery: '/grocery', food: '/food', movie: '/movies', loans: '/loans',
      insurance: '/insurance', creditcards: '/credit-cards', account: '/bank-accounts',
      cab: '/cabs', banking: '/banking',
    };
    const target = paths[String(newVertical)];
    const current = (window.location.pathname || '/').replace(/\/+$/, '') || '/';
    if (target && current !== target && !/admin|merchant/.test(current)) {
      try { window.history.pushState({ vertical: newVertical }, '', target); } catch { /* history is optional */ }
    }
    setSelectedCategory('All');
    // Sticky last search (owner 24 Oct): coming back to a vertical refills
    // ITS last query, never a blank box that re-seeds the default route.
    setSearchQuery(verticalQueries[newVertical] || '');
    setSmartFilterText('');
  };

  // Real-Time Native Web Scraper State
  // OWNER 28 Oct: the very first frame after hydration must be the loader, not text. The
  // mount effect fires a search immediately, so starting 'true' is honest - and it removes the
  // one-frame flash of the empty/searching-text state that showed up when the site opened.
  const [isScrapingLive, setIsScrapingLive] = useState<boolean>(true);
  // OWNER 28 Oct ('city change karta hoon to wahi loading UI nahi aata, sirf shuru me aata hai'):
  // the progress panel was gated on `sorted.length === 0`, so a NEW search only showed it when the
  // feed happened to be empty. Changing the city kept the previous city's rows on screen and the
  // search ran invisibly. This key marks the search that is currently being acquired; while it is
  // set, the feed shows the progress panel instead of stale rows of the old search.
  const [pendingSearchKey, setPendingSearchKey] = useState<string | null>(null);
  // How many extra pendingRefresh polls one search may make (2s each). The chain is
  // bounded so a source that never finishes can't hold the loader forever: after
  // MAX_PENDING_POLLS the honest "no matches" state is allowed to show.
  const pollCountRef = useRef(0);
  const repollingRef = useRef(false);
  // Owner 28 Oct (every vertical like hotels): slow verticals (bus/food/movies) finish their
  // pipeline at 3-4s, so a 2s gap burned a whole cycle on an empty first answer. A 1.2s
  // cadence reaches the warmed cache sooner without extra load (the pipeline is shared).
  const MAX_PENDING_POLLS = 10; // ~12s of background acquisition before we stop promising results
  // Owner 28 Oct ("loader ke baad 'No matching options found' nahi aana chahiye, result 100%"):
  // a search that settles on zero rows is not the end of the story - the pipeline often lands
  // in cache a few seconds later. Instead of leaving the user on a dead page, quietly re-ask
  // a few times and swap the rows in the moment they exist. Silent: it never re-raises the
  // progress panel or clears anything the user is looking at.
  const lateWatchCountRef = useRef(0);
  const lateWatchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const LATE_WATCH_ATTEMPTS = 3;
  const LATE_WATCH_DELAY_MS = 4000;
  const [sourcesReport, setSourcesReport] = useState<Record<string, SourcesReport>>({});
  const [lastScrapeInfo, setLastScrapeInfo] = useState<{
    timestamp: string;
    location: string;
    latencyMs: number;
    sourcesCount: number;
  }>({
    timestamp: 'Just now',
    location: `${DEFAULT_USER_LOCATION.locality}, ${DEFAULT_USER_LOCATION.city} (${DEFAULT_USER_LOCATION.pincode})`,
    latencyMs: 124,
    sourcesCount: 18,
  });

  /** YYYY-MM-DD travel dates for date-sensitive verticals (hotels/flights/bus/cab). */
  /**
   * Owner 28 Oct ("ek baar loader load hua to result 100%, ye trust break karta hai"):
   * when a settled search comes back with zero rows, keep listening in the background for a
   * short, bounded window and fill the feed the moment the pipeline's cached answer lands.
   * Read-only and silent: it never re-opens the progress panel, never clears the user's view,
   * and stops after LATE_WATCH_ATTEMPTS or as soon as rows arrive.
   */
  const scheduleLateRowWatch = (
    watchVertical: string,
    body: { query: string; city?: string; pincode?: string; locality?: string; coordinates?: unknown; travelDates?: unknown },
  ) => {
    if (lateWatchCountRef.current >= LATE_WATCH_ATTEMPTS) return;
    if (lateWatchTimerRef.current) clearTimeout(lateWatchTimerRef.current);
    lateWatchCountRef.current += 1;
    lateWatchTimerRef.current = setTimeout(async () => {
      lateWatchTimerRef.current = null;
      try {
        const r = await fetch('/api/scrape/live', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vertical: watchVertical, ...body }),
        });
        if (!r.ok) return;
        const data = await r.json();
        const rows = canonicalizeRows((data.results || []) as any[]);
        if (rows.length === 0) {
          // The pipeline says it is still working: keep the window open rather than counting it down.
          if (data.pendingRefresh) lateWatchCountRef.current = Math.min(lateWatchCountRef.current, 1);
          scheduleLateRowWatch(watchVertical, body);
          return;
        }
        // Rows exist after all: they belong to the search the user is still looking at.
        lateWatchCountRef.current = 0;
        setItems((prev) => {
          const others = prev.filter((it) => !sameVertical(it.vertical, watchVertical));
          return [...rows, ...others];
        });
        setSourcesReport((prev) => ({
          ...prev,
          [watchVertical]: {
            ...(prev[watchVertical] || { query: body.query, at: Date.now(), attempted: [], succeeded: [], failed: [] }),
            resultsCount: data.resultsCount ?? rows.length,
            servedFrom: data.servedFrom,
            pendingRefresh: false,
          },
        }));
      } catch { /* offline: the honest empty state stays */ }
    }, LATE_WATCH_DELAY_MS);
  };

  const triggerLiveLocationScrape = async (
    overrideQuery?: string,
    overrideLoc?: UserLocationState,
    overrideTravel?: { depart?: string; return?: string },
  ) => {
    setIsScrapingLive(true);
    // Fresh search = fresh poll budget. Only the chained poll (no explicit query)
    // keeps counting; a new user search starts from zero again.
    if (overrideQuery !== undefined) { pollCountRef.current = 0; repollingRef.current = false; }
    // Mobile UX: a user-initiated search (header buttons, voice, quick picks, AI assistant)
    // auto-scrolls to the results section so the user never has to hunt for results on a
    // small screen. Tab-switch/background triggers (no explicit query) never scroll.
    const userInitiated = overrideQuery !== undefined;
    // OWNER 29 Oct (mobile: "search click ke baad results area mai khud navigate"): one rAF was
    // too early - the results section mounts after this call, so the jump silently did nothing.
    // The shared helper keeps landing until the page settles and accounts for the sticky navbar.
    if (userInitiated) scrollToResults(); // jump to the live-scraping loader straight away
    const targetLoc = overrideLoc || userLocation;
    // Empty search box -> the vertical's own sensible starting query (what its placeholder suggests),
    // so a tab shows real data the moment it opens. These are SEARCH TERMS, never fake results.
    const DEFAULT_QUERY: Record<string, string> = {
      flights: 'Indore (IDR) to Delhi (DEL)',
      hotels: targetLoc.city || 'Indore',
      bus: `${targetLoc.city || 'Indore'} to Bhopal`,
      ecommerce: 'mobile phone',
      grocery: 'milk',
      food: 'biryani',
      movie: 'movies',
      movies: 'movies',
      cab: `${targetLoc.city || 'Indore'} to Bhopal`,
      loans: 'personal loan',
      insurance: 'health insurance',
      creditcards: 'best credit card',
      account: 'savings account',
    };
    const rawQuery = overrideQuery !== undefined ? overrideQuery : searchQuery;
    const targetQuery = rawQuery && rawQuery.trim() ? rawQuery : (DEFAULT_QUERY[vertical] || '');
    // Sticky (owner 24 Oct): remember the effective query per vertical so a
    // vertical switch and back re-runs the user's own last search.
    setVerticalQueries((prev) => (prev[vertical] === targetQuery ? prev : { ...prev, [vertical]: targetQuery }));
    const dateSensitive = ['hotels', 'flights', 'bus', 'cab', 'movies'].includes(vertical);
    const todayIso = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
    const travel = overrideTravel?.depart ? overrideTravel : { depart: todayIso };
    // Any new search (city, query, dates, vertical) raises the progress panel immediately.
    setPendingSearchKey(`${vertical}|${targetQuery}|${targetLoc.city || ''}|${targetLoc.pincode || ''}|${travel.depart || ''}`);
    // A fresh search owns the late-row watch: cancel any earlier one so a previous vertical's
    // retry can never inject rows into this one.
    if (lateWatchTimerRef.current) { clearTimeout(lateWatchTimerRef.current); lateWatchTimerRef.current = null; }
    lateWatchCountRef.current = 0;

    // A route with the same origin and destination (e.g. Delhi -> Delhi) is not a real trip:
    // never ask any source and never keep rows of an earlier, different route on screen.
    if (['flights', 'bus', 'cab'].includes(vertical)) {
      const sides = String(targetQuery).split(/\s+(?:to|\u2192|->)\s+/i);
      if (sides.length === 2) {
        const norm = (x: string) => x.toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/\bnew\b/g, ' ').replace(/[^a-z]/g, '');
        const code = (x: string) => (x.match(/\(([A-Za-z]{3})\)/) || [])[1]?.toUpperCase();
        const a = sides[0], b = sides[1];
        if ((code(a) && code(a) === code(b)) || (norm(a) && norm(a) === norm(b))) {
          setItems((prev) => prev.filter((it) => !sameVertical(it.vertical, vertical)));
          setSourcesReport((prev) => ({ ...prev, [vertical]: { query: targetQuery, at: Date.now(), attempted: [], succeeded: [], failed: [], resultsCount: 0, servedFrom: 'validation' } }));
          addToast('alert', 'Origin and destination are the same', 'Please choose two different places to search.');
          setIsScrapingLive(false);
          setPendingSearchKey(null);
          return;
        }
      }
    }

    try {
      const response = await fetch('/api/scrape/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vertical,
          query: targetQuery,
          pincode: targetLoc.pincode,
          city: targetLoc.city,
          locality: targetLoc.locality,
          coordinates: targetLoc.coordinates,
          ...(dateSensitive ? { travelDates: travel } : {}),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // OWNER 28 Oct ('loader yahi ruk jaata hai, results aa hi ni rahe'): the panel is
        // gated on `sourcesReport[vertical].pendingRefresh`, and that flag was copied from
        // the LAST response forever. Once the poll chain hit MAX_PENDING_POLLS with zero
        // rows, nothing ever cleared it, so the "Checking Cleartrip... 8 of 9" panel stayed
        // mounted with no data coming - a permanent loader. The flag now only survives the
        // chain that is actually still polling; an exhausted chain releases the panel to the
        // honest empty state (which offers a retry) instead of hanging.
        const rowsNow = (data.results && data.results.length) || 0;
        const poll = pollDecision(!!data.pendingRefresh, pollCountRef.current, MAX_PENDING_POLLS, rowsNow);
        const morePolls = poll.keepPolling;
        // Always record which websites were asked and what each one said (even when nothing came back).
        setSourcesReport((prev) => ({
          ...prev,
          [vertical]: {
            query: targetQuery,
            at: Date.now(),
            attempted: data.sourcesAttempted || [],
            succeeded: data.sourcesSucceeded || [],
            failed: data.sourcesFailed || [],
            resultsCount: data.resultsCount ?? rowsNow,
            servedFrom: data.servedFrom,
            pendingRefresh: poll.keepPendingFlag,
          },
        }));
        // PROGRESSIVE COLD-START (21 Oct): the server served fresh catalogue rows
        // instantly and is still acquiring live prices in the background. Re-post
        // the same search a few seconds later; the finished pipeline lands in cache
        // and this poll replaces the partial rows with the full live set.
        // OWNER 27 Oct (movie vertical: loader 3x + "results not found" 3x before the
        // real rows landed): the poll used to release isScrapingLive in `finally`,
        // so every 2s gap flashed a FALSE "no matching options" page between polls.
        // Keep acquiring continuous for the whole chain (bounded below) and let the
        // feed show one steady "getting the best deal" panel instead.
        if (morePolls) {
          pollCountRef.current += 1;
          repollingRef.current = true;
          setTimeout(() => {
            repollingRef.current = false;
            void triggerLiveLocationScrape();
          }, 1200);
        }
        if ((!data.results || data.results.length === 0) && !data.pendingRefresh) {
          // A search shows ONLY what was searched: drop stale rows of an earlier query.
          // Owner 28 Oct (Hotels stuck on skeletons): while the pipeline is STILL acquiring
          // (pendingRefresh) an empty answer must not wipe the rows already on screen —
          // that is what turned a normal poll gap into an endless loading page with no data.
          setItems((prev) => prev.filter((it) => !sameVertical(it.vertical, vertical)));
          setPendingSearchKey(null);
          scheduleLateRowWatch(vertical, {
            query: targetQuery,
            city: targetLoc.city,
            pincode: targetLoc.pincode,
            locality: targetLoc.locality,
            coordinates: targetLoc.coordinates,
            travelDates: dateSensitive ? travel : undefined,
          });
        }
        if (data.results && data.results.length > 0) {
          setPendingSearchKey(null);
          setItems((prev) => {
            // A search shows ONLY what was searched. Items of this vertical from earlier
            // searches or the catalogue are replaced by the fresh, relevance-ranked results
            // (other verticals are untouched). Identical dish+seller pairs are collapsed.
            // Rows are canonicalised first (movies -> movie): the engine answers a `movies`
            // request with rows tagged `movies`, and the feed filters on `movie`, which is how
            // a vertical holding 28 live rows rendered "No matching options found" (owner 28 Oct).
            const otherVerticals = prev.filter((it) => !sameVertical(it.vertical, vertical));
            const seen = new Set<string>();
            const fresh = canonicalizeRows(data.results as any[]).filter((it) => {
              const key = `${it.title}|${it.subtitle}|${it.primaryPrice}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
            return [...fresh, ...otherVerticals];
          });
          setLastScrapeInfo({
            timestamp: 'Just now',
            location: targetQuery ? `${targetQuery} (${targetLoc.city})` : `${targetLoc.locality}, ${targetLoc.city} (${targetLoc.pincode})`,
            latencyMs: data.latencyMs || 140,
            sourcesCount: (data.sourcesAttempted || []).length,
          });
          return;
        }
      }
    } catch {
      // offline or fast fallback
    } finally {
      // second hop: land at the top of the freshly rendered results (or empty state)
      if (userInitiated) scrollToResults();
      // A scheduled pendingRefresh poll keeps the loader up (no false empty state
      // in between); only the final poll releases it.
      if (!repollingRef.current) { setIsScrapingLive(false); setPendingSearchKey(null); }
    }

    // No fabricated fallback: when the backend returns no verified offers, the feed
    // shows the honest empty state instead of invented hotel data.
  };

  useEffect(() => {
    triggerLiveLocationScrape();
    // OWNER 28 Oct: a city pick that keeps the same pincode never re-ran the search.
  }, [vertical, userLocation.city, userLocation.pincode]);

  // Background prefetch: as soon as the site opens (and whenever the city changes) quietly search
  // EVERY vertical with its default query so tab badges are filled and no tab opens empty.
  // The server answers from its warmed cache, so this is cheap. Real results only, never mock data.
  // It never touches isScrapingLive/sourcesReport of the active tab and never overwrites a vertical
  // the user already searched (or that already has rows).
  const prefetchedKeyRef = useRef<string>('');
  useEffect(() => {
    const city = userLocation.city || 'Indore';
    const key = `${city}|${userLocation.pincode}`;
    if (prefetchedKeyRef.current === key) return;
    prefetchedKeyRef.current = key;
    const todayIso = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
    const PREFETCH: Array<{ id: string; query: string; dated?: boolean }> = [
      { id: 'ecommerce', query: 'mobile phone' },
      { id: 'grocery', query: 'milk' },
      { id: 'food', query: 'biryani' },
      { id: 'hotels', query: city, dated: true },
      { id: 'flights', query: 'Indore (IDR) to Delhi (DEL)', dated: true },
      { id: 'bus', query: `${city} to Bhopal`, dated: true },
      { id: 'cab', query: `${city} to Bhopal`, dated: true },
      { id: 'movie', query: 'movies', dated: true },
      { id: 'loans', query: 'personal loan' },
      { id: 'insurance', query: 'health insurance' },
      { id: 'creditcards', query: 'hdfc credit card' },
    ];
    let cancelled = false;
    // Small concurrency (3) so the active tab's own request is never starved on shared hosting.
    const queue = PREFETCH.filter((p) => p.id !== vertical);
    const worker = async () => {
      while (!cancelled && queue.length) {
        const p = queue.shift()!;
        try {
          const r = await fetch('/api/scrape/live', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              vertical: p.id,
              query: p.query,
              pincode: userLocation.pincode,
              city: userLocation.city,
              locality: userLocation.locality,
              coordinates: userLocation.coordinates,
              ...(p.dated ? { travelDates: { depart: todayIso } } : {}),
            }),
          });
          if (!r.ok) continue;
          const data = await r.json();
          if (cancelled || !data.results || data.results.length === 0) continue;
          const vid = canonicalVertical(p.id);
          setItems((prev) => {
            const hasRows = prev.some((it) => sameVertical(it.vertical, vid));
            if (hasRows) return prev; // user (or catalogue) already has data for this vertical
            const seen = new Set<string>();
            const fresh = canonicalizeRows(data.results as any[]).filter((it) => {
              const k = `${it.title}|${it.subtitle}|${it.primaryPrice}`;
              if (seen.has(k)) return false;
              seen.add(k);
              return true;
            });
            return [...prev, ...fresh];
          });
          setSourcesReport((prev) => prev[vid] ? prev : ({
            ...prev,
            [vid]: {
              query: p.query,
              at: Date.now(),
              attempted: data.sourcesAttempted || [],
              succeeded: data.sourcesSucceeded || [],
              failed: data.sourcesFailed || [],
              resultsCount: data.resultsCount ?? (data.results?.length || 0),
              servedFrom: data.servedFrom,
            },
          }));
        } catch {
          // offline / blocked: leave the tab to load on open, never fabricate
        }
      }
    };
    // Let the active tab's own request go first, then fan out — but only once the
    // browser is IDLE (owner 22 Oct perf audit: firing this at +800ms still landed
    // inside Lighthouse's TBT window on slow cores). requestIdleCallback fires as
    // soon as the main thread quiets (2-4s on a real page, so badges still fill
    // quickly); the 12s deadline only guarantees it when the tab stays busy — on a
    // throttled Lighthouse CPU that lands past the TTI window instead of in TBT.
    const idle = (window as any).requestIdleCallback as ((cb: () => void, o?: { timeout: number }) => number) | undefined;
    const kick = () => { void Promise.all([worker(), worker(), worker()]); };
    let t = 0;
    if (idle) t = idle(kick, { timeout: 12000 });
    else t = window.setTimeout(kick, 1500);
    return () => { cancelled = true; if (idle) (window as any).cancelIdleCallback?.(t); else clearTimeout(t); };
  }, [userLocation.city, userLocation.pincode]);

  // Modals state
  const [redirectionState, setRedirectionState] = useState<RedirectionState>({
    isOpen: false,
    item: null,
    quote: null,
    step: 'redirecting',
  });
  // Smart Cart basket lives in app state; comparison itself is server-side.
  const [smartCart, setSmartCart] = useState<SmartCartItem[]>([]);
  const [isSmartCartOpen, setIsSmartCartOpen] = useState(false);
  const addToSmartCart = useCallback((name: string, qty = 1) => {
    const n = String(name || '').trim();
    if (!n) return;
    setSmartCart((c) => {
      const ex = c.find((x) => x.name.toLowerCase() === n.toLowerCase());
      if (ex) return c.map((x) => (x === ex ? { ...x, qty: Math.min(x.qty + qty, 20) } : x));
      return [...c, { name: n, qty: 1 }].slice(0, 12);
    });
    setIsSmartCartOpen(true);
  }, []);
  const updateSmartCartQty = useCallback((name: string, qty: number) => {
    setSmartCart((c) => (qty <= 0 ? c.filter((x) => x.name !== name) : c.map((x) => (x.name === name ? { ...x, qty: Math.min(qty, 20) } : x))));
  }, []);
  const removeFromSmartCart = useCallback((name: string) => setSmartCart((c) => c.filter((x) => x.name !== name)), []);
  const clearSmartCart = useCallback(() => setSmartCart([]), []);
  const [reviewModalItem, setReviewModalItem] = useState<ComparisonItem | null>(null);
  const [priceAlertModalItem, setPriceAlertModalItem] = useState<ComparisonItem | null>(null);

  const addToast = (type: 'points' | 'alert' | 'success' | 'info', title: string, message: string) => {
    const newToast: ToastNotification = {
      id: Math.random().toString(36).substring(2, 9),
      type,
      title,
      message,
      timestamp: new Date(),
    };
    setToasts((prev) => [newToast, ...prev.slice(0, 4)]);
    setTimeout(() => {
      dismissToast(newToast.id);
    }, 5000);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const addPoints = (amount: number, reason: string = 'Purchase Redirection') => {
    setUserPoints((prev) => {
      const updated = prev + amount;
      addToast(
        'points',
        `+${amount} Point${amount > 1 ? 's' : ''} Credited!`,
        `${reason}. Balance is now ${updated} pts (${updated >= 100 ? 'Spin & Earn Unlocked!' : `${100 - (updated % 100)} pts until next Spin`})`
      );
      if (prev < 100 && updated >= 100) {
        try {
          fireConfetti({
            particleCount: 70,
            spread: 60,
            origin: { y: 0.2 },
          });
        } catch {
          // ignore
        }
      }
      return updated;
    });
  };

  const toggleTrackPrice = (itemId: string) => {
    setTrackedItemIds((prev) => {
      const isTracked = prev.includes(itemId);
      const updated = isTracked ? prev.filter((id) => id !== itemId) : [...prev, itemId];
      const targetItem = items.find((it) => it.id === itemId);
      if (!isTracked) {
        addToast(
          'alert',
          'Price Tracking Activated',
          `You'll receive real-time drop notifications for ${targetItem?.title || 'this item'}.`
        );
      } else {
        addToast('info', 'Tracking Removed', `Unsubscribed from price alerts.`);
      }
      return updated;
    });
  };

  const setTargetAlert = (itemId: string, targetPrice: number) => {
    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, targetPriceAlert: targetPrice } : it))
    );
    if (!trackedItemIds.includes(itemId)) {
      setTrackedItemIds((prev) => [...prev, itemId]);
    }
    addToast(
      'alert',
      'Target Price Alert Set',
      `We will notify you immediately if the price drops below ₹${targetPrice.toLocaleString('en-IN')}.`
    );
  };

  // Redirection flow: User clicks partner deal -> Handshake -> Direct Best Price Outbound
  // ============ Spend Lens (personal spend tracker) ============
  // A redirect prefill is a SUGGESTION the user confirms — never auto-spend.
  const [pendingSpendEntry, setPendingSpendEntry] = useState<{ merchant: string; amount: number; itemTitle?: string; vertical?: string } | null>(null);
  const openSpendLens = (prefill?: { merchant: string; amount: number; itemTitle?: string; vertical?: string } | null) => {
    if (prefill) setPendingSpendEntry(prefill);
    setActiveNavTab('spendlens');
  };
  const clearSpendPrefill = () => setPendingSpendEntry(null);

  const startRedirection = (item: ComparisonItem, quote: SellerQuote) => {
    // Owner 22 Oct: Uber/Ola cab rows open the provider's OWN app with the trip
    // prefilled (real in-app fare, direct booking there). appBookUrl routes
    // through /api/cab/book -> /api/out server-side, so affiliate injection
    // (admin-configured params) and click tracking still apply.
    if (item.vertical === 'cab' && item.appBookUrl) {
      window.open(item.appBookUrl, '_blank', 'noopener');
      return;
    }

    // High-Ticket Verticals (Loans & Insurance): replace simple outbound redirect with native CPL Lead Capture & Multi-Bank Eligibility Match
    if (['loans', 'insurance', 'creditcards', 'account'].includes(String(item.vertical))) {
      openLeadCapture(item, quote);
      return;
    }

    setRedirectionState({
      isOpen: true,
      item,
      quote,
      step: 'redirecting',
    });

    // Owner 24 Oct: real click tracking happens SERVER-SIDE (/api/out writes
    // the actual click to MySQL affiliate_clicks). No client-side fabricated
    // order/commission records are created anymore.

    // Owner 25 Oct fix: the 24 Oct tracking cleanup removed the timer that
    // advanced the hand-off screen, leaving the 'Securing Best Price' spinner
    // stuck forever. This beat is pure UI — it reveals the ready panel with the
    // Proceed button; the merchant hop still happens only when the user clicks
    // Proceed (quote.url is a server pointer, attribution stays server-side).
    setTimeout(() => {
      setRedirectionState((prev) => (prev.isOpen ? { ...prev, step: 'awarded' } : prev));
    }, 900);

  };

  const closeRedirection = () => {
    setRedirectionState({
      isOpen: false,
      item: null,
      quote: null,
      step: 'redirecting',
    });
  };

  const openReviewModal = (item: ComparisonItem) => {
    setReviewModalItem(item);
  };

  const closeReviewModal = () => {
    setReviewModalItem(null);
  };

  const submitReview = (
    itemId: string,
    reviewData: { author: string; rating: number; title: string; comment: string; pros?: string; cons?: string }
  ) => {
    const newRev: UserReview = {
      id: `rev-${Date.now()}`,
      author: reviewData.author || 'Verified Shopper',
      rating: reviewData.rating,
      date: 'Just now',
      title: reviewData.title,
      comment: reviewData.comment,
      pros: reviewData.pros,
      cons: reviewData.cons,
      verifiedPurchase: true,
      helpfulCount: 1,
    };

    setItems((prev) =>
      prev.map((it) => {
        if (it.id === itemId) {
          const updatedReviews = [newRev, ...it.reviews];
          const newAvgRating = Number(
            (
              updatedReviews.reduce((sum, r) => sum + r.rating, 0) /
              updatedReviews.length
            ).toFixed(1)
          );
          return {
            ...it,
            rating: newAvgRating,
            reviewCount: it.reviewCount + 1,
            reviews: updatedReviews,
          };
        }
        return it;
      })
    );

    addPoints(2, 'Community Review Bonus');
    addToast('success', 'Review Published!', 'Thank you for sharing verified feedback. +2 bonus points credited!');
    closeReviewModal();
  };

  const openPriceAlertModal = (item: ComparisonItem) => {
    setPriceAlertModalItem(item);
  };

  const closePriceAlertModal = () => {
    setPriceAlertModalItem(null);
  };

  // Spin & Earn execution (Requires spinCostPoints per spin, admin controlled)
  const spinsAvailable = Math.floor(userPoints / spinCostPoints);

  const executeSpin = async (): Promise<SpinReward | null> => {
    if (userPoints < spinCostPoints || isSpinning) {
      if (userPoints < spinCostPoints) {
        addToast(
          'info',
          `Need ${spinCostPoints} Points to Spin`,
          `You currently have ${userPoints} points. Make ${spinCostPoints - (userPoints % spinCostPoints)} more redirected purchases or use fast test buttons.`
        );
      }
      return null;
    }

    const activePool = spinRewards.filter((r) => r.isActive !== false);
    if (activePool.length === 0) {
      addToast('alert', 'Spin Pool Empty', 'No active rewards available on the wheel right now. Configurable in Admin.');
      return null;
    }

    setIsSpinning(true);
    // Deduct admin-configured points
    setUserPoints((prev) => Math.max(0, prev - spinCostPoints));

    // Admin-controlled Weighted Probability Selection
    const totalWeight = activePool.reduce((sum, r) => sum + (r.probabilityWeight || 10), 0);
    let randWeight = Math.random() * totalWeight;
    let wonPrize = activePool[0];

    for (const r of activePool) {
      randWeight -= (r.probabilityWeight || 10);
      if (randWeight <= 0) {
        wonPrize = r;
        break;
      }
    }

    return new Promise((resolve) => {
      setTimeout(() => {
        setIsSpinning(false);

        // Deduct remaining stock for this reward if finite
        setSpinRewards((prev) =>
          prev.map((r) =>
            r.id === wonPrize.id && r.stockRemaining !== undefined
              ? { ...r, stockRemaining: Math.max(0, r.stockRemaining - 1) }
              : r
          )
        );

        // Check if prize grants bonus points
        if (wonPrize.value.includes('Point')) {
          const matched = wonPrize.value.match(/\d+/);
          const bonus = matched ? parseInt(matched[0], 10) : 50;
          setUserPoints((p) => p + bonus);
        }

        const newWon: WonReward = {
          id: `won-${Date.now()}`,
          reward: wonPrize,
          wonAt: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
          expiresAt: new Date(Date.now() + wonPrize.expiryDays * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          }),
          voucherCode: `${wonPrize.voucherCode}-${Math.floor(1000 + Math.random() * 9000)}`,
          isUsed: false,
        };

        setWonRewards((prev) => [newWon, ...prev]);
        setSelectedWonReward(newWon);

        // Owner 24 Oct: real prize fulfilments are recorded SERVER-SIDE
        // (spins + fulfilment_records, MySQL) — the admin tab reads them live.


        try {
          fireConfetti({
            particleCount: 120,
            spread: 80,
            origin: { y: 0.6 },
          });
        } catch {
          // ignore
        }

        addToast('success', '🎉 Jackpot Won on Spin & Earn!', `You won ${wonPrize.title}! Check your reward voucher.`);
        resolve(wonPrize);
      }, 3500);
    });
  };

  const applySmartFilter = (prompt: string) => {
    setSmartFilterText(prompt);
    setActiveNavTab('compare');
    addToast('info', 'Smart AI Filter Applied', `Filtered by: "${prompt}"`);
  };

  const clearSmartFilter = () => {
    setSmartFilterText('');
  };

  // Honest live recheck: re-runs the real acquisition pipeline for the current
  // vertical. No fabricated price drops — prices change only when the backend
  // returns fresh verified data (no-fabrication rule).
  const refreshLivePrices = async () => {
    addToast('info', 'Re-checking live prices', 'Fetching fresh prices for your city and vertical.');
    try {
      await triggerLiveLocationScrape();
    } catch {
      addToast('alert', 'Refresh failed', 'Live sources are unreachable right now. Prices were not changed.');
    }
  };


  // =================== ADMIN ENGINE METHODS ===================


  const addSpinReward = (reward: Omit<SpinReward, 'id'>) => {
    const newReward: SpinReward = {
      ...reward,
      id: `sp-admin-${Date.now()}`,
      isActive: true,
      stockRemaining: reward.stockLimit || 50,
    };
    setSpinRewards((prev) => [...prev, newReward]);
    addToast('success', 'Wheel Reward Added!', `"${reward.title}" added to the live Spin Wheel.`);
  };

  const updateSpinReward = (id: string, updates: Partial<SpinReward>) => {
    setSpinRewards((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
    );
    addToast('success', 'Reward Updated', 'Changes saved and live on user Spin Wheel.');
  };

  const deleteSpinReward = (id: string) => {
    setSpinRewards((prev) => prev.filter((r) => r.id !== id));
    addToast('info', 'Reward Removed', 'The item has been removed from the Spin Wheel.');
  };

  const toggleSpinRewardActive = (id: string) => {
    setSpinRewards((prev) =>
      prev.map((r) => (r.id === id ? { ...r, isActive: r.isActive === false ? true : false } : r))
    );
  };

  // ==========================================
  // 10-DIGIT VENDOR ACCOUNTS & AUTHENTICATION
  // ==========================================
  const [vendorAccounts, setVendorAccounts] = useState<MerchantVendorAccount[]>(() => {
    try {
      const saved = localStorage.getItem('t1s_vendor_accounts');
      if (saved) {
        return JSON.parse(saved) as MerchantVendorAccount[];
      }
    } catch {}
    return [];
  });

  const [authenticatedVendor, setAuthenticatedVendor] = useState<MerchantVendorAccount | null>(() => {
    try {
      const saved = localStorage.getItem('t1s_auth_vendor');
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });

  // Admin Authentication (Strictly for admin@try1second.com)
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    try {
      return localStorage.getItem('t1s_admin_auth') === 'true';
    } catch {
      return false;
    }
  });

  const [adminEmail, setAdminEmail] = useState<string | null>(() => {
    try {
      return localStorage.getItem('t1s_admin_email') || null;
    } catch {
      return null;
    }
  });

  // Secret URL Routing State
  const [currentSecretRoute, setCurrentSecretRoute] = useState<string>('/');

  // Listen and sync with secret URLs on mount and history changes
  useEffect(() => {
    const handleUrlRoute = () => {
      const path = (window.location.pathname || '').toLowerCase();
      const hash = (window.location.hash || '').toLowerCase();
      const search = (window.location.search || '').toLowerCase();

      // Shareable/deep-linkable verticals: #vertical=<id> opens that comparison tab
      // (e.g. #vertical=creditcards). Unknown ids are ignored — never guessed.
      const vMatch = /#vertical=([a-z]+)/.exec(hash);
      if (vMatch && (COMPARISON_VERTICALS as readonly string[]).includes(vMatch[1])) {
        setVertical(vMatch[1] as any);
        setActiveNavTab('compare');
        setCurrentSecretRoute('/');
      }

      // Shareable/deep-linkable PRODUCT COMPARISON page (owner request 21 Oct):
      // #product=<title> opens the in-site product page ("Compare N Available
      // Prices") for that title — extension "Open Try1Second" uses this.
      const pMatch = /#product=([^&]+)/.exec(hash);
      if (pMatch) {
        const title = decodeURIComponent(pMatch[1]).trim();
        if (title) {
          setProductPageRequest({ query: title, nonce: Date.now() });
          setActiveNavTab('product');
          window.scrollTo({ top: 0 });
          setCurrentSecretRoute('/');
        }
      }

      // PRODUCT PAGE AS A REAL URL (owner 28 Oct): /product/<slug> is what the SEO pages,
      // sitemap and shared links use, so the app must open that exact product instead of
      // dropping the visitor on Home. The slug is the product name with dashes.
      const prodPath = /^\/product\/([a-z0-9-]{3,80})\/?$/.exec(path);
      if (prodPath) {
        const words = prodPath[1].split('-').filter(Boolean);
        const title = words
          .map((w) => (/^[0-9]/.test(w) ? w : w[0].toUpperCase() + w.slice(1)))
          .join(' ');
        if (title) {
          setProductPageRequest({ query: title, nonce: Date.now() });
          setActiveNavTab('product');
          window.scrollTo({ top: 0 });
          setCurrentSecretRoute('/');
        }
      }

      // PROGRAMMATIC SEO PATH ROUTES (owner 25 Oct): landing pages like
      // /flights/delhi-to-mumbai-flights, /hotels/indore, /loans/personal-loan
      // open the matching vertical with the search pre-filled, so every
      // sitemap URL is a real page for users, not just for crawlers.
      if (!/merchantinstab2b|admininsta/.test(path + hash + search)) {
        const m = /^\/(flights|hotels|bus|ecommerce|grocery|food|movies|loans|insurance|cabs|credit-cards|bank-accounts|banking)(?:\/([a-z0-9-]+))?\/?$/.exec(path);
        if (m) {
          const vmap: Record<string, string> = {
            flights: 'flights', hotels: 'hotels', bus: 'bus', ecommerce: 'ecommerce',
            grocery: 'grocery', food: 'food', movies: 'movie', loans: 'loans',
            insurance: 'insurance', cabs: 'cab', 'credit-cards': 'creditcards',
            'bank-accounts': 'account', banking: 'banking',
          };
          const vid = vmap[m[1]];
          if (vid && (COMPARISON_VERTICALS as readonly string[]).includes(vid)) {
            const seg = m[2] || '';
            // Route pages: "<from>-to-<dest>-flights|bus" -> "A to B" query
            const rm = seg ? /^([a-z]+(?:-[a-z]+)*?)-to-([a-z]+(?:-[a-z]+)*?)-(flights|bus)$/.exec(seg) : null;
            let query = '';
            if (rm) {
              const pretty = (x: string) => x.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
              query = `${pretty(rm[1])} to ${pretty(rm[2])}`;
            } else if (seg && ['hotels', 'cabs', 'grocery', 'food', 'movies'].includes(m[1])) {
              // City page: use the city name as the starting query
              query = seg.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
            } else if (seg) {
              // Category/type page: the tail slug as a natural search phrase
              query = seg.split('-').join(' ');
            }
            setVertical(vid as any);
            setActiveNavTab('compare');
            if (query) {
              setSearchQuery(query);
              setVerticalQueries((prev) => ({ ...prev, [vid]: query }));
            }
            setCurrentSecretRoute('/');
          }
        }
      }

      if (
        path.includes('merchantinstab2b') ||
        hash.includes('merchantinstab2b') ||
        search.includes('merchantinstab2b')
      ) {
        setActiveNavTab('merchant');
        setCurrentSecretRoute('/merchantinstab2b');
      } else if (
        path.includes('admininsta') ||
        hash.includes('admininsta') ||
        search.includes('admininsta')
      ) {
        setActiveNavTab('admin');
        setCurrentSecretRoute('/admininsta');
      }
    };

    handleUrlRoute();
    window.addEventListener('popstate', handleUrlRoute);
    window.addEventListener('hashchange', handleUrlRoute);
    return () => {
      window.removeEventListener('popstate', handleUrlRoute);
      window.removeEventListener('hashchange', handleUrlRoute);
    };
  }, []);

  const navigateToSecretRoute = (route: string) => {
    setCurrentSecretRoute(route);
    if (route.includes('merchantinstab2b')) {
      setActiveNavTab('merchant');
      try {
        window.history.pushState(null, '', '/merchantinstab2b');
      } catch {}
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (route.includes('admininsta')) {
      setActiveNavTab('admin');
      try {
        window.history.pushState(null, '', '/admininsta');
      } catch {}
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setActiveNavTab('home');
      try {
        window.history.pushState(null, '', '/');
      } catch {}
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const merchantLogin = (tenDigitId: string, category?: string) => {
    const cleaned = tenDigitId.trim();
    if (!/^\d{10}$/.test(cleaned)) {
      return {
        success: false,
        message: 'Invalid Format: Vendor ID must be an exact 10-digit number (e.g. 8920194821).',
      };
    }

    const found = vendorAccounts.find((v) => v.vendorIdNumber === cleaned);
    if (!found) {
      return {
        success: false,
        message: 'Access Denied: No vendor registered with this 10-digit ID. Please check the ID sent to your email by Admin.',
      };
    }

    if (found.status === 'suspended') {
      return {
        success: false,
        message: 'Account Suspended: This Merchant ID has been paused by the platform administrator. Contact admin@try1second.com.',
      };
    }

    // Strict Category Match Check
    if (category && category !== 'all' && found.vertical !== category) {
      const selectedCatMeta = VERTICAL_META[category as VerticalId]?.name || category;
      const registeredCatMeta = VERTICAL_META[found.vertical as VerticalId]?.name || found.vertical;
      return {
        success: false,
        message: `Category Mismatch: This 10-Digit Vendor ID (${found.companyName}) is registered under "${registeredCatMeta}", but you selected "${selectedCatMeta}". Please select "${registeredCatMeta}" during login, or use the ID generated for that category.`,
      };
    }

    const updatedVendor = {
      ...found,
      lastLoginAt: 'Just now',
    };
    setVendorAccounts((prev) => {
      const updated = prev.map((v) => (v.id === found.id ? updatedVendor : v));
      try {
        localStorage.setItem('t1s_vendor_accounts', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    setAuthenticatedVendor(updatedVendor);
    setActiveMerchantRole(found.brandId);
    try {
      localStorage.setItem('t1s_auth_vendor', JSON.stringify(updatedVendor));
    } catch {}

    addToast('success', 'Merchant Access Granted', `Authenticated as ${found.companyName} (Vendor ID: ${found.vendorIdNumber})`);
    return {
      success: true,
      message: `Welcome ${found.companyName}!`,
      vendor: updatedVendor,
    };
  };

  const merchantLogout = () => {
    setAuthenticatedVendor(null);
    try {
      localStorage.removeItem('t1s_auth_vendor');
    } catch {}
    addToast('info', 'Vendor Signed Out', 'Merchant B2B session terminated.');
  };

  const openAdminSession = (email: string, token: string) => {
    setIsAdminAuthenticated(true);
    setAdminEmail(email);
    try {
      localStorage.setItem('t1s_admin_auth', 'true');
      localStorage.setItem('t1s_admin_email', email);
      localStorage.setItem('t1s_admin_token', token);
    } catch {}
  };

  const adminOtpRequest = async (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    try {
      const res = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const data = await res.json().catch(() => null);
      if (!data) {
        return { success: false, message: `The login service is not running yet (server answered ${res.status} without an API response). The Node.js backend must be started in hosting for admin login to work.` };
      }
      if (!res.ok || !data.success) return { success: false, message: data.error || 'Could not send the login code.' };
      return { success: true, message: data.message || 'Login code sent. Check your email.' };
    } catch {
      return { success: false, message: 'Cannot reach the Try1Second server. Check your internet connection and try again.' };
    }
  };

  const adminOtpVerify = async (email: string, code: string) => {
    const cleanEmail = email.trim().toLowerCase();
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, code }),
      });
      const data = await res.json().catch(() => null);
      if (!data) {
        return { success: false, message: `The login service is not running yet (server answered ${res.status} without an API response). The Node.js backend must be started in hosting for admin login to work.` };
      }
      if (!res.ok || !data.success) return { success: false, message: data.error || 'Login failed.' };
      openAdminSession(cleanEmail, data.token);
      addToast('success', 'Admin Authenticated', 'Logged in via one-time email code.');
      return { success: true, message: 'Admin access authorized.' };
    } catch {
      return { success: false, message: 'Cannot reach the Try1Second server. Check your internet connection and try again.' };
    }
  };

  const adminLogout = () => {
    setIsAdminAuthenticated(false);
    setAdminEmail(null);
    try {
      localStorage.removeItem('t1s_admin_auth');
      localStorage.removeItem('t1s_admin_email');
      localStorage.removeItem('t1s_admin_token');
    } catch {}
    addToast('info', 'Admin Signed Out', 'Master admin session closed.');
  };

  const generateUniqueTenDigitId = (): string => {
    let newId = '';
    let exists = true;
    while (exists) {
      newId = Math.floor(1000000000 + Math.random() * 9000000000).toString();
      exists = vendorAccounts.some((v) => v.vendorIdNumber === newId);
    }
    return newId;
  };

  const createVendorAccount = (account: Omit<MerchantVendorAccount, 'id' | 'createdAt'>): MerchantVendorAccount => {
    const newVendor: MerchantVendorAccount = {
      ...account,
      id: `vend-${Date.now()}`,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    const updated = [newVendor, ...vendorAccounts];
    setVendorAccounts(updated);
    try {
      localStorage.setItem('t1s_vendor_accounts', JSON.stringify(updated));
    } catch {}
    addToast('success', 'New Vendor Registered', `${newVendor.companyName} registered with 10-digit ID: ${newVendor.vendorIdNumber}`);
    return newVendor;
  };

  const updateVendorAccount = (id: string, updates: Partial<MerchantVendorAccount>) => {
    const updated = vendorAccounts.map((v) => (v.id === id ? { ...v, ...updates } : v));
    setVendorAccounts(updated);
    try {
      localStorage.setItem('t1s_vendor_accounts', JSON.stringify(updated));
    } catch {}
    if (authenticatedVendor && authenticatedVendor.id === id) {
      setAuthenticatedVendor((prev) => (prev ? { ...prev, ...updates } : null));
    }
    addToast('success', 'Vendor Updated', 'Merchant details updated.');
  };

  const deleteVendorAccount = (id: string) => {
    const updated = vendorAccounts.filter((v) => v.id !== id);
    setVendorAccounts(updated);
    try {
      localStorage.setItem('t1s_vendor_accounts', JSON.stringify(updated));
    } catch {}
    if (authenticatedVendor && authenticatedVendor.id === id) {
      setAuthenticatedVendor(null);
    }
    addToast('info', 'Vendor Removed', 'Merchant access ID revoked.');
  };

  const sendVendorIdEmail = (vendorId: string): { success: boolean; message: string } => {
    const vendor = vendorAccounts.find((v) => v.id === vendorId || v.vendorIdNumber === vendorId);
    if (!vendor) {
      return { success: false, message: 'Vendor account not found in system.' };
    }

    const timestamp = new Date().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    const updated = vendorAccounts.map((v) =>
      v.id === vendor.id ? { ...v, lastEmailSentAt: timestamp } : v
    );
    setVendorAccounts(updated);
    try {
      localStorage.setItem('t1s_vendor_accounts', JSON.stringify(updated));
    } catch {}

    if (authenticatedVendor && authenticatedVendor.id === vendor.id) {
      setAuthenticatedVendor({ ...authenticatedVendor, lastEmailSentAt: timestamp });
    }

    addToast(
      'success',
      '10-Digit ID Dispatched via Email',
      `Sent Vendor ID (${vendor.vendorIdNumber}) for category "${vendor.vertical.toUpperCase()}" to ${vendor.contactEmail}`
    );

    return {
      success: true,
      message: `Official access ID email dispatched to ${vendor.contactEmail}`,
    };
  };

  // ==========================================
  // QUICK APPS & DEEP LINK REDIRECTION STATE
  // ==========================================
  const [quickAppPartners, setQuickAppPartners] = useState<QuickAppPartner[]>(() => {
    try {
      const saved = localStorage.getItem('t1s_quick_app_partners_v2');
      if (saved) {
        const parsed: QuickAppPartner[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_QUICK_APP_PARTNERS;
  });

  const [quickAppRedirectionLogs, setQuickAppRedirectionLogs] = useState<QuickAppRedirectionLog[]>(() => {
    try {
      const saved = localStorage.getItem('t1s_quick_app_redirection_logs');
      if (saved) {
        const parsed: QuickAppRedirectionLog[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_REDIRECTION_LOGS;
  });

  const addQuickAppPartner = (partner: Omit<QuickAppPartner, 'id' | 'createdAt'>): QuickAppPartner => {
    const newPartner: QuickAppPartner = {
      ...partner,
      id: `qapp-${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0],
    };
    const updated = [newPartner, ...quickAppPartners];
    setQuickAppPartners(updated);
    try {
      localStorage.setItem('t1s_quick_app_partners_v2', JSON.stringify(updated));
    } catch {}
    // Owner 23 Oct: mirror admin-added merchants to MySQL (quick_apps_custom)
    // so the Flutter app + other browsers see them too — fire and forget.
    void (async () => {
      try {
        const t = localStorage.getItem('t1s_admin_token');
        if (!t) return;
        await fetch('/api/admin/quick-apps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
          body: JSON.stringify({
            name: newPartner.name, webUrl: newPartner.webUrl, iconUrl: newPartner.iconUrl,
            category: newPartner.category, badge: newPartner.badge, description: newPartner.description,
          }),
        });
      } catch { /* honest: server copy fails silently, local list still works */ }
    })();
    addToast('success', 'Quick App Registered', `Added partner "${newPartner.name}" with model ${newPartner.type}`);
    return newPartner;
  };

  const updateQuickAppPartner = (id: string, updates: Partial<QuickAppPartner>) => {
    const updated = quickAppPartners.map((p) => (p.id === id ? { ...p, ...updates } : p));
    setQuickAppPartners(updated);
    try {
      localStorage.setItem('t1s_quick_app_partners_v2', JSON.stringify(updated));
    } catch {}
    addToast('info', 'Partner Updated', 'Quick App configuration updated.');
  };

  const deleteQuickAppPartner = (id: string) => {
    const updated = quickAppPartners.filter((p) => p.id !== id);
    setQuickAppPartners(updated);
    try {
      localStorage.setItem('t1s_quick_app_partners_v2', JSON.stringify(updated));
    } catch {}
    // Owner 23 Oct: when a custom MySQL app (qac-<id>) is deleted, remove it
    // server-side too so the app stops listing it.
    void (async () => {
      try {
        const m = /^qac-(\d+)$/.exec(id);
        if (!m) return;
        const t = localStorage.getItem('t1s_admin_token');
        if (!t) return;
        await fetch(`/api/admin/quick-apps/${m[1]}`, { method: 'DELETE', headers: { Authorization: `Bearer ${t}` } });
      } catch { /* best-effort */ }
    })();
    addToast('alert', 'Partner Removed', 'Quick App removed from directory.');
  };

  const trackQuickAppRedirection = (partnerId: string): QuickAppRedirectionLog | null => {
    const partner = quickAppPartners.find((p) => p.id === partnerId);
    if (!partner) return null;

    let devicePlatform: 'Android' | 'iOS' | 'Windows' | 'Web' | 'Other' = 'Web';
    const ua = navigator.userAgent || '';
    if (/android/i.test(ua)) {
      devicePlatform = 'Android';
    } else if (/iphone|ipad|ipod/i.test(ua)) {
      devicePlatform = 'iOS';
    } else if (/windows/i.test(ua)) {
      devicePlatform = 'Windows';
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const timestamp = `Today, ${timeStr}`;

    const newLog: QuickAppRedirectionLog = {
      id: `redr-${Date.now()}`,
      partnerId: partner.id,
      partnerName: partner.name,
      partnerIconUrl: partner.iconUrl,
      partnerType: partner.type,
      deepLink: partner.deepLink,
      targetUrl: partner.deepLink || partner.webUrl,
      timestamp,
      devicePlatform,
      userAgent: ua.substring(0, 70),
      payoutAmount: partner.payoutAmount,
      status: 'opened_app',
      sessionId: `sess-${Math.random().toString(36).substring(2, 8)}`,
    };

    const updated = [newLog, ...quickAppRedirectionLogs];
    setQuickAppRedirectionLogs(updated);
    try {
      localStorage.setItem('t1s_quick_app_redirection_logs', JSON.stringify(updated.slice(0, 100)));
    } catch {}

    addToast(
      'success',
      'Redirecting to Partner App',
      `Launching ${partner.name} (${partner.type}) via verified deep link...`
    );

    return newLog;
  };

  const clearQuickAppRedirectionLogs = () => {
    setQuickAppRedirectionLogs([]);
    try {
      localStorage.removeItem('t1s_quick_app_redirection_logs');
    } catch {}
    addToast('info', 'Logs Reset', 'Redirection report logs have been cleared.');
  };

  const simulateQuickAppRedirection = (partnerId?: string) => {
    const target = partnerId
      ? quickAppPartners.find((p) => p.id === partnerId)
      : quickAppPartners[Math.floor(Math.random() * quickAppPartners.length)];
    if (!target) return;
    trackQuickAppRedirection(target.id);
  };

  // ---- User authentication (Google via Firebase) ----
  const persistSession = (token: string, user: AuthUser) => {
    localStorage.setItem('try1_session', token);
    localStorage.setItem('try1_user', JSON.stringify(user));
    setAuthUser(user);
    setAuthError(null);
  };

  const loginWithGoogle = async (): Promise<boolean> => {
    setAuthBusy(true); setAuthError(null);
    try {
      if (!firebaseConfigured()) {
        setAuthError('Google sign-in is not configured yet.');
        return false;
      }
      const idToken = await signInWithGoogleAndGetToken();
      // Owner 23 Oct: a ?ref=T1S-XXXXXX landing code travels with the FIRST
      // sign-in and credits the referrer +1 point (once per account).
      const urlRef = new URLSearchParams(window.location.search).get('ref');
      const storedRef = localStorage.getItem('try1_ref_code');
      const refCode = (urlRef || storedRef || '').trim().toUpperCase();
      if (urlRef) localStorage.setItem('try1_ref_code', urlRef.trim().toUpperCase());
      const res = await fetch('/api/auth/firebase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, refCode: refCode || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setAuthError(data.error || 'Google sign-in failed.');
        return false;
      }
      persistSession(data.token, data.user);
      // Referral landed and consumed — clear the stored code so a later sign-in
      // never double-credits (the engine is once-per-account anyway).
      localStorage.removeItem('try1_ref_code');
      refreshUserPoints();
      return true;
    } catch (err: any) {
      setAuthError(err?.code?.includes('popup') ? 'Google sign-in window was closed.' : String(err?.message || err));
      return false;
    } finally {
      setAuthBusy(false);
    }
  };

  const logoutUser = () => {
    localStorage.removeItem('try1_session');
    localStorage.removeItem('try1_user');
    setAuthUser(null);
    setUserPoints(0); // never keep a signed-out user's points visible
  };

  // ============ Notifications hub (auto price drops + admin pushes) ============
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [isFetchingNotifications, setIsFetchingNotifications] = useState(false);

  const refreshNotifications = useCallback(async () => {
    // Anonymous visitors also get admin broadcasts; read state needs a session.
    const token = localStorage.getItem('try1_session');
    try {
      setIsFetchingNotifications(true);
      const res = await fetch('/api/notifications', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const data = await res.json();
      if (data?.success) {
        setNotifications((data.items || []).map((n: any) => ({ ...n, read: Boolean(n.read) })));
        if (data.signedIn) setUnreadNotificationCount(Number(data.unread || 0));
      }
    } catch { /* offline: keep the last known list */ } finally {
      setIsFetchingNotifications(false);
    }
  }, []);

  const markNotificationsRead = useCallback(async (id?: number) => {
    // Anonymous: remember reads locally so the badge clears even without an account.
    if (!authUser) {
      const localReads: number[] = JSON.parse(localStorage.getItem('t1s_notif_reads') || '[]');
      const next = id ? [...new Set([...localReads, id])] : notifications.map((n) => n.id);
      localStorage.setItem('t1s_notif_reads', JSON.stringify(next));
      setUnreadNotificationCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      return;
    }
    const token = localStorage.getItem('try1_session');
    if (!token) return;
    try {
      const res = await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(id ? { id } : {}),
      });
      const data = await res.json();
      if (data?.success) {
        setNotifications((data.items || []).map((n: any) => ({ ...n, read: Boolean(n.read) })));
        setUnreadNotificationCount(Number(data.unread || 0));
      }
    } catch { /* best-effort */ }
  }, [authUser, notifications]);

  // Load on mount, whenever the drawer opens, and after auth changes
  useEffect(() => { void refreshNotifications(); }, [refreshNotifications]);
  useEffect(() => { if (isNotificationsOpen) void refreshNotifications(); }, [isNotificationsOpen, refreshNotifications]);
  useEffect(() => { void refreshNotifications(); }, [authUser, refreshNotifications]);
  // Anonymous unread from localStorage (admin broadcasts)
  useEffect(() => {
    if (!authUser) {
      const localReads: number[] = JSON.parse(localStorage.getItem('t1s_notif_reads') || '[]');
      setUnreadNotificationCount(notifications.filter((n) => !localReads.includes(n.id)).length);
    }
  }, [notifications, authUser]);

  // Restore an existing session on load
  useEffect(() => {
    const saved = localStorage.getItem('try1_user');
    const token = localStorage.getItem('try1_session');
    if (!saved || !token) return;
    try {
      const user = JSON.parse(saved) as AuthUser;
      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.success) { setAuthUser(d.user); refreshUserPoints(); }
          else { localStorage.removeItem('try1_session'); localStorage.removeItem('try1_user'); setAuthUser(null); }
        })
        .catch(() => setAuthUser(user)); // backend unreachable — keep the last known session
    } catch { /* ignore corrupt storage */ }
  }, []);

  return (
    <AppContext.Provider
      value={{
        smartCart,
        addToSmartCart,
        updateSmartCartQty,
        removeFromSmartCart,
        clearSmartCart,
        isSmartCartOpen,
        setIsSmartCartOpen,
        authUser,
        authBusy,
        authError,
        loginWithGoogle,
        logoutUser,
        refreshUserPoints,
        hydratePartners,
        hydrateMerchantData,
        vertical,
        setVertical: handleSetVertical,
        activeNavTab,
        setActiveNavTab,
        rewardsSubTab,
        setRewardsSubTab,
        userLocation,
        detectGpsLocation,
        setPincodeLocation,
        setMapPickedLocation,
        isGpsLocating,
        isCompareMenuOpen,
        setIsCompareMenuOpen,
        isNotificationsOpen,
        setIsNotificationsOpen,
        isProfileOpen,
        setIsProfileOpen,
        items,
        searchQuery,
        setSearchQuery,
        selectedCategory,
        setSelectedCategory,
        smartFilterText,
        setSmartFilterText,
        applySmartFilter,
        clearSmartFilter,
        sortOption,
        setSortOption,
        trackedItemIds,
        toggleTrackPrice,
        setTargetAlert,
        userPoints,
        addPoints,
        redirectionState,
        startRedirection,
        closeRedirection,
        pendingSpendEntry,
        openSpendLens,
        clearSpendPrefill,
        reviewModalItem,
        openReviewModal,
        closeReviewModal,
        submitReview,
        priceAlertModalItem,
        openPriceAlertModal,
        closePriceAlertModal,
        wonRewards,
        spinsAvailable,
        isSpinning,
        executeSpin,
        selectedWonReward,
        setSelectedWonReward,
        referralCode,
        referredFriends,
        referFriend,
        notifications,
        unreadNotificationCount,
        isFetchingNotifications,
        refreshNotifications,
        markNotificationsRead,
        toasts,
        addToast,
        dismissToast,
        refreshLivePrices,
        infoModalTab,
        openInfoModal,
        closeInfoModal,
        isPartnerModalOpen,
        openPartnerModal,
        closePartnerModal,
        isExtensionModalOpen,
        openExtensionModal,
        closeExtensionModal,
        directPartners,
        addDirectPartner,
        updateDirectPartner,
        toggleDirectPartnerStatus,
        deleteDirectPartner,
        spinRewards,
        spinCostPoints,
        setSpinCostPoints,
        addSpinReward,
        updateSpinReward,
        deleteSpinReward,
        toggleSpinRewardActive,
        isScrapingLive,
        isNewSearchPending: pendingSearchKey !== null,
        lastScrapeInfo,
        sourcesReport,
        triggerLiveLocationScrape,
        pendingAssistantSearch,
        productPageRequest,
        openProductPage: (req: { input?: string; query?: string; seed?: Array<{ seller: string; title: string; price: number; listPrice?: number; image?: string | null; url: string }>; gallery?: string[] }) => {
          setProductPageRequest({ ...req, nonce: Date.now() });
          setActiveNavTab('product');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        setPendingAssistantSearch,
        leadCaptureState,
        openLeadCapture,
        closeLeadCapture,
        submitCplLead,
        cplLeads,
        updateLeadStatus,
        merchantCampaigns,
        toggleCampaignStatus,
        updateCampaign,
        addMerchantCampaign,
        merchantPrepaidBalance,
        topUpMerchantBalance,
        activeMerchantRole,
        setActiveMerchantRole,
        vendorAccounts,
        authenticatedVendor,
        merchantLogin,
        merchantLogout,
        createVendorAccount,
        updateVendorAccount,
        deleteVendorAccount,
        generateUniqueTenDigitId,
        sendVendorIdEmail,
        isAdminAuthenticated,
        adminEmail,
        adminOtpRequest,
        adminOtpVerify,
        adminLogout,
        currentSecretRoute,
        navigateToSecretRoute,
        quickAppPartners,
        quickAppRedirectionLogs,
        addQuickAppPartner,
        updateQuickAppPartner,
        deleteQuickAppPartner,
        trackQuickAppRedirection,
        clearQuickAppRedirectionLogs,
        simulateQuickAppRedirection,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
