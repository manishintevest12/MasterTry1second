import React, { useState, useMemo } from 'react';
import {
  Zap,
  Plus,
  Search,
  ExternalLink,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  TrendingUp,
  Download,
  Filter,
  BarChart3,
  Smartphone,
  ShieldCheck,
  Tag,
  Sparkles,
  Layers,
  RotateCw,
  Play,
  Monitor,
  Apple,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { QuickAppPartner, QuickAppPartnerType, QuickAppRedirectionLog } from '../../types';

const TYPE_OPTIONS: { id: QuickAppPartnerType; label: string; desc: string; badgeColor: string }[] = [
  { id: 'CPC', label: 'CPC', desc: 'Cost Per Click (Redirect)', badgeColor: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: 'CPI - Android', label: 'CPI - Android', desc: 'Cost Per Install (Android App)', badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { id: 'CPI - IOS', label: 'CPI - IOS', desc: 'Cost Per Install (iOS App)', badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { id: 'CPI - Windows', label: 'CPI - Windows', desc: 'Cost Per Install (Windows PC)', badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { id: 'CPL', label: 'CPL', desc: 'Cost Per Lead / Inbound Submission', badgeColor: 'bg-purple-50 text-purple-700 border-purple-200' },
  { id: 'CPS', label: 'CPS', desc: 'Cost Per Sale / Order Commission', badgeColor: 'bg-amber-50 text-amber-800 border-amber-200' },
];

const PRESET_ICONS = [
  { name: 'Food & Dining', url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=120&auto=format&fit=crop&q=80' },
  { name: 'Restaurant Gourmet', url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=120&auto=format&fit=crop&q=80' },
  { name: 'E-Commerce Gadget', url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=120&auto=format&fit=crop&q=80' },
  { name: 'Electronics Tech', url: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=120&auto=format&fit=crop&q=80' },
  { name: '10-Min Grocery', url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=120&auto=format&fit=crop&q=80' },
  { name: 'Supermarket Fast', url: 'https://images.unsplash.com/photo-1518843875459-f738682238a6?w=120&auto=format&fit=crop&q=80' },
  { name: 'Fintech Credit', url: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=120&auto=format&fit=crop&q=80' },
  { name: 'Banking Loans', url: 'https://images.unsplash.com/photo-1541354329998-f4d9a9f9297f?w=120&auto=format&fit=crop&q=80' },
  { name: 'Flights Aviation', url: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=120&auto=format&fit=crop&q=80' },
  { name: 'Cabs Mobility', url: 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=120&auto=format&fit=crop&q=80' },
  { name: 'Cinema Movies', url: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=120&auto=format&fit=crop&q=80' },
];

export const QuickAppsAdminTab: React.FC = () => {
  const {
    quickAppPartners,
    quickAppRedirectionLogs,
    addQuickAppPartner,
    updateQuickAppPartner,
    deleteQuickAppPartner,
    trackQuickAppRedirection,
    clearQuickAppRedirectionLogs,
    simulateQuickAppRedirection,
    addToast,
  } = useApp();

  const [adminViewMode, setAdminViewMode] = useState<'partners' | 'reports'>('partners');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingPartner, setEditingPartner] = useState<QuickAppPartner | null>(null);

  // Form State
  const [formState, setFormState] = useState({
    name: '',
    iconUrl: PRESET_ICONS[0].url,
    category: 'Food Delivery & Dining',
    type: 'CPI - Android' as QuickAppPartnerType,
    deepLink: 'swiggy://open?utm_source=try1second',
    webUrl: 'https://www.swiggy.com',
    description: 'Instant food & grocery ordering with exclusive app discounts.',
    payoutRate: '₹45 / Android Install',
    payoutAmount: 45,
    status: 'active' as 'active' | 'paused',
    rating: 4.6,
    downloadsOrUsers: '50M+ Downloads',
    badge: 'Popular',
  });

  const handleOpenAdd = () => {
    setEditingPartner(null);
    setFormState({
      name: '',
      iconUrl: PRESET_ICONS[0].url,
      category: 'Food Delivery & Dining',
      type: 'CPI - Android',
      deepLink: '',
      webUrl: '',
      description: '',
      payoutRate: '₹45 / Install',
      payoutAmount: 45,
      status: 'active',
      rating: 4.5,
      downloadsOrUsers: '10M+ Users',
      badge: 'New Partner',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (partner: QuickAppPartner) => {
    setEditingPartner(partner);
    setFormState({
      name: partner.name,
      iconUrl: partner.iconUrl,
      category: partner.category,
      type: partner.type,
      deepLink: partner.deepLink,
      webUrl: partner.webUrl,
      description: partner.description,
      payoutRate: partner.payoutRate,
      payoutAmount: partner.payoutAmount,
      status: partner.status,
      rating: partner.rating,
      downloadsOrUsers: partner.downloadsOrUsers || '',
      badge: partner.badge || '',
    });
    setIsModalOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.name.trim()) {
      addToast('alert', 'Partner Name Required', 'Please enter a valid company name.');
      return;
    }

    if (editingPartner) {
      updateQuickAppPartner(editingPartner.id, formState);
    } else {
      addQuickAppPartner(formState);
    }
    setIsModalOpen(false);
  };

  // Filtered partners
  const filteredPartners = useMemo(() => {
    return quickAppPartners.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.type.toLowerCase().includes(q);
      const matchesType = filterType === 'ALL' || p.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [quickAppPartners, searchQuery, filterType]);

  // Redirection Reports Statistics
  const reportStats = useMemo(() => {
    const totalCount = quickAppRedirectionLogs.length;
    const totalPayout = quickAppRedirectionLogs.reduce((sum, log) => sum + (log.payoutAmount || 0), 0);

    const byType: Record<QuickAppPartnerType, { count: number; payout: number }> = {
      CPC: { count: 0, payout: 0 },
      'CPI - Android': { count: 0, payout: 0 },
      'CPI - IOS': { count: 0, payout: 0 },
      'CPI - Windows': { count: 0, payout: 0 },
      CPL: { count: 0, payout: 0 },
      CPS: { count: 0, payout: 0 },
    };

    quickAppRedirectionLogs.forEach((log) => {
      if (byType[log.partnerType]) {
        byType[log.partnerType].count += 1;
        byType[log.partnerType].payout += log.payoutAmount || 0;
      }
    });

    return { totalCount, totalPayout, byType };
  }, [quickAppRedirectionLogs]);

  // Export Redirection Reports to CSV
  const handleExportCSV = () => {
    if (quickAppRedirectionLogs.length === 0) {
      addToast('alert', 'No Logs to Export', 'There are no redirection logs available.');
      return;
    }

    const headers = [
      'Log ID',
      'Timestamp',
      'Partner Name',
      'Commercial Type',
      'Target Deep Link',
      'Device Platform',
      'Payout Amount (INR)',
      'Status',
    ];

    const rows = quickAppRedirectionLogs.map((l) => [
      `"${l.id}"`,
      `"${l.timestamp}"`,
      `"${l.partnerName.replace(/"/g, '""')}"`,
      `"${l.partnerType}"`,
      `"${l.targetUrl.replace(/"/g, '""')}"`,
      `"${l.devicePlatform}"`,
      l.payoutAmount,
      `"${l.status.toUpperCase()}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `quick_apps_redirection_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast('success', 'Report Exported', 'Redirection report downloaded as CSV.');
  };

  const getTypeBadgeStyle = (type: QuickAppPartnerType) => {
    switch (type) {
      case 'CPC':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'CPI - Android':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'CPI - IOS':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'CPI - Windows':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      case 'CPL':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'CPS':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-bold uppercase tracking-wider mb-2">
              <Zap className="w-3.5 h-3.5 text-red-600 fill-red-500" />
              <span>Quick Apps & Deep Link Redirection Engine</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>Quick Apps Partner Directory & Tracking Reports</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Configure partner apps with deep links, select commercial models (CPC, CPI - Android, CPI - iOS, CPI - Windows, CPL, CPS), and audit live user redirection reports.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {adminViewMode === 'partners' ? (
              <button
                type="button"
                onClick={handleOpenAdd}
                className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-md shadow-red-600/20 flex items-center gap-2 cursor-pointer transition-all hover:scale-105 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Quick App Partner</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleExportCSV}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer transition-all hover:scale-105 active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>Export Redirection CSV</span>
              </button>
            )}
          </div>
        </div>

        {/* View Toggle Tabs (Partners vs Reports) */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-3">
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setAdminViewMode('partners')}
              className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
                adminViewMode === 'partners'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Smartphone className="w-4 h-4 text-red-600" />
              <span>Partner Directory</span>
              <span className="px-2 py-0.2 rounded-full bg-slate-100 text-[10px] font-mono">
                {quickAppPartners.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setAdminViewMode('reports')}
              className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
                adminViewMode === 'reports'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Redirection & Payout Reports</span>
              <span className={`px-2 py-0.2 rounded-full text-[10px] font-mono ${
                adminViewMode === 'reports' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {quickAppRedirectionLogs.length}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => simulateQuickAppRedirection()}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer border border-slate-200 flex items-center gap-1.5"
              title="Trigger a test redirection event"
            >
              <Play className="w-3.5 h-3.5 text-red-600 fill-red-500" />
              <span>Simulate Redirection</span>
            </button>
          </div>
        </div>
      </div>

      {/* ================= VIEW 1: PARTNER DIRECTORY ================= */}
      {adminViewMode === 'partners' && (
        <div className="space-y-4">
          {/* Filter and Search Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by company name, category, or type..."
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-red-500 shadow-inner"
              />
            </div>

            {/* Type Filter */}
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-semibold">Model Filter:</span>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold focus:outline-hidden focus:border-red-500 cursor-pointer"
              >
                <option value="ALL">All Types</option>
                <option value="CPC">CPC (Cost Per Click)</option>
                <option value="CPI - Android">CPI - Android (Install)</option>
                <option value="CPI - IOS">CPI - IOS (Install)</option>
                <option value="CPI - Windows">CPI - Windows (Install)</option>
                <option value="CPL">CPL (Cost Per Lead)</option>
                <option value="CPS">CPS (Cost Per Sale)</option>
              </select>
            </div>
          </div>

          {/* Partners Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4 font-semibold">Partner Company</th>
                    <th className="py-3.5 px-4 font-semibold">Commercial Type</th>
                    <th className="py-3.5 px-4 font-semibold">Deep Link & Web Target</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Payout Rate</th>
                    <th className="py-3.5 px-4 font-semibold text-center">Status</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPartners.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                        No partners found matching the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredPartners.map((partner) => (
                      <tr key={partner.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={partner.iconUrl}
                              alt={partner.name}
                              className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                  partner.name
                                )}&background=ea580c&color=fff&size=80`;
                              }}
                            />
                            <div>
                              <strong className="text-slate-900 block font-extrabold text-sm">
                                {partner.name}
                              </strong>
                              <span className="text-[11px] text-slate-500">{partner.category}</span>
                            </div>
                          </div>
                        </td>

                        {/* Commercial Type Badge */}
                        <td className="py-3 px-4">
                          <span
                            className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border ${getTypeBadgeStyle(
                              partner.type
                            )}`}
                          >
                            {partner.type}
                          </span>
                        </td>

                        {/* Deep link */}
                        <td className="py-3 px-4 max-w-xs font-mono text-[11px]">
                          <div className="truncate text-blue-700 font-semibold" title={partner.deepLink}>
                            {partner.deepLink}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate" title={partner.webUrl}>
                            Web: {partner.webUrl}
                          </div>
                        </td>

                        {/* Payout */}
                        <td className="py-3 px-4 text-right">
                          <strong className="font-mono text-emerald-700 text-xs block">
                            {partner.payoutRate}
                          </strong>
                          <span className="text-[10px] text-slate-400 font-mono">
                            ₹{partner.payoutAmount} unit yield
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase inline-flex items-center gap-1 ${
                              partner.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {partner.status === 'active' ? (
                              <CheckCircle2 className="w-2.5 h-2.5" />
                            ) : (
                              <XCircle className="w-2.5 h-2.5" />
                            )}
                            {partner.status}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Test Deep Link */}
                            <button
                              type="button"
                              onClick={() => {
                                trackQuickAppRedirection(partner.id);
                                window.open(partner.deepLink || partner.webUrl, '_blank');
                              }}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                              title="Test launch deep link"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>

                            {/* Edit */}
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(partner)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                              title="Edit partner"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete */}
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Delete partner ${partner.name}?`)) {
                                  deleteQuickAppPartner(partner.id);
                                }
                              }}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Delete partner"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= VIEW 2: REDIRECTION & PAYOUT REPORTS ================= */}
      {adminViewMode === 'reports' && (
        <div className="space-y-6">
          {/* KPI Cards Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                Total Redirections / Launches
              </span>
              <div className="text-2xl font-black text-slate-900 font-mono">
                {reportStats.totalCount}
              </div>
              <span className="text-[10px] text-emerald-700 font-semibold block">
                ↑ Real-time tracking from Quick Apps Hub
              </span>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                Attributed Payout Yield
              </span>
              <div className="text-2xl font-black text-emerald-700 font-mono">
                ₹{reportStats.totalPayout.toLocaleString('en-IN')}
              </div>
              <span className="text-[10px] text-slate-500 block">
                Blended across all 6 models
              </span>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                App Installs (Android + iOS + Win)
              </span>
              <div className="text-2xl font-black text-blue-700 font-mono">
                {reportStats.byType['CPI - Android'].count +
                  reportStats.byType['CPI - IOS'].count +
                  reportStats.byType['CPI - Windows'].count}
              </div>
              <span className="text-[10px] text-blue-600 block">
                ₹{(
                  reportStats.byType['CPI - Android'].payout +
                  reportStats.byType['CPI - IOS'].payout +
                  reportStats.byType['CPI - Windows'].payout
                ).toLocaleString('en-IN')} CPI Revenue
              </span>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                Lead & Sale Conversions (CPL + CPS)
              </span>
              <div className="text-2xl font-black text-amber-700 font-mono">
                {reportStats.byType.CPL.count + reportStats.byType.CPS.count}
              </div>
              <span className="text-[10px] text-amber-700 block">
                ₹{(reportStats.byType.CPL.payout + reportStats.byType.CPS.payout).toLocaleString('en-IN')} Commission
              </span>
            </div>
          </div>

          {/* Model Breakdown 6-Grid */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-red-600" />
              <span>Redirections & Earnings by Commercial Model</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              {TYPE_OPTIONS.map((opt) => {
                const stat = reportStats.byType[opt.id];
                return (
                  <div key={opt.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <span className={`text-[10px] font-bold font-mono px-1.5 py-0.2 rounded border ${opt.badgeColor} inline-block`}>
                      {opt.label}
                    </span>
                    <div className="font-mono font-black text-base text-slate-900 pt-0.5">
                      {stat.count} <span className="text-[10px] text-slate-500 font-normal">clicks</span>
                    </div>
                    <div className="text-[11px] font-mono text-emerald-700 font-bold">
                      ₹{stat.payout.toLocaleString('en-IN')}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live Redirection Logs Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs space-y-3 p-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-red-600" />
                <h4 className="font-bold text-slate-900">Live User Redirection Log Stream</h4>
                <span className="text-slate-400 font-mono text-[11px]">({quickAppRedirectionLogs.length} events)</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={clearQuickAppRedirectionLogs}
                  className="px-2.5 py-1 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Clear Logs
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3 font-semibold">Timestamp</th>
                    <th className="py-3 px-3 font-semibold">Partner</th>
                    <th className="py-3 px-3 font-semibold">Model</th>
                    <th className="py-3 px-3 font-semibold">Platform</th>
                    <th className="py-3 px-3 font-semibold">Deep Link URI</th>
                    <th className="py-3 px-3 font-semibold text-right">Yield</th>
                    <th className="py-3 px-3 font-semibold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {quickAppRedirectionLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                        No redirection events logged yet. Click "Simulate Redirection" or test a partner card in the storefront!
                      </td>
                    </tr>
                  ) : (
                    quickAppRedirectionLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                          {log.timestamp}
                        </td>

                        <td className="py-2.5 px-3">
                          <span className="font-bold text-slate-900 block">{log.partnerName}</span>
                          <span className="text-[10px] text-slate-400 font-mono truncate max-w-[140px] block">
                            {log.userAgent || 'App Browser'}
                          </span>
                        </td>

                        <td className="py-2.5 px-3">
                          <span className={`text-[10px] font-bold font-mono px-2 py-0.2 rounded-full border ${getTypeBadgeStyle(log.partnerType)}`}>
                            {log.partnerType}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 font-semibold text-slate-700">
                          {log.devicePlatform}
                        </td>

                        <td className="py-2.5 px-3 font-mono text-[11px] text-blue-700 truncate max-w-xs" title={log.targetUrl}>
                          {log.targetUrl}
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                          ₹{log.payoutAmount}
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase">
                            {log.status.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD / EDIT PARTNER ================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-xl p-6 sm:p-7 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Zap className="w-4 h-4 text-red-600 fill-red-500" />
                <span>{editingPartner ? 'Edit Quick App Partner' : 'Add New Quick App Partner'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
              {/* Partner Name & Category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Company / Partner Name *</label>
                  <input
                    type="text"
                    required
                    value={formState.name}
                    onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                    placeholder="e.g. Swiggy, Flipkart, Cred"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-hidden focus:border-red-500 shadow-2xs font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Category / Vertical *</label>
                  <select
                    value={formState.category}
                    onChange={(e) => setFormState({ ...formState, category: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-hidden focus:border-red-500 cursor-pointer"
                  >
                    <option value="Food Delivery & Dining">Food Delivery & Dining</option>
                    <option value="10-Min Quick Grocery">10-Min Quick Grocery</option>
                    <option value="E-Commerce & Electronics">E-Commerce & Electronics</option>
                    <option value="Fintech & Credit Cards">Fintech & Credit Cards</option>
                    <option value="Banking & Personal Loans">Banking & Personal Loans</option>
                    <option value="Insurance & Healthcare">Insurance & Healthcare</option>
                    <option value="Travel & Flights">Travel & Flights</option>
                    <option value="Cabs & Ride-Hailing">Cabs & Ride-Hailing</option>
                    <option value="Movies & Entertainment">Movies & Entertainment</option>
                    <option value="Software & Productivity">Software & Productivity</option>
                  </select>
                </div>
              </div>

              {/* Exact Type Selection Dropdown from user's photo! */}
              <div className="p-3.5 bg-red-50/50 rounded-2xl border border-red-200/80 space-y-2">
                <label className="block text-red-950 font-black uppercase tracking-wider text-[11px] flex items-center justify-between">
                  <span>Select Commercial Type * (Exact match to specification)</span>
                  <span className="text-[10px] text-red-700 font-bold">{formState.type}</span>
                </label>
                <select
                  required
                  value={formState.type}
                  onChange={(e) => setFormState({ ...formState, type: e.target.value as QuickAppPartnerType })}
                  className="w-full px-3.5 py-2.5 bg-white border-2 border-red-300 rounded-xl text-slate-900 font-extrabold text-sm focus:outline-hidden focus:border-red-600 cursor-pointer shadow-xs"
                >
                  <option value="CPC">CPC (Cost Per Click)</option>
                  <option value="CPI - Android">CPI - Android (Cost Per Install Android)</option>
                  <option value="CPI - IOS">CPI - IOS (Cost Per Install iOS)</option>
                  <option value="CPI - Windows">CPI - Windows (Cost Per Install Windows)</option>
                  <option value="CPL">CPL (Cost Per Lead)</option>
                  <option value="CPS">CPS (Cost Per Sale / Commission)</option>
                </select>
                <p className="text-[11px] text-slate-600">
                  Select model to determine attribution and reports tracking whenever a user clicks on this partner.
                </p>
              </div>

              {/* Deep Link URI & Web Fallback URL */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">App Deep Link URI *</label>
                <input
                  type="text"
                  required
                  value={formState.deepLink}
                  onChange={(e) => setFormState({ ...formState, deepLink: e.target.value })}
                  placeholder="e.g. swiggy://open?utm_source=try1second or flipkart://open"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono text-xs focus:outline-hidden focus:border-red-500 shadow-2xs"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  The deep link scheme that opens the native Android / iOS app directly on user's device.
                </span>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Web Fallback URL *</label>
                <input
                  type="url"
                  required
                  value={formState.webUrl}
                  onChange={(e) => setFormState({ ...formState, webUrl: e.target.value })}
                  placeholder="https://www.swiggy.com"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono text-xs focus:outline-hidden focus:border-red-500 shadow-2xs"
                />
              </div>

              {/* Payout Rate Text & Payout Amount */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Display Payout Label</label>
                  <input
                    type="text"
                    required
                    value={formState.payoutRate}
                    onChange={(e) => setFormState({ ...formState, payoutRate: e.target.value })}
                    placeholder="e.g. ₹45 / Install or 8.5% CPS"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-hidden focus:border-red-500 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Unit Value (₹) for Reports</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={formState.payoutAmount}
                    onChange={(e) => setFormState({ ...formState, payoutAmount: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono font-bold focus:outline-hidden focus:border-red-500 shadow-2xs"
                  />
                </div>
              </div>

              {/* Icon Image URL & Presets */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">App Icon / Logo Image URL *</label>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="url"
                    required
                    value={formState.iconUrl}
                    onChange={(e) => setFormState({ ...formState, iconUrl: e.target.value })}
                    placeholder="https://images.unsplash.com/..."
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono text-xs focus:outline-hidden focus:border-red-500 shadow-2xs"
                  />
                  <img
                    src={formState.iconUrl}
                    alt="Preview"
                    className="w-9 h-9 rounded-xl object-cover border border-slate-300 shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=App&background=ea580c&color=fff';
                    }}
                  />
                </div>

                {/* Preset image selector */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {PRESET_ICONS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setFormState({ ...formState, iconUrl: preset.url })}
                      className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] whitespace-nowrap cursor-pointer transition-colors"
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">App Tagline / Description *</label>
                <textarea
                  rows={2}
                  required
                  value={formState.description}
                  onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                  placeholder="Offer details, coupon cashbacks, or key value proposition..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-hidden focus:border-red-500 shadow-2xs"
                />
              </div>

              {/* Status and Downloads */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Status</label>
                  <select
                    value={formState.status}
                    onChange={(e) => setFormState({ ...formState, status: e.target.value as 'active' | 'paused' })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-hidden focus:border-red-500 cursor-pointer font-bold"
                  >
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Rating (Stars)</label>
                  <input
                    type="number"
                    step={0.1}
                    min={1}
                    max={5}
                    value={formState.rating}
                    onChange={(e) => setFormState({ ...formState, rating: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-hidden focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Badge Tag</label>
                  <input
                    type="text"
                    value={formState.badge}
                    onChange={(e) => setFormState({ ...formState, badge: e.target.value })}
                    placeholder="e.g. Hot Offer"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-hidden focus:border-red-500"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold cursor-pointer shadow-md shadow-red-600/20"
                >
                  {editingPartner ? 'Save Changes' : 'Register Partner App'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
