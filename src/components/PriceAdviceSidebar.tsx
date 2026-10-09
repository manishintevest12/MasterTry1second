import React, { useState } from 'react';
import {
  TrendingUp,
  Info,
  Sparkles,
  SlidersHorizontal,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { VERTICAL_META } from '../data/mockData';
import { SponsoredSidebarTopPick } from './SponsoredSidebarTopPick';

export const PriceAdviceSidebar: React.FC = () => {
  const {
    vertical,
    items,
    trackedItemIds,
    toggleTrackPrice,
    smartFilterText,
    applySmartFilter,
    clearSmartFilter,
    userLocation,
  } = useApp();

  const meta = VERTICAL_META[vertical] || VERTICAL_META.flights;
  const currentVerticalItems = items.filter((it) => it.vertical === vertical);

  // Check if primary item or all items are tracked
  const firstItemId = currentVerticalItems[0]?.id;
  const isCurrentlyTracked = firstItemId ? trackedItemIds.includes(firstItemId) : false;

  const [aiInput, setAiInput] = useState<string>(smartFilterText || '');
  const [smartFilterExpanded, setSmartFilterExpanded] = useState<boolean>(true);
  const [maxPrice, setMaxPrice] = useState<number>(50000);
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);

  // Collect unique sellers for current vertical
  const allVendors = Array.from(
    new Set(
      currentVerticalItems.flatMap((it) => it.sellerQuotes.map((q) => q.sellerName))
    )
  );

  const handleSmartFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (aiInput.trim()) {
      applySmartFilter(aiInput.trim());
    } else {
      clearSmartFilter();
    }
  };

  const toggleVendor = (vendor: string) => {
    setSelectedVendors((prev) =>
      prev.includes(vendor) ? prev.filter((v) => v !== vendor) : [...prev, vendor]
    );
  };

  // Determine aggregate advice for this vertical
  const primaryItem = currentVerticalItems[0];
  const advice = primaryItem?.pricePrediction.advice || 'book_now';
  const headline = primaryItem?.pricePrediction.headline || 'Prices are unlikely to drop';
  const details = primaryItem?.pricePrediction.details || 'Historical demand predicts rate increases closer to booking date.';

  return (
    <aside className="w-full lg:w-72 shrink-0 space-y-4">
      {/* 1. Kayak-Style "Book Now / Price Advice" Module */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
        <div className="flex items-start gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-slate-900">
                {advice === 'book_now' ? 'Book now' : advice === 'wait' ? 'Wait & Track' : 'Fair Price'}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              {headline}
            </p>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500 leading-normal flex items-start gap-1">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
          <span>{details}</span>
        </div>

        {/* Real-time Track Prices Toggle */}
        <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800">Track prices</span>
          <button
            type="button"
            role="switch"
            aria-checked={isCurrentlyTracked}
            onClick={() => {
              if (firstItemId) toggleTrackPrice(firstItemId);
            }}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
              isCurrentlyTracked ? 'bg-orange-600' : 'bg-slate-300'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                isCurrentlyTracked ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* 2. Kayak-Style "Smart Filters" AI Box */}
      <div className="bg-white rounded-xl border border-orange-200/90 p-4 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between cursor-pointer" onClick={() => setSmartFilterExpanded(!smartFilterExpanded)}>
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-orange-600" />
            <h3 className="text-xs font-bold text-slate-900">
              Smart Filters<span className="text-orange-600">.</span>
            </h3>
          </div>
          <button type="button" className="text-slate-400 hover:text-slate-600">
            {smartFilterExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {smartFilterExpanded && (
          <form onSubmit={handleSmartFilterSubmit} className="mt-2.5">
            <p className="text-[11px] text-slate-500 mb-2">
              AI-powered; natural language filter for {meta.name.toLowerCase()}.
            </p>

            <textarea
              rows={3}
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder={`What are you looking for?\nTry something like: ${meta.sampleQueries[0]}`}
              className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-orange-500 focus:outline-hidden transition-all resize-none"
            />

            <div className="mt-2 flex items-center gap-2">
              <button
                type="submit"
                className="flex-1 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer text-center"
              >
                Filter {meta.name}
              </button>
              {aiInput && (
                <button
                  type="button"
                  onClick={() => {
                    setAiInput('');
                    clearSmartFilter();
                  }}
                  className="py-2 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
          </form>
        )}
      </div>

      {/* 3. Sellers & Platforms Filter */}
      {allVendors.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center gap-1.5 mb-3">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
            <h4 className="text-xs font-bold text-slate-900">Platforms & Sellers</h4>
          </div>

          <div className="space-y-2">
            {allVendors.map((vendor) => {
              const isChecked = selectedVendors.includes(vendor);
              return (
                <label
                  key={vendor}
                  className="flex items-center justify-between text-xs text-slate-700 hover:text-slate-900 cursor-pointer select-none"
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleVendor(vendor)}
                      className="rounded-sm border-slate-300 text-orange-600 focus:ring-orange-500"
                    />
                    <span>{vendor}</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold">Active</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* NEW: Premium B2B Sponsored Top Pick (Left Sidebar Placement Below Filters) */}
      <SponsoredSidebarTopPick vertical={vertical} userLocation={userLocation} />

      {/* 4. Try1Second Referral Rewards Guarantee Note */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50/50 rounded-xl border border-amber-200/70 p-3.5 text-xs text-amber-900">
        <div className="font-bold flex items-center gap-1 text-amber-950 mb-1">
          <span>🎁 Referral Rewards Program</span>
        </div>
        <p className="text-[11px] leading-relaxed text-amber-800">
          Earn <strong>1 Point for every new referral</strong> who joins Try1Second! Reach 100 points to unlock an instant guaranteed prize on our reward wheel.
        </p>
      </div>
    </aside>
  );
};
