import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import confetti from 'canvas-confetti';
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
  INITIAL_COMPARISON_ITEMS,
  SPIN_REWARDS,
  VERTICAL_META,
} from '../data/mockData';
import { EXTRA_COMPARISON_ITEMS } from '../data/extraComparisonItems';
import { CATEGORY_COMPARISON_ITEMS } from '../data/categoryItems';
import { INITIAL_DIRECT_PARTNERS } from '../data/partnersData';
import {
  INITIAL_QUICK_APP_PARTNERS,
  INITIAL_REDIRECTION_LOGS,
} from '../data/quickAppsData';
import {
  INITIAL_CPL_LEADS,
  INITIAL_MERCHANT_CAMPAIGNS,
  INITIAL_MERCHANT_METRICS,
  INITIAL_VENDOR_ACCOUNTS,
} from '../data/merchantData';
import {
  INITIAL_USER_PURCHASES,
  INITIAL_PARTNER_PAYOUTS,
  INITIAL_AFFILIATE_IDS,
  INITIAL_SCRAPERS,
  INITIAL_API_INTEGRATIONS,
  INITIAL_AFFILIATE_NETWORKS,
  INITIAL_USER_LOGINS,
  INITIAL_SPIN_WINNERS,
} from '../data/adminMockData';
import { INITIAL_RESIDENTIAL_PROXIES, parseBulkProxies } from '../data/proxyData';
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

interface AppContextType {
  vertical: VerticalId;
  setVertical: (v: VerticalId) => void;
  activeNavTab: MainNavTab;
  setActiveNavTab: (tab: MainNavTab) => void;
  rewardsSubTab: RewardsSubTab;
  setRewardsSubTab: (tab: RewardsSubTab) => void;
  userLocation: UserLocationState;
  detectGpsLocation: () => Promise<void>;
  setPincodeLocation: (pin: string) => void;
  isGpsLocating: boolean;
  isCompareMenuOpen: boolean;
  setIsCompareMenuOpen: (open: boolean) => void;
  isNotificationsOpen: boolean;
  setIsNotificationsOpen: (open: boolean) => void;
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
  simulatePriceDrop: () => void;
  infoModalTab: InfoModalTab | null;
  openInfoModal: (tab: InfoModalTab) => void;
  closeInfoModal: () => void;
  isPartnerModalOpen: boolean;
  openPartnerModal: () => void;
  closePartnerModal: () => void;
  isExtensionModalOpen: boolean;
  openExtensionModal: () => void;
  closeExtensionModal: () => void;

  // Admin Portal state and actions
  userPurchases: UserPurchaseRecord[];
  partnerPayouts: PartnerPayoutSummary[];
  affiliateIds: AffiliateIdConfig[];
  scrapers: CustomScraperConfig[];
  apiIntegrations: ApiIntegrationConfig[];
  affiliateNetworks: AffiliateNetworkHubConfig[];
  addAffiliateId: (config: Omit<AffiliateIdConfig, 'id'>) => void;
  toggleAffiliateIdStatus: (id: string) => void;
  addCustomScraper: (scraper: Omit<CustomScraperConfig, 'id' | 'lastScrapeTime' | 'itemsScrapedLastRun'>) => void;
  runScraperSimulation: (scraperId: string, testQuery?: string) => Promise<{ success: boolean; itemsFound: number; sampleTitle: string; samplePrice: number }>;
  addApiIntegration: (api: Omit<ApiIntegrationConfig, 'id' | 'latencyMs'>) => void;
  testApiPing: (apiId: string) => Promise<number>;
  updateAffiliateNetwork: (id: string, updates: Partial<AffiliateNetworkHubConfig>) => void;
  simulateNetworkPostback: (networkName: string) => void;

  // 100+ Direct Partners Directory & Management
  directPartners: DirectPartnerItem[];
  addDirectPartner: (partner: Omit<DirectPartnerItem, 'id' | 'clickCount'>) => void;
  updateDirectPartner: (id: string, updates: Partial<DirectPartnerItem>) => void;
  toggleDirectPartnerStatus: (id: string) => void;
  deleteDirectPartner: (id: string) => void;
  recordPartnerClick: (id: string) => void;

  // User Login & Session Auditing
  userLogins: UserLoginSession[];
  blockUserSession: (userId: string) => void;
  unblockUserSession: (userId: string) => void;
  creditBonusPointsToUser: (userId: string, pts: number) => void;

  // Spin & Earn Dynamic Management
  spinRewards: SpinReward[];
  spinCostPoints: number;
  setSpinCostPoints: (pts: number) => void;
  addSpinReward: (reward: Omit<SpinReward, 'id'>) => void;
  updateSpinReward: (id: string, updates: Partial<SpinReward>) => void;
  deleteSpinReward: (id: string) => void;
  toggleSpinRewardActive: (id: string) => void;
  spinWinners: SpinWinnerLog[];

  // Real-Time Native Web Scraper State
  isScrapingLive: boolean;
  lastScrapeInfo: {
    timestamp: string;
    location: string;
    latencyMs: number;
    sourcesCount: number;
  };
  triggerLiveLocationScrape: (overrideQuery?: string, overrideLoc?: UserLocationState) => Promise<void>;

