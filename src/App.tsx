/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { VerticalNav } from './components/VerticalNav';
import { SearchAndFilterHeader } from './components/SearchAndFilterHeader';
const ComparisonFeed = lazy(() => import('./components/ComparisonFeed').then((m) => ({ default: m.ComparisonFeed })));
import { HomeView } from './components/HomeView';
const RadarView = lazy(() => import('./components/RadarView').then((m) => ({ default: m.RadarView })));
const QuickAppsView = lazy(() => import('./components/QuickAppsView').then((m) => ({ default: m.QuickAppsView })));
const AiInsightsView = lazy(() => import('./components/AiInsightsView').then((m) => ({ default: m.AiInsightsView })));
const RewardsHub = lazy(() => import('./components/RewardsHub').then((m) => ({ default: m.RewardsHub })));
import { FixedBottomBar } from './components/FixedBottomBar';
const RedirectionModal = lazy(() => import('./components/RedirectionModal').then((m) => ({ default: m.RedirectionModal })));
const ReviewModal = lazy(() => import('./components/ReviewModal').then((m) => ({ default: m.ReviewModal })));
const PriceAlertModal = lazy(() => import('./components/PriceAlertModal').then((m) => ({ default: m.PriceAlertModal })));
const ProductPageView = lazy(() => import('./components/ProductPageView').then((m) => ({ default: m.ProductPageView })));
const PriceAlertsView = lazy(() => import('./components/PriceAlertsView').then((m) => ({ default: m.PriceAlertsView })));
const SpendLensView = lazy(() => import('./components/SpendLensView').then((m) => ({ default: m.SpendLensView })));
const BrowserExtensionModal = lazy(() => import('./components/BrowserExtensionModal').then((m) => ({ default: m.BrowserExtensionModal })));
const NotificationsDrawer = lazy(() => import('./components/NotificationsDrawer').then((m) => ({ default: m.NotificationsDrawer })));
const SmartCartDrawer = lazy(() => import('./components/SmartCartDrawer').then((m) => ({ default: m.SmartCartDrawer })));
const ProfileModal = lazy(() => import('./components/ProfileModal').then((m) => ({ default: m.ProfileModal })));
import { ToastContainer } from './components/ToastContainer';
const Footer = lazy(() => import('./components/Footer').then((m) => ({ default: m.Footer })));
const AffiliatePartnersSection = lazy(() => import('./components/AffiliatePartnersSection').then((m) => ({ default: m.AffiliatePartnersSection })));
const InfoAndLegalModal = lazy(() => import('./components/InfoAndLegalModal').then((m) => ({ default: m.InfoAndLegalModal })));
const PartnerInquiryModal = lazy(() => import('./components/PartnerInquiryModal').then((m) => ({ default: m.PartnerInquiryModal })));
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const AdminLoginView = lazy(() => import('./components/admin/AdminLoginView').then((m) => ({ default: m.AdminLoginView })));
const MerchantPortal = lazy(() => import('./components/merchant/MerchantPortal').then((m) => ({ default: m.MerchantPortal })));
const MerchantLoginView = lazy(() => import('./components/merchant/MerchantLoginView').then((m) => ({ default: m.MerchantLoginView })));
const CplLeadCaptureModal = lazy(() => import('./components/CplLeadCaptureModal').then((m) => ({ default: m.CplLeadCaptureModal })));

const MainContent: React.FC = () => {
  const {
    activeNavTab,
    isAdminAuthenticated,
    authenticatedVendor,
    isExtensionModalOpen,
    closeExtensionModal,
    redirectionState,
    leadCaptureState,
    reviewModalItem,
    priceAlertModalItem,
    isNotificationsOpen,
    isProfileOpen,
    infoModalTab,
    isPartnerModalOpen,
    isSmartCartOpen,
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

      {/* Subnav strip for 12 verticals when browsing comparison or home */}
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

      {/* Modals & Drawers — lazy: nothing here renders on landing (TBT fix) */}
      {/* Modals & Drawers — lazily mounted ONLY when their open-flag flips, so
          not a single modal chunk is fetched or executed on the landing page
          (mobile TBT fix, 17 Oct). Each component still guards itself internally. */}
      <Suspense fallback={null}>
      {redirectionState?.isOpen && <RedirectionModal />}
      {leadCaptureState?.isOpen && <CplLeadCaptureModal />}
      {reviewModalItem && <ReviewModal />}
      {priceAlertModalItem && <PriceAlertModal />}
      {isExtensionModalOpen && <BrowserExtensionModal isOpen onClose={closeExtensionModal} />}
      {isNotificationsOpen && <NotificationsDrawer />}
      {isSmartCartOpen && <SmartCartDrawer />}
      {isProfileOpen && <ProfileModal />}
      <ToastContainer />
      {infoModalTab && <InfoAndLegalModal />}
      {isPartnerModalOpen && <PartnerInquiryModal />}
      </Suspense>

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
