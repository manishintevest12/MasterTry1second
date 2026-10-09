export type VerticalId =
  | 'flights'
  | 'hotels'
  | 'bus'
  | 'ecommerce'
  | 'grocery'
  | 'food'
  | 'movie'
  | 'loans'
  | 'insurance'
  | 'cab'
  | 'trains'
  | 'pharmacy'
  | 'bills_utilities';

export type MainNavTab = 'home' | 'radar' | 'quickapps' | 'insights' | 'compare' | 'rewards' | 'admin' | 'merchant' | 'tracker';
export type RewardsSubTab = 'coupons' | 'offers' | 'spin' | 'cards';

export interface UserLocationState {
  address: string;
  locality: string;
  city: string;
  pincode: string;
  coordinates: { lat: number; lng: number };
  isGps: boolean;
  accuracyText?: string;
}

export interface SellerQuote {
  id: string;
  sellerName: string;
  sellerLogo?: string;
  price: number;
  originalPrice?: number;
  currency: string;
  url: string;
  badge?: string; // e.g. 'Lowest Price', 'Fastest Delivery', 'Official Partner'
  deliveryOrEta?: string;
  isLowest?: boolean;
  couponCode?: string;
  cashbackText?: string;
  isLiveScraped?: boolean;
  sourceDomain?: string;
  scrapedLocation?: string;
  provenance?: {
    sourceType: 'searchapi' | 'live_http' | 'curl_stealth' | 'partner_api' | 'cached_catalogue';
    fetchedAt: string;
    statusCode: number;
    rawDomain: string;
    latencyMs: number;
  };
}

export interface UserReview {
  id: string;
  author: string;
  avatar?: string;
  rating: number; // 1 to 5
  date: string;
  title: string;
  comment: string;
  pros?: string;
  cons?: string;
  verifiedPurchase: boolean;
  helpfulCount: number;
  categoryScores?: { [criterion: string]: number };
}

export interface PriceDataPoint {
  date: string;
  price: number;
}

export interface ComparisonItem {
  id: string;
  vertical: VerticalId;
  title: string;
  subtitle: string;
  category: string;
  provider: string; // Airline, Hotel chain, E-comm brand, Restaurant, Bank, Insurer, Cab company
  providerLogo?: string;
  rating: number;
  reviewCount: number;
  sentimentSummary: string;
  criteriaRatings: { name: string; score: number }[];
  primaryPrice: number;
  originalPrice: number;
  unit?: string; // e.g. 'per night', 'per ticket', 'EMI / mo', 'annual premium', 'per trip', 'for 500g'
  sellerQuotes: SellerQuote[];
  pricePrediction: {
    advice: 'book_now' | 'wait' | 'fair_price';
    headline: string;
    details: string;
    historicalLow: number;
    historicalHigh: number;
    priceHistory: PriceDataPoint[];
  };
  features: string[];
  specs: Record<string, string>;
  isPriceTracked?: boolean;
  targetPriceAlert?: number;
  imageUrl?: string;
  galleryImages?: string[];
  logoText?: string;
  logoColor?: string;
  logoBg?: string;
  brandTag?: string;
  reviews: UserReview[];
  lastPriceUpdate?: string;
  isLiveScraped?: boolean;
  scrapedLocation?: string;
  scrapedTimestamp?: string;
  scrapedLatencyMs?: number;
}

export type InfoModalTab = 'about' | 'privacy' | 'terms' | 'affiliate' | 'contact' | 'faq';

export interface CouponItem {
  id: string;
  vertical: VerticalId;
  store: string;
  code: string;
  discountText: string;
  description: string;
  expiry: string;
  minSpend?: string;
}

export interface ExclusiveOffer {
  id: string;
  vertical: VerticalId;
  title: string;
  merchant: string;
  tagline: string;
  cashbackAmount: string;
  expiryText: string;
  claimUrl: string;
  badge: string;
}

export interface CreditCardReward {
  id: string;
  cardName: string;
  bank: string;
  bankCode?: 'HDFC' | 'SBI' | 'ICICI' | 'AXIS' | 'AMEX' | 'IDFC' | 'KOTAK' | 'INDUSIND' | string;
  category?: 'cashback' | 'travel' | 'shopping' | 'lifetime_free' | 'fuel_dining' | 'rupay';
  annualFee: string;
  joiningFee?: string;
  rewardRate: string;
  bestVerticals: VerticalId[];
  highlight: string;
  extraSavingsNote: string;
  applyUrl: string;
  joiningPerks?: string;
  cardImageUrl?: string;
  rating?: number;
  reviewCount?: number;
  keyPerks?: string[];
  creditScoreRequired?: string;
  isPopular?: boolean;
}

