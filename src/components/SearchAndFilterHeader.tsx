import React, { useState } from 'react';
import {
  Search,
  ArrowLeftRight,
  Calendar,
  Users,
  MapPin,
  Clock,
  Sparkles,
  X,
  ChevronDown,
  SlidersHorizontal,
  Bed,
  Bus,
  ShoppingBag,
  Zap,
  Utensils,
  Film,
  Landmark,
  ShieldCheck,
  Car,
  Filter,
  Check,
  Crosshair,
  Navigation,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { VERTICAL_META } from '../data/mockData';
import { LocationPickerModal } from './LocationPickerModal';
// Lazy: the map bundle (Leaflet) only downloads when the pin picker opens —
// the main bundle stays lean.
const MapPinPicker = React.lazy(() => import('./MapPinPicker'));
import { PINCODE_DATABASE } from '../utils/locationHelper';
import { AutocompleteInput } from './AutocompleteInput';
import { VoiceSearchButton } from './VoiceSearchButton';
import { AUTOCOMPLETE_CATEGORIES } from '../data/autocompleteData';
import { CategoryPickerDropdown } from './CategoryPickerDropdown';
import {
  FOOD_CATEGORIES,
  GROCERY_CATEGORIES,
  ECOM_CATEGORIES,
} from '../data/categoriesData';
import { JourneyDatePickerModal } from './JourneyDatePickerModal';

// ---- Date helpers: all displayed dates are DD-MM-YYYY, always anchored to the real current date ----
const fmtDMY = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
const todayDMY = () => fmtDMY(new Date());

export const SearchAndFilterHeader: React.FC = () => {
  const {
    vertical,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    smartFilterText,
    applySmartFilter,
    clearSmartFilter,
    userLocation,
    detectGpsLocation,
    setMapPickedLocation,
    isGpsLocating,
    triggerLiveLocationScrape,
    items,
    isScrapingLive,
    pendingAssistantSearch,
    setPendingAssistantSearch,
  } = useApp();

  // MOVIES: live now-playing titles from the loaded movie results (real data,
  // not a hardcoded film list) power the movie-name autocomplete.
  // CREDIT CARDS: live issuer names from the loaded card results power the
  // bank-name autocomplete (real issuers only, never a fabricated bank list).
  const ccBankPresets = React.useMemo(() => {
    const banks = Array.from(
      new Set(
        items
          .filter((it: any) => it.vertical === 'creditcards')
          .map((it: any) => String(it.attributes?.bank || '').trim())
          .filter(Boolean),
      ),
    );
    return banks.slice(0, 16);
  }, [items]);

  const movieTitlePresets = React.useMemo(
    () => Array.from(new Set(items.filter((it: any) => it.vertical === 'movie' && it.title).map((it: any) => it.title as string))).slice(0, 16),
    [items],
  );

  const meta = VERTICAL_META[vertical] || VERTICAL_META.flights;

  // Location Modal State
  const [isLocationModalOpen, setIsLocationModalOpen] = useState<boolean>(false);
  const [locationModalContext, setLocationModalContext] = useState<'food' | 'grocery' | 'cab'>('food');
  // Uber-style map pin (owner request 17 Oct): 'pickup' or 'drop' picker for Cab & Ride.
  const [mapPickerMode, setMapPickerMode] = useState<'pickup' | 'drop' | null>(null);

  // Generic and Vertical-specific state
  const [origin, setOrigin] = useState<string>(meta.defaultOrigin || '');
  const [destination, setDestination] = useState<string>(meta.defaultDestination || '');
  const [tripType, setTripType] = useState<'return' | 'oneway'>('return');
  const [dateStr, setDateStr] = useState<string>(() => `${todayDMY()} (Today)`);
  const [passengerCount, setPassengerCount] = useState<number>(1);

  // Interactive Journey Date Picker State
  const [isDatePickerOpen, setIsDatePickerOpen] = useState<boolean>(false);
  const [datePickerContext, setDatePickerContext] = useState<'flights' | 'hotels' | 'bus' | 'movie' | 'cab'>('flights');

  
/** Parse display date strings like "09 Oct – 12 Oct, 2026 (3 Nights)" / "09 Oct, 2026 (Today)" into ISO dates. */
const toIsoDate = (display: string, yearHint?: number): string | undefined => {
  // New canonical format: DD-MM-YYYY
  const dmy = display.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  // Legacy: "09 Oct[, 2026]"
  const m = display.match(/(\d{1,2})\s+([A-Za-z]{3})/);
  if (!m) return undefined;
  const day = Number(m[1]);
  const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(m[2].slice(0, 3));
  if (!day || mon < 0) return undefined;
  const yearMatch = display.match(/(\d{4})/);
  const year = yearMatch ? Number(yearMatch[1]) : (yearHint ?? new Date().getFullYear());
  return `${year}-${String(mon + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};
/** Second date (return / check-out) of a "A – B" display string, if present. */
const toIsoReturn = (display: string): string | undefined => {
  const parts = display.split(/\s[–-]\s/);
  return parts.length > 1 ? toIsoDate(parts[1]) : undefined;
};
const travelDatesFor = (v: string, dep: string, ret?: string) => {
  if (!(v === 'hotels' || v === 'flights' || v === 'bus' || v === 'cab')) return undefined;
  const r = ret ? toIsoDate(ret) : toIsoReturn(dep);
  return { depart: toIsoDate(dep), ...(r ? { return: r } : {}) };
};

const handleSelectJourneyDate = (formattedDate: string) => {
    if (datePickerContext === 'flights') {
      setDateStr(formattedDate);
    } else if (datePickerContext === 'hotels') {
      setHotelDates(formattedDate);
    } else if (datePickerContext === 'bus') {
      setBusDate(formattedDate);
    } else if (datePickerContext === 'movie') {
      setSelectedMovieDate(formattedDate);
    } else if (datePickerContext === 'cab') {
      setCabScheduleDate(formattedDate);
    }
  };

  // Vertical specific controls
  // 1. Food
  const [selectedCuisine, setSelectedCuisine] = useState<string>('All');
  const foodCuisines = ['All', 'Biryani', 'Pizza', 'North Indian', 'Burgers', 'Chinese', 'Healthy'];

  // 2. 10-Min Grocery
  const groceryCategories = ['All Staples', 'Fresh Fruits', 'Dairy & Milk', 'Cooking Oil', 'Breakfast Combos'];

  // 3. Hotels
  const [hotelDestination, setHotelDestination] = useState<string>('Indore, India');
  const [hotelDates, setHotelDates] = useState<string>(() => { const a = new Date(); const b = new Date(); b.setDate(b.getDate() + 3); return `${fmtDMY(a)} – ${fmtDMY(b)} (3 Nights)`; });
  const [hotelGuests, setHotelGuests] = useState<string>('2 Adults · 1 Room');

  // 4. Bus
  const [busFrom, setBusFrom] = useState<string>('Indore (IDR)');
  const [busTo, setBusTo] = useState<string>('Bhopal (BHO)');
  const [busDate, setBusDate] = useState<string>(() => `${todayDMY()} (Today)`);

  // 5. E-commerce
  const [ecomCategory, setEcomCategory] = useState<string>('All Electronics');

  // 6. Movie
  const [movieCity, setMovieCity] = useState<string>('Indore (All Theatres)');
  const [selectedMovieDate, setSelectedMovieDate] = useState<string>(() => `${todayDMY()} (Today)`);

  // 7. Loans
  const [loanAmount, setLoanAmount] = useState<number>(500000);
  const [loanTenure, setLoanTenure] = useState<number>(3);
  const [loanType, setLoanType] = useState<string>('Personal Loan');

  // 8. Insurance
  const [insuranceType, setInsuranceType] = useState<string>('1 Crore Health Cover');
  const [eldestAge, setEldestAge] = useState<number>(30);

  // 9. Cab
  const [cabDrop, setCabDrop] = useState<string>('DLF Cyber City, Gurugram (122002)');
  const [cabScheduleDate, setCabScheduleDate] = useState<string>('Today (Ride Now)');

  /** Backend route parsers need "<from> to <to>"; a bare destination can never resolve a route. */
  const routeQuery = (from: string, to: string) => {
    const clean = (x: string) => String(x || '').replace(/\s*\(\d{5,6}\)\s*$/, '').trim();
    const a = clean(from), b = clean(to);
    return a && b ? `${a} to ${b}` : (b || a);
  };

  // Home AI assistant handoff: fill this vertical's own boxes with what the user asked, then search.
  React.useEffect(() => {
    const p = pendingAssistantSearch;
    if (!p || p.vertical !== vertical) return;
    setPendingAssistantSearch(null);
    const q = p.query;
    const dmy = (iso?: string) => {
      if (!iso) return undefined;
      const [y, m, d] = iso.split('-').map(Number);
      return y && m && d ? `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}` : undefined;
    };
    const split = (text: string) => {
      const sides = text.split(/\s+to\s+/i);
      return sides.length === 2 ? { a: sides[0].trim(), b: sides[1].trim() } : null;
    };
    const dateDisplay = dmy(p.date);
    if (vertical === 'flights') {
      const r = split(q);
      if (r) { setOrigin(r.a); setDestination(r.b); }
      if (dateDisplay) setDateStr(dateDisplay);
    } else if (vertical === 'bus') {
      const r = split(q);
      if (r) { setBusFrom(r.a); setBusTo(r.b); }
      if (dateDisplay) setBusDate(dateDisplay);
    } else if (vertical === 'hotels') {
      setHotelDestination(q);
    }
    setSearchQuery(q);
    triggerLiveLocationScrape(q, undefined, p.date && (vertical === 'flights' || vertical === 'bus' || vertical === 'hotels' || vertical === 'cab') ? { depart: p.date } : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAssistantSearch, vertical]);

  const handleOpenLocationModal = (ctx: 'food' | 'grocery' | 'cab') => {
    setLocationModalContext(ctx);
    setIsLocationModalOpen(true);
  };

  const handleSwapCab = () => {
    // swap pickup and drop
    const prevLocality = userLocation.locality;
    setCabDrop(prevLocality);
  };

  const handleSwapBus = () => {
    const temp = busFrom;
    setBusFrom(busTo);
    setBusTo(temp);
  };

  const handleSwapFlight = () => {
    const temp = origin;
    setOrigin(destination);
    setDestination(temp);
  };

  // Find info from active pincode
  const currentPinInfo = PINCODE_DATABASE[userLocation.pincode];

  // MOBILE: search/filter panel is collapsible. Collapsed by default so results sit at the top
  // of the screen; auto-collapses the moment a search starts, expands again on vertical change.
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  React.useEffect(() => { setMobileFiltersOpen(false); }, [vertical]);
  const wasScrapingRef = React.useRef(false);
  React.useEffect(() => {
    if (isScrapingLive && !wasScrapingRef.current && typeof window !== 'undefined' && window.innerWidth < 640) {
      setMobileFiltersOpen(false);
      // bring the results to the top of the screen
      setTimeout(() => {
        const el = document.getElementById('t1s-results-top');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
    }
    wasScrapingRef.current = isScrapingLive;
  }, [isScrapingLive]);
  const verticalLabel = (VERTICAL_META as any)[vertical]?.name || 'Search';

  return (
    <div className="border-b border-slate-200">
      {/* MOBILE-ONLY toggle bar: collapse / expand all search + filter controls of this vertical */}
      <button
        type="button"
        onClick={() => setMobileFiltersOpen((o) => !o)}
        aria-expanded={mobileFiltersOpen}
        className="sm:hidden w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-white border-b border-slate-200 text-left cursor-pointer"
      >
        <span className="flex items-center gap-2 min-w-0">
          <SlidersHorizontal className="w-4 h-4 text-red-600 shrink-0" />
          <span className="text-xs font-extrabold text-slate-900 truncate">
            {verticalLabel} search & filters
          </span>
          {searchQuery ? (
            <span className="text-[11px] text-slate-500 truncate max-w-[40vw]">· {searchQuery}</span>
          ) : null}
        </span>
        <span className="flex items-center gap-1 text-[11px] font-bold text-red-600 shrink-0">
          {mobileFiltersOpen ? 'Hide' : 'Edit'}
          <ChevronDown className={`w-4 h-4 transition-transform ${mobileFiltersOpen ? 'rotate-180' : ''}`} />
        </span>
      </button>

      <div className={mobileFiltersOpen ? 'block' : 'hidden sm:block'}>
      {/* ========================================================
          1. FOOD DELIVERY SEARCH (EXACT SWIGGY/ZOMATO STYLE + GPS/PINCODE)
          ======================================================== */}
      {vertical === 'food' && (
        <div className="bg-[#fc8019] py-5 px-4 sm:px-6 lg:px-8 shadow-inner">
          <div className="max-w-7xl mx-auto space-y-3">
            {/* The 2-Pill Bar: Left Location Pill + Right Search Input Pill */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
              {/* Left Pill: Enter delivery location via Pincode or GPS */}
              <div className="relative md:w-96 shrink-0 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleOpenLocationModal('food')}
                  className="w-full bg-white rounded-2xl px-4 py-3.5 flex items-center justify-between text-left shadow-md hover:shadow-lg transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <MapPin className="w-5 h-5 text-[#fc8019] fill-[#fc8019] shrink-0" />
                    <div className="truncate">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {userLocation.locality}
                        </span>
                        <span className="text-[10px] font-mono font-bold bg-orange-100 text-orange-800 px-1 rounded-sm">
                          {userLocation.pincode}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 block truncate">
                        {userLocation.isGps ? '📍 Exact GPS Live' : userLocation.city}
                      </span>
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-1 group-hover:text-slate-700" />
                </button>

                {/* Instant 1-Click GPS Button */}
                <button
                  type="button"
                  title="Detect exact GPS location"
                  onClick={detectGpsLocation}
                  disabled={isGpsLocating}
                  className="h-12 px-3 bg-white/20 hover:bg-white/30 text-white rounded-2xl flex items-center gap-1.5 font-bold text-xs shrink-0 cursor-pointer backdrop-blur-xs border border-white/30 transition-all"
                >
                  <Crosshair className={`w-4 h-4 ${isGpsLocating ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">GPS</span>
                </button>
              </div>

              {/* Category Picker Dropdown near search bar */}
              <div className="shrink-0">
                <CategoryPickerDropdown
                  categories={FOOD_CATEGORIES}
                  selectedCategoryId={selectedCategory}
                  onSelectCategory={(cat) => {
                    setSelectedCategory(cat.name);
                    const cleanName = cat.id === 'food-all' ? '' : cat.shortName || cat.name;
                    setSearchQuery(cleanName);
                    if (cleanName) triggerLiveLocationScrape(cleanName);
                  }}
                  accentColor="orange"
                  labelPrefix="Cuisines & Dishes"
                />
              </div>

              {/* Right Pill: Autocomplete Search for restaurant, item or dish */}
              <div className="flex-1 bg-white rounded-2xl px-4 py-2 flex items-center shadow-md hover:shadow-lg transition-all focus-within:ring-2 focus-within:ring-white">
                <VoiceSearchButton
                  onTranscript={(text) => {
                    setSearchQuery(text);
                    triggerLiveLocationScrape(text || searchQuery || selectedCategory);
                  }}
                  accent="orange"
                />
                <AutocompleteInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  onSelect={(val) => {
                    setSearchQuery(val);
                    triggerLiveLocationScrape(val);
                  }}
                  type="food"
                  placeholder={
                    selectedCategory && !selectedCategory.toLowerCase().includes('all')
                      ? `Search in ${selectedCategory}...`
                      : "Search restaurant or dish (e.g. Biryani, Butter Chicken, Pizza, Momos)..."
                  }
                  className="w-full"
                  inputClassName="text-xs font-medium text-slate-900 placeholder:text-slate-400"
                  icon={<Search className="w-4 h-4 text-orange-500" />}
                />
                <button
                  type="button"
                  onClick={() => triggerLiveLocationScrape(searchQuery || selectedCategory)}
                  className="ml-2 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 shadow-xs flex items-center gap-1"
                  title="Search live food deals"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Search</span>
                </button>
              </div>
            </div>

            {/* Hyperlocal Delivery Info & Quick Cuisine Tags */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1 text-white text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold bg-white/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>Est. {currentPinInfo?.avgFoodEtaMins || 26} mins to {userLocation.pincode}</span>
                </span>
                <span className="text-[11px] text-white/90 hidden sm:inline">
                  (Serviced by Zomato & Swiggy Central Kitchens)
                </span>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-none w-full sm:w-auto">
                <span className="text-[11px] font-bold text-white/90 mr-1 shrink-0">Categories ({FOOD_CATEGORIES.length}):</span>
                {FOOD_CATEGORIES.map((cat) => {
                  const isActive =
                    selectedCategory === cat.name ||
                    (cat.id === 'food-all' &&
                      (selectedCategory === 'All' || selectedCategory === 'All Categories'));
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(cat.name);
                        const cleanName = cat.id === 'food-all' ? '' : cat.shortName || cat.name;
                        setSearchQuery(cleanName);
                        if (cleanName) triggerLiveLocationScrape(cleanName);
                      }}
                      className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 shadow-xs shrink-0 ${
                        isActive
                          ? 'bg-white text-orange-700 ring-2 ring-white/70 shadow-md font-black'
                          : 'bg-white/20 hover:bg-white/30 text-white'
                      }`}
                    >
                      <span>{cat.emoji}</span>
                      <span>{cat.shortName || cat.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          2. 10-MIN GROCERY SEARCH (BLINKIT / ZEPTO / INSTAMART)
          ======================================================== */}
      {vertical === 'grocery' && (
        <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 py-5 px-4 sm:px-6 lg:px-8 text-white shadow-inner">
          <div className="max-w-7xl mx-auto space-y-3">
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
              {/* Delivery ETA pill with Pincode and GPS Button */}
              <div className="flex items-center gap-2 shrink-0 md:w-96">
                <button
                  type="button"
                  onClick={() => handleOpenLocationModal('grocery')}
                  className="flex-1 bg-white/15 hover:bg-white/20 backdrop-blur-xs rounded-2xl border border-white/25 px-4 py-3 flex items-center justify-between text-left cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shrink-0">
                      <Zap className="w-4 h-4 fill-slate-950" />
                    </div>
                    <div className="truncate">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-amber-300 uppercase">
                          {currentPinInfo?.avgGroceryEtaMins || 8}-12 Mins
                        </span>
                        <span className="text-[10px] font-mono bg-white/20 text-white font-bold px-1 rounded-sm">
                          {userLocation.pincode}
                        </span>
                      </div>
                      <span className="text-[11px] text-white/90 font-medium block truncate">
                        {userLocation.locality}
                      </span>
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-white/70 ml-1 shrink-0" />
                </button>

                {/* 1-Click GPS */}
                <button
                  type="button"
                  title="Detect doorstep GPS location"
                  onClick={detectGpsLocation}
                  disabled={isGpsLocating}
                  className="h-14 px-3 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-2xl flex items-center gap-1 font-black text-xs shrink-0 cursor-pointer shadow-sm transition-all"
                >
                  <Crosshair className={`w-4 h-4 ${isGpsLocating ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">GPS</span>
                </button>
              </div>

              {/* Category Picker Dropdown near search bar */}
              <div className="shrink-0">
                <CategoryPickerDropdown
                  categories={GROCERY_CATEGORIES}
                  selectedCategoryId={selectedCategory}
                  onSelectCategory={(cat) => {
                    setSelectedCategory(cat.name);
                    const cleanName = cat.id === 'groc-all' ? '' : cat.shortName || cat.name;
                    setSearchQuery(cleanName);
                    if (cleanName) triggerLiveLocationScrape(cleanName);
                  }}
                  accentColor="emerald"
                  labelPrefix="Grocery Aisles"
                />
              </div>

              {/* Big Grocery Autocomplete Search Bar */}
              <div className="flex-1 bg-white rounded-2xl px-4 py-2 flex items-center shadow-md">
                <VoiceSearchButton
                  onTranscript={(text) => {
                    setSearchQuery(text);
                    triggerLiveLocationScrape(text || searchQuery || selectedCategory);
                  }}
                  accent="orange"
                />
                <AutocompleteInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  onSelect={(val) => {
                    setSearchQuery(val);
                    triggerLiveLocationScrape(val);
                  }}
                  type="grocery"
                  placeholder={
                    selectedCategory && !selectedCategory.toLowerCase().includes('all')
                      ? `Search in ${selectedCategory}...`
                      : `Search 'milk', 'mangoes', 'bread', 'oil', 'chips' in ${userLocation.pincode}...`
                  }
                  className="w-full"
                  inputClassName="text-xs font-medium text-slate-900 placeholder:text-slate-400"
                  icon={<Search className="w-4 h-4 text-emerald-700" />}
                />
                <button
                  type="button"
                  onClick={() => triggerLiveLocationScrape(searchQuery || selectedCategory)}
                  className="ml-2 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 shadow-xs flex items-center gap-1"
                  title="Search live grocery deals"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Search</span>
                </button>
              </div>
            </div>

            {/* Dark Store servicing details */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs pt-1">
              <span className="text-[11px] text-emerald-100 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span>
                  Serviced by: <strong>{currentPinInfo?.nearestDarkStores.blinkit || `Blinkit Pod ${userLocation.pincode}`}</strong> & Zepto Pod
                </span>
              </span>

              {/* Quick Grocery Categories */}
              <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-none w-full sm:w-auto">
                <span className="text-[11px] font-bold text-emerald-200 mr-1 shrink-0">Aisles ({GROCERY_CATEGORIES.length}):</span>
                {GROCERY_CATEGORIES.map((cat) => {
                  const isActive =
                    selectedCategory === cat.name ||
                    (cat.id === 'groc-all' &&
                      (selectedCategory === 'All' || selectedCategory === 'All Categories'));
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(cat.name);
                        const cleanName = cat.id === 'groc-all' ? '' : cat.shortName || cat.name;
                        setSearchQuery(cleanName);
                        if (cleanName) triggerLiveLocationScrape(cleanName);
                      }}
                      className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 shadow-xs shrink-0 ${
                        isActive
                          ? 'bg-amber-400 text-slate-950 font-black ring-2 ring-amber-300 shadow-md scale-105'
                          : 'bg-white/15 hover:bg-white/25 text-white border border-white/10'
                      }`}
                    >
                      <span>{cat.emoji}</span>
                      <span>{cat.shortName || cat.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          3. CAB & RIDES SEARCH (UBER / OLA / RAPIDO + GPS PICKUP)
          ======================================================== */}
      {vertical === 'cab' && (
        <div className="bg-slate-950 py-5 px-4 sm:px-6 lg:px-8 text-white shadow-inner">
          <div className="max-w-7xl mx-auto space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-black tracking-wider uppercase text-amber-400 flex items-center gap-1.5">
                <Car className="w-4 h-4" />
                <span>Live Fare & Surge Multiplier Comparison (Uber vs Ola vs Rapido)</span>
              </span>
              <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                Pickup Pincode: {userLocation.pincode}
              </span>
            </div>

            <div className="bg-slate-900 rounded-2xl p-2.5 border border-slate-800 grid grid-cols-1 md:grid-cols-12 gap-2 text-white items-center">
              {/* Pickup Pin with GPS Lock Button directly embedded */}
              <div className="md:col-span-5 flex items-center bg-slate-800 rounded-xl px-3 py-2 text-xs border border-slate-700">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 mr-2.5 shrink-0" />
                <div className="flex-1 min-w-0 mr-2">
                  <span className="text-[9px] text-slate-400 uppercase font-bold block">
                    Pickup Location (GPS / Pin)
                  </span>
                  <input
                    type="text"
                    readOnly
                    value={`${userLocation.locality} (${userLocation.pincode})`}
                    onClick={() => handleOpenLocationModal('cab')}
                    className="w-full bg-transparent focus:outline-hidden font-bold text-white cursor-pointer truncate"
                  />
                </div>

                {/* Instant GPS Pickup Button */}
                <button
                  type="button"
                  title="Detect Exact GPS Pickup Point"
                  onClick={detectGpsLocation}
                  disabled={isGpsLocating}
                  className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0 border border-emerald-500/30"
                >
                  <Crosshair className={`w-3 h-3 ${isGpsLocating ? 'animate-spin' : ''}`} />
                  <span>{userLocation.isGps ? 'GPS Locked' : 'Use GPS'}</span>
                </button>
                <button
                  type="button"
                  title="Pick exact pickup point on the map (drag and drop)"
                  onClick={() => setMapPickerMode('pickup')}
                  className="ml-1 px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0 border border-red-500/30"
                >
                  <MapPin className="w-3 h-3" />
                  <span>Map</span>
                </button>
              </div>

              {/* Swap */}
              <div className="flex justify-center md:col-span-1">
                <button
                  type="button"
                  onClick={handleSwapCab}
                  className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 cursor-pointer"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                </button>
              </div>

              {/* Drop Pin with Autocomplete */}
              <div className="md:col-span-4 flex items-center bg-slate-800 rounded-xl px-3 py-1.5 text-xs border border-slate-700">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 mr-2.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-[9px] text-slate-400 uppercase font-bold block mb-0.5">
                    Drop Destination (Hotspots & Airports)
                  </span>
                  <VoiceSearchButton
  onTranscript={(text) => {
    setCabDrop(text);
    const q = routeQuery(`${userLocation.locality}, ${userLocation.city}`, text);
    setSearchQuery(q);
    triggerLiveLocationScrape(q, undefined, travelDatesFor('cab', dateStr));
  }}
  accent="dark"
/>
                  <AutocompleteInput
                    value={cabDrop}
                    onChange={(val) => {
                      setCabDrop(val);
                      setSearchQuery(val);
                    }}
                    onSelect={(val) => {
                      setCabDrop(val);
                      const q = routeQuery(`${userLocation.locality}, ${userLocation.city}`, val);
                      setSearchQuery(q);
                      triggerLiveLocationScrape(q, undefined, travelDatesFor('cab', dateStr));
                    }}
                    type="location"
                    placeholder="Enter drop destination (e.g. DLF Cyber City, IGI Airport)..."
                    className="w-full"
                    inputClassName="text-xs font-bold text-white placeholder:text-slate-500"
                  />
                </div>
                <button
                  type="button"
                  title="Pick exact drop point on the map (drag and drop)"
                  onClick={() => setMapPickerMode('drop')}
                  className="p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors cursor-pointer shrink-0 border border-red-500/30"
                >
                  <MapPin className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Compare Fares Button */}
              <div className="md:col-span-2">
                <button
                  type="button"
                  onClick={() => {
                    const q = routeQuery(`${userLocation.locality}, ${userLocation.city}`, cabDrop);
                    setSearchQuery(q);
                    triggerLiveLocationScrape(q, undefined, travelDatesFor('cab', dateStr));
                  }}
                  className="w-full py-2.5 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black text-xs rounded-xl transition-colors shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Car className="w-4 h-4" />
                  <span>Compare Fares</span>
                </button>
              </div>
            </div>

            {/* Cab Drop Shortcuts & Schedule Ride Date Trigger */}
            <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 text-xs text-slate-400 py-0.5">
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5">
                <span className="font-semibold text-slate-500 text-[11px] shrink-0">Popular Drops:</span>
                {[
                  'Terminal 3 Airport (110037)',
                  'Cyber City (122002)',
                  'Noida Sec 62 (201309)',
                  'New Delhi Railway Station (110002)',
                ].map((dropShortcut) => (
                  <button
                    key={dropShortcut}
                    type="button"
                    onClick={() => {
                      setCabDrop(dropShortcut);
                      setSearchQuery(dropShortcut);
                    }}
                    className="px-2.5 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium whitespace-nowrap cursor-pointer shrink-0"
                  >
                    {dropShortcut}
                  </button>
                ))}
              </div>

              {/* Schedule Cab Button (Opening JourneyDatePickerModal for present & future dates) */}
              <button
                type="button"
                onClick={() => {
                  setDatePickerContext('cab');
                  setIsDatePickerOpen(true);
                }}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 border border-slate-700"
                title="Schedule ride for today or future date"
              >
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>{cabScheduleDate}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          4. FLIGHTS SEARCH (KAYAK / SKYSCANNER MULTI-CITY / RETURN)
          ======================================================== */}
      {vertical === 'flights' && (
        <div className="bg-slate-100/90 py-4 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto space-y-3">
            <div className="flex items-center gap-2 text-xs">
              <div className="flex items-center bg-white border border-slate-200 p-0.5 rounded-lg">
                <button
                  onClick={() => setTripType('return')}
                  className={`px-3 py-1 font-bold rounded-md transition-colors ${
                    tripType === 'return' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Return
                </button>
                <button
                  onClick={() => setTripType('oneway')}
                  className={`px-3 py-1 font-bold rounded-md transition-colors ${
                    tripType === 'oneway' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  One-way
                </button>
              </div>

              <div className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium text-slate-700">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>1 Adult · Economy</span>
              </div>
            </div>

            {/* Unified Search Capsule (Exact to aflight.jpg) */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-2 shadow-sm flex flex-col md:flex-row items-stretch md:items-center gap-2">
              {/* Origin Chip */}
              <div className="flex-1 bg-slate-50 hover:bg-slate-100/80 rounded-xl px-3 py-2 flex items-center justify-between border border-slate-200 transition-colors">
                <div className="flex items-center flex-1 min-w-0 mr-2">
                  <MapPin className="w-4 h-4 text-orange-600 mr-2 shrink-0" />
                  <VoiceSearchButton
  onTranscript={(text) => {
    setOrigin(text);
    setSearchQuery(routeQuery(text, destination));
  }}
  accent="dark"
/>
                  <AutocompleteInput
                    value={origin}
                    onChange={setOrigin}
                    onSelect={(val) => setOrigin(val)}
                    type="city"
                    placeholder="Origin: e.g. New Delhi (DEL)"
                    className="w-full"
                    inputClassName="text-xs sm:text-sm font-bold text-slate-900"
                  />
                </div>
                {/* 1-Click GPS Airport Detector */}
                <button
                  type="button"
                  onClick={async () => {
                    await detectGpsLocation();
                    const c = userLocation.city?.toLowerCase() || '';
                    if (c.includes('mumbai')) setOrigin('Mumbai (BOM)');
                    else if (c.includes('bengaluru') || c.includes('bangalore')) setOrigin('Bengaluru (BLR)');
                    else if (c.includes('hyderabad')) setOrigin('Hyderabad (HYD)');
                    else if (c.includes('chennai')) setOrigin('Chennai (MAA)');
                    else if (c.includes('kolkata')) setOrigin('Kolkata (CCU)');
                    else if (c.includes('pune')) setOrigin('Pune (PNQ)');
                    else if (c.includes('ahmedabad')) setOrigin('Ahmedabad (AMD)');
                    else if (c.includes('goa')) setOrigin('Goa - Mopa (GOX)');
                    else if (c.includes('jaipur')) setOrigin('Jaipur (JAI)');
                    else if (c.includes('lucknow')) setOrigin('Lucknow (LKO)');
                    else if (c.includes('kochi') || c.includes('cochin')) setOrigin('Kochi / Cochin (COK)');
                    else if (c.includes('chandigarh')) setOrigin('Chandigarh (IXC)');
                    else setOrigin(`${userLocation.city || 'New Delhi (DEL)'}`);
                  }}
                  disabled={isGpsLocating}
                  className="px-2 py-1 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                  title="Detect nearest airport via live GPS"
                >
                  <Crosshair className={`w-3.5 h-3.5 ${isGpsLocating ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">GPS Airport</span>
                </button>
              </div>

              {/* Swap Button */}
              <button
                type="button"
                onClick={handleSwapFlight}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-800 transition-colors cursor-pointer self-center shrink-0"
                title="Swap Origin and Destination"
              >
                <ArrowLeftRight className="w-4 h-4" />
              </button>

              {/* Destination Chip */}
              <div className="flex-1 bg-slate-50 hover:bg-slate-100/80 rounded-xl px-3 py-2 flex items-center border border-slate-200 transition-colors">
                <MapPin className="w-4 h-4 text-orange-600 mr-2 shrink-0" />
                <VoiceSearchButton
  onTranscript={(text) => {
    setDestination(text);
    const q = routeQuery(origin, text);
    setSearchQuery(q);
    triggerLiveLocationScrape(q, undefined, travelDatesFor('flights', dateStr));
  }}
  accent="dark"
/>
                <AutocompleteInput
                  value={destination}
                  onChange={(val) => {
                    setDestination(val);
                    setSearchQuery(val);
                  }}
                  onSelect={(val) => {
                    setDestination(val);
                    const q = routeQuery(origin, val);
                    setSearchQuery(q);
                    triggerLiveLocationScrape(q, undefined, travelDatesFor('flights', dateStr));
                  }}
                  type="city"
                  placeholder="Destination: e.g. Dubai (DXB)"
                  className="w-full"
                  inputClassName="text-xs sm:text-sm font-bold text-slate-900"
                />
              </div>

              {/* Date Capsule Trigger (Opening JourneyDatePickerModal matching image.png) */}
              <button
                type="button"
                onClick={() => {
                  setDatePickerContext('flights');
                  setIsDatePickerOpen(true);
                }}
                className="px-3.5 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-800 transition-colors cursor-pointer shrink-0 text-left"
                title="Click to select dates (Today and future available)"
              >
                <Calendar className="w-4 h-4 text-orange-600 shrink-0" />
                <span className="truncate">{dateStr}</span>
              </button>

              {/* Passengers & Cabin */}
              <div className="hidden xl:flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 border-l border-slate-200 shrink-0 whitespace-nowrap">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>1 adult, Economy</span>
              </div>

              {/* High-Visibility Vibrant Orange Search Button */}
              <button
                type="button"
                onClick={() => {
                  const q = routeQuery(origin, destination);
                  setSearchQuery(q);
                  triggerLiveLocationScrape(q, undefined, travelDatesFor('flights', dateStr));
                }}
                className="px-6 py-2.5 bg-gradient-to-r from-orange-500 via-orange-600 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-black text-xs sm:text-sm rounded-xl shadow-md shadow-orange-500/25 transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 hover:scale-105 active:scale-95"
              >
                <Search className="w-4 h-4" />
                <span>Search</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          5. HOTELS SEARCH (BOOKING.COM / AGODA)
          ======================================================== */}
      {vertical === 'hotels' && (
        <div className="bg-[#003580] py-5 px-4 sm:px-6 lg:px-8 text-white shadow-inner">
          <div className="max-w-7xl mx-auto space-y-3">
            <span className="text-xs font-black tracking-wider uppercase text-amber-300">
              Find 5-Star Suites, Beachfront Resorts & Villas
            </span>

            <div className="bg-amber-400 p-1 rounded-2xl shadow-lg">
              <div className="bg-white rounded-xl p-2 grid grid-cols-1 md:grid-cols-12 gap-2 text-slate-900 items-center">
                <div className="md:col-span-4 flex items-center justify-between bg-slate-50 rounded-lg px-2.5 py-1.5 text-xs border border-slate-200">
                  <div className="flex items-center flex-1 min-w-0 mr-1.5">
                    <Bed className="w-4 h-4 text-[#003580] mr-1.5 shrink-0" />
                    <VoiceSearchButton
  onTranscript={(text) => {
    setHotelDestination(text);
    setSearchQuery(text);
    triggerLiveLocationScrape(text, undefined, travelDatesFor('hotels', hotelDates));
  }}
  accent="dark"
/>
                    <AutocompleteInput
                      value={hotelDestination}
                      onChange={(val) => {
                        setHotelDestination(val);
                        setSearchQuery(val);
                      }}
                      onSelect={(val) => {
                        setHotelDestination(val);
                        setSearchQuery(val);
                        triggerLiveLocationScrape(val, undefined, travelDatesFor('hotels', hotelDates));
                      }}
                      type="hotel-location"
                      placeholder="Where are you going? (e.g. Delhi, Mumbai, Goa, Manali)"
                      className="w-full"
                      inputClassName="text-xs font-bold text-slate-900"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await detectGpsLocation();
                      const loc = `${userLocation.city || 'Goa'}, India`;
                      setHotelDestination(loc);
                      setSearchQuery(loc);
                    }}
                    disabled={isGpsLocating}
                    className="p-1 hover:bg-blue-100 text-[#003580] rounded-md text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                    title="Find stays near my current GPS location"
                  >
                    <Crosshair className={`w-3.5 h-3.5 ${isGpsLocating ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">Near Me</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setDatePickerContext('hotels');
                    setIsDatePickerOpen(true);
                  }}
                  className="md:col-span-4 flex items-center bg-slate-50 hover:bg-slate-100/90 rounded-lg px-2.5 py-1.5 text-xs border border-slate-200 transition-colors cursor-pointer text-left"
                  title="Select Check-in and Check-out Dates"
                >
                  <Calendar className="w-4 h-4 text-blue-700 mr-2 shrink-0" />
                  <div className="truncate">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block leading-none">
                      Check-in & Check-out Date
                    </span>
                    <span className="font-bold text-slate-900 truncate block mt-0.5">
                      {hotelDates}
                    </span>
                  </div>
                </button>

                <div className="md:col-span-2 flex items-center bg-slate-50 rounded-lg px-2.5 py-1.5 text-xs border border-slate-200">
                  <Users className="w-4 h-4 text-slate-500 mr-1.5 shrink-0" />
                  <AutocompleteInput
                    value={hotelGuests}
                    onChange={setHotelGuests}
                    onSelect={(val) => setHotelGuests(val)}
                    presetList={[
                      '1 Adult · 1 Room',
                      '2 Adults · 1 Room',
                      '2 Adults, 1 Child · 1 Room',
                      '3 Adults · 1 Room',
                      '4 Adults · 2 Rooms',
                      'Family Suite (2 Adults + 2 Kids)',
                    ]}
                    placeholder="Guests & Rooms"
                    className="w-full"
                    inputClassName="text-xs font-medium text-slate-800"
                  />
                </div>

                <div className="md:col-span-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery(hotelDestination);
                      triggerLiveLocationScrape(hotelDestination, undefined, travelDatesFor('hotels', hotelDates));
                    }}
                    className="w-full py-2.5 bg-[#003580] hover:bg-[#00224f] text-white font-black text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span>Search Stays</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          6. BUS SEARCH
          ======================================================== */}
      {vertical === 'bus' && (
        <div className="bg-[#d84e55] py-5 px-4 sm:px-6 lg:px-8 text-white shadow-inner">
          <div className="max-w-7xl mx-auto space-y-3">
            <span className="text-xs font-black tracking-wider uppercase text-amber-200">
              India's Largest AC Sleeper & Volvo Bus Comparison
            </span>

            <div className="bg-white rounded-2xl p-2.5 shadow-xl grid grid-cols-1 md:grid-cols-12 gap-2 text-slate-900 items-center">
              <div className="md:col-span-3 flex items-center justify-between bg-slate-50 rounded-xl px-2.5 py-1.5 text-xs border border-slate-200">
                <div className="flex items-center flex-1 min-w-0 mr-1">
                  <Bus className="w-4 h-4 text-[#d84e55] mr-1.5 shrink-0" />
                                    <VoiceSearchButton
                    onTranscript={(text) => {
    setBusFrom(text);
    setSearchQuery(text);
                    }}
                    accent="dark"
                  />
<AutocompleteInput
                    value={busFrom}
                    onChange={setBusFrom}
                    onSelect={(val) => setBusFrom(val)}
                    type="bus-location"
                    placeholder="From (Bengaluru / Harda / Teen Imli Square)"
                    className="w-full"
                    inputClassName="text-xs font-bold text-slate-900"
                  />
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await detectGpsLocation();
                    setBusFrom(userLocation.city || 'Bengaluru (BLR)');
                  }}
                  disabled={isGpsLocating}
                  className="p-1 hover:bg-red-100 text-[#d84e55] rounded-md text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                  title="Detect bus departure city via GPS"
                >
                  <Crosshair className={`w-3.5 h-3.5 ${isGpsLocating ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">GPS</span>
                </button>
              </div>

              <div className="flex justify-center md:col-span-1">
                <button
                  type="button"
                  onClick={handleSwapBus}
                  className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 cursor-pointer"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                </button>
              </div>

              <div className="md:col-span-3 flex items-center bg-slate-50 rounded-xl px-2.5 py-1.5 text-xs border border-slate-200">
                <MapPin className="w-4 h-4 text-[#d84e55] mr-1.5 shrink-0" />
                                <VoiceSearchButton
                  onTranscript={(text) => {
    setBusTo(text);
    const q = routeQuery(busFrom, text);
    setSearchQuery(q);
    triggerLiveLocationScrape(q, undefined, travelDatesFor('bus', busDate));
                  }}
                  accent="dark"
                />
<AutocompleteInput
                  value={busTo}
                  onChange={(val) => {
                    setBusTo(val);
                    setSearchQuery(val);
                  }}
                  onSelect={(val) => {
                    setBusTo(val);
                    const q = routeQuery(busFrom, val);
                    setSearchQuery(q);
                    triggerLiveLocationScrape(q, undefined, travelDatesFor('bus', busDate));
                  }}
                  type="bus-location"
                  placeholder="To (Hyderabad / Manali / Harda)"
                  className="w-full"
                  inputClassName="text-xs font-bold text-slate-900"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  setDatePickerContext('bus');
                  setIsDatePickerOpen(true);
                }}
                className="md:col-span-3 flex items-center bg-slate-50 hover:bg-slate-100/90 rounded-xl px-2.5 py-1.5 text-xs border border-slate-200 transition-colors cursor-pointer text-left"
                title="Select Date of Journey (Today or Future)"
              >
                <Calendar className="w-4 h-4 text-[#d84e55] mr-2 shrink-0" />
                <div className="truncate">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block leading-none">
                    Date of Journey
                  </span>
                  <span className="font-bold text-slate-900 truncate block mt-0.5">
                    {busDate}
                  </span>
                </div>
              </button>

              <div className="md:col-span-2">
                <button
                  type="button"
                  onClick={() => {
                    const q = routeQuery(busFrom, busTo);
                    setSearchQuery(q);
                    triggerLiveLocationScrape(q, undefined, travelDatesFor('bus', busDate));
                  }}
                  className="w-full py-2.5 bg-[#d84e55] hover:bg-[#b83b41] text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                >
                  <span>Find Buses</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          7. E-COMMERCE SEARCH
          ======================================================== */}
      {vertical === 'ecommerce' && (
        <div className="bg-[#232f3e] py-4 px-4 sm:px-6 lg:px-8 text-white shadow-inner">
          <div className="max-w-7xl mx-auto space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
              {/* Category Picker Dropdown near search bar */}
              <div className="shrink-0">
                <CategoryPickerDropdown
                  categories={ECOM_CATEGORIES}
                  selectedCategoryId={selectedCategory}
                  onSelectCategory={(cat) => {
                    setSelectedCategory(cat.name);
                    const cleanName = cat.id === 'ecom-all' ? '' : cat.shortName || cat.name;
                    setSearchQuery(cleanName);
                    if (cleanName) triggerLiveLocationScrape(cleanName);
                  }}
                  accentColor="amber"
                  labelPrefix="Department"
                />
              </div>

              <div className="flex-1 bg-white rounded-xl flex items-center overflow-hidden border border-slate-300 shadow-md">
                                <VoiceSearchButton
                  onTranscript={(text) => {
    setSearchQuery(text);
    triggerLiveLocationScrape(text || selectedCategory);
                  }}
                  accent="blue"
                />
<AutocompleteInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  onSelect={(val) => {
                    setSearchQuery(val);
                    triggerLiveLocationScrape(val);
                  }}
                  type="product"
                  placeholder={
                    selectedCategory && !selectedCategory.toLowerCase().includes('all')
                      ? `Search in ${selectedCategory}...`
                      : "Search Sony WH-1000XM5, iPhone 16 Pro, MacBook Air, OLED TVs..."
                  }
                  className="flex-1"
                  inputClassName="px-4 py-2.5 text-xs text-slate-900 font-medium placeholder:text-slate-400"
                  icon={<Search className="w-4 h-4 text-slate-400" />}
                />
                <button
                  type="button"
                  onClick={() => {
                    triggerLiveLocationScrape(searchQuery || selectedCategory);
                  }}
                  className="bg-[#febd69] hover:bg-[#f3a847] text-slate-950 px-5 py-3 flex items-center justify-center cursor-pointer transition-colors shrink-0"
                  title="Search live ecommerce deals"
                >
                  <Search className="w-4 h-4 font-bold" />
                </button>
              </div>
            </div>

            {/* Quick E-Commerce Departments Strip */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-none text-xs">
              <span className="text-[11px] font-bold text-amber-300 mr-1 shrink-0">Departments ({ECOM_CATEGORIES.length}):</span>
              {ECOM_CATEGORIES.map((cat) => {
                const isActive =
                  selectedCategory === cat.name ||
                  (cat.id === 'ecom-all' &&
                    (selectedCategory === 'All' || selectedCategory === 'All Categories'));
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(cat.name);
                      const cleanName = cat.id === 'ecom-all' ? '' : cat.shortName || cat.name;
                      setSearchQuery(cleanName);
                      if (cleanName) triggerLiveLocationScrape(cleanName);
                    }}
                    className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 shadow-xs shrink-0 ${
                      isActive
                        ? 'bg-amber-400 text-slate-950 font-black ring-2 ring-amber-300 shadow-md scale-105'
                        : 'bg-white/15 hover:bg-white/25 text-white border border-white/10'
                    }`}
                  >
                    <span>{cat.emoji}</span>
                    <span>{cat.shortName || cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          8. MOVIES SEARCH
          ======================================================== */}
      {vertical === 'movie' && (
        <div className="bg-[#333545] py-4 px-4 sm:px-6 lg:px-8 text-white shadow-inner">
          <div className="max-w-7xl mx-auto space-y-3">
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
              <div className="bg-slate-800 rounded-xl px-3 py-1 text-xs font-bold text-white flex items-center justify-between gap-1.5 border border-slate-700 shrink-0 md:w-72">
                <div className="flex items-center flex-1 min-w-0 mr-1">
                  <Film className="w-4 h-4 text-red-500 shrink-0 mr-1.5" />
                                    <VoiceSearchButton
                    onTranscript={(text) => {
    setMovieCity(text);
                    }}
                    accent="dark"
                  />
<AutocompleteInput
                    value={movieCity}
                    onChange={(val) => setMovieCity(val)}
                    onSelect={(val) => setMovieCity(val)}
                    type="city"
                    placeholder="Select Movie City..."
                    className="w-full"
                    inputClassName="text-xs font-bold text-white placeholder:text-slate-400"
                  />
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await detectGpsLocation();
                    setMovieCity(`${userLocation.city || 'Mumbai'} (All Theatres)`);
                  }}
                  disabled={isGpsLocating}
                  className="p-1 hover:bg-slate-700 text-red-400 rounded-md text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                  title="Detect theatres in my city via GPS"
                >
                  <Crosshair className={`w-3.5 h-3.5 ${isGpsLocating ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">GPS</span>
                </button>
              </div>

              <div className="flex-1 bg-white rounded-xl px-3 py-1 flex items-center justify-between text-slate-900 shadow-md">
                                <VoiceSearchButton
                  onTranscript={(text) => {
    setSearchQuery(text);
    triggerLiveLocationScrape(text);
                  }}
                  accent="orange"
                />
<AutocompleteInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  onSelect={(val) => {
                    setSearchQuery(val);
                    triggerLiveLocationScrape(val);
                  }}
                  presetList={
                    movieTitlePresets.length > 0
                      ? movieTitlePresets
                      : AUTOCOMPLETE_CATEGORIES.movie
                  }
                  placeholder="Search for Movies, IMAX 3D, Inox, PVR Director's Cut..."
                  className="w-full"
                  inputClassName="text-xs font-medium text-slate-900"
                  icon={<Search className="w-4 h-4 text-slate-400" />}
                />
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => triggerLiveLocationScrape(searchQuery)}
                  className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  title="Search movies & showtimes"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Search</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDatePickerContext('movie');
                    setIsDatePickerOpen(true);
                  }}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="Select show date (Present and future dates)"
                >
                  <Calendar className="w-3.5 h-3.5 text-red-400" />
                  <span>{selectedMovieDate}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          9. LOANS & EMI CALCULATOR
          ======================================================== */}
      {vertical === 'loans' && (
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 py-5 px-4 sm:px-6 lg:px-8 text-white shadow-inner">
          <div className="max-w-7xl mx-auto space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-bold text-amber-300">Loan Vertical:</span>
              {AUTOCOMPLETE_CATEGORIES.loans.map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setLoanType(t);
                    setSearchQuery(t.split('(')[0].trim());
                  }}
                  className={`px-3 py-1 rounded-lg font-bold text-xs transition-colors ${
                    loanType === t ? 'bg-amber-400 text-slate-950' : 'bg-white/10 hover:bg-white/20 text-white'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
              <div className="flex-1 bg-white rounded-xl px-4 py-2 flex items-center shadow-md">
                                <VoiceSearchButton
                  onTranscript={(text) => {
    setSearchQuery(text);
    triggerLiveLocationScrape(text || loanType.split('(')[0].trim());
                  }}
                  accent="blue"
                />
<AutocompleteInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  onSelect={(val) => {
                    setSearchQuery(val);
                    triggerLiveLocationScrape(val);
                  }}
                  presetList={AUTOCOMPLETE_CATEGORIES.loans}
                  placeholder="Search loan type (e.g. Personal Loan, Home Loan, Business MSME...)"
                  className="w-full"
                  inputClassName="text-xs font-medium text-slate-900 placeholder:text-slate-400"
                  icon={<Search className="w-4 h-4 text-indigo-500" />}
                />
                <button
                  type="button"
                  onClick={() => triggerLiveLocationScrape(searchQuery || loanType.split('(')[0].trim())}
                  className="ml-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 shadow-xs flex items-center gap-1"
                  title="Compare live loan offers"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Compare</span>
                </button>
              </div>
            </div>

            <div className="bg-white/10 rounded-2xl p-4 border border-white/15 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              <div className="md:col-span-5 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300">Required Loan Amount:</span>
                  <strong className="text-amber-300 font-mono text-sm">
                    ₹{loanAmount.toLocaleString('en-IN')}
                  </strong>
                </div>
                <input
                  type="range"
                  min={100000}
                  max={2500000}
                  step={50000}
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(Number(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
              </div>

              <div className="md:col-span-3 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300">Tenure:</span>
                  <strong className="text-white font-mono">{loanTenure} Years</strong>
                </div>
                <input
                  type="range"
                  min={1}
                  max={7}
                  step={1}
                  value={loanTenure}
                  onChange={(e) => setLoanTenure(Number(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
              </div>

              <div className="md:col-span-4 bg-white/15 rounded-xl p-3 flex items-center justify-between border border-white/20">
                <div>
                  <span className="text-[10px] text-slate-300 block uppercase">Est. Monthly EMI</span>
                  <span className="text-base font-black text-emerald-400 font-mono">
                    ₹{Math.round((loanAmount * 0.105) / 12 + loanAmount / (loanTenure * 12)).toLocaleString('en-IN')}/mo
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSearchQuery(loanType.split('(')[0].trim())}
                  className="px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Compare APR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          10. INSURANCE SEARCH
          ======================================================== */}
      {vertical === 'insurance' && (
        <div className="bg-[#0f3d64] py-5 px-4 sm:px-6 lg:px-8 text-white shadow-inner">
          <div className="max-w-7xl mx-auto space-y-3">
            <span className="text-xs font-black tracking-wider uppercase text-emerald-300">
              Compare 1 Crore Health & Zero-Dep Car Policies with 99%+ Settlement
            </span>

            <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
              <div className="flex-1 bg-white rounded-xl px-4 py-2 flex items-center shadow-md">
                                <VoiceSearchButton
                  onTranscript={(text) => {
    setSearchQuery(text);
    triggerLiveLocationScrape(text || insuranceType);
                  }}
                  accent="orange"
                />
<AutocompleteInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  onSelect={(val) => {
                    setSearchQuery(val);
                    triggerLiveLocationScrape(val);
                  }}
                  presetList={AUTOCOMPLETE_CATEGORIES.insurance}
                  placeholder="Search policy (e.g. Term Life, Car Insurance Zero Dep, Family Health...)"
                  className="w-full"
                  inputClassName="text-xs font-medium text-slate-900 placeholder:text-slate-400"
                  icon={<Search className="w-4 h-4 text-emerald-600" />}
                />
                <button
                  type="button"
                  onClick={() => triggerLiveLocationScrape(searchQuery || insuranceType)}
                  className="ml-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 shadow-xs flex items-center gap-1"
                  title="Compare live insurance plans"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Compare</span>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-2.5 shadow-xl grid grid-cols-1 md:grid-cols-12 gap-2 text-slate-900 items-center">
              <div className="md:col-span-4 flex items-center bg-slate-50 rounded-xl px-3 py-2 text-xs border border-slate-200">
                <ShieldCheck className="w-4 h-4 text-emerald-600 mr-2 shrink-0" />
                <select
                  value={insuranceType}
                  onChange={(e) => {
                    setInsuranceType(e.target.value);
                    setSearchQuery(e.target.value.includes('Car') ? 'Car' : 'Health');
                  }}
                  className="w-full bg-transparent focus:outline-hidden font-bold text-slate-900 cursor-pointer text-xs truncate"
                >
                  {AUTOCOMPLETE_CATEGORIES.insurance.map((ins) => (
                    <option key={ins} value={ins}>
                      {ins}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-3 flex items-center bg-slate-50 rounded-xl px-3 py-2.5 text-xs border border-slate-200">
                <Users className="w-4 h-4 text-slate-500 mr-2 shrink-0" />
                <span className="text-slate-500 mr-1">Eldest Age:</span>
                <input
                  type="number"
                  value={eldestAge}
                  onChange={(e) => setEldestAge(Number(e.target.value))}
                  className="w-16 bg-transparent focus:outline-hidden font-bold text-slate-900"
                />
                <span className="text-slate-400">Yrs</span>
              </div>

              <div className="md:col-span-3 flex items-center bg-slate-50 rounded-xl px-3 py-2.5 text-xs border border-slate-200">
                <MapPin className="w-4 h-4 text-slate-500 mr-2 shrink-0" />
                <span className="text-slate-700 font-medium">Pin: {userLocation.pincode} ({userLocation.city})</span>
              </div>

              <div className="md:col-span-2">
                <button
                  type="button"
                  onClick={() => setSearchQuery(insuranceType.includes('Car') ? 'Car' : 'Health')}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors shadow-md cursor-pointer"
                >
                  View Quotes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          9b. CREDIT CARDS quick picks
          ======================================================== */}
      {vertical === 'creditcards' && (
        <div className="bg-gradient-to-r from-slate-900 to-rose-950 py-4 px-4 sm:px-6 lg:px-8 text-white shadow-inner">
          <div className="max-w-7xl mx-auto space-y-3">
            {/* Bank-name search bar: presets are the real issuers present in the loaded card results. */}
            <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
              <div className="flex-1 bg-white rounded-xl px-3 py-1.5 flex items-center gap-1 shadow-md">
                <VoiceSearchButton
                  onTranscript={(text) => {
                    setSearchQuery(text);
                    triggerLiveLocationScrape(text);
                  }}
                  accent="red"
                />
                <AutocompleteInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  onSelect={(val) => {
                    setSearchQuery(val);
                    triggerLiveLocationScrape(val);
                  }}
                  presetList={ccBankPresets.length > 0 ? ccBankPresets : AUTOCOMPLETE_CATEGORIES.creditcards}
                  placeholder="Search cards by bank name (e.g. HDFC, Axis, SBI, ICICI, Kotak)..."
                  className="w-full"
                  inputClassName="text-xs font-medium text-slate-900 placeholder:text-slate-400"
                  icon={<Search className="w-4 h-4 text-rose-500" />}
                />
              </div>
              <button
                type="button"
                onClick={() => triggerLiveLocationScrape(searchQuery)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors shrink-0"
                title="Search credit cards"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Search</span>
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold text-rose-300">Quick picks:</span>
            {AUTOCOMPLETE_CATEGORIES.creditcards.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setSearchQuery(t); triggerLiveLocationScrape(t); }}
                className="px-3 py-1 rounded-lg font-bold text-xs bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                {t}
              </button>
            ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          BOTTOM AI PROMPT PRESETS (COMMON HELPER STRIP)
          ======================================================== */}
      <div className="bg-slate-50 py-2 px-4 sm:px-6 lg:px-8 border-t border-slate-200/80">
        <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto scrollbar-none text-xs">
          <div className="flex items-center gap-1 text-slate-500 font-bold shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-red-600" />
            <span>AI Filters:</span>
          </div>

          {meta.sampleQueries.map((queryPrompt, i) => (
            <button
              key={i}
              type="button"
              onClick={() => applySmartFilter(queryPrompt)}
              className={`px-3 py-1 rounded-full border transition-colors shrink-0 cursor-pointer ${
                smartFilterText === queryPrompt
                  ? 'bg-red-50 border-red-300 text-red-700 font-bold'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'
              }`}
            >
              {queryPrompt}
            </button>
          ))}

          {smartFilterText && (
            <button
              type="button"
              onClick={clearSmartFilter}
              className="text-[11px] font-bold text-rose-600 hover:underline shrink-0 cursor-pointer ml-1"
            >
              Clear Filter
            </button>
          )}
        </div>
      </div>

      </div>

      {/* Uber-style draggable map pin (Cab & Ride, owner request 17 Oct) */}
      <React.Suspense fallback={null}>
      <MapPinPicker
        isOpen={mapPickerMode !== null}
        onClose={() => setMapPickerMode(null)}
        mode={mapPickerMode === 'drop' ? 'drop' : 'pickup'}
        initial={userLocation.coordinates?.lat && userLocation.coordinates?.lng ? userLocation.coordinates : undefined}
        initialLabel={userLocation?.city || undefined}
        onApply={(spot) => {
          if (mapPickerMode === 'pickup') {
            // Exact pin becomes the user's location; every search auto-carries its coordinates.
            setMapPickedLocation(spot);
          } else {
            const dropLabel = spot.locality || spot.address.split(',')[0] || 'Pinned drop';
            const dropText = spot.city && !dropLabel.toLowerCase().includes(spot.city.toLowerCase()) ? `${dropLabel}, ${spot.city}` : dropLabel;
            setCabDrop(dropText);
            const q = routeQuery(`${userLocation.locality}, ${userLocation.city}`, dropText);
            setSearchQuery(q);
            triggerLiveLocationScrape(q, undefined, travelDatesFor('cab', dateStr));
          }
        }}
      />
      </React.Suspense>

      {/* Reusable Location Picker Modal */}
      <LocationPickerModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        title={
          locationModalContext === 'cab'
            ? 'Set Exact Cab Pickup Location'
            : locationModalContext === 'grocery'
            ? 'Set 10-Min Grocery Delivery Address'
            : 'Set Food Delivery Location'
        }
        contextMode={locationModalContext}
      />

      {/* Reusable Journey Date Picker Modal (Exact match to image.png with present/future validation) */}
      <JourneyDatePickerModal
        key={`${datePickerContext}-${isDatePickerOpen}`}
        isOpen={isDatePickerOpen}
        onClose={() => setIsDatePickerOpen(false)}
        title={
          datePickerContext === 'flights'
            ? (tripType === 'return' ? 'Departure & Return Dates' : 'Flight Date')
            : datePickerContext === 'hotels'
            ? 'Check-in & Check-out Dates'
            : datePickerContext === 'bus'
            ? 'Date of Journey'
            : datePickerContext === 'movie'
            ? 'Select Movie Show Date'
            : 'Schedule Ride Date'
        }
        isRange={datePickerContext === 'flights' ? tripType === 'return' : datePickerContext === 'hotels'}
        returnOptional={datePickerContext === 'flights'}
        accentColor={
          datePickerContext === 'flights'
            ? 'orange'
            : datePickerContext === 'hotels'
            ? 'blue'
            : datePickerContext === 'bus'
            ? 'red'
            : 'amber'
        }
        onSelectDate={handleSelectJourneyDate}
      />
    </div>
  );
};
