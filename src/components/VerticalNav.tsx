import React from 'react';
import {
  Home,
  Plane,
  Building2,
  Bus,
  ShoppingBag,
  Zap,
  Utensils,
  Film,
  Landmark,
  ShieldCheck,
  Car,
} from 'lucide-react';
import { VerticalId } from '../types';
import { useApp } from '../context/AppContext';

interface VerticalTabItem {
  id: VerticalId;
  name: string;
  icon: React.ElementType;
  tagline: string;
}

const VERTICALS: VerticalTabItem[] = [
  { id: 'flights', name: 'Flights', icon: Plane, tagline: 'Airline & OTA Matrix' },
  { id: 'hotels', name: 'Hotels', icon: Building2, tagline: 'Suites & Resorts' },
  { id: 'bus', name: 'Bus', icon: Bus, tagline: 'AC Sleeper Routes' },
  { id: 'ecommerce', name: 'E-Commerce', icon: ShoppingBag, tagline: 'Gadgets & Tech' },
  { id: 'grocery', name: '10-Min Grocery', icon: Zap, tagline: 'Quick-Commerce' },
  { id: 'food', name: 'Food', icon: Utensils, tagline: 'Dishes & Outlets' },
  { id: 'movie', name: 'Movies', icon: Film, tagline: 'IMAX & Cinema' },
  { id: 'cab', name: 'Cab & Rides', icon: Car, tagline: 'Surge & Fare Check' },
  { id: 'loans', name: 'Loans', icon: Landmark, tagline: 'Lowest APR & EMI' },
  { id: 'insurance', name: 'Insurance', icon: ShieldCheck, tagline: '1 Cr Health & Car' },
];

export const VerticalNav: React.FC = () => {
  const { vertical, setVertical, activeNavTab, setActiveNavTab, items } = useApp();

  const handleSelect = (vId: VerticalId) => {
    setVertical(vId);
    setActiveNavTab('compare');
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };

  const handleHomeClick = () => {
    setActiveNavTab('home');
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };

  return (
    <div className="bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto py-2.5 scrollbar-none">
          {/* Home Button near Flights */}
          <button
            type="button"
            onClick={handleHomeClick}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-all shrink-0 cursor-pointer ${
              activeNavTab === 'home'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Home
              className={`w-4 h-4 ${
                activeNavTab === 'home' ? 'text-orange-400' : 'text-slate-500'
              }`}
            />
            <span>Home</span>
          </button>

          {VERTICALS.map((item) => {
            const Icon = item.icon;
            const isActive = activeNavTab === 'compare' && vertical === item.id;
            const count = items.filter((it) => it.vertical === item.id).length;

            return (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? 'text-orange-400' : 'text-slate-500'
                  }`}
                />
                <span>{item.name}</span>
                <span
                  className={`text-[10px] tabular-nums font-bold px-1.5 py-0.2 rounded-full ${
                    isActive
                      ? 'bg-slate-800 text-slate-300'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
