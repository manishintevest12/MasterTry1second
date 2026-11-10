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
