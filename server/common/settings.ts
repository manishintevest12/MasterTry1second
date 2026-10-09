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

  mysqlUrl: process.env.DATABASE_URL || process.env.MYSQL_URL || '',
  redisUrl: process.env.REDIS_URL || '',

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

  /** Firebase Authentication (Google sign-in for the main site). Project ID only — keys live client-side. */
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || '',
  mailFrom: process.env.MAIL_FROM || 'Try1Second <onboarding@resend.dev>',

  cuelinks: {
    apiKey: process.env.CUELINKS_API_KEY || '',
    campaignId: process.env.CUELINKS_CAMPAIGN_ID || '',
    subId: process.env.CUELINKS_SUB_ID || '',
    enabled: Boolean(process.env.CUELINKS_API_KEY),
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

export const dataDir = path.resolve(process.cwd(), '.data');
