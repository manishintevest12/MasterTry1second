/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { VerticalNav } from './components/VerticalNav';
import { SearchAndFilterHeader } from './components/SearchAndFilterHeader';
import { ComparisonFeed } from './components/ComparisonFeed';
import { HomeView } from './components/HomeView';
const RadarView = lazy(() => import('./components/RadarView').then((m) => ({ default: m.RadarView })));
const QuickAppsView = lazy(() => import('./components/QuickAppsView').then((m) => ({ default: m.QuickAppsView })));
const AiInsightsView = lazy(() => import('./components/AiInsightsView').then((m) => ({ default: m.AiInsightsView })));
const RewardsHub = lazy(() => import('./components/RewardsHub').then((m) => ({ default: m.RewardsHub })));
import { FixedBottomBar } from './components/FixedBottomBar';
import { RedirectionModal } from './components/RedirectionModal';
import { ReviewModal } from './components/ReviewModal';
import { PriceAlertModal } from './components/PriceAlertModal';
const ProductPageView = lazy(() => import('./components/ProductPageView').then((m) => ({ default: m.ProductPageView })));
const PriceAlertsView = lazy(() => import('./components/PriceAlertsView').then((m) => ({ default: m.PriceAlertsView })));
const SpendLensView = lazy(() => import('./components/SpendLensView').then((m) => ({ default: m.SpendLensView })));
import { BrowserExtensionModal } from './components/BrowserExtensionModal';
import { NotificationsDrawer } from './components/NotificationsDrawer';
import { ProfileModal } from './components/ProfileModal';
import { ToastContainer } from './components/ToastContainer';
import { Footer } from './components/Footer';
import { AffiliatePartnersSection } from './components/AffiliatePartnersSection';
import { InfoAndLegalModal } from './components/InfoAndLegalModal';
import { PartnerInquiryModal } from './components/PartnerInquiryModal';
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const AdminLoginView = lazy(() => import('./components/admin/AdminLoginView').then((m) => ({ default: m.AdminLoginView })));
const MerchantPortal = lazy(() => import('./components/merchant/MerchantPortal').then((m) => ({ default: m.MerchantPortal })));
const MerchantLoginView = lazy(() => import('./components/merchant/MerchantLoginView').then((m) => ({ default: m.MerchantLoginView })));
import { CplLeadCaptureModal } from './components/CplLeadCaptureModal';

const MainContent: React.FC = () => {
  const {
    activeNavTab,
    isAdminAuthenticated,
    authenticatedVendor,
    isExtensionModalOpen,
    closeExtensionModal,
  } = useApp();

  const isFullDashboard = activeNavTab === 'admin' || activeNavTab === 'merchant';

  // Automatically scroll to the top of the window whenever the active navigation tab changes
  React.useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [activeNavTab]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 pb-20">

      {/* Top Header with Try1Second logo, Compare button, Notifications, Profile */}
      <Navbar />

      {/* Subnav strip for 10 verticals when browsing comparison or home */}
      {['compare', 'home'].includes(activeNavTab) && <VerticalNav />}

      {/* In Compare tab, show the Kayak-style search & filter bar */}
      {activeNavTab === 'compare' && <SearchAndFilterHeader />}

      {/* Main View Router — secondary views lazy-load (PageSpeed bundle fix) */}
      <div className="flex-1">
        <Suspense fallback={<div className="min-h-[40vh]" aria-busy="true" />}>
        {activeNavTab === 'home' && <HomeView />}
        {activeNavTab === 'quickapps' && <QuickAppsView />}
        {activeNavTab === 'radar' && <RadarView />}
        {activeNavTab === 'insights' && <AiInsightsView />}
        {activeNavTab === 'tracker' && <PriceAlertsView />}
        {activeNavTab === 'spendlens' && <SpendLensView />}
        {activeNavTab === 'product' && <ProductPageView />}
        {activeNavTab === 'compare' && <ComparisonFeed />}
        {activeNavTab === 'rewards' && <RewardsHub />}
        {activeNavTab === 'admin' && (isAdminAuthenticated ? <AdminDashboard /> : <AdminLoginView />)}
        {activeNavTab === 'merchant' && (authenticatedVendor ? <MerchantPortal /> : <MerchantLoginView />)}
        </Suspense>
      </div>

      {/* Modals & Drawers */}
      <RedirectionModal />
      <CplLeadCaptureModal />
      <ReviewModal />
      <PriceAlertModal />
      <BrowserExtensionModal isOpen={isExtensionModalOpen} onClose={closeExtensionModal} />
      <NotificationsDrawer />
      <ProfileModal />
      <ToastContainer />
      <InfoAndLegalModal />
      <PartnerInquiryModal />

      {/* Direct & Affiliate Metasearch Partners Section (Above Footer) */}
      {!isFullDashboard && <AffiliatePartnersSection />}

      {/* Comprehensive Footer with About Us, Privacy Policy, Terms, etc. */}
      {!isFullDashboard && <Footer />}

      {/* Fixed Bottom Bar: Home, Radar, AI Insights, Compare, Rewards */}
      {!isFullDashboard && <FixedBottomBar />}
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}
