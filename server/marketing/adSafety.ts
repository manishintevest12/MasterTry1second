/**
 * AD SAFETY (owner 3 Nov: "smartlink jo ad ke liye hai wo flow disturb tho ni kr raha yaa wo hume play
 * store pr block tho ni krwa dega hume sb safety measures chaiye").
 *
 * Google Play's disruptive-ads policy forbids: ads that appear without a user action (auto-popup,
 * interstitial on launch, injected JavaScript into a page), ads that overlay app content, and
 * misleading click targets. It does NOT forbid a clearly-labelled sponsored link that opens in the
 * user's own browser after a deliberate tap.
 *
 * This module is the single place those limits are encoded on the server: the app's smartlink is only
 * ever published when it is an https URL on an ad-network domain we recognise. Everything else is
 * withheld (returns null) rather than trusted - failing closed is what keeps the listing safe.
 */
export const AD_NETWORK_HOSTS = ['araplhn.org', 'bauval.org', 'abscloud.org'] as const;

export function smartlinkSafe(raw: string): { ok: boolean; allowedHosts: string[]; reason?: string } {
  const allowedHosts = [...AD_NETWORK_HOSTS];
  let parsed: URL;
  try {
    parsed = new URL(String(raw || '').trim());
  } catch {
    return { ok: false, allowedHosts, reason: 'unparseable' };
  }
  if (parsed.protocol !== 'https:') return { ok: false, allowedHosts, reason: 'https_required' };
  const host = parsed.hostname.toLowerCase();
  const allowed = allowedHosts.some((h) => host === h || host.endsWith(`.${h}`));
  return allowed ? { ok: true, allowedHosts } : { ok: false, allowedHosts, reason: 'host_not_allowed' };
}
