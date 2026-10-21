/**
 * Approved partner directory (owner 21 Oct): a partner inquiry the owner
 * APPROVES from Admin > Leads becomes a live entry here, surfaced in the
 * public Direct Partner Directory via GET /api/partners. MySQL is the source
 * of truth; nothing is client-only.
 */
import { getStore } from '../common/db';

export interface ApprovedPartner {
  id: number;
  name: string;
  websiteUrl: string;
  category: string;
  email: string | null;
  phone: string | null;
  badge: string;
  status: string;
  sourceLeadId: number | null;
  createdAt: string;
}

let ensured = false;

export async function ensurePartnersTable(): Promise<void> {
  if (ensured) return;
  await getStore().execute(`CREATE TABLE IF NOT EXISTS approved_partners (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    website_url VARCHAR(300) NOT NULL,
    category VARCHAR(30) NOT NULL DEFAULT 'retail',
    email VARCHAR(160) NULL,
    phone VARCHAR(30) NULL,
    badge VARCHAR(40) NOT NULL DEFAULT 'Verified Partner',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    source_lead_id INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_website (website_url)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  ensured = true;
}

/** Free-text inquiry category -> directory bucket. */
export function bucketCategory(raw: string): 'travel' | 'retail' | 'food' | 'finance' | 'cabs' {
  const c = (raw || '').toLowerCase();
  if (/(travel|hotel|flight|bus|train|holiday|tour)/.test(c)) return 'travel';
  if (/(food|restaurant|delivery|kitchen|catering|bakery)/.test(c)) return 'food';
  if (/(cab|taxi|ride|bike|auto|transport|logistic)/.test(c)) return 'cabs';
  if (/(bank|loan|insur|credit|card|finance|invest|demat|account|payment)/.test(c)) return 'finance';
  return 'retail';
}

function rowToPartner(r: any): ApprovedPartner {
  return {
    id: Number(r.id),
    name: String(r.name || ''),
    websiteUrl: String(r.website_url || ''),
    category: String(r.category || 'retail'),
    email: r.email ? String(r.email) : null,
    phone: r.phone ? String(r.phone) : null,
    badge: String(r.badge || 'Verified Partner'),
    status: String(r.status || 'active'),
    sourceLeadId: r.source_lead_id ? Number(r.source_lead_id) : null,
    createdAt: String(r.created_at || ''),
  };
}

/** Approve a partner inquiry lead into the directory (idempotent by website). */
export async function approvePartnerFromLead(lead: {
  business: string | null; website: string | null; category: string | null;
  email: string | null; phone: string | null; leadId: number;
}): Promise<{ ok: true; partner: ApprovedPartner } | { ok: false; error: string }> {
  await ensurePartnersTable();
  const name = String(lead.business || '').trim().slice(0, 160);
  let website = String(lead.website || '').trim().slice(0, 300);
  if (!name) return { ok: false, error: 'Inquiry has no business name' };
  if (!website) return { ok: false, error: 'Inquiry has no website to link' };
  if (!/^https?:\/\//i.test(website)) website = `https://${website}`;
  const category = bucketCategory(String(lead.category || ''));
  const store = getStore();
  const existing = await store.query<any>('SELECT * FROM approved_partners WHERE website_url = ? LIMIT 1', [website]);
  if (existing?.length) {
    await store.execute('UPDATE approved_partners SET status = ? WHERE id = ?', ['active', existing[0].id]);
    return { ok: true, partner: rowToPartner({ ...existing[0], status: 'active' }) };
  }
  const ins = await store.execute(
    `INSERT INTO approved_partners (name, website_url, category, email, phone, badge, status, source_lead_id)
     VALUES (?, ?, ?, ?, ?, 'Verified Partner', 'active', ?)`,
    [name, website, category, lead.email || null, lead.phone || null, lead.leadId],
  );
  // Same-connection insertId (pool-safe); LAST_INSERT_ID() in a separate query can
  // run on a different pooled connection and return 0.
  const id = Number((ins as any)?.insertId ?? 0);
  const rows = id ? await store.query<any>('SELECT * FROM approved_partners WHERE id = ?', [id]) : [];
  return { ok: true, partner: rowToPartner(rows?.[0] || { id }) };
}

/** Public directory: active partners only. */
export async function listPartners(activeOnly = true): Promise<ApprovedPartner[]> {
  await ensurePartnersTable();
  const rows = await getStore().query<any>(
    `SELECT * FROM approved_partners ${activeOnly ? 'WHERE status = \'active\'' : ''} ORDER BY created_at DESC LIMIT 500`,
  );
  return (rows || []).map(rowToPartner);
}

export async function updatePartnerStatus(id: number, status: 'active' | 'paused'): Promise<boolean> {
  await ensurePartnersTable();
  await getStore().execute('UPDATE approved_partners SET status = ? WHERE id = ?', [status, id]);
  return true;
}
