/**
 * ACCOUNT TYPE GATE (owner 9 Nov: "account verticals ka filters v check kiya tha? jaise account type
 * savings, current, demat kyunki inn pr click krne ke baad uss se related hi data aana chaiye tha").
 *
 * MEASURED on production before this file existed:
 *   POST /api/search account "savings account" -> 40 rows, all Savings
 *   POST /api/search account "current account" -> 40 rows, all Current
 *   POST /api/search account "demat account"   -> 15 rows, of which 12 were SAVINGS rows (Zerodha Demat
 *                                                 first, then Bank of India/Baroda/Union savings)
 * So the type was only a text hint to the sources; when the demat catalogue was thin the tail filled
 * with whatever the banking catalogue had. A filter pill must scope the feed, not decorate it.
 */
export type AccountKind = 'savings' | 'current' | 'demat' | '';

/** Which account type the user actually asked for (empty = they asked for "bank accounts" in general). */
export function requestedAccountKind(rawQuery: string): AccountKind {
  const q = String(rawQuery || '').toLowerCase();
  if (/\bdemat\b|d\.?mat\b|\btrading\b|\bbroking\b|share (?:market|khaata)|stock (?:market|account)/.test(q)) return 'demat';
  if (/\bcurrent\b/.test(q)) return 'current';
  if (/\bsavings?\b|\bsaving account\b|\bsalary\b/.test(q)) return 'savings';
  return '';
}

/** Classify one row by what it names. Unknown rows are '' and are dropped while a type is requested. */
export function rowAccountKind(row: any): AccountKind {
  const bags = [
    row?.title, row?.subtitle, row?.category, row?.provider, row?.description,
    ...(Array.isArray(row?.features) ? row.features : []),
    ...Object.values(row?.specs || {}),
  ];
  const text = bags.filter(Boolean).join(' ').toLowerCase();
  if (/\bdemat\b|d\.?mat\b|\btrading account\b|\bbroking account\b/.test(text)) return 'demat';
  if (/\bcurrent account\b/.test(text)) return 'current';
  if (/\bsavings? account\b|\bsavings?\b|\bsalary account\b/.test(text)) return 'savings';
  return '';
}

export function enforceAccountKind(
  rows: any[],
  kind: AccountKind,
): { kept: any[]; dropped: number; droppedKinds: Record<string, number> } {
  if (!kind || !Array.isArray(rows) || !rows.length) return { kept: rows || [], dropped: 0, droppedKinds: {} };
  const kept: any[] = [];
  const droppedKinds: Record<string, number> = {};
  for (const row of rows) {
    const k = rowAccountKind(row) || 'unclassified';
    if (k === kind) kept.push(row);
    else droppedKinds[k] = (droppedKinds[k] || 0) + 1;
  }
  return { kept, dropped: rows.length - kept.length, droppedKinds };
}