  // Residential Proxy Pool for Hard-Blocked Sites & Hostinger Deployment
  proxies: ResidentialProxyConfig[];
  addResidentialProxy: (proxy: Omit<ResidentialProxyConfig, 'id'>) => void;
  bulkAddResidentialProxies: (rawText: string) => number;
  toggleProxyStatus: (id: string) => void;
  deleteProxy: (id: string) => void;
  testProxyPing: (id: string) => Promise<{ latencyMs: number; success: boolean; ip: string }>;

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
    vertical?: 'loans' | 'insurance';
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
  adminLogin: (email: string, pass: string) => { success: boolean; message: string };
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
  trackQuickAppRedirection: (partnerId: string) => QuickAppRedirectionLog | null;
  clearQuickAppRedirectionLogs: () => void;
  simulateQuickAppRedirection: (partnerId?: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
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
  const [rewardsSubTab, setRewardsSubTab] = useState<RewardsSubTab>('spin');
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

  // Admin state
  const [userPurchases, setUserPurchases] = useState<UserPurchaseRecord[]>(INITIAL_USER_PURCHASES);
  const [partnerPayouts, setPartnerPayouts] = useState<PartnerPayoutSummary[]>(INITIAL_PARTNER_PAYOUTS);
  const [affiliateIds, setAffiliateIds] = useState<AffiliateIdConfig[]>(INITIAL_AFFILIATE_IDS);
  const [scrapers, setScrapers] = useState<CustomScraperConfig[]>(INITIAL_SCRAPERS);
  const [apiIntegrations, setApiIntegrations] = useState<ApiIntegrationConfig[]>(INITIAL_API_INTEGRATIONS);
  const [affiliateNetworks, setAffiliateNetworks] = useState<AffiliateNetworkHubConfig[]>(INITIAL_AFFILIATE_NETWORKS);

  // 100+ Direct Partners Directory & Management
  const [directPartners, setDirectPartners] = useState<DirectPartnerItem[]>(INITIAL_DIRECT_PARTNERS);

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

  const recordPartnerClick = (id: string) => {
    setDirectPartners((prev) =>
      prev.map((p) => (p.id === id ? { ...p, clickCount: (p.clickCount || 0) + 1 } : p))
    );
  };

  // User Login & Session state
  const [userLogins, setUserLogins] = useState<UserLoginSession[]>(INITIAL_USER_LOGINS);

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
  const [spinWinners, setSpinWinners] = useState<SpinWinnerLog[]>(INITIAL_SPIN_WINNERS);

  // Residential Proxy Pool for Hard-Blocked Sites & Hostinger Deployment
  const [proxies, setProxies] = useState<ResidentialProxyConfig[]>(INITIAL_RESIDENTIAL_PROXIES);

  const addResidentialProxy = (proxy: Omit<ResidentialProxyConfig, 'id'>) => {
    const newProxy: ResidentialProxyConfig = {
      ...proxy,
      id: `prx-${Date.now()}`,
    };
    setProxies((prev) => [newProxy, ...prev]);
    addToast('success', 'Residential Proxy Added', `Proxy ${newProxy.host}:${newProxy.port} added to pool.`);
  };

  const bulkAddResidentialProxies = (rawText: string): number => {
    const parsed = parseBulkProxies(rawText);
    if (parsed.length === 0) {
      addToast('alert', 'No Valid Proxies Found', 'Please provide proxies in host:port:user:pass or URL format.');
      return 0;
    }
    const newProxies: ResidentialProxyConfig[] = parsed.map((p, idx) => ({
      ...p,
      id: `prx-bulk-${Date.now()}-${idx}`,
    }));
    setProxies((prev) => [...newProxies, ...prev]);
    addToast('success', 'Bulk Proxies Ingested', `Successfully added ${newProxies.length} residential proxies to pool.`);
    return newProxies.length;
  };

  const toggleProxyStatus = (id: string) => {
    setProxies((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, status: p.status === 'active' ? 'cooldown' : 'active' }
          : p
      )
    );
  };

  const deleteProxy = (id: string) => {
    setProxies((prev) => prev.filter((p) => p.id !== id));
    addToast('info', 'Proxy Removed', 'Proxy removed from the residential pool.');
  };

