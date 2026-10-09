import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  FileText,
  HelpCircle,
  Mail,
  ExternalLink,
  Award,
  Zap,
  CheckCircle2,
  Lock,
  Compass,
  PhoneCall,
  Send,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { InfoModalTab } from '../types';
import { Try1SecondLogo } from './Try1SecondLogo';

export const InfoAndLegalModal: React.FC = () => {
  const { infoModalTab, closeInfoModal, openInfoModal } = useApp();

  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    subject: 'Missing Reward Points',
    message: '',
  });
  const [formSubmitted, setFormSubmitted] = useState<boolean>(false);

  if (!infoModalTab) return null;

  const handleTabChange = (tab: InfoModalTab) => {
    openInfoModal(tab);
    setFormSubmitted(false);
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.email || !contactForm.message) return;
    setFormSubmitted(true);
    setTimeout(() => {
      setContactForm({ name: '', email: '', subject: 'Missing Reward Points', message: '' });
    }, 4000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <Try1SecondLogo size="md" />
            <div className="hidden sm:block h-5 w-px bg-slate-200" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Legal, Company & Support Directory
            </span>
          </div>

          <button
            type="button"
            onClick={closeInfoModal}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation Strip */}
        <div className="flex items-center gap-1 px-4 py-2 bg-slate-100/70 border-b border-slate-200 overflow-x-auto text-xs font-medium scrollbar-none">
          <button
            type="button"
            onClick={() => handleTabChange('about')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
              infoModalTab === 'about'
                ? 'bg-white text-orange-600 font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            About Us
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('privacy')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
              infoModalTab === 'privacy'
                ? 'bg-white text-orange-600 font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Privacy Policy
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('terms')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
              infoModalTab === 'terms'
                ? 'bg-white text-orange-600 font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Terms of Service
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('affiliate')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
              infoModalTab === 'affiliate'
                ? 'bg-white text-orange-600 font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Affiliate Disclosure
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('faq')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
              infoModalTab === 'faq'
                ? 'bg-white text-orange-600 font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            FAQ & Help
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('contact')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
              infoModalTab === 'contact'
                ? 'bg-white text-orange-600 font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Contact Support
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 text-slate-700 text-sm leading-relaxed">
          {/* TAB 1: ABOUT US */}
          {infoModalTab === 'about' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">
                  Welcome to Try1Second
                </h2>
                <p className="text-xs text-orange-600 font-bold uppercase tracking-wider mt-0.5">
                  India's 1-Second Unified Multi-Vertical Comparison & Rewards Engine
                </p>
              </div>

              <p>
                Every day, millions of Indian consumers juggle between 10+ different apps—checking MakeMyTrip for flights, Booking.com for hotels, Amazon and Flipkart for gadgets, Blinkit and Zepto for groceries, Zomato and Swiggy for meals, and Uber vs Ola for rides. In doing so, shoppers lose 30–45 minutes per purchase and overpay by an average of ₹14,000 every year due to fragmented surge pricing, obscured delivery fees, and unapplied bank discounts.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-orange-50 border border-orange-100">
                  <div className="w-8 h-8 rounded-lg bg-orange-600 text-white flex items-center justify-center font-bold text-xs mb-2">
                    <Zap className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">1-Second Latency</h4>
                  <p className="text-xs text-slate-600 mt-1">
                    Direct low-latency API handshakes scan 25+ partner databases simultaneously in sub-second response times.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs mb-2">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">Zero Hidden Fees</h4>
                  <p className="text-xs text-slate-600 mt-1">
                    Final checkout prices include taxes, convenience charges, and real-time bank cashback comparisons.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-purple-50 border border-purple-100">
                  <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center font-bold text-xs mb-2">
                    <Award className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">Spin & Earn Rewards</h4>
                  <p className="text-xs text-slate-600 mt-1">
                    Every outbound click awards 1 Point. Hit 100 Points to spin the jackpot wheel for real merchant vouchers.
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <h3 className="font-bold text-slate-900 text-base mb-2">Our 10 Core Verticals</h3>
                <p className="text-xs text-slate-500 mb-3">
                  We cover all high-frequency consumer sectors with verified partner APIs:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-medium text-slate-700">
                  <span className="p-2 bg-slate-50 rounded-lg border border-slate-100">✈️ Flights</span>
                  <span className="p-2 bg-slate-50 rounded-lg border border-slate-100">🏨 Hotels</span>
                  <span className="p-2 bg-slate-50 rounded-lg border border-slate-100">🚌 Intercity Bus</span>
                  <span className="p-2 bg-slate-50 rounded-lg border border-slate-100">🛍️ E-Commerce</span>
                  <span className="p-2 bg-slate-50 rounded-lg border border-slate-100">⚡ 10-Min Grocery</span>
                  <span className="p-2 bg-slate-50 rounded-lg border border-slate-100">🍔 Food Delivery</span>
                  <span className="p-2 bg-slate-50 rounded-lg border border-slate-100">🎬 Movies</span>
                  <span className="p-2 bg-slate-50 rounded-lg border border-slate-100">💳 Loans & EMI</span>
                  <span className="p-2 bg-slate-50 rounded-lg border border-slate-100">🛡️ Insurance</span>
                  <span className="p-2 bg-slate-50 rounded-lg border border-slate-100">🚕 Cabs & Rides</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PRIVACY POLICY */}
          {infoModalTab === 'privacy' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">Privacy Policy</h2>
                <p className="text-xs text-slate-500 mt-0.5">Last updated: October 2026 · Compliant with DPDP Act 2023</p>
              </div>

              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Our Privacy Pledge:</strong> Try1Second never sells, rents, or monetizes personal consumer data. All searches, price track alerts, and location coordinates are processed strictly client-side or transiently for API pricing handshakes.
                </span>
              </div>

              <div className="space-y-4 text-xs leading-relaxed text-slate-600">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm mb-1">1. Information We Collect</h4>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Hyper-Local Location (GPS / Pincode):</strong> When you enable location permissions, your latitude/longitude or 6-digit postal code is used strictly to query hyper-local dark stores (Blinkit, Zepto), restaurant menus (Zomato, Swiggy), and cab pickup ETAs (Uber, Ola). Location data is never stored on permanent third-party servers.</li>
                    <li><strong>Redirection & Referral Tracking:</strong> When you click "Select Deal" or "Book & Earn", a referral tag is appended to the merchant URL to verify click attribution and credit your 1 Point towards the Spin & Win wheel.</li>
                    <li><strong>Price Alerts & Watchlist:</strong> Desired target prices and notifications are cached locally in your browser storage.</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 text-sm mb-1">2. Cookie & Session Policy</h4>
                  <p>
                    We use strictly functional cookies to preserve your accumulated points, saved wishlist, and active price tracking thresholds across sessions.
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 text-sm mb-1">3. Security & Encryption</h4>
                  <p>
                    All API handshakes are secured using TLS 1.3 with 256-bit encryption. Financial and credit card calculations are performed client-side; Try1Second does not store credit card numbers or banking CVVs.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TERMS OF SERVICE */}
          {infoModalTab === 'terms' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">Terms of Service</h2>
                <p className="text-xs text-slate-500 mt-0.5">Effective Date: October 2026</p>
              </div>

              <div className="space-y-4 text-xs leading-relaxed text-slate-600">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm mb-1">1. Metasearch Role & Non-Merchant Status</h4>
                  <p>
                    Try1Second operates as an unbiased metasearch aggregation engine. When you select a flight, hotel, ride, product, loan, or policy, transaction fulfillment occurs on the verified third-party partner's platform (e.g., MakeMyTrip, Amazon, Blinkit, HDFC Bank). The partner's cancellation, refund, and service terms apply to your final purchase.
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 text-sm mb-1">2. Price Accuracy Guarantee & Real-Time Sync</h4>
                  <p>
                    While our sub-second algorithms fetch real-time seller pricing, partner fares may fluctuate dynamically based on concurrent inventory changes, dynamic airline yield algorithms, or instantaneous dark-store surges. Always confirm the final price on the merchant's checkout screen before payment.
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 text-sm mb-1">3. Point Economy & Spin & Earn Mechanics</h4>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Users earn 1 Try1Second Point per verified merchant redirection.</li>
                    <li>Accumulating 100 Points unlocks 1 Spin on the prize wheel.</li>
                    <li>Vouchers awarded from the prize wheel (Amazon, Swiggy, MakeMyTrip, Blinkit) carry unique redemption promo codes with individual merchant terms and expiry dates.</li>
                    <li>Points hold no standalone fiat currency value and cannot be exchanged for direct cash withdrawal.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: AFFILIATE DISCLOSURE */}
          {infoModalTab === 'affiliate' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">Affiliate Disclosure & Transparency</h2>
                <p className="text-xs text-slate-500 mt-0.5">100% Consumer-First Pricing Transparency</p>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 space-y-2">
                <p className="font-bold text-sm text-amber-900">
                  How does Try1Second make money without charging users?
                </p>
                <p>
                  Try1Second is 100% free for consumers. We participate in verified direct affiliate partnerships with merchants such as MakeMyTrip, Amazon, Agoda, Blinkit, Uber, and PolicyBazaar. When you compare prices on our platform and complete a purchase through our redirection link, the partner merchant pays Try1Second a modest referral commission.
                </p>
                <p className="font-semibold text-amber-900">
                  Crucial note: This never increases your price by even a single paisa. In fact, our comparison engine guarantees you find the absolute lowest published price, with exclusive coupons applied.
                </p>
              </div>

              <div className="space-y-3 text-xs text-slate-600">
                <h4 className="font-bold text-slate-900 text-sm">Our Algorithmic Independence Policy</h4>
                <p>
                  Sellers cannot pay to rank higher in our default "Cheapest" or "Best" metasearch sorting algorithms. Rankings are strictly dictated by mathematically verified prices, live travel durations, user review sentiments, and verified criteria scores.
                </p>
              </div>
            </div>
          )}

          {/* TAB 5: FAQ & HELP */}
          {infoModalTab === 'faq' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">Frequently Asked Questions</h2>
                <p className="text-xs text-slate-500 mt-0.5">Quick answers to common questions</p>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <h4 className="font-bold text-slate-900 text-xs">How quickly are prices updated?</h4>
                  <p className="text-xs text-slate-600 mt-1">
                    Try1Second queries partner APIs in real-time. Flight fares, grocery dark-store stocks, and cab surge prices are updated every 30 to 60 seconds or instantaneously upon user search.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <h4 className="font-bold text-slate-900 text-xs">How do I earn points for the Spin Wheel?</h4>
                  <p className="text-xs text-slate-600 mt-1">
                    You earn 1 point for every new friend who joins Try1Second using your personal referral link! Once your wallet reaches 100 points, the prize wheel unlocks for guaranteed gift vouchers & cashback. You can also use the tester buttons in the Spin tab to simulate referrals and test spins instantly.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <h4 className="font-bold text-slate-900 text-xs">Why does Try1Second request my GPS location?</h4>
                  <p className="text-xs text-slate-600 mt-1">
                    For 10-Min Grocery, Food Delivery, and Cabs, prices and delivery times vary by exact street address. Providing your GPS or entering your 6-digit Pincode ensures you see exact dark-store availability and accurate cab pickup fares.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <h4 className="font-bold text-slate-900 text-xs">Are hotel and airline quotes inclusive of taxes?</h4>
                  <p className="text-xs text-slate-600 mt-1">
                    Yes! Our primary price shows the total estimated price inclusive of base fare, airport fees, GST, and mandatory service charges so there are no surprise jumps at checkout.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: CONTACT SUPPORT */}
          {infoModalTab === 'contact' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">Contact Us & Support Desk</h2>
                <p className="text-xs text-slate-500 mt-0.5">We respond within 24 hours · 7 days a week</p>
              </div>

              {formSubmitted ? (
                <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                  <h3 className="font-bold text-slate-900 text-base">Message Sent Successfully!</h3>
                  <p className="text-xs text-slate-600 max-w-md mx-auto">
                    Thank you for contacting Try1Second Support. Ticket #{Math.floor(100000 + Math.random() * 900000)} has been created. Our team will get back to you at <strong>{contactForm.email || 'your email'}</strong> shortly.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Your Name</label>
                      <input
                        type="text"
                        required
                        value={contactForm.name}
                        onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                        placeholder="e.g. Rahul Sharma"
                        className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-orange-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                      <input
                        type="email"
                        required
                        value={contactForm.email}
                        onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                        placeholder="rahul@example.com"
                        className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-orange-500 bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Inquiry Topic</label>
                    <select
                      value={contactForm.subject}
                      onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-orange-500 bg-white"
                    >
                      <option value="Missing Reward Points">Missing Reward Points / Spin Claim</option>
                      <option value="Report Price Discrepancy">Report Price Discrepancy</option>
                      <option value="Affiliate & Partner Onboarding">Affiliate & Partner Integration</option>
                      <option value="Technical Bug Report">Technical Bug / Website Feedback</option>
                      <option value="Other">Other Question</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Message Details</label>
                    <textarea
                      rows={4}
                      required
                      value={contactForm.message}
                      onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                      placeholder="Please describe your question or issue in detail..."
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-orange-500 bg-white resize-none"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2 text-slate-500 text-xs">
                      <Mail className="w-4 h-4 text-orange-600" />
                      <span>Direct: support@try1second.com</span>
                    </div>

                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Submit Inquiry
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-400">
          <span>Try1Second Metasearch Platform · ISO 27001 Security Standard</span>
          <button
            type="button"
            onClick={closeInfoModal}
            className="text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
};
