import React, { useState } from 'react';
import {
  MapPin,
  Crosshair,
  X,
  Search,
  Check,
  Building2,
  Navigation,
  Clock,
  Zap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PINCODE_DATABASE } from '../utils/locationHelper';

interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  contextMode?: 'food' | 'grocery' | 'cab';
}

export const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  isOpen,
  onClose,
  title = 'Select Delivery / Pickup Location',
  contextMode = 'food',
}) => {
  const {
    userLocation,
    detectGpsLocation,
    setPincodeLocation,
    isGpsLocating,
  } = useApp();

  const [inputPincode, setInputPincode] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  if (!isOpen) return null;

  const handleApplyPincode = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputPincode.trim();
    if (!/^\d{6}$/.test(clean)) {
      setErrorMsg('Please enter a valid 6-digit Indian postal pincode (e.g. 110001, 560038)');
      return;
    }
    setErrorMsg('');
    setPincodeLocation(clean);
    onClose();
  };

  const handleSelectPredefined = (pincode: string) => {
    setPincodeLocation(pincode);
    onClose();
  };

  const handleGpsClick = async () => {
    await detectGpsLocation();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-2 mb-1">
          <MapPin className="w-5 h-5 text-red-600" />
          <h3 className="text-base font-bold text-slate-900">
            {title}
          </h3>
        </div>
        <p className="text-xs text-slate-500 mb-5">
          Choose exact GPS location or enter a 6-digit pincode to get hyper-local pricing, live dark-store inventory & accurate delivery ETAs.
        </p>

        {/* Action 1: Use Current Location (GPS) */}
        <div className="mb-5">
          <button
            type="button"
            disabled={isGpsLocating}
            onClick={handleGpsClick}
            className="w-full p-3.5 bg-red-50 hover:bg-red-100/80 active:bg-red-200/80 border border-red-200 rounded-xl text-left transition-all flex items-center justify-between cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                <Crosshair className={`w-5 h-5 ${isGpsLocating ? 'animate-spin' : ''}`} />
              </div>
              <div>
                <span className="text-xs font-black text-red-900 block flex items-center gap-1.5">
                  <span>Use Exact Current Location (GPS)</span>
                  {userLocation.isGps && (
                    <span className="text-[10px] bg-emerald-600 text-white font-bold px-1.5 py-0.2 rounded-full">
                      Active
                    </span>
                  )}
                </span>
                <span className="text-[11px] text-red-700/80 block mt-0.5">
                  {isGpsLocating
                    ? 'Locking satellite GPS coordinates...'
                    : 'Auto-detect doorstep coordinates via browser GPS'}
                </span>
              </div>
            </div>

            <Navigation className="w-4 h-4 text-red-600 shrink-0" />
          </button>
        </div>

        {/* Action 2: Enter 6-Digit Pincode Form */}
        <div className="mb-6">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
            Or Enter 6-Digit Area Pincode
          </span>

          <form onSubmit={handleApplyPincode} className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                maxLength={6}
                value={inputPincode}
                onChange={(e) => {
                  setInputPincode(e.target.value.replace(/\D/g, ''));
                  setErrorMsg('');
                }}
                placeholder="e.g. 110001, 560038, 400050"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:border-red-500 focus:outline-hidden"
              />
              {inputPincode && (
                <button
                  type="button"
                  onClick={() => setInputPincode('')}
                  className="absolute right-2.5 top-3 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
            >
              Apply Pincode
            </button>
          </form>

          {errorMsg && (
            <p className="text-[11px] text-rose-600 font-semibold mt-1.5">{errorMsg}</p>
          )}
        </div>

        {/* Action 3: Popular Delivery Hubs / Pincodes */}
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
            Popular Metro Delivery Hubs
          </span>

          <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
            {Object.values(PINCODE_DATABASE).map((entry) => {
              const isSelected = userLocation.pincode === entry.pincode;
              return (
                <button
                  key={entry.pincode}
                  type="button"
                  onClick={() => handleSelectPredefined(entry.pincode)}
                  className={`w-full p-2.5 rounded-xl border text-left transition-colors flex items-center justify-between cursor-pointer text-xs ${
                    isSelected
                      ? 'bg-red-50 border-red-200 text-red-950 font-bold'
                      : 'bg-slate-50/60 border-slate-100 hover:bg-slate-100 text-slate-800'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-1.5 font-bold">
                      <span>{entry.locality}</span>
                      <span className="text-[11px] font-mono text-slate-500">
                        ({entry.pincode})
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 block">
                      {entry.city} · Darkstore: {entry.nearestDarkStores.blinkit.split(' ')[0]}
                    </span>
                  </div>

                  {isSelected && (
                    <Check className="w-4 h-4 text-red-600 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