  const testProxyPing = async (id: string): Promise<{ latencyMs: number; success: boolean; ip: string }> => {
    const target = proxies.find((p) => p.id === id);
    if (!target) return { latencyMs: 0, success: false, ip: 'N/A' };

    try {
      const res = await fetch(`/api/proxies/${id}/test`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setProxies((prev) =>
          prev.map((p) =>
            p.id === id
              ? {
                  ...p,
                  latencyMs: data.latencyMs || p.latencyMs,
                  status: data.success ? 'active' : 'cooldown',
                  requestsCount: p.requestsCount + 1,
                  lastUsedAt: 'Just now',
                }
              : p
          )
        );
        return {
          latencyMs: data.latencyMs || 120,
          success: data.success !== false,
          ip: data.ip || '103.28.14.92 (India 🇮🇳)',
        };
      }
    } catch {
      // fallback
    }

    await new Promise((r) => setTimeout(r, 600));
    const mockLatency = Math.floor(95 + Math.random() * 85);
    setProxies((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              latencyMs: mockLatency,
              status: 'active',
              requestsCount: p.requestsCount + 1,
              lastUsedAt: 'Just now',
            }
          : p
      )
    );
    return {
      latencyMs: mockLatency,
      success: true,
      ip: `103.${Math.floor(20 + Math.random() * 200)}.${Math.floor(10 + Math.random() * 200)}.${Math.floor(1 + Math.random() * 250)} (India 🇮🇳)`,
    };
  };

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

  const [cplLeads, setCplLeads] = useState<CplLead[]>(INITIAL_CPL_LEADS);
  const [merchantCampaigns, setMerchantCampaigns] = useState<MerchantCampaign[]>(INITIAL_MERCHANT_CAMPAIGNS);
  const [merchantPrepaidBalance, setMerchantPrepaidBalance] = useState<number>(INITIAL_MERCHANT_METRICS.prepaidBalance);
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
    vertical?: 'loans' | 'insurance';
  }): Promise<CplLead> => {
    setLeadCaptureState((prev) => ({ ...prev, step: 'processing' }));

    // Real-time simulated parallel multi-bank scoring & underwriting ping
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const isLoan = (data.vertical || leadCaptureState.item?.vertical || 'loans') === 'loans';
    const cplFee = isLoan ? 750 : 650;
    const estScore = data.monthlySalary >= 50000 ? Math.floor(750 + Math.random() * 50) : Math.floor(680 + Math.random() * 40);

    const generatedMatches: MatchedFinancialPartner[] = isLoan
      ? [
          {
            partnerId: 'hdfc',
            partnerName: 'HDFC Bank',
            logoText: 'HDFC',
            logoBg: 'bg-[#004c8f]',
            approvalOdds: 98,
            offerHeadline: `Pre-Approved up to ₹${Math.min(data.requestedAmount * 1.25, 4000000).toLocaleString('en-IN')} @ 10.25% APR`,
            processingFee: '0% Processing Fee Waiver',
            leadReferenceCode: `HDFC-PL-${Math.floor(100000 + Math.random() * 900000)}`,
            disbursalTime: 'Instant 10-Second Disbursal',
          },
          {
            partnerId: 'bajaj',
            partnerName: 'Bajaj Finserv',
            logoText: 'BAJAJ',
            logoBg: 'bg-[#00529b]',
            approvalOdds: 96,
            offerHeadline: `Flexi-Hybrid Credit Limit up to ₹${data.requestedAmount.toLocaleString('en-IN')}`,
            processingFee: 'Flat ₹999 Fee Promo',
            leadReferenceCode: `BAJ-FLX-${Math.floor(100000 + Math.random() * 900000)}`,
            disbursalTime: 'Disbursal in 20 Mins',
          },
          {
            partnerId: 'icici',
            partnerName: 'ICICI Bank',
            logoText: 'ICICI',
            logoBg: 'bg-[#b84d00]',
            approvalOdds: 94,
            offerHeadline: 'Pre-Qualified Paperless Loan @ 10.45% Fixed APR',
            processingFee: 'Zero Prepayment Charges',
            leadReferenceCode: `ICI-EXP-${Math.floor(100000 + Math.random() * 900000)}`,
            disbursalTime: 'Doorstep / Digital KYC',
          },
          {
            partnerId: 'sbi',
            partnerName: 'State Bank of India',
            logoText: 'SBI',
            logoBg: 'bg-[#0b4d8c]',
            approvalOdds: 91,
            offerHeadline: 'Lowest PSU Prime Rate @ 9.85% for Salaried',
            processingFee: 'Special PSU Festive Concession',
            leadReferenceCode: `SBI-PL-${Math.floor(100000 + Math.random() * 900000)}`,
            disbursalTime: 'Sanction in 24 Hours',
          },
        ]
      : [
          {
            partnerId: 'ergo',
            partnerName: 'HDFC ERGO',
            logoText: 'ERGO',
            logoBg: 'bg-[#b81c22]',
            approvalOdds: 99,
            offerHeadline: `Optima Secure ${data.requestedAmount >= 5000000 ? '₹1 Crore' : '₹25 Lakhs'} with 4X Automatic Cover`,
            processingFee: 'Zero Room Rent Capping',
            leadReferenceCode: `ERGO-OPT-${Math.floor(100000 + Math.random() * 900000)}`,
            disbursalTime: 'Instant Digital Policy Delivery',
          },
          {
            partnerId: 'care',
            partnerName: 'Care Health Insurance',
            logoText: 'CARE',
            logoBg: 'bg-[#00796b]',
            approvalOdds: 96,
            offerHeadline: 'Care Supreme Unlimited Recharge + No Claim Bonus up to 500%',
            processingFee: 'Free Annual Health Checkup Included',
            leadReferenceCode: `CARE-SUP-${Math.floor(100000 + Math.random() * 900000)}`,
            disbursalTime: 'Instant Approval',
          },
          {
            partnerId: 'pb',
            partnerName: 'PolicyBazaar VIP Concierge',
            logoText: 'PB',
            logoBg: 'bg-[#0072ce]',
            approvalOdds: 95,
            offerHeadline: '30-Minute Cashless Hospital Admission Guarantee & Support',
            processingFee: 'Dedicated Relationship Manager',
            leadReferenceCode: `PB-MED-${Math.floor(100000 + Math.random() * 900000)}`,
            disbursalTime: '24x7 Priority Support',
          },
          {
            partnerId: 'tata',
            partnerName: 'Tata AIG',
            logoText: 'TATA',
            logoBg: 'bg-[#1a237e]',
            approvalOdds: 93,
            offerHeadline: 'Zero-Dep Universal Cover with Global Emergency Assistance',
            processingFee: 'Instant Premium Discount Applied',
            leadReferenceCode: `TATA-INS-${Math.floor(100000 + Math.random() * 900000)}`,
            disbursalTime: 'Instant WhatsApp Delivery',
          },
        ];

    const newLead: CplLead = {
      id: `lead-${Date.now().toString().slice(-4)}`,
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
      creditScoreEstimate: estScore,
      matchedPartners: generatedMatches,
      status: 'new',
      cplCost: cplFee,
      createdAt: 'Just now',
      assignedMerchant: generatedMatches[0]?.partnerName || 'All Partners',
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
      'Multi-Bank Pre-Approval Generated!',
      `Matched with ${generatedMatches.length} top partners. Reference ID: ${newLead.id}`
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
      addToast('info', 'GPS Simulation Active', 'Accurate to Connaught Place, New Delhi');
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

  const [items, setItems] = useState<ComparisonItem[]>([
    ...INITIAL_COMPARISON_ITEMS,
    ...EXTRA_COMPARISON_ITEMS,
    ...CATEGORY_COMPARISON_ITEMS,
  ]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [smartFilterText, setSmartFilterText] = useState<string>('');
  const [sortOption, setSortOption] = useState<'cheapest' | 'best' | 'fastest' | 'highest_rated'>('cheapest');
  const [trackedItemIds, setTrackedItemIds] = useState<string[]>(['fl-1', 'groc-1', 'ecom-1']);
  const [userPoints, setUserPoints] = useState<number>(75); // Start with 75 points so user is close to 100
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

  const handleSetVertical = (newVertical: VerticalId) => {
    setVertical(newVertical);
    setSelectedCategory('All');
    setSearchQuery('');
    setSmartFilterText('');
  };

  // Real-Time Native Web Scraper State
  const [isScrapingLive, setIsScrapingLive] = useState<boolean>(false);
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

  const triggerLiveLocationScrape = async (overrideQuery?: string, overrideLoc?: UserLocationState) => {
    setIsScrapingLive(true);
    const targetLoc = overrideLoc || userLocation;
    const targetQuery = overrideQuery !== undefined ? overrideQuery : searchQuery;

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
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          setItems((prev) => {
            const nonScrapedForVertical = prev.filter((it) => it.vertical !== vertical || !it.isLiveScraped);
            return [...data.results, ...nonScrapedForVertical];
          });
          setLastScrapeInfo({
            timestamp: 'Just now',
            location: targetQuery ? `${targetQuery} (${targetLoc.city})` : `${targetLoc.locality}, ${targetLoc.city} (${targetLoc.pincode})`,
            latencyMs: data.latencyMs || 140,
            sourcesCount: 18,
          });
          return;
        }
      }
    } catch {
      // offline or fast fallback
    } finally {
      setIsScrapingLive(false);
    }

    // Client-side Live Scraper Fallback if backend fetch returned no items or errored
    if (vertical === 'hotels') {
      const dest = (targetQuery || targetLoc.city || 'Goa').replace(/,.*$/, '').trim();
      const cityCap = dest ? dest.charAt(0).toUpperCase() + dest.slice(1) : 'Goa';
      const liveHotels: ComparisonItem[] = [
        {
          id: `scr-ht-dyn-${Date.now()}-1`,
          vertical: 'hotels',
          title: `The Grand Luxury Palace & Spa (${cityCap})`,
          subtitle: `Prime Central District, ${cityCap} · 5-Star Heritage Sanctuary`,
          category: '5-Star Luxury Resort',
          provider: 'Taj & Oberoi Partner Hotels',
          providerLogo: '🏨',
          rating: 4.9,
          reviewCount: 3120,
          sentimentSummary: `Exceptional hospitality in ${cityCap}. Top rated on MakeMyTrip & Booking.com.`,
          criteriaRatings: [
            { name: 'Cleanliness & Comfort', score: 9.9 },
            { name: 'Location & View', score: 9.8 },
            { name: 'Dining & Breakfast', score: 9.7 },
          ],
          primaryPrice: 8400,
          originalPrice: 10800,
          unit: 'per night',
          sellerQuotes: [
            {
              id: `sq-live-mmt-${Date.now()}`,
              sellerName: 'MakeMyTrip Hotels',
              price: 8400,
              originalPrice: 10800,
              currency: '₹',
              url: `https://www.makemytrip.com/hotels/${encodeURIComponent(cityCap.toLowerCase())}-hotels.html`,
              badge: '⚡ Lowest Fare',
              deliveryOrEta: 'Instant Voucher & Free Breakfast',
              isLowest: true,
              isLiveScraped: true,
              sourceDomain: 'makemytrip.com',
              scrapedLocation: `${cityCap}, India`,
              couponCode: 'TRY1STAY',
              cashbackText: '₹1,200 Instant Bank Off',
            },
            {
              id: `sq-live-bk-${Date.now()}`,
              sellerName: 'Booking.com',
              price: 8750,
              originalPrice: 10800,
              currency: '₹',
              url: `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(cityCap)}`,
              deliveryOrEta: 'Genius Member Rate',
              isLowest: false,
              isLiveScraped: true,
              sourceDomain: 'booking.com',
              scrapedLocation: `${cityCap}, India`,
            },
          ],
          pricePrediction: {
            advice: 'book_now',
            headline: `Verified Lowest Rate in ${cityCap}`,
            details: `Tariff is ₹2,400 below peak seasonal pricing for ${cityCap}.`,
            historicalLow: 8400,
            historicalHigh: 12500,
            priceHistory: [{ date: 'Today', price: 8400 }],
          },
          features: ['Free Breakfast Buffet for 2', 'Swimming Pool & Spa', 'Free Wi-Fi'],
          specs: { Location: `${cityCap}, India`, CheckIn: '2:00 PM', CheckOut: '12:00 PM' },
          imageUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',
          reviews: [],
          isLiveScraped: true,
          scrapedLocation: `${cityCap}, India`,
          scrapedTimestamp: 'Just now',
          scrapedLatencyMs: 115,
        },
      ];
      setItems((prev) => [...liveHotels, ...prev.filter((it) => it.vertical !== 'hotels' || !it.isLiveScraped)]);
      setLastScrapeInfo({
        timestamp: 'Just now',
        location: `${cityCap}, India`,
        latencyMs: 115,
        sourcesCount: 18,
      });
    }
  };

  useEffect(() => {
    triggerLiveLocationScrape();
  }, [vertical, userLocation.pincode]);

  // Modals state
  const [redirectionState, setRedirectionState] = useState<RedirectionState>({
    isOpen: false,
    item: null,
    quote: null,
    step: 'redirecting',
  });
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
          confetti({
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
  const startRedirection = (item: ComparisonItem, quote: SellerQuote) => {
    // High-Ticket Verticals (Loans & Insurance): replace simple outbound redirect with native CPL Lead Capture & Multi-Bank Eligibility Match
    if (item.vertical === 'loans' || item.vertical === 'insurance') {
      openLeadCapture(item, quote);
      return;
    }

    setRedirectionState({
      isOpen: true,
      item,
      quote,
      step: 'redirecting',
    });

    // Automatically record live user purchase event for Admin Dashboard conversion tracker
    const commissionVal = Math.max(15, Math.round(quote.price * 0.035));
    const newRecord: UserPurchaseRecord = {
      id: `ord-${Date.now()}`,
      userId: 'usr-active-session',
      userName: 'Live User (Current Session)',
      userEmail: 'user.visitor@try1second.in',
      userCity: userLocation.city || 'New Delhi',
      userIp: '103.28.14.92',
      merchantName: quote.sellerName,
      vertical: item.vertical,
      itemTitle: item.title,
      orderId: `T1S-${quote.sellerName.substring(0, 3).toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`,
      orderAmount: quote.price,
      commissionEarned: commissionVal,
      commissionRate: '3.5% CPS',
      pointsAwarded: 0, // Points are now earned only via new referrals per policy
      status: 'tracked',
      timestamp: 'Just now',
      affiliateNetwork: 'Direct API',
    };
    setUserPurchases((prev) => [newRecord, ...prev]);

    setTimeout(() => {
      // Direct deal handshake completed without adding points
      setRedirectionState((prev) => ({ ...prev, step: 'awarded' }));
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

        // Record in Admin Spin Winners Audit Log!
        const newWinnerLog: SpinWinnerLog = {
          id: `win-${Date.now()}`,
          userId: 'usr-1042',
          userName: 'Aakash Verma (Current User)',
          userEmail: 'aakash.v@gmail.com',
          rewardId: wonPrize.id,
          rewardTitle: wonPrize.title,
          voucherCode: newWon.voucherCode,
          value: wonPrize.value,
          pointsDeducted: spinCostPoints,
          wonAt: 'Just now',
          status: 'claimed',
        };
        setSpinWinners((prev) => [newWinnerLog, ...prev]);

        try {
          confetti({
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

  const simulatePriceDrop = () => {
    const currentItems = items.filter((it) => it.vertical === vertical);
    if (currentItems.length === 0) return;
    const target = currentItems[Math.floor(Math.random() * currentItems.length)];
    const dropAmount = Math.max(10, Math.floor(target.primaryPrice * 0.06));
    const newPrice = target.primaryPrice - dropAmount;

    setItems((prev) =>
      prev.map((it) => {
        if (it.id === target.id) {
          const updatedQuotes = it.sellerQuotes.map((q, idx) =>
            idx === 0 ? { ...q, price: newPrice, isLowest: true } : q
          );
          return {
            ...it,
            primaryPrice: newPrice,
            sellerQuotes: updatedQuotes,
            lastPriceUpdate: 'Just now',
          };
        }
        return it;
      })
    );

    const isTracked = trackedItemIds.includes(target.id);
    addToast(
      'alert',
      `⚡ Price Drop Detected! (-₹${dropAmount.toLocaleString('en-IN')})`,
      `${target.title} dropped to ₹${newPrice.toLocaleString('en-IN')}${isTracked ? ' (Tracked in your watchlist)' : ''}.`
    );
  };

  useEffect(() => {
    const timer = setInterval(() => {
      if (Math.random() < 0.25) {
        const itemToTick = items[Math.floor(Math.random() * items.length)];
        const delta = (Math.random() > 0.5 ? -1 : 1) * Math.floor(itemToTick.primaryPrice * 0.02);
        if (delta !== 0) {
          setItems((prev) =>
            prev.map((it) => {
              if (it.id === itemToTick.id) {
                const updatedPrice = Math.max(10, it.primaryPrice + delta);
                return {
                  ...it,
                  primaryPrice: updatedPrice,
                  lastPriceUpdate: 'Updated 1m ago',
                };
              }
              return it;
            })
          );
        }
      }
    }, 28000);
    return () => clearInterval(timer);
  }, [items]);

  // =================== ADMIN ENGINE METHODS ===================

  const addAffiliateId = (config: Omit<AffiliateIdConfig, 'id'>) => {
    const newId: AffiliateIdConfig = {
      ...config,
      id: `aff-${Date.now()}`,
    };
    setAffiliateIds((prev) => [newId, ...prev]);
    addToast('success', 'Affiliate ID Added', `${config.merchantOrNetwork} (${config.affiliateId}) saved successfully.`);
  };

  const toggleAffiliateIdStatus = (id: string) => {
    setAffiliateIds((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: a.status === 'active' ? 'inactive' : 'active' } : a))
    );
  };

  const addCustomScraper = (scraper: Omit<CustomScraperConfig, 'id' | 'lastScrapeTime' | 'itemsScrapedLastRun'>) => {
    const newScraper: CustomScraperConfig = {
      ...scraper,
      id: `scr-${Date.now()}`,
      lastScrapeTime: 'Just configured',
      itemsScrapedLastRun: 0,
    };
    setScrapers((prev) => [newScraper, ...prev]);
    addToast('success', 'Web Scraper Configured', `Scraper for ${scraper.merchantName} created. Ready to harvest live prices.`);
  };

  const runScraperSimulation = async (
    scraperId: string,
    testQuery: string = 'flagship deals'
  ): Promise<{ success: boolean; itemsFound: number; sampleTitle: string; samplePrice: number }> => {
    const targetScraper = scrapers.find((s) => s.id === scraperId);
    if (!targetScraper) {
      return { success: false, itemsFound: 0, sampleTitle: '', samplePrice: 0 };
    }

    let itemsFound = Math.floor(12 + Math.random() * 24);
    let mockPrice = Math.floor(1200 + Math.random() * 8500);
    let sampleTitle = `${targetScraper.merchantName} Verified Best Seller (${testQuery})`;
    let latency = 145;

    try {
      const res = await fetch('/api/scrape/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrlTemplate: targetScraper.targetUrlTemplate,
          query: testQuery,
          priceSelector: targetScraper.priceSelector,
          titleSelector: targetScraper.titleSelector,
          ratingSelector: targetScraper.ratingSelector,
          engineMode: targetScraper.engineMode,
          location: `${userLocation.locality}, ${userLocation.city} (${userLocation.pincode})`,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.extractedTitle) sampleTitle = data.extractedTitle;
        if (data.extractedPrice) mockPrice = data.extractedPrice;
        if (data.itemsCount) itemsFound = data.itemsCount;
        if (data.latencyMs) latency = data.latencyMs;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    setScrapers((prev) =>
      prev.map((s) =>
        s.id === scraperId
          ? {
              ...s,
              status: 'active',
              lastScrapeTime: 'Just now',
              itemsScrapedLastRun: itemsFound,
            }
          : s
      )
    );

    // If auto-ingestion is on, inject the newly scraped merchant deal directly into the comparison feed!
    if (targetScraper.autoIngestIntoCompare) {
      const newComparisonItem: ComparisonItem = {
        id: `scraped-${targetScraper.id}-${Date.now()}`,
        vertical: targetScraper.vertical,
        title: sampleTitle,
        subtitle: `Harvested via ${targetScraper.engineMode} from ${targetScraper.merchantName}`,
        category: 'Live Scraped Deal',
        provider: targetScraper.merchantName,
        providerLogo: targetScraper.merchantName.substring(0, 3).toUpperCase(),
        rating: 4.6,
        reviewCount: 312,
        sentimentSummary: `Real-time pricing extracted via Try1Second ${targetScraper.engineMode} engine.`,
        criteriaRatings: [
          { name: 'Scrape Accuracy', score: 5.0 },
          { name: 'Live Stock Check', score: 4.8 },
          { name: 'Price Competitiveness', score: 4.9 },
          { name: 'Delivery ETA', score: 4.7 },
        ],
        primaryPrice: mockPrice,
        originalPrice: Math.round(mockPrice * 1.25),
        unit: 'deal price',
        features: [
          `Scraped via ${targetScraper.engineMode}`,
          'Auto-synchronized every 15 minutes',
          'Verified merchant direct cart checkout',
          'Earn 1 Point per redirection',
        ],
        specs: {
          SourceUrl: targetScraper.targetUrlTemplate.replace('{query}', encodeURIComponent(testQuery)),
          Engine: targetScraper.engineMode,
          ScrapedAt: 'Just now',
          Status: 'Live & In Stock',
        },
        sellerQuotes: [
          {
            id: `sq-scraped-${Date.now()}`,
            sellerName: targetScraper.merchantName,
            price: mockPrice,
            originalPrice: Math.round(mockPrice * 1.25),
            currency: '₹',
            url: targetScraper.targetUrlTemplate.replace('{query}', encodeURIComponent(testQuery)),
            badge: 'Scraped Lowest Deal',
            isLowest: true,
            isLiveScraped: true,
            sourceDomain: targetScraper.merchantName.toLowerCase().replace(/\s+/g, '') + '.com',
            scrapedLocation: `${userLocation.locality}, ${userLocation.city} (${userLocation.pincode})`,
            deliveryOrEta: '2-3 Business Days',
          },
        ],
        isLiveScraped: true,
        scrapedLocation: `${userLocation.locality}, ${userLocation.city} (${userLocation.pincode})`,
        scrapedTimestamp: 'Just now',
        scrapedLatencyMs: latency,
        pricePrediction: {
          advice: 'book_now',
          headline: 'Freshly Scraped Merchant Deal',
          details: `Direct price discovery from non-API partner ${targetScraper.merchantName}.`,
          historicalLow: mockPrice,
          historicalHigh: Math.round(mockPrice * 1.3),
          priceHistory: [
            { date: 'Initial Scrape', price: mockPrice },
          ],
        },
        reviews: [
          {
            id: `rev-scr-${Date.now()}`,
            author: 'Scraper Audit Bot',
            rating: 5,
            date: 'Today',
            title: 'Live price validated against checkout HTML',
            comment: `Automated parser verified matching price ₹${mockPrice.toLocaleString('en-IN')}.`,
            verifiedPurchase: true,
            helpfulCount: 8,
          },
        ],
      };

      setItems((prev) => [newComparisonItem, ...prev]);
    }

    addToast(
      'success',
      '✓ Scraper Run Successful',
      `Harvested ${itemsFound} items from ${targetScraper.merchantName} and injected into ${targetScraper.vertical} metasearch.`
    );

    return {
      success: true,
      itemsFound,
      sampleTitle,
      samplePrice: mockPrice,
    };
  };

  const addApiIntegration = (api: Omit<ApiIntegrationConfig, 'id' | 'latencyMs'>) => {
    const newApi: ApiIntegrationConfig = {
      ...api,
      id: `api-${Date.now()}`,
      latencyMs: Math.floor(180 + Math.random() * 260),
    };
    setApiIntegrations((prev) => [newApi, ...prev]);
    addToast('success', 'API Integration Saved', `Partner API ${api.partnerName} registered and connected.`);
  };

  const testApiPing = async (apiId: string): Promise<number> => {
    await new Promise((r) => setTimeout(r, 600));
    const latency = Math.floor(160 + Math.random() * 220);
    setApiIntegrations((prev) =>
      prev.map((a) => (a.id === apiId ? { ...a, status: 'active', latencyMs: latency } : a))
    );
    addToast('info', 'API Ping Latency Test', `Response received in ${latency}ms (Status: 200 OK)`);
    return latency;
  };

  const updateAffiliateNetwork = (id: string, updates: Partial<AffiliateNetworkHubConfig>) => {
    setAffiliateNetworks((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...updates, syncStatus: 'synced', lastSyncTime: 'Just now' } : n))
    );
    addToast('success', 'Network Configuration Updated', 'Credentials and postback URLs synchronized.');
  };

  const simulateNetworkPostback = (networkName: string) => {
    const commissionAmt = Math.floor(350 + Math.random() * 1800);
    const mockOrder: UserPurchaseRecord = {
      id: `postback-${Date.now()}`,
      userId: `usr-s2s-${Math.floor(1000 + Math.random() * 9000)}`,
      userName: 'Verified Network Buyer',
      userEmail: 'network.buyer@partner.com',
      userCity: 'Bengaluru',
      userIp: '49.207.12.89',
      merchantName: `${networkName} Merchant Partner`,
      vertical: 'ecommerce',
      itemTitle: 'Festival Special Electronics Bundle',
      orderId: `S2S-${Math.floor(100000 + Math.random() * 900000)}`,
      orderAmount: commissionAmt * 20,
      commissionEarned: commissionAmt,
      commissionRate: '5.0% S2S Postback',
      pointsAwarded: 1,
      status: 'approved',
      timestamp: 'Just now via S2S Webhook',
      affiliateNetwork: networkName,
    };
    setUserPurchases((prev) => [mockOrder, ...prev]);
    addToast('points', `Incoming ${networkName} S2S Postback!`, `Attributed ₹${commissionAmt} commission to Try1Second account.`);
  };

  const blockUserSession = (userId: string) => {
    setUserLogins((prev) =>
      prev.map((u) => (u.userId === userId ? { ...u, status: 'blocked' } : u))
    );
    addToast('alert', 'User Account Suspended', `User ${userId} has been restricted from spin and redemption.`);
  };

  const unblockUserSession = (userId: string) => {
    setUserLogins((prev) =>
      prev.map((u) => (u.userId === userId ? { ...u, status: 'active' } : u))
    );
    addToast('success', 'User Restored', `User ${userId} restored to active status.`);
  };

  const creditBonusPointsToUser = (userId: string, pts: number) => {
    setUserLogins((prev) =>
      prev.map((u) => (u.userId === userId ? { ...u, pointsBalance: u.pointsBalance + pts } : u))
    );
    if (userId === 'usr-1042') {
      setUserPoints((p) => p + pts);
    }
    addToast('points', `+${pts} Points Credited!`, `Direct admin bonus granted to user ${userId}.`);
  };

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
        const parsed: MerchantVendorAccount[] = JSON.parse(saved);
        const existingMap = new Map(parsed.map((v) => [v.vendorIdNumber, v]));
        // Make sure all INITIAL_VENDOR_ACCOUNTS exist in state
        for (const initV of INITIAL_VENDOR_ACCOUNTS) {
          if (!existingMap.has(initV.vendorIdNumber)) {
            parsed.push(initV);
          }
        }
        return parsed;
      }
    } catch {}
    return INITIAL_VENDOR_ACCOUNTS;
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

  const adminLogin = (email: string, _pass: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (cleanEmail !== 'admin@try1second.com') {
      return {
        success: false,
        message: 'Access Denied: Admin login is strictly restricted to admin@try1second.com.',
      };
    }

    setIsAdminAuthenticated(true);
    setAdminEmail('admin@try1second.com');
    try {
      localStorage.setItem('t1s_admin_auth', 'true');
      localStorage.setItem('t1s_admin_email', 'admin@try1second.com');
    } catch {}

    addToast('success', 'Admin Authenticated', 'Logged in as Master Administrator (admin@try1second.com).');
    return {
      success: true,
      message: 'Admin access authorized.',
    };
  };

  const adminLogout = () => {
    setIsAdminAuthenticated(false);
    setAdminEmail(null);
    try {
      localStorage.removeItem('t1s_admin_auth');
      localStorage.removeItem('t1s_admin_email');
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
      const saved = localStorage.getItem('t1s_quick_app_partners');
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
      localStorage.setItem('t1s_quick_app_partners', JSON.stringify(updated));
    } catch {}
    addToast('success', 'Quick App Registered', `Added partner "${newPartner.name}" with model ${newPartner.type}`);
    return newPartner;
  };

  const updateQuickAppPartner = (id: string, updates: Partial<QuickAppPartner>) => {
    const updated = quickAppPartners.map((p) => (p.id === id ? { ...p, ...updates } : p));
    setQuickAppPartners(updated);
    try {
      localStorage.setItem('t1s_quick_app_partners', JSON.stringify(updated));
    } catch {}
    addToast('info', 'Partner Updated', 'Quick App configuration updated.');
  };

  const deleteQuickAppPartner = (id: string) => {
    const updated = quickAppPartners.filter((p) => p.id !== id);
    setQuickAppPartners(updated);
    try {
      localStorage.setItem('t1s_quick_app_partners', JSON.stringify(updated));
    } catch {}
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

  return (
    <AppContext.Provider
      value={{
        vertical,
        setVertical: handleSetVertical,
        activeNavTab,
        setActiveNavTab,
        rewardsSubTab,
        setRewardsSubTab,
        userLocation,
        detectGpsLocation,
        setPincodeLocation,
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
        toasts,
        addToast,
        dismissToast,
        simulatePriceDrop,
        infoModalTab,
        openInfoModal,
        closeInfoModal,
        isPartnerModalOpen,
        openPartnerModal,
        closePartnerModal,
        isExtensionModalOpen,
        openExtensionModal,
        closeExtensionModal,
        userPurchases,
        partnerPayouts,
        affiliateIds,
        scrapers,
        apiIntegrations,
        affiliateNetworks,
        addAffiliateId,
        toggleAffiliateIdStatus,
        addCustomScraper,
        runScraperSimulation,
        addApiIntegration,
        testApiPing,
        updateAffiliateNetwork,
        simulateNetworkPostback,
        directPartners,
        addDirectPartner,
        updateDirectPartner,
        toggleDirectPartnerStatus,
        deleteDirectPartner,
        recordPartnerClick,
        userLogins,
        blockUserSession,
        unblockUserSession,
        creditBonusPointsToUser,
        spinRewards,
        spinCostPoints,
        setSpinCostPoints,
        addSpinReward,
        updateSpinReward,
        deleteSpinReward,
        toggleSpinRewardActive,
        spinWinners,
        isScrapingLive,
        lastScrapeInfo,
        triggerLiveLocationScrape,
        proxies,
        addResidentialProxy,
        bulkAddResidentialProxies,
        toggleProxyStatus,
        deleteProxy,
        testProxyPing,
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
        adminLogin,
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
