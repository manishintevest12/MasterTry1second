import test from 'node:test';
import assert from 'node:assert/strict';
import { moneyToMicros, countOf, parseAdsenseDate, parseAdsenseCsv, summarize, _resetAdsenseCircuit, adsenseApiConfig, adsenseApiCircuit } from '../server/marketing/adsenseRevenue';

// Owner 27 Oct: "admin mai ek section ye v bnao ki adsence se hume kitna revenue aaya hai"
// Numbers must be the owner's REAL AdSense earnings, never mock data.

test('currency text becomes exact integer micros (no float drift)', () => {
  assert.equal(moneyToMicros('₹1,234.56'), 1_234_560_000);
  assert.equal(moneyToMicros('INR 0.01'), 10_000);
  assert.equal(moneyToMicros('12'), 12_000_000);
  assert.equal(moneyToMicros('₹0.0000001'), 0);
  assert.equal(moneyToMicros(''), 0);
  assert.equal(moneyToMicros('abc'), 0);
  assert.equal(moneyToMicros('2,000.5'), 2_000_500_000);
});

test('counts survive thousands separators and stray text', () => {
  assert.equal(countOf('1,240'), 1240);
  assert.equal(countOf('1 240'), 1240);
  assert.equal(countOf('—'), 0);
});

test('AdSense report dates parse in every format Google exports', () => {
  assert.equal(parseAdsenseDate('2026-10-01'), '2026-10-01');
  assert.equal(parseAdsenseDate('2026/10/01'), '2026-10-01');
  assert.equal(parseAdsenseDate('10/1/2026'), '2026-10-01');   // Google UI default MM/DD/YYYY
  assert.equal(parseAdsenseDate('1 Oct 2026'), '2026-10-01');
  assert.equal(parseAdsenseDate('Oct 1, 2026'), '2026-10-01');
  assert.equal(parseAdsenseDate('Total'), null);
  assert.equal(parseAdsenseDate(''), null);
});

test('a real AdSense CSV export imports every day with the right money', () => {
  const csv = `Date,Page views,Impressions,Clicks,Page RPM (INR),Estimated earnings (INR)
2026-10-01,"1,240","2,100",14,"12.40","15.38"
2026-10-02,"980","1,600",9,"11.10","10.88"
Total,"2,220","3,700",23,,`;
  const out = parseAdsenseCsv(csv);
  assert.equal(out.error, undefined);
  assert.equal(out.rows.length, 2, 'the Total footer line must not become a day');
  assert.equal(out.rows[0].day, '2026-10-01');
  assert.equal(out.rows[0].earnings_micros, 15_380_000);
  assert.equal(out.rows[0].page_views, 1240);
  assert.equal(out.rows[0].impressions, 2100);
  assert.equal(out.rows[0].clicks, 14);
  assert.equal(out.rows[0].source, 'adsense_csv');
  assert.equal(out.skipped, 1);
});

test('tab-separated paste and toggled "Show currency code" both work', () => {
  const tsv = 'Date\tPage views\tEstimated earnings\tCurrency code\n2026-10-03\t500\t9.5\tINR';
  const out = parseAdsenseCsv(tsv);
  assert.equal(out.rows.length, 1);
  assert.equal(out.rows[0].earnings_micros, 9_500_000);
  assert.equal(out.rows[0].currency, 'INR');
});

test('a file without the required columns fails loudly, never silently zero', () => {
  const out = parseAdsenseCsv('Country,Impressions\nIndia,100');
  assert.ok(out.error);
  assert.match(String(out.error), /Date|Estimated earnings/);
  assert.equal(out.rows.length, 0);
});

test('duplicate days in one file are merged, not double counted as separate rows', () => {
  const csv = 'Date,Estimated earnings\n2026-10-01,10.00\n2026-10-01,5.00';
  const out = parseAdsenseCsv(csv);
  assert.equal(out.rows.length, 1);
  assert.equal(out.rows[0].earnings_micros, 15_000_000);
});

