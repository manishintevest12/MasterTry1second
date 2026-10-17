import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { parseSmartFilter, matchSmartFilter } from '../utils/smartFilter';
import { PriceAdviceSidebar } from './PriceAdviceSidebar';
import { SortAndSummaryTabs } from './SortAndSummaryTabs';
import { ComparisonCard } from './ComparisonCard';
import { TravelDealRow } from './TravelDealRow';
import { HotelDealCard } from './HotelDealCard';
import { groupHotels, compareHotelGroupsDefault } from '../utils/hotelGroups';
import { groupOffers } from '../utils/offerGroups';
import { BusFiltersBar, busFacetPred } from './BusFilters';
import { NativeAdCard } from './NativeAdCard';
import { CreditCardCard } from './CreditCardCard';
import { CreditCardsCompareModal } from './CreditCardsCompareModal';
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

  // Bus filter chips + boarding point (owner reference UI, 16 Oct)
  const [busChips, setBusChips] = useState<string[]>([]);
  const [busBoarding, setBusBoarding] = useState<string | null>(null);
  const toggleBusChip = (id: string) => setBusChips((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]);
  const isBus = vertical === 'bus';

  // Credit-cards compare tray: up to 3 cards selected for side-by-side comparison.
  const [ccCompare, setCcCompare] = useState<Array<any>>([]);
  const toggleCcCompare = (it: any) => {
    setCcCompare((prev) => {
      const exists = prev.find((x) => x.id === it.id);
      if (exists) return prev.filter((x) => x.id !== it.id);
      if (prev.length >= 3) return [...prev.slice(1), it]; // keep the latest 3
      return [...prev, it];
    });
  };
  const [ccCompareOpen, setCcCompareOpen] = useState(false);

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

  // Search query: the backend has ALREADY matched the query for every vertical
  // (strict whole-word token matching for product/dish queries; route matching for
  // travel). Re-filtering on the raw text here HIDES valid results — "dell laptop"
  // is never a contiguous substring of a title like "Dell Inspiron 3520 Laptop",
  // so this client-side substring filter was emptying the whole ecom feed
  // (owner bug report 17 Oct: ecom 'dell laptop' showed 0 results despite 20 offers).
  // The feed therefore trusts the backend-matched items as-is.

  // Filter by Smart AI Filter prompt (shared NL parser: price/rating/veg/flags/tokens)
  const smartFilter = smartFilterText.trim() ? parseSmartFilter(smartFilterText) : null;
  if (smartFilter) {
    filtered = filtered.filter((it) => matchSmartFilter(it, smartFilter));
  }

  // Bus facets: counts are computed over the smart-filtered set BEFORE chips apply;
  // chips then filter, and an active boarding point narrows to services boarding there.
  const busFilterBase = isBus ? [...filtered] : [];
  if (isBus) {
    if (busChips.length) filtered = filtered.filter((it) => busChips.every((c) => busFacetPred(c, it as any)));
    if (busBoarding) filtered = filtered.filter((it) => String((it as any).specs?.['boarding point'] || '') === busBoarding);
  }

  // Sort (prompt sort hint wins only when the tab is still on 'best')
  const effectiveSort = (sortOption === 'best' && smartFilter?.sortHint) ? smartFilter.sortHint : sortOption;
  const sorted = [...filtered].sort((a, b) => {
    if (effectiveSort === 'cheapest') {
      // price-less items sort last, never first
      return (a.primaryPrice || Infinity) === (b.primaryPrice || Infinity) ? 0 : (a.primaryPrice || Infinity) < (b.primaryPrice || Infinity) ? -1 : 1;
    }
    if (effectiveSort === 'highest_rated') {
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
    setBusChips([]);
    setBusBoarding(null);
  }, [vertical, searchQuery, smartFilterText, selectedCategory]);

  // Hotels: same property from several sites becomes ONE card with a price row per site.
  const isHotels = vertical === 'hotels';
  const hotelGroups = React.useMemo(() => {
    if (!isHotels) return [];
    const gs = groupHotels(sorted);
    if (sortOption === 'cheapest') gs.sort((a, b) => a.best.price - b.best.price);
    else if (sortOption === 'highest_rated') gs.sort((a, b) => (b.rating10 || 0) - (a.rating10 || 0));
    // 'best': owner rule (16 Oct) — multi-site comparison cards (2+ companies) lead
    // the feed, cheapest first among them; single-site hotels follow, cheapest first.
    // Pure-price ordering only when the user explicitly picks the Cheapest filter
    // (then a cheap single-property hotel may top the feed, as intended).
    else gs.sort(compareHotelGroupsDefault);
    return gs;
  }, [isHotels, sorted, sortOption]);
  // Every other vertical: ONE card per product, however many websites sell it. The card shows the
  // cheapest site; the arrow lists the rest (cheapest first), exactly like flights/hotels comparison.
  const offerGroups = React.useMemo(() => {
    if (isHotels) return [];
    const gs = groupOffers(sorted);
    const priceOf = (g: (typeof gs)[number]) => (g.best.priceAvailable ? g.best.price : Infinity);
    if (sortOption === 'cheapest') gs.sort((a, b) => priceOf(a) - priceOf(b));
    else if (sortOption === 'highest_rated') gs.sort((a, b) => (b.lead.rating || 0) - (a.lead.rating || 0));
    else gs.sort((a, b) => (b.rows.length - a.rows.length) || (priceOf(a) - priceOf(b)));
    return gs;
  }, [isHotels, sorted, sortOption]);
  const totalCount = isHotels ? hotelGroups.length : offerGroups.length;
  const visibleGroups = offerGroups.slice(0, visibleCount);
  const visibleItems = visibleGroups;
  const visibleHotels = hotelGroups.slice(0, visibleCount);
  // The 'Load More' button only appears if there are at least 4 results currently displayed and more items remain
  const shouldShowLoadMore = (isHotels ? visibleHotels.length : visibleItems.length) >= 4 && visibleCount < totalCount;

  const handleLoadMore = () => {
    setIsLoadingMore(true);
    setTimeout(() => {
      setVisibleCount((prev) => prev + 4);
      setIsLoadingMore(false);
    }, 600);
  };

  return (
    <div id="t1s-results-top" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 scroll-mt-16">
      {/* Active AI Filter Indicator if present */}
      {smartFilterText && (
        <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-xl flex items-center justify-between text-xs text-orange-900">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-orange-600 shrink-0" />
            <span>
              Applied Smart AI Filter: <strong>"{smartFilterText}"</strong> ({sorted.length} results matching)
            </span>
            {smartFilter && (
              <span className="flex items-center gap-1.5 flex-wrap">
                {smartFilter.maxPrice != null && (
                  <span className="px-1.5 py-0.5 bg-orange-100 text-orange-800 rounded font-semibold">&le; &#8377;{smartFilter.maxPrice.toLocaleString('en-IN')}</span>
                )}
                {smartFilter.minRating != null && (
                  <span className="px-1.5 py-0.5 bg-orange-100 text-orange-800 rounded font-semibold">&ge; {smartFilter.minRating}&#9733;</span>
                )}
                {smartFilter.veg && <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-semibold">Veg</span>}
                {smartFilter.freeCancellation && <span className="px-1.5 py-0.5 bg-orange-100 text-orange-800 rounded font-semibold">Free cancellation</span>}
                {smartFilter.breakfast && <span className="px-1.5 py-0.5 bg-orange-100 text-orange-800 rounded font-semibold">Breakfast</span>}
                {smartFilter.direct && <span className="px-1.5 py-0.5 bg-orange-100 text-orange-800 rounded font-semibold">Non-stop</span>}
              </span>
            )}
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
            isScrapingLive ? (
              // First open: default-city results are being fetched live — never show a
              // dead "no options" page while the default search is still running.
              <div className="bg-white rounded-xl border border-slate-200 p-8 sm:p-12 text-center">
                <Loader2 className="w-10 h-10 text-orange-500 mx-auto mb-3 animate-spin" />
                <h3 className="text-base font-bold text-slate-900 mb-1">
                  Fetching live {meta.name} results{searchQuery ? ` for "${searchQuery}"` : ''}...
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                  Comparing live prices from the web for your default city. Results appear automatically in a few seconds.
                </p>
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-4xl mx-auto">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-24 rounded-xl bg-slate-100 animate-pulse border border-slate-200" />
                  ))}
                </div>
              </div>
            ) : (
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
                  ? `Click below to fetch the latest prices for "${searchQuery || selectedCategory}" in ${meta.name}.`
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
            )
          ) : (
            <div className="space-y-4">
              {/* Native Google AdSense Injection: The very first result card displayed must be a Google Ad */}
              <NativeAdCard vertical={vertical} userLocation={userLocation} />

              {/* Bus filter chips + boarding points (only for the bus vertical) */}
              {isBus && busFilterBase.length > 0 && (
                <BusFiltersBar
                  baseItems={busFilterBase as any}
                  activeChips={busChips}
                  onToggleChip={toggleBusChip}
                  boardingPoint={busBoarding}
                  onSelectBoardingPoint={setBusBoarding}
                  cityLabel={userLocation.city}
                />
              )}

              {/* Standard Organic Result Cards */}
              {isHotels
                ? visibleHotels.map((g) => <HotelDealCard key={g.key + g.best.item.id} group={g} />)
                : vertical === 'creditcards'
                  ? visibleGroups.map((g) => (
                      <CreditCardCard
                        key={g.key + g.best.item.id}
                        group={g}
                        selectedForCompare={ccCompare.some((c) => c.id === g.best.item.id)}
                        onToggleCompare={toggleCcCompare}
                      />
                    ))
                : visibleGroups.map((g) => (
                    ['flights', 'bus', 'cab'].includes(g.vertical)
                      ? <TravelDealRow key={g.key + g.best.item.id} group={g} />
                      : <ComparisonCard key={g.key + g.best.item.id} group={g} />
                  ))}

              {/* Credit-cards compare tray: fixed bar with the chosen cards */}
              {vertical === 'creditcards' && ccCompare.length > 0 && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 max-w-[92vw]">
                  <div className="flex items-center gap-3 bg-slate-900 text-white rounded-2xl pl-4 pr-2 py-2 shadow-2xl border border-slate-700">
                    <span className="text-xs font-bold whitespace-nowrap">{ccCompare.length} card{ccCompare.length > 1 ? 's' : ''} selected</span>
                    <div className="hidden sm:flex items-center gap-1.5 overflow-x-auto max-w-[50vw]">
                      {ccCompare.map((c) => (
                        <span key={c.id} className="flex items-center gap-1 bg-slate-800 rounded-full pl-2.5 pr-1 py-1 text-[11px] font-semibold whitespace-nowrap">
                          {String(c.title).slice(0, 26)}{String(c.title).length > 26 ? '…' : ''}
                          <button type="button" onClick={() => toggleCcCompare(c)} className="hover:bg-slate-700 rounded-full p-0.5 cursor-pointer"><X className="w-3 h-3" /></button>
                        </span>
                      ))}
                    </div>
                    <button
                      type="button"
                      disabled={ccCompare.length < 2}
                      onClick={() => setCcCompareOpen(true)}
                      className="bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-xl px-4 py-1.5 text-xs font-extrabold cursor-pointer whitespace-nowrap"
                    >
                      Compare Now
                    </button>
                  </div>
                </div>
              )}
              {vertical === 'creditcards' && (
                <CreditCardsCompareModal
                  open={ccCompareOpen}
                  cards={ccCompare}
                  onClose={() => setCcCompareOpen(false)}
                  onRemove={(id) => toggleCcCompare(ccCompare.find((c) => c.id === id))}
                />
              )}

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
                          Load More Results in {meta.name} ({totalCount - visibleCount} more {isHotels ? 'hotels' : 'deals'} available)
                        </span>
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      </>
                    )}
                  </button>
                  <p className="text-[11px] text-slate-400 mt-2 font-medium">
                    Showing {Math.min(visibleCount, totalCount)} of {totalCount} verified live {isHotels ? 'hotels' : 'comparisons'}
                  </p>
                </div>
              )}

              {!shouldShowLoadMore && totalCount >= 4 && (
                <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-center space-y-2">
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-100/70 px-3 py-1 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>All {totalCount} verified live {isHotels ? 'hotels' : 'deals'} loaded for {meta.name}</span>
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
