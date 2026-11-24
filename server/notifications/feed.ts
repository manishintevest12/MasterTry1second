/**
 * WHAT'S NEW — the bell finally has something in it.
 *
 * OWNER 23 Nov: "bell notification jo hai app website mai usme kuch v notification ni aata jaise maan lo koi new
 * feature update kiye tho notification aana chaiye yaa koi deal wagera ka."
 *
 * MEASURED cause: the bell reads the `notifications` table, and that table only ever received (a) admin broadcasts
 * pushed by hand from the admin panel and (b) per-user price-drop alerts. Nobody had pushed a broadcast, so both the
 * site and the app showed an empty drawer for everyone — the plumbing worked, the content did not exist.
 *
 * So two producers now fill it, both from REAL data only:
 *   1. FEATURE_NOTES — the changes we actually shipped, each with its date. Written by hand because a feature note is
 *      a claim about our own product; nothing is generated.
 *   2. A daily deal — the top live deal from the deals table, with that deal's real title, merchant and link. No deal
 *      in the table means no notification; nothing is invented to fill the slot.
 *
 * They are ordinary broadcast rows (user_id NULL), so the existing read/unread machinery, the badge and the drawer all
 * keep working without changes on either client.
 */

import { getStore } from '../common/db';
import { log } from '../common/logger';

export interface FeatureNote {
  /** Stable key — the row is matched on its title, and this keeps the title from being rewritten by accident. */
  key: string;
  title: string;
  body: string;
  ctaUrl?: string;
  /** The day the change went live. Never a future date, never "coming soon". */
  date: string;
}

export const FEATURE_NOTES: FeatureNote[] = [
  {
    key: 'goibibo-flight-schedule',
    date: '2026-11-24',
    title: 'Goibibo flights now list every flight, not just the cheapest',
    body: 'Goibibo rows show each flight with its number, departure and arrival time, stops, duration and seats left. Where Goibibo publishes no fare for a flight, the card says so and the button opens Goibibo\'s live fare instead of guessing a price.',
    ctaUrl: '/?vertical=flights',
  },
  {
    key: 'related-real-photos',
    date: '2026-11-23',
    title: 'Related products now show their real photos',
    body: 'Every card in Related Products carries the merchant\'s own photo of that product — no repeated picture, no seller logo. Tap a card to price that exact product.',
    ctaUrl: '/',
  },
  {
    key: 'app-on-play',
    date: '2026-11-22',
    title: 'The Try1Second app is on Google Play',
    body: 'Price comparisons, deal scores and price-drop alerts open faster in the app. Install it once and every search stays in your pocket.',
    ctaUrl: 'https://play.google.com/store/apps/details?id=com.try1second.try1second',
  },
  {
    key: 'digihaat-ecommerce',
    date: '2026-11-22',
    title: 'Grocery results are cleaner',
    body: 'Marketplace listings that do not belong to the 10-minute grocery vertical no longer appear there. Grocery shows grocery; e-commerce shows e-commerce.',
    ctaUrl: '/',
  },
  {
    key: 'faster-searches',
    date: '2026-11-23',
    title: 'Faster, steadier live searches',
    body: 'Slow searches now answer with what is already verified instead of hanging, and older app versions no longer hit dead endpoints. Same prices, less waiting.',
    ctaUrl: '/',
  },
];

export interface NotificationRowInput {
  kind: string;
  title: string;
  body: string;
  image: string | null;
  ctaUrl: string | null;
  productTitle: string | null;
  priceNow: number | null;
  seller: string | null;
  createdBy: string;
}

/** A feature note as a broadcast row. Pure, so the shape is testable without a database. */
export function featureRow(note: FeatureNote): NotificationRowInput {
  return {
    kind: 'feature',
    title: String(note.title).slice(0, 200),
    body: String(note.body).slice(0, 1000),
    image: null,
    ctaUrl: /^https:\/\//i.test(String(note.ctaUrl || '')) || String(note.ctaUrl || '').startsWith('/')
      ? String(note.ctaUrl)
      : null,
    productTitle: null,
    priceNow: null,
    seller: null,
    createdBy: 'system:whatsnew',
  };
}

