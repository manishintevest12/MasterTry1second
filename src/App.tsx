/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { VerticalNav } from './components/VerticalNav';
import { SearchAndFilterHeader } from './components/SearchAndFilterHeader';
import { ComparisonFeed } from './components/ComparisonFeed';
import { HomeView } from './components/HomeView';
import { RadarView } from './components/RadarView';
import { QuickAppsView } from './components/QuickAppsView';
import { AiInsightsView } from './components/AiInsightsView';
import { RewardsHub } from './components/RewardsHub';
import { FixedBottomBar } from './components/FixedBottomBar';
import { RedirectionModal } from './components/RedirectionModal';
import { ReviewModal } from './components/ReviewModal';
import { PriceAlertModal } from './components/PriceAlertModal';
import { PriceAlertsView } from './components/PriceAlertsView';
import { BrowserExtensionModal } from './components/BrowserExtensionModal';
import { NotificationsDrawer } from './components/NotificationsDrawer';
import { ProfileModal } from './components/ProfileModal';
import { ToastContainer } from './components/ToastContainer';
import { Footer } from './components/Footer';
import { AffiliatePartnersSection } from './components/AffiliatePartnersSection';
import { InfoAndLegalModal } from './components/InfoAndLegalModal';
import { PartnerInquiryModal } from './components/PartnerInquiryModal';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminLoginView } from './components/admin/AdminLoginView';
import { MerchantPortal } from './components/merchant/MerchantPortal';
import { MerchantLoginView } from './components/merchant/MerchantLoginView';
import { CplLeadCaptureModal } from './components/CplLeadCaptureModal';
import { SecretRouteAddressBar } from './components/SecretRouteAddressBar';

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
      {/* Secret Route Navigator & Address Indicator for try1second.com/merchantinstab2b & admininsta */}
      <SecretRouteAddressBar />

      {/* Top Header with Try1Second logo, Compare button, Notifications, Profile */}
      <Navbar />

      {/* Subnav strip for 10 verticals when browsing comparison or home */}
      {['compare', 'home'].includes(activeNavTab) && <VerticalNav />}

      {/* In Compare tab, show the Kayak-style search & filter bar */}
      {activeNavTab === 'compare' && <SearchAndFilterHeader />}

      {/* Main View Router */}
      <div className="flex-1">
        {activeNavTab === 'home' && <HomeView />}
        {activeNavTab === 'quickapps' && <QuickAppsView />}
        {activeNavTab === 'radar' && <RadarView />}
        {activeNavTab === 'insights' && <AiInsightsView />}
        {activeNavTab === 'tracker' && <PriceAlertsView />}
        {activeNavTab === 'compare' && <ComparisonFeed />}
        {activeNavTab === 'rewards' && <RewardsHub />}
        {activeNavTab === 'admin' && (isAdminAuthenticated ? <AdminDashboard /> : <AdminLoginView />)}
        {activeNavTab === 'merchant' && (authenticatedVendor ? <MerchantPortal /> : <MerchantLoginView />)}
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
