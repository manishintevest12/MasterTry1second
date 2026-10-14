/**
 * Admin-managed app download links (Chrome extension, Android app, iOS app).
 * The website footer and the Flutter app read these from GET /api/app-links.
 * A link is exposed only when an admin saved a valid https URL and left it
 * active; otherwise the UI shows nothing / "Coming soon" (never a fake link).
 */
import { getStore } from '../common/db';

export const APP_LINK_KEYS = ['chrome_extension', 'android_app', 'ios_app'] as const;
export type AppLinkKey = (typeof APP_LINK_KEYS)[number];

export interface AppLinkInput {
  link_key: string;
  url: string;
  version?: string | null;
  is_active?: boolean;
}

/** https only, no credentials, sane length — links are rendered as <a href> on the public site. */
export function validateAppLinkUrl(raw: string): { ok: boolean; url?: string; error?: string } {
  const s = String(raw || '').trim();
  if (!s) return { ok: false, error: 'URL is required' };
  if (s.length > 500) return { ok: false, error: 'URL is too long (max 500 characters)' };
  let u: URL;
  try { u = new URL(s); } catch { return { ok: false, error: 'Enter a full URL starting with https://' }; }
  if (u.protocol !== 'https:') return { ok: false, error: 'Only https:// links are allowed' };
  if (u.username || u.password) return { ok: false, error: 'URL must not contain credentials' };
  if (!u.hostname.includes('.')) return { ok: false, error: 'URL host looks invalid' };
  return { ok: true, url: u.toString() };
}

export async function listAppLinks(includeInactive = false): Promise<any[]> {
  const rows = await getStore().query<any>(
    'SELECT link_key, url, version, is_active, updated_at FROM app_links ORDER BY link_key ASC LIMIT 20',
  );
  // Filter in code (not SQL) so MySQL and the dev file-store behave identically.
  return includeInactive ? rows : rows.filter((r) => Number(r.is_active) === 1 || r.is_active === true);
}

/** Public shape: { chrome_extension: {url, version} | null, android_app: ..., ios_app: ... } */
export async function getPublicAppLinks(): Promise<Record<AppLinkKey, { url: string; version: string | null } | null>> {
  const out: any = { chrome_extension: null, android_app: null, ios_app: null };
  try {
    for (const r of await listAppLinks(false)) {
      if ((APP_LINK_KEYS as readonly string[]).includes(r.link_key)) out[r.link_key] = { url: r.url, version: r.version || null };
    }
  } catch { /* store unavailable -> nothing configured */ }
  return out;
}

export async function upsertAppLink(input: AppLinkInput): Promise<{ ok: boolean; error?: string }> {
  const key = String(input.link_key || '').trim().toLowerCase();
  if (!(APP_LINK_KEYS as readonly string[]).includes(key)) return { ok: false, error: 'Unknown link key' };
  const v = validateAppLinkUrl(input.url);
  if (!v.ok) return { ok: false, error: v.error };
  const version = String(input.version ?? '').trim().slice(0, 30) || null;
  const active = input.is_active === false ? 0 : 1;
  const store = getStore();
  const existing = await store.query<any>('SELECT id FROM app_links WHERE link_key = ?', [key]);
  if (existing.length) {
    await store.execute('UPDATE app_links SET url=?, version=?, is_active=? WHERE link_key=?', [v.url, version, active, key]);
  } else {
    await store.execute('INSERT INTO app_links (link_key, url, version, is_active) VALUES (?, ?, ?, ?)', [key, v.url, version, active]);
  }
  return { ok: true };
}

export async function deleteAppLink(key: string): Promise<void> {
  await getStore().execute('DELETE FROM app_links WHERE link_key = ?', [String(key || '').trim().toLowerCase()]);
}
