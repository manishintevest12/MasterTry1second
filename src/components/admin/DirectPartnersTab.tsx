import React, { useState } from 'react';
import {
  Handshake,
  Search,
  Plus,
  ExternalLink,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Sparkles,
  Globe,
  MousePointerClick,
  Check,
  RotateCcw,
  SlidersHorizontal,
  ShieldCheck,
  Zap,
  Building2,
  Plane,
  ShoppingBag,
  Utensils,
  Car,
  Landmark,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DirectPartnerItem } from '../../types';

const CATEGORY_OPTIONS: { id: DirectPartnerItem['category']; label: string; icon: React.ElementType }[] = [
  { id: 'travel', label: 'Travel & Transit (Flights, Hotels, Bus)', icon: Plane },
  { id: 'retail', label: 'Retail & 10-Min Grocery', icon: ShoppingBag },
  { id: 'food', label: 'Food Delivery & Cinema', icon: Utensils },
  { id: 'finance', label: 'Banking & Insurance', icon: Landmark },
  { id: 'cabs', label: 'Cabs & Mobility', icon: Car },
];

const PRESET_BG_COLORS = [
  { name: 'Indigo / Navy', value: 'bg-[#001b94]', text: 'text-white' },
  { name: 'Sky / Booking Blue', value: 'bg-[#003580]', text: 'text-white' },
  { name: 'MakeMyTrip Red', value: 'bg-[#d84e55]', text: 'text-white' },
  { name: 'Zomato Crimson', value: 'bg-[#e23744]', text: 'text-white' },
  { name: 'Swiggy Orange', value: 'bg-[#fc8019]', text: 'text-white' },
  { name: 'Amazon Dark', value: 'bg-[#131921]', text: 'text-[#ff9900]' },
  { name: 'Flipkart Blue', value: 'bg-[#2874f0]', text: 'text-[#ffe500]' },
  { name: 'Blinkit Yellow', value: 'bg-[#f7d300]', text: 'text-slate-950' },
  { name: 'Zepto Purple', value: 'bg-[#4b0082]', text: 'text-white' },
  { name: 'Emerald / Green', value: 'bg-emerald-600', text: 'text-white' },
  { name: 'Teal / Cyan', value: 'bg-[#00acc1]', text: 'text-white' },
  { name: 'Uber Black', value: 'bg-black', text: 'text-white' },
  { name: 'Amber / Gold', value: 'bg-[#ffb400]', text: 'text-slate-950' },
  { name: 'Rose / Pink', value: 'bg-[#ff3f6c]', text: 'text-white' },
  { name: 'HDFC Blue', value: 'bg-[#004c8f]', text: 'text-white' },
  { name: 'Axis Burgundy', value: 'bg-[#800020]', text: 'text-white' },
];

