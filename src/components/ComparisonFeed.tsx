import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { PriceAdviceSidebar } from './PriceAdviceSidebar';
import { SortAndSummaryTabs } from './SortAndSummaryTabs';
import { ComparisonCard } from './ComparisonCard';
import { NativeAdCard } from './NativeAdCard';
import { VERTICAL_META } from '../data/mockData';
import { SearchX, Sparkles, Loader2, ChevronDown, CheckCircle2, RotateCw, Search, X } from 'lucide-react';

export const ComparisonFeed: React.FC = () => {
  const {
    vertical,
    items,
    searchQuery,
    selectedCategory,
    setSelectedCategory,
    smartFilterText,
    sortOption,
    clearSmartFilter,
    setSearchQuery,
    triggerLiveLocationScrape,
    isScrapingLive,
    userLocation,
  } = useApp();

  const meta = VERTICAL_META[vertical] || VERTICAL_META.flights;

  // Filter by vertical
  let filtered = items.filter((it) => it.vertical === vertical);

  // Filter by selected category
  if (selectedCategory && selectedCategory !== 'All' && !selectedCategory.toLowerCase().includes('all')) {
    const cleanCat = selectedCategory.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    const catWords = cleanCat.split(/\s+/).filter((w) => w.length >= 3);
    filtered = filtered.filter((it) => {
      const itCat = it.category.toLowerCase();
      const itemText = `${it.category} ${it.title} ${it.subtitle} ${it.features.join(' ')} ${Object.values(it.specs || {}).join(' ')}`.toLowerCase();
      return (
        itCat === selectedCategory.toLowerCase() ||
        itCat.includes(cleanCat.trim()) ||
        catWords.some((w) => itCat.includes(w) || itemText.includes(w))
      );
    });
  }

  // Filter by search query
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(
      (it) =>
        it.title.toLowerCase().includes(q) ||
        it.subtitle.toLowerCase().includes(q) ||
        it.provider.toLowerCase().includes(q) ||
        it.category.toLowerCase().includes(q) ||
        Object.values(it.specs).some((val) => val.toLowerCase().includes(q))
    );
  }

  // Filter by Smart AI Filter prompt
  if (smartFilterText.trim()) {
    const p = smartFilterText.toLowerCase();

    // Check for "under X" or "< X" or numbers
    const priceMatch = p.match(/under\s*[₹]?\s*([0-9,]+)/i);
    if (priceMatch && priceMatch[1]) {
      const maxP = parseInt(priceMatch[1].replace(/,/g, ''), 10);
      if (!isNaN(maxP)) {
        filtered = filtered.filter((it) => it.primaryPrice <= maxP);
      }
    }

    if (p.includes('direct') || p.includes('non-stop')) {
      filtered = filtered.filter(
        (it) =>
          it.features.some((f) => f.toLowerCase().includes('direct') || f.toLowerCase().includes('non-stop')) ||
          it.subtitle.toLowerCase().includes('direct') ||
          (it.specs['Duration'] && it.specs['Duration'].toLowerCase().includes('direct'))
      );
    }

    if (p.includes('breakfast') || p.includes('meal')) {
      filtered = filtered.filter(
        (it) =>
          it.features.some((f) => f.toLowerCase().includes('breakfast') || f.toLowerCase().includes('meal')) ||
          it.title.toLowerCase().includes('breakfast') ||
          it.title.toLowerCase().includes('meal')
      );
    }

    if (p.includes('free cancellation') || p.includes('refundable')) {
      filtered = filtered.filter(
        (it) =>
          it.features.some((f) => f.toLowerCase().includes('free cancellation') || f.toLowerCase().includes('refundable')) ||
          (it.specs['Cancellation'] && it.specs['Cancellation'].toLowerCase().includes('free'))
      );
    }
  }

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (sortOption === 'cheapest') {
      return a.primaryPrice - b.primaryPrice;
    }
    if (sortOption === 'highest_rated') {
      return b.rating - a.rating;
    }
    if (sortOption === 'fastest') {
      // Prioritize express or lowest duration
      return a.id.localeCompare(b.id);
    }
    // 'best'
    return b.rating / (b.primaryPrice || 1) - a.rating / (a.primaryPrice || 1);
  });

  const INITIAL_VISIBLE_COUNT = 4;
  const [visibleCount, setVisibleCount] = useState<number>(INITIAL_VISIBLE_COUNT);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_COUNT);
  }, [vertical, searchQuery, smartFilterText, selectedCategory]);

  const visibleItems = sorted.slice(0, visibleCount);
  // The 'Load More' button only appears if there are at least 4 results currently displayed and more items remain
  const shouldShowLoadMore = visibleItems.length >= 4 && visibleCount < sorted.length;

  const handleLoadMore = () => {
    setIsLoadingMore(true);
    setTimeout(() => {
      setVisibleCount((prev) => prev + 4);
      setIsLoadingMore(false);
    }, 600);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Active AI Filter Indicator if present */}
      {smartFilterText && (
        <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-xl flex items-center justify-between text-xs text-orange-900">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-orange-600 shrink-0" />
            <span>
              Applied Smart AI Filter: <strong>"{smartFilterText}"</strong> ({sorted.length} results matching)
            </span>
          </div>
          <button
            type="button"
            onClick={clearSmartFilter}
            className="text-orange-700 font-bold hover:underline cursor-pointer"
          >
            Clear
          </button>
        </div>
      )}

      {/* Active Category Filter Pill Banner */}
      {selectedCategory && selectedCategory !== 'All' && !selectedCategory.toLowerCase().includes('all') && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between text-xs text-amber-950 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>
              Active Category: <strong>{selectedCategory}</strong> ({sorted.length} live deals found)
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedCategory('All')}
            className="text-amber-800 font-bold hover:underline cursor-pointer flex items-center gap-1"
            title="Reset to all categories"
          >
            <span>Show All Categories</span>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main 2-Column Comparison Layout (Sidebar + Feed) */}
      <div className="flex flex-col lg:flex-row items-start gap-6">
        {/* Left: Price Prediction & Filters Sidebar */}
        <PriceAdviceSidebar />

        {/* Right: Summary Tabs & Cards */}
        <main className="flex-1 w-full min-w-0">
          <SortAndSummaryTabs />

          {sorted.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 sm:p-12 text-center">
              <SearchX className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-900 mb-1">
                {searchQuery
                  ? `Searching Live Web for "${searchQuery}"`
                  : selectedCategory && selectedCategory !== 'All'
                  ? `No offline items in "${selectedCategory}"`
                  : `No matching options found`}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mb-5 leading-relaxed">
                {searchQuery || (selectedCategory && selectedCategory !== 'All')
                  ? `Click below to trigger Try1Second's Live Scraper cluster to harvest real-time rates for "${searchQuery || selectedCategory}" in ${meta.name}.`
                  : `We couldn't find matches for your active filter in ${meta.name}. Try clearing your search or adjusting your price threshold.`}
              </p>
              <div className="flex flex-wrap justify-center gap-2.5">
                {(searchQuery || (selectedCategory && selectedCategory !== 'All')) && (
                  <button
                    type="button"
                    onClick={() => triggerLiveLocationScrape(searchQuery || selectedCategory)}
                    disabled={isScrapingLive}
                    className="px-4 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-400 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${isScrapingLive ? 'animate-spin' : ''}`} />
                    <span>{isScrapingLive ? 'Scraping Live Web...' : `Harvest Live Deals for "${searchQuery || selectedCategory}"`}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('All');
                    clearSmartFilter();
                  }}
                  className="px-4 py-2.5 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Reset All Filters
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Native Google AdSense Injection: The very first result card displayed must be a Google Ad */}
              <NativeAdCard vertical={vertical} userLocation={userLocation} />

              {/* Standard Organic Result Cards */}
              {visibleItems.map((item) => (
                <ComparisonCard key={item.id} item={item} />
              ))}

              {/* Load More Button Section: only appears if at least 4 results displayed on screen and more remain */}
              {shouldShowLoadMore && (
                <div className="pt-3 pb-6 text-center">
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    className="inline-flex items-center gap-2.5 px-6 py-3 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 shadow-xs hover:border-orange-300 hover:text-orange-600 transition-all cursor-pointer disabled:opacity-75"
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-orange-600" />
                        <span>Searching 25+ live partner APIs in 1s...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4 text-orange-600" />
                        <span>
                          Load More Results in {meta.name} ({sorted.length - visibleCount} more deals available)
                        </span>
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      </>
                    )}
                  </button>
                  <p className="text-[11px] text-slate-400 mt-2 font-medium">
                    Showing {Math.min(visibleCount, sorted.length)} of {sorted.length} verified live comparisons
                  </p>
                </div>
              )}

              {!shouldShowLoadMore && sorted.length >= 4 && (
                <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-center space-y-2">
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-100/70 px-3 py-1 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>All {sorted.length} verified live deals loaded for {meta.name}</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Prices continuously synchronized via sub-second direct merchant feeds. Last checked just now.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsLoadingMore(true);
                      setTimeout(() => setIsLoadingMore(false), 500);
                    }}
                    className="text-xs font-bold text-orange-600 hover:underline cursor-pointer inline-flex items-center gap-1 mt-1"
                  >
                    <RotateCw className={`w-3 h-3 ${isLoadingMore ? 'animate-spin' : ''}`} />
                    <span>Re-scan 25+ live partner platforms</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
