import { useState, useMemo, FC } from 'react';
import {
  Activity,
  Calendar,
  Download,
  Search,
  Filter,
  TrendingUp,
  Users,
  MousePointerClick,
  Sparkles,
  DollarSign,
  Clock,
  Layers,
  ArrowUpRight,
  ExternalLink,
  ShieldCheck,
  Building2,
  Smartphone,
  Globe,
  MapPin,
  CheckCircle2,
  AlertCircle,
  X,
  PieChart,
  BarChart3,
  HelpCircle,
} from 'lucide-react';
import {
  TimeframePreset,
  VerticalId,
  PartnerCampaignPerformance,
} from '../../types';
import {
  LAST_12_MONTHS_TRAFFIC,
  PLATFORM_TRAFFIC_SUMMARIES,
  TRAFFIC_CHANNELS,
  DEVICE_BREAKDOWN,
  TOP_METRO_TRAFFIC,
  PARTNER_CAMPAIGN_PERFORMANCES,
} from '../../data/platformTrafficData';
import { useApp } from '../../context/AppContext';

export const PlatformTrafficTab: FC = () => {
  const { addToast } = useApp();

  // Active Timeframe Filter: 'this_month' | 'last_3_months' | 'last_12_months' | 'till_date'
  const [timeframe, setTimeframe] = useState<TimeframePreset>('last_12_months');

  // Search & Filters for Campaign Performance Table
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPartnerType, setSelectedPartnerType] = useState<'all' | 'direct_partner' | 'affiliate'>('all');
  const [selectedVertical, setSelectedVertical] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Selected Campaign for Detail Drilldown Modal
  const [selectedCampaign, setSelectedCampaign] = useState<PartnerCampaignPerformance | null>(null);

  // Active Chart Metric View
  const [chartMetric, setChartMetric] = useState<'visits' | 'clicks' | 'gmv' | 'revenue'>('visits');

  // Current Summary Metrics based on selected timeframe
  const currentSummary = PLATFORM_TRAFFIC_SUMMARIES[timeframe];

  // Filtered monthly points based on timeframe
  const visibleMonthlyPoints = useMemo(() => {
    switch (timeframe) {
      case 'this_month':
        return LAST_12_MONTHS_TRAFFIC.slice(-1); // Oct 2026
      case 'last_3_months':
        return LAST_12_MONTHS_TRAFFIC.slice(-3); // Aug, Sep, Oct 2026
      case 'last_12_months':
      case 'till_date':
      default:
        return LAST_12_MONTHS_TRAFFIC; // All 12 months
    }
  }, [timeframe]);

  // Max value calculation for visual chart scaling
  const maxChartValue = useMemo(() => {
    const vals = visibleMonthlyPoints.map((p) => {
      switch (chartMetric) {
        case 'visits':
          return p.visits;
        case 'clicks':
          return p.outboundClicks;
        case 'gmv':
          return p.gmvDriven;
        case 'revenue':
          return p.revenueEarned;
      }
    });
    return Math.max(...vals, 1);
  }, [visibleMonthlyPoints, chartMetric]);

  // Filter Campaign Performances Table
  const filteredCampaigns = useMemo(() => {
    return PARTNER_CAMPAIGN_PERFORMANCES.filter((c) => {
      const matchesType =
        selectedPartnerType === 'all' || c.partnerType === selectedPartnerType;
      const matchesVertical =
        selectedVertical === 'all' || c.vertical === selectedVertical;
      const matchesStatus =
        selectedStatus === 'all' || c.status === selectedStatus;

      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        c.campaignName.toLowerCase().includes(q) ||
        c.partnerName.toLowerCase().includes(q) ||
        c.affiliateNetwork.toLowerCase().includes(q) ||
        c.vertical.toLowerCase().includes(q);

      return matchesType && matchesVertical && matchesStatus && matchesQuery;
    });
  }, [searchQuery, selectedPartnerType, selectedVertical, selectedStatus]);

  // Summary aggregation of filtered campaigns for the active timeframe
  const tableAggregates = useMemo(() => {
    return filteredCampaigns.reduce(
      (acc, c) => {
        const stats = c.timeframeStats[timeframe];
        acc.impressions += stats.impressions;
        acc.clicks += stats.clicks;
        acc.conversions += stats.conversions;
        acc.gmv += stats.gmvDriven;
        acc.commission += stats.commissionEarned;
        return acc;
      },
      { impressions: 0, clicks: 0, conversions: 0, gmv: 0, commission: 0 }
    );
  }, [filteredCampaigns, timeframe]);

  // 1-Click Export CSV
  const handleExportCsv = () => {
    const headers = [
      'Campaign ID',
      'Campaign Name',
      'Partner Name',
      'Partner Type',
      'Affiliate Network / Integration',
      'Vertical',
      'Timeframe Window',
      'Impressions / Metasearch Scans',
      'Outbound Clicks (Redirections)',
      'Outbound CTR (%)',
      'Conversions / Orders / Leads',
      'Conversion Rate (%)',
      'GMV Driven (INR)',
      'Commission / Revenue Earned (INR)',
      'ROAS Multiplier',
      'Commission Model',
      'Status',
    ];

    const rows = filteredCampaigns.map((c) => {
      const stats = c.timeframeStats[timeframe];
      return [
        `"${c.id}"`,
        `"${c.campaignName.replace(/"/g, '""')}"`,
        `"${c.partnerName}"`,
        `"${c.partnerType === 'direct_partner' ? 'Direct Partner' : 'Affiliate Partner'}"`,
        `"${c.affiliateNetwork}"`,
        `"${c.vertical}"`,
        `"${timeframe.toUpperCase()}"`,
        stats.impressions,
        stats.clicks,
        `${stats.ctr}%`,
        stats.conversions,
        `${stats.conversionRate}%`,
        stats.gmvDriven,
        stats.commissionEarned,
        `${stats.roasMultiplier}x`,
        `"${c.commissionModel}"`,
        `"${c.status}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `try1second_traffic_campaigns_${timeframe}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast(
      'success',
      'Performance Data Exported',
      `Exported ${filteredCampaigns.length} partner campaigns for ${getTimeframeLabel(timeframe)}.`
    );
  };

  function getTimeframeLabel(t: TimeframePreset): string {
    switch (t) {
      case 'this_month':
        return 'This Month (Oct 2026 MTD)';
      case 'last_3_months':
        return 'Last 3 Months (Aug - Oct 2026)';
      case 'last_12_months':
        return 'Last 12 Months (Nov 2025 - Oct 2026)';
      case 'till_date':
        return 'Till Date (Platform Inception to Date)';
    }
  }

  const formatCurrency = (val: number): string => {
    if (val >= 10000000) {
      return `₹${(val / 10000000).toFixed(2)} Cr`;
    }
    if (val >= 100000) {
      return `₹${(val / 100000).toFixed(2)} Lakh`;
    }
    return `₹${val.toLocaleString('en-IN')}`;
  };

  const formatNumber = (val: number): string => {
    if (val >= 1000000) {
      return `${(val / 1000000).toFixed(2)}M`;
    }
    if (val >= 1000) {
      return `${(val / 1000).toFixed(1)}K`;
    }
    return val.toLocaleString('en-IN');
  };

  return (
    <div className="space-y-6 text-slate-900 font-sans">
      {/* ========================================================= */}
      {/* TOP HEADER & TIMEFRAME SELECTOR BAR (White Theme)        */}
      {/* ========================================================= */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-2 border border-emerald-200">
            <Activity className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            <span>Try1Second Platform Traffic & Performance Intelligence</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Website Traffic & Partner Campaign Statistics
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Multi-channel traffic attribution, sub-second metasearch scan volume, and comprehensive performance metrics for campaigns executed across <strong>Direct API Partners</strong> and <strong>Affiliate Networks</strong>.
          </p>
        </div>

        {/* Timeframe Preset Switcher & Export */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto shrink-0">
          {/* Timeframe Filter Buttons */}
          <div className="bg-slate-100 p-1 rounded-2xl flex items-center border border-slate-200">
            <button
              type="button"
              onClick={() => setTimeframe('this_month')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                timeframe === 'this_month'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => setTimeframe('last_3_months')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                timeframe === 'last_3_months'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Last 3 Months
            </button>
            <button
              type="button"
              onClick={() => setTimeframe('last_12_months')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                timeframe === 'last_12_months'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Last 12 Months
            </button>
            <button
              type="button"
              onClick={() => setTimeframe('till_date')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                timeframe === 'till_date'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Till Date
            </button>
          </div>

          {/* Export CSV Button */}
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
            title="Download CSV performance dataset"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 4 CORE PLATFORM KPI CARDS (Adapts to Active Timeframe)    */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Visits & Unique Visitors */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-blue-600" />
              <span>Total Website Traffic</span>
            </span>
            <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold">
              {currentSummary.growthMoM}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
              {formatNumber(currentSummary.totalVisits)}
            </span>
            <span className="text-xs text-slate-500 font-semibold">Visits</span>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Unique Visitors:</span>
            <strong className="text-slate-800 font-mono">
              {formatNumber(currentSummary.uniqueVisitors)}
            </strong>
          </div>
        </div>

        {/* Card 2: Metasearch Price Scans Executed */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Metasearch Queries</span>
            </span>
            <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-bold">
              10 Verticals
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
              {formatNumber(currentSummary.scannerQueries)}
            </span>
            <span className="text-xs text-slate-500 font-semibold">Live Scans</span>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Avg Scans/Visit:</span>
            <strong className="text-slate-800 font-mono">
              {(currentSummary.scannerQueries / currentSummary.totalVisits).toFixed(1)} Queries
            </strong>
          </div>
        </div>

        {/* Card 3: Outbound Click-Throughs & Redirection CTR */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span className="flex items-center gap-1.5">
              <MousePointerClick className="w-4 h-4 text-purple-600" />
              <span>Partner Redirections</span>
            </span>
            <span className="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-bold">
              {currentSummary.outboundCtr}% CTR
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
              {formatNumber(currentSummary.outboundRedirections)}
            </span>
            <span className="text-xs text-slate-500 font-semibold">Clicks</span>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Qualified Orders/Leads:</span>
            <strong className="text-purple-700 font-mono">
              {formatNumber(currentSummary.conversions)} ({currentSummary.conversionRate}%)
            </strong>
          </div>
        </div>

        {/* Card 4: GMV Driven & Try1Second Net Commission */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span className="flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span>Try1Second Revenue</span>
            </span>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
              Commission
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-emerald-700 font-mono">
              {formatCurrency(currentSummary.revenueEarned)}
            </span>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Gross GMV Delivered:</span>
            <strong className="text-slate-800 font-mono">
              {formatCurrency(currentSummary.gmvDriven)}
            </strong>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECONDARY PLATFORM AUDIT METRICS STRIP                   */}
      {/* ========================================================= */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] text-slate-500 block">Avg Session Duration</span>
            <strong className="text-slate-900 font-mono">{currentSummary.avgSessionDuration}</strong>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] text-slate-500 block">Bounce Rate</span>
            <strong className="text-slate-900 font-mono">{currentSummary.bounceRate}</strong>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] text-slate-500 block">Active Partner Campaigns</span>
            <strong className="text-slate-900 font-mono">{PARTNER_CAMPAIGN_PERFORMANCES.length} Active</strong>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <span className="text-[11px] text-slate-500 block">Tracking Accuracy</span>
            <strong className="text-emerald-700 font-mono">99.8% Postback Verified</strong>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* VISUAL CHART: MONTHLY TRAFFIC & PERFORMANCE TREND (12M)  */}
      {/* ========================================================= */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              <h3 className="text-base font-bold text-slate-900">
                Monthly Performance Statistics ({getTimeframeLabel(timeframe)})
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Visualizing trajectory across metasearch queries, visits, and partner outbound conversions.
            </p>
          </div>

          {/* Metric Selector for Chart */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200 self-start sm:self-auto text-xs">
            <button
              type="button"
              onClick={() => setChartMetric('visits')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                chartMetric === 'visits' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Visits
            </button>
            <button
              type="button"
              onClick={() => setChartMetric('clicks')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                chartMetric === 'clicks' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Outbound Clicks
            </button>
            <button
              type="button"
              onClick={() => setChartMetric('gmv')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                chartMetric === 'gmv' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              GMV (₹)
            </button>
            <button
              type="button"
              onClick={() => setChartMetric('revenue')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                chartMetric === 'revenue' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Revenue (₹)
            </button>
          </div>
        </div>

        {/* Visual Bar Chart */}
        <div className="pt-4">
          <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-12 gap-2 sm:gap-3 items-end h-56 border-b border-slate-200 pb-2">
            {visibleMonthlyPoints.map((pt) => {
              let val = pt.visits;
              let labelVal = `${formatNumber(pt.visits)}`;
              let barColor = 'bg-blue-600';

              if (chartMetric === 'clicks') {
                val = pt.outboundClicks;
                labelVal = `${formatNumber(pt.outboundClicks)}`;
                barColor = 'bg-purple-600';
              } else if (chartMetric === 'gmv') {
                val = pt.gmvDriven;
                labelVal = formatCurrency(pt.gmvDriven);
                barColor = 'bg-amber-600';
              } else if (chartMetric === 'revenue') {
                val = pt.revenueEarned;
                labelVal = formatCurrency(pt.revenueEarned);
                barColor = 'bg-emerald-600';
              }

              const heightPercent = Math.max(12, Math.round((val / maxChartValue) * 100));

              return (
                <div key={pt.monthKey} className="flex flex-col items-center justify-end h-full group relative">
                  {/* Tooltip on hover */}
                  <div className="absolute -top-16 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] p-2 rounded-xl pointer-events-none whitespace-nowrap z-20 shadow-lg">
                    <p className="font-bold text-amber-300">{pt.monthLabel}</p>
                    <p>Visits: {formatNumber(pt.visits)}</p>
                    <p>Clicks: {formatNumber(pt.outboundClicks)}</p>
                    <p>GMV: {formatCurrency(pt.gmvDriven)}</p>
                    <p className="text-emerald-300">Revenue: {formatCurrency(pt.revenueEarned)}</p>
                  </div>

                  {/* Value label above bar */}
                  <span className="text-[10px] font-mono font-bold text-slate-500 mb-1 truncate max-w-full">
                    {labelVal}
                  </span>

                  {/* Animated Bar */}
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className={`w-full max-w-[42px] ${barColor} rounded-t-xl group-hover:brightness-110 transition-all shadow-xs`}
                  />

                  {/* Month Label */}
                  <span className="text-[10px] text-slate-500 mt-2 font-semibold truncate max-w-full">
                    {pt.monthLabel.split(' ')[0]}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-3">
            <span>Interactive Monthly Trajectory (Nov 2025 - Oct 2026)</span>
            <span className="font-semibold text-slate-700">
              Active Focus: <strong>{getTimeframeLabel(timeframe)}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TRAFFIC SOURCE, DEVICE, & METRO GEOGRAPHY BREAKDOWN       */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Box 1: Acquisition Channels */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-600" />
              <span>Traffic Sources</span>
            </h4>
            <span className="text-[10px] text-slate-500 font-semibold">Share %</span>
          </div>

          <div className="space-y-3">
            {TRAFFIC_CHANNELS.map((ch) => (
              <div key={ch.channel} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 truncate">{ch.channel}</span>
                  <span className="font-mono font-bold text-slate-900">{ch.percentage}%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-600 h-full rounded-full"
                    style={{ width: `${ch.percentage}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span>Conv. Rate: {ch.conversionRate}%</span>
                  <span>Bounce: {ch.bounceRate}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Box 2: Top Metro Hubs */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <MapPin className="w-4 h-4 text-rose-600" />
              <span>Top Metro Hubs</span>
            </h4>
            <span className="text-[10px] text-slate-500 font-semibold">Volume</span>
          </div>

          <div className="space-y-2.5">
            {TOP_METRO_TRAFFIC.map((metro) => (
              <div key={metro.city} className="p-2 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <strong className="text-slate-800">{metro.city}</strong>
                  <span className="font-mono font-bold text-slate-900">{metro.percentage}%</span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span>Top: {metro.topVertical}</span>
                  <span className="text-emerald-700 font-semibold">GMV Share: {metro.gmvShare}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Box 3: Device Segmentation */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-purple-600" />
              <span>Device Breakdown</span>
            </h4>
            <span className="text-[10px] text-slate-500 font-semibold">User Agent</span>
          </div>

          <div className="space-y-4">
            {DEVICE_BREAKDOWN.map((d) => (
              <div key={d.device} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">{d.device}</span>
                  <span className="font-mono font-bold text-slate-900">{d.percentage}%</span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-purple-600 h-full rounded-full"
                    style={{ width: `${d.percentage}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-500 font-mono block">
                  ~{formatNumber(d.visits)} visits ({timeframe.toUpperCase()})
                </span>
              </div>
            ))}

            <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-purple-900 text-xs">
              <p className="font-bold">Mobile First Metasearch</p>
              <p className="text-[11px] text-purple-700 mt-0.5">
                89.2% of all price comparisons occur on mobile devices with sub-second Android PWA caching.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* PARTNER CAMPAIGN PERFORMANCE STATISTICS TABLE             */}
      {/* ========================================================= */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-5 sm:p-6">
        {/* Table Header & Search/Filter Toolbar */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Partner Campaign Performance Statistics</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-mono font-bold">
                  {filteredCampaigns.length} Campaigns
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Showing impressions, outbound clicks, conversion orders, and revenue generated during{' '}
                <strong className="text-slate-800">{getTimeframeLabel(timeframe)}</strong>.
              </p>
            </div>

            {/* Quick Filter Pill for Timeframe Indicator */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 font-mono text-xs font-bold border border-slate-200">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>Timeframe: {timeframe.replace('_', ' ').toUpperCase()}</span>
            </div>
          </div>

          {/* Search & Dropdown Filters Bar */}
          <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100 text-xs">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search campaign, brand (Swiggy, MMT), or network..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500"
              />
            </div>

            {/* Partner Type Filter */}
            <select
              value={selectedPartnerType}
              onChange={(e) => setSelectedPartnerType(e.target.value as any)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-semibold cursor-pointer focus:outline-hidden focus:border-blue-500"
            >
              <option value="all">All Partner Types (Direct & Affiliate)</option>
              <option value="direct_partner">Direct Partners Only</option>
              <option value="affiliate">Affiliate Partners Only</option>
            </select>

            {/* Vertical Filter */}
            <select
              value={selectedVertical}
              onChange={(e) => setSelectedVertical(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-semibold cursor-pointer focus:outline-hidden focus:border-blue-500"
            >
              <option value="all">All Verticals (10 Categories)</option>
              <option value="flights">Flights</option>
              <option value="hotels">Hotels</option>
              <option value="food">Food Delivery</option>
              <option value="grocery">10-Min Grocery</option>
              <option value="ecommerce">E-Commerce</option>
              <option value="loans">Loans</option>
              <option value="insurance">Insurance</option>
              <option value="cab">Cabs</option>
              <option value="movie">Movies</option>
              <option value="bus">Bus</option>
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-semibold cursor-pointer focus:outline-hidden focus:border-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Campaigns</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto border border-slate-200 rounded-2xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-3.5">Campaign & Partner</th>
                <th className="py-3 px-3">Vertical</th>
                <th className="py-3 px-3 text-right">Impressions</th>
                <th className="py-3 px-3 text-right">Clicks / CTR</th>
                <th className="py-3 px-3 text-right">Conversions</th>
                <th className="py-3 px-3 text-right">GMV Driven</th>
                <th className="py-3 px-3 text-right">Commission Earned</th>
                <th className="py-3 px-3 text-center">ROAS</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {filteredCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    No partner campaigns match your active search and filter criteria.
                  </td>
                </tr>
              ) : (
                filteredCampaigns.map((camp) => {
                  const stats = camp.timeframeStats[timeframe];

                  return (
                    <tr
                      key={camp.id}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => setSelectedCampaign(camp)}
                    >
                      {/* Campaign & Partner */}
                      <td className="py-3.5 px-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-800 font-bold flex items-center justify-center text-xs shrink-0 border border-slate-200">
                            {camp.partnerName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block leading-tight hover:text-blue-600 transition-colors">
                              {camp.campaignName}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[10px]">
                              <span className="font-semibold text-slate-600">{camp.partnerName}</span>
                              <span className="text-slate-300">•</span>
                              <span
                                className={`px-1.5 py-0.2 rounded font-bold uppercase ${
                                  camp.partnerType === 'direct_partner'
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                    : 'bg-purple-50 text-purple-700 border border-purple-200'
                                }`}
                              >
                                {camp.partnerType === 'direct_partner' ? 'Direct Partner' : 'Affiliate'}
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="text-slate-400 font-mono">{camp.affiliateNetwork}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Vertical */}
                      <td className="py-3 px-3">
                        <span className="capitalize px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold text-[11px]">
                          {camp.vertical}
                        </span>
                      </td>

                      {/* Impressions */}
                      <td className="py-3 px-3 text-right font-mono font-semibold text-slate-800">
                        {formatNumber(stats.impressions)}
                      </td>

                      {/* Clicks & CTR */}
                      <td className="py-3 px-3 text-right">
                        <span className="font-mono font-bold text-slate-900 block">
                          {formatNumber(stats.clicks)}
                        </span>
                        <span className="text-[10px] text-blue-600 font-mono font-bold">
                          {stats.ctr}% CTR
                        </span>
                      </td>

                      {/* Conversions */}
                      <td className="py-3 px-3 text-right">
                        <span className="font-mono font-bold text-slate-900 block">
                          {formatNumber(stats.conversions)}
                        </span>
                        <span className="text-[10px] text-emerald-600 font-mono font-bold">
                          {stats.conversionRate}% CVR
                        </span>
                      </td>

                      {/* GMV Driven */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(stats.gmvDriven)}
                      </td>

                      {/* Commission Earned */}
                      <td className="py-3 px-3 text-right">
                        <span className="font-mono font-black text-emerald-700 block">
                          {formatCurrency(stats.commissionEarned)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {camp.commissionModel}
                        </span>
                      </td>

                      {/* ROAS Multiplier */}
                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-mono font-bold text-[11px] border border-emerald-200">
                          {stats.roasMultiplier}x
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            camp.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : camp.status === 'paused'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {camp.status === 'active' && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          )}
                          {camp.status}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setSelectedCampaign(camp)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-colors cursor-pointer"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Aggregates Summary Footer */}
            {filteredCampaigns.length > 0 && (
              <tfoot className="bg-slate-50/90 font-bold border-t-2 border-slate-200 text-slate-900">
                <tr>
                  <td className="py-3 px-3.5" colSpan={2}>
                    <span>Total Aggregates ({filteredCampaigns.length} Campaigns)</span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono">
                    {formatNumber(tableAggregates.impressions)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-blue-700">
                    {formatNumber(tableAggregates.clicks)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-emerald-700">
                    {formatNumber(tableAggregates.conversions)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono">
                    {formatCurrency(tableAggregates.gmv)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-emerald-700">
                    {formatCurrency(tableAggregates.commission)}
                  </td>
                  <td className="py-3 px-3 text-center font-mono text-slate-600" colSpan={3}>
                    {getTimeframeLabel(timeframe)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ========================================================= */}
      {/* CAMPAIGN DRILLDOWN DETAIL MODAL                           */}
      {/* ========================================================= */}
      {selectedCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 font-black text-sm flex items-center justify-center border border-blue-100">
                  {selectedCampaign.partnerName.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {selectedCampaign.vertical}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        selectedCampaign.partnerType === 'direct_partner'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-purple-50 text-purple-700 border border-purple-200'
                      }`}
                    >
                      {selectedCampaign.partnerType === 'direct_partner' ? 'Direct Partner' : 'Affiliate'}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-slate-900 leading-tight">
                    {selectedCampaign.campaignName}
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold">
                    Partner: {selectedCampaign.partnerName} · Network: {selectedCampaign.affiliateNetwork}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCampaign(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Campaign Notes & Commission Formula */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Attribution & Commission Model:</span>
                <strong className="text-emerald-700 font-mono font-bold">
                  {selectedCampaign.commissionModel}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Campaign Launch Date:</span>
                <span className="text-slate-800 font-medium">{selectedCampaign.startDate}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 text-slate-600">
                <span className="font-bold text-slate-800">Targeting & Feed Specs: </span>
                {selectedCampaign.targetingNotes}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px]">
                <span className="font-semibold text-slate-500">Target Cities:</span>
                {selectedCampaign.targetCities.map((city) => (
                  <span
                    key={city}
                    className="px-2 py-0.2 rounded-md bg-white border border-slate-200 text-slate-700"
                  >
                    {city}
                  </span>
                ))}
              </div>
            </div>

            {/* Timeframe Comparison 4-Box Matrix for This Campaign */}
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                Performance Comparison Across Timeframes
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                {(['this_month', 'last_3_months', 'last_12_months', 'till_date'] as TimeframePreset[]).map((tf) => {
                  const s = selectedCampaign.timeframeStats[tf];
                  const isCurrent = timeframe === tf;

                  return (
                    <div
                      key={tf}
                      className={`p-3 rounded-2xl border transition-all ${
                        isCurrent
                          ? 'bg-blue-50/60 border-blue-300 ring-2 ring-blue-500/20'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                        {tf.replace('_', ' ')}
                      </span>
                      <p className="font-mono font-bold text-slate-900 text-sm">
                        {formatNumber(s.clicks)} Clicks
                      </p>
                      <p className="text-[10px] text-blue-600 font-mono font-bold">
                        {s.ctr}% CTR
                      </p>
                      <div className="pt-1.5 mt-1.5 border-t border-slate-100">
                        <span className="text-[10px] text-slate-500 block">Revenue:</span>
                        <strong className="text-emerald-700 font-mono text-xs">
                          {formatCurrency(s.commissionEarned)}
                        </strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Close Button */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedCampaign(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer transition-colors"
              >
                Close Drilldown
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
