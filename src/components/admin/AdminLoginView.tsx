import React, { useState } from 'react';
import {
  ShieldCheck,
  Mail,
  Lock,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  KeyRound,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const AdminLoginView: React.FC = () => {
  const { adminOtpRequest, adminOtpVerify, navigateToSecretRoute } = useApp();

  const [email, setEmail] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [step, setStep] = useState<'email' | 'code'>('email');

  // Step 1: ask the backend to email a one-time code (sent via Resend).
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setStatusMessage('');
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMessage('Enter the administrator email address.');
      return;
    }
    setIsAuthenticating(true);
    const res = await adminOtpRequest(cleanEmail);
    setIsAuthenticating(false);
    if (!res.success) {
      setErrorMessage(res.message);
      return;
    }
    setStatusMessage(res.message);
    setStep('code');
  };

  // Step 2: verify the code and open the admin session.
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    const cleanEmail = email.trim().toLowerCase();
    if (!/^\d{6}$/.test(code.trim())) {
      setErrorMessage('Enter the 6-digit code from your email.');
      return;
    }
    setIsAuthenticating(true);
    const res = await adminOtpVerify(cleanEmail, code.trim());
    setIsAuthenticating(false);
    if (!res.success) {
      setErrorMessage(res.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Top Bar */}
      <div className="max-w-md w-full mx-auto mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigateToSecretRoute('/')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer shadow-2xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Storefront</span>
        </button>

        <span className="font-mono text-[11px] text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
          www.try1second.com/admininsta
        </span>
      </div>

      <div className="max-w-md w-full mx-auto">
        {/* Main Card (White Theme) */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden p-6 sm:p-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-orange-50 border border-orange-100 text-orange-600 shadow-xs">
              <ShieldCheck className="w-7 h-7" />
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-[10px] font-bold uppercase tracking-wider mb-1.5">
                <Lock className="w-3 h-3" />
                <span>Super Administrator Portal</span>
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Try1Second Admin Center
              </h1>
              <p className="text-xs text-slate-600 mt-1 max-w-xs mx-auto leading-relaxed">
                Admin access uses email one-time codes. Login is restricted to the configured admin account.
              </p>
            </div>
          </div>

          {/* OTP status message */}
          {statusMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-700 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span className="leading-snug">{statusMessage}</span>
            </div>
          )}

          {/* Form: step 1 (email) or step 2 (one-time code) */}
          <form onSubmit={step === 'email' ? handleSendCode : handleVerifyCode} className="space-y-4">
            {step === 'email' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Administrator Email *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-600">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errorMessage) setErrorMessage('');
                    }}
                    placeholder="your admin email"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-2xl text-slate-900 font-medium text-sm focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all shadow-2xs"
                  />
                </div>
                <span className="text-[10px] text-slate-600 mt-1 block">
                  A one-time login code will be emailed to the admin address.
                </span>
              </div>
            )}

            {step === 'code' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  One-Time Code (sent to {email}) *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-600">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    required
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value.replace(/\D/g, ''));
                      if (errorMessage) setErrorMessage('');
                    }}
                    placeholder="6-digit code"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-2xl text-slate-900 font-mono text-lg tracking-[0.5em] focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all shadow-2xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => { setStep('email'); setCode(''); setStatusMessage(''); setErrorMessage(''); }}
                  className="text-[10px] font-bold text-slate-500 hover:text-slate-700 mt-1.5 cursor-pointer underline underline-offset-2"
                >
                  Use a different email
                </button>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-xs text-rose-700 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span className="leading-snug">{errorMessage}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isAuthenticating}
              className="w-full py-3.5 px-4 rounded-2xl text-xs font-bold uppercase tracking-wider bg-orange-600 hover:bg-orange-500 text-white shadow-md shadow-orange-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
            >
              {isAuthenticating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{step === 'email' ? 'Sending Login Code...' : 'Verifying Code...'}</span>
                </>
              ) : step === 'email' ? (
                <>
                  <Mail className="w-4 h-4" />
                  <span>Email Me a Login Code</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verify & Enter Admin Center</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Security Notice */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
            <span className="flex items-center gap-1">
              <Lock className="w-3 h-3 text-emerald-600" />
              <span>Zero Trust Admin Environment</span>
            </span>
            <span className="font-semibold text-slate-600">Confidential</span>
          </div>
        </div>
      </div>
    </div>
  );
};
