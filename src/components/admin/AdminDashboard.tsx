import React, { useState } from 'react';
import {
  Users,
  DollarSign,
  TrendingUp,
  Tag,
  Globe,
  Code2,
  Terminal,
  ShieldCheck,
  Zap,
  ArrowLeft,
  Search,
  Filter,
  Plus,
  Play,
  RotateCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  Sparkles,
  Link as LinkIcon,
  Server,
  Activity,
  ChevronRight,
  Database,
  Gift,
  UserCheck,
  Handshake,
  Building2,
  KeyRound,
  LogOut,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  VerticalId,
  AffiliateIdConfig,
  CustomScraperConfig,
  ApiIntegrationConfig,
  AffiliateNetworkHubConfig,
} from '../../types';
import { Try1SecondLogo } from '../Try1SecondLogo';
import { UserLoginsTab } from './UserLoginsTab';
import { SpinEarnManagementTab } from './SpinEarnManagementTab';
import { ResidentialProxyTab } from './ResidentialProxyTab';
import { DirectPartnersTab } from './DirectPartnersTab';
import { MerchantVendorIdsTab } from './MerchantVendorIdsTab';
import { PlatformTrafficTab } from './PlatformTrafficTab';
import { QuickAppsAdminTab } from './QuickAppsAdminTab';

export type AdminTab =
  | 'traffic_performance'
  | 'quick_apps'
  | 'merchant_vendors'
  | 'purchases'
  | 'payouts'
  | 'affiliate_ids'
  | 'scrapers'
  | 'apis'
  | 'networks'
  | 'user_logins'
  | 'spin_earn'
  | 'proxies'
  | 'direct_partners';

