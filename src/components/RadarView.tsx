import React, { useState, useEffect } from 'react';
import {
  Radar,
  TrendingDown,
  Zap,
  ArrowRight,
  ShieldCheck,
  RotateCw,
  Clock,
  Filter,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { VerticalId } from '../types';

interface RadarDetection {
  id: string;
  vertical: VerticalId;
  title: string;
  sourceA: string;
  priceA: number;
  sourceB: string;
  priceB: number;
  delta: number;
  timestamp: string;
}

const INITIAL_RADAR_DETECTIONS: RadarDetection[] = [
  {
    id: 'rd-1',
    vertical: 'flights',
    title: 'New Delhi → Dubai Direct (SpiceJet 5111)',
    sourceA: 'Cleartrip',
    priceA: 34500,
    sourceB: 'MakeMyTrip',
    priceB: 31852,
    delta: 2648,
    timestamp: '3 seconds ago',
  },
  {
    id: 'rd-2',
    vertical: 'grocery',
    title: 'Fresh Alphonso Mangoes GI-Tagged (1kg)',
    sourceA: 'Zepto',
    priceA: 449,
    sourceB: 'Blinkit',
    priceB: 389,
    delta: 60,
    timestamp: '12 seconds ago',
  },
  {
    id: 'rd-3',
    vertical: 'cab',
    title: 'Airport T3 → Cyber City AC Sedan Transfer',
    sourceA: 'Ola Prime',
    priceA: 540,
    sourceB: 'Rapido Cabs',
    priceB: 420,
    delta: 120,
    timestamp: '28 seconds ago',
  },
  {
    id: 'rd-4',
    vertical: 'ecommerce',
    title: 'Sony WH-1000XM5 ANC Headphones',
    sourceA: 'Croma',
    priceA: 26990,
    sourceB: 'Amazon India',
    priceB: 24990,
    delta: 2000,
    timestamp: '45 seconds ago',
  },
  {
    id: 'rd-5',
    vertical: 'food',
    title: 'Gulati Butter Chicken & Naans Feast for 2',
    sourceA: 'EatSure',
    priceA: 699,
    sourceB: 'Zomato Gold',
    priceB: 580,
    delta: 119,
    timestamp: '1 min ago',
  },
];

export const RadarView: React.FC = () => {
  const { setVertical, setActiveNavTab, simulatePriceDrop } = useApp();
  const [detections, setDetections] = useState<RadarDetection[]>(INITIAL_RADAR_DETECTIONS);
  const [isScanning, setIsScanning] = useState<boolean>(true);

  // Periodic detection tick
  useEffect(() => {
    if (!isScanning) return;
    const interval = setInterval(() => {
      const verticals: VerticalId[] = ['flights', 'hotels', 'grocery', 'ecommerce', 'cab', 'food', 'movie'];
      const randomV = verticals[Math.floor(Math.random() * verticals.length)];
      const randomDelta = Math.floor(Math.random() * 800) + 50;

      const newDetection: RadarDetection = {
        id: `rd-${Date.now()}`,
        vertical: randomV,
        title: `Real-time metasearch price discrepancy in ${randomV.toUpperCase()}`,
        sourceA: 'Platform A',
        priceA: 3400 + randomDelta,
        sourceB: 'Try1Second Partner',
        priceB: 3400,
        delta: randomDelta,
        timestamp: 'Just now',
      };

      setDetections((prev) => [newDetection, ...prev.slice(0, 7)]);
    }, 9000);

    return () => clearInterval(interval);
  }, [isScanning]);

  const handleInspect = (v: VerticalId) => {
    setVertical(v);
    setActiveNavTab('compare');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 text-red-700 text-xs font-bold border border-red-200 mb-2">
            <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
            <span>150+ API PLATFORMS CONNECTED</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
            Try1Second Live Scanner Radar
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Automated crawler analyzing price spreads across all 10 verticals every 0.4 seconds.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsScanning(!isScanning)}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              isScanning
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <RotateCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Scanning Live' : 'Scanner Paused'}</span>
          </button>

          <button
            type="button"
            onClick={simulatePriceDrop}
            className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Force Pulse Scan</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Animated Radar Sweep Console (5 cols) */}
        <div className="lg:col-span-5 bg-[#090b10] border border-slate-800 rounded-2xl p-6 text-white flex flex-col items-center justify-center text-center shadow-lg relative overflow-hidden">
          <div className="w-full flex items-center justify-between text-xs text-slate-400 mb-4 pb-3 border-b border-slate-800/80">
            <span className="font-mono text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              RADAR SWEEP ACTIVE
            </span>
            <span className="font-mono text-[11px]">LATENCY: 0.4s</span>
          </div>

          {/* Radar Circles with Rotating Scanner Line */}
          <div className="relative w-64 h-64 sm:w-72 sm:h-72 my-4 rounded-full border border-emerald-500/30 flex items-center justify-center bg-radial from-emerald-950/20 via-slate-950 to-black">
            {/* Concentric rings */}
            <div className="absolute w-48 h-48 rounded-full border border-emerald-500/20" />
            <div className="absolute w-32 h-32 rounded-full border border-emerald-500/20" />
            <div className="absolute w-16 h-16 rounded-full border border-emerald-500/20" />

            {/* Crosshairs */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-full h-px bg-emerald-500/20" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-full w-px bg-emerald-500/20" />
            </div>

            {/* Rotating radar sweep ray */}
            <div className="absolute inset-0 rounded-full overflow-hidden animate-[spin_4s_linear_infinite] pointer-events-none">
              <div className="w-1/2 h-1/2 bg-gradient-to-br from-emerald-400/40 via-emerald-400/10 to-transparent origin-bottom-right" />
            </div>

            {/* Ping blips */}
            <div className="absolute top-16 left-20 w-3 h-3 bg-red-500 rounded-full animate-ping" />
            <div className="absolute bottom-20 right-16 w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping delay-300" />
            <div className="absolute top-24 right-20 w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />

            {/* Center dot */}
            <div className="w-3 h-3 bg-emerald-400 rounded-full shadow-[0_0_12px_#34d399]" />
          </div>

          <div className="mt-2 text-xs text-slate-400 font-mono">
            Scanning 10 verticals: Flight OTAs, Quick-Commerce, E-Comm, Rides
          </div>
        </div>

        {/* Live Detected Arbitrage Feed (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-emerald-600" />
              <span>Real-Time Discrepancy Stream</span>
            </h3>
            <span className="text-[11px] font-semibold text-slate-400">
              Live updates
            </span>
          </div>

          <div className="space-y-3">
            {detections.map((det) => (
              <div
                key={det.id}
                className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2 text-[11px] mb-1">
                    <span className="font-extrabold uppercase text-slate-400 tracking-wider">
                      {det.vertical}
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {det.timestamp}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-slate-900 leading-snug">
                    {det.title}
                  </h4>

                  <div className="flex items-center gap-3 text-xs mt-1.5 font-mono">
                    <span className="text-slate-400 line-through">
                      {det.sourceA}: ₹{det.priceA.toLocaleString('en-IN')}
                    </span>
                    <span className="text-emerald-700 font-bold">
                      {det.sourceB}: ₹{det.priceB.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center sm:flex-col items-end gap-2 shrink-0">
                  <span className="text-xs font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                    Save ₹{det.delta.toLocaleString('en-IN')}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleInspect(det.vertical)}
                    className="py-1 px-2.5 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <span>Compare</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
