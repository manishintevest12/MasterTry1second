import React, { useState, useEffect, useCallback } from 'react';
import {
  Car,
  Users,
  Tag,
  ShieldCheck,
  Building2,
  KeyRound,
  DollarSign,
  Globe,
  Terminal,
  Zap,
  ArrowLeft,
  Search,
  CheckCircle2,
  TrendingUp,
  Clock,
  Server,
  Activity,
  Database,
  Gift,
  UserCheck,
  Handshake,
  LogOut,
  Link2,
  Gauge,
  MousePointerClick,
  Ticket,
  BarChart3,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Try1SecondLogo } from '../Try1SecondLogo';
import { SpinEarnManagementTab } from './SpinEarnManagementTab';
import { AffiliateNetworksTab } from './AffiliateNetworksTab';
import { CabBookLinksTab } from './CabBookLinksTab';
import { DirectPartnersTab } from './DirectPartnersTab';
import { MerchantVendorIdsTab } from './MerchantVendorIdsTab';
import { AffiliateClicksTab } from './AffiliateClicksTab';
import { RealTrafficTab } from './RealTrafficTab';
import { SourcesTab } from './SourcesTab';
import { IntegrationsTab } from './IntegrationsTab';
import { AuditLogTab } from './AuditLogTab';
import { AffiliateProfilesPanel } from './AffiliateProfilesPanel';
import { QuickAppsAdminTab } from './QuickAppsAdminTab';
import { HomeBannersTab } from './HomeBannersTab';
import { PlacementsTab } from './PlacementsTab';
import { FinanceVerticalsTab } from './FinanceVerticalsTab';
import { PromoOffersTab } from './PromoOffersTab';
import { AdsenseRevenueTab } from './AdsenseRevenueTab';
import { AppLinksTab } from './AppLinksTab';
import { NotificationsTab } from './NotificationsTab';
import { DealsTab } from './DealsTab';
import { LeadsTab } from './LeadsTab';
import { MerchantLogosTab } from './MerchantLogosTab';
import { SpeedTestTab } from './SpeedTestTab';

export type AdminTab =
  | 'app_links'
  | 'notifications'
  | 'deals'
  | 'leads'
  | 'merchant_logos'
  | 'site_speed'
  | 'traffic_performance'
  | 'quick_apps'
  | 'home_banners'
  | 'merchant_vendors'
  | 'purchases'
  | 'payouts'
  | 'affiliate_ids'
  | 'promo_offers'
  | 'adsense_revenue'
  | 'affiliate_networks'
  | 'cab_book_links'
  | 'scrapers'
  | 'apis'
  | 'networks'
  | 'user_logins'
  | 'spin_earn'
  | 'proxies'
  | 'direct_partners'
  | 'placements'
  | 'finance_verticals';

/**
 * REAL admin KPI strip (owner 24 Oct): every number is fetched live from MySQL
 * via /api/admin/traffic/real — no fabricated GMV/commission/payout numbers.
 */
const RealKpiStrip: React.FC = () => {
  const [token] = useState(() => localStorage.getItem('t1s_admin_token') || '');
  const [kpis, setKpis] = useState<{ searches: number; withResults: number; clicks: number; sources: number } | null>(null);

  const load = useCallback(async () => {
    try {
      const h = { Authorization: `Bearer ${token}` };
      const [rt, src] = await Promise.all([
        fetch('/api/admin/traffic/real?days=30', { headers: h }).then((r) => r.json()).catch(() => null),
        fetch('/api/admin/sources', { headers: h }).then((r) => r.json()).catch(() => null),
      ]);
      setKpis({
        searches: rt?.traffic?.searchesWindow ?? 0,
        withResults: rt?.traffic?.searchesWithResults ?? 0,
        clicks: (rt?.traffic?.clicksByNetwork || []).reduce((sum: number, n: any) => sum + Number(n.count || 0), 0),
        sources: (src?.sources || []).filter((x: any) => x.enabled).length,
      });
    } catch { setKpis(null); }
  }, [token]);
  useEffect(() => { void load(); }, [load]);

  const tiles = [
    { label: 'Searches (30d)', value: (kpis?.searches ?? 0).toLocaleString('en-IN'), icon: Search },
    { label: 'Searches With Results', value: (kpis?.withResults ?? 0).toLocaleString('en-IN'), icon: Activity },
    { label: 'Outbound Clicks (30d)', value: (kpis?.clicks ?? 0).toLocaleString('en-IN'), icon: MousePointerClick },
    { label: 'Enabled Data Sources', value: String(kpis?.sources ?? 0), icon: Database },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {tiles.map((t) => (
        <div key={t.label} className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>{t.label}</span>
            <t.icon className="w-4 h-4 text-orange-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">{t.value}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">live from MySQL</span>
        </div>
      ))}
    </div>
  );
};

