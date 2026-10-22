/**
 * Merchant logo registry (owner 21 Oct): admin-uploaded brand logos that render on
 * every card where the scraped image/favicon would be a blurry or generic fallback.
 * Logos are stored as base64 data URLs in MySQL — shared hosting safe, no filesystem.
 * Keyed by the same merchantKeyOf() slug the deals registry uses.
 */
import { getStore } from '../common/db';
import { merchantKeyOf } from './deals';

export interface MerchantLogo { name_key: string; name: string; logo: string; updated_at: string; }

let ensured = false;
export async function ensureMerchantLogosTable(): Promise<void> {
  if (ensured) return;
  await getStore().execute(`CREATE TABLE IF NOT EXISTS merchant_logos (
    name_key VARCHAR(80) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    logo MEDIUMTEXT NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  ensured = true;
}

const DATA_URL_RE = /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/;

export function validateLogoPayload(p: { name?: unknown; logo?: unknown }): { ok: boolean; error?: string; clean?: { name_key: string; name: string; logo: string } } {
  const name = String(p.name || '').trim().slice(0, 120);
  const logo = String(p.logo || '').trim();
  if (!name) return { ok: false, error: 'Merchant name is required' };
  if (!logo || !DATA_URL_RE.test(logo)) return { ok: false, error: 'Logo must be a base64 PNG/JPEG/WebP data URL' };
  // ~400KB base64 cap ≈ 300KB image — plenty for a 256px brand logo
  if (logo.length > 400_000) return { ok: false, error: 'Logo too large (resize to ≤256px before upload)' };
  return { ok: true, clean: { name_key: merchantKeyOf(name).slice(0, 80) || 'brand', name, logo } };
}

export async function listMerchantLogos(): Promise<MerchantLogo[]> {
  await ensureMerchantLogosTable();
  return (await getStore().query('SELECT name_key, name, logo, updated_at FROM merchant_logos ORDER BY name')) as MerchantLogo[];
}

/** Fetch one logo by its name_key (serves GET /api/logos/:key). */
export async function getMerchantLogo(nameKey: string): Promise<MerchantLogo | null> {
  await ensureMerchantLogosTable();
  const rows = (await getStore().query('SELECT name_key, name, logo, updated_at FROM merchant_logos WHERE name_key = ? LIMIT 1', [
    String(nameKey || '').slice(0, 80),
  ])) as MerchantLogo[];
  return rows[0] || null;
}

/** Decode a stored data URL into { mime, bytes } for HTTP image serving. */
export function decodeLogoDataUrl(logo: string): { mime: string; bytes: Buffer } | null {
  const m = /^data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(String(logo || '').trim());
  if (!m) return null;
  try {
    return { mime: m[1] === 'jpg' ? 'jpeg' : m[1], bytes: Buffer.from(m[2], 'base64') };
  } catch { return null; }
}

/** Map of key -> data URL for the public endpoint (client caches it). */
export async function merchantLogoMap(): Promise<Record<string, string>> {
  const rows = await listMerchantLogos();
  const out: Record<string, string> = {};
  for (const r of rows) out[r.name_key] = r.logo;
  return out;
}

export async function upsertMerchantLogo(p: { name?: unknown; logo?: unknown }): Promise<{ ok: boolean; error?: string; name_key?: string }> {
  const v = validateLogoPayload(p);
  if (!v.ok || !v.clean) return v;
  await ensureMerchantLogosTable();
  await getStore().execute(
    'INSERT INTO merchant_logos (name_key, name, logo, updated_at) VALUES (?, ?, ?, UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE name=VALUES(name), logo=VALUES(logo), updated_at=UTC_TIMESTAMP()',
    [v.clean.name_key, v.clean.name, v.clean.logo]);
  return { ok: true, name_key: v.clean.name_key };
}

export async function deleteMerchantLogo(nameKey: string): Promise<void> {
  await ensureMerchantLogosTable();
  await getStore().execute('DELETE FROM merchant_logos WHERE name_key = ?', [String(nameKey || '').slice(0, 80)]);
}