export interface ReferredFriend {
  id: string;
  name: string;
  email: string;
  date: string;
  status: 'active' | 'pending';
  pointsAwarded: number;
}

export interface SpinReward {
  id: string;
  title: string;
  description: string;
  voucherCode: string;
  color: string;
  iconName: string;
  value: string;
  expiryDays: number;
  probabilityWeight?: number; // e.g., 10 (%)
  stockLimit?: number; // Total voucher quota
  stockRemaining?: number;
  isActive?: boolean;
}

export interface WonReward {
  id: string;
  reward: SpinReward;
  wonAt: string;
  expiresAt: string;
  voucherCode: string;
  isUsed: boolean;
}

// =================== ADMIN INTERFACES ===================

export interface UserPurchaseRecord {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userCity: string;
  userIp: string;
  merchantName: string;
  vertical: VerticalId;
  itemTitle: string;
  orderId: string;
  orderAmount: number;
  commissionEarned: number;
  commissionRate: string;
  pointsAwarded: number;
  status: 'tracked' | 'approved' | 'paid' | 'pending';
  timestamp: string;
  affiliateNetwork: string; // 'Direct' | 'Admitad' | 'vCommission' | 'Cuelinks' | 'Linksdirect'
}

export interface PartnerPayoutSummary {
  id: string;
  partnerName: string;
  vertical: VerticalId;
  network: string;
  affiliateId: string;
  commissionType: 'CPS' | 'CPA' | 'CPC' | 'Hybrid';
  commissionRate: string;
  totalClicks: number;
  conversions: number;
  totalOrderVolume: number;
  totalPayoutEarned: number;
  pendingPayout: number;
  lastPaymentDate: string;
  status: 'active' | 'paused' | 'under_review';
}

export interface AffiliateIdConfig {
  id: string;
  merchantOrNetwork: string;
  vertical: VerticalId;
  affiliateId: string;
  subIdParam: string;
  trackingDomain: string;
  status: 'active' | 'inactive';
  notes?: string;
}

export interface CustomScraperConfig {
  id: string;
  merchantName: string;
  vertical: VerticalId;
  targetUrlTemplate: string;
  priceSelector: string;
  titleSelector: string;
  ratingSelector: string;
  etaSelector?: string;
  engineMode: 'headless_puppeteer' | 'cheerio_html' | 'jsonld_regex' | 'stealth_proxy';
  status: 'active' | 'draft' | 'testing';
  lastScrapeTime: string;
  itemsScrapedLastRun: number;
  autoIngestIntoCompare: boolean;
}

export interface ApiIntegrationConfig {
  id: string;
  partnerName: string;
  vertical: VerticalId;
  endpointUrl: string;
  httpMethod: 'GET' | 'POST';
  authType: 'bearer' | 'api_key' | 'oauth2' | 'none';
  authToken: string;
  responseMapping: {
    priceField: string;
    titleField: string;
    ratingField: string;
    deeplinkField: string;
  };
  rateLimit: string;
  status: 'active' | 'testing' | 'offline';
  latencyMs: number;
}

export interface AffiliateNetworkHubConfig {
  id: string;
  name: 'Admitad' | 'vCommission' | 'Cuelinks' | 'Linksdirect' | 'Optimise' | string;
  publisherId: string;
  apiKey: string;
  webhookUrl: string;
  deepLinkPrefix: string;
  connectedCampaignsCount: number;
  totalEarningsMonth: number;
  syncStatus: 'synced' | 'connecting' | 'error';
  lastSyncTime: string;
  notes: string;
}

export interface ResidentialProxyConfig {
  id: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
  protocol: 'http' | 'https' | 'socks5';
  provider: 'Bright Data' | 'Oxylabs' | 'Smartproxy' | 'Webshare' | 'IPRoyal' | 'Custom';
  country: string;
  city?: string;
  status: 'active' | 'cooldown' | 'blocked' | 'testing';
  latencyMs: number;
  successRate: number;
  requestsCount: number;
  lastUsedAt?: string;
  failCount: number;
}

export interface UserLoginSession {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  phone?: string;
  loginMethod: 'Google One-Tap' | 'Phone OTP' | 'Email Magic Link' | 'Truecaller';
  device: string;
  ipAddress: string;
  location: string;
  loginTime: string;
  sessionDuration: string;
  lastActive: string;
  status: 'active' | 'expired' | 'blocked';
  pointsBalance: number;
  totalSpins: number;
  totalPurchases: number;
}

