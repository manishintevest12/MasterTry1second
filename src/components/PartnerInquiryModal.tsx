import React, { useState } from 'react';
import { X, Building2, CheckCircle2, Send, Handshake, Zap, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Try1SecondLogo } from './Try1SecondLogo';

export const PartnerInquiryModal: React.FC = () => {
  const { isPartnerModalOpen, closePartnerModal } = useApp();
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [formData, setFormData] = useState({
    companyName: '',
    website: '',
    contactName: '',
    email: '',
    vertical: 'ecommerce',
    integrationType: 'direct_api',
    estimatedMonthlyVolume: '100k-500k',
  });

  if (!isPartnerModalOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      closePartnerModal();
    }, 3500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-600 text-white flex items-center justify-center">
              <Handshake className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Join the Try1Second Partner Network</h3>
              <p className="text-[11px] text-slate-500">Direct API Integration & Official Affiliate Program</p>
            </div>
          </div>

          <button
            type="button"
            onClick={closePartnerModal}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 text-slate-700 text-xs">
          {submitted ? (
            <div className="py-8 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
              <h4 className="text-base font-bold text-slate-900">Partnership Application Received!</h4>
              <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
                Thank you for applying. Our Merchant Integration Team will review your application for{' '}
                <strong>{formData.companyName || 'your business'}</strong> and reach out to{' '}
                <strong>{formData.email}</strong> within 1 business day with API documentation.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Company / Merchant Name</label>
                  <input
                    type="text"
                    required
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    placeholder="e.g. Cleartrip or FreshFoods"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Website URL</label>
                  <input
                    type="url"
                    required
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="https://yourbrand.com"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Contact Person Name</label>
                  <input
                    type="text"
                    required
                    value={formData.contactName}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                    placeholder="Full Name"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Work Email</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="partner@yourbrand.com"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Primary Vertical</label>
                  <select
                    value={formData.vertical}
                    onChange={(e) => setFormData({ ...formData, vertical: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-orange-500 bg-white"
                  >
                    <option value="flights">Flights & Air Travel</option>
                    <option value="hotels">Hotels & Resorts</option>
                    <option value="bus">Intercity Bus</option>
                    <option value="ecommerce">E-Commerce & Retail</option>
                    <option value="grocery">10-Minute Grocery</option>
                    <option value="food">Food Delivery</option>
                    <option value="movie">Movies & Entertainment</option>
                    <option value="loans">Loans & Banking</option>
                    <option value="insurance">Insurance</option>
                    <option value="cab">Cabs & Mobility</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Preferred Integration</label>
                  <select
                    value={formData.integrationType}
                    onChange={(e) => setFormData({ ...formData, integrationType: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-orange-500 bg-white"
                  >
                    <option value="direct_api">Direct REST API / Webhooks (Real-time)</option>
                    <option value="affiliate_network">Affiliate Network (Impact, CJ, Optimise)</option>
                    <option value="deeplink">Custom Deep Link with Order S2S Postback</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-[11px] text-slate-600">
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Try1Second Metasearch Standards:</span>
                </div>
                <p>• Zero upfront listing fee. High-intent referral traffic with direct attribution.</p>
                <p>• 1-Second low latency price ping with sub-second caching.</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closePartnerModal}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-5 py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl text-xs shadow-xs transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  Submit Partnership Request
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
