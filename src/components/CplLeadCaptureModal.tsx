import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Zap,
  Building2,
  CheckCircle2,
  Lock,
  ArrowRight,
  Sparkles,
  Phone,
  Mail,
  User,
  MapPin,
  Briefcase,
  IndianRupee,
  Clock,
  ExternalLink,
  ChevronRight,
  Copy,
  Check,
  AlertCircle,
  X,
  FileText,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const CplLeadCaptureModal: React.FC = () => {
  const {
    leadCaptureState,
    closeLeadCapture,
    submitCplLead,
    userLocation,
    addToast,
  } = useApp();

  const [copiedId, setCopiedId] = useState(false);

  // Form State
  const [requestedAmount, setRequestedAmount] = useState<number>(500000);
  const [monthlySalary, setMonthlySalary] = useState<number>(65000);
  const [employmentType, setEmploymentType] = useState<'salaried' | 'self_employed' | 'business'>('salaried');
  const [existingEmis, setExistingEmis] = useState<number>(10000);
  const [city, setCity] = useState<string>('New Delhi');
  const [pincode, setPincode] = useState<string>('110001');
  const [fullName, setFullName] = useState<string>('Amit Kumar');
  const [phone, setPhone] = useState<string>('9876543210');
  const [email, setEmail] = useState<string>('amit.kumar@gmail.com');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Sync default location and item price when modal opens
  useEffect(() => {
    if (leadCaptureState.isOpen) {
      if (userLocation.city) setCity(userLocation.city);
      if (userLocation.pincode) setPincode(userLocation.pincode);
      if (leadCaptureState.item?.primaryPrice) {
        // Set realistic initial loan amount
        const itemPrice = leadCaptureState.item.primaryPrice;
        if (leadCaptureState.item.vertical === 'loans') {
          setRequestedAmount(itemPrice > 100000 ? itemPrice : 500000);
        } else if (leadCaptureState.item.vertical === 'insurance') {
          setRequestedAmount(itemPrice > 500000 ? itemPrice : 10000000); // 1 Cr
        }
      }
    }
  }, [leadCaptureState.isOpen, leadCaptureState.item, userLocation]);

  if (!leadCaptureState.isOpen) return null;

  const item = leadCaptureState.item;
  const quote = leadCaptureState.quote;
  const isLoan = item?.vertical === 'loans';
  const isInsurance = item?.vertical === 'insurance';
  const step = leadCaptureState.step;
  const submittedLead = leadCaptureState.submittedLead;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim() || !email.trim()) {
      addToast('alert', 'Contact Details Required', 'Please provide your full name, mobile number, and email.');
      return;
    }

    setSubmitting(true);
    try {
      await submitCplLead({
        requestedAmount,
        monthlySalary,
        employmentType,
        existingEmis,
        city,
        pincode,
        fullName,
        phone: phone.startsWith('+91') ? phone : `+91 ${phone}`,
        email,
        serviceType: item?.title || (isLoan ? 'Personal Loan' : 'Health Insurance'),
        vertical: (item?.vertical as 'loans' | 'insurance') || 'loans',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyLeadId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
    addToast('info', 'Lead ID Copied', `${id} copied to clipboard.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden relative my-6 text-slate-900">
        {/* Top Header Strip */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-600 flex items-center justify-center font-black text-xs text-white shadow-md">
              1S
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-white">
                  Instant Partner Match & Eligibility
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30 uppercase tracking-wider">
                  Zero CIBIL Impact
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                100% Free · Direct Bank APIs · Simultaneous Multi-Bank Underwriting
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeLeadCapture}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected Partner / Offer Context Bar */}
        {item && (
          <div className="bg-slate-50 px-6 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between text-xs gap-2">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">Selected Deal:</span>
              <strong className="text-slate-900 font-bold">{item.title}</strong>
              {quote && (
                <span className="text-orange-600 font-semibold bg-orange-50 px-2 py-0.5 rounded-md border border-orange-200">
                  via {quote.sellerName}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-emerald-700 font-semibold text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Verified Direct Lender Network</span>
            </div>
          </div>
        )}

        {/* STEP 1: LEAD CAPTURE FORM */}
        {step === 'form' && (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Value Proposition Pills */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-xl bg-orange-50 border border-orange-200/80">
                <span className="font-bold text-orange-950 block text-[11px]">3-4 Partner Match</span>
                <span className="text-[10px] text-orange-700">HDFC, ICICI, SBI, Bajaj</span>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200/80">
                <span className="font-bold text-emerald-950 block text-[11px]">Pre-Approved Odds</span>
                <span className="text-[10px] text-emerald-700">Up to 98% instant pass</span>
              </div>
              <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200/80">
                <span className="font-bold text-sky-950 block text-[11px]">Zero Agent Spam</span>
                <span className="text-[10px] text-sky-700">Only verified lending desks</span>
              </div>
            </div>

            {/* Requested Amount */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold text-slate-800">
                  {isLoan ? 'Desired Loan Amount (₹)' : 'Sum Insured / Cover Amount (₹)'}
                </label>
                <span className="font-mono font-black text-sm text-orange-600">
                  ₹{requestedAmount.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={50000}
                  step={25000}
                  value={requestedAmount}
                  onChange={(e) => setRequestedAmount(Number(e.target.value))}
                  className="flex-1 px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 focus:outline-hidden focus:border-orange-500 font-bold"
                />
              </div>

              {/* Quick Select Amount Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                {(isLoan
                  ? [200000, 500000, 1000000, 2000000, 4000000]
                  : [1000000, 2500000, 5000000, 10000000]
                ).map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setRequestedAmount(amt)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                      requestedAmount === amt
                        ? 'bg-orange-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    ₹{(amt / 100000).toFixed(0)}L
                  </button>
                ))}
              </div>
            </div>

            {/* Employment Type */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800">
                Employment Type & Profession
              </label>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {[
                  { id: 'salaried', label: 'Salaried', desc: 'Govt / Private MNC' },
                  { id: 'self_employed', label: 'Self-Employed', desc: 'Doctor, CA, Consultant' },
                  { id: 'business', label: 'Business Owner', desc: 'Proprietor / Director' },
                ].map((emp) => (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => setEmploymentType(emp.id as any)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      employmentType === emp.id
                        ? 'bg-orange-50 border-orange-500 text-orange-950 ring-2 ring-orange-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="font-bold text-xs block">{emp.label}</span>
                    <span className="text-[10px] text-slate-500">{emp.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Income & Existing EMIs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-800 flex items-center justify-between">
                  <span>Monthly Net In-Hand Income *</span>
                  <span className="font-mono text-slate-600 font-bold">
                    ₹{monthlySalary.toLocaleString('en-IN')}
                  </span>
                </label>
                <input
                  type="number"
                  min={15000}
                  step={5000}
                  required
                  value={monthlySalary}
                  onChange={(e) => setMonthlySalary(Number(e.target.value))}
                  placeholder="e.g. 75000"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 focus:outline-hidden focus:border-orange-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-800 flex items-center justify-between">
                  <span>Current Existing Total EMIs</span>
                  <span className="font-mono text-slate-600 font-bold">
                    ₹{existingEmis.toLocaleString('en-IN')}
                  </span>
                </label>
                <input
                  type="number"
                  min={0}
                  step={2000}
                  value={existingEmis}
                  onChange={(e) => setExistingEmis(Number(e.target.value))}
                  placeholder="e.g. 10000"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 focus:outline-hidden focus:border-orange-500"
                />
              </div>
            </div>

            {/* Location (City & Pincode) */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-800">Current Residence City *</label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Bengaluru, Mumbai"
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-hidden focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-800">Pincode *</label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  placeholder="e.g. 560001"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 focus:outline-hidden focus:border-orange-500"
                />
              </div>
            </div>

            {/* Contact Details (Name, Verified Phone, Email) */}
            <div className="pt-2 border-t border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                  Contact & Verification Details
                </span>
                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-emerald-600" />
                  256-Bit Encrypted
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Full Legal Name *</label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="As per Aadhaar/PAN"
                      className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-hidden focus:border-orange-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 flex items-center justify-between">
                    <span>Mobile Number *</span>
                    <span className="text-[10px] text-emerald-600 font-bold">✓ Verified</span>
                  </label>
                  <div className="relative">
                    <span className="text-xs font-bold text-slate-500 absolute left-3 top-1/2 -translate-y-1/2">
                      +91
                    </span>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={phone.replace('+91', '').trim()}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                      placeholder="9876543210"
                      className="w-full pl-11 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 focus:outline-hidden focus:border-orange-500 font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Email Address *</label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@email.com"
                      className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-hidden focus:border-orange-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Legal consent note */}
            <p className="text-[10px] text-slate-500 leading-relaxed">
              By submitting, you authorize Try1Second to initiate direct eligibility matching with top partner banks (HDFC, ICICI, SBI, Bajaj Finserv) per RBI DPDP guidelines with zero impact on your CIBIL score.
            </p>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={closeLeadCapture}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 font-semibold text-xs cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-3 px-6 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-orange-950/20 flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99]"
              >
                <Zap className="w-4 h-4 text-yellow-300 fill-yellow-300" />
                <span>Match With 4 Partner Banks Now →</span>
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: PROCESSING / MULTI-BANK MATCHING RADAR */}
        {step === 'processing' && (
          <div className="p-8 sm:p-12 text-center space-y-6">
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-orange-500/20 border-t-orange-600 animate-spin" />
              <div className="absolute inset-2 rounded-full border-4 border-emerald-500/20 border-b-emerald-500 animate-spin animate-reverse" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Building2 className="w-8 h-8 text-orange-600 animate-pulse" />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-black text-slate-900">
                Running Simultaneous Multi-Bank Underwriting...
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Comparing debt-to-income ratio and policy limits across our direct institutional lending & insurance network.
              </p>
            </div>

            {/* Real-time ping progress simulation */}
            <div className="max-w-md mx-auto space-y-2.5 text-xs text-left bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="flex items-center justify-between text-slate-700">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>HDFC Bank Automated Decisioning Gateway</span>
                </span>
                <span className="font-mono text-emerald-600 font-bold">140ms · Match Found!</span>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>Bajaj Finserv Flexi-Rules Engine</span>
                </span>
                <span className="font-mono text-emerald-600 font-bold">190ms · Pre-Approved</span>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>ICICI Instant Disbursal API</span>
                </span>
                <span className="font-mono text-emerald-600 font-bold">210ms · Pre-Qualified</span>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>{isLoan ? 'SBI Prime Rate Underwriter' : 'PolicyBazaar VIP Underwriter'}</span>
                </span>
                <span className="font-mono text-emerald-600 font-bold">260ms · Approved</span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: MATCHED FINAL CONFIRMATION SCREEN */}
        {step === 'matched' && submittedLead && (
          <div className="p-6 space-y-6">
            {/* Success Banner */}
            <div className="bg-gradient-to-br from-emerald-950 via-slate-900 to-emerald-950 text-white p-5 rounded-2xl border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-emerald-900/50">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wider mb-1">
                    <Sparkles className="w-3 h-3" />
                    <span>Instant Pre-Approval Confirmed</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-white">
                    Congratulations, {submittedLead.fullName}!
                  </h3>
                  <p className="text-xs text-slate-300">
                    You have been pre-matched with {submittedLead.matchedPartners.length} top financial partners based on your profile.
                  </p>
                </div>
              </div>

              {/* Unique Reference Code Box */}
              <div className="bg-slate-900/90 border border-emerald-500/40 p-3 rounded-xl text-right shrink-0">
                <span className="text-[10px] text-slate-400 block font-semibold">Lead Reference ID</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono font-black text-sm text-emerald-400">
                    {submittedLead.id}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyLeadId(submittedLead.id)}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title="Copy Lead Reference ID"
                  >
                    {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <span className="text-[9px] text-slate-400">Estimated CIBIL: {submittedLead.creditScoreEstimate}+</span>
              </div>
            </div>

            {/* Matched Partners List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span>Top Multi-Bank Pre-Approved Offers:</span>
                <span className="text-emerald-700 font-semibold text-[11px]">
                  All quotes locked for next 48 hours
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {submittedLead.matchedPartners.map((partner) => (
                  <div
                    key={partner.partnerId}
                    className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-orange-500/40 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-12 h-12 rounded-xl ${partner.logoBg} text-white font-black text-xs flex items-center justify-center shrink-0 shadow-sm`}
                      >
                        {partner.logoText}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-900 text-sm">{partner.partnerName}</h4>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                            {partner.approvalOdds}% Match
                          </span>
                        </div>
                        <p className="text-xs text-orange-950 font-semibold mt-0.5">
                          {partner.offerHeadline}
                        </p>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                          <span className="text-emerald-700 font-medium">✓ {partner.processingFee}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {partner.disbursalTime}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2 shrink-0">
                      <span className="font-mono text-[10px] text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">
                        Ref: {partner.leadReferenceCode}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          addToast('success', `Application Initiated: ${partner.partnerName}`, `A dedicated manager from ${partner.partnerName} will call your verified number (+91 ${submittedLead.phone}) within 15 minutes.`);
                        }}
                        className="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <span>Fast-Track</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Direct Relationship Manager Callback Notice */}
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
              <Phone className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold block">15-Minute Dedicated Follow-Up Guarantee:</strong>
                <p className="text-amber-800 text-[11px] leading-relaxed mt-0.5">
                  An institutional credit manager from your highest-matched partner will reach out to your registered number ({submittedLead.phone}) to assist with zero-paperwork doorstep/digital KYC.
                </p>
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeLeadCapture}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer transition-colors shadow-sm"
              >
                Done / Back to Metasearch
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
