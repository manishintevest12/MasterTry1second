/// Partner scope per vertical — the app's copy of `server/registry/verticalExclusions.ts`.
///
/// OWNER 21 Nov: "digihaat.in ko aap food delivery, 10 min grocery se hata do".
/// OWNER 22 Nov (second time): "muje digihaat.in sirf ecommerce section mai chaiye pr wo abhi v 10 min grocery mai aa
/// raha hai usko hatao iss vertical se".
///
/// The server already drops these rows (and now matches the merchant name inside the title, the url and the seller
/// quotes too). This exists because the APP is the place the owner kept seeing them: it paints the previous
/// session's answer from its on-disk cache before any network call, so a grocery snapshot taken before the rule can
/// still put DigiHaat on screen today. A cached row never reaches the renderer now.
library;

/// Lowercased merchant tokens that must never appear in a vertical's feed (mirror of the server list).
const Map<String, List<String>> _excluded = {
  'grocery': ['digihaat', 'digi haat'],
  'food': ['digihaat', 'digi haat'],
};

List<String> excludedMerchantsFor(String vertical) => _excluded[vertical.toLowerCase()] ?? const [];

/// True when any of these texts names an excluded merchant for the vertical.
bool isExcludedMerchant(String vertical, Iterable<String?> texts) {
  final tokens = excludedMerchantsFor(vertical);
  if (tokens.isEmpty) return false;
  final hay = texts.whereType<String>().join(' ').toLowerCase();
  if (hay.isEmpty) return false;
  return tokens.any(hay.contains);
}
