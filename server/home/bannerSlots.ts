/**
 * Banner slots (owner 29 Oct): "reward section mai aise hi kr na, aur ye sab banner manage
 * karne ke liye admin mai end to end system banao".
 *
 * One place that owns WHERE a banner pool is used and HOW OFTEN it repeats inside a results
 * list, so web, the Android app and the admin panel can never disagree:
 *
 *   home        - wide strip between home sections (cadence 0 = the page decides its gaps)
 *   quickapps   - inside the Quick Apps results, after every `everyN` app cards
 *   rewards     - inside the Rewards lists (top picks / coupons / offers), after every `everyN`
 *
 * The cadence lives in app_settings ('banner_slots'), so the owner can retune it from
 * Admin -> Home Banners without a release, and every client picks it up on its next load.
 * Defaults are applied for any section an admin has not configured yet.
 */

import { getStore } from '../common/db';
import { log } from '../common/logger';

export type BannerSection = 'home' | 'quickapps' | 'rewards';

export type BannerSlot = {
  section: BannerSection;
  /** Human label used by the admin panel. */
  label: string;
  /** Where the pool shows, in the owner's words (admin help text). */
  where: string;
  /** Insert a strip after every N results. 0 = never inside a list (page-controlled gaps). */
  everyN: number;
  /** Allow the strip to borrow the homepage pool when this section has no banners of its own. */
  fallbackToHome: boolean;
  enabled: boolean;
};

export const BANNER_SECTIONS: BannerSection[] = ['home', 'quickapps', 'rewards'];

export const DEFAULT_BANNER_SLOTS: Record<BannerSection, BannerSlot> = {
  home: {
    section: 'home', label: 'Home', where: 'Wide strip between home sections',
    everyN: 0, fallbackToHome: false, enabled: true,
  },
  quickapps: {
    section: 'quickapps', label: 'Quick Apps', where: 'Inside the Quick Apps results grid, after every N apps',
    everyN: 12, fallbackToHome: true, enabled: true,
  },
  rewards: {
    section: 'rewards', label: 'Rewards', where: 'Inside Rewards lists (top picks, coupons, offers), after every N results',
    everyN: 12, fallbackToHome: true, enabled: true,
  },
};

const SETTINGS_KEY = 'banner_slots';
/** A cadence this small would carpet a list with banners; clamp instead of obeying it. */
const MIN_EVERY_N = 3;
const MAX_EVERY_N = 60;

const clampEveryN = (n: number): number => {
  const v = Math.round(Number(n) || 0);
  if (!Number.isFinite(v) || v <= 0) return 0;
  return Math.min(MAX_EVERY_N, Math.max(MIN_EVERY_N, v));
};

/** Merge a stored override onto the defaults, ignoring anything malformed. */
export function mergeBannerSlots(stored: unknown): Record<BannerSection, BannerSlot> {
  const out = {} as Record<BannerSection, BannerSlot>;
  let raw: any = stored;
  if (typeof stored === 'string') {
    try { raw = JSON.parse(stored); } catch { raw = null; }
  }
  for (const section of BANNER_SECTIONS) {
    const base = DEFAULT_BANNER_SLOTS[section];
    const patch = raw && typeof raw === 'object' ? (raw as any)[section] : null;
    out[section] = {
      ...base,
      everyN: patch && patch.everyN !== undefined ? clampEveryN(patch.everyN) : base.everyN,
      enabled: patch && patch.enabled !== undefined ? Boolean(patch.enabled) : base.enabled,
      fallbackToHome: patch && patch.fallbackToHome !== undefined ? Boolean(patch.fallbackToHome) : base.fallbackToHome,
    };
  }
  return out;
}

export async function getBannerSlots(): Promise<Record<BannerSection, BannerSlot>> {
  try {
    const rows = await getStore().query<{ v: string }>('SELECT v FROM app_settings WHERE k = ?', [SETTINGS_KEY]);
    return mergeBannerSlots(rows[0]?.v ?? null);
  } catch (e: any) {
    log.debug('BannerSlots', `settings read skipped: ${String(e?.message || e).slice(0, 60)}`);
    return mergeBannerSlots(null);
  }
}

/** Save a partial patch ({ rewards: { everyN: 9 } }) and return the full merged config. */
export async function saveBannerSlots(patch: unknown): Promise<Record<BannerSection, BannerSlot>> {
  const current = await getBannerSlots();
  const next = mergeBannerSlots({ ...current, ...(patch && typeof patch === 'object' ? patch : {}) });
  await getStore().execute(
    'INSERT INTO app_settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)',
    [SETTINGS_KEY, JSON.stringify(next)],
  );
  return next;
}

/** One section's slot config, always present even for an unknown id (falls back to home). */
export async function bannerSlotFor(section: string): Promise<BannerSlot> {
  const all = await getBannerSlots();
  return all[(BANNER_SECTIONS as string[]).includes(section) ? (section as BannerSection) : 'home'];
}
