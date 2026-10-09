import React from 'react';
import {
  Compass,
  ShieldCheck,
  Award,
  Zap,
  Lock,
  Mail,
  FileText,
  HelpCircle,
  Handshake,
  ExternalLink,
  ArrowUp,
} from 'lucide-react';
import { VERTICAL_META } from '../data/mockData';
import { VerticalId, InfoModalTab } from '../types';
import { useApp } from '../context/AppContext';
import { Try1SecondLogo } from './Try1SecondLogo';

export const Footer: React.FC = () => {
  const { setVertical, setActiveNavTab, openInfoModal, openPartnerModal } = useApp();

  const handleVerticalClick = (vKey: string) => {
    setVertical(vKey as VerticalId);
    setActiveNavTab('compare');
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };

  const handleLegalClick = (tab: InfoModalTab) => {
    openInfoModal(tab);
  };

  return (
    <footer className="bg-white border-t border-slate-200 text-slate-600 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        {/* Value Proposition Triad */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-12 border-b border-slate-200">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 text-orange-600 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Real-time Price Tracking</h4>
              <p className="text-slate-500 mt-1 leading-relaxed text-xs">
                Sub-second live comparisons across 10 verticals with historical low-price alerts so you always book at the bottom.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Verified Community Reviews</h4>
              <p className="text-slate-500 mt-1 leading-relaxed text-xs">
                Unbiased ratings, criteria scoring, and authentic pros & cons submitted by real consumers who completed purchases.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Redirection Rewards & Spin</h4>
              <p className="text-slate-500 mt-1 leading-relaxed text-xs">
                Earn 1 Point per merchant redirection. Collect 100 Points to spin the prize wheel for free vouchers & cashback.
              </p>
            </div>
          </div>
        </div>

        {/* 5-Column Navigation Directory */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8 py-12 border-b border-slate-200">
          {/* Column 1: Brand & Overview */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-1 space-y-3">
            <Try1SecondLogo size="md" />
            <p className="text-xs text-slate-500 leading-relaxed mt-2">
              India's first unified metasearch engine delivering sub-second comparison across travel, quick-commerce, shopping, finance, and mobility.
            </p>
            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={openPartnerModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-[11px] rounded-lg transition-colors cursor-pointer"
              >
                <Handshake className="w-3.5 h-3.5 text-orange-400" />
                <span>Partner Portal</span>
              </button>
            </div>
          </div>

          {/* Column 2: 10 Verticals (Part 1) */}
          <div>
            <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-3">
              Travel & Commute
            </h5>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  type="button"
                  onClick={() => handleVerticalClick('flights')}
                  className="hover:text-orange-600 transition-colors cursor-pointer"
                >
                  Flights (Airlines & OTAs)
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleVerticalClick('hotels')}
                  className="hover:text-orange-600 transition-colors cursor-pointer"
                >
                  Hotels & Luxury Resorts
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleVerticalClick('bus')}
                  className="hover:text-orange-600 transition-colors cursor-pointer"
                >
                  Intercity AC Bus
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleVerticalClick('cab')}
                  className="hover:text-orange-600 transition-colors cursor-pointer"
                >
                  Cabs & Ride-Hailing
                </button>
              </li>
            </ul>
          </div>

          {/* Column 3: Quick Commerce & Shopping */}
          <div>
            <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-3">
              Retail & Food
            </h5>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  type="button"
                  onClick={() => handleVerticalClick('ecommerce')}
                  className="hover:text-orange-600 transition-colors cursor-pointer"
                >
                  E-Commerce & Gadgets
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleVerticalClick('grocery')}
                  className="hover:text-orange-600 transition-colors cursor-pointer"
                >
                  10-Min Quick Grocery
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleVerticalClick('food')}
                  className="hover:text-orange-600 transition-colors cursor-pointer"
                >
                  Food Delivery Deals
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleVerticalClick('movie')}
                  className="hover:text-orange-600 transition-colors cursor-pointer"
                >
                  Movies & IMAX Tickets
                </button>
              </li>
            </ul>
          </div>

          {/* Column 4: Finance & Loans */}
          <div>
            <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-3">
              Financial Services
            </h5>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  type="button"
                  onClick={() => handleVerticalClick('loans')}
                  className="hover:text-orange-600 transition-colors cursor-pointer"
                >
                  Personal & Home Loans
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleVerticalClick('insurance')}
                  className="hover:text-orange-600 transition-colors cursor-pointer"
                >
                  Life & Health Insurance
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setActiveNavTab('rewards');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="hover:text-orange-600 transition-colors cursor-pointer"
                >
                  Credit Card Optimizer
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setActiveNavTab('rewards');
                    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                    document.documentElement.scrollTop = 0;
                    document.body.scrollTop = 0;
                  }}
                  className="hover:text-orange-600 transition-colors cursor-pointer"
                >
                  Spin & Win Wheel (100 Pts)
                </button>
              </li>
            </ul>
          </div>

          {/* Column 5: Company, Legal & Support */}
          <div>
            <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-3">
              Company & Legal
            </h5>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  type="button"
                  onClick={() => handleLegalClick('about')}
                  className="hover:text-orange-600 transition-colors cursor-pointer font-medium"
                >
                  About Us & Story
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleLegalClick('privacy')}
                  className="hover:text-orange-600 transition-colors cursor-pointer font-medium"
                >
                  Privacy Policy (DPDP)
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleLegalClick('terms')}
                  className="hover:text-orange-600 transition-colors cursor-pointer font-medium"
                >
                  Terms of Service
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleLegalClick('affiliate')}
                  className="hover:text-orange-600 transition-colors cursor-pointer font-medium"
                >
                  Affiliate Disclosure
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleLegalClick('faq')}
                  className="hover:text-orange-600 transition-colors cursor-pointer font-medium"
                >
                  Help Center & FAQs
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleLegalClick('contact')}
                  className="hover:text-orange-600 transition-colors cursor-pointer font-medium text-orange-600"
                >
                  Contact Support (24/7)
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Disclaimer & Copyright Row */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-[11px] text-slate-400">
          <div className="flex flex-wrap items-center gap-3">
            <span>© {new Date().getFullYear()} Try1Second Metasearch Technologies Pvt Ltd. All rights reserved.</span>
            <span className="hidden sm:inline">·</span>
            <button
              type="button"
              onClick={() => handleLegalClick('about')}
              className="hover:text-slate-700 cursor-pointer"
            >
              About
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() => handleLegalClick('privacy')}
              className="hover:text-slate-700 cursor-pointer"
            >
              Privacy
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() => handleLegalClick('terms')}
              className="hover:text-slate-700 cursor-pointer"
            >
              Terms
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() => handleLegalClick('affiliate')}
              className="hover:text-slate-700 cursor-pointer"
            >
              Affiliate Disclosures
            </button>
          </div>

          <div className="flex items-center gap-4">
            <p className="text-[10px] text-slate-400 text-center md:text-right max-w-md">
              Try1Second is an independent metasearch engine. Logos and brand names are trademarks of their respective owners. Final prices confirmed upon merchant redirection.
            </p>
            <button
              type="button"
              onClick={() => {
                window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                document.documentElement.scrollTop = 0;
                document.body.scrollTop = 0;
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap shadow-2xs hover:text-slate-900 shrink-0"
              title="Jump to Top of Page"
            >
              <ArrowUp className="w-3.5 h-3.5 text-red-600" />
              <span>Back to Top</span>
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
