/// Which partner exits must leave the app and open in the phone's real browser.
///
/// OWNER 23 Nov (screenshot: Flipkart's "Something went wrong. Please try again later." inside our in-app browser,
/// title "My Orders"): "redirection krne ke baad jb flipkart pr jata hai tho ye error aata hai order mai isko fix kro".
///
/// WHY IT FAILS INSIDE OUR WEBVIEW. These marketplaces keep the shopping session in third-party cookies and refuse
/// to serve account, order and checkout pages to a WebView: Android WebView blocks third-party cookies by default,
/// our page carries the `Try1SecondApp/1.9` marker in its user agent, and their fraud checks treat that as a bot.
/// Browsing a product page mostly survives; "My Orders", login and checkout do not — which is exactly what a shopper
/// needs after a redirect, and exactly what earns the commission.
///
/// So these hosts are handed to the OS default browser (`LaunchMode.externalApplication`), where the shopper is
/// already signed in and checkout works. Every other partner keeps the in-app browser the owner asked for on 21 Oct.
library;

/// Hosts (and their subdomains) whose account/order/checkout flow does not work inside a WebView.
const Set<String> _externalOnlyHosts = {
  'flipkart.com',
  'shopsy.in',
  'amazon.in',
  'amazon.com',
  'myntra.com',
  'ajio.com',
  'tatacliq.com',
  'nykaa.com',
  'nykaafashion.com',
  'meesho.com',
  'snapdeal.com',
  'jiomart.com',
  'reliancedigital.in',
  'croma.com',
  'vijaysales.com',
  'firstcry.com',
  'lifestylestores.com',
  'westside.com',
  'pantaloons.com',
  'bewakoof.com',
  'shopclues.com',
  'paytmmall.com',
  'zomato.com',
  'swiggy.com',
  'blinkit.com',
  'zeptonow.com',
  'bigbasket.com',
  'jiomart.co.in',
  'dominos.co.in',
  'pizzahut.co.in',
  'kfc.co.in',
};

/// Seller names the app shows in the offer rows, mapped to the rule above. The app usually knows the merchant's
/// label before it knows its URL (the exit is our own masking pointer), so the decision is made from either.
const Set<String> _externalOnlySellerTokens = {
  'flipkart', 'shopsy', 'amazon', 'myntra', 'ajio', 'tatacliq', 'nykaa', 'meesho', 'snapdeal',
  'jiomart', 'reliance digital', 'reliancedigital', 'croma', 'vijaysales', 'firstcry', 'lifestyle',
  'westside', 'pantaloons', 'bewakoof', 'shopclues', 'paytm mall', 'paytmmall',
  'zomato', 'swiggy', 'blinkit', 'zepto', 'bigbasket', 'dominos', 'pizza hut', 'pizzahut', 'kfc',
};

/// True when this seller label is one whose login / orders / checkout only works in a real browser.
bool mustOpenExternallyForSeller(String? sellerName) {
  // "Tata CLiQ" and "tatacliq", "Reliance Digital" and "reliancedigital" are the same merchant: compare without
  // spaces or punctuation so a label's spelling never decides whether a shopper's order page opens.
  final name = _squash(sellerName);
  if (name.isEmpty) return false;
  for (final token in _externalOnlySellerTokens) {
    if (name.contains(_squash(token))) return true;
  }
  return false;
}

/// True when this URL belongs to a partner whose login / orders / checkout only works in a real browser.
bool mustOpenExternally(String url) {
  final host = _hostOf(url);
  if (host.isEmpty) return false;
  for (final blocked in _externalOnlyHosts) {
    if (host == blocked || host.endsWith('.$blocked')) return true;
  }
  return false;
}

String _squash(String? value) =>
    (value ?? '').toLowerCase().replaceAll(RegExp(r'[^a-z0-9]+'), '');

String _hostOf(String url) {
  try {
    final uri = Uri.parse(url.trim());
    final host = uri.host.toLowerCase();
    return host.startsWith('www.') ? host.substring(4) : host;
  } catch (_) {
    return '';
  }
}
