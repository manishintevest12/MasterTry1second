/**
 * APP-INSTALL CAMPAIGNS (owner 10 Nov: "ease my trip th hoga cuelinks, vcommission, admitad, linkinr ya phir
 * kisi se").
 *
 * He was right, and the earlier verdict was too narrow. Measured against Cuelinks campaign 80705:
 *   EaseMyTrip App - campaign_type "CPI - Android", access_status open, payout 172.5 INR Per Acquisition,
 *   deeplink_allowed false (so only the campaign's own link can be used), sub_ids allowed,
 *   cookie duration 1 hour, "Click to Install - 1 hour".
 * Following that campaign's tracking_url with a mobile UA landed on
 * app.appsflyer.com/com.easemytrip.android?...&pid=cuelinks_int&af_prt=paritycubein863&clickid=...
 * so the install is genuinely attributed to this publisher account.
 *
 * So EaseMyTrip is monetisable on Cuelinks - as an ANDROID APP INSTALL, not as a website booking. A website
 * click credits nothing. The same shape exists for JioMart App (campaign 5405, 0.95% Per Sale, per-sale after
 * install). Both are registered here so the links are visible in the admin surface and can be used wherever an
 * "install the app" call to action belongs.
 *
 * This module never rewrites a normal merchant exit by itself: app-install exits are opt-in per merchant via
 * T1S_APP_INSTALL_EXITS, because sending a price-comparing user to the Play Store instead of the merchant's
 * site is a product decision, not a default.
 */
export interface AppCampaign {
  /** Merchant key used by T1S_APP_INSTALL_EXITS and by callers. */
  key: string;
  /** Domains this campaign belongs to, so an exit can be matched by destination. */
  domains: string[];
  name: string;
  campaignId: number;
  /** Cuelinks campaign_type, e.g. "CPI - Android". */
  campaignType: string;
  payout: number;
  payoutCurrency: string;
  payoutType: string;
  /** Store listing the campaign points at. */
  storeUrl: string;
  /**
   * Owner 10 Nov 14:11: "ni emt deeplink rkho install wala incude mt kro". EaseMyTrip must always exit to the
   * merchant with its own deep product path; the install campaign may stay visible for reporting but its link
   * must never be used for an exit, even if T1S_APP_INSTALL_EXITS names it (or is set to 'all').
   */
  installExitAllowed?: boolean;
}

export const APP_CAMPAIGNS: AppCampaign[] = [
  {
    key: 'easemytrip',
    domains: ['easemytrip.com'],
    name: 'EaseMyTrip App',
    campaignId: 80705,
    campaignType: 'CPI - Android',
    payout: 172.5,
    payoutCurrency: 'INR',
    payoutType: 'Per Acquisition',
    storeUrl: 'https://play.google.com/store/apps/details?id=com.easemytrip.android',
    installExitAllowed: false,
  },
  {
    key: 'jiomart',
    domains: ['jiomart.com'],
    name: 'JioMart App',
    campaignId: 5405,
    campaignType: 'CPI - Android',
    payout: 0.95,
    payoutCurrency: 'INR',
    payoutType: 'Per Sale',
    storeUrl: 'https://play.google.com/store/apps/details?id=com.jiomart.app',
  },
];

function cuelinksCid(): string {
  const fromEnv = (process.env.CUELINKS_CID || '').trim();
  return fromEnv || '326794';
}

/** True when the owner has switched app-install exits on for this merchant. */
export function appInstallExitEnabled(key: string): boolean {
  // A campaign the owner has ruled out can never be switched on by an env value.
  const blocked = APP_CAMPAIGNS.find((c) => c.key === key.toLowerCase() && c.installExitAllowed === false);
  if (blocked) return false;
  const raw = (process.env.T1S_APP_INSTALL_EXITS || '').trim().toLowerCase();
  if (!raw || raw === '0' || raw === 'off') return false;
  if (raw === '1' || raw === 'on' || raw === 'all') return true;
  return raw.split(',').map((s) => s.trim()).includes(key.toLowerCase());
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** The campaign that owns a destination domain, if any. */
export function appCampaignFor(destination: string): AppCampaign | null {
  const host = hostOf(destination);
  if (!host) return null;
  for (const c of APP_CAMPAIGNS) {
    if (c.domains.some((d) => host === d || host.endsWith(`.${d}`))) return c;
  }
  return null;
}

/**
 * The tracked Play Store link for a campaign. Mirrors the campaign's own tracking_url shape
 * (cid + source=api + url=<store>) and adds our subid so a click is traceable in reporting.
 */
export function appInstallTrackingUrl(campaign: AppCampaign, subId?: string): string {
  const params = new URLSearchParams({
    cid: cuelinksCid(),
    source: 'api',
    url: campaign.storeUrl,
  });
  if (subId) params.set('subid', subId);
  return `https://linksredirect.com/?${params.toString()}`;
}

/**
 * True when the caller can install an Android app: a real Android browser UA, or the Flutter app itself.
 * The Flutter app's own HTTP client sends Dart's default UA ("Dart/3.x (dart:io)"), which carries no
 * "Android" token, so without this the CPI exit would never fire for our app users even though the app is
 * Android-only. Keeping it here means the app inherits server-side affiliate changes with no APK.
 */
export function appLikeAndroid(ua: string | undefined): boolean {
  const u = String(ua || '');
  if (/android/i.test(u)) return true;
  return /dart|flutter|try1second\//i.test(u);
}

/** The exit for a given user agent, so callers do not need to know about UA quirks. */
export function appInstallExitForUserAgent(userAgent: string | undefined, destination: string, subId?: string): string | null {
  return appInstallExit(destination, { isAndroid: appLikeAndroid(userAgent), subId });
}

/**
 * Exit target for an Android visitor when app-install exits are enabled for that merchant,
 * else null (caller keeps the normal merchant exit).
 */
export function appInstallExit(destination: string, opts: { isAndroid: boolean; subId?: string }): string | null {
  if (!opts.isAndroid) return null;
  const campaign = appCampaignFor(destination);
  if (!campaign) return null;
  if (!appInstallExitEnabled(campaign.key)) return null;
  return appInstallTrackingUrl(campaign, opts.subId);
}
