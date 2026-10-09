import React, { useState } from 'react';
import {
  KeyRound,
  Building2,
  Plus,
  Search,
  Copy,
  Check,
  Edit2,
  Trash2,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  Users,
  CheckCircle2,
  XCircle,
  RotateCw,
  Sparkles,
  DollarSign,
  Mail,
  Phone,
  FileText,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { MerchantVendorAccount } from '../../types';

export const MerchantVendorIdsTab: React.FC = () => {
  const {
    vendorAccounts,
    createVendorAccount,
    updateVendorAccount,
    deleteVendorAccount,
    generateUniqueTenDigitId,
    sendVendorIdEmail,
    addToast,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'suspended'>('all');
  const [filterVertical, setFilterVertical] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingVendor, setEditingVendor] = useState<MerchantVendorAccount | null>(null);

  // Email Dispatch Modal State
  const [isEmailModalOpen, setIsEmailModalOpen] = useState<boolean>(false);
  const [emailingVendor, setEmailingVendor] = useState<MerchantVendorAccount | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);
  const [autoEmailOnRegister, setAutoEmailOnRegister] = useState<boolean>(true);

  // Form State
  const [formState, setFormState] = useState({
    vendorIdNumber: '',
    companyName: '',
    brandId: '',
    contactPerson: '',
    contactEmail: '',
    contactPhone: '',
    vertical: 'food',
    status: 'active' as 'active' | 'suspended',
    prepaidCredits: 100000,
    notes: '',
  });

  const handleOpenAdd = () => {
    const newId = generateUniqueTenDigitId();
    setEditingVendor(null);
    setFormState({
      vendorIdNumber: newId,
      companyName: '',
      brandId: 'swiggy',
      contactPerson: '',
      contactEmail: '',
      contactPhone: '+91 ',
      vertical: 'food',
      status: 'active',
      prepaidCredits: 150000,
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (vendor: MerchantVendorAccount) => {
    setEditingVendor(vendor);
    setFormState({
      vendorIdNumber: vendor.vendorIdNumber,
      companyName: vendor.companyName,
      brandId: vendor.brandId,
      contactPerson: vendor.contactPerson,
      contactEmail: vendor.contactEmail,
      contactPhone: vendor.contactPhone,
      vertical: vendor.vertical,
      status: vendor.status,
      prepaidCredits: vendor.prepaidCredits,
      notes: vendor.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleRegenerateId = () => {
    const newId = generateUniqueTenDigitId();
    setFormState((prev) => ({ ...prev, vendorIdNumber: newId }));
    addToast('info', 'New ID Generated', `Assigned new unique 10-digit key: ${newId}`);
  };

  const handleOpenEmailModal = (vendor: MerchantVendorAccount) => {
    setEmailingVendor(vendor);
    setIsEmailModalOpen(true);
  };

  const handleConfirmSendEmail = () => {
    if (!emailingVendor) return;
    setIsSendingEmail(true);
    setTimeout(() => {
      sendVendorIdEmail(emailingVendor.id);
      setIsSendingEmail(false);
      setIsEmailModalOpen(false);
    }, 600);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!/^\d{10}$/.test(formState.vendorIdNumber)) {
      addToast('alert', 'Invalid Vendor ID', 'Vendor ID must be an exact 10-digit number.');
      return;
    }

    if (editingVendor) {
      updateVendorAccount(editingVendor.id, formState);
    } else {
      const created = createVendorAccount(formState);
      if (autoEmailOnRegister && formState.contactEmail) {
        setTimeout(() => {
          sendVendorIdEmail(created.id);
        }, 400);
      }
    }
    setIsModalOpen(false);
  };

  const handleCopyCredentials = (vendor: MerchantVendorAccount) => {
    const textToCopy = `Try1Second Merchant Portal Access:\nPortal URL: www.myindustryhouse.com/merchantinstab2b\nCompany: ${vendor.companyName}\nCategory: ${vendor.vertical.toUpperCase()}\nYour Unique 10-Digit Vendor ID: ${vendor.vendorIdNumber}\nStatus: ${vendor.status.toUpperCase()}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(vendor.vendorIdNumber);
    setTimeout(() => setCopiedId(null), 2500);
    addToast('success', 'Credentials Copied', `Copied login invite for ${vendor.companyName} to clipboard.`);
  };

  const filteredVendors = vendorAccounts.filter((v) => {
    const matchesSearch =
      v.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.vendorIdNumber.includes(searchQuery) ||
      v.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.contactEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.vertical.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || v.status === filterStatus;
    const matchesVertical = filterVertical === 'all' || v.vertical === filterVertical;
    return matchesSearch && matchesStatus && matchesVertical;
  });

  const activeCount = vendorAccounts.filter((v) => v.status === 'active').length;
  const emailsSentCount = vendorAccounts.filter((v) => Boolean(v.lastEmailSentAt)).length;
  const totalCredits = vendorAccounts.reduce((sum, v) => sum + (v.prepaidCredits || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header & Metrics */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold uppercase tracking-wider mb-2">
              <KeyRound className="w-3.5 h-3.5 text-blue-600" />
              <span>Merchant B2B Authentication & Access Security</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>Merchant 10-Digit Vendor Access Management</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Every B2B partner must be provisioned with a unique 10-digit Vendor Access ID by Admin to log in at <strong className="text-slate-800">www.myindustryhouse.com/merchantinstab2b</strong>.
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 flex items-center gap-2 cursor-pointer transition-all hover:scale-105 active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Generate & Register Vendor</span>
          </button>
        </div>

        {/* KPI Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <span className="text-[11px] text-slate-500 font-medium block">Total Registered Vendors</span>
            <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
              {vendorAccounts.length}
            </span>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <span className="text-[11px] text-slate-500 font-medium block">Active Vendor Keys</span>
            <span className="text-2xl font-black text-emerald-600 font-mono mt-1 block">
              {activeCount}
            </span>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <span className="text-[11px] text-slate-500 font-medium block">Prepaid Credits Held</span>
            <span className="text-2xl font-black text-blue-600 font-mono mt-1 block">
              ₹{totalCredits.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <span className="text-[11px] text-slate-500 font-medium block">Portal Gateway URL</span>
            <span className="text-xs font-mono font-bold text-slate-800 mt-2 block truncate">
              /merchantinstab2b
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Vendor ID (10-digits), company name, contact..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-hidden cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="suspended">Suspended</option>
          </select>

          <select
            value={filterVertical}
            onChange={(e) => setFilterVertical(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-hidden cursor-pointer"
          >
            <option value="all">All Verticals (10 Categories)</option>
            <option value="food">Food Delivery (Swiggy / Zomato)</option>
            <option value="grocery">10-Min Grocery (Blinkit / Zepto / BigBasket)</option>
            <option value="ecommerce">E-Commerce & Gadgets (Flipkart / Amazon)</option>
            <option value="flights">Flights & Travel (MakeMyTrip / Cleartrip)</option>
            <option value="hotels">Hotels & Stays (Booking.com / Taj)</option>
            <option value="loans">Loans & Banking (HDFC / Bajaj / ICICI)</option>
            <option value="insurance">Insurance & Health (PolicyBazaar / Tata AIG)</option>
            <option value="cab">Cabs & Rides (Uber India)</option>
            <option value="movie">Movies & Cinema (BookMyShow)</option>
            <option value="bus">Intercity Bus (redBus)</option>
          </select>
        </div>
      </div>

      {/* Table of Vendors */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
              <tr>
                <th className="py-3 px-4">Unique 10-Digit Vendor ID</th>
                <th className="py-3 px-4">Company & Assigned Brand</th>
                <th className="py-3 px-4">Authorized Contact & Email</th>
                <th className="py-3 px-4">Designated Category</th>
                <th className="py-3 px-4">Email Dispatch</th>
                <th className="py-3 px-4">Prepaid Credits</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVendors.map((vendor) => (
                <tr key={vendor.id} className="hover:bg-slate-50/80 transition-colors">
                  {/* 10-Digit ID */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-sm text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 tracking-wider">
                        {vendor.vendorIdNumber}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyCredentials(vendor)}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Copy Login Credentials"
                      >
                        {copiedId === vendor.vendorIdNumber ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
                      Last Login: {vendor.lastLoginAt || 'Never'}
                    </span>
                  </td>

                  {/* Company */}
                  <td className="py-3.5 px-4">
                    <span className="font-bold text-slate-900 block text-xs">
                      {vendor.companyName}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Brand: {vendor.brandId}
                    </span>
                  </td>

                  {/* Contact */}
                  <td className="py-3.5 px-4 text-[11px]">
                    <div className="font-semibold text-slate-800">{vendor.contactPerson}</div>
                    <div className="text-blue-600 font-mono flex items-center gap-1">
                      <Mail className="w-3 h-3 text-blue-400 shrink-0" />
                      <span className="truncate max-w-[150px]">{vendor.contactEmail}</span>
                    </div>
                    <div className="text-slate-400 font-mono">{vendor.contactPhone}</div>
                  </td>

                  {/* Vertical / Category */}
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded-md font-bold uppercase text-[10px] bg-blue-50 text-blue-700 border border-blue-200">
                      {vendor.vertical}
                    </span>
                  </td>

                  {/* Email Dispatch Status */}
                  <td className="py-3.5 px-4">
                    {vendor.lastEmailSentAt ? (
                      <div className="space-y-0.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                          <span>Sent via Mail</span>
                        </span>
                        <span className="block text-[9px] text-slate-400 font-mono truncate max-w-[120px]">
                          {vendor.lastEmailSentAt}
                        </span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenEmailModal(vendor)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 cursor-pointer transition-colors"
                      >
                        <Mail className="w-2.5 h-2.5" />
                        <span>Send to Email</span>
                      </button>
                    )}
                  </td>

                  {/* Prepaid Credits */}
                  <td className="py-3.5 px-4 font-mono font-bold text-emerald-600">
                    ₹{vendor.prepaidCredits.toLocaleString('en-IN')}
                  </td>

                  {/* Status */}
                  <td className="py-3.5 px-4">
                    <button
                      type="button"
                      onClick={() =>
                        updateVendorAccount(vendor.id, {
                          status: vendor.status === 'active' ? 'suspended' : 'active',
                        })
                      }
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold cursor-pointer transition-all ${
                        vendor.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                      title="Click to toggle status"
                    >
                      {vendor.status === 'active' ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Active</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Suspended</span>
                        </>
                      )}
                    </button>
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Send / Resend Email Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenEmailModal(vendor)}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold text-[11px] cursor-pointer flex items-center gap-1 border border-emerald-200"
                        title="Send 10-Digit ID to Merchant Official Email"
                      >
                        <Mail className="w-3 h-3 text-emerald-600" />
                        <span>{vendor.lastEmailSentAt ? 'Resend' : 'Send ID'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopyCredentials(vendor)}
                        className="px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold text-[11px] cursor-pointer flex items-center gap-1 border border-blue-200"
                        title="Copy 1-click invitation text"
                      >
                        <Copy className="w-3 h-3" />
                        <span className="hidden sm:inline">Copy</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenEdit(vendor)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Edit Vendor"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Revoke 10-digit ID for ${vendor.companyName}?`)) {
                            deleteVendorAccount(vendor.id);
                          }
                        }}
                        className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Delete Vendor"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT VENDOR MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-lg p-6 space-y-5 shadow-2xl text-slate-900 animate-in fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingVendor ? 'Edit Vendor Access Account' : 'Provision New 10-Digit Vendor ID'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Generate credentials mapped strictly to a single category for /merchantinstab2b
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
              {/* 10-Digit ID Field with Regenerate Button */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Unique 10-Digit Vendor ID *
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    maxLength={10}
                    value={formState.vendorIdNumber}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        vendorIdNumber: e.target.value.replace(/\D/g, '').slice(0, 10),
                      })
                    }
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono text-sm font-bold tracking-widest focus:outline-hidden focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleRegenerateId}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold flex items-center gap-1.5 cursor-pointer border border-slate-200"
                    title="Generate another 10-digit random number"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-blue-600" />
                    <span>Generate</span>
                  </button>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Must be exactly 10 digits. System ensures uniqueness across all categories.
                </span>
              </div>

              {/* Company Name & Brand ID */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Company / Partner Name *</label>
                  <input
                    type="text"
                    required
                    value={formState.companyName}
                    onChange={(e) => setFormState({ ...formState, companyName: e.target.value })}
                    placeholder="e.g. Swiggy Restaurant Network"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Brand Slug / ID *</label>
                  <input
                    type="text"
                    required
                    value={formState.brandId}
                    onChange={(e) => setFormState({ ...formState, brandId: e.target.value.toLowerCase().trim() })}
                    placeholder="e.g. swiggy or zomato"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono"
                  />
                </div>
              </div>

              {/* Contact Details */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Contact Person Name</label>
                  <input
                    type="text"
                    value={formState.contactPerson}
                    onChange={(e) => setFormState({ ...formState, contactPerson: e.target.value })}
                    placeholder="e.g. Karan Malhotra"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Official Merchant Email *</label>
                  <input
                    type="email"
                    required
                    value={formState.contactEmail}
                    onChange={(e) => setFormState({ ...formState, contactEmail: e.target.value })}
                    placeholder="partner@company.com"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900"
                  />
                </div>
              </div>

              {/* Vertical & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Designated Category / Vertical *</label>
                  <select
                    value={formState.vertical}
                    onChange={(e) => setFormState({ ...formState, vertical: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 cursor-pointer font-bold"
                  >
                    <option value="food">Food Delivery (Swiggy / Zomato)</option>
                    <option value="grocery">10-Min Grocery (Blinkit / Zepto / BigBasket)</option>
                    <option value="ecommerce">E-Commerce & Gadgets (Flipkart / Amazon)</option>
                    <option value="flights">Flights & Travel (MakeMyTrip / Cleartrip)</option>
                    <option value="hotels">Hotels & Stays (Booking.com / Taj)</option>
                    <option value="loans">Loans & Mortgages (HDFC / Bajaj / ICICI)</option>
                    <option value="insurance">Insurance & Protection (PolicyBazaar / Tata AIG)</option>
                    <option value="cab">Cabs & Ride Hailing (Uber India)</option>
                    <option value="movie">Movies & Cinema (BookMyShow)</option>
                    <option value="bus">Intercity Bus (redBus)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Account Status</label>
                  <select
                    value={formState.status}
                    onChange={(e) => setFormState({ ...formState, status: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 cursor-pointer"
                  >
                    <option value="active">Active (Permit Login)</option>
                    <option value="suspended">Suspended (Block Login)</option>
                  </select>
                </div>
              </div>

              {/* Prepaid Credits */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">Initial Prepaid Lead Wallet (₹)</label>
                <input
                  type="number"
                  value={formState.prepaidCredits}
                  onChange={(e) => setFormState({ ...formState, prepaidCredits: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono"
                />
              </div>

              {/* Auto Email Toggle */}
              {!editingVendor && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-blue-600 shrink-0" />
                    <div>
                      <span className="font-bold text-slate-900 block">Dispatch ID via Email Automatically</span>
                      <span className="text-[10px] text-slate-500">
                        Sends the 10-digit key and category instructions to {formState.contactEmail || 'partner email'}
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoEmailOnRegister}
                    onChange={(e) => setAutoEmailOnRegister(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold cursor-pointer shadow-md"
                >
                  {editingVendor ? 'Save Changes' : 'Register Vendor ID'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EMAIL 10-DIGIT VENDOR ID ================= */}
      {isEmailModalOpen && emailingVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-lg p-6 space-y-5 shadow-2xl text-slate-900 animate-in fade-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Dispatch 10-Digit ID to Merchant Email
                  </h3>
                  <p className="text-xs text-slate-500">
                    Official B2B Login Credentials Dispatch
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsEmailModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Email Meta Info */}
            <div className="space-y-3 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">From:</span>
                <span className="font-mono text-slate-700">Try1Second B2B Admin &lt;b2b@try1second.com&gt;</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">To:</span>
                <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                  {emailingVendor.contactEmail}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Merchant:</span>
                <span className="font-bold text-slate-800">{emailingVendor.companyName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Authorized Category:</span>
                <span className="font-bold uppercase text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {emailingVendor.vertical}
                </span>
              </div>
            </div>

            {/* Simulated Email Body Preview */}
            <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3 text-xs shadow-2xs font-sans">
              <div className="text-slate-700 font-semibold border-b border-slate-100 pb-2">
                Subject: <span className="font-bold text-slate-900">Your Official 10-Digit Vendor ID & Login Access [{emailingVendor.vertical.toUpperCase()}]</span>
              </div>

              <p className="text-slate-600 leading-relaxed">
                Dear {emailingVendor.contactPerson || emailingVendor.companyName},
              </p>

              <p className="text-slate-600 leading-relaxed">
                Your Try1Second B2B Merchant Portal access has been provisioned for the <strong>{emailingVendor.vertical.toUpperCase()}</strong> category.
              </p>

              {/* Credential Box in Email */}
              <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2 text-center">
                <span className="text-[10px] text-blue-700 uppercase font-bold tracking-wider block">
                  Your Unique 10-Digit Vendor Access Key:
                </span>
                <div className="font-mono text-2xl font-black text-blue-700 tracking-widest">
                  {emailingVendor.vendorIdNumber}
                </div>
                <div className="text-[11px] text-slate-600">
                  Portal URL: <strong className="text-slate-900 font-mono">www.myindustryhouse.com/merchantinstab2b</strong>
                </div>
              </div>

              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 space-y-1">
                <strong className="block">Category-Locked Login Rule:</strong>
                <p>
                  During login, you must select Category: <strong>{emailingVendor.vertical.toUpperCase()}</strong> and enter this 10-digit ID. You will strictly receive intelligence and leads for {emailingVendor.vertical.toUpperCase()} only.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsEmailModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSendingEmail}
                onClick={handleConfirmSendEmail}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer shadow-md flex items-center gap-2 text-xs transition-all hover:scale-105 active:scale-95"
              >
                {isSendingEmail ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Dispatching Email...</span>
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    <span>Send ID to {emailingVendor.contactEmail}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
