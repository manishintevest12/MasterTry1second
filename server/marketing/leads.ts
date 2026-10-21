/**
 * Lead capture (owner 21 Oct): real server-side persistence for finance-vertical
 * enquiries (Loans, Insurance, Credit Cards, Accounts) and partner inquiries.
 * Replaces the old client-state-only flow that never reached admin/merchant.
 * No fabrication: only what the user actually submitted is stored.
 */
import { getStore } from '../common/db';

export type LeadSource = 'lead_form' | 'partner_inquiry' | 'cpl';
export type LeadVertical = 'loans' | 'insurance' | 'creditcards' | 'account';

export interface LeadRow {
  id: number; source: string; vertical: string | null; service_type: string | null;
  account_type: string | null; first_name: string; last_name: string; age: number | null;
  salary: number | null; location: string | null; phone: string | null; email: string | null;
  business: string | null; website: string | null; category: string | null; message: string | null;
  dest_url: string | null; status: string; created_at: string;
}

let ensured = false;
export async function ensureLeadsTable(): Promise<void> {
  if (ensured) return;
  await getStore().execute(`CREATE TABLE IF NOT EXISTS leads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    source VARCHAR(30) NOT NULL DEFAULT 'lead_form',
    vertical VARCHAR(20) NULL,
    service_type VARCHAR(160) NULL,
    account_type VARCHAR(20) NULL,
    first_name VARCHAR(80) NOT NULL,
    last_name VARCHAR(80) NOT NULL,
    age INT NULL,
    salary DECIMAL(14,2) NULL,
    location VARCHAR(120) NULL,
    phone VARCHAR(20) NULL,
    email VARCHAR(160) NULL,
    business VARCHAR(160) NULL,
    website VARCHAR(200) NULL,
    category VARCHAR(60) NULL,
    message VARCHAR(1000) NULL,
    dest_url VARCHAR(600) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'new',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  ensured = true;
}

const VERTICALS: LeadVertical[] = ['loans', 'insurance', 'creditcards', 'account'];

export interface LeadInput {
  source?: LeadSource;
  vertical?: string; serviceType?: string; accountType?: string;
  firstName?: string; lastName?: string; age?: number; salary?: number; location?: string;
  phone?: string; email?: string; business?: string; website?: string; category?: string; message?: string;
  destUrl?: string;
}

const str = (v: unknown, max: number): string | null => {
  const s = String(v ?? '').trim();
  return s ? s.slice(0, max) : null;
};

export function validateLead(i: LeadInput): { ok: boolean; error?: string; clean?: LeadInput } {
  const firstName = str(i.firstName, 80);
  const lastName = str(i.lastName, 80);
  const source: LeadSource = (['lead_form', 'partner_inquiry', 'cpl'] as const).includes(i.source as LeadSource) ? (i.source as LeadSource) : 'lead_form';
  if (source === 'partner_inquiry') {
    // Partner-inquiry: business + a contact route are mandatory.
    if (!str(i.business, 160)) return { ok: false, error: 'Business name is required' };
    if (!str(i.email, 160) && !str(i.phone, 20)) return { ok: false, error: 'Email or phone is required' };
  } else {
    if (!firstName) return { ok: false, error: 'First name is required' };
    if (!lastName) return { ok: false, error: 'Last name is required' };
    const age = Number(i.age);
    if (!Number.isFinite(age) || age < 18 || age > 100) return { ok: false, error: 'Age must be between 18 and 100' };
    // Salary is optional (a user may skip it) but must be zero-or-more when given.
    if (i.salary !== undefined && i.salary !== null && String(i.salary).trim() !== '') {
      const salary = Number(i.salary);
      if (!Number.isFinite(salary) || salary < 0) return { ok: false, error: 'Salary must be zero or more' };
    }
    if (!str(i.location, 120)) return { ok: false, error: 'Location is required' };
    // Owner 21 Oct: ALL form fields are mandatory. Phone is required but only
    // FORMAT-checked (10-digit Indian mobile) — explicit owner decision: NO OTP
    // / verification step. Email is required and format-checked.
    let digits = String(i.phone || '').replace(/\D/g, '');
    if (!digits) return { ok: false, error: 'Mobile number is required' };
    if (/^(91|0)/.test(digits) && digits.length === 12 || /^0/.test(digits) && digits.length === 11) digits = digits.replace(/^(91|0)/, '');
    if (!/^[6-9]\d{9}$/.test(digits))
      return { ok: false, error: 'Enter a valid 10-digit Indian mobile number' };
    const email = str(i.email, 160);
    if (!email) return { ok: false, error: 'Email is required' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Enter a valid email address' };
    if (i.vertical && !VERTICALS.includes(i.vertical as LeadVertical)) return { ok: false, error: 'Unsupported vertical' };
    if (i.accountType && !['savings', 'current', 'demat'].includes(String(i.accountType))) return { ok: false, error: 'Account type must be savings, current or demat' };
  }
  return { ok: true, clean: { ...i, firstName: firstName || undefined, lastName: lastName || undefined } };
}

export async function saveLead(i: LeadInput): Promise<number> {
  await ensureLeadsTable();
  const v = validateLead(i);
  if (!v.ok || !v.clean) throw new Error(v.error || 'Invalid lead');
  const c = v.clean;
  const result = await getStore().execute(
    `INSERT INTO leads (source, vertical, service_type, account_type, first_name, last_name, age, salary, location, phone, email, business, website, category, message, dest_url, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
    [c.source || 'lead_form', str(c.vertical, 20), str(c.serviceType, 160), str(c.accountType, 20),
     str(c.firstName, 80), str(c.lastName, 80), c.age ?? null, c.salary ?? null, str(c.location, 120),
     str(c.phone, 20), str(c.email, 160), str(c.business, 160), str(c.website, 200), str(c.category, 60),
     str(c.message, 1000), str(c.destUrl, 600)]);
  // insertId comes from the SAME execute() (its pool connection) — a separate
  // SELECT LAST_INSERT_ID() could land on a different pooled connection and read 0.
  const r: any = result as any;
  return Number(r?.insertId ?? 0) || 0;
}

export async function listLeads(opts: { source?: string; vertical?: string; status?: string; limit?: number } = {}): Promise<LeadRow[]> {
  await ensureLeadsTable();
  const limit = Math.min(Math.max(Number(opts.limit) || 500, 1), 1000);
  const where: string[] = [];
  const args: any[] = [];
  if (opts.source) { where.push('source = ?'); args.push(opts.source); }
  if (opts.vertical) { where.push('vertical = ?'); args.push(opts.vertical); }
  if (opts.status) { where.push('status = ?'); args.push(opts.status); }
  const sql = `SELECT * FROM leads ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC, id DESC LIMIT ${limit}`;
  return (await getStore().query(sql, args)) as LeadRow[];
}

export async function getLead(id: number): Promise<LeadRow | null> {
  await ensureLeadsTable();
  const rows = await getStore().query<LeadRow>('SELECT * FROM leads WHERE id = ? LIMIT 1', [id]);
  return rows?.[0] || null;
}

export async function updateLeadStatus(id: number, status: string): Promise<void> {
  await ensureLeadsTable();
  const s = ['new', 'contacted', 'converted', 'closed'].includes(status) ? status : 'new';
  await getStore().execute('UPDATE leads SET status = ? WHERE id = ?', [s, Number(id) || 0]);
}
