import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Layers,
  MapPin,
  ShieldCheck,
  Zap,
  Sparkles,
  ArrowRight,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Lock,
  Unlock,
  Building2,
  Calendar,
  ExternalLink,
  ChevronDown,
  Sliders,
  DollarSign,
  Package,
  Plane,
  ShoppingBag,
  Utensils,
  Car,
  Landmark,
  Film,
  Bus,
  Search,
  Filter,
  RefreshCw,
  FileText,
  Mail,
  Printer,
  Info,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  VERTICAL_INTELLIGENCE_CONFIGS,
  MOCK_PARITY_SKUS,
  MOCK_PINCODE_PARITY_METRICS,
  MOCK_DAILY_PRICE_TRENDS,
  B2B_TIER_FEATURES,
} from '../../data/marketIntelligenceData';
import {
  PriceParitySkuItem,
  PinCodeParityMetric,
  B2BTier,
} from '../../types';

const VERTICAL_ICONS: Record<string, React.ElementType> = {
  food: Utensils,
  grocery: Zap,
  ecommerce: ShoppingBag,
  flights: Plane,
  hotels: Building2,
  cab: Car,
  loans: Landmark,
  insurance: ShieldCheck,
  movie: Film,
  bus: Bus,
};

export const MarketIntelligenceTab: React.FC = () => {
  const { addToast, authenticatedVendor } = useApp();

  // Active Vertical state locked strictly to authenticated vendor's category
  const vendorVertical = (authenticatedVendor?.vertical || 'food');
  const [activeVertical, setActiveVertical] = useState<string>(vendorVertical);
  const activeConfig = VERTICAL_INTELLIGENCE_CONFIGS[activeVertical] || VERTICAL_INTELLIGENCE_CONFIGS.food;

  // Merchant Brand & Competitor Setup
  const [myBrand, setMyBrand] = useState<string>(() => {
    if (authenticatedVendor?.brandId && activeConfig.availableBrands.includes(authenticatedVendor.brandId)) {
      return authenticatedVendor.brandId;
    }
    return activeConfig.defaultMyBrand;
  });
  const [selectedCompetitor, setSelectedCompetitor] = useState<string>(activeConfig.competitors[0] || 'Competitor');

  // Synchronize when authenticated vendor changes
  React.useEffect(() => {
    if (authenticatedVendor?.vertical && activeVertical !== authenticatedVendor.vertical) {
      setActiveVertical(authenticatedVendor.vertical);
      const cfg = VERTICAL_INTELLIGENCE_CONFIGS[authenticatedVendor.vertical] || VERTICAL_INTELLIGENCE_CONFIGS.food;
      setMyBrand(cfg.defaultMyBrand);
      setSelectedCompetitor(cfg.competitors[0] || 'Competitor');
    }
  }, [authenticatedVendor]);

  // B2B Tier State
  const [b2bTier, setB2bTier] = useState<B2BTier>('pro'); // default to Pro for rich demo experience
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState<boolean>(false);
  const [isExportReportOpen, setIsExportReportOpen] = useState<boolean>(false);

  // Filters
  const [skuSearchQuery, setSkuSearchQuery] = useState<string>('');
  const [skuWinFilter, setSkuWinFilter] = useState<'all' | 'win' | 'tie' | 'loss'>('all');
  const [pincodeCityFilter, setPincodeCityFilter] = useState<string>('all');
  const [pincodeSearchQuery, setPincodeSearchQuery] = useState<string>('');
  const [selectedTrendHover, setSelectedTrendHover] = useState<number | null>(null);

  // When vertical changes, update default brand and competitor
  const handleVerticalChange = (vId: string) => {
    setActiveVertical(vId);
    const cfg = VERTICAL_INTELLIGENCE_CONFIGS[vId] || VERTICAL_INTELLIGENCE_CONFIGS.food;
    setMyBrand(cfg.defaultMyBrand);
    setSelectedCompetitor(cfg.competitors[0] || 'Competitor');
  };

  // SKU dataset for current vertical
  const skus = MOCK_PARITY_SKUS[activeVertical] || MOCK_PARITY_SKUS.food;
  const filteredSkus = skus.filter((sku) => {
    const matchesWin = skuWinFilter === 'all' || sku.winStatus === skuWinFilter;
    const q = skuSearchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      sku.title.toLowerCase().includes(q) ||
      sku.category.toLowerCase().includes(q) ||
      (sku.pincodeAvailability && sku.pincodeAvailability.toLowerCase().includes(q));
    return matchesWin && matchesQuery;
  });

  // Pin-code metrics
  const filteredPincodes = MOCK_PINCODE_PARITY_METRICS.filter((p) => {
    const matchesCity = pincodeCityFilter === 'all' || p.city.toLowerCase() === pincodeCityFilter.toLowerCase();
    const q = pincodeSearchQuery.toLowerCase().trim();
    const matchesQuery = !q || p.pincode.includes(q) || p.locality.toLowerCase().includes(q) || p.city.toLowerCase().includes(q);
    return matchesCity && matchesQuery;
  });

  // Calculate Parity Scorecard
  const totalSkus = skus.length || 1;
  const winCount = skus.filter((s) => s.winStatus === 'win').length;
  const tieCount = skus.filter((s) => s.winStatus === 'tie').length;
  const lossCount = skus.filter((s) => s.winStatus === 'loss').length;
  const parityWinRate = Math.round(((winCount + tieCount) / totalSkus) * 100);
  const directWinRate = Math.round((winCount / totalSkus) * 100);

  // 1-Click Export CSV
  const handleExportParityCSV = () => {
    const headers = [
      'SKU ID',
      'Item Title',
      'Category',
      'Our Brand',
      `Our Price (INR)`,
      `Rival Platform (${selectedCompetitor})`,
      `Competitor Price (INR)`,
      'Price Gap (INR)',
      'Parity Status',
      'Our Stock Status',
      'Rival Stock Status',
      'Buy-Box Won',
      'Our Delivery Fee (INR)',
      'Rival Delivery Fee (INR)',
    ];

    const rows = filteredSkus.map((s) => [
      `"${s.id}"`,
      `"${s.title.replace(/"/g, '""')}"`,
      `"${s.category}"`,
      `"${myBrand}"`,
      s.myPrice,
      `"${s.competitorPlatform}"`,
      s.competitorPrice,
      s.priceDifference,
      `"${s.winStatus.toUpperCase()}"`,
      `"${s.stockStatus}"`,
      `"${s.competitorStockStatus}"`,
      s.buyBoxWon ? 'YES' : 'NO',
      s.deliveryFeeMy || 0,
      s.deliveryFeeComp || 0,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Try1Second_Price_Parity_${activeVertical}_${myBrand}_vs_${selectedCompetitor}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast('success', 'Parity Report Exported', `Generated CSV report for ${myBrand} vs ${selectedCompetitor}.`);
  };

  const handlePrintExecutiveReport = () => {
    setIsExportReportOpen(false);
    window.print();
  };

  // SVG Chart Dimensions
  const chartHeight = 160;
  const chartWidth = 520;
  const minPrice = 360;
  const maxPrice = 440;
  const getY = (val: number) => chartHeight - ((val - minPrice) / (maxPrice - minPrice)) * chartHeight;
  const pointsMy = MOCK_DAILY_PRICE_TRENDS.map((pt, i) => `${(i / (MOCK_DAILY_PRICE_TRENDS.length - 1)) * chartWidth},${getY(pt.myAvgPrice)}`).join(' ');
  const pointsComp = MOCK_DAILY_PRICE_TRENDS.map((pt, i) => `${(i / (MOCK_DAILY_PRICE_TRENDS.length - 1)) * chartWidth},${getY(pt.compAvgPrice)}`).join(' ');

  return (
    <div className="space-y-6 text-slate-900">
      {/* 1. TOP HEADER STRIP: VERTICAL SELECTOR + BRAND COMPETITOR PAIR + TIER SWITCHER (White Theme) */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider mb-2 border border-blue-200">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>B2B Market Intelligence & Automated Price Parity</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
              <span>{activeConfig.verticalLabel} Intelligence Engine</span>
            </h2>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
              Real-time competitive pricing radar across Indian metasearch clusters. Track rival delivery surcharges, SKU buy-box win rate, and pin-code level defeat zones.
            </p>
          </div>

          {/* B2B Tier Switcher & Quick Export Pill */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* Tier Switcher */}
            <div className="bg-slate-100 p-1 rounded-2xl border border-slate-200 flex items-center gap-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setB2bTier('standard')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  b2bTier === 'standard'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Standard</span>
                <span className="text-[10px] text-slate-500 font-mono">(Free)</span>
              </button>

              <button
                type="button"
                onClick={() => setB2bTier('pro')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  b2bTier === 'pro'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-blue-700 hover:text-blue-900'
                }`}
              >
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>Pro Suite</span>
                <span className="text-[9px] bg-blue-500/30 text-white px-1 py-0.2 rounded font-bold uppercase">
                  Active
                </span>
              </button>
            </div>

            {/* Export Report Trigger */}
            <button
              type="button"
              onClick={() => setIsExportReportOpen(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 flex items-center gap-2 cursor-pointer transition-all hover:scale-105 active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Parity Report</span>
            </button>
          </div>
        </div>

        {/* Category Domain Banner: Strictly Locked to Vendor's Registered Category */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="text-xs font-bold text-slate-900">
              Active Category Domain: <span className="text-blue-700">{activeConfig.verticalLabel}</span>
            </span>
            <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-mono font-bold border border-blue-200">
              Category-Locked (Vendor ID: {authenticatedVendor?.vendorIdNumber || 'Verified'})
            </span>
          </div>

          <span className="text-[11px] text-slate-500">
            Competitor pricing and pin-code parity feeds are restricted strictly to <strong>{activeConfig.verticalLabel}</strong>.
          </span>
        </div>

        {/* Merchant Brand vs Rival Platform Configurator */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {/* My Brand Selector */}
            <div className="flex items-center gap-2">
              <span className="text-slate-600 font-semibold">My Platform / Brand:</span>
              <select
                value={myBrand}
                onChange={(e) => setMyBrand(e.target.value)}
                className="px-3 py-1.5 bg-white border border-blue-400 rounded-xl font-extrabold text-blue-700 text-xs focus:outline-hidden focus:border-blue-600 cursor-pointer shadow-2xs"
              >
                {activeConfig.availableBrands.map((b) => (
                  <option key={b} value={b}>
                    {b} (Primary)
                  </option>
                ))}
              </select>
            </div>

            <span className="text-blue-600 font-mono font-black text-sm">VS</span>

            {/* Direct Rival Platform Selector */}
            <div className="flex items-center gap-2">
              <span className="text-slate-600 font-semibold">Benchmark Rival:</span>
              <select
                value={selectedCompetitor}
                onChange={(e) => setSelectedCompetitor(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-800 text-xs focus:outline-hidden focus:border-blue-500 cursor-pointer"
              >
                {activeConfig.competitors.map((c) => (
                  <option key={c} value={c}>
                    {c} (Rival)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Synchronized Real-Time Scrape: Active</span>
          </div>
        </div>
      </div>

      {/* 2. OVERALL "PRICE PARITY SCORECARD" & CORE KPI METRICS (White Theme) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Scorecard Hero Box */}
        <div className="p-5 rounded-2xl bg-blue-50/70 border border-blue-200 shadow-xs space-y-2 md:col-span-1">
          <div className="flex items-center justify-between text-xs text-blue-700 font-bold uppercase tracking-wider">
            <span>Parity Scorecard</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-black text-slate-900 font-mono">
            {parityWinRate}%
          </div>
          <p className="text-xs text-slate-700 leading-snug">
            <strong>{myBrand}</strong> matches or beats <strong>{selectedCompetitor}</strong> on {parityWinRate}% of shared catalogue items.
          </p>
          <div className="pt-2 border-t border-blue-200/60 flex items-center justify-between text-[11px] font-mono">
            <span className="text-emerald-700 font-bold">{directWinRate}% Direct Wins</span>
            <span className="text-rose-700 font-bold">{100 - parityWinRate}% Price Losses</span>
          </div>
        </div>

        {/* Metric 2: Average Price Delta */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1 md:col-span-1">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span>Net Price Gap Delta</span>
            <TrendingDown className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700 font-mono">
            -4.2% Cheaper
          </div>
          <p className="text-[11px] text-slate-600">
            Average customer basket savings on {myBrand} versus {selectedCompetitor}.
          </p>
          <span className="text-[10px] text-emerald-700 font-semibold block pt-1">
            ✓ Top Advantage in Metro Pin-Codes
          </span>
        </div>

        {/* Metric 3: Buy-Box & Availability */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1 md:col-span-1">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span>Buy-Box & Surge Parity</span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600 font-mono">
            78.5%
          </div>
          <p className="text-[11px] text-slate-600">
            Zero-surge rate advantage during peak demand windows.
          </p>
          <span className="text-[10px] text-slate-500 block pt-1">
            Competitor average surge multiplier: 1.22x
          </span>
        </div>

        {/* Metric 4: Competitor Stockout / Rejection Alerts */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1 md:col-span-1">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span>Arbitrage Opportunities</span>
            <Package className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-purple-700 font-mono">
            14 SKUs
          </div>
          <p className="text-[11px] text-slate-600">
            Items currently out of stock or overpriced on {selectedCompetitor}.
          </p>
          <span className="text-[10px] text-purple-700 font-semibold block pt-1">
            ⚡ Ready for promotional push
          </span>
        </div>
      </div>

      {/* 3. VERTICAL-SPECIFIC SKU / DISH / ROUTE PRICE GAP TABLE (White Theme) */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs space-y-4 p-5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-600" />
              <span>Catalog SKU & Price Gap Analysis ({activeConfig.verticalLabel})</span>
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Comparing live price points for top selling items on {myBrand} against {selectedCompetitor}.
            </p>
          </div>

          {/* Table Filters */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={skuSearchQuery}
                onChange={(e) => setSkuSearchQuery(e.target.value)}
                placeholder="Search SKU or route..."
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-blue-500 w-44 sm:w-56"
              />
            </div>

            <select
              value={skuWinFilter}
              onChange={(e) => setSkuWinFilter(e.target.value as any)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-hidden focus:border-blue-500 cursor-pointer"
            >
              <option value="all">All Parity Statuses</option>
              <option value="win">Our Wins (Cheaper)</option>
              <option value="tie">Exact Price Parity</option>
              <option value="loss">Competitor Advantage</option>
            </select>

            <button
              type="button"
              onClick={handleExportParityCSV}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-xl transition-colors cursor-pointer border border-slate-200"
              title="Export SKU comparison to CSV"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Catalog SKU / Description</th>
                <th className="py-3 px-4">{myBrand} Price</th>
                <th className="py-3 px-4">{selectedCompetitor} Price</th>
                <th className="py-3 px-4">Price Gap Delta</th>
                <th className="py-3 px-4">Surge / Fee Delta</th>
                <th className="py-3 px-4">Rival Stock Status</th>
                <th className="py-3 px-4 text-right">Parity State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSkus.map((sku) => {
                return (
                  <tr key={sku.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Catalog SKU */}
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-900 text-xs block">{sku.title}</span>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                        <span>{sku.category}</span>
                        <span>•</span>
                        <span className="font-mono text-slate-600">{sku.unitOrVariant}</span>
                        {sku.pincodeAvailability && (
                          <>
                            <span>•</span>
                            <span className="text-blue-700 font-semibold">{sku.pincodeAvailability}</span>
                          </>
                        )}
                      </div>
                    </td>

                    {/* My Price */}
                    <td className="py-3.5 px-4">
                      <span className="font-mono font-black text-sm text-slate-900">
                        {sku.aprOrInterestMy ? `${sku.aprOrInterestMy}% APR` : `₹${sku.myPrice.toLocaleString('en-IN')}`}
                      </span>
                    </td>

                    {/* Competitor Price */}
                    <td className="py-3.5 px-4">
                      <span className="font-mono font-semibold text-xs text-slate-600">
                        {sku.aprOrInterestComp ? `${sku.aprOrInterestComp}% APR` : `₹${sku.competitorPrice.toLocaleString('en-IN')}`}
                      </span>
                    </td>

                    {/* Price Gap Delta */}
                    <td className="py-3.5 px-4 font-mono font-bold">
                      {sku.winStatus === 'win' && (
                        <span className="text-emerald-700 flex items-center gap-1">
                          <TrendingDown className="w-3.5 h-3.5" />
                          <span>
                            -₹{Math.abs(sku.priceDifference).toLocaleString('en-IN')}{' '}
                            ({Math.round((Math.abs(sku.priceDifference) / sku.competitorPrice) * 100)}% cheaper)
                          </span>
                        </span>
                      )}
                      {sku.winStatus === 'loss' && (
                        <span className="text-rose-700 flex items-center gap-1">
                          <TrendingUp className="w-3.5 h-3.5" />
                          <span>
                            +₹{sku.priceDifference.toLocaleString('en-IN')}{' '}
                            ({Math.round((sku.priceDifference / sku.competitorPrice) * 100)}% higher)
                          </span>
                        </span>
                      )}
                      {sku.winStatus === 'tie' && (
                        <span className="text-slate-500">Exact Parity (₹0)</span>
                      )}
                    </td>

                    {/* Surge / Fee Delta */}
                    <td className="py-3.5 px-4 text-[11px]">
                      {sku.surgeMultiplierComp && sku.surgeMultiplierComp > 1.0 ? (
                        <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          Rival Surging ({sku.surgeMultiplierComp}x)
                        </span>
                      ) : sku.deliveryFeeComp && sku.deliveryFeeComp > (sku.deliveryFeeMy || 0) ? (
                        <span className="text-emerald-700 font-medium">
                          Fee Adv: +₹{(sku.deliveryFeeComp - (sku.deliveryFeeMy || 0))}
                        </span>
                      ) : (
                        <span className="text-slate-500">Parity Fee</span>
                      )}
                    </td>

                    {/* Rival Stock Status */}
                    <td className="py-3.5 px-4">
                      {sku.competitorStockStatus === 'out_of_stock' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1 w-max">
                          <AlertTriangle className="w-3 h-3 text-purple-600" />
                          <span>Rival Out of Stock!</span>
                        </span>
                      ) : sku.competitorStockStatus === 'low_stock' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Rival Low Stock
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-600 font-mono">Available</span>
                      )}
                    </td>

                    {/* Parity State Badge */}
                    <td className="py-3.5 px-4 text-right">
                      {sku.winStatus === 'win' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Cheapest</span>
                        </span>
                      )}
                      {sku.winStatus === 'loss' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <XCircle className="w-3 h-3" />
                          <span>Losing</span>
                        </span>
                      )}
                      {sku.winStatus === 'tie' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          <span>Parity Match</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. PIN-CODE COMPETITOR DEFEAT HEATMAP & TABLE (White Theme) */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-rose-500" />
                <span>Hyperlocal Pin-Code Competitor Defeat Heatmap</span>
              </h3>
              {b2bTier === 'standard' && (
                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-bold border border-amber-200 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  <span>Pro Preview</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Identifies exact postal codes where {selectedCompetitor} beats your pricing or runs targeted surge discounts.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <select
              value={pincodeCityFilter}
              onChange={(e) => setPincodeCityFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-hidden focus:border-blue-500 cursor-pointer"
            >
              <option value="all">All Metro Cities</option>
              <option value="New Delhi">New Delhi</option>
              <option value="Mumbai">Mumbai</option>
              <option value="Bengaluru">Bengaluru</option>
              <option value="Hyderabad">Hyderabad</option>
              <option value="Pune">Pune</option>
              <option value="Chennai">Chennai</option>
            </select>
          </div>
        </div>

        {/* Heatmap Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {filteredPincodes.map((pin) => {
            return (
              <div
                key={pin.pincode}
                className={`p-4 rounded-2xl border transition-all space-y-2 relative overflow-hidden ${
                  pin.isHighDefeatZone
                    ? 'bg-rose-50/70 border-rose-300 ring-1 ring-rose-200'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                {pin.isHighDefeatZone && (
                  <div className="absolute top-0 right-0 bg-rose-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-bl-lg">
                    High Defeat Zone
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="font-mono font-black text-sm text-slate-900">{pin.pincode}</span>
                  <span
                    className={`font-mono font-bold text-xs ${
                      pin.winRatePercent >= 80 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {pin.winRatePercent}% Win Rate
                  </span>
                </div>

                <div>
                  <h4 className="font-bold text-xs text-slate-900 truncate">{pin.locality}</h4>
                  <span className="text-[10px] text-slate-500 font-semibold">{pin.city}</span>
                </div>

                <div className="pt-2 border-t border-slate-200/80 space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Avg Delta:</span>
                    <span
                      className={`font-mono font-bold ${
                        pin.avgPriceDeltaPercent <= 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {pin.avgPriceDeltaPercent <= 0
                        ? `${pin.avgPriceDeltaPercent}% (Our Adv)`
                        : `+${pin.avgPriceDeltaPercent}% (Rival Adv)`}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-500 text-[10px]">
                    <span>Top Losing Category:</span>
                    <span className="text-slate-700 font-medium truncate max-w-[120px]">{pin.topLosingCategory}</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden mt-1">
                  <div
                    className={`h-full rounded-full ${
                      pin.winRatePercent >= 80 ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${pin.winRatePercent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {b2bTier === 'standard' && (
          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <strong className="text-xs font-bold text-slate-900 block">
                  Unlock Pin-Code Granularity for 19,000+ Indian Postal Codes
                </strong>
                <p className="text-[11px] text-slate-600">
                  Standard tier shows top 8 metro sample zones. Upgrade to Pro Suite for automated defeat notifications & live repricing webhooks.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsUpgradeModalOpen(true)}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs rounded-xl shadow-xs cursor-pointer whitespace-nowrap shrink-0"
            >
              Upgrade to Pro (₹49,999/mo)
            </button>
          </div>
        )}
      </div>

      {/* 5. 30-DAY HISTORICAL PRICE TREND LINE GRAPH (SVG VISUALIZATION) (White Theme) */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span>30-Day Historical Price Trend Line Graph</span>
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Tracks daily weighted basket price swings between {myBrand} and {selectedCompetitor}, highlighting surge pricing and flash sales.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1 bg-emerald-600 rounded-full" />
              <span className="text-slate-900 font-bold">{myBrand} (Ours)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1 bg-rose-500 rounded-full" />
              <span className="text-slate-600 font-bold">{selectedCompetitor} (Rival)</span>
            </div>
          </div>
        </div>

        {/* Interactive SVG Chart */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 relative">
          <div className="w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-44 overflow-visible"
            >
              {/* Grid lines */}
              <line x1="0" y1="20" x2={chartWidth} y2="20" stroke="#cbd5e1" strokeDasharray="3 3" />
              <line x1="0" y1="80" x2={chartWidth} y2="80" stroke="#cbd5e1" strokeDasharray="3 3" />
              <line x1="0" y1="140" x2={chartWidth} y2="140" stroke="#cbd5e1" strokeDasharray="3 3" />

              {/* Price labels */}
              <text x="5" y="24" fill="#64748b" fontSize="9" fontFamily="monospace">₹430</text>
              <text x="5" y="84" fill="#64748b" fontSize="9" fontFamily="monospace">₹400</text>
              <text x="5" y="144" fill="#64748b" fontSize="9" fontFamily="monospace">₹370</text>

              {/* Competitor Line (Rose) */}
              <polyline
                fill="none"
                stroke="#f43f5e"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={pointsComp}
              />

              {/* My Brand Line (Emerald) */}
              <polyline
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={pointsMy}
              />

              {/* Data points & Event badges */}
              {MOCK_DAILY_PRICE_TRENDS.map((pt, idx) => {
                const cx = (idx / (MOCK_DAILY_PRICE_TRENDS.length - 1)) * chartWidth;
                const cyMy = getY(pt.myAvgPrice);
                const cyComp = getY(pt.compAvgPrice);

                return (
                  <g
                    key={pt.date}
                    className="cursor-pointer"
                    onMouseEnter={() => setSelectedTrendHover(idx)}
                    onMouseLeave={() => setSelectedTrendHover(null)}
                  >
                    <circle cx={cx} cy={cyMy} r="3.5" fill="#10b981" />
                    <circle cx={cx} cy={cyComp} r="3.5" fill="#f43f5e" />

                    {/* Surge event marker */}
                    {pt.hasSurge && (
                      <circle cx={cx} cy={cyMy} r="6" fill="none" stroke="#f59e0b" strokeWidth="2" />
                    )}

                    {/* Flash sale marker */}
                    {pt.hasFlashSale && (
                      <circle cx={cx} cy={cyMy} r="6" fill="none" stroke="#8b5cf6" strokeWidth="2" />
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Interactive Hover Tooltip Box */}
          {selectedTrendHover !== null && (
            <div className="mt-3 p-3 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between text-xs gap-3">
              <div>
                <span className="font-bold text-slate-900 block">
                  {MOCK_DAILY_PRICE_TRENDS[selectedTrendHover].date} Snapshot
                </span>
                {MOCK_DAILY_PRICE_TRENDS[selectedTrendHover].eventNote && (
                  <span className="text-[11px] text-amber-700 font-medium">
                    📌 {MOCK_DAILY_PRICE_TRENDS[selectedTrendHover].eventNote}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 font-mono">
                <div>
                  <span className="text-slate-500 text-[10px] block">{myBrand} Avg:</span>
                  <span className="text-emerald-700 font-black">
                    ₹{MOCK_DAILY_PRICE_TRENDS[selectedTrendHover].myAvgPrice}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">{selectedCompetitor} Avg:</span>
                  <span className="text-rose-700 font-black">
                    ₹{MOCK_DAILY_PRICE_TRENDS[selectedTrendHover].compAvgPrice}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Delta:</span>
                  <span
                    className={`font-black ${
                      MOCK_DAILY_PRICE_TRENDS[selectedTrendHover].delta <= 0
                        ? 'text-emerald-700'
                        : 'text-rose-700'
                    }`}
                  >
                    {MOCK_DAILY_PRICE_TRENDS[selectedTrendHover].delta <= 0
                      ? `₹${Math.abs(MOCK_DAILY_PRICE_TRENDS[selectedTrendHover].delta)} cheaper`
                      : `+₹${MOCK_DAILY_PRICE_TRENDS[selectedTrendHover].delta} higher`}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: B2B TIER UPGRADE MODAL (White Theme) */}
      {isUpgradeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Upgrade to Pro Market Intelligence Suite</h3>
                  <span className="text-xs text-slate-500">Empower pricing teams with algorithmic advantage</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsUpgradeModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-blue-700 uppercase tracking-wider block font-bold">
                    Pro Enterprise Subscription
                  </span>
                  <span className="text-2xl font-black text-slate-900 font-mono">₹49,999 / month</span>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                  Instant Activation
                </span>
              </div>

              <div className="space-y-2">
                <strong className="text-slate-800 block font-bold">Everything in Pro Suite includes:</strong>
                {B2B_TIER_FEATURES.pro.features.map((feat) => (
                  <div key={feat} className="flex items-start gap-2 text-slate-600">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsUpgradeModalOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setB2bTier('pro');
                  setIsUpgradeModalOpen(false);
                  addToast('success', 'Pro Suite Activated!', 'Unlocked pin-code defeat radar and algorithmic intelligence.');
                }}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl shadow-md shadow-blue-600/20 cursor-pointer"
              >
                Activate Pro Suite Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: EXPORT EXECUTIVE PDF / CSV REPORT (White Theme) */}
      {isExportReportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>Download Price Parity Report</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsExportReportOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Export comprehensive competitive intelligence for <strong>{myBrand}</strong> vs <strong>{selectedCompetitor}</strong> across <strong>{activeConfig.verticalLabel}</strong>.
            </p>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  setIsExportReportOpen(false);
                  handleExportParityCSV();
                }}
                className="w-full p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-between cursor-pointer text-left transition-colors"
              >
                <div>
                  <strong className="text-slate-900 text-xs block">Raw Data CSV Spreadsheet (.csv)</strong>
                  <span className="text-[11px] text-slate-500">Complete itemized SKU prices, delivery surcharges & win status</span>
                </div>
                <Download className="w-4 h-4 text-emerald-600" />
              </button>

              <button
                type="button"
                onClick={handlePrintExecutiveReport}
                className="w-full p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-between cursor-pointer text-left transition-colors"
              >
                <div>
                  <strong className="text-slate-900 text-xs block">Executive Leadership Digest (Printable PDF)</strong>
                  <span className="text-[11px] text-slate-500">Scorecard summary, defeat heatmap and 30-day visual charts</span>
                </div>
                <Printer className="w-4 h-4 text-blue-600" />
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsExportReportOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
