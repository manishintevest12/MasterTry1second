import React, { useState } from 'react';
import {
  Bell,
  X,
  Check,
  TrendingDown,
  MessageSquare,
  Smartphone,
  Mail,
  Zap,
  Sparkles,
  Send,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const PriceAlertModal: React.FC = () => {
  const { priceAlertModalItem, closePriceAlertModal, setTargetAlert, addToast } = useApp();

  const currentPrice = priceAlertModalItem?.primaryPrice || 1000;
  const [targetPrice, setTargetPrice] = useState<number>(
    priceAlertModalItem?.targetPriceAlert || Math.round(currentPrice * 0.9)
  );

  // Multi-channel alert preferences
  const [whatsappEnabled, setWhatsappEnabled] = useState<boolean>(true);
  const [whatsappNumber, setWhatsappNumber] = useState<string>('+91 98765 43210');
  const [pushEnabled, setPushEnabled] = useState<boolean>(true);
  const [emailEnabled, setEmailEnabled] = useState<boolean>(true);
  const [emailAddress, setEmailAddress] = useState<string>('k.manishkumar2009@gmail.com');
  const [surgeAlertEnabled, setSurgeAlertEnabled] = useState<boolean>(true);

  // Test WhatsApp message preview modal
  const [showWhatsAppPreview, setShowWhatsAppPreview] = useState<boolean>(false);

  if (!priceAlertModalItem) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTargetAlert(priceAlertModalItem.id, targetPrice);
    addToast(
      'success',
      'Price Alert & WhatsApp Dispatcher Active',
      `We will notify you via ${whatsappEnabled ? 'WhatsApp, ' : ''}${pushEnabled ? 'Push, ' : ''}and Email when ${priceAlertModalItem.title} drops below ₹${targetPrice.toLocaleString('en-IN')}.`
    );
    closePriceAlertModal();
  };

  const discountPercent = Math.max(
    1,
    Math.round(((currentPrice - targetPrice) / currentPrice) * 100)
  );

  const handleTestWhatsAppDispatch = () => {
    setShowWhatsAppPreview(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative overflow-hidden max-h-[92vh] flex flex-col">
        {/* Close Button */}
        <button
          type="button"
          onClick={closePriceAlertModal}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-2.5 mb-1 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 leading-snug">
              Instant Price-Drop Alert Engine
            </h3>
            <span className="text-[11px] text-slate-500">
              Multi-channel delivery via WhatsApp Business API, Web Push & Email
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-600 mb-4 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 shrink-0 truncate">
          Tracking: <strong className="text-slate-900 font-bold">{priceAlertModalItem.title}</strong>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs overflow-y-auto flex-1 pr-1">
          {/* Current vs Target Price Bar */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-slate-400 text-[10px] font-bold uppercase block">Current Lowest Price</span>
              <strong className="text-lg font-black font-mono text-slate-900">
                ₹{currentPrice.toLocaleString('en-IN')}
              </strong>
            </div>
            <div className="text-right">
              <span className="text-slate-400 text-[10px] font-bold uppercase block">Alert Target Threshold</span>
              <strong className="text-lg font-black font-mono text-red-600">
                ₹{targetPrice.toLocaleString('en-IN')}
              </strong>
            </div>
          </div>

          {/* Interactive Target Price Setter */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
              <label>Alert Trigger Discount: {discountPercent}% OFF</label>
              <span className="text-emerald-600 font-mono">Save ₹{(currentPrice - targetPrice).toLocaleString('en-IN')}</span>
            </div>
            <input
              type="range"
              min={Math.round(currentPrice * 0.4)}
              max={currentPrice - 1}
              step={10}
              value={targetPrice}
              onChange={(e) => setTargetPrice(Number(e.target.value))}
              className="w-full accent-red-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-medium">
              <span>-60% Flash Sale Cut</span>
              <span>-10% Subtle Dip</span>
            </div>
          </div>

          {/* Multi-Channel Notification Dispatcher Toggles */}
          <div className="space-y-2.5 pt-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 block">
              Multi-Channel Dispatcher Channels
            </span>

            {/* 1. WhatsApp Channel */}
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-900 text-xs">
                  <input
                    type="checkbox"
                    checked={whatsappEnabled}
                    onChange={(e) => setWhatsappEnabled(e.target.checked)}
                    className="w-4 h-4 rounded-sm text-emerald-600 accent-emerald-600 cursor-pointer"
                  />
                  <div className="flex items-center gap-1.5 text-emerald-800">
                    <MessageSquare className="w-4 h-4 text-emerald-600" />
                    <span>WhatsApp Business API Instant Alerts</span>
                  </div>
                </label>

                <button
                  type="button"
                  onClick={handleTestWhatsAppDispatch}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] rounded-lg cursor-pointer transition-colors"
                >
                  Test WhatsApp Message
                </button>
              </div>

              {whatsappEnabled && (
                <div className="flex items-center gap-2 pl-6">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <input
                    type="text"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-2.5 py-1 bg-white border border-emerald-300 rounded-lg text-slate-900 font-mono text-xs focus:outline-hidden"
                  />
                </div>
              )}
            </div>

            {/* 2. Web Push Notifications */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800 text-xs">
                <input
                  type="checkbox"
                  checked={pushEnabled}
                  onChange={(e) => setPushEnabled(e.target.checked)}
                  className="w-4 h-4 rounded-sm text-red-600 accent-red-600 cursor-pointer"
                />
                <div className="flex items-center gap-1.5">
                  <Bell className="w-4 h-4 text-blue-600" />
                  <span>Browser Web Push Notifications</span>
                </div>
              </label>
              <span className="text-[10px] text-slate-400 font-medium">Sub-second push</span>
            </div>

            {/* 3. Email Alerts */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800 text-xs">
                <input
                  type="checkbox"
                  checked={emailEnabled}
                  onChange={(e) => setEmailEnabled(e.target.checked)}
                  className="w-4 h-4 rounded-sm text-red-600 accent-red-600 cursor-pointer"
                />
                <div className="flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-purple-600" />
                  <span>Email Summary Triggers</span>
                </div>
              </label>

              {emailEnabled && (
                <div className="flex items-center gap-2 pl-6">
                  <input
                    type="email"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-900 font-mono text-xs focus:outline-hidden"
                  />
                </div>
              )}
            </div>

            {/* 4. AI Surge & Deal Prediction Alert */}
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-2xl flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-amber-900 text-xs">
                <input
                  type="checkbox"
                  checked={surgeAlertEnabled}
                  onChange={(e) => setSurgeAlertEnabled(e.target.checked)}
                  className="w-4 h-4 rounded-sm text-amber-600 accent-amber-600 cursor-pointer"
                />
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>AI Surge & Flash Sale Prediction Alert</span>
                </div>
              </label>
              <span className="text-[10px] text-amber-700 font-bold bg-amber-100 px-2 py-0.5 rounded-md">
                24h Early Warning
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={closePriceAlertModal}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white rounded-xl font-extrabold shadow-md shadow-red-600/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Bell className="w-4 h-4 fill-white" />
              <span>Activate Multi-Channel Alert</span>
            </button>
          </div>
        </form>

        {/* WhatsApp Notification Message Preview Popup */}
        {showWhatsAppPreview && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
            <div className="bg-[#0b141a] text-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-emerald-900/60 space-y-4 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                  <MessageSquare className="w-4 h-4" />
                  <span>WhatsApp Business API Verified</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWhatsAppPreview(false)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Chat Bubble Mockup */}
              <div className="p-3.5 bg-[#202c33] rounded-2xl rounded-tl-xs space-y-2 text-xs border border-slate-700/50">
                <div className="flex items-center gap-1.5 text-emerald-400 font-extrabold text-[11px]">
                  <Zap className="w-3.5 h-3.5 fill-emerald-400" />
                  <span>Try1Second Price Drop Alert!</span>
                </div>
                <p className="text-slate-200 leading-relaxed text-[11px]">
                  🔥 Great news! <strong>{priceAlertModalItem.title}</strong> has dropped below your target of ₹{targetPrice.toLocaleString('en-IN')}.
                </p>
                <div className="p-2 bg-slate-900/80 rounded-xl font-mono text-[11px] text-emerald-300">
                  New Lowest Price: ₹{targetPrice.toLocaleString('en-IN')} (Saved ₹{(currentPrice - targetPrice).toLocaleString('en-IN')})
                </div>
                <p className="text-slate-400 text-[10px]">
                  Direct zero-markup checkout link: try1second.com/deal/{priceAlertModalItem.id}
                </p>
                <span className="text-[9px] text-slate-400 block text-right">Just now · Sent via Try1Second Bot</span>
              </div>

              <button
                type="button"
                onClick={() => setShowWhatsAppPreview(false)}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white rounded-xl cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
