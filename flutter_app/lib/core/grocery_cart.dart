import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// GROCERY CART (owner 20 Nov: "10 min-grocery mai muje aisa design chaiye flutter app and website mai, hr card
/// pr partner website ka naam, order now button and add to cart functionality").
///
/// Mirror of the web basket (src/lib/groceryCart.ts). A grocery line remembers the product, the pack as printed,
/// the partner it will be ordered from, and the price the shopper SAW. The total is the sum of those remembered
/// prices and is labelled as such — it is never presented as a live quote, and no money is taken here: "Order"
/// opens that partner's own tracked link.
///
/// Stored in SharedPreferences only. No account needed to build a basket; nothing leaves the device until the
/// shopper orders on the partner's site.
class GroceryLine {
  const GroceryLine({
    required this.key,
    required this.title,
    required this.unit,
    required this.price,
    required this.mrp,
    required this.partner,
    this.image,
    this.url,
    this.qty = 1,
  });

  final String key;
  final String title;
  final String unit;
  final double price;
  final double mrp;
  final String partner;
  final String? image;
  final String? url;
  final int qty;

  GroceryLine copyWith({int? qty}) => GroceryLine(
        key: key,
        title: title,
        unit: unit,
        price: price,
        mrp: mrp,
        partner: partner,
        image: image,
        url: url,
        qty: qty ?? this.qty,
      );

  Map<String, dynamic> toJson() => {
        'key': key,
        'title': title,
        'unit': unit,
        'price': price,
        'mrp': mrp,
        'partner': partner,
        if (image != null) 'image': image,
        if (url != null) 'url': url,
        'qty': qty,
      };

  static GroceryLine? fromJson(dynamic raw) {
    if (raw is! Map) return null;
    final title = (raw['title'] ?? '').toString().trim();
    if (title.isEmpty) return null;
    final partner = (raw['partner'] ?? '').toString();
    final unit = (raw['unit'] ?? '').toString();
    final price = double.tryParse((raw['price'] ?? 0).toString()) ?? 0;
    final mrpRaw = double.tryParse((raw['mrp'] ?? 0).toString()) ?? price;
    final qtyRaw = int.tryParse((raw['qty'] ?? 1).toString()) ?? 1;
    return GroceryLine(
      key: (raw['key'] ?? groceryKey(title, unit, partner)).toString(),
      title: title,
      unit: unit,
      price: price < 0 ? 0 : price,
      mrp: mrpRaw < 0 ? 0 : mrpRaw,
      partner: partner,
      image: raw['image']?.toString(),
      url: raw['url']?.toString(),
      qty: qtyRaw.clamp(1, kGroceryMaxQty),
    );
  }
}

const int kGroceryMaxQty = 20;
const int kGroceryMaxLines = 40;
const String _storageKey = 't1s_grocery_cart_v1';

/// Same identity rule as the web: same product + same pack + same partner is the same line.
String groceryKey(String title, String unit, String partner) =>
    '${partner.trim().toLowerCase()}|${title.trim().toLowerCase()}|${unit.trim().toLowerCase()}';

String _inr(double n) {
  final s = n.toStringAsFixed(0);
  // Indian digit grouping
  if (s.length <= 3) return '₹$s';
  final last3 = s.substring(s.length - 3);
  var rest = s.substring(0, s.length - 3);
  final parts = <String>[];
  while (rest.length > 2) {
    parts.insert(0, rest.substring(rest.length - 2));
    rest = rest.substring(0, rest.length - 2);
  }
  if (rest.isNotEmpty) parts.insert(0, rest);
  return '₹${parts.join(',')},$last3';
}

String groceryRupees(double n) => _inr(n);

class GroceryCart extends ChangeNotifier {
  GroceryCart._();
  static final GroceryCart instance = GroceryCart._();

  final List<GroceryLine> _lines = [];
  bool _loaded = false;

  List<GroceryLine> get lines => List.unmodifiable(_lines);
  int get units => _lines.fold(0, (s, l) => s + l.qty);
  int get lineCount => _lines.length;
  bool get isEmpty => _lines.isEmpty;

  double get total => _lines.fold(0.0, (s, l) => s + l.price * l.qty);
  double get mrpTotal => _lines.fold(0.0, (s, l) => s + (l.mrp > 0 ? l.mrp : l.price) * l.qty);
  double get saving => (mrpTotal - total) < 0 ? 0 : mrpTotal - total;

  int qtyOf(String key) {
    for (final l in _lines) {
      if (l.key == key) return l.qty;
    }
    return 0;
  }

  /// Grouped by the partner each group will be ordered from (a basket can span stores).
  Map<String, List<GroceryLine>> groupedByPartner() {
    final out = <String, List<GroceryLine>>{};
    for (final l in _lines) {
      final p = l.partner.trim().isEmpty ? 'Partner' : l.partner.trim();
      out.putIfAbsent(p, () => []).add(l);
    }
    return out;
  }

  Future<void> load() async {
    if (_loaded) return;
    _loaded = true;
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_storageKey);
      if (raw == null || raw.isEmpty) return;
      final decoded = jsonDecode(raw);
      if (decoded is! List) return;
      _lines
        ..clear()
        ..addAll(decoded.map(GroceryLine.fromJson).whereType<GroceryLine>().take(kGroceryMaxLines));
      notifyListeners();
    } catch (_) {
      /* a corrupt basket is simply empty */
    }
  }

  Future<void> _persist() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_storageKey, jsonEncode(_lines.map((l) => l.toJson()).toList()));
    } catch (_) {
      /* storage blocked: the basket still works for this session */
    }
  }

  void add(GroceryLine line, {int qty = 1}) {
    final key = line.key.isEmpty ? groceryKey(line.title, line.unit, line.partner) : line.key;
    final at = _lines.indexWhere((l) => l.key == key);
    if (at >= 0) {
      final next = (_lines[at].qty + qty).clamp(1, kGroceryMaxQty);
      _lines[at] = _lines[at].copyWith(qty: next);
    } else {
      _lines.add(line.copyWith(qty: qty.clamp(1, kGroceryMaxQty)));
      if (_lines.length > kGroceryMaxLines) _lines.removeAt(0);
    }
    notifyListeners();
    unawaited(_persist());
  }

  void setQty(String key, int qty) {
    final at = _lines.indexWhere((l) => l.key == key);
    if (at < 0) return;
    if (qty <= 0) {
      _lines.removeAt(at);
    } else {
      _lines[at] = _lines[at].copyWith(qty: qty.clamp(1, kGroceryMaxQty));
    }
    notifyListeners();
    unawaited(_persist());
  }

  void remove(String key) => setQty(key, 0);

  void clear() {
    _lines.clear();
    notifyListeners();
    unawaited(_persist());
  }
}
