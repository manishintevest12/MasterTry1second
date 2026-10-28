/**
 * Admin-managed marketing placements (Top Picks + Ad slots).
 * Everything shown on the frontend comes from these tables — there are no
 * hardcoded demo picks or fake ads in the UI (Section 6: no fabricated data).
 * - Top Picks appear only when an admin has created them, for the matching vertical.
 * - Ad slots render AdSense only when the publisher id + slot are configured.
 * - Destinations are validated (SSRF/open-redirect safe) before saving.
 */
import { getStore } from '../common/db';
import { purgeSectionCache } from '../api/cachedSections';
import { validateDestination } from '../affiliate/affiliateNetwork';

export interface TopPickInput {
  id?: number;
  vertical: string;
  partner_name: string;
  partner_code?: string | null;
  badge_text?: string;
  headline: string;
  offer_text?: string | null;
  price_badge?: string | null;
  perks?: string[];
  cta_text?: string;
  destination_url: string;
  image_url?: string | null;
  logo_bg?: string;
  logo_text?: string | null;
  rating?: number;
  position?: number;
  is_active?: boolean;
}

export interface AdSlotInput {
  slot_key: string;
  provider: 'adsense' | 'custom_html';
  adsense_client?: string | null;
  adsense_slot?: string | null;
  custom_html?: string | null;
  is_active?: boolean;
}

const vert = (v: unknown): string => String(v ?? '').trim().toLowerCase();
const str = (v: unknown, max: number): string | null => {
  const s = String(v ?? '').trim();
  return s ? s.slice(0, max) : null;
};

export async function listTopPicks(vertical?: string, includeInactive = false): Promise<any[]> {
  const store = getStore();
  const params: any[] = [];
  let where = '';
  if (!includeInactive) { where += ' WHERE is_active = 1'; }
  if (vertical) {
    where += where ? ' AND vertical = ?' : ' WHERE vertical = ?';
    params.push(vert(vertical));
  }
  const rows = await store.query<any>(
    `SELECT * FROM top_picks${where} ORDER BY position ASC, id ASC LIMIT 50`, params,
  );
  return rows.map((r) => ({ ...r, perks: safeParse(r.perks) }));
}

function safeParse(v: unknown): string[] {
  try { const a = JSON.parse(String(v || '[]')); return Array.isArray(a) ? a.map(String) : []; }
  catch { return []; }
}

