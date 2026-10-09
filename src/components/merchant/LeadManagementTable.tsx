import React, { useState } from 'react';
import {
  Search,
  Download,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  IndianRupee,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  User,
  Building2,
  AlertCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CplLead } from '../../types';

export const LeadManagementTable: React.FC = () => {
  const { cplLeads, updateLeadStatus, addToast, activeMerchantRole, authenticatedVendor } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVertical, setSelectedVertical] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedSalary, setSelectedSalary] = useState<string>('all');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);

  const isFinancialVertical = !authenticatedVendor || authenticatedVendor.vertical === 'loans' || authenticatedVendor.vertical === 'insurance';

  // Strict Filter: Lock to authenticated merchant's vertical if logged in
  const roleFilteredLeads = cplLeads.filter((lead) => {
    if (authenticatedVendor) {
      // STRICT CATEGORY ISOLATION: A Food merchant sees ONLY Food leads, not loan or insurance!
      return lead.vertical === authenticatedVendor.vertical;
    }
    if (activeMerchantRole === 'admin_viewer') return true;
    if (activeMerchantRole === 'hdfc') return lead.assignedMerchant.toLowerCase().includes('hdfc');
    if (activeMerchantRole === 'bajaj') return lead.assignedMerchant.toLowerCase().includes('bajaj');
    if (activeMerchantRole === 'icici') return lead.assignedMerchant.toLowerCase().includes('icici');
    if (activeMerchantRole === 'policybazaar') return lead.assignedMerchant.toLowerCase().includes('policybazaar') || lead.vertical === 'insurance';
    return true;
  });

  // Apply UI filters
  const filteredLeads = roleFilteredLeads.filter((lead) => {
    const matchesVertical = selectedVertical === 'all' || lead.vertical === selectedVertical;
    const matchesStatus = selectedStatus === 'all' || lead.status === selectedStatus;
    const matchesSalary = selectedSalary === 'all' || lead.salaryBracket === selectedSalary;
    const matchesCity = selectedCity === 'all' || lead.city.toLowerCase() === selectedCity.toLowerCase();

    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      lead.id.toLowerCase().includes(q) ||
      lead.fullName.toLowerCase().includes(q) ||
      lead.phone.toLowerCase().includes(q) ||
      lead.email.toLowerCase().includes(q) ||
      lead.city.toLowerCase().includes(q) ||
      lead.serviceType.toLowerCase().includes(q) ||
      lead.assignedMerchant.toLowerCase().includes(q) ||
      (lead.orderItemsOrNotes && lead.orderItemsOrNotes.toLowerCase().includes(q));

    return matchesVertical && matchesStatus && matchesSalary && matchesCity && matchesQuery;
  });

  // Extract unique cities for filter dropdown
  const uniqueCities = Array.from(new Set(roleFilteredLeads.map((l) => l.city)));

  // 1-Click Export Leads to CSV
  const handleExportCSV = () => {
    if (filteredLeads.length === 0) {
      addToast('alert', 'No Leads to Export', 'There are no leads matching your active filters.');
      return;
    }

    const headers = [
      'Lead ID',
      'Created At',
      'Customer Name',
      'Phone',
      'Email',
      'Vertical',
      'Service / Product',
      'Requested Amount (INR)',
      'Monthly Salary (INR)',
      'Salary Bracket',
      'Employment Type',
      'Existing EMIs (INR)',
      'City',
      'Pincode',
      'Estimated CIBIL',
      'Assigned Merchant',
      'Status',
      'CPL Cost (INR)',
      'Matched Partners Count',
    ];

    const rows = filteredLeads.map((l) => [
      `"${l.id}"`,
      `"${l.createdAt}"`,
      `"${l.fullName.replace(/"/g, '""')}"`,
      `"${l.phone}"`,
      `"${l.email}"`,
      `"${l.vertical.toUpperCase()}"`,
      `"${l.serviceType.replace(/"/g, '""')}"`,
      l.requestedAmount,
      l.monthlySalary !== undefined ? l.monthlySalary : 'N/A',
      `"${l.salaryBracket || 'Standard'}"`,
      `"${(l.employmentType ? l.employmentType.toUpperCase() : 'VERIFIED_CONSUMER')}"`,
      l.existingEmis !== undefined ? l.existingEmis : 'N/A',
      `"${l.city}"`,
      `"${l.pincode}"`,
      l.creditScoreEstimate,
      `"${l.assignedMerchant}"`,
      `"${l.status.toUpperCase()}"`,
      l.cplCost,
      l.matchedPartners.length,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Try1Second_CPL_Leads_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast('success', 'Leads Exported to CSV', `Exported ${filteredLeads.length} leads successfully.`);
  };

  const getStatusBadge = (status: CplLead['status']) => {
    switch (status) {
      case 'new':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            New Lead
          </span>
        );
      case 'contacted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3 text-amber-400" />
            Contacted
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Approved
          </span>
        );
      case 'disqualified':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3 h-3 text-rose-400" />
            Disqualified
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 text-slate-900">
      {/* Category Domain Banner: Strictly Locked to Vendor's Category */}
      {authenticatedVendor && (
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-bold text-slate-900">
              Active Category Domain: <span className="text-blue-700 uppercase font-black">{authenticatedVendor.vertical}</span>
            </span>
            <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-mono font-bold border border-blue-200">
              Category-Locked (Vendor ID: {authenticatedVendor.vendorIdNumber} · {authenticatedVendor.companyName})
            </span>
          </div>
          <span className="text-[11px] text-slate-500">
            Customer inquiries and leads are restricted strictly to <strong>{authenticatedVendor.vertical.toUpperCase()}</strong>. Other verticals are blocked.
          </span>
        </div>
      )}

      {/* Top Action & Filter Toolbar (White Theme) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3 shadow-xs">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Lead ID, Customer Name, Phone, Email, or City..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-blue-500 shadow-2xs"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer transition-all shadow-md shadow-emerald-600/20 hover:scale-105 active:scale-95"
              title="Download all filtered leads as a CSV file"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Inquiries to CSV ({filteredLeads.length})</span>
            </button>
          </div>
        </div>

        {/* Filter Pills / Dropdowns */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1 text-slate-500 font-semibold mr-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Filters:</span>
          </div>

          {/* Vertical category lock / badge */}
          {authenticatedVendor ? (
            <span className="px-2.5 py-1.5 bg-blue-50 text-blue-700 rounded-xl font-bold uppercase text-[11px] border border-blue-200 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Category: {authenticatedVendor.vertical} (Locked)</span>
            </span>
          ) : (
            <select
              value={selectedVertical}
              onChange={(e) => setSelectedVertical(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-hidden focus:border-blue-500 cursor-pointer"
            >
              <option value="all">All Verticals</option>
              <option value="food">Food Delivery</option>
              <option value="grocery">10-Min Grocery</option>
              <option value="ecommerce">E-Commerce</option>
              <option value="loans">Loans & Mortgages</option>
              <option value="insurance">Insurance</option>
              <option value="flights">Flights & Travel</option>
            </select>
          )}

          {/* Status filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-hidden focus:border-blue-500 cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="new">New Inquiries</option>
            <option value="contacted">Contacted</option>
            <option value="approved">Approved</option>
            <option value="disqualified">Disqualified</option>
          </select>

          {/* Salary Bracket or Order Size filter */}
          {isFinancialVertical ? (
            <select
              value={selectedSalary}
              onChange={(e) => setSelectedSalary(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-hidden focus:border-blue-500 cursor-pointer"
            >
              <option value="all">All Income Brackets</option>
              <option value="< ₹35,000">&lt; ₹35,000</option>
              <option value="₹35,000 - ₹50,000">₹35,000 - ₹50,000</option>
              <option value="₹50,000 - ₹1,00,000">₹50,000 - ₹1,00,000</option>
              <option value="₹1,00,000+">₹1,00,000+ (High Net Worth)</option>
            </select>
          ) : null}

          {/* City filter */}
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-hidden focus:border-blue-500 cursor-pointer"
          >
            <option value="all">All Cities ({uniqueCities.length})</option>
            {uniqueCities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>

          {(selectedStatus !== 'all' || selectedSalary !== 'all' || selectedCity !== 'all' || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setSelectedVertical('all');
                setSelectedStatus('all');
                setSelectedSalary('all');
                setSelectedCity('all');
                setSearchQuery('');
              }}
              className="px-2.5 py-1 text-slate-500 hover:text-slate-900 underline cursor-pointer text-[11px]"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Leads Table (White Theme) */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Inquiry / Lead ID</th>
                <th className="py-3 px-4">Customer Details</th>
                <th className="py-3 px-4">{isFinancialVertical ? 'Product & Amount' : 'Requested Order / Service'}</th>
                <th className="py-3 px-4">{isFinancialVertical ? 'Monthly Income' : 'Order Basket & Value'}</th>
                <th className="py-3 px-4">{isFinancialVertical ? 'CIBIL Score' : 'Items / Instructions'}</th>
                <th className="py-3 px-4">City / Pincode</th>
                <th className="py-3 px-4">Status & Action</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLeads.map((lead) => {
                const isExpanded = expandedLeadId === lead.id;
                return (
                  <React.Fragment key={lead.id}>
                    <tr
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isExpanded ? 'bg-blue-50/40' : ''
                      }`}
                    >
                      {/* Lead ID & Time */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-blue-700 block text-xs">
                          {lead.id}
                        </span>
                        <span className="text-[10px] text-slate-500 block">{lead.createdAt}</span>
                        <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 mt-1 inline-block">
                          ₹{lead.cplCost} Fee
                        </span>
                      </td>

                      {/* Customer Details */}
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900 block text-sm">{lead.fullName}</span>
                        <span className="font-mono text-[11px] text-slate-600 block">{lead.phone}</span>
                        <span className="text-[10px] text-slate-500 truncate max-w-[180px] block">
                          {lead.email}
                        </span>
                      </td>

                      {/* Product / Service */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span
                            className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200"
                          >
                            {lead.vertical}
                          </span>
                        </div>
                        <span className="font-semibold text-slate-800 text-xs line-clamp-2">
                          {lead.serviceType}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                          Assigned: {lead.assignedMerchant}
                        </span>
                      </td>

                      {/* Amount / Basket */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-extrabold text-slate-900 text-sm block">
                          ₹{lead.requestedAmount.toLocaleString('en-IN')}
                        </span>
                        {lead.monthlySalary ? (
                          <span className="text-[10px] text-slate-500 block">
                            Salary: ₹{lead.monthlySalary.toLocaleString('en-IN')}
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-600 font-semibold block">
                            Verified High-Intent Order
                          </span>
                        )}
                      </td>

                      {/* CIBIL Score or Order Items / Notes */}
                      <td className="py-3.5 px-4">
                        {isFinancialVertical ? (
                          <>
                            <span
                              className={`font-mono font-black text-xs px-2 py-0.5 rounded ${
                                (lead.creditScoreEstimate || 700) >= 750
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : (lead.creditScoreEstimate || 700) >= 680
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {lead.creditScoreEstimate || 'N/A'}
                            </span>
                            <span className="text-[10px] text-slate-500 block mt-0.5">
                              {(lead.creditScoreEstimate || 700) >= 750 ? 'Prime' : 'Near-Prime'}
                            </span>
                          </>
                        ) : (
                          <div className="text-[11px] text-slate-700 line-clamp-2 max-w-[200px] font-medium">
                            {lead.orderItemsOrNotes || 'Direct customer transaction redirection'}
                          </div>
                        )}
                      </td>

                      {/* City / Pincode */}
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-900 block">{lead.city}</span>
                        <span className="font-mono text-[10px] text-slate-500 block">{lead.pincode}</span>
                      </td>

                      {/* Status Tag & Inline Dropdown */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1.5">
                          {getStatusBadge(lead.status)}
                          <select
                            value={lead.status}
                            onChange={(e) => updateLeadStatus(lead.id, e.target.value as any)}
                            className="text-[10px] bg-slate-50 border border-slate-200 rounded-lg text-slate-700 py-1 px-1.5 focus:outline-hidden focus:border-blue-500 cursor-pointer"
                          >
                            <option value="new">Mark New</option>
                            <option value="contacted">Mark Contacted</option>
                            <option value="approved">Mark Approved</option>
                            <option value="disqualified">Mark Disqualified</option>
                          </select>
                        </div>
                      </td>

                      {/* Expand / Details Toggle */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setExpandedLeadId(isExpanded ? null : lead.id)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer inline-flex items-center gap-1 text-xs font-semibold"
                          title="View complete applicant profile and matched partner quotes"
                        >
                          <span>{isExpanded ? 'Less' : 'View'}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                    </tr>

                    {/* EXPANDED PROFILE ROW (White Theme) */}
                    {isExpanded && (
                      <tr className="bg-slate-50/90 border-b border-slate-200">
                        <td colSpan={8} className="p-4 sm:p-5">
                          <div className="space-y-4">
                            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                              <div className="flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                <span className="font-bold text-slate-900 text-xs">
                                  Full Qualification Dossier & Underwriting Summary · {lead.id}
                                </span>
                              </div>
                              <span className="text-xs text-slate-500 font-mono">
                                Ingested via Try1Second CPL Engine
                              </span>
                            </div>

                            {/* 3-Column Profile Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                              {/* Column 1: Financial Qualification */}
                              <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                                  {isFinancialVertical ? 'Financial Qualification' : 'Consumer Order & Purchase Profile'}
                                </span>
                                <div className="space-y-1">
                                  <div className="flex justify-between">
                                    <span className="text-slate-500">{isFinancialVertical ? 'Monthly Net Income:' : 'Customer Basket / Budget:'}</span>
                                    <span className="font-mono font-bold text-slate-900">
                                      ₹{(lead.monthlySalary !== undefined ? lead.monthlySalary : lead.requestedAmount).toLocaleString('en-IN')}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-500">{isFinancialVertical ? 'Existing Monthly EMIs:' : 'Order Item / Special Request:'}</span>
                                    <span className="font-mono text-amber-700 font-semibold truncate max-w-[130px]" title={lead.orderItemsOrNotes || ''}>
                                      {lead.existingEmis !== undefined ? `₹${lead.existingEmis.toLocaleString('en-IN')}` : (lead.orderItemsOrNotes || 'Direct Customer Order')}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-500">{isFinancialVertical ? 'Fixed Obligation (FOIR):' : 'Delivery / Lead Intent:'}</span>
                                    <span className="font-mono font-bold text-emerald-700">
                                      {lead.monthlySalary && lead.monthlySalary > 0
                                        ? `${Math.round(((lead.existingEmis || 0) / lead.monthlySalary) * 100)}%`
                                        : 'Verified Immediate Order'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-500">{isFinancialVertical ? 'Employment Type:' : 'Consumer Type:'}</span>
                                    <span className="capitalize text-slate-800 font-medium">
                                      {lead.employmentType ? lead.employmentType.replace('_', ' ') : 'Verified App Customer'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Column 2: Contact & Location */}
                              <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                                  Direct Contact Info
                                </span>
                                <div className="space-y-1">
                                  <div className="flex justify-between">
                                    <span className="text-slate-500">Verified Mobile:</span>
                                    <a
                                      href={`tel:${lead.phone}`}
                                      className="font-mono font-bold text-blue-600 hover:underline flex items-center gap-1"
                                    >
                                      <Phone className="w-3 h-3" />
                                      <span>{lead.phone}</span>
                                    </a>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-500">Email:</span>
                                    <a
                                      href={`mailto:${lead.email}`}
                                      className="text-slate-800 hover:underline truncate max-w-[150px]"
                                    >
                                      {lead.email}
                                    </a>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-500">City / Pincode:</span>
                                    <span className="text-slate-900 font-medium">
                                      {lead.city} ({lead.pincode})
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-500">Assigned Partner:</span>
                                    <span className="font-bold text-orange-600">{lead.assignedMerchant}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Column 3: Quick Action & CRM Push */}
                              <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                                  Quick Dispatch & CRM Actions
                                </span>
                                <div className="flex flex-col gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      updateLeadStatus(lead.id, 'contacted');
                                      addToast('success', 'CRM Outbound Scheduled', `Dispatching lead to ${lead.assignedMerchant} loan servicing desk.`);
                                    }}
                                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer text-center shadow-xs"
                                  >
                                    Dial Customer (Click-to-Call)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      addToast('info', 'Webhook Fired', `Lead payload pushed to ${lead.assignedMerchant} API endpoint.`);
                                    }}
                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-colors cursor-pointer text-center border border-slate-200"
                                  >
                                    Push to Bank CRM / LMS
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Matched Partner Quotes */}
                            {lead.matchedPartners.length > 0 && (
                              <div className="space-y-2">
                                <span className="text-[11px] font-bold text-slate-700 block">
                                  Simultaneous Multi-Bank Pre-Approved Quotes ({lead.matchedPartners.length}):
                                </span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                                  {lead.matchedPartners.map((mp) => (
                                    <div
                                      key={mp.partnerId}
                                      className="p-3 bg-white rounded-xl border border-slate-200 space-y-1 shadow-2xs"
                                    >
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                          <div
                                            className={`w-6 h-6 rounded-md ${mp.logoBg} text-white font-bold text-[10px] flex items-center justify-center`}
                                          >
                                            {mp.logoText}
                                          </div>
                                          <strong className="text-slate-900 text-xs">{mp.partnerName}</strong>
                                        </div>
                                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                          {mp.approvalOdds}%
                                        </span>
                                      </div>
                                      <p className="text-[11px] text-slate-700 leading-snug line-clamp-2">
                                        {mp.offerHeadline}
                                      </p>
                                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                                        <span>Ref: {mp.leadReferenceCode}</span>
                                        <span className="text-emerald-700 font-medium">✓ {mp.processingFee}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredLeads.length === 0 && (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <User className="w-8 h-8 mx-auto text-slate-400" />
            <p className="text-sm font-semibold text-slate-800">No leads found matching criteria</p>
            <p className="text-xs text-slate-500">Try adjusting your filters or search keywords.</p>
          </div>
        )}
      </div>
    </div>
  );
};