export const AdminDashboard: React.FC = () => {
  const {
    setActiveNavTab,
    navigateToSecretRoute,
    isAdminAuthenticated,
    adminEmail,
    adminLogout,
    quickAppPartners,
    vendorAccounts,
    userPurchases,
    partnerPayouts,
    affiliateIds,
    scrapers,
    apiIntegrations,
    affiliateNetworks,
    userLogins,
    spinRewards,
    proxies,
    directPartners,
    addAffiliateId,
    toggleAffiliateIdStatus,
    addCustomScraper,
    runScraperSimulation,
    addApiIntegration,
    testApiPing,
    updateAffiliateNetwork,
    simulateNetworkPostback,
  } = useApp();

  const [activeTab, setActiveTab] = useState<AdminTab>('traffic_performance');
  const [purchaseFilterVertical, setPurchaseFilterVertical] = useState<string>('all');
  const [purchaseSearchQuery, setPurchaseSearchQuery] = useState<string>('');

  // Modals & form state
  const [isAddAffiliateOpen, setIsAddAffiliateOpen] = useState<boolean>(false);
  const [newAffiliateForm, setNewAffiliateForm] = useState({
    merchantOrNetwork: '',
    vertical: 'ecommerce' as VerticalId,
    affiliateId: '',
    subIdParam: 'subid={userId}',
    trackingDomain: 'https://',
    notes: '',
  });

  const [isAddScraperOpen, setIsAddScraperOpen] = useState<boolean>(false);
  const [newScraperForm, setNewScraperForm] = useState({
    merchantName: '',
    vertical: 'ecommerce' as VerticalId,
    targetUrlTemplate: 'https://example.com/search?q={query}',
    priceSelector: '.price, [data-price]',
    titleSelector: 'h1.title, .product-title',
    ratingSelector: '.rating-stars, [data-rating]',
    etaSelector: '.delivery-eta',
    engineMode: 'headless_puppeteer' as CustomScraperConfig['engineMode'],
    autoIngestIntoCompare: true,
  });

  const [isAddApiOpen, setIsAddApiOpen] = useState<boolean>(false);
  const [newApiForm, setNewApiForm] = useState({
    partnerName: '',
    vertical: 'flights' as VerticalId,
    endpointUrl: 'https://api.partner.com/v1/search',
    httpMethod: 'POST' as 'GET' | 'POST',
    authType: 'bearer' as ApiIntegrationConfig['authType'],
    authToken: '',
    priceField: 'data.results[].price',
    titleField: 'data.results[].title',
    ratingField: 'data.results[].rating',
    deeplinkField: 'data.results[].deeplink',
    rateLimit: '300 req / min',
  });

  // Scraper Test Runner State
  const [runningScraperId, setRunningScraperId] = useState<string | null>(null);
  const [scraperTestQuery, setScraperTestQuery] = useState<string>('Sony Headphones');
  const [scraperLogs, setScraperLogs] = useState<string[]>([]);

  // Link Generator Tool State
  const [testLinkInput, setTestLinkInput] = useState<string>('https://www.makemytrip.com/flights/delhi-dubai');
  const [generatedLinkResult, setGeneratedLinkResult] = useState<string>('');

  // KPI Calculations
  const totalGMV = userPurchases.reduce((sum, p) => sum + p.orderAmount, 0);
  const totalCommission = userPurchases.reduce((sum, p) => sum + p.commissionEarned, 0);
  const totalPendingPayout = partnerPayouts.reduce((sum, p) => sum + p.pendingPayout, 0);

  // Filtered Purchases
  const filteredPurchases = userPurchases.filter((p) => {
    const matchesVertical =
      purchaseFilterVertical === 'all' || p.vertical === purchaseFilterVertical;
    const matchesQuery =
      !purchaseSearchQuery.trim() ||
      p.userName.toLowerCase().includes(purchaseSearchQuery.toLowerCase()) ||
      p.userEmail.toLowerCase().includes(purchaseSearchQuery.toLowerCase()) ||
      p.merchantName.toLowerCase().includes(purchaseSearchQuery.toLowerCase()) ||
      p.orderId.toLowerCase().includes(purchaseSearchQuery.toLowerCase()) ||
      p.itemTitle.toLowerCase().includes(purchaseSearchQuery.toLowerCase()) ||
      p.userCity.toLowerCase().includes(purchaseSearchQuery.toLowerCase());
    return matchesVertical && matchesQuery;
  });

  const handleCreateAffiliateId = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAffiliateForm.merchantOrNetwork || !newAffiliateForm.affiliateId) return;
    addAffiliateId({
      ...newAffiliateForm,
      status: 'active',
    });
    setIsAddAffiliateOpen(false);
    setNewAffiliateForm({
      merchantOrNetwork: '',
      vertical: 'ecommerce',
      affiliateId: '',
      subIdParam: 'subid={userId}',
      trackingDomain: 'https://',
      notes: '',
    });
  };

  const handleCreateScraper = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScraperForm.merchantName || !newScraperForm.targetUrlTemplate) return;
    addCustomScraper({
      ...newScraperForm,
      status: 'active',
    });
    setIsAddScraperOpen(false);
    setNewScraperForm({
      merchantName: '',
      vertical: 'ecommerce',
      targetUrlTemplate: 'https://example.com/search?q={query}',
      priceSelector: '.price, [data-price]',
      titleSelector: 'h1.title, .product-title',
      ratingSelector: '.rating-stars, [data-rating]',
      etaSelector: '.delivery-eta',
      engineMode: 'headless_puppeteer',
      autoIngestIntoCompare: true,
    });
  };

  const handleCreateApi = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newApiForm.partnerName || !newApiForm.endpointUrl) return;
    addApiIntegration({
      partnerName: newApiForm.partnerName,
      vertical: newApiForm.vertical,
      endpointUrl: newApiForm.endpointUrl,
      httpMethod: newApiForm.httpMethod,
      authType: newApiForm.authType,
      authToken: newApiForm.authToken,
      responseMapping: {
        priceField: newApiForm.priceField,
        titleField: newApiForm.titleField,
        ratingField: newApiForm.ratingField,
        deeplinkField: newApiForm.deeplinkField,
      },
      rateLimit: newApiForm.rateLimit,
      status: 'active',
    });
    setIsAddApiOpen(false);
  };

  const handleExecuteScrape = async (scraperId: string) => {
    setRunningScraperId(scraperId);
    setScraperLogs([
      `[${new Date().toLocaleTimeString()}] Initializing Try1Second Scraper Sandbox...`,
      `[${new Date().toLocaleTimeString()}] Target template query: "${scraperTestQuery}"`,
      `[${new Date().toLocaleTimeString()}] Launching stealth browser headless context...`,
      `[${new Date().toLocaleTimeString()}] Evaluating DOM price, title & rating selectors...`,
    ]);

    const res = await runScraperSimulation(scraperId, scraperTestQuery);

    setScraperLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] Status: 200 OK · Extracted ${res.itemsFound} items!`,
      `[${new Date().toLocaleTimeString()}] Sample extracted deal: "${res.sampleTitle}" @ ₹${res.samplePrice}`,
      `[${new Date().toLocaleTimeString()}] Deal auto-injected into Try1Second metasearch engine feed!`,
    ]);
    setRunningScraperId(null);
  };

  const handleGenerateLink = () => {
    const matchingAff = affiliateIds[0];
    const generated = `${testLinkInput}?aff_id=${matchingAff?.affiliateId || 'TRY1_PROD'}&subid=usr_${Date.now()}&source=try1second_metasearch`;
    setGeneratedLinkResult(generated);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 font-sans">
      {/* Top Admin Header Bar (White Theme) */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigateToSecretRoute('/')}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold border border-slate-200"
              title="Return to Customer Storefront"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Storefront</span>
            </button>
            <div className="h-5 w-px bg-slate-200 hidden sm:block" />
            <div className="flex items-center gap-2">
              <Try1SecondLogo size="sm" />
              <span className="px-2.5 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-700 font-mono text-[10px] font-bold uppercase tracking-wider">
                Admin Control Center
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            {/* Authenticated Admin Identity */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-xl text-orange-800 font-mono font-bold">
              <ShieldCheck className="w-3.5 h-3.5 text-orange-600" />
              <span>{adminEmail || 'admin@try1second.com'}</span>
            </div>

            <button
              type="button"
              onClick={() => navigateToSecretRoute('/merchantinstab2b')}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold cursor-pointer flex items-center gap-1.5 shadow-sm transition-all"
              title="Open Merchant B2B Portal (try1second.com/merchantinstab2b)"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Merchant B2B Portal</span>
            </button>

            <button
              type="button"
              onClick={() => simulateNetworkPostback('Admitad')}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-xl border border-slate-200 text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-colors"
            >
              <Zap className="w-3.5 h-3.5 text-orange-600" />
              <span>Simulate S2S Postback</span>
            </button>

            {/* Admin Logout Button */}
            <button
              type="button"
              onClick={adminLogout}
              className="p-2 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 hover:border-rose-200 rounded-xl transition-all border border-slate-200 cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
              title="Log out of Super Administrator session"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs (White Theme) */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1 overflow-x-auto scrollbar-none border-t border-slate-100 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('traffic_performance')}
            className={`py-3 px-3.5 border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'traffic_performance'
                ? 'border-emerald-600 text-emerald-700 font-bold bg-emerald-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Activity className="w-4 h-4 text-emerald-600" />
            <span>Platform Traffic & Campaigns</span>
            <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-[10px] text-emerald-800 font-bold">
              12M Analytics
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('quick_apps')}
            className={`py-3 px-3.5 border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'quick_apps'
                ? 'border-red-600 text-red-700 font-bold bg-red-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Zap className="w-4 h-4 text-red-600 fill-red-500" />
            <span>Quick Apps & Deep Links</span>
            <span className="px-1.5 py-0.2 rounded-full bg-red-100 text-[10px] text-red-800 font-mono font-bold">
              {quickAppPartners.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('merchant_vendors')}
            className={`py-3 px-3.5 border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'merchant_vendors'
                ? 'border-blue-600 text-blue-700 font-bold bg-blue-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <KeyRound className="w-4 h-4 text-blue-600" />
            <span>Merchant 10-Digit IDs</span>
            <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-[10px] text-blue-800 font-mono font-bold">
              {vendorAccounts.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('purchases')}
            className={`py-3 px-3.5 border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'purchases'
                ? 'border-orange-600 text-orange-600 font-bold bg-orange-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>User Purchases & Tracking</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-[10px] text-slate-700">
              {userPurchases.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('payouts')}
            className={`py-3 px-3.5 border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'payouts'
                ? 'border-orange-600 text-orange-600 font-bold bg-orange-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Partner Payouts & Rates</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-[10px] text-slate-700">
              {partnerPayouts.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('affiliate_ids')}
            className={`py-3 px-3.5 border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'affiliate_ids'
                ? 'border-orange-600 text-orange-600 font-bold bg-orange-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>Affiliate IDs & Tokens</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-[10px] text-slate-700">
              {affiliateIds.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('scrapers')}
            className={`py-3 px-3.5 border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'scrapers'
                ? 'border-orange-600 text-orange-600 font-bold bg-orange-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Dynamic Web Scrapers</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-[10px] text-slate-700">
              {scrapers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('apis')}
            className={`py-3 px-3.5 border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'apis'
                ? 'border-orange-600 text-orange-600 font-bold bg-orange-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>Direct Partner APIs</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-[10px] text-slate-700">
              {apiIntegrations.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('networks')}
            className={`py-3 px-3.5 border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'networks'
                ? 'border-orange-600 text-orange-600 font-bold bg-orange-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Affiliate Networks Hub</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-[10px] text-slate-700">
              {affiliateNetworks.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('user_logins')}
            className={`py-3 px-3.5 border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'user_logins'
                ? 'border-orange-600 text-orange-600 font-bold bg-orange-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>User Logins & Sessions</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-[10px] text-slate-700">
              {userLogins.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('spin_earn')}
            className={`py-3 px-3.5 border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'spin_earn'
                ? 'border-orange-600 text-orange-600 font-bold bg-orange-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Gift className="w-4 h-4" />
            <span>Spin & Earn Prize Rules</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-[10px] text-slate-700">
              {spinRewards.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('proxies')}
            className={`py-3 px-3.5 border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'proxies'
                ? 'border-orange-600 text-orange-600 font-bold bg-orange-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Residential Proxies</span>
            <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-[10px] text-emerald-800">
              {proxies.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('direct_partners')}
            className={`py-3 px-3.5 border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'direct_partners'
                ? 'border-orange-600 text-orange-600 font-bold bg-orange-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Handshake className="w-4 h-4 text-orange-600" />
            <span>100+ Direct Partners</span>
            <span className="px-1.5 py-0.2 rounded-full bg-orange-100 text-[10px] text-orange-800">
              {directPartners.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('merchant_vendors')}
            className={`py-3 px-3.5 border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'merchant_vendors'
                ? 'border-blue-600 text-blue-600 font-bold bg-blue-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <KeyRound className="w-4 h-4 text-blue-600" />
            <span>10-Digit Vendor IDs</span>
            <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-[10px] text-blue-800">
              {vendorAccounts.length}
            </span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* KPI Metric Cards (White Theme) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
              <span>Total Gross GMV Driven</span>
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 font-mono">
              ₹{totalGMV.toLocaleString('en-IN')}
            </div>
            <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">
              ↑ 18.4% this month across 10 verticals
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
              <span>Total Commission Revenue</span>
              <TrendingUp className="w-4 h-4 text-orange-600" />
            </div>
            <div className="text-2xl font-black text-orange-600 font-mono">
              ₹{totalCommission.toLocaleString('en-IN')}
            </div>
            <span className="text-[11px] text-slate-500 font-medium mt-1 block">
              Avg Commission Yield: 3.8% CPS
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
              <span>Pending Partner Settlements</span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 font-mono">
              ₹{totalPendingPayout.toLocaleString('en-IN')}
            </div>
            <span className="text-[11px] text-amber-600 font-medium mt-1 block">
              Next payout clearance: Friday
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
              <span>Active Sources (APIs + Scrapers)</span>
              <Layers className="w-4 h-4 text-sky-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 font-mono">
              {apiIntegrations.length + scrapers.length} Active
            </div>
            <span className="text-[11px] text-sky-600 font-medium mt-1 block">
              {scrapers.length} Custom Scrapers · {apiIntegrations.length} Direct APIs
            </span>
          </div>
        </div>

        {/* ================= TAB 0: WEBSITE TRAFFIC & CAMPAIGN PERFORMANCE ================= */}
        {activeTab === 'traffic_performance' && <PlatformTrafficTab />}

        {/* ================= TAB QUICK APPS: PARTNERS & REDIRECTION REPORTS ================= */}
        {activeTab === 'quick_apps' && <QuickAppsAdminTab />}

        {/* ================= TAB 1: USER PURCHASES & TRACKING ================= */}
        {activeTab === 'purchases' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div>
                <h3 className="text-base font-bold text-slate-900">Live User Purchases & Redirection Attribution</h3>
                <p className="text-xs text-slate-500">
                  Track exact user clicks, purchasing merchants, order volume, and earned affiliate commissions in real-time.
                </p>
              </div>

              {/* Filter tools */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={purchaseSearchQuery}
                    onChange={(e) => setPurchaseSearchQuery(e.target.value)}
                    placeholder="Search user, city, order ID, partner..."
                    className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-orange-500 w-52 sm:w-64"
                  />
                </div>

                <select
                  value={purchaseFilterVertical}
                  onChange={(e) => setPurchaseFilterVertical(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-hidden focus:border-orange-500"
                >
                  <option value="all">All Verticals</option>
                  <option value="flights">Flights</option>
                  <option value="hotels">Hotels</option>
                  <option value="ecommerce">E-Commerce</option>
                  <option value="grocery">10-Min Grocery</option>
                  <option value="food">Food</option>
                  <option value="loans">Loans</option>
                  <option value="cab">Cabs</option>
                </select>
              </div>
            </div>

            {/* Purchases Table */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3.5 px-4 font-semibold">User & Location</th>
                      <th className="py-3.5 px-4 font-semibold">Merchant / Partner</th>
                      <th className="py-3.5 px-4 font-semibold">Purchased Item & Order ID</th>
                      <th className="py-3.5 px-4 font-semibold text-right">Order Amount</th>
                      <th className="py-3.5 px-4 font-semibold text-right">Commission Earned</th>
                      <th className="py-3.5 px-4 font-semibold text-center">Status</th>
                      <th className="py-3.5 px-4 font-semibold">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPurchases.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{rec.userName}</div>
                          <div className="text-[11px] text-slate-500">{rec.userEmail}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {rec.userCity} · IP: {rec.userIp}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span className="font-bold text-orange-600">{rec.merchantName}</span>
                          <div className="text-[10px] text-slate-500 capitalize">
                            {rec.vertical} ({rec.affiliateNetwork})
                          </div>
                        </td>

                        <td className="py-3 px-4 max-w-xs">
                          <div className="font-medium text-slate-800 truncate">{rec.itemTitle}</div>
                          <div className="text-[10px] font-mono text-slate-400">{rec.orderId}</div>
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          ₹{rec.orderAmount.toLocaleString('en-IN')}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <span className="font-mono font-bold text-emerald-600">
                            +₹{rec.commissionEarned.toLocaleString('en-IN')}
                          </span>
                          <div className="text-[10px] text-slate-400">{rec.commissionRate}</div>
                        </td>

                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              rec.status === 'approved' || rec.status === 'paid'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : rec.status === 'tracked'
                                ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {rec.status}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                          {rec.timestamp}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: PARTNER PAYOUTS ================= */}
        {activeTab === 'payouts' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Partner Payouts & Commission Rates</h3>
                <p className="text-xs text-slate-500">
                  Detailed commission structures, gross revenue generated, and pending payout settlements per partner.
                </p>
              </div>

              <div className="text-xs font-mono text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 font-bold">
                Total Earned: ₹{(totalCommission * 3.4).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {partnerPayouts.map((partner) => (
                <div
                  key={partner.id}
                  className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 text-base">{partner.partnerName}</h4>
                      <span className="text-xs text-slate-500 capitalize">
                        {partner.vertical} · Network: {partner.network}
                      </span>
                    </div>

                    <span className="px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-200 text-xs font-mono font-bold">
                      {partner.commissionRate}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5 pt-2 border-t border-slate-100 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                        Clicks / CVR
                      </span>
                      <div className="font-bold font-mono text-slate-900 mt-0.5">
                        {partner.totalClicks.toLocaleString('en-IN')}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {((partner.conversions / partner.totalClicks) * 100).toFixed(1)}% conversion
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                        Total Payout
                      </span>
                      <div className="font-bold font-mono text-emerald-600 mt-0.5">
                        ₹{partner.totalPayoutEarned.toLocaleString('en-IN')}
                      </div>
                      <span className="text-[10px] text-slate-400">{partner.commissionType} model</span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                        Pending Clearance
                      </span>
                      <div className="font-bold font-mono text-amber-600 mt-0.5">
                        ₹{partner.pendingPayout.toLocaleString('en-IN')}
                      </div>
                      <span className="text-[10px] text-slate-400">Last paid: {partner.lastPaymentDate}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span className="font-mono text-[11px]">Affiliate ID: {partner.affiliateId}</span>
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Status: Active Partner
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= TAB 3: AFFILIATE IDS & LINK BUILDER ================= */}
        {activeTab === 'affiliate_ids' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-800/70 p-4 rounded-2xl border border-slate-700">
              <div>
                <h3 className="text-base font-bold text-white">Affiliate ID & Token Management</h3>
                <p className="text-xs text-slate-400">
                  Configure merchant tracking IDs, sub-ID tokens, and test real-time affiliate link generation.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsAddAffiliateOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Affiliate ID</span>
              </button>
            </div>

            {/* List of active IDs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {affiliateIds.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-white text-sm">{item.merchantOrNetwork}</h4>
                      <span className="text-xs text-slate-400 capitalize">{item.vertical}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleAffiliateIdStatus(item.id)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase transition-colors cursor-pointer ${
                        item.status === 'active'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-700 text-slate-400 border border-slate-600'
                      }`}
                    >
                      {item.status}
                    </button>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-xs text-orange-400 space-y-1">
                    <div>
                      <span className="text-slate-500 text-[10px]">Affiliate ID:</span>{' '}
                      <strong>{item.affiliateId}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px]">Sub-ID Pattern:</span>{' '}
                      <span className="text-slate-300">{item.subIdParam}</span>
                    </div>
                  </div>

                  {item.notes && (
                    <p className="text-[11px] text-slate-400 leading-relaxed">{item.notes}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Live Affiliate Link Tester / Generator */}
            <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700 space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-orange-400" />
                <span>Instant Affiliate Deep-Link Generator & Tester</span>
              </h4>
              <p className="text-xs text-slate-400">
                Input any target merchant URL to test Try1Second's automated sub-id tracking attribution parameters.
              </p>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={testLinkInput}
                  onChange={(e) => setTestLinkInput(e.target.value)}
                  placeholder="https://merchant.com/product/..."
                  className="flex-1 px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-xl text-white font-mono focus:outline-hidden focus:border-orange-500"
                />
                <button
                  type="button"
                  onClick={handleGenerateLink}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                >
                  Generate Tracked Link
                </button>
              </div>

              {generatedLinkResult && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-emerald-400 break-all">
                  <span className="text-slate-500 block text-[10px] mb-1">Generated Output Link:</span>
                  {generatedLinkResult}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 4: DYNAMIC WEB SCRAPERS (White Theme) ================= */}
        {activeTab === 'scrapers' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div>
                <h3 className="text-base font-bold text-slate-900">Dynamic Web Scrapers for Non-Partner Merchants</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Add non-partner stores to scrape product & fare data in real-time. Extracted results are automatically ingested into your comparison search!
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsAddScraperOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Configure New Scraper</span>
              </button>
            </div>

            {/* Scrapers List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {scrapers.map((scr) => (
                <div
                  key={scr.id}
                  className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 text-base">{scr.merchantName}</h4>
                      <span className="text-xs text-slate-500 capitalize">
                        {scr.vertical} · Engine: {scr.engineMode}
                      </span>
                    </div>

                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold uppercase">
                      {scr.status}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-700 font-mono bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="truncate text-slate-600">
                      <span className="text-slate-400">URL Pattern:</span> {scr.targetUrlTemplate}
                    </div>
                    <div>
                      <span className="text-slate-400">Price Selector:</span>{' '}
                      <span className="text-orange-600 font-bold">{scr.priceSelector}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Title Selector:</span>{' '}
                      <span className="text-slate-800">{scr.titleSelector}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-slate-500">
                      Last Scrape: <strong className="text-slate-700">{scr.lastScrapeTime}</strong> ({scr.itemsScrapedLastRun} items found)
                    </span>

                    <button
                      type="button"
                      disabled={runningScraperId === scr.id}
                      onClick={() => handleExecuteScrape(scr.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      {runningScraperId === scr.id ? (
                        <>
                          <RotateCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Scraping...</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Run Scraper Test</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Scraper Live Terminal & Tester Console */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3 font-mono">
              <div className="flex items-center justify-between text-xs text-slate-600 border-b border-slate-200 pb-2">
                <span className="flex items-center gap-2 text-slate-900 font-bold">
                  <Terminal className="w-4 h-4 text-orange-600" />
                  <span>Scraper Execution Sandbox Terminal</span>
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={scraperTestQuery}
                    onChange={(e) => setScraperTestQuery(e.target.value)}
                    placeholder="Search Keyword..."
                    className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                  />
                  <span className="text-slate-400">Target Parameter</span>
                </div>
              </div>

              <div className="h-44 overflow-y-auto space-y-1 text-xs text-slate-700 font-mono py-1 bg-slate-900 p-3 rounded-xl">
                {scraperLogs.length === 0 ? (
                  <p className="text-slate-400 italic">
                    Ready to execute test scrape. Click "Run Scraper Test" on any scraper above to observe live DOM extraction and comparison ingestion.
                  </p>
                ) : (
                  scraperLogs.map((log, idx) => (
                    <div
                      key={idx}
                      className={
                        log.includes('OK') || log.includes('injected')
                          ? 'text-emerald-400'
                          : log.includes('Sample')
                          ? 'text-orange-400'
                          : 'text-slate-300'
                      }
                    >
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 5: DIRECT PARTNER APIS (White Theme) ================= */}
        {activeTab === 'apis' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div>
                <h3 className="text-base font-bold text-slate-900">Direct Partner API Connections</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Register official REST/GraphQL search endpoints with field mappings and monitor sub-second API latency.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsAddApiOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Register New API</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {apiIntegrations.map((api) => (
                <div
                  key={api.id}
                  className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 text-base">{api.partnerName}</h4>
                      <span className="text-xs text-slate-500 capitalize">
                        {api.vertical} · Method: {api.httpMethod} ({api.authType})
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase">
                        {api.status}
                      </span>
                      <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                        Latency: <strong className="text-emerald-700">{api.latencyMs}ms</strong>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono text-xs text-slate-700 space-y-1">
                    <div className="truncate">
                      <span className="text-slate-400">Endpoint:</span> {api.endpointUrl}
                    </div>
                    <div className="text-slate-600 text-[11px]">
                      Rate Limit: <strong className="text-orange-600">{api.rateLimit}</strong>
                    </div>
                    <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-200">
                      Price Field: <span className="text-slate-800">{api.responseMapping.priceField}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-500">Auth: 256-bit TLS encrypted</span>
                    <button
                      type="button"
                      onClick={() => testApiPing(api.id)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 border border-slate-200"
                    >
                      <Activity className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Test Ping Latency</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= TAB 6: AFFILIATE NETWORKS HUB (White Theme) ================= */}
        {activeTab === 'networks' && (
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <h3 className="text-base font-bold text-slate-900">Aggregator Affiliate Networks Management</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Centralized management for Admitad, vCommission, Cuelinks, Linksdirect, and Optimise. Configure S2S postback webhooks, deep link prefixes, and publisher tokens.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {affiliateNetworks.map((net) => (
                <div
                  key={net.id}
                  className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-orange-600 text-white font-black text-sm flex items-center justify-center shrink-0">
                        {net.name.substring(0, 3).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-base">{net.name} Network</h4>
                        <span className="text-xs text-slate-500">
                          Publisher ID: <strong className="text-slate-700">{net.publisherId}</strong>
                        </span>
                      </div>
                    </div>

                    <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {net.syncStatus}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">{net.notes}</p>

                  <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Connected Merchants</span>
                      <strong className="text-slate-900 text-sm">{net.connectedCampaignsCount} Brands</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">30-Day Revenue</span>
                      <strong className="text-emerald-700 text-sm">
                        ₹{net.totalEarningsMonth.toLocaleString('en-IN')}
                      </strong>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <label className="text-[10px] uppercase text-slate-500 font-semibold block mb-0.5">
                        S2S Postback Webhook URL
                      </label>
                      <input
                        type="text"
                        value={net.webhookUrl}
                        onChange={(e) => updateAffiliateNetwork(net.id, { webhookUrl: e.target.value })}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono text-[11px]"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] uppercase text-slate-500 font-semibold block mb-0.5">
                        Deep Link Prefix
                      </label>
                      <input
                        type="text"
                        value={net.deepLinkPrefix}
                        onChange={(e) => updateAffiliateNetwork(net.id, { deepLinkPrefix: e.target.value })}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono text-[11px]"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <span className="text-[11px] text-slate-500">Synced: {net.lastSyncTime}</span>
                    <button
                      type="button"
                      onClick={() => simulateNetworkPostback(net.name)}
                      className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-lg transition-colors cursor-pointer text-xs"
                    >
                      Trigger Test Postback
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= TAB 7: USER LOGINS & SESSIONS AUDIT ================= */}
        {activeTab === 'user_logins' && <UserLoginsTab />}

        {/* ================= TAB 8: SPIN & EARN REWARDS MANAGEMENT ================= */}
        {activeTab === 'spin_earn' && <SpinEarnManagementTab />}

        {/* ================= TAB 9: RESIDENTIAL PROXY NETWORK & HOSTINGER ================= */}
        {activeTab === 'proxies' && <ResidentialProxyTab />}

        {/* ================= TAB 10: 100+ DIRECT PARTNERS DIRECTORY MANAGEMENT ================= */}
        {activeTab === 'direct_partners' && <DirectPartnersTab />}

        {/* ================= TAB 11: 10-DIGIT MERCHANT VENDOR ACCESS MANAGEMENT ================= */}
        {activeTab === 'merchant_vendors' && <MerchantVendorIdsTab />}
      </main>

      {/* ================= MODAL 1: ADD AFFILIATE ID (White Theme) ================= */}
      {isAddAffiliateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900">Add New Affiliate ID / Token</h3>
            <form onSubmit={handleCreateAffiliateId} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Merchant / Network Name</label>
                <input
                  type="text"
                  required
                  value={newAffiliateForm.merchantOrNetwork}
                  onChange={(e) => setNewAffiliateForm({ ...newAffiliateForm, merchantOrNetwork: e.target.value })}
                  placeholder="e.g. Myntra Direct or Optimise Media"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Vertical Category</label>
                  <select
                    value={newAffiliateForm.vertical}
                    onChange={(e) => setNewAffiliateForm({ ...newAffiliateForm, vertical: e.target.value as VerticalId })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:border-orange-500 outline-none"
                  >
                    <option value="ecommerce">E-Commerce</option>
                    <option value="flights">Flights</option>
                    <option value="hotels">Hotels</option>
                    <option value="grocery">10-Min Grocery</option>
                    <option value="food">Food Delivery</option>
                    <option value="bus">Bus</option>
                    <option value="movie">Movies</option>
                    <option value="loans">Loans</option>
                    <option value="insurance">Insurance</option>
                    <option value="cab">Cabs</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Affiliate / Publisher ID</label>
                  <input
                    type="text"
                    required
                    value={newAffiliateForm.affiliateId}
                    onChange={(e) => setNewAffiliateForm({ ...newAffiliateForm, affiliateId: e.target.value })}
                    placeholder="e.g. TRY1_MYN_9918"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono placeholder:text-slate-400 focus:border-orange-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Sub-ID Parameter Pattern</label>
                <input
                  type="text"
                  value={newAffiliateForm.subIdParam}
                  onChange={(e) => setNewAffiliateForm({ ...newAffiliateForm, subIdParam: e.target.value })}
                  placeholder="subid={userId}&source=try1second"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono placeholder:text-slate-400 focus:border-orange-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Notes / Attribution Period</label>
                <input
                  type="text"
                  value={newAffiliateForm.notes}
                  onChange={(e) => setNewAffiliateForm({ ...newAffiliateForm, notes: e.target.value })}
                  placeholder="30-day cookie attribution, instant postback"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:border-orange-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddAffiliateOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-orange-600 hover:bg-orange-500 font-bold text-white rounded-xl cursor-pointer"
                >
                  Save Affiliate ID
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: ADD CUSTOM SCRAPER (White Theme) ================= */}
      {isAddScraperOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div>
              <h3 className="text-base font-bold text-slate-900">Configure New Merchant Web Scraper</h3>
              <p className="text-xs text-slate-500">
                Harvest live fares and pricing from non-partner merchants automatically.
              </p>
            </div>

            <form onSubmit={handleCreateScraper} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Merchant Store Name</label>
                  <input
                    type="text"
                    required
                    value={newScraperForm.merchantName}
                    onChange={(e) => setNewScraperForm({ ...newScraperForm, merchantName: e.target.value })}
                    placeholder="e.g. Croma Electronics"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:border-orange-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Vertical Category</label>
                  <select
                    value={newScraperForm.vertical}
                    onChange={(e) => setNewScraperForm({ ...newScraperForm, vertical: e.target.value as VerticalId })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:border-orange-500 outline-none"
                  >
                    <option value="ecommerce">E-Commerce</option>
                    <option value="flights">Flights</option>
                    <option value="hotels">Hotels</option>
                    <option value="grocery">10-Min Grocery</option>
                    <option value="food">Food Delivery</option>
                    <option value="movie">Movies</option>
                    <option value="bus">Bus</option>
                    <option value="cab">Cabs</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Target Search URL Template</label>
                <input
                  type="text"
                  required
                  value={newScraperForm.targetUrlTemplate}
                  onChange={(e) => setNewScraperForm({ ...newScraperForm, targetUrlTemplate: e.target.value })}
                  placeholder="https://www.croma.com/searchB?q={query}"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono placeholder:text-slate-400 focus:border-orange-500 outline-none"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Use {'{query}'} as placeholder for search keyword.</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Price CSS / XPath</label>
                  <input
                    type="text"
                    required
                    value={newScraperForm.priceSelector}
                    onChange={(e) => setNewScraperForm({ ...newScraperForm, priceSelector: e.target.value })}
                    placeholder=".new-price, [data-price]"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono placeholder:text-slate-400 focus:border-orange-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Title CSS / XPath</label>
                  <input
                    type="text"
                    required
                    value={newScraperForm.titleSelector}
                    onChange={(e) => setNewScraperForm({ ...newScraperForm, titleSelector: e.target.value })}
                    placeholder=".product-title, h3"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono placeholder:text-slate-400 focus:border-orange-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Engine Architecture</label>
                  <select
                    value={newScraperForm.engineMode}
                    onChange={(e) => setNewScraperForm({ ...newScraperForm, engineMode: e.target.value as CustomScraperConfig['engineMode'] })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:border-orange-500 outline-none"
                  >
                    <option value="headless_puppeteer">Headless Puppeteer (Full JS Rendering)</option>
                    <option value="cheerio_html">Cheerio Fast HTML Parser (&lt;200ms)</option>
                    <option value="stealth_proxy">Stealth Rotating Proxy Network</option>
                    <option value="jsonld_regex">Schema.org JSON-LD Regex Extractor</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="autoIngest"
                    checked={newScraperForm.autoIngestIntoCompare}
                    onChange={(e) => setNewScraperForm({ ...newScraperForm, autoIngestIntoCompare: e.target.checked })}
                    className="w-4 h-4 rounded text-orange-600 bg-white border-slate-300"
                  />
                  <label htmlFor="autoIngest" className="text-slate-700 font-semibold cursor-pointer">
                    Auto-ingest into live comparison feed
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddScraperOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-orange-600 hover:bg-orange-500 font-bold text-white rounded-xl cursor-pointer"
                >
                  Deploy Web Scraper
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 3: ADD DIRECT API (White Theme) ================= */}
      {isAddApiOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div>
              <h3 className="text-base font-bold text-slate-900">Register Direct Partner API</h3>
              <p className="text-xs text-slate-500">
                Integrate partner REST search endpoints for sub-second metasearch queries.
              </p>
            </div>

            <form onSubmit={handleCreateApi} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Partner Organization</label>
                  <input
                    type="text"
                    required
                    value={newApiForm.partnerName}
                    onChange={(e) => setNewApiForm({ ...newApiForm, partnerName: e.target.value })}
                    placeholder="e.g. Air India Express API"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:border-orange-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Vertical Category</label>
                  <select
                    value={newApiForm.vertical}
                    onChange={(e) => setNewApiForm({ ...newApiForm, vertical: e.target.value as VerticalId })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:border-orange-500 outline-none"
                  >
                    <option value="flights">Flights</option>
                    <option value="hotels">Hotels</option>
                    <option value="ecommerce">E-Commerce</option>
                    <option value="grocery">10-Min Grocery</option>
                    <option value="cab">Cabs</option>
                    <option value="loans">Loans</option>
                    <option value="insurance">Insurance</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">API Endpoint URL</label>
                <input
                  type="url"
                  required
                  value={newApiForm.endpointUrl}
                  onChange={(e) => setNewApiForm({ ...newApiForm, endpointUrl: e.target.value })}
                  placeholder="https://api.partner.com/v1/search"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono placeholder:text-slate-400 focus:border-orange-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">HTTP Method</label>
                  <select
                    value={newApiForm.httpMethod}
                    onChange={(e) => setNewApiForm({ ...newApiForm, httpMethod: e.target.value as 'GET' | 'POST' })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:border-orange-500 outline-none"
                  >
                    <option value="POST">POST (JSON Body Payload)</option>
                    <option value="GET">GET (Query Params)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Auth Type & Token</label>
                  <input
                    type="password"
                    value={newApiForm.authToken}
                    onChange={(e) => setNewApiForm({ ...newApiForm, authToken: e.target.value })}
                    placeholder="Bearer token or API Key"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono placeholder:text-slate-400 focus:border-orange-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Price Field in JSON</label>
                  <input
                    type="text"
                    value={newApiForm.priceField}
                    onChange={(e) => setNewApiForm({ ...newApiForm, priceField: e.target.value })}
                    placeholder="data.items[].price"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono placeholder:text-slate-400 focus:border-orange-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Title Field in JSON</label>
                  <input
                    type="text"
                    value={newApiForm.titleField}
                    onChange={(e) => setNewApiForm({ ...newApiForm, titleField: e.target.value })}
                    placeholder="data.items[].name"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono placeholder:text-slate-400 focus:border-orange-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddApiOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-orange-600 hover:bg-orange-500 font-bold text-white rounded-xl cursor-pointer"
                >
                  Register API Integration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
