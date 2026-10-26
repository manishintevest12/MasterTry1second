/**
 * Settings: environment-driven configuration. Secrets only via env / .env (never committed).
 * Hostinger shared today: no Redis, maybe no MySQL → all optional and honest about it.
 * KVM4 target: MYSQL_URL + REDIS_URL set.
 */
import path from 'path';

export const settings = {
  port: Number(process.env.PORT || 3000),
  env: process.env.NODE_ENV || 'development',
  appUrl: process.env.APP_URL || '',

  /**
   * MySQL connection URL. Two supported forms (discrete vars win — they avoid
   * URL-encoding pitfalls with passwords containing @ : / # % etc.):
   *   1) DB_HOST + DB_PORT + DB_USER + DB_PASSWORD + DB_NAME (as shown in hPanel → Databases)
   *   2) DATABASE_URL / MYSQL_URL (mysql://user:pass@host:port/dbname)
   */
  mysqlUrl:
    (process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME)
      ? `mysql://${encodeURIComponent(process.env.DB_USER)}:${encodeURIComponent(process.env.DB_PASSWORD || '')}@${process.env.DB_HOST}:${process.env.DB_PORT || '3306'}/${encodeURIComponent(process.env.DB_NAME)}`
      : (process.env.DATABASE_URL || process.env.MYSQL_URL || ''),
  redisUrl: process.env.REDIS_URL || '',

  /**
   * HTTPS Redis (shared-hosting friendly): Upstash free tier via its REST API.
   * Works on Hostinger shared hosting (HTTPS-only egress, no TCP 6379 needed).
   * Set both in hPanel: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.
   * REDIS_URL (ioredis/TCP, KVM4) takes precedence when both are present.
   */
  redisRestUrl: process.env.UPSTASH_REDIS_REST_URL || '',
  redisRestToken: process.env.UPSTASH_REDIS_REST_TOKEN || '',

  geminiApiKey: process.env.GEMINI_API_KEY || '',

  /** First-admin bootstrap: any account registered with this email gets the admin role. */
  adminBootstrapEmail: (process.env.ADMIN_EMAIL || '').toLowerCase(),
  /** Allowed admin login emails (email-OTP). ADMIN_EMAILS is a comma-separated list. */
  adminEmails: (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
  aiAssistEnabled: process.env.AI_ASSIST !== 'false' && Boolean(process.env.GEMINI_API_KEY),

  searchApi: {
    apiKey: process.env.SEARCHAPI_API_KEY || '',
    enabled: process.env.SEARCHAPI_ENABLED !== 'false' && Boolean(process.env.SEARCHAPI_API_KEY),
  },

  /** Transactional email (Resend) for admin OTP login. */
  resendApiKey: process.env.RESEND_API_KEY || '',

  /**
   * Firebase Authentication (Google sign-in for the main site). Project ID only — keys live client-side.
   * Fallback to the public project ID so a missing env var can never silently
   * break verification; env always takes precedence.
   */
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || 'try1second-66273',
  /** Google OAuth client IDs allowed as the `aud` of mobile-app Google ID tokens (comma separated). */
  // Accepted ID-token audiences for mobile Google sign-in (/api/auth/google-mobile).
  // Default = the OAuth client in flutter_app/android/app/google-services.json: the
  // google_sign_in Android plugin uses it as the audience via default_web_client_id,
  // so every plain build works without owner env setup. Override/extend via env.
  googleOauthClientIds: (process.env.GOOGLE_OAUTH_CLIENT_IDS
    || '49438102645-f7uut2ihal2lk8llc44ai711r4v3i7je.apps.googleusercontent.com,'
     + '49438102645-bs97o329ipulmr198avioeoasu7jm6v9.apps.googleusercontent.com,'
     + '49438102645-ek7dp1kea0dfj0moi7jphamqrngjg1lk.apps.googleusercontent.com'
  ).split(',').map((e) => e.trim()).filter(Boolean),
  mailFrom: process.env.MAIL_FROM || 'Try1Second <onboarding@resend.dev>',

  // Amazon Associates (owner's own store, Oct 2026): tag= on every amazon.* click
  // through /api/out. This is ATTRIBUTION ONLY — it does not grant any product-data
  // API access (PA-API needs separate Associates approval with qualifying sales).
  amazonAssociates: {
    tag: (process.env.AMAZON_ASSOCIATES_TAG || 'try1second-21').trim(),
  },

  cuelinks: {
    apiKey: process.env.CUELINKS_API_KEY || '',
    publisherId: process.env.CUELINKS_PUBLISHER_ID || '278473', // owner account, Oct 2026
    // Per-publisher tracking cid returned by the official /links/convert API
    // (NOT the public campaign id): cid=326794 = our channel, verified live.
    cid: process.env.CUELINKS_CID || '326794',
    campaignId: process.env.CUELINKS_CAMPAIGN_ID || '',
    subId: process.env.CUELINKS_SUB_ID || '',
    apiBase: process.env.CUELINKS_API_BASE || 'https://developers.cuelinks.com/pub_api/v3',
    // linkkit deeplinks need only publisherId + campaign cid; the Monetization
    // API (offers/campaigns/convert) needs the dashboard API key on top.
    enabled: Boolean(process.env.CUELINKS_API_KEY || process.env.CUELINKS_PUBLISHER_ID),
  },
  admitad: {
    clientId: process.env.ADMITAD_CLIENT_ID || '',
    clientSecret: process.env.ADMITAD_CLIENT_SECRET || '',
    websiteId: process.env.ADMITAD_WEBSITE_ID || '',
    defaultCampaignId: process.env.ADMITAD_DEFAULT_CAMPAIGN_ID || '',
    baseUrl: process.env.ADMITAD_BASE_URL || 'https://api.admitad.com',
    scope: process.env.ADMITAD_SCOPE || 'advcampaigns advcampaigns_for_website coupons_for_website websites',
    enabled: Boolean(process.env.ADMITAD_CLIENT_ID && process.env.ADMITAD_CLIENT_SECRET),
  },
  vcommission: {
    apiKey: process.env.VCOMMISSION_API_KEY || '',
    baseUrl: process.env.VCOMMISSION_BASE_URL || 'https://api.vcommission.com/v2',
    enabled: Boolean(process.env.VCOMMISSION_API_KEY),
  },

  http: {
    connectTimeoutMs: Number(process.env.HTTP_CONNECT_TIMEOUT_MS || 6000),
    maxResponseBytes: Number(process.env.HTTP_MAX_RESPONSE_BYTES || 2 * 1024 * 1024),
    globalMaxConcurrency: Number(process.env.HTTP_GLOBAL_CONCURRENCY || 8),
    defaultRetries: 2,
  },

  worker: {
    refreshIntervalSec: Number(process.env.REFRESH_INTERVAL_SEC || 300),
    maxRefreshBatch: Number(process.env.REFRESH_BATCH || 25),
  },

  isProduction: (process.env.NODE_ENV || '') === 'production',
};

export function assertProductionReadiness(): string[] {
  const missing: string[] = [];
  if (settings.isProduction) {
    if (!settings.mysqlUrl) missing.push('MYSQL_URL/DATABASE_URL (durable catalogue requires MySQL on KVM4)');
    if (!settings.redisUrl) missing.push('REDIS_URL (L2 cache recommended on KVM4)');
  }
  return missing;
}

// Test suites run in PARALLEL processes; each gets its own data dir so no suite
// can delete another suite's devstore mid-run. Production keeps the shared .data.
export const dataDir = path.resolve(
  process.cwd(),
  process.env.DATA_DIR || (process.env.NODE_ENV === 'test' ? `.data-tests/${process.pid}` : '.data'),
);