test('summary windows (today/7/30/month/lifetime) and real RPM are computed from the rows', () => {
  const rows = [
    { day: '2026-10-27', source: 'adsense_csv' as const, currency: 'INR', earnings_micros: 100_000_000, impressions: 1000, clicks: 10, page_views: 500, rpm_micros: 0 },
    { day: '2026-10-26', source: 'adsense_csv' as const, currency: 'INR', earnings_micros: 50_000_000, impressions: 800, clicks: 8, page_views: 400, rpm_micros: 0 },
    { day: '2026-10-20', source: 'adsense_csv' as const, currency: 'INR', earnings_micros: 25_000_000, impressions: 500, clicks: 5, page_views: 200, rpm_micros: 0 },
    { day: '2026-09-15', source: 'adsense_csv' as const, currency: 'INR', earnings_micros: 40_000_000, impressions: 600, clicks: 6, page_views: 300, rpm_micros: 0 },
  ];
  const s = summarize(rows, '2026-10-27');
  assert.equal(s.today, 100_000_000);
  assert.equal(s.yesterday, 50_000_000);
  assert.equal(s.last7, 150_000_000);   // 27, 26 — 20 Oct sits outside the rolling 7-day window
  assert.equal(s.thisMonth, 175_000_000);
  assert.equal(s.prevMonth, 40_000_000);
  assert.equal(s.lifetime, 215_000_000);
  assert.equal(s.pageViews30, 1100);           // all three October rows sit inside the 30-day window
  assert.equal(s.rpm30, Math.round((175_000_000 / 1100) * 1000));
  assert.equal(s.bestDay?.day, '2026-10-27');
  assert.equal(s.lastDataDay, '2026-10-27');
  assert.equal(s.staleDays, 0);
  assert.equal(s.daysWithData, 4);
  assert.equal(s.changePct, Math.round(((175_000_000 - 40_000_000) / 40_000_000) * 1000) / 10);
});

test('no data means no invented deltas or best day', () => {
  const s = summarize([], '2026-10-27');
  assert.equal(s.lifetime, 0);
  assert.equal(s.bestDay, null);
  assert.equal(s.lastDataDay, null);
  assert.equal(s.changePct, null);
  assert.equal(s.staleDays, null);
});

test('API config is off until every OAuth value exists, and the circuit clears on new credentials', () => {
  const saved = { ...process.env };
  for (const k of ['ADSENSE_ACCOUNT_ID', 'ADSENSE_OAUTH_CLIENT_ID', 'ADSENSE_OAUTH_CLIENT_SECRET', 'ADSENSE_REFRESH_TOKEN']) delete process.env[k];
  try {
    assert.equal(adsenseApiConfig().configured, false);
    const cfg = adsenseApiConfig();
    assert.equal(cfg.currency, 'INR');
    _resetAdsenseCircuit();
    assert.equal(adsenseApiCircuit().parked, false);
  } finally { process.env = saved; }
});

// End-to-end shape of the admin card: a CSV import must reach the stored cache and the
// summary must reflect it. Uses the in-memory dev store (same path as production MySQL).
test('admin flow: imported CSV shows up in the revenue summary', async () => {
  const mod = await import('../server/marketing/adsenseRevenue');
  const today = new Date().toISOString().slice(0, 10);
  const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const res = await mod.importAdsenseCsv(`Date,Page views,Estimated earnings\n${yest},1000,42.50\n${today},600,18.25`);
  assert.equal(res.ok, true, res.error);
  assert.equal(res.rows, 2);
  const rows = await mod.dailyRows(30);
  const days = rows.map((r) => r.day);
  assert.ok(days.includes(today) && days.includes(yest), 'both days stored');
  const s = mod.summarize(rows, today);
  assert.ok(s.today >= 18_250_000, `today earnings stored (got ${s.today})`);
  assert.ok(s.last7 >= 18_250_000 + 42_500_000, 'week total includes both rows');
  const syncs = await mod.lastSyncs(3);
  assert.ok(syncs.some((x: any) => x.kind === 'csv' && Number(x.ok) === 1), 'import is logged for the status panel');
});