export const DirectPartnersTab: React.FC = () => {
  const {
    directPartners,
    addDirectPartner,
    updateDirectPartner,
    toggleDirectPartnerStatus,
    deleteDirectPartner,
    recordPartnerClick,
    addToast,
    setActiveNavTab,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'active' | 'paused'>('all');
  const [onlyFeatured, setOnlyFeatured] = useState(false);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<DirectPartnerItem | null>(null);

  // Form State
  const [formState, setFormState] = useState<{
    name: string;
    category: DirectPartnerItem['category'];
    categoryLabel: string;
    badge: string;
    logoBg: string;
    logoText: string;
    textColor: string;
    description: string;
    websiteUrl: string;
    status: 'active' | 'paused';
    featured: boolean;
  }>({
    name: '',
    category: 'travel',
    categoryLabel: 'Flights & Hotels',
    badge: 'Direct API',
    logoBg: 'bg-[#003580]',
    logoText: '',
    textColor: 'text-white',
    description: '',
    websiteUrl: 'https://',
    status: 'active',
    featured: false,
  });

  const resetForm = () => {
    setFormState({
      name: '',
      category: 'travel',
      categoryLabel: 'Flights & Hotels',
      badge: 'Direct API',
      logoBg: 'bg-[#003580]',
      logoText: '',
      textColor: 'text-white',
      description: '',
      websiteUrl: 'https://',
      status: 'active',
      featured: false,
    });
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (partner: DirectPartnerItem) => {
    setEditingPartner(partner);
    setFormState({
      name: partner.name,
      category: partner.category,
      categoryLabel: partner.categoryLabel,
      badge: partner.badge,
      logoBg: partner.logoBg,
      logoText: partner.logoText,
      textColor: partner.textColor || 'text-white',
      description: partner.description,
      websiteUrl: partner.websiteUrl,
      status: partner.status,
      featured: !!partner.featured,
    });
  };

  const handleSaveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.name.trim() || !formState.websiteUrl.trim()) {
      addToast('alert', 'Validation Error', 'Partner name and destination Website URL are required.');
      return;
    }

    let url = formState.websiteUrl.trim();
    if (!url.includes('://')) {
      url = `https://${url}`;
    }

    const autoLogoText = formState.logoText.trim()
      ? formState.logoText.trim().toUpperCase()
      : formState.name.slice(0, 3).toUpperCase();

    addDirectPartner({
      name: formState.name.trim(),
      category: formState.category,
      categoryLabel: formState.categoryLabel.trim() || 'Partner Platform',
      badge: formState.badge.trim() || 'Direct API',
      logoBg: formState.logoBg,
      logoText: autoLogoText,
      textColor: formState.textColor,
      description: formState.description.trim() || 'Verified direct partner portal with zero markup price discovery.',
      websiteUrl: url,
      status: formState.status,
      featured: formState.featured,
    });

    setIsAddModalOpen(false);
    resetForm();
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPartner) return;

    if (!formState.name.trim() || !formState.websiteUrl.trim()) {
      addToast('alert', 'Validation Error', 'Partner name and destination Website URL are required.');
      return;
    }

    let url = formState.websiteUrl.trim();
    if (!url.includes('://')) {
      url = `https://${url}`;
    }

    const autoLogoText = formState.logoText.trim()
      ? formState.logoText.trim().toUpperCase()
      : formState.name.slice(0, 3).toUpperCase();

    updateDirectPartner(editingPartner.id, {
      name: formState.name.trim(),
      category: formState.category,
      categoryLabel: formState.categoryLabel.trim(),
      badge: formState.badge.trim(),
      logoBg: formState.logoBg,
      logoText: autoLogoText,
      textColor: formState.textColor,
      description: formState.description.trim(),
      websiteUrl: url,
      status: formState.status,
      featured: formState.featured,
    });

    setEditingPartner(null);
    resetForm();
  };

  const handleTestNavigate = (partner: DirectPartnerItem) => {
    recordPartnerClick(partner.id);
    addToast(
      'info',
      `Testing Partner Link: ${partner.name}`,
      `Opening ${partner.websiteUrl} in new tab...`
    );
    window.open(partner.websiteUrl, '_blank', 'noopener,noreferrer');
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to remove "${name}" from the 100+ Direct Partners directory? Customers will no longer see this partner logo on the storefront.`)) {
      deleteDirectPartner(id);
    }
  };

  // Filtered List
  const filteredPartners = directPartners.filter((p) => {
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    const matchesStatus = selectedStatus === 'all' || p.status === selectedStatus;
    const matchesFeatured = !onlyFeatured || !!p.featured;
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.websiteUrl.toLowerCase().includes(q) ||
      p.categoryLabel.toLowerCase().includes(q) ||
      p.badge.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q);

    return matchesCategory && matchesStatus && matchesFeatured && matchesQuery;
  });

  // KPI Calculations
  const totalCount = directPartners.length;
  const activeCount = directPartners.filter((p) => p.status === 'active').length;
  const pausedCount = directPartners.filter((p) => p.status === 'paused').length;
  const featuredCount = directPartners.filter((p) => p.featured).length;
  const totalClicks = directPartners.reduce((sum, p) => sum + (p.clickCount || 0), 0);

  return (
    <div className="space-y-6 text-slate-900">
      {/* Top Banner & KPI Summary (White Theme) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-xs font-bold uppercase tracking-wider mb-2">
            <Handshake className="w-3.5 h-3.5" />
            <span>Storefront Partner Management System</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <span>Directly Access Our 100+ Partners Management</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Configure partner directory items displayed in the customer storefront. Control partner logo styling, destination URLs for customer redirection on click, live synchronization status, and click attribution.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 cursor-pointer transition-all hover:scale-105 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Partner</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveNavTab('home')}
            className="px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900 font-semibold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
            title="View customer storefront"
          >
            <ExternalLink className="w-3.5 h-3.5 text-orange-600" />
            <span>Preview Storefront</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Row (White Theme) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold mb-1">
            <span>Total Partners</span>
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-xl font-black text-slate-900 font-mono">{totalCount}</div>
          <span className="text-[10px] text-slate-500">In directory database</span>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 text-[11px] font-semibold mb-1">
            <span>Active & Live</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-xl font-black text-emerald-700 font-mono">{activeCount}</div>
          <span className="text-[10px] text-slate-500">Clickable on storefront</span>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-amber-600 text-[11px] font-semibold mb-1">
            <span>Paused / Hidden</span>
            <XCircle className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-xl font-black text-amber-700 font-mono">{pausedCount}</div>
          <span className="text-[10px] text-slate-500">Temporarily disabled</span>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-orange-600 text-[11px] font-semibold mb-1">
            <span>Customer Clicks</span>
            <MousePointerClick className="w-3.5 h-3.5 text-orange-600" />
          </div>
          <div className="text-xl font-black text-orange-700 font-mono">{totalClicks.toLocaleString()}</div>
          <span className="text-[10px] text-slate-500">Storefront navigations</span>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-sky-600 text-[11px] font-semibold mb-1">
            <span>Featured Partners</span>
            <Sparkles className="w-3.5 h-3.5 text-sky-600" />
          </div>
          <div className="text-xl font-black text-sky-700 font-mono">{featuredCount}</div>
          <span className="text-[10px] text-slate-500">Priority prominence</span>
        </div>
      </div>

      {/* Filter and Search Bar (White Theme) */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search partner by name, website URL, category, or badge..."
              className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-orange-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-hidden focus:border-orange-500 cursor-pointer"
            >
              <option value="all">All Statuses ({totalCount})</option>
              <option value="active">Active Only ({activeCount})</option>
              <option value="paused">Paused Only ({pausedCount})</option>
            </select>

            <button
              type="button"
              onClick={() => setOnlyFeatured(!onlyFeatured)}
              className={`px-3 py-2 rounded-xl font-semibold border flex items-center gap-1.5 transition-colors cursor-pointer ${
                onlyFeatured
                  ? 'bg-sky-50 border-sky-300 text-sky-700'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Featured ({featuredCount})</span>
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
              selectedCategory === 'all'
                ? 'bg-orange-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            All Categories ({totalCount})
          </button>
          {CATEGORY_OPTIONS.map((cat) => {
            const Icon = cat.icon;
            const count = directPartners.filter((p) => p.category === cat.id).length;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  selectedCategory === cat.id
                    ? 'bg-orange-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3 h-3" />
                <span>{cat.label}</span>
                <span className="text-[10px] opacity-75">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Partners Cards / Table Grid (White Theme) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPartners.map((partner) => (
          <div
            key={partner.id}
            className={`p-4 rounded-2xl border transition-all flex flex-col justify-between shadow-xs ${
              partner.status === 'active'
                ? 'bg-white border-slate-200 hover:border-slate-300'
                : 'bg-slate-50 border-slate-200 opacity-75'
            }`}
          >
            <div>
              {/* Partner Card Top Row */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Clickable Logo Preview */}
                  <button
                    type="button"
                    onClick={() => handleTestNavigate(partner)}
                    title={`Click logo to test navigation to ${partner.websiteUrl}`}
                    className={`w-12 h-12 rounded-xl ${partner.logoBg} ${
                      partner.textColor || 'text-white'
                    } flex items-center justify-center font-black text-xs shrink-0 shadow-xs tracking-tight cursor-pointer hover:scale-110 active:scale-95 transition-all ring-1 ring-slate-200 relative group`}
                  >
                    <span>{partner.logoText}</span>
                    <ExternalLink className="w-3 h-3 absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-bold text-slate-900 text-sm truncate">{partner.name}</h4>
                      {partner.featured && (
                        <span title="Featured Partner" className="text-amber-500 text-xs">
                          ★
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500 block truncate">
                      {partner.categoryLabel}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      partner.status === 'active'
                        ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                        : 'text-amber-700 bg-amber-50 border border-amber-200'
                    }`}
                  >
                    {partner.status === 'active' ? 'Active' : 'Paused'}
                  </span>
                  <span className="text-[9px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                    {partner.badge}
                  </span>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-slate-600 leading-relaxed mb-3 line-clamp-2">
                {partner.description}
              </p>

              {/* Destination Website Link Box */}
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between text-xs mb-3">
                <div className="min-w-0 flex items-center gap-1.5 text-slate-600">
                  <Globe className="w-3 h-3 text-orange-600 shrink-0" />
                  <span className="font-mono text-[11px] truncate text-slate-700">
                    {partner.websiteUrl}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleTestNavigate(partner)}
                  className="shrink-0 ml-2 text-orange-600 hover:text-orange-700 font-bold text-[11px] flex items-center gap-1 hover:underline cursor-pointer"
                  title="Test partner link in new window"
                >
                  <span>Test Link</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>

            {/* Bottom Row: Customer Clicks + Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-slate-500 font-mono text-[11px]">
                <MousePointerClick className="w-3.5 h-3.5 text-orange-600" />
                <span>{(partner.clickCount || 0).toLocaleString()} Clicks</span>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Status Toggle Button */}
                <button
                  type="button"
                  onClick={() => toggleDirectPartnerStatus(partner.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer border ${
                    partner.status === 'active'
                      ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}
                  title={partner.status === 'active' ? 'Pause on storefront' : 'Activate on storefront'}
                >
                  {partner.status === 'active' ? 'Pause' : 'Activate'}
                </button>

                {/* Edit Button */}
                <button
                  type="button"
                  onClick={() => handleOpenEdit(partner)}
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer border border-slate-200"
                  title="Edit partner details & URL"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>

                {/* Delete Button */}
                <button
                  type="button"
                  onClick={() => handleDelete(partner.id, partner.name)}
                  className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                  title="Delete partner"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredPartners.length === 0 && (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 space-y-3 shadow-xs">
          <Handshake className="w-10 h-10 mx-auto text-slate-400" />
          <p className="text-sm font-semibold text-slate-900">No partners found matching criteria</p>
          <p className="text-xs text-slate-500">Try adjusting your category filter, status filter, or search keywords.</p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
              setSelectedStatus('all');
              setOnlyFeatured(false);
            }}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl cursor-pointer border border-slate-200"
          >
            Clear All Filters
          </button>
        </div>
      )}

      {/* ================= ADD PARTNER MODAL (White Theme) ================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-orange-600" />
                <span>Add Partner to 100+ Direct Directory</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-800 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAdd} className="space-y-4 pt-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Partner Brand Name *</label>
                  <input
                    type="text"
                    required
                    value={formState.name}
                    onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                    placeholder="e.g. Tata Neu, Akasa Air, Nykaa"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Deep Link / Destination URL *</label>
                  <input
                    type="text"
                    required
                    value={formState.websiteUrl}
                    onChange={(e) => setFormState({ ...formState, websiteUrl: e.target.value })}
                    placeholder="e.g. swiggy://open or https://www.swiggy.com"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-orange-500 font-mono text-xs"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Direct app deep link or website URL opened when user clicks "Select".
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Vertical Category *</label>
                  <select
                    value={formState.category}
                    onChange={(e) => setFormState({ ...formState, category: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-hidden focus:border-orange-500 cursor-pointer"
                  >
                    <option value="travel">Travel & Transit (Flights, Hotels, Bus)</option>
                    <option value="retail">Retail & 10-Min Grocery</option>
                    <option value="food">Food Delivery & Cinema</option>
                    <option value="finance">Banking & Insurance</option>
                    <option value="cabs">Cabs & Mobility</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Category Label</label>
                  <input
                    type="text"
                    value={formState.categoryLabel}
                    onChange={(e) => setFormState({ ...formState, categoryLabel: e.target.value })}
                    placeholder="e.g. Flights & Stays, Quick-Commerce"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Trust Badge</label>
                  <select
                    value={formState.badge}
                    onChange={(e) => setFormState({ ...formState, badge: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-hidden focus:border-orange-500 cursor-pointer"
                  >
                    <option value="Direct API">Direct API</option>
                    <option value="Official Partner">Official Partner</option>
                    <option value="Licensed Meta">Licensed Meta</option>
                    <option value="Verified Partner">Verified Partner</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Logo Text / Initials</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={formState.logoText}
                    onChange={(e) => setFormState({ ...formState, logoText: e.target.value.toUpperCase() })}
                    placeholder="e.g. MMT, FK"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-orange-500 uppercase font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Status</label>
                  <select
                    value={formState.status}
                    onChange={(e) => setFormState({ ...formState, status: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-hidden focus:border-orange-500 cursor-pointer"
                  >
                    <option value="active">Active (Live)</option>
                    <option value="paused">Paused (Hidden)</option>
                  </select>
                </div>
              </div>

              {/* Logo Color Preset Selector */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1.5">Logo Background Color Theme</label>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {PRESET_BG_COLORS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setFormState({ ...formState, logoBg: preset.value, textColor: preset.text })}
                      className={`h-9 rounded-xl ${preset.value} flex items-center justify-center text-xs font-bold transition-all cursor-pointer ring-1 ring-slate-200 ${
                        formState.logoBg === preset.value ? 'ring-3 ring-orange-500 scale-105' : 'hover:opacity-90'
                      }`}
                      title={preset.name}
                    >
                      <span className={preset.text}>{formState.logoText || 'ABC'}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Description / Value Proposition</label>
                <textarea
                  rows={2}
                  value={formState.description}
                  onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                  placeholder="e.g. Instant flight booking with live seat availability and zero markup sync."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-orange-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="add-featured"
                  checked={formState.featured}
                  onChange={(e) => setFormState({ ...formState, featured: e.target.checked })}
                  className="w-4 h-4 rounded text-orange-600 bg-slate-100 border-slate-300 focus:ring-orange-500 cursor-pointer"
                />
                <label htmlFor="add-featured" className="text-slate-700 cursor-pointer select-none">
                  Mark as Featured Partner (Displays with priority badge)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-orange-600 hover:bg-orange-500 font-bold text-white rounded-xl cursor-pointer"
                >
                  Add Partner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= EDIT PARTNER MODAL (White Theme) ================= */}
      {editingPartner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-orange-600" />
                <span>Edit Partner: {editingPartner.name}</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingPartner(null)}
                className="text-slate-400 hover:text-slate-800 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 pt-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Partner Brand Name *</label>
                  <input
                    type="text"
                    required
                    value={formState.name}
                    onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Deep Link / Destination URL *</label>
                  <input
                    type="text"
                    required
                    value={formState.websiteUrl}
                    onChange={(e) => setFormState({ ...formState, websiteUrl: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-orange-500 font-mono text-xs"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Direct app deep link or website URL opened when user clicks "Select".
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Vertical Category *</label>
                  <select
                    value={formState.category}
                    onChange={(e) => setFormState({ ...formState, category: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-hidden focus:border-orange-500 cursor-pointer"
                  >
                    <option value="travel">Travel & Transit (Flights, Hotels, Bus)</option>
                    <option value="retail">Retail & 10-Min Grocery</option>
                    <option value="food">Food Delivery & Cinema</option>
                    <option value="finance">Banking & Insurance</option>
                    <option value="cabs">Cabs & Mobility</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Category Label</label>
                  <input
                    type="text"
                    value={formState.categoryLabel}
                    onChange={(e) => setFormState({ ...formState, categoryLabel: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Trust Badge</label>
                  <select
                    value={formState.badge}
                    onChange={(e) => setFormState({ ...formState, badge: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-hidden focus:border-orange-500 cursor-pointer"
                  >
                    <option value="Direct API">Direct API</option>
                    <option value="Official Partner">Official Partner</option>
                    <option value="Licensed Meta">Licensed Meta</option>
                    <option value="Verified Partner">Verified Partner</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Logo Text / Initials</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={formState.logoText}
                    onChange={(e) => setFormState({ ...formState, logoText: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-orange-500 uppercase font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Status</label>
                  <select
                    value={formState.status}
                    onChange={(e) => setFormState({ ...formState, status: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-hidden focus:border-orange-500 cursor-pointer"
                  >
                    <option value="active">Active (Live)</option>
                    <option value="paused">Paused (Hidden)</option>
                  </select>
                </div>
              </div>

              {/* Logo Color Preset Selector */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1.5">Logo Background Color Theme</label>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {PRESET_BG_COLORS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setFormState({ ...formState, logoBg: preset.value, textColor: preset.text })}
                      className={`h-9 rounded-xl ${preset.value} flex items-center justify-center text-xs font-bold transition-all cursor-pointer ring-1 ring-slate-200 ${
                        formState.logoBg === preset.value ? 'ring-3 ring-orange-500 scale-105' : 'hover:opacity-90'
                      }`}
                      title={preset.name}
                    >
                      <span className={preset.text}>{formState.logoText || 'ABC'}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Description / Value Proposition</label>
                <textarea
                  rows={2}
                  value={formState.description}
                  onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-orange-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="edit-featured"
                  checked={formState.featured}
                  onChange={(e) => setFormState({ ...formState, featured: e.target.checked })}
                  className="w-4 h-4 rounded text-orange-600 bg-slate-100 border-slate-300 focus:ring-orange-500 cursor-pointer"
                />
                <label htmlFor="edit-featured" className="text-slate-700 cursor-pointer select-none">
                  Mark as Featured Partner (Displays with priority badge)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingPartner(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-orange-600 hover:bg-orange-500 font-bold text-white rounded-xl cursor-pointer"
                >
                  Save Partner Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
