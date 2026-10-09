import React from 'react';
import { Sparkles, Zap, Award, MapPin, RotateCw } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const SortAndSummaryTabs: React.FC = () => {
  const {
    vertical,
    items,
    sortOption,
    setSortOption,
    userLocation,
    isScrapingLive,
    lastScrapeInfo,
    triggerLiveLocationScrape,
  } = useApp();

  const currentItems = items.filter((it) => it.vertical === vertical);

  // Compute summary values
  const cheapestItem = [...currentItems].sort((a, b) => a.primaryPrice - b.primaryPrice)[0];
  const highestRatedItem = [...currentItems].sort((a, b) => b.rating - a.rating)[0];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-2 shadow-xs mb-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
        {/* Cheapest Tab */}
        <button
          onClick={() => setSortOption('cheapest')}
          className={`flex flex-col items-start p-3 rounded-lg text-left transition-all cursor-pointer relative ${
            sortOption === 'cheapest'
              ? 'bg-orange-50/70 border-b-2 border-orange-600'
              : 'hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span
              className={`text-xs font-bold ${
                sortOption === 'cheapest' ? 'text-orange-900' : 'text-slate-800'
              }`}
            >
              Cheapest
            </span>
            <span className="text-[10px] uppercase font-semibold text-emerald-700 bg-emerald-50 px-1 rounded-sm">
              Lowest
            </span>
          </div>
          <span className="text-xs text-slate-500 font-mono tabular-nums mt-1 font-semibold">
            ₹{cheapestItem?.primaryPrice.toLocaleString('en-IN') || '—'}
          </span>
        </button>

        {/* Best Tab */}
        <button
          onClick={() => setSortOption('best')}
          className={`flex flex-col items-start p-3 rounded-lg text-left transition-all cursor-pointer relative ${
            sortOption === 'best'
              ? 'bg-orange-50/70 border-b-2 border-orange-600'
              : 'hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span
              className={`text-xs font-bold ${
                sortOption === 'best' ? 'text-orange-900' : 'text-slate-800'
              }`}
            >
              Best Value
            </span>
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <span className="text-xs text-slate-500 font-mono tabular-nums mt-1 font-semibold">
            ₹{cheapestItem?.primaryPrice.toLocaleString('en-IN') || '—'} · Top Pick
          </span>
        </button>

        {/* Quickest / Fastest Tab */}
        <button
          onClick={() => setSortOption('fastest')}
          className={`flex flex-col items-start p-3 rounded-lg text-left transition-all cursor-pointer relative ${
            sortOption === 'fastest'
              ? 'bg-orange-50/70 border-b-2 border-orange-600'
              : 'hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span
              className={`text-xs font-bold ${
                sortOption === 'fastest' ? 'text-orange-900' : 'text-slate-800'
              }`}
            >
              Quickest
            </span>
            <Zap className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <span className="text-xs text-slate-500 font-mono tabular-nums mt-1 font-semibold">
            Instant Express
          </span>
        </button>

        {/* Highest Rated Tab */}
        <button
          onClick={() => setSortOption('highest_rated')}
          className={`flex flex-col items-start p-3 rounded-lg text-left transition-all cursor-pointer relative ${
            sortOption === 'highest_rated'
              ? 'bg-orange-50/70 border-b-2 border-orange-600'
              : 'hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span
              className={`text-xs font-bold ${
                sortOption === 'highest_rated' ? 'text-orange-900' : 'text-slate-800'
              }`}
            >
              Highest Rated
            </span>
            <Award className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <span className="text-xs text-slate-500 font-mono tabular-nums mt-1 font-semibold">
            {highestRatedItem?.rating} ★ ({highestRatedItem?.reviewCount.toLocaleString('en-IN')})
          </span>
        </button>
      </div>

      {/* Live Scraper Engine Status Bar */}
      <div className="mt-2 pt-2 border-t border-slate-100 px-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Live Scraper Cluster</span>
          </span>
          <span className="text-slate-300">·</span>
          <span className="inline-flex items-center gap-1 font-medium text-slate-700">
            <MapPin className="w-3 h-3 text-red-500" />
            <span>Target: <strong>{userLocation.locality || userLocation.city}</strong> ({userLocation.pincode})</span>
          </span>
          <span className="text-slate-300">·</span>
          <span className="font-mono text-slate-500">{lastScrapeInfo.latencyMs}ms</span>
        </div>

        <button
          type="button"
          onClick={() => triggerLiveLocationScrape()}
          disabled={isScrapingLive}
          className="text-xs font-bold text-orange-600 hover:text-orange-700 disabled:text-slate-400 cursor-pointer flex items-center gap-1"
        >
          <RotateCw className={`w-3 h-3 ${isScrapingLive ? 'animate-spin' : ''}`} />
          <span>{isScrapingLive ? 'Scraping Live Web...' : 'Re-scan Live Now'}</span>
        </button>
      </div>
    </div>
  );
};
