import React, { useState } from 'react';
import {
  Globe,
  ExternalLink,
  ShieldCheck,
  Building2,
  Lock,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Link2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const SecretRouteAddressBar: React.FC = () => {
  const {
    activeNavTab,
    navigateToSecretRoute,
    currentSecretRoute,
    isAdminAuthenticated,
    authenticatedVendor,
  } = useApp();

  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Compute current simulated URL
  const currentUrl =
    activeNavTab === 'merchant'
      ? 'https://www.www.try1second.com/merchantinstab2b'
      : activeNavTab === 'admin'
      ? 'https://www.try1second.com/admininsta'
      : 'https://try1second.com/';

  return (
    <div className="bg-slate-900 border-b border-slate-800 text-slate-300 text-xs py-1.5 px-3 sm:px-6 relative z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Left: Simulated Browser URL Indicator */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-950 rounded-lg border border-slate-800 text-slate-300 font-mono text-[11px] truncate">
            <Lock className="w-3 h-3 text-emerald-400 shrink-0" />
            <span className="text-slate-400 select-none">https://</span>
            <span className="font-bold text-white truncate">
              {activeNavTab === 'merchant'
                ? 'www.try1second.com/merchantinstab2b'
                : activeNavTab === 'admin'
                ? 'www.try1second.com/admininsta'
                : 'try1second.com'}
            </span>
          </div>

          {activeNavTab === 'merchant' && (
            <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 text-[10px] font-bold border border-blue-500/30">
              <Building2 className="w-3 h-3" />
              <span>Merchant B2B Gateway (10-Digit ID Access)</span>
            </span>
          )}

          {activeNavTab === 'admin' && (
            <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-500/20 text-orange-300 text-[10px] font-bold border border-orange-500/30">
              <ShieldCheck className="w-3 h-3 text-orange-400" />
              <span>Admin Center (admin@try1second.com Exclusive)</span>
            </span>
          )}
        </div>

        {/* Right: Secret Direct Link Switchers */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-slate-400 font-semibold hidden sm:inline">
            Direct Access Links:
          </span>

          <button
            type="button"
            onClick={() => navigateToSecretRoute('/merchantinstab2b')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
              activeNavTab === 'merchant'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
            }`}
            title="Open Merchant B2B Portal (www.try1second.com/merchantinstab2b)"
          >
            <Building2 className="w-3 h-3" />
            <span>/merchantinstab2b</span>
          </button>

          <button
            type="button"
            onClick={() => navigateToSecretRoute('/admininsta')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
              activeNavTab === 'admin'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
            }`}
            title="Open Admin Portal (www.try1second.com/admininsta)"
          >
            <ShieldCheck className="w-3 h-3" />
            <span>/admininsta</span>
          </button>

          {(activeNavTab === 'admin' || activeNavTab === 'merchant') && (
            <button
              type="button"
              onClick={() => navigateToSecretRoute('/')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
              title="Return to Public Customer Storefront"
            >
              <span>Storefront</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
