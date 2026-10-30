/**
 * Canonical-host policy (owner 30 Oct: app links must work on BOTH hosts).
 *
 * The apex -> www 301 exists because the non-www route answered 0.8-2.6s on the
 * hosting edge while www answered ~0.25s (PageSpeed TTFB, 17 Oct). But Android's
 * and iOS's App Links verifiers fetch /.well-known/assetlinks.json and
 * /.well-known/apple-app-site-association and REJECT a redirect, so those two
 * paths must answer 200 on the apex host itself.
 *
 * NOTE: this only governs OUR Express layer. On the live host the apex request is
 * currently 301-ing before Node ever runs (proved by response headers: no
 * etag/vary, Hostinger's own redirect HTML), which is a panel-level Force-WWW
 * redirect the owner has to switch off. This policy keeps our layer correct so the
 * moment that toggle is off, the verifier gets a 200.
 */
export const APEX_HOST = 'try1second.com';

/** Paths the App Links / Universal Links verifiers must be able to read unredirected. */
export function isVerificationPath(path: string): boolean {
  return String(path || '').toLowerCase().startsWith('/.well-known/');
}

/**
 * Should this request be 301-ed from the apex onto www?
 *
 * OWNER 30 Oct: the apex must answer 200 (AdSense registers the eTLD+1 as the site
 * URL and its crawler does not follow host redirects, and the App Links verifier
 * needs /.well-known/* to answer 200 on whichever host the click used). So the
 * redirect is now OFF by default and only comes back if FORCE_WWW_REDIRECT=1 is set
 * in the environment. SEO is unaffected either way: the canonical tag and the
 * sitemap both point at www.
 */
export function apexRedirectEnabled(): boolean {
  return String(process.env.FORCE_WWW_REDIRECT || '').trim() === '1';
}

export function shouldRedirectApexToWww(host: string | undefined, path: string | undefined): boolean {
  if (!apexRedirectEnabled()) return false;
  const h = String(host || '').toLowerCase();
  const isApex = h === APEX_HOST || new RegExp(`^${APEX_HOST.replace(/\./g, '\\.')}:\\d+$`).test(h);
  if (!isApex) return false;
  if (isVerificationPath(String(path || ''))) return false;
  return true;
}

/** The canonical https URL for a request that must be moved onto www. */
export function canonicalWwwUrl(originalUrl: string | undefined): string {
  return `https://www.${APEX_HOST}${originalUrl || '/'}`;
}
