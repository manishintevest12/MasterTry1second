/** Loans & insurance publish an interest RATE (% p.a.), every other vertical a rupee amount. */
export const isRateVertical = (vertical?: string): boolean => vertical === 'loans' || vertical === 'insurance';

export function formatPrice(vertical: string | undefined, value: number | undefined | null): string {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const n = Number(value);
  return isRateVertical(vertical) ? `${Math.round(n * 100) / 100}%` : `₹${n.toLocaleString('en-IN')}`;
}
