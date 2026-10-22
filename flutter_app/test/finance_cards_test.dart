import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:try1second/core/compare.dart';
import 'package:try1second/ui/widgets/compare_cards.dart';
import 'package:try1second/ui/widgets/kit.dart';

CompareItem financeItem({
  required String vertical,
  required String title,
  String imageUrl = 'https://www.google.com/s2/favicons?domain=starhealth.in&sz=128',
  String quoteUrl = '',
}) {
  final quote = SellerQuote(
    id: 'q1',
    sellerName: 'BankBazaar',
    price: 0,
    url: quoteUrl,
  );
  return CompareItem(
    id: 'i1',
    vertical: vertical,
    title: title,
    subtitle: '',
    provider: 'BankBazaar',
    imageUrl: imageUrl,
    sellerQuotes: [quote],
  );
}

OfferGroup group(CompareItem it, String vertical) =>
    OfferGroup(it.id, vertical, it, [OfferRow(it, 'BankBazaar', it.primaryPrice, it.primaryPrice > 0)], OfferRow(it, 'BankBazaar', it.primaryPrice, it.primaryPrice > 0));

Widget wrap(Widget child) => MaterialApp(home: Scaffold(body: child));

void main() {
  testWidgets('insurance card shows the CTA even without a deep-link URL (owner 22 Oct)', (tester) async {
    final it = financeItem(vertical: 'insurance', title: 'Star Health health insurance');
    await tester.pumpWidget(wrap(GroupCard(g: group(it, 'insurance'), vertical: 'insurance')));
    expect(find.text('Instant Policy Match'), findsOneWidget);
  });

  testWidgets('loans card uses the web-parity label', (tester) async {
    final it = financeItem(vertical: 'loans', title: 'HDFC personal loan');
    await tester.pumpWidget(wrap(GroupCard(g: group(it, 'loans'), vertical: 'loans')));
    expect(find.text('Check Eligibility & Match'), findsOneWidget);
  });

  testWidgets('account card keeps the Apply CTA without a URL', (tester) async {
    final it = financeItem(vertical: 'account', title: 'State Bank of India Savings Account');
    await tester.pumpWidget(wrap(GroupCard(g: group(it, 'account'), vertical: 'account')));
    expect(find.text('Apply on BankBazaar'), findsOneWidget);
  });

  testWidgets('aggregator favicon never renders as the brand: initials tile instead', (tester) async {
    final it = financeItem(
      vertical: 'insurance',
      title: 'Reliance Health Insurance health insurance',
      imageUrl: 'https://www.google.com/s2/favicons?domain=bankbazaar.co&sz=128',
    );
    await tester.pumpWidget(wrap(GroupCard(g: group(it, 'insurance'), vertical: 'insurance')));
    // 'Reliance Health ...' -> brand initials RH on the white tile.
    expect(find.text('RH'), findsOneWidget);
  });

  testWidgets('non-finance card without a deep-link URL still hides the CTA (unchanged)', (tester) async {
    final quote = SellerQuote(id: 'q', sellerName: 'Some Store', price: 100, url: '');
    final it = CompareItem(
      id: 'e1', vertical: 'ecommerce', title: 'Widget', subtitle: '', provider: 'Some Store',
      sellerQuotes: [quote],
    );
    await tester.pumpWidget(wrap(GroupCard(g: group(it, 'ecommerce'), vertical: 'ecommerce')));
    expect(find.textContaining('Book on'), findsNothing);
  });

  testWidgets('credit card tile Apply button survives an empty quote URL', (tester) async {
    final quote = SellerQuote(id: 'q', sellerName: 'HDFC Bank', price: 500, url: '');
    final it = CompareItem(
      id: 'c1', vertical: 'creditcards', title: 'HDFC Regalia', subtitle: '', provider: 'HDFC Bank',
      specs: {'bank': 'HDFC Bank'},
      sellerQuotes: [quote],
    );
    final g = group(it, 'creditcards');
    await tester.pumpWidget(wrap(CreditCardTile(g: g)));
    expect(find.text('Apply on BankBazaar'), findsOneWidget); // seller label comes from the quote site
  });
}
