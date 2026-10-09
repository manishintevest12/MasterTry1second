import React, { useState } from 'react';
import {
  Sliders,
  Plus,
  Play,
  Pause,
  Edit2,
  CheckCircle2,
  MapPin,
  IndianRupee,
  Briefcase,
  Layers,
  Sparkles,
  TrendingUp,
  AlertCircle,
  X,
  Building2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { MerchantCampaign } from '../../types';

export const CampaignControlTab: React.FC = () => {
  const {
    merchantCampaigns,
    toggleCampaignStatus,
    updateCampaign,
    addMerchantCampaign,
    addToast,
    activeMerchantRole,
    authenticatedVendor,
  } = useApp();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<MerchantCampaign | null>(null);

  const vendorVertical = authenticatedVendor?.vertical || 'food';
  const vendorCompanyName = authenticatedVendor?.companyName || 'Merchant Partner';

  // Form State
  const [formState, setFormState] = useState<{
    merchantName: string;
    vertical: string;
    campaignName: string;
    targetMinSalary: number;
    targetCities: string;
    minAmount: number;
    maxAmount: number;
    cplBid: number;
    dailyLeadCap: number;
  }>({
    merchantName: vendorCompanyName,
    vertical: vendorVertical,
    campaignName: '',
    targetMinSalary: 40000,
    targetCities: 'Mumbai, Bengaluru, Delhi NCR, Pune',
    minAmount: 500,
    maxAmount: 25000,
    cplBid: 85,
    dailyLeadCap: 50,
  });

  const resetForm = () => {
    setFormState({
      merchantName: vendorCompanyName,
      vertical: vendorVertical,
      campaignName: '',
      targetMinSalary: 40000,
      targetCities: 'Mumbai, Bengaluru, Delhi NCR, Pune',
      minAmount: 500,
      maxAmount: 25000,
      cplBid: vendorVertical === 'food' ? 85 : vendorVertical === 'grocery' ? 50 : 750,
      dailyLeadCap: 50,
    });
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (camp: MerchantCampaign) => {
    setEditingCampaign(camp);
    setFormState({
      merchantName: camp.merchantName,
      vertical: camp.vertical,
      campaignName: camp.campaignName,
      targetMinSalary: camp.targetMinSalary || 40000,
      targetCities: camp.targetCities.join(', '),
      minAmount: camp.minAmount || 500,
      maxAmount: camp.maxAmount || 25000,
      cplBid: camp.cplBid,
      dailyLeadCap: camp.dailyLeadCap,
    });
    setIsCreateOpen(true);
  };

  const handleSaveCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.campaignName.trim()) {
      addToast('alert', 'Validation Error', 'Please specify a campaign name.');
      return;
    }

    const citiesArray = formState.targetCities
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    addMerchantCampaign({
      merchantName: formState.merchantName,
      vertical: formState.vertical,
      campaignName: formState.campaignName.trim(),
      targetMinSalary: Number(formState.targetMinSalary),
      targetCities: citiesArray.length > 0 ? citiesArray : ['All India'],
      minAmount: Number(formState.minAmount),
      maxAmount: Number(formState.maxAmount),
      cplBid: Number(formState.cplBid),
      dailyLeadCap: Number(formState.dailyLeadCap),
      status: 'active',
    });

    setIsCreateOpen(false);
    resetForm();
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCampaign) return;

    const citiesArray = formState.targetCities
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    updateCampaign(editingCampaign.id, {
      campaignName: formState.campaignName.trim(),
      merchantName: formState.merchantName,
      vertical: formState.vertical,
      targetMinSalary: Number(formState.targetMinSalary),
      targetCities: citiesArray,
      minAmount: Number(formState.minAmount),
      maxAmount: Number(formState.maxAmount),
      cplBid: Number(formState.cplBid),
      dailyLeadCap: Number(formState.dailyLeadCap),
    });

    setEditingCampaign(null);
    setIsCreateOpen(false);
  };

  // Strictly filter based on active vendor category
  const roleFilteredCampaigns = merchantCampaigns.filter((c) => {
    if (authenticatedVendor) {
      // STRICT CATEGORY ISOLATION: only campaigns for this vendor's vertical!
      return c.vertical === authenticatedVendor.vertical;
    }
    if (activeMerchantRole === 'admin_viewer') return true;
    if (activeMerchantRole === 'hdfc') return c.merchantName.toLowerCase().includes('hdfc');
    if (activeMerchantRole === 'bajaj') return c.merchantName.toLowerCase().includes('bajaj');
    if (activeMerchantRole === 'icici') return c.merchantName.toLowerCase().includes('icici');
    if (activeMerchantRole === 'policybazaar') return c.merchantName.toLowerCase().includes('policybazaar') || c.vertical === 'insurance';
    return true;
  });

  return (
    <div className="space-y-6 text-slate-900">
      {/* Category Domain Banner */}
      {authenticatedVendor && (
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-bold text-slate-900">
              Active Category Domain: <span className="text-blue-700 uppercase font-black">{authenticatedVendor.vertical}</span>
            </span>
            <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-mono font-bold border border-blue-200">
              Category-Locked (Vendor ID: {authenticatedVendor.vendorIdNumber})
            </span>
          </div>
          <span className="text-[11px] text-slate-500">
            Campaign bidding and delivery rules are restricted to <strong>{authenticatedVendor.vertical.toUpperCase()}</strong>.
          </span>
        </div>
      )}

      {/* Top Banner (White Theme) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-600" />
            <span>Targeting Rules & CPC/CPL Bidding Engine</span>
          </h3>
          <p className="text-xs text-slate-600 mt-1 max-w-xl">
            Control qualification gates for inbound customer leads and orders. Set target cities, ticket sizes, and daily delivery caps.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 flex items-center gap-2 cursor-pointer transition-all hover:scale-105 active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Campaign</span>
        </button>
      </div>

      {/* Campaign Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {roleFilteredCampaigns.map((camp) => {
          const capPercent = Math.min(100, Math.round((camp.leadsDeliveredToday / (camp.dailyLeadCap || 1)) * 100));

          return (
            <div
              key={camp.id}
              className={`p-5 rounded-2xl border transition-all space-y-4 ${
                camp.status === 'active'
                  ? 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                  : 'bg-slate-50 border-slate-200 opacity-75'
              }`}
            >
              {/* Card Header: Title & Status Toggle */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-sm ${
                        camp.vertical === 'loans'
                          ? 'bg-orange-50 text-orange-700 border border-orange-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {camp.vertical}
                    </span>
                    <span className="text-xs font-mono text-slate-500 font-semibold">
                      {camp.merchantName}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">{camp.campaignName}</h4>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleCampaignStatus(camp.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 border ${
                      camp.status === 'active'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                        : 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {camp.status === 'active' ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Active</span>
                      </>
                    ) : (
                      <>
                        <Pause className="w-3 h-3" />
                        <span>Paused</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEdit(camp)}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer border border-slate-200"
                    title="Edit campaign criteria"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Targeting Parameters 4-Box Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                <div>
                  <span className="text-[10px] text-slate-500 block">
                    {camp.vertical === 'food' || camp.vertical === 'grocery' || camp.vertical === 'ecommerce'
                      ? 'Min Order Basket'
                      : 'Min Salary Threshold'}
                  </span>
                  <strong className="text-slate-900 font-mono text-xs">
                    {camp.targetMinSalary !== undefined
                      ? `> ₹${camp.targetMinSalary.toLocaleString('en-IN')}${camp.vertical === 'food' || camp.vertical === 'grocery' ? '' : '/mo'}`
                      : 'Any Ticket Size'}
                  </strong>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 block">
                    {camp.vertical === 'food' || camp.vertical === 'grocery' || camp.vertical === 'ecommerce' ? 'CPC / CPO Bid' : 'CPL Bid Price'}
                  </span>
                  <strong className="text-emerald-700 font-mono text-xs">
                    ₹{camp.cplBid} / {camp.vertical === 'food' || camp.vertical === 'grocery' ? 'Order' : 'Qualified Lead'}
                  </strong>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 block">
                    {camp.vertical === 'loans' || camp.vertical === 'insurance' ? 'Loan / Cover Range' : 'Order Basket Range'}
                  </span>
                  <strong className="text-slate-900 font-mono text-[11px]">
                    {camp.minAmount !== undefined && camp.maxAmount !== undefined
                      ? (camp.vertical === 'loans' || camp.vertical === 'insurance')
                        ? `₹${(camp.minAmount / 100000).toFixed(0)}L - ₹${(camp.maxAmount / 100000).toFixed(0)}L`
                        : `₹${camp.minAmount.toLocaleString('en-IN')} - ₹${camp.maxAmount.toLocaleString('en-IN')}`
                      : 'Flexible'}
                  </strong>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 block">Total Lifetime Leads</span>
                  <strong className="text-blue-700 font-mono text-xs">
                    {camp.totalLeadsDelivered} Delivered
                  </strong>
                </div>
              </div>

              {/* Target Cities Tags */}
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 font-semibold block">Target Geo / Cities:</span>
                <div className="flex flex-wrap gap-1">
                  {camp.targetCities.map((city) => (
                    <span
                      key={city}
                      className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-mono border border-slate-200"
                    >
                      {city}
                    </span>
                  ))}
                </div>
              </div>

              {/* Daily Cap Progress Bar */}
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Daily Lead Quota:</span>
                  <span className="font-mono text-slate-900 font-bold">
                    {camp.leadsDeliveredToday} / {camp.dailyLeadCap} leads ({capPercent}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden border border-slate-200/50">
                  <div
                    className={`h-full rounded-full transition-all ${
                      capPercent >= 90
                        ? 'bg-rose-500'
                        : capPercent >= 60
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${capPercent}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* CREATE / EDIT MODAL (White Theme) */}
      {(isCreateOpen || editingCampaign) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg p-6 sm:p-7 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-600" />
                <span>{editingCampaign ? 'Edit Campaign Targeting Criteria' : 'Launch New Inbound CPL Campaign'}</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsCreateOpen(false);
                  setEditingCampaign(null);
                }}
                className="text-slate-400 hover:text-slate-700 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={editingCampaign ? handleSaveEdit : handleSaveCreate} className="space-y-4 pt-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Campaign Name *</label>
                <input
                  type="text"
                  required
                  value={formState.campaignName}
                  onChange={(e) => setFormState({ ...formState, campaignName: e.target.value })}
                  placeholder="e.g. HDFC Express Personal Loan HNI"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-blue-500 shadow-2xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Merchant Partner</label>
                  {authenticatedVendor ? (
                    <input
                      type="text"
                      readOnly
                      value={formState.merchantName}
                      className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-slate-800 font-bold cursor-not-allowed"
                    />
                  ) : (
                    <select
                      value={formState.merchantName}
                      onChange={(e) => setFormState({ ...formState, merchantName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-hidden focus:border-blue-500 cursor-pointer"
                    >
                      <option value="HDFC Bank">HDFC Bank</option>
                      <option value="Bajaj Finserv">Bajaj Finserv</option>
                      <option value="ICICI Bank">ICICI Bank</option>
                      <option value="PolicyBazaar">PolicyBazaar</option>
                      <option value="Swiggy">Swiggy</option>
                      <option value="Zomato">Zomato</option>
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Designated Category</label>
                  {authenticatedVendor ? (
                    <input
                      type="text"
                      readOnly
                      value={`${authenticatedVendor.vertical.toUpperCase()} (Locked)`}
                      className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 font-bold uppercase cursor-not-allowed"
                    />
                  ) : (
                    <select
                      value={formState.vertical}
                      onChange={(e) => setFormState({ ...formState, vertical: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-hidden focus:border-blue-500 cursor-pointer"
                    >
                      <option value="food">Food Delivery</option>
                      <option value="grocery">10-Min Grocery</option>
                      <option value="ecommerce">E-Commerce</option>
                      <option value="loans">Loans</option>
                      <option value="insurance">Insurance</option>
                      <option value="flights">Flights</option>
                    </select>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    {authenticatedVendor?.vertical === 'food' || authenticatedVendor?.vertical === 'grocery' || authenticatedVendor?.vertical === 'ecommerce'
                      ? 'Min Order Basket (₹) *'
                      : 'Minimum Net Salary (₹) *'}
                  </label>
                  <input
                    type="number"
                    min={100}
                    step={100}
                    required
                    value={formState.targetMinSalary}
                    onChange={(e) => setFormState({ ...formState, targetMinSalary: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">CPL / CPC Bid Price (₹) *</label>
                  <input
                    type="number"
                    min={20}
                    step={10}
                    required
                    value={formState.cplBid}
                    onChange={(e) => setFormState({ ...formState, cplBid: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Min Ticket Size (₹)</label>
                  <input
                    type="number"
                    min={50000}
                    step={50000}
                    value={formState.minAmount}
                    onChange={(e) => setFormState({ ...formState, minAmount: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Max Ticket Size (₹)</label>
                  <input
                    type="number"
                    min={100000}
                    step={100000}
                    value={formState.maxAmount}
                    onChange={(e) => setFormState({ ...formState, maxAmount: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Target Cities (Comma Separated)
                </label>
                <input
                  type="text"
                  value={formState.targetCities}
                  onChange={(e) => setFormState({ ...formState, targetCities: e.target.value })}
                  placeholder="e.g. Mumbai, Bengaluru, Delhi NCR, Pune, Chennai"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Daily Cap (Max Leads/Day)</label>
                <input
                  type="number"
                  min={5}
                  value={formState.dailyLeadCap}
                  onChange={(e) => setFormState({ ...formState, dailyLeadCap: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setEditingCampaign(null);
                  }}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 font-bold text-white rounded-xl cursor-pointer shadow-md shadow-blue-600/20"
                >
                  {editingCampaign ? 'Save Campaign Changes' : 'Launch Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
