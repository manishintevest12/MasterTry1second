/**
 * Resolves a card name to the issuing bank's OWN card page (the apply deeplink target).
 * Browserless: the bank's public credit-card hub is fetched once (cached) and every
 * `<hub>/<card-slug>` anchor is indexed. A card is matched only when ALL its distinctive
 * name tokens appear in a slug; otherwise the caller falls back to the honest bank hub.
 * No URL is ever guessed or constructed.
 */
import { cffiFetch } from '../../common/curlCffiFetch';

interface Hub { url: string; base: string; pathRe: RegExp; sitemap?: string }
const HUBS: Record<string, Hub> = {
  'hdfc-bank': { url: 'https://www.hdfc.bank.in/credit-cards', base: 'https://www.hdfc.bank.in', pathRe: /^\/credit-cards\/[a-z0-9-]+$/ },
  'axis-bank': { url: 'https://www.axis.bank.in/cards/credit-card', base: 'https://www.axis.bank.in', pathRe: /^\/cards\/credit-card\/[a-z0-9-]+$/ },
  'icici-bank': { url: 'https://www.icici.bank.in/personal-banking/cards/credit-card', base: 'https://www.icici.bank.in', pathRe: /^\/personal-banking\/cards\/credit-card\/[a-z0-9-]+$/ },
  'idfc-first-bank': { url: 'https://www.idfcfirst.bank.in/credit-card', base: 'https://www.idfcfirst.bank.in', pathRe: /^\/credit-card\/[a-z0-9-]+$/, sitemap: 'https://www.idfcfirst.bank.in/sitemap.xml' },
  // SBI Card's hub is client-rendered; its public sitemap lists every card page.
  'sbi-card': { url: 'https://www.sbicard.com/en/personal/credit-cards.html', base: 'https://www.sbicard.com', pathRe: /^\/en\/personal\/credit-cards\/[a-z0-9-]+\.html$/, sitemap: 'https://www.sbicard.com/sitemap.xml' },
};

const NOISE = /blog|calculator|emi|pin|bill|offers?$|apply-now|statement|faq|debit|kisan|business|nri|corporate|upgrade|limit|status|balance|against|add-on|secured|compare|documents|rewards$|benefits|services|programme|do-not-call|commercial|track|lounge-access|lifetime-free|metal|micro|wow|manage|login|register/i;

const CACHE = new Map<string, { at: number; links: Array<{ url: string; slug: string }> }>();
const TTL = 6 * 3600_000;

export async function bankCardIndex(bankSlug: string): Promise<Array<{ url: string; slug: string }>> {
  const hub = HUBS[bankSlug];
  if (!hub) return [];
  const hit = CACHE.get(bankSlug);
  if (hit && Date.now() - hit.at < TTL) return hit.links;
  try {
    const seen = new Map<string, string>();
    const bodies: Array<{ body: string; sitemap: boolean }> = [];
    const r = await cffiFetch(hub.url, { impersonate: 'chrome', timeoutMs: 20_000 });
    if (r.status === 200) bodies.push({ body: r.body, sitemap: false });
    if (hub.sitemap) {
      const sm = await cffiFetch(hub.sitemap, { impersonate: 'chrome', timeoutMs: 20_000 });
      if (sm.status === 200) bodies.push({ body: sm.body, sitemap: true });
    }
    if (!bodies.length) return hit?.links || [];
    const hrefs: string[] = [];
    for (const b of bodies) {
      const re = b.sitemap ? /<loc>([^<]+)<\/loc>/g : /href="([^"#?]+)"/g;
      for (const m of b.body.matchAll(re)) hrefs.push(m[1]);
    }
    for (const raw of hrefs) {
      let h = raw;
      if (h.startsWith(hub.base)) h = h.slice(hub.base.length);
      if (!h.startsWith('/') || !hub.pathRe.test(h)) continue;
      const slug = h.split('/').pop()!.replace(/\.page$/, '');
      if (NOISE.test(slug)) continue;
      seen.set(hub.base + h, slug);
    }
    const links = [...seen].map(([url, slug]) => ({ url, slug }));
    CACHE.set(bankSlug, { at: Date.now(), links });
    return links;
  } catch { return hit?.links || []; }
}

const GENERIC = new Set(['credit', 'card', 'cards', 'bank', 'hdfc', 'axis', 'icici', 'sbi', 'idfc', 'first', 'the', 'and', 'visa', 'mastercard', 'rupay', 'world', 'signature', 'platinum', 'lifetime', 'free']);
const toks = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((t) => t.length > 1);

/** Best official card page for `cardName`, or null when nothing matches confidently. */
export async function resolveBankCardUrl(bankSlug: string, cardName: string): Promise<string | null> {
  const idx = await bankCardIndex(bankSlug);
  if (!idx.length) return null;
  const want = toks(cardName).filter((t) => !GENERIC.has(t));
  if (!want.length) return null;
  let best: { url: string; score: number; extra: number } | null = null;
  for (const l of idx) {
    const st = new Set(toks(l.slug.replace(/-/g, ' ')));
    const hit = want.filter((t) => st.has(t) || [...st].some((x) => x.startsWith(t) && t.length > 3)).length;
    if (hit < want.length) continue; // every distinctive token must be in the slug
    const extra = [...st].filter((t) => !GENERIC.has(t) && !want.includes(t)).length; // fewer leftover tokens = tighter match
    if (!best || extra < best.extra) best = { url: l.url, score: hit, extra };
  }
  return best ? best.url : null;
}