export interface SpinWinnerLog {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  rewardId: string;
  rewardTitle: string;
  voucherCode: string;
  value: string;
  pointsDeducted: number;
  wonAt: string;
  status: 'claimed' | 'redeemed' | 'expired';
}

export interface DirectPartnerItem {
  id: string;
  name: string;
  category: 'travel' | 'retail' | 'food' | 'finance' | 'cabs';
  categoryLabel: string;
  badge: 'Direct API' | 'Official Partner' | 'Licensed Meta' | 'Verified Partner' | string;
  logoBg: string;
  logoText: string;
  textColor?: string;
  description: string;
  websiteUrl: string;
  status: 'active' | 'paused';
  clickCount?: number;
  featured?: boolean;
}

// ==========================================
// CPL LEAD GENERATION & MERCHANT DASHBOARD
// ==========================================

export interface MatchedFinancialPartner {
  partnerId: string;
  partnerName: string;
  logoText: string;
  logoBg: string;
  approvalOdds: number; // e.g. 98%
  offerHeadline: string; // e.g. "Pre-Approved up to ₹15,00,000 @ 10.25% APR"
  processingFee: string; // e.g. "Flat 0% / Zero Fee Waiver"
  leadReferenceCode: string;
  disbursalTime: string; // e.g. "Instant 15-Min Disbursal"
}

export interface CplLead {
  id: string;
  vertical: VerticalId | string;
  serviceType: string;
  requestedAmount: number;
  monthlySalary?: number;
  salaryBracket?: string;
  employmentType?: 'salaried' | 'self_employed' | 'business';
  existingEmis?: number;
  city: string;
  pincode: string;
  fullName: string;
  phone: string;
  email: string;
  creditScoreEstimate?: number;
  matchedPartners: MatchedFinancialPartner[];
  status: 'new' | 'contacted' | 'approved' | 'disqualified';
  cplCost: number;
  createdAt: string;
  assignedMerchant: string;
  orderItemsOrNotes?: string;
}

export interface MerchantCampaign {
  id: string;
  merchantName: string;
  vertical: VerticalId | string;
  campaignName: string;
  targetMinSalary?: number;
  targetCities: string[];
  minAmount?: number;
  maxAmount?: number;
  cplBid: number; // e.g. ₹750 or ₹45 CPC/CPO
  dailyLeadCap: number;
  leadsDeliveredToday: number;
  totalLeadsDelivered: number;
  status: 'active' | 'paused';
}

export interface LeadCaptureState {
  isOpen: boolean;
  item: ComparisonItem | null;
  quote: SellerQuote | null;
  step: 'form' | 'processing' | 'matched';
  submittedLead: CplLead | null;
}

// ==========================================
// B2B MARKET INTELLIGENCE & PRICE PARITY
// ==========================================

export type B2BTier = 'standard' | 'pro';

export interface PriceParitySkuItem {
  id: string;
  title: string;
  category: string;
  myPrice: number;
  competitorPrice: number;
  competitorPlatform: string;
  priceDifference: number; // myPrice - competitorPrice
  winStatus: 'win' | 'tie' | 'loss';
  unitOrVariant: string;
  stockStatus: 'in_stock' | 'out_of_stock' | 'low_stock';
  competitorStockStatus: 'in_stock' | 'out_of_stock' | 'low_stock';
  buyBoxWon: boolean;
  deliveryFeeMy?: number;
  deliveryFeeComp?: number;
  surgeMultiplierMy?: number;
  surgeMultiplierComp?: number;
  pincodeAvailability?: string;
  aprOrInterestMy?: number;
  aprOrInterestComp?: number;
}

export interface PinCodeParityMetric {
  pincode: string;
  locality: string;
  city: string;
  winRatePercent: number; // e.g. 84%
  avgPriceDeltaPercent: number; // e.g. -3.8%
  sampleSkusTracked: number;
  ourAdvantageCount: number;
  competitorAdvantageCount: number;
  tieCount: number;
  isHighDefeatZone: boolean;
  surgeImpactScore: number; // 1 to 10
  topLosingCategory: string;
}

export interface DailyPriceTrendPoint {
  date: string;
  myAvgPrice: number;
  compAvgPrice: number;
  delta: number;
  hasSurge: boolean;
  hasFlashSale: boolean;
  eventNote?: string;
}

export interface VerticalIntelligenceConfig {
  verticalId: string;
  verticalLabel: string;
  defaultMyBrand: string;
  availableBrands: string[];
  competitors: string[];
  primaryMetricName: string;
  primaryMetricLabel: string;
  secondaryMetricLabel: string;
}

// ==========================================
// MERCHANT 10-DIGIT VENDOR ACCOUNTS & ACCESS
// ==========================================

