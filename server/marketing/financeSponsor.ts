/**
 * OWNER 10 Nov 2026, second time in one evening: "gromo sites pr ni dikh raha loan, account, credit card,
 * insurance vertical mai aur naa hi app pr isme image v add kr naa".
 *
 * Why it was invisible even though the routing worked: GroMo only ever appears on a ROW exit, and the rows
 * a finance search actually returns are BankBazaar / PaisaBazaar / PolicyBazaar issuer pages, which are
 * deliberately excluded from the GroMo wrap (they are competitor aggregators). So the advisor link never
 * had a surface of its own.
 *
 * This gives it one: a real FEATURED PARTNER card for the four finance verticals, served by /api/ads in the
 * exact shape both clients already render.
 *  - Web: src/components/AdBannerSlot.tsx renders provider 't1s_house' deals (image + title + tap target).
 *  - App: flutter_app/lib/ui/widgets/sponsored_slot.dart parses the same deals[] into a card and shows it on
 *    top of the finance compare screens, no rebuild needed because the payload comes from the server.
 * Nothing is invented: the merchant is the real advisor platform the owner is onboarded to, the tap target is
 * the real advisor link through the masked /api/out pointer (so the click is attributable), and no rate,
 * approval promise or fake discount is printed.
 */
import { GROMO_VERTICALS, gromoAdvisorLink, gromoClickUrl } from '../affiliate/gromo';
import { createMaskingPointer } from '../affiliate/deeplink';

/** Banner art shipped with the site (public/), overridable per environment. */
export const GROMO_BANNER_DEFAULT =
  'https://base44.app/api/apps/6ac8c95404695b89e61bf5c4/files/mp/public/6ac8c95404695b89e61bf5c4/1acf6eac3_gromo-advisor-card.jpg';

export function gromoBannerUrl(): string {
  const raw = String(process.env.T1S_GROMO_BANNER_URL || '').trim();
  const url = /^https:\/\//.test(raw) ? raw : GROMO_BANNER_DEFAULT;
  return url;
}

export function isFinanceVertical(vertical: string): boolean {
  const v = String(vertical || '').toLowerCase().trim();
  return GROMO_VERTICALS.includes(v);
}

/**
 * The featured-partner slot for one finance vertical, in the exact `t1s_house` shape /api/ads already
 * publishes. Returns null for a non-finance vertical so the deals-registry strip keeps working there.
 */
export function gromoFinanceSponsor(vertical: string): any | null {
  const v = String(vertical || '').toLowerCase().trim();
  if (!isFinanceVertical(v)) return null;
  const advisor = gromoAdvisorLink();
  if (!advisor) return null;
  const clickUrl = gromoClickUrl(advisor, `vertical_${v}`);
  // The tap target stays a relative masked pointer so the affiliate hop happens server-side and the app's
  // SponsoredOffer.fromJson() accepts it (it allows https:// or /api/out only).
  // createMaskingPointer already returns the full "/api/out?t=..." path (never re-prefix it).
  const pointer = createMaskingPointer(clickUrl, { vertical: v });
  if (!pointer) return null;
  return {
    provider: 't1s_house',
    vertical: v,
    partner: 'gromo',
    deals: [
      {
        merchant: 'GroMo',
        title: 'Credit card, loan, insurance ya savings account: certified advisor se apply karo',
        discount: 'Free expert guidance',
        image: gromoBannerUrl(),
        url: pointer,
      },
    ],
  };
}

/**
 * OWNER 10 Nov, THIRD report the same evening, after the /api/ads slot was deployed and verified live:
 * "gromo abhi v ni aa raha muje w chaiye kaise v app and site dono pr loan, credit card, insurance,
 * account section mai."
 *
 * The slot is real and /api/ads answers active for all four verticals, but a slot is an extra surface each
 * client must choose to draw, and an older installed APK never asks for it. A RESULT ROW cannot be missed:
 * every client version renders results, on the site and in the app, with no rebuild anywhere.
 *
 * So the advisor also becomes one honest row: it says who it is (GroMo, certified advisor), what it covers,
 * carries the partner art, and its tap target is the masked /api/out pointer to the advisor link. No price is
 * invented for it (a finance advisor has no fare); the row states "Free guidance" instead.
 */
export function gromoResultRow(vertical: string): any | null {
  const v = String(vertical || '').toLowerCase().trim();
  if (!isFinanceVertical(v)) return null;
  const advisor = gromoAdvisorLink();
  if (!advisor) return null;
  const pointer = createMaskingPointer(gromoClickUrl(advisor, `row_${v}`), { vertical: v });
  if (!pointer) return null;
  const banner = gromoBannerUrl();
  return {
    id: `gromo-advisor-${v}`,
    canonicalEntityId: null,
    canonicalVariantId: null,
    vertical: v,
    title: 'GroMo advisor: credit card, loan, insurance ya savings account apply karwao',
    seller: 'GroMo',
    vendor: 'GroMo',
    sellerUrl: pointer,
    isSponsored: true,
    sponsoredBadge: 'Partner',
    confidence: 1,
    rank: 0,
    rankReasons: ['partner'],
    matchState: 'verified',
    validationStatus: 'verified',
    freshnessStatus: 'live',
    location: null,
    prices: { currency: 'INR', effectivePrice: null, priceAvailable: false, note: 'Free guidance' },
    attributes: {
      products: 'Credit card · Loan · Insurance · Savings account',
      'how it works': 'Certified advisor, free guidance',
      badge: 'Partner',
      image_url: banner,
      logo: banner,
    },
    identifiers: {},
    availability: 'available',
    provenance: 'affiliate_configs',
    affiliate: { network: 'gromo', matchedProfile: 'gromo_advisor', deepLink: pointer, trackingUrl: pointer, vertical: v },
  };
}

/** Puts the advisor row first, exactly once, and never for a non-finance vertical. */
export function withGromoRow<T>(rows: T[], vertical: string): T[] {
  const row = gromoResultRow(vertical);
  if (!row) return rows;
  const id = row.id;
  const kept = (Array.isArray(rows) ? rows : []).filter((r: any) => r && r.id !== id && (r as any).id !== 'gromo-advisor');
  return [row as any, ...kept];
}
