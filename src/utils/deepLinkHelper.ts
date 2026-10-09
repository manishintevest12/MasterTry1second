/**
 * Try1Second Affiliate Deep Link Engine
 * Generates verified tracking URLs for all merchants and networks
 * attaching user subids, click IDs, and location pincode tokens.
 */

export interface DeepLinkParams {
  rawUrl: string;
  sellerName: string;
  affiliateNetwork?: string;
  affiliateId?: string;
  subIdParam?: string;
  deepLinkPrefix?: string;
  userId?: string;
  pincode?: string;
}

export function buildAffiliateDeepLink(params: DeepLinkParams): string {
  const {
    rawUrl,
    sellerName,
    affiliateNetwork = 'Direct',
    affiliateId = 'TRY1_PARTNER',
    subIdParam,
    deepLinkPrefix,
    userId = 'guest_user',
    pincode = '110001',
  } = params;

  if (!rawUrl) return '#';

  const trackingToken = `${userId}_pin${pincode}_ts${Date.now()}`;
  const lowerSeller = sellerName.toLowerCase();

  // 1. If Network Deep Link Prefix is present (e.g. Cuelinks, Linksdirect, Admitad)
  if (deepLinkPrefix && deepLinkPrefix.trim() !== '') {
    const cleanPrefix = deepLinkPrefix.trim();
    if (cleanPrefix.includes('{url}')) {
      return cleanPrefix
        .replace('{url}', encodeURIComponent(rawUrl))
        .replace('{subid}', encodeURIComponent(trackingToken));
    }
    const separator = cleanPrefix.includes('?') ? '&' : '?';
    return `${cleanPrefix}${separator}url=${encodeURIComponent(rawUrl)}&subid=${encodeURIComponent(trackingToken)}`;
  }

  // 2. Network Specific Defaults
  if (affiliateNetwork === 'Cuelinks') {
    return `https://linksredirect.com/?cid=91024&subid=${encodeURIComponent(trackingToken)}&url=${encodeURIComponent(rawUrl)}`;
  }

  if (affiliateNetwork === 'Admitad') {
    return `https://ad.admitad.com/g/try1second99/?ulp=${encodeURIComponent(rawUrl)}&subid=${encodeURIComponent(trackingToken)}`;
  }

  if (affiliateNetwork === 'vCommission') {
    return `https://tracking.vcommission.com/aff_c?offer_id=812&aff_id=98124&url=${encodeURIComponent(rawUrl)}&aff_sub=${encodeURIComponent(trackingToken)}`;
  }

  // 3. Direct Merchant Handlers
  try {
    const parsed = new URL(rawUrl);

    // Amazon India
    if (lowerSeller.includes('amazon') || parsed.hostname.includes('amazon')) {
      parsed.searchParams.set('tag', affiliateId || 'try1second-21');
      parsed.searchParams.set('ascsubtag', trackingToken);
      parsed.searchParams.set('linkCode', 'll1');
      return parsed.toString();
    }

    // Flipkart
    if (lowerSeller.includes('flipkart') || parsed.hostname.includes('flipkart')) {
      parsed.searchParams.set('affid', affiliateId || 'try1second');
      parsed.searchParams.set('affExtParam1', trackingToken);
      return parsed.toString();
    }

    // MakeMyTrip
    if (lowerSeller.includes('makemytrip') || parsed.hostname.includes('makemytrip')) {
      parsed.searchParams.set('aff_id', affiliateId || 'MMT_TRY1_PARTNER');
      parsed.searchParams.set('sub_id', trackingToken);
      return parsed.toString();
    }

    // Blinkit / Zepto / Swiggy
    if (lowerSeller.includes('blinkit') || lowerSeller.includes('zepto') || lowerSeller.includes('swiggy')) {
      parsed.searchParams.set('utm_source', 'try1second');
      parsed.searchParams.set('utm_medium', 'affiliate');
      parsed.searchParams.set('utm_campaign', `pincode_${pincode}`);
      parsed.searchParams.set('subid', trackingToken);
      return parsed.toString();
    }

    // General fallback: attach subIdParam if configured
    if (subIdParam) {
      const parts = subIdParam.replace('{userId}', userId).replace('{pincode}', pincode);
      const sep = parsed.search ? '&' : '?';
      return `${rawUrl}${sep}${parts}`;
    }

    parsed.searchParams.set('ref', 'try1second');
    parsed.searchParams.set('subid', trackingToken);
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}
