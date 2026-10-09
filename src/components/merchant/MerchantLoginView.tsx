import React, { useState } from 'react';
import {
  Building2,
  KeyRound,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Lock,
  Sparkles,
  Copy,
  Check,
  Briefcase,
  HelpCircle,
  Utensils,
  Zap,
  ShoppingBag,
  Plane,
  Car,
  Landmark,
  Film,
  Bus,
  Layers,
  ChevronDown,
  Mail,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { VerticalId } from '../../types';
import { VERTICAL_META } from '../../data/mockData';

interface CategoryOption {
  id: VerticalId;
  name: string;
  tagline: string;
  sampleBrand: string;
  icon: React.ElementType;
}

const CATEGORY_OPTIONS: CategoryOption[] = [
  { id: 'food', name: 'Food Delivery', tagline: 'Restaurants & Dining', sampleBrand: 'Swiggy / Zomato', icon: Utensils },
  { id: 'grocery', name: '10-Min Quick Grocery', tagline: 'Dark Stores & Staples', sampleBrand: 'Blinkit / Zepto / BigBasket', icon: Zap },
  { id: 'ecommerce', name: 'E-Commerce & Gadgets', tagline: 'Retail & Electronics', sampleBrand: 'Flipkart / Amazon India', icon: ShoppingBag },
  { id: 'flights', name: 'Flights & Airlines', tagline: 'Domestic & International', sampleBrand: 'MakeMyTrip / Cleartrip', icon: Plane },
  { id: 'hotels', name: 'Hotels & Resorts', tagline: 'Stays & Luxury Suites', sampleBrand: 'Booking.com / Taj', icon: Building2 },
  { id: 'loans', name: 'Personal & Home Loans', tagline: 'Banking & Lending', sampleBrand: 'HDFC Bank / ICICI / Bajaj', icon: Landmark },
  { id: 'insurance', name: 'Life & Health Insurance', tagline: 'Comprehensive Policies', sampleBrand: 'PolicyBazaar / HDFC ERGO', icon: ShieldCheck },
  { id: 'cab', name: 'Cabs & Ride-Hailing', tagline: 'Airport & City Rides', sampleBrand: 'Uber India', icon: Car },
  { id: 'movie', name: 'Movies & Entertainment', tagline: 'Cinema & IMAX Tickets', sampleBrand: 'BookMyShow', icon: Film },
  { id: 'bus', name: 'Intercity Bus', tagline: 'AC Sleeper Routes', sampleBrand: 'redBus', icon: Bus },
];

export const MerchantLoginView: React.FC = () => {
  const {
    merchantLogin,
    vendorAccounts,
    navigateToSecretRoute,
  } = useApp();

  const [selectedCategory, setSelectedCategory] = useState<VerticalId>('food');
  const [tenDigitId, setTenDigitId] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleaned = tenDigitId.trim();
    if (!cleaned) {
      setErrorMessage('Please enter your 10-digit Vendor Access ID.');
      return;
    }

    if (!/^\d{10}$/.test(cleaned)) {
      setErrorMessage('Invalid format: Vendor ID must be exactly 10 digits (0-9). Example: 8829103847');
      return;
    }

    setIsVerifying(true);
    setTimeout(() => {
      const res = merchantLogin(cleaned, selectedCategory);
      setIsVerifying(false);
      if (!res.success) {
        setErrorMessage(res.message);
      }
    }, 400);
  };

  const handleQuickFill = (vendorId: string, vendorVertical: string) => {
    setTenDigitId(vendorId);
    setSelectedCategory(vendorVertical as VerticalId);
    setErrorMessage('');
  };

  const handleCopy = (idNum: string) => {
    navigator.clipboard.writeText(idNum);
    setCopiedId(idNum);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const activeCategoryMeta = CATEGORY_OPTIONS.find((c) => c.id === selectedCategory) || CATEGORY_OPTIONS[0];
  const CategoryIcon = activeCategoryMeta.icon;

  // Vendors registered for the currently selected category
  const categoryVendors = vendorAccounts.filter((v) => v.vertical === selectedCategory);
  // Other vendors (to demonstrate category mismatch prevention)
  const otherVendors = vendorAccounts.filter((v) => v.vertical !== selectedCategory);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Top Back to App Navigation */}
      <div className="max-w-xl w-full mx-auto mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigateToSecretRoute('/')}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer shadow-2xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Storefront</span>
        </button>

        <span className="font-mono text-[11px] text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
          www.try1second.com/merchantinstab2b
        </span>
      </div>

      <div className="max-w-xl w-full mx-auto">
        {/* Main White-Themed Card */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden p-6 sm:p-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 shadow-xs">
              <CategoryIcon className="w-7 h-7" />
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold uppercase tracking-wider mb-1.5">
                <Lock className="w-3 h-3" />
                <span>Protected Merchant Portal · Category-Locked Access</span>
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Merchant B2B Dashboard Login
              </h1>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
                Select your <strong>Merchant Category</strong> and enter the <strong>10-Digit Vendor ID</strong> issued by Admin to your email. You will only access data for your authorized vertical.
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 1. Category Selection Dropdown */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>1. Select Merchant Category / Vertical *</span>
                <span className="text-[10px] text-blue-600 font-normal">Domain Scoped</span>
              </label>

              <div className="relative">
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value as VerticalId);
                    setErrorMessage('');
                  }}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-2xl text-slate-900 font-bold text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer shadow-2xs appearance-none"
                >
                  {CATEGORY_OPTIONS.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} — ({cat.sampleBrand})
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-500">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>

              {/* Active Category Meta Tag */}
              <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-500">
                <span className="font-semibold text-slate-700">{activeCategoryMeta.tagline}:</span>
                <span className="text-blue-700 font-medium">Authorized partners include {activeCategoryMeta.sampleBrand}</span>
              </div>
            </div>

            {/* 2. 10-Digit Vendor Access Key Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>2. Unique 10-Digit Vendor Access Key *</span>
                <span className="text-[10px] text-slate-500 font-mono">Issued via Admin Email</span>
              </label>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  maxLength={10}
                  value={tenDigitId}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setTenDigitId(val);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="Enter 10-digit ID (e.g. 8829103847)"
                  className="w-full pl-10 pr-16 py-3 bg-slate-50 border border-slate-300 rounded-2xl text-slate-900 placeholder-slate-400 font-mono text-base font-bold tracking-widest focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-2xs"
                />
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-xs font-mono font-bold text-slate-400">
                  {tenDigitId.length}/10
                </div>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                Must be the unique 10-digit number generated in Admin and mapped to <strong>{activeCategoryMeta.name}</strong>.
              </span>
            </div>

            {/* Error Message Alert */}
            {errorMessage && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-xs text-rose-700 animate-in fade-in shadow-2xs">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold block text-rose-800">Authentication Failed</span>
                  <p className="leading-relaxed">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isVerifying || tenDigitId.length !== 10}
              className={`w-full py-3.5 px-4 rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer ${
                tenDigitId.length === 10 && !isVerifying
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/25 hover:scale-[1.01] active:scale-[0.99]'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
              }`}
            >
              {isVerifying ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verifying {activeCategoryMeta.name} Vendor ID...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verify Category & Enter Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Security Notice */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <Lock className="w-3 h-3 text-emerald-600" />
              <span>Strict Vertical Isolation Enabled</span>
            </span>
            <span className="font-semibold text-slate-600">Admin-Issued IDs Only</span>
          </div>
        </div>

        {/* Demo Helper: Registered 10-Digit Keys Filtered by Category */}
        <div className="mt-6 bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <h3 className="text-xs font-bold text-slate-800">
                Quick-Test Keys for: <span className="text-blue-700">{activeCategoryMeta.name}</span>
              </h3>
            </div>
            <span className="text-[10px] text-slate-500 font-semibold">
              Admin Provisioned Keys
            </span>
          </div>

          {/* Matching Vendors for Selected Category */}
          {categoryVendors.length > 0 ? (
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold text-emerald-700 block tracking-wider">
                ✓ Valid Keys for {activeCategoryMeta.name} (Click to Auto-Fill):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {categoryVendors.map((vendor) => (
                  <div
                    key={vendor.id}
                    className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50 transition-all flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <span className="font-bold text-slate-900 block text-[11px] truncate">
                        {vendor.companyName.split('(')[0].trim()}
                      </span>
                      <div className="flex items-center gap-1 font-mono text-[10px] text-emerald-800 font-bold">
                        <span>ID: {vendor.vendorIdNumber}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[9px] text-slate-500 font-mono mt-0.5">
                        <Mail className="w-2.5 h-2.5 text-blue-500 shrink-0" />
                        <span className="truncate max-w-[140px]">{vendor.contactEmail}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleQuickFill(vendor.vendorIdNumber, vendor.vertical)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] cursor-pointer shadow-2xs"
                      >
                        Fill & Match
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopy(vendor.vendorIdNumber)}
                        className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 cursor-pointer"
                        title="Copy 10-digit ID"
                      >
                        {copiedId === vendor.vendorIdNumber ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-slate-50 text-slate-500 text-xs text-center border border-slate-200">
              No sample key pre-seeded for this category. You can generate one in the Admin Dashboard!
            </div>
          )}

          {/* Test Mismatch Demonstration Box */}
          {otherVendors.length > 0 && (
            <div className="pt-2 border-t border-slate-100 space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-rose-600 block tracking-wider">
                ⚡ Test Category Mismatch Validation (Should Reject Login):
              </span>
              <p className="text-[11px] text-slate-500">
                Click a key from another vertical (e.g. Loans or Flights) while <strong>{activeCategoryMeta.name}</strong> is selected to see the error protection:
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {otherVendors.slice(0, 3).map((ov) => (
                  <button
                    key={ov.id}
                    type="button"
                    onClick={() => {
                      setTenDigitId(ov.vendorIdNumber);
                      setErrorMessage('');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-slate-600 border border-slate-200 font-mono text-[10px] cursor-pointer transition-colors"
                  >
                    Test {ov.companyName.split('(')[0].trim()} ({ov.vertical.toUpperCase()})
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2 text-[11px] text-center text-slate-500">
            <span>Admin can generate new 10-digit keys for any category in </span>
            <strong className="text-slate-800">www.try1second.com/admininsta</strong>.
          </div>
        </div>
      </div>
    </div>
  );
};