export interface MerchantVendorAccount {
  id: string;
  vendorIdNumber: string; // Exact 10-digit number e.g. "8920194821"
  companyName: string;
  brandId: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  vertical: string;
  status: 'active' | 'suspended';
  createdAt: string;
  lastLoginAt?: string;
  prepaidCredits: number;
  notes?: string;
  lastEmailSentAt?: string; // Timestamp when Admin emailed 10-digit credentials
}

// ====================================================
// PLATFORM TRAFFIC & PARTNER CAMPAIGN PERFORMANCE TYPES
// ====================================================

export type TimeframePreset = 'this_month' | 'last_3_months' | 'last_12_months' | 'till_date';

export interface MonthlyTrafficDataPoint {
  monthKey: string; // e.g. '2025-11'
  monthLabel: string; // e.g. 'Nov 2025'
  visits: number;
  uniqueVisitors: number;
  scannerQueries: number;
  outboundClicks: number;
  conversions: number;
  gmvDriven: number;
  revenueEarned: number;
  activeCampaignsCount: number;
}

export interface PlatformTrafficSummary {
  totalVisits: number;
  uniqueVisitors: number;
  scannerQueries: number;
  outboundRedirections: number;
  outboundCtr: number;
  conversions: number;
  conversionRate: number;
  gmvDriven: number;
  revenueEarned: number;
  avgSessionDuration: string;
  bounceRate: string;
  growthMoM: string;
}

export interface PartnerCampaignPerformance {
  id: string;
  campaignName: string;
  partnerName: string;
  partnerLogo?: string;
  partnerType: 'direct_partner' | 'affiliate';
  affiliateNetwork: string; // e.g., 'Direct API', 'Cuelinks', 'Optimise', 'vCommission', 'Impact', 'In-House Metasearch'
  vertical: VerticalId;
  status: 'active' | 'completed' | 'paused';
  commissionModel: string; // e.g. '2.5% CPS', '₹750 CPL', '4.0% CPS', '₹50/Ride', '12% CPO'
  startDate: string;
  timeframeStats: Record<TimeframePreset, {
    impressions: number;
    clicks: number;
    ctr: number;
    conversions: number;
    conversionRate: number;
    gmvDriven: number;
    commissionEarned: number;
    roasMultiplier: number;
  }>;
  targetingNotes: string;
  targetCities: string[];
}

export interface TrafficChannelBreakdown {
  channel: string;
  percentage: number;
  visits: number;
  bounceRate: string;
  conversionRate: number;
}

export interface DeviceTrafficBreakdown {
  device: string;
  percentage: number;
  visits: number;
}

export interface MetroTrafficBreakdown {
  city: string;
  percentage: number;
  visits: number;
  topVertical: string;
  gmvShare: number;
}

// ==========================================
// QUICK APPS & DEEP LINK PARTNERS
// ==========================================

export type QuickAppPartnerType =
  | 'CPC'
  | 'CPI - Android'
  | 'CPI - IOS'
  | 'CPI - Windows'
  | 'CPL'
  | 'CPS';

export interface QuickAppPartner {
  id: string;
  name: string;
  iconUrl: string;
  category: string;
  type: QuickAppPartnerType;
  deepLink: string;
  webUrl: string;
  description: string;
  payoutRate: string;
  payoutAmount: number;
  status: 'active' | 'paused';
  rating: number;
  downloadsOrUsers?: string;
  badge?: string;
  bgColor?: string;
  createdAt: string;
}

export interface QuickAppRedirectionLog {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerIconUrl: string;
  partnerType: QuickAppPartnerType;
  deepLink: string;
  targetUrl: string;
  timestamp: string;
  devicePlatform: 'Android' | 'iOS' | 'Windows' | 'Web' | 'Other';
  userAgent?: string;
  payoutAmount: number;
  status: 'redirected' | 'opened_app' | 'converted';
  sessionId?: string;
}

export interface PriceAlertSettings {
  targetPrice: number;
  whatsappEnabled: boolean;
  whatsappNumber: string;
  pushEnabled: boolean;
  emailEnabled: boolean;
  emailAddress: string;
  surgePredictionAlert: boolean;
  status: 'dropped' | 'stable' | 'increased';
  historicalLow: number;
  estimatedBestBuyDate: string;
  lastNotifiedAt?: string;
}

export type ExtensionSimulatedSite = 'amazon' | 'flipkart' | 'swiggy' | 'blinkit' | 'makemytrip';

export interface AutoCouponCode {
  id: string;
  code: string;
  discountAmount: number;
  discountPercent?: number;
  minOrder?: number;
  description: string;
  bankOrSource: string;
  isWinningCode?: boolean;
}