export async function upsertTopPick(input: TopPickInput): Promise<{ ok: boolean; id?: number; error?: string }> {
  const vertical = vert(input.vertical);
  const partner_name = str(input.partner_name, 120);
  const headline = str(input.headline, 200);
  const destination = str(input.destination_url, 500);
  if (!partner_name) return { ok: false, error: 'Partner name is required' };
  if (!headline) return { ok: false, error: 'Headline is required' };
  if (!destination) return { ok: false, error: 'Destination URL is required' };
  // Sponsored placements are authored in the admin dashboard (trusted provenance), and
  // partner click links legitimately bridge with `url=<merchant>`.
  const check = validateDestination(destination, { allowEmbeddedRedirect: true });
  if (!check.valid) return { ok: false, error: `Destination rejected: ${check.reason}` };
  const rating = Math.max(0, Math.min(5, Number(input.rating ?? 0)));
  const store = getStore();
  const perks = JSON.stringify((input.perks || []).map((p) => String(p).slice(0, 120)).slice(0, 6));
  const values = [
    vertical, partner_name, str(input.partner_code, 16), str(input.badge_text, 60) || 'Sponsored Top Pick',
    headline, str(input.offer_text, 400), str(input.price_badge, 60), perks,
    str(input.cta_text, 80) || 'View Deal', destination, str(input.image_url, 500),
    str(input.logo_bg, 40) || 'bg-slate-900', str(input.logo_text, 8),
    rating, Number(input.position ?? 0) || 0, input.is_active === false ? 0 : 1,
  ];
  if (input.id) {
    await store.execute(
      `UPDATE top_picks SET vertical=?, partner_name=?, partner_code=?, badge_text=?, headline=?, offer_text=?,
       price_badge=?, perks=?, cta_text=?, destination_url=?, image_url=?, logo_bg=?, logo_text=?,
       rating=?, position=?, is_active=? WHERE id=?`, [...values, input.id],
    );
    purgeSectionCache('rewards:'); // top-pick edit live on next request
    return { ok: true, id: input.id };
  }
  const result: any = await store.execute(
    `INSERT INTO top_picks (vertical, partner_name, partner_code, badge_text, headline, offer_text,
     price_badge, perks, cta_text, destination_url, image_url, logo_bg, logo_text, rating, position, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, values,
  );
  purgeSectionCache('rewards:'); // top-pick edit live on next request
  return { ok: true, id: Number(result?.insertId ?? 0) };
}

export async function deleteTopPick(id: number): Promise<void> {
  await getStore().execute('DELETE FROM top_picks WHERE id = ?', [Number(id)]);
  purgeSectionCache('rewards:'); // top-pick removal live on next request
}

export async function getAdSlot(slotKey: string): Promise<any | null> {
  const rows = await getStore().query<any>(
    'SELECT slot_key, provider, adsense_client, adsense_slot, custom_html FROM ad_slots WHERE slot_key = ? AND is_active = 1',
    [vert(slotKey)],
  );
  return rows[rows.length - 1] || null;
}

export async function listAdSlots(): Promise<any[]> {
  return getStore().query<any>(
    'SELECT * FROM ad_slots ORDER BY slot_key ASC LIMIT 50',
  );
}

export async function upsertAdSlot(input: AdSlotInput): Promise<{ ok: boolean; error?: string }> {
  const slot_key = vert(input.slot_key);
  if (!/^[a-z0-9_-]{2,60}$/.test(slot_key)) return { ok: false, error: 'Slot key must be 2-60 chars (a-z, 0-9, -, _)' };
  if (input.provider === 'adsense') {
    const client = str(input.adsense_client, 60);
    const slot = str(input.adsense_slot, 60);
    if (!/^ca-pub-[0-9]{10,}$/.test(client || '')) return { ok: false, error: 'AdSense client must look like ca-pub-XXXXXXXXXXXXXXXX' };
    if (!/^[0-9]{6,20}$/.test(slot || '')) return { ok: false, error: 'AdSense slot id must be numeric' };
    const store = getStore();
    const existing = await store.query<any>('SELECT id FROM ad_slots WHERE slot_key = ?', [slot_key]);
    if (existing.length) {
      await store.execute(
        'UPDATE ad_slots SET provider=?, adsense_client=?, adsense_slot=?, custom_html=NULL, is_active=? WHERE slot_key=?',
        ['adsense', client, slot, input.is_active === false ? 0 : 1, slot_key],
      );
    } else {
      await store.execute(
        'INSERT INTO ad_slots (slot_key, provider, adsense_client, adsense_slot, is_active) VALUES (?, ?, ?, ?, ?)',
        [slot_key, 'adsense', client, slot, input.is_active === false ? 0 : 1],
      );
    }
    return { ok: true };
  }
  // custom_html provider: admin-authored HTML is stored verbatim (admin-only input)
  const html = String(input.custom_html || '').slice(0, 8000);
  if (!html.trim()) return { ok: false, error: 'Custom HTML is required for the custom_html provider' };
  const store = getStore();
  const existing = await store.query<any>('SELECT id FROM ad_slots WHERE slot_key = ?', [slot_key]);
  if (existing.length) {
    await store.execute(
      'UPDATE ad_slots SET provider=?, custom_html=?, adsense_client=NULL, adsense_slot=NULL, is_active=? WHERE slot_key=?',
      ['custom_html', html, input.is_active === false ? 0 : 1, slot_key],
    );
  } else {
    await store.execute(
      'INSERT INTO ad_slots (slot_key, provider, custom_html, is_active) VALUES (?, ?, ?, ?)',
      [slot_key, 'custom_html', html, input.is_active === false ? 0 : 1],
    );
  }
  return { ok: true };
}
