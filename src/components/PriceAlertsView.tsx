import React, { useState, useMemo } from 'react';
import {
  Bell,
  Heart,
  TrendingDown,
  TrendingUp,
  ArrowRight,
  Trash2,
  Zap,
  ExternalLink,
  MessageSquare,
  Clock,
  Calendar,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  SlidersHorizontal,
  Plus,
  Flame,
  Search,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { VERTICAL_META } from '../data/mockData';
import { VerticalId, ComparisonItem } from '../types';

export const PriceAlertsView: React.FC = () => {
  const {
    items,
    trackedItemIds,
    toggleTrackPrice,
    simulatePriceDrop,
    openPriceAlertModal,
    setVertical,
    setActiveNavTab,
    startRedirection,
    addToast,
  } = useApp();

  const [selectedVerticalFilter, setSelectedVerticalFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Tracked items list
  const trackedItems = useMemo(() => {
    return items.filter((it) => trackedItemIds.includes(it.id));
  }, [items, trackedItemIds]);

  // Filtered tracked items
  const filteredTrackedItems = useMemo(() => {
    return trackedItems.filter((item) => {
      const matchesVertical = selectedVerticalFilter === 'ALL' || item.vertical === selectedVerticalFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.provider.toLowerCase().includes(q);
      return matchesVertical && matchesSearch;
    });
  }, [trackedItems, selectedVerticalFilter, searchQuery]);

  // Telemetry Metrics
  const metrics = useMemo(() => {
    const totalTracked = trackedItems.length;
    const totalMonitoredValue = trackedItems.reduce((sum, it) => sum + it.primaryPrice, 0);
    const activePriceDrops = trackedItems.filter((it) => it.primaryPrice < it.originalPrice).length;
    const totalSavingsRealized = trackedItems.reduce(
      (sum, it) => sum + Math.max(0, it.originalPrice - it.primaryPrice),
      0
    );
    return { totalTracked, totalMonitoredValue, activePriceDrops, totalSavingsRealized };
  }, [trackedItems]);

  const handleTestWhatsAppPing = (item: ComparisonItem) => {
    addToast(
      'success',
      'WhatsApp Alert Dispatched 💬',
      `Sent instant alert to WhatsApp (+91 98765 43210): "${item.title} dropped to ₹${item.primaryPrice.toLocaleString('en-IN')}".`
    );
  };

  const handleAddSampleTrackers = () => {
    // Add first 4 items to watchlist for instant demonstration
    const candidates = items.slice(0, 4);
    candidates.forEach((c) => {
      if (!trackedItemIds.includes(c.id)) {
        toggleTrackPrice(c.id);
      }
    });
    addToast('success', 'Demo Items Added', 'Added 4 items across verticals to your active price watchlist.');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 font-sans">
      {/* 1. Header with Live Telemetry Badge & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 text-red-700 text-xs font-bold border border-red-200 mb-2">
            <Bell className="w-3.5 h-3.5 text-red-600 animate-pulse" />
            <span>SUB-SECOND MULTI-SKU TELEMETRY ACTIVE</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            My Price Tracker & Watchlist Hub
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 max-w-2xl leading-relaxed">
            Real-time price monitoring across your tracked flights, stays, rides, electronics, food and groceries with instant WhatsApp Business API and Web Push triggers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={simulatePriceDrop}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            <Zap className="w-4 h-4 fill-white" />
            <span>Simulate Live Price Drop</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveNavTab('compare')}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add More Items</span>
          </button>
        </div>
      </div>

      {/* 2. Four KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-semibold text-[11px] uppercase tracking-wider">Active Watchlist</span>
            <Bell className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
            {metrics.totalTracked} SKUs
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Auto-polled every 180ms</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-semibold text-[11px] uppercase tracking-wider">Monitored Value</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
            ₹{metrics.totalMonitoredValue.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">10 Verticals Protected</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-semibold text-[11px] uppercase tracking-wider">Live Price Drops</span>
            <Flame className="w-4 h-4 text-orange-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-600 font-mono">
            {metrics.activePriceDrops} Items Dropped
          </div>
          <span className="text-[10px] text-emerald-700 font-semibold">Immediate Buying Window</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-semibold text-[11px] uppercase tracking-wider">Realized Net Savings</span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-blue-700 font-mono">
            ₹{metrics.totalSavingsRealized.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Against historical baselines</span>
        </div>
      </div>

      {/* 3. Filter Bar & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 text-xs">
          {['ALL', 'flights', 'hotels', 'ecommerce', 'grocery', 'food', 'loans'].map((vKey) => {
            const isSelected = selectedVerticalFilter === vKey;
            const label = vKey === 'ALL' ? 'All Tracked' : VERTICAL_META[vKey as VerticalId]?.name || vKey;
            const count =
              vKey === 'ALL'
                ? trackedItems.length
                : trackedItems.filter((i) => i.vertical === vKey).length;

            return (
              <button
                key={vKey}
                type="button"
                onClick={() => setSelectedVerticalFilter(vKey)}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap cursor-pointer transition-all border ${
                  isSelected
                    ? 'bg-red-600 text-white border-red-600 shadow-sm'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <span>{label}</span>
                <span className={`text-[10px] ml-1 font-mono ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                  ({count})
                </span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tracked items..."
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-red-500"
          />
        </div>
      </div>

      {/* 4. Active Watchlist Grid / Table */}
      {filteredTrackedItems.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-lg mx-auto shadow-xs space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
            <Heart className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Your Price Watchlist is Empty</h3>
          <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
            Click the heart or bell icon on any product, flight, hotel, or grocery basket to receive automated WhatsApp and Push price drop alerts.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleAddSampleTrackers}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs rounded-xl shadow-sm cursor-pointer"
            >
              Add Demo Items to Watchlist
            </button>
            <button
              type="button"
              onClick={() => setActiveNavTab('compare')}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
            >
              Browse 10 Verticals
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTrackedItems.map((item) => {
            const vMeta = VERTICAL_META[item.vertical];
            const dropDiff = item.originalPrice - item.primaryPrice;
            const targetAlert = item.targetPriceAlert || Math.round(item.primaryPrice * 0.9);
            const isTargetMet = item.primaryPrice <= targetAlert;

            return (
              <div
                key={item.id}
                className="bg-white rounded-3xl border border-slate-200 hover:border-red-400 p-5 shadow-xs hover:shadow-lg transition-all duration-200 flex flex-col justify-between group relative overflow-hidden"
              >
                <div>
                  {/* Top Category Tag + Remove Button */}
                  <div className="flex items-center justify-between text-xs mb-3">
                    <span className="font-extrabold text-slate-400 uppercase tracking-wider text-[10px] bg-slate-100 px-2.5 py-0.5 rounded-lg">
                      {vMeta?.name || item.vertical}
                    </span>

                    {/* Status Pill */}
                    {dropDiff > 0 ? (
                      <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <TrendingDown className="w-3 h-3 text-emerald-600" />
                        <span>Price Dropped (-₹{dropDiff.toLocaleString('en-IN')})</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full">
                        Price Stable
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => toggleTrackPrice(item.id)}
                      title="Remove from alerts"
                      className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Thumbnail + Title */}
                  <div className="flex items-start gap-3.5 mb-3">
                    <img
                      src={item.imageUrl || item.galleryImages?.[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300'}
                      alt={item.title}
                      className="w-16 h-16 rounded-2xl object-cover border border-slate-200 shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300';
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-extrabold text-slate-900 leading-snug group-hover:text-red-600 transition-colors truncate">
                        {item.title}
                      </h3>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{item.subtitle}</p>
                      <span className="text-[10px] text-slate-400 block mt-1 font-mono">
                        Provider: {item.provider} · Platform: {item.sellerQuotes[0]?.sellerName || 'Direct'}
                      </span>
                    </div>
                  </div>

                  {/* Pricing Comparison Bar */}
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 mb-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Current Lowest</span>
                      <strong className="text-lg font-black font-mono text-slate-900">
                        ₹{item.primaryPrice.toLocaleString('en-IN')}
                      </strong>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Target Alert</span>
                      <strong className={`text-base font-black font-mono ${isTargetMet ? 'text-emerald-600' : 'text-red-600'}`}>
                        ₹{targetAlert.toLocaleString('en-IN')}
                      </strong>
                    </div>
                  </div>

                  {/* Historical Buying Guidance */}
                  <div className="space-y-1 mb-4 text-[11px] text-slate-600 bg-blue-50/50 p-2.5 rounded-xl border border-blue-100">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Predicted Buy Date:</span>
                      <strong className="text-blue-900">Friday Midnight Window</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Channels Active:</span>
                      <span className="font-bold text-slate-700">WhatsApp 💬 · Push 🔔 · Email ✉️</span>
                    </div>
                  </div>
                </div>

                {/* Footer Action Buttons */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleTestWhatsAppPing(item)}
                    className="py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl border border-emerald-200 flex items-center gap-1.5 cursor-pointer transition-colors"
                    title="Send Test WhatsApp Message"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                    <span>WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openPriceAlertModal(item)}
                    className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-colors"
                  >
                    Edit Target
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (item.sellerQuotes[0]) {
                        startRedirection(item, item.sellerQuotes[0]);
                      }
                    }}
                    className="py-2 px-4 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-extrabold text-xs rounded-xl shadow-sm flex items-center gap-1 cursor-pointer transition-all hover:scale-105 active:scale-95"
                  >
                    <span>Select</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