export const AdminDashboard: React.FC = () => {
  const {
    setActiveNavTab,
    navigateToSecretRoute,
    isAdminAuthenticated,
    adminEmail,
    adminLogout,
    quickAppPartners,
    vendorAccounts,
    spinRewards,
    directPartners,
  } = useApp();

  const [activeTab, setActiveTab] = useState<AdminTab>('traffic_performance');

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
              title="Open Merchant B2B Portal (www.try1second.com/merchantinstab2b)"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Merchant B2B Portal</span>
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
            onClick={() => setActiveTab('site_speed')}
            className={`py-3 px-3.5 border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'site_speed'
                ? 'border-emerald-600 text-emerald-700 font-bold bg-emerald-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Gauge className="w-4 h-4 text-emerald-600" />
            <span>Site Speed</span>
          </button>

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
            <span>Affiliate Clicks (Real)</span>
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
            <span>Network Payouts (Real)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('adsense_revenue')}
            className={`py-3 px-3.5 border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'adsense_revenue'
                ? 'border-rose-600 text-rose-600 font-bold bg-rose-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            AdSense Revenue
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('promo_offers')}
            className={`py-3 px-3.5 border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'promo_offers'
                ? 'border-rose-600 text-rose-600 font-bold bg-rose-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Ticket className="w-4 h-4" />
            Offers &amp; Coupons
          </button>
          <button
            onClick={() => setActiveTab('affiliate_ids')}
            className={`py-3 px-3.5 border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'affiliate_ids'
                ? 'border-orange-600 text-orange-600 font-bold bg-orange-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>Affiliate IDs (Server)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('affiliate_networks')}
            className={`py-3 px-3.5 border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'affiliate_networks'
                ? 'border-orange-600 text-orange-600 font-bold bg-orange-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Link2 className="w-4 h-4" />
            <span>Affiliate Networks</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cab_book_links')}
            className={`py-3 px-3.5 border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'cab_book_links'
                ? 'border-orange-600 text-orange-600 font-bold bg-orange-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Car className="w-4 h-4" />
            <span>Cab App Booking</span>
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
            <span>Live Data Sources</span>
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
            <span>Integrations Status</span>
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
            <span>Affiliate Networks</span>
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
            <span>Audit Log (Real)</span>
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
              onClick={() => setActiveTab('app_links')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === 'app_links'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Extension &amp; App Links
            </button>
            <button
              onClick={() => setActiveTab('deals')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === 'deals'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Deals &amp; Coupons
            </button>
            <button
              onClick={() => setActiveTab('leads')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === 'leads'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Leads
            </button>
            <button
              onClick={() => setActiveTab('home_banners')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === 'home_banners'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Home Banners
            </button>
            <button
              onClick={() => setActiveTab('merchant_logos')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === 'merchant_logos'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Merchant Logos
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === 'notifications'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Notifications Push
            </button>
            <button
              onClick={() => setActiveTab('finance_verticals')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === 'finance_verticals'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Finance Verticals
            </button>
            <button
              onClick={() => setActiveTab('placements')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === 'placements'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Top Picks &amp; Ads
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
        <RealKpiStrip />

        {/* ================= TAB 0: WEBSITE TRAFFIC & CAMPAIGN PERFORMANCE ================= */}
        {activeTab === 'traffic_performance' && <RealTrafficTab />}

        {/* ================= TAB QUICK APPS: PARTNERS & REDIRECTION REPORTS ================= */}
        {activeTab === 'quick_apps' && <QuickAppsAdminTab />}

        {/* ================= TAB 1: USER PURCHASES & TRACKING ================= */}
        {activeTab === 'purchases' && <AffiliateClicksTab view="clicks" />}

        {/* ================= TAB 2: PARTNER PAYOUTS ================= */}
        {activeTab === 'payouts' && <AffiliateClicksTab view="payouts" />}

        {/* ================= TAB 3: AFFILIATE IDS & LINK BUILDER ================= */}
        {activeTab === 'affiliate_ids' && <AffiliateProfilesPanel />}
        {activeTab === 'promo_offers' && <PromoOffersTab />}
        {activeTab === 'adsense_revenue' && <AdsenseRevenueTab />}

        {/* ================= TAB 4: DYNAMIC WEB SCRAPERS (White Theme) ================= */}
        {activeTab === 'scrapers' && <SourcesTab />}

        {/* ================= TAB 5: DIRECT PARTNER APIS (White Theme) ================= */}
        {activeTab === 'apis' && <IntegrationsTab />}

        {/* ================= TAB 6: AFFILIATE NETWORKS HUB (White Theme) ================= */}
        {activeTab === 'networks' && <IntegrationsTab />}

        {/* ================= TAB 7: USER LOGINS & SESSIONS AUDIT ================= */}
        {activeTab === 'user_logins' && <AuditLogTab />}

        {/* ================= TAB 8: SPIN & EARN REWARDS MANAGEMENT ================= */}
        {activeTab === 'spin_earn' && <SpinEarnManagementTab />}

        {activeTab === 'affiliate_networks' && <AffiliateNetworksTab />}
        {activeTab === 'cab_book_links' && <CabBookLinksTab />}

        {/* ================= TAB 10: 100+ DIRECT PARTNERS DIRECTORY MANAGEMENT ================= */}
        {activeTab === 'direct_partners' && <DirectPartnersTab />}
        {activeTab === 'site_speed' && <SpeedTestTab />}
        {activeTab === 'leads' && <LeadsTab />}
        {activeTab === 'home_banners' && <HomeBannersTab />}
        {activeTab === 'merchant_logos' && <MerchantLogosTab />}
        {activeTab === 'finance_verticals' && <FinanceVerticalsTab />}
        {activeTab === 'placements' && <PlacementsTab />}
        {activeTab === 'app_links' && <AppLinksTab />}
        {activeTab === 'notifications' && <NotificationsTab />}
        {activeTab === 'deals' && <DealsTab />}

        {/* ================= TAB 11: 10-DIGIT MERCHANT VENDOR ACCESS MANAGEMENT ================= */}
        {activeTab === 'merchant_vendors' && <MerchantVendorIdsTab />}
      </main>

    </div>
  );
};
