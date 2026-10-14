/**
 * Spend Lens — "which website did you spend how much on?"
 *
 * HONEST DATA POLICY: every entry is a purchase the USER confirmed (typed in,
 * or confirmed from a Buy-click redirect prefill). Nothing is inferred from
 * clicks, sessions or any other signal. If the user has no entries we show
 * an honest empty state, never a fabricated graph.
 */
import { getStore } from '../common/db';

export interface SpendEntry {
  id: number;
  merchant: string;
  amount: number;
  itemTitle?: string | null;
  vertical?: string | null;
  entryDate: string;          // YYYY-MM-DD
  source: string;             // 'manual' | 'redirect'
  createdAt?: string;
}

export interface SpendSummary {
  total: number;
  entries: number;
  byMerchant: { merchant: string; total: number; count: number }[];
  byMonth: { month: string; total: number }[];   // YYYY-MM, oldest first
}

const MERCHANT_RE = /^[a-z0-9 .&'-]{2,60}$/i;

export function validateEntry(i: Partial<SpendEntry> & { userId?: number }): { ok: boolean; error?: string } {
  if (!i.userId) return { ok: false, error: 'Sign in to use Spend Lens.' };
  if (!i.merchant || !MERCHANT_RE.test(String(i.merchant).trim())) return { ok: false, error: 'Enter the website or store name (letters, spaces, dots).' };
  const a = Math.round(Number(i.amount));
  if (!Number.isFinite(a) || a <= 0 || a > 100_000_000) return { ok: false, error: 'Enter a valid amount in rupees.' };
  if (!i.entryDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(i.entryDate))) return { ok: false, error: 'Pick the purchase date.' };
  const d = new Date(String(i.entryDate) + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return { ok: false, error: 'Pick the purchase date.' };
  if (d.getTime() > Date.now() + 86_400_000) return { ok: false, error: 'The purchase date cannot be in the future.' };
  return { ok: true };
}

export async function addSpendEntry(i: Partial<SpendEntry> & { userId: number }): Promise<{ ok: boolean; id?: number; error?: string }> {
  const v = validateEntry(i);
  if (!v.ok) return v;
  const store = getStore();
  const res: any = await store.execute(
    `INSERT INTO spend_entries (user_id, merchant, amount, item_title, vertical, entry_date, source, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [i.userId, String(i.merchant).trim().slice(0, 190), Math.round(Number(i.amount)),
     (i.itemTitle || '').slice(0, 300) || null, (i.vertical || '').slice(0, 40) || null,
     String(i.entryDate), i.source === 'redirect' ? 'redirect' : 'manual', 1],
  );
  const rows = await store.query<any>('SELECT id FROM spend_entries WHERE user_id = ? ORDER BY id DESC LIMIT 1', [i.userId]);
  return { ok: true, id: Number(res?.insertId ?? rows[0]?.id) };
}

const isActive = (r: any) => r.is_active === undefined || r.is_active === null || Number(r.is_active) === 1 || r.is_active === true;

export async function listSpendEntries(userId: number): Promise<SpendEntry[]> {
  const store = getStore();
  // FileStore gotcha: literal ints in WHERE don't filter — select by user_id and
  // filter is_active in JS (same pattern as priceAlerts.listAlerts).
  const rows = (await store.query<any>(
    'SELECT id, merchant, amount, item_title, vertical, entry_date, source, is_active, created_at FROM spend_entries WHERE user_id = ?',
    [userId],
  )).filter(isActive);
  rows.sort((a, b) => String(b.entry_date).localeCompare(String(a.entry_date)) || Number(b.id) - Number(a.id));
  return rows.map((r) => ({
    id: Number(r.id),
    merchant: String(r.merchant),
    amount: Number(r.amount),
    itemTitle: r.item_title ?? null,
    vertical: r.vertical ?? null,
    entryDate: String(r.entry_date).slice(0, 10),
    source: String(r.source || 'manual'),
    createdAt: r.created_at ? String(r.created_at) : undefined,
  }));
}

export async function deleteSpendEntry(userId: number, id: number): Promise<boolean> {
  const store = getStore();
  // FileStore gotcha: literal values in UPDATE break param mapping — bind via ?.
  const mine = await store.query<any>('SELECT id FROM spend_entries WHERE user_id = ?', [userId]);
  if (!mine.some((r) => Number(r.id) === Number(id))) return false;
  await store.execute('UPDATE spend_entries SET is_active = ? WHERE id = ?', [0, Number(id)]);
  return true;
}

/** Pure aggregation (unit-tested): entries -> totals, per-merchant bars, monthly trend. */
export function summarizeSpend(entries: SpendEntry[]): SpendSummary {
  const total = entries.reduce((s, e) => s + e.amount, 0);
  const merchantMap = new Map<string, { merchant: string; total: number; count: number }>();
  const monthMap = new Map<string, number>();
  for (const e of entries) {
    const key = e.merchant.trim();
    const cur = merchantMap.get(key) || { merchant: key, total: 0, count: 0 };
    cur.total += e.amount;
    cur.count += 1;
    merchantMap.set(key, cur);
    const month = e.entryDate.slice(0, 7); // YYYY-MM
    monthMap.set(month, (monthMap.get(month) || 0) + e.amount);
  }
  const byMerchant = [...merchantMap.values()].sort((a, b) => b.total - a.total);
  const byMonth = [...monthMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12) // last 12 months of activity
    .map(([month, tot]) => ({ month, total: tot }));
  return { total, entries: entries.length, byMerchant, byMonth };
}

export async function spendSummary(userId: number): Promise<{ entries: SpendEntry[]; summary: SpendSummary }> {
  const entries = await listSpendEntries(userId);
  return { entries, summary: summarizeSpend(entries) };
}
