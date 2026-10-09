import React, { useState } from 'react';
import {
  Building2,
  Users,
  Sliders,
  BarChart3,
  ArrowLeft,
  ShieldCheck,
  Zap,
  Sparkles,
  Download,
  CreditCard,
  Layers,
  ChevronDown,
  LogOut,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { VerticalId } from '../../types';
import { VERTICAL_META } from '../../data/mockData';
import { LeadManagementTable } from './LeadManagementTable';
import { CampaignControlTab } from './CampaignControlTab';
import { MerchantAnalyticsTab } from './MerchantAnalyticsTab';
import { MarketIntelligenceTab } from './MarketIntelligenceTab';
import { MerchantLoginView } from './MerchantLoginView';
import { Try1SecondLogo } from '../Try1SecondLogo';

type MerchantSubTab = 'intelligence' | 'leads' | 'campaigns' | 'analytics';

export const MerchantPortal: React.FC = () => {
  const {
    authenticatedVendor,
    merchantLogout,
    navigateToSecretRoute,
    cplLeads,
    merchantCampaigns,
    merchantPrepaidBalance,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<MerchantSubTab>('intelligence');

  // If vendor is not authenticated with their 10-digit ID, show the secure white-themed login screen
  if (!authenticatedVendor) {
    return <MerchantLoginView />;
  }

  const categoryMeta = VERTICAL_META[authenticatedVendor.vertical as VerticalId];
  const categoryName = categoryMeta?.name || authenticatedVendor.vertical.toUpperCase();
  const categoryLeadsCount = cplLeads.filter((l) => l.vertical === authenticatedVendor.vertical).length;
  const categoryCampaignsCount = merchantCampaigns.filter((c) => c.vertical === authenticatedVendor.vertical).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 font-sans">
      {/* Top Merchant Sticky Header (White Theme) */}
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
              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-mono text-[10px] font-bold uppercase tracking-wider">
                Merchant B2B Portal
              </span>
            </div>
          </div>

          {/* Authenticated Vendor Badge & Session Strip */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {/* Vendor Company Name & 10-Digit ID */}
            <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-1.5 rounded-xl border border-slate-200">
              <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
              <div>
                <span className="font-bold text-slate-900 block leading-tight">
                  {authenticatedVendor.companyName}
                </span>
                <div className="flex items-center gap-1.5 text-[10px] font-mono mt-0.5">
                  <span className="text-slate-500">Vendor ID:</span>
                  <span className="font-bold text-blue-700 bg-blue-50 px-1 py-0.2 rounded border border-blue-100">
                    {authenticatedVendor.vendorIdNumber}
                  </span>
                  <span className="text-slate-400">•</span>
                  <span className="text-emerald-700 font-bold uppercase flex items-center gap-0.5">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    Verified
                  </span>
                </div>
              </div>
            </div>

            {/* Locked Category Pill */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 font-medium">
              <span className="text-[10px] uppercase font-bold text-blue-600">Category:</span>
              <span className="font-extrabold text-blue-800">{categoryName}</span>
              <span className="text-[9px] bg-blue-200/60 text-blue-800 px-1.5 py-0.2 rounded-md font-bold uppercase">Locked</span>
            </div>

            {/* Prepaid Credits Wallet */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-mono font-bold">
              <span>Credits: ₹{(authenticatedVendor.prepaidCredits || merchantPrepaidBalance).toLocaleString('en-IN')}</span>
            </div>

            {/* Logout Button */}
            <button
              type="button"
              onClick={merchantLogout}
              className="p-2 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 hover:border-rose-200 rounded-xl transition-all border border-slate-200 cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
              title="Sign out from Merchant Portal"
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
            onClick={() => setActiveSubTab('intelligence')}
            className={`py-3 px-4 border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'intelligence'
                ? 'border-indigo-600 text-indigo-700 font-bold bg-indigo-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>Market Intelligence & Price Parity</span>
            <span className="px-1.5 py-0.2 rounded-full bg-indigo-100 text-[10px] text-indigo-800 border border-indigo-200">
              {categoryName}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('leads')}
            className={`py-3 px-4 border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'leads'
                ? 'border-blue-600 text-blue-700 font-bold bg-blue-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Lead & Inbound Orders</span>
            <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-[10px] text-blue-800 font-bold">
              {categoryLeadsCount} Leads
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('campaigns')}
            className={`py-3 px-4 border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'campaigns'
                ? 'border-blue-600 text-blue-700 font-bold bg-blue-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Campaign Control & Targeting</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-[10px] text-slate-700 border border-slate-200 font-bold">
              {categoryCampaignsCount} Active
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('analytics')}
            className={`py-3 px-4 border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'analytics'
                ? 'border-emerald-600 text-emerald-700 font-bold bg-emerald-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Sales & ROI Multiplier Calculator</span>
            <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-[10px] text-emerald-800 border border-emerald-200">
              8.4X ROAS
            </span>
          </button>
        </div>
      </header>

      {/* Main Tab Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {activeSubTab === 'intelligence' && <MarketIntelligenceTab />}
        {activeSubTab === 'leads' && <LeadManagementTable />}
        {activeSubTab === 'campaigns' && <CampaignControlTab />}
        {activeSubTab === 'analytics' && <MerchantAnalyticsTab />}
      </main>
    </div>
  );
};
