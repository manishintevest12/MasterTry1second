import React, { useState } from 'react';
import {
  ShieldCheck,
  Zap,
  Handshake,
  ExternalLink,
  Award,
  Sparkles,
  CheckCircle,
  ArrowRight,
  TrendingDown,
  Globe,
  Clock,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DirectPartnerItem } from '../types';

export const AffiliatePartnersSection: React.FC = () => {
  const { openPartnerModal, openInfoModal, directPartners, recordPartnerClick, addToast } = useApp();
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'travel' | 'retail' | 'food' | 'finance' | 'cabs'>('all');

  const activePartners = directPartners.filter((p) => p.status !== 'paused');

  const filteredPartners =
    selectedFilter === 'all'
      ? activePartners
      : activePartners.filter((p) => p.category === selectedFilter);

  const handlePartnerClick = (partner: DirectPartnerItem) => {
    recordPartnerClick(partner.id);
    let targetUrl = partner.websiteUrl.trim();
    if (!targetUrl.includes('://')) {
      targetUrl = `https://${targetUrl}`;
    }
    addToast(
      'info',
      `Selected ${partner.name}`,
      `Opening direct deep link to ${partner.name}...`
    );
    try {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    } catch {
      window.location.href = targetUrl;
    }
  };

  return (
    <section className="bg-slate-900 text-white py-16 px-4 sm:px-6 lg:px-8 relative overflow-hidden border-t border-slate-800">
      {/* Decorative gradient glow */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 pb-8 border-b border-slate-800">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-400 text-xs font-bold uppercase tracking-wider mb-3">
              <Handshake className="w-3.5 h-3.5" />
              <span>Direct Partner Directory & Metasearch Network</span>
            </div>
            {/* The exact requested headline */}
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              Directly access our 100+ partners
            </h2>
            <p className="text-sm text-slate-300 mt-2 max-w-2xl leading-relaxed">
              Click on any partner logo below to navigate directly to their official booking portal, airline storefront, or quick-commerce platform with verified zero markup and real-time synchronized pricing.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={openPartnerModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-orange-900/30 transition-all cursor-pointer"
            >
              <Handshake className="w-4 h-4" />
              <span>Become a Direct Partner</span>
            </button>

            <button
              type="button"
              onClick={() => openInfoModal('affiliate')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition-colors cursor-pointer"
            >
              <span>Affiliate Disclosure</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* 4 Trust Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-800">
            <div className="flex items-center gap-2 text-orange-400 text-xs font-semibold mb-1">
              <Zap className="w-4 h-4" />
              <span>Sub-Second Sync</span>
            </div>
            <div className="text-2xl font-black text-white font-mono">{'<'} 1.0s</div>
            <p className="text-[11px] text-slate-400 mt-0.5">Average live price response across 25+ partner APIs</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-800">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>Direct Link Handshake</span>
            </div>
            <div className="text-2xl font-black text-white font-mono">100% Secure</div>
            <p className="text-[11px] text-slate-400 mt-0.5">Direct merchant portals with verified zero extra markup</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-800">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold mb-1">
              <Globe className="w-4 h-4" />
              <span>Direct Navigation</span>
            </div>
            <div className="text-2xl font-black text-white font-mono">1-Click Portal</div>
            <p className="text-[11px] text-slate-400 mt-0.5">Click any logo to open the partner website immediately</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-800">
            <div className="flex items-center gap-2 text-sky-400 text-xs font-semibold mb-1">
              <CheckCircle className="w-4 h-4" />
              <span>Verified Directory</span>
            </div>
            <div className="text-2xl font-black text-white font-mono">{activePartners.length}+ Brands</div>
            <p className="text-[11px] text-slate-400 mt-0.5">Airlines, hotels, e-commerce, dark stores & mobility</p>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 scrollbar-none text-xs">
          <button
            type="button"
            onClick={() => setSelectedFilter('all')}
            className={`px-3.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
              selectedFilter === 'all'
                ? 'bg-orange-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            All Partners ({activePartners.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter('travel')}
            className={`px-3.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
              selectedFilter === 'travel'
                ? 'bg-orange-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Travel & Transit (Flights, Hotels, Bus)
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter('retail')}
            className={`px-3.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
              selectedFilter === 'retail'
                ? 'bg-orange-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            E-Commerce & 10-Min Grocery
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter('food')}
            className={`px-3.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
              selectedFilter === 'food'
                ? 'bg-orange-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Food Delivery & Cinema
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter('finance')}
            className={`px-3.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
              selectedFilter === 'finance'
                ? 'bg-orange-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Banking & Insurance
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter('cabs')}
            className={`px-3.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
              selectedFilter === 'cabs'
                ? 'bg-orange-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Cabs & Mobility
          </button>
        </div>

        {/* Partners Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredPartners.map((partner) => (
            <div
              key={partner.id}
              className="p-4 rounded-xl bg-slate-800/70 border border-slate-700/60 hover:border-orange-500/50 hover:bg-slate-800 transition-all group flex flex-col justify-between relative overflow-hidden"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Clickable Logo: Navigates directly to partner website on click */}
                    <button
                      type="button"
                      onClick={() => handlePartnerClick(partner)}
                      title={`Click to open ${partner.name} website (${partner.websiteUrl})`}
                      className={`w-11 h-11 rounded-xl ${partner.logoBg} ${
                        partner.textColor || 'text-white'
                      } flex items-center justify-center font-black text-xs shrink-0 shadow-md tracking-tight cursor-pointer hover:scale-110 active:scale-95 transition-all ring-1 ring-white/10 group-hover:ring-2 group-hover:ring-orange-500 relative`}
                    >
                      <span>{partner.logoText}</span>
                      <ExternalLink className="w-2.5 h-2.5 absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>

                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => handlePartnerClick(partner)}
                        className="font-bold text-white text-sm group-hover:text-orange-400 transition-colors text-left block truncate cursor-pointer"
                      >
                        {partner.name}
                      </button>
                      <span className="text-[10px] text-slate-400 font-medium block truncate">
                        {partner.categoryLabel}
                      </span>
                    </div>
                  </div>

                  <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-sm shrink-0">
                    {partner.badge}
                  </span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed mb-3">
                  {partner.description}
                </p>
              </div>

              {/* Bottom Row: Direct Website Navigation Link & Status */}
              <div className="pt-3 border-t border-slate-700/50 flex items-center justify-between text-[11px] text-slate-400">
                <span className="inline-flex items-center gap-1 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Sync
                </span>

                {/* Direct Deep Link CTA: Select */}
                <button
                  type="button"
                  onClick={() => handlePartnerClick(partner)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white font-extrabold text-xs rounded-lg shadow-sm hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  title={`Select ${partner.name}`}
                >
                  <span>Select</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
