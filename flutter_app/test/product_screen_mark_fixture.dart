// Test-only access to the app's seller mark: reproduces the exact widget the compare row builds
// (_SellerMark in product_screen.dart) so the logo/initials ladder is pinned without pumping the
// whole product screen (which needs a live product payload).
import 'package:flutter/material.dart';
import 'package:try1second/core/api.dart';

Widget markFor(String seller, {String logo = ''}) {
  final offer = ProductOffer('Apple iPhone 14', seller, 54900, 0, null, null, '', sellerLogo: logo);
  final url = logo.isEmpty ? null : 'https://www.try1second.com$logo';
  return Builder(builder: (context) {
    Widget initials() => Container(
          width: 34,
          height: 34,
          alignment: Alignment.center,
          decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: const Color(0xFFE2E8F0))),
          child: Text(_initials(seller)),
        );
    if (url == null) return initials();
    return ClipOval(
      child: Image.network(url, width: 34, height: 34, fit: BoxFit.contain,
          errorBuilder: (_, __, ___) => initials()),
    );
  });
}

String _initials(String seller) {
  final words = seller.replaceAll(RegExp(r'[^A-Za-z0-9 ]'), ' ').trim().split(RegExp(r'\s+'))
    ..removeWhere((w) => w.isEmpty);
  if (words.isEmpty) return '?';
  if (words.length == 1) {
    final w = words.first;
    return w.substring(0, w.length >= 2 ? 2 : 1).toUpperCase();
  }
  return (words[0][0] + words[1][0]).toUpperCase();
}