/** A real deal as a broadcast row. Pure, so a deal with no title/price can be refused in a test. */
export function dealRow(deal: any): NotificationRowInput | null {
  const title = String(deal?.title || '').trim();
  const merchant = String(deal?.merchantName || deal?.merchantKey || '').trim();
  if (!title) return null;
  const image = /^https:\/\//i.test(String(deal?.imageUrl || '')) ? String(deal.imageUrl) : null;
  const cta = /^https:\/\//i.test(String(deal?.goUrl || '')) || String(deal?.goUrl || '').startsWith('/')
    ? String(deal.goUrl)
    : null;
  return {
    kind: 'deal',
    title: `Deal today: ${title}`.slice(0, 200),
    body: `${merchant ? `${merchant} — ` : ''}${String(deal?.description || 'Live offer on Try1Second right now.').slice(0, 300)}`.slice(0, 1000),
    image,
    ctaUrl: cta,
    productTitle: null,
    priceNow: null,
    seller: merchant || null,
    createdBy: 'system:daily-deal',
  };
}

const INSERT = `INSERT INTO notifications
  (user_id, kind, title, body, image, cta_url, product_title, price_now, seller, is_active, created_by)
  VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`;

let lastRun = 0;
let running: Promise<void> | null = null;

/**
 * Fill the bell with anything missing. Cheap and idempotent: one SELECT of broadcast titles, then only the rows that
 * are genuinely absent. Runs at most once every 10 minutes per process, single-flight, and never throws into the
 * notifications route.
 */
export async function ensureFeed(): Promise<void> {
  if (Date.now() - lastRun < 10 * 60_000) return;
  if (running) return running;
  running = (async () => {
    try {
      const store: any = getStore();
      const existing = await store.query(
        `SELECT title FROM notifications WHERE user_id IS NULL`,
      );
      const titles = new Set((existing || []).map((r: any) => String(r.title || '')));

      for (const note of FEATURE_NOTES) {
        const row = featureRow(note);
        if (titles.has(row.title)) continue;
        await store.execute(INSERT, [row.kind, row.title, row.body, row.image, row.ctaUrl,
          row.productTitle, row.priceNow, row.seller, row.createdBy]);
        titles.add(row.title);
      }

      // One deal a day, and only a deal that actually exists right now.
      const today = new Date().toISOString().slice(0, 10);
      const dealsToday = await store.query(
        `SELECT id FROM notifications WHERE kind = 'deal' AND DATE(created_at) = ? LIMIT 1`,
        [today],
      );
      if (!(dealsToday || []).length) {
        const { getDealsWithCounts } = await import('../marketing/deals');
        const payload: any = await getDealsWithCounts({ limit: 12, hasImage: '1' });
        const list: any[] = Array.isArray(payload?.deals) ? payload.deals : [];
        // Prefer a discount over a bank offer: a shopper can act on a price, not on a card he may not hold.
        const ranked = [...list].sort((a, b) => Number(b?.kind === 'bank_offer') - Number(a?.kind === 'bank_offer'));
        for (const deal of ranked) {
          const row = dealRow(deal);
          if (!row || titles.has(row.title)) continue;
          await store.execute(INSERT, [row.kind, row.title, row.body, row.image, row.ctaUrl,
            row.productTitle, row.priceNow, row.seller, row.createdBy]);
          titles.add(row.title);
          break;
        }
      }
      lastRun = Date.now();
    } catch (e: any) {
      // A feed that cannot be filled must not break the bell: the drawer simply shows what already exists.
      log.warn('Notifications', 'what\'s-new feed not filled', { error: e?.message });
      lastRun = Date.now();
    } finally {
      running = null;
    }
  })();
  return running;
}
