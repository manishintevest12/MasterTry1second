import React, { useState, useMemo } from 'react';
import {
  Search,
  Zap,
  ExternalLink,
  Star,
  CheckCircle2,
  X,
  ShieldCheck,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { QuickAppPartner } from '../types';

export const QuickAppsView: React.FC = () => {
  const { quickAppPartners, trackQuickAppRedirection } = useApp();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Redirection Modal State
  const [activeRedirectPartner, setActiveRedirectPartner] = useState<QuickAppPartner | null>(null);

  // Extract unique categories for clean category filtering
  const categories = useMemo(() => {
    const set = new Set<string>();
    quickAppPartners.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [quickAppPartners]);

  // Filter partners based on customer search query and category
  const filteredPartners = useMemo(() => {
    return quickAppPartners.filter((partner) => {
      // Search query filter (matches company name, category, or description)
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        partner.name.toLowerCase().includes(q) ||
        partner.category.toLowerCase().includes(q) ||
        partner.description.toLowerCase().includes(q);

      // Category filter
      const matchesCategory = selectedCategory === 'ALL' || partner.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [quickAppPartners, searchQuery, selectedCategory]);

  const handleSelectPartner = (partner: QuickAppPartner) => {
    // 1. Secretly record click & redirection in Admin reporting system
    trackQuickAppRedirection(partner.id);

    // 2. Open clean customer launch modal
    setActiveRedirectPartner(partner);

    // 3. Attempt direct app launch via deep link / web URL
    try {
      const targetUrl = partner.deepLink || partner.webUrl;
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    } catch {
      if (partner.webUrl) {
        window.open(partner.webUrl, '_blank', 'noopener,noreferrer');
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-28 font-sans">
      {/* Top Hero Banner */}
      <section className="bg-white border-b border-slate-200/90 pt-6 pb-6 px-4 sm:px-6 lg:px-8 shadow-xs">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-bold uppercase tracking-wider mb-2">
                <Zap className="w-3.5 h-3.5 text-red-600 fill-red-500" />
                <span>All Apps in One App · Instant Access</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Quick Apps Hub
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
                Directly access India's top food, grocery, shopping, travel & entertainment apps in 1 click without extra downloads.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <div className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-right">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Available Apps</span>
                <span className="text-lg font-black text-slate-900 font-mono">
                  {quickAppPartners.length} Apps
                </span>
              </div>
            </div>
          </div>

          {/* ================= TOP SEARCH BAR ================= */}
          <div className="pt-2">
            <div className="relative max-w-3xl">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="w-5 h-5 text-slate-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search partner apps by name (e.g. Swiggy, Flipkart, Cred, Blinkit, Zomato, MakeMyTrip)..."
                className="w-full pl-11 pr-10 py-3.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border-2 border-slate-200 focus:border-red-500 rounded-2xl text-sm font-semibold text-slate-900 placeholder-slate-400 focus:outline-hidden transition-all shadow-inner"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {searchQuery && (
              <div className="flex items-center justify-between text-xs text-slate-500 mt-2 px-1">
                <span>
                  Showing results for <strong className="text-slate-900">"{searchQuery}"</strong> ({filteredPartners.length} apps found)
                </span>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-red-600 font-bold hover:underline cursor-pointer"
                >
                  Clear Search
                </button>
              </div>
            )}
          </div>

          {/* ================= UPPER QUICK APPS SECTION (COMPANY LOGOS ONLY) ================= */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-red-600 fill-red-500" />
                <span>Quick Apps</span>
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                Tap logo for instant 1-click access
              </span>
            </div>

            {/* Pure Company Logos Rail - Company Logos Only */}
            <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none pt-1">
              {quickAppPartners.map((partner) => (
                <button
                  key={`top-logo-${partner.id}`}
                  type="button"
                  onClick={() => handleSelectPartner(partner)}
                  title={partner.name}
                  className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-2xl p-0.5 bg-slate-50 border border-slate-200 hover:border-red-500 shadow-2xs hover:shadow-md hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer overflow-hidden group"
                >
                  <img
                    src={partner.iconUrl}
                    alt={partner.name}
                    className="w-full h-full object-cover rounded-[14px]"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        partner.name
                      )}&background=ea580c&color=fff&size=120`;
                    }}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Category Filter Pills Strip */}
          {categories.length > 0 && (
            <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all border shadow-2xs ${
                  selectedCategory === 'ALL'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                All Apps ({quickAppPartners.length})
              </button>
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat;
                const count = quickAppPartners.filter((p) => p.category === cat).length;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all border shadow-2xs ${
                      isSelected
                        ? 'bg-red-600 text-white border-red-600 shadow-sm shadow-red-600/20'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <span>{cat}</span>
                    <span className={`text-[10px] ml-1 font-mono ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                      ({count})
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ================= PARTNER APPS GRID ================= */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {filteredPartners.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-lg mx-auto shadow-xs space-y-4">
            <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
              <Search className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No Apps Found</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              No apps match your search <strong>"{searchQuery}"</strong>. Try checking your spelling or search for another brand.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('ALL');
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl cursor-pointer shadow-sm"
            >
              Show All Apps
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPartners.map((partner) => (
              <div
                key={partner.id}
                className="bg-white rounded-2xl border border-slate-200 hover:border-red-400 shadow-xs hover:shadow-md transition-all duration-200 p-4 flex items-center justify-between gap-3 group"
              >
                {/* Company Logo + Name + Category */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    onClick={() => handleSelectPartner(partner)}
                    className="w-13 h-13 rounded-2xl overflow-hidden shrink-0 border border-slate-200/90 shadow-2xs group-hover:scale-105 transition-transform cursor-pointer"
                  >
                    <img
                      src={partner.iconUrl}
                      alt={partner.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                          partner.name
                        )}&background=ea580c&color=fff&size=120`;
                      }}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3
                      onClick={() => handleSelectPartner(partner)}
                      className="font-extrabold text-slate-900 text-sm leading-snug group-hover:text-red-600 transition-colors truncate cursor-pointer"
                    >
                      {partner.name}
                    </h3>
                    <span className="text-[11px] text-slate-500 font-medium truncate block mt-0.5">
                      {partner.category}
                    </span>
                  </div>
                </div>

                {/* Footer Action Button: Select */}
                <button
                  type="button"
                  onClick={() => handleSelectPartner(partner)}
                  className="py-2 px-4 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-extrabold text-xs rounded-xl shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all hover:scale-105 active:scale-95 shrink-0"
                  title={`Select ${partner.name}`}
                >
                  <span>Select</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ================= CLEAN REDIRECTION MODAL ================= */}
      {activeRedirectPartner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm p-6 shadow-2xl text-center space-y-4 animate-in fade-in zoom-in duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Opening Partner App</span>
              </span>
              <button
                type="button"
                onClick={() => setActiveRedirectPartner(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Partner Info Box */}
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200 text-left">
              <img
                src={activeRedirectPartner.iconUrl}
                alt={activeRedirectPartner.name}
                className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <h4 className="font-extrabold text-slate-900 text-sm truncate">
                  {activeRedirectPartner.name}
                </h4>
                <span className="text-[11px] text-slate-500 truncate block">
                  {activeRedirectPartner.category}
                </span>
              </div>
            </div>

            {/* Launch Status */}
            <div className="space-y-1.5 py-1">
              <div className="w-10 h-10 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto animate-pulse">
                <Zap className="w-5 h-5 fill-red-500" />
              </div>
              <h3 className="text-sm font-black text-slate-900">
                Opening {activeRedirectPartner.name}...
              </h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                Taking you directly to {activeRedirectPartner.name}. Enjoy the seamless in-app experience!
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveRedirectPartner(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Close
              </button>
              <a
                href={activeRedirectPartner.webUrl || activeRedirectPartner.deepLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setActiveRedirectPartner(null)}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-xl cursor-pointer shadow-sm"
              >
                Select ↗
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
