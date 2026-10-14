/**
 * Admin-managed affiliate profiles (table affiliate_configs). One profile per company:
 * the owner stores the network + tracking-link template (with the account's own IDs) ONCE, and
 * buildSecureDeeplink() applies it server-side on every click through /api/out. Customers and
 * the browser never see an affiliate ID.
 *
 * Template placeholders: {url} encoded destination, {url2} double-encoded, {subid}, {campaign}, {click}.
 */
import { getStore } from '../common/db';

export const AFFILIATE_NETWORKS = ['cuelinks', 'vcommission', 'admitad', 'optimise', 'direct'] as const;

export interface ProfileInput {
  id?: number; slug: string; company_domain: string; network: string; campaign_key?: string | null;
  template: string; subid_param?: string | null; active?: boolean;
}

export function validateProfile(i: ProfileInput): { ok: boolean; error?: string; clean?: any } {
  const slug = String(i.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 64);
  const domain = String(i.company_domain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
  const network = String(i.network || '').trim().toLowerCase();
  const template = String(i.template || '').trim();
  if (!slug) return { ok: false, error: 'Company slug is required (e.g. flipkart)' };
  if (!domain || !domain.includes('.')) return { ok: false, error: 'Company domain is required (e.g. flipkart.com)' };
  if (!(AFFILIATE_NETWORKS as readonly string[]).includes(network)) return { ok: false, error: 'Unknown network' };
  if (!template.includes('{url}') && !template.includes('{url2}')) return { ok: false, error: 'Template must contain {url} (or {url2}) where the merchant page goes' };
  let probe: URL;
  try { probe = new URL(template.replace(/\{[a-z0-9_]+\}/gi, 'x')); } catch { return { ok: false, error: 'Template must be a full https:// tracking link' }; }
  if (probe.protocol !== 'https:') return { ok: false, error: 'Template must start with https://' };
  if (template.length > 500) return { ok: false, error: 'Template is too long (max 500)' };
  return {
    ok: true,
    clean: {
      slug, company_domain: domain, network, template,
      campaign_key: String(i.campaign_key ?? '').trim().slice(0, 160) || null,
      subid_param: String(i.subid_param ?? 'subid').trim().replace(/[^a-z0-9_]/gi, '').slice(0, 40) || 'subid',
      active: i.active === false ? 0 : 1,
    },
  };
}

export async function listProfiles(): Promise<any[]> {
  return getStore().query<any>('SELECT id, slug, company_domain, network, campaign_key, template, subid_param, active FROM affiliate_configs ORDER BY slug ASC LIMIT 300').catch(() => []);
}

export async function saveProfile(i: ProfileInput): Promise<{ ok: boolean; error?: string }> {
  const v = validateProfile(i);
  if (!v.ok) return { ok: false, error: v.error };
  const c = v.clean; const store = getStore();
  const ex = await store.query<any>('SELECT id FROM affiliate_configs WHERE slug = ?', [c.slug]);
  if (ex.length) {
    await store.execute('UPDATE affiliate_configs SET company_domain=?, network=?, campaign_key=?, template=?, subid_param=?, active=? WHERE slug=?',
      [c.company_domain, c.network, c.campaign_key, c.template, c.subid_param, c.active, c.slug]);
  } else {
    await store.execute('INSERT INTO affiliate_configs (slug, company_domain, network, campaign_key, template, subid_param, active) VALUES (?,?,?,?,?,?,?)',
      [c.slug, c.company_domain, c.network, c.campaign_key, c.template, c.subid_param, c.active]);
  }
  return { ok: true };
}

export async function deleteProfile(slug: string): Promise<void> {
  await getStore().execute('DELETE FROM affiliate_configs WHERE slug = ?', [String(slug || '').trim().toLowerCase()]);
}
