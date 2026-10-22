import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:try1second/core/api.dart';
import 'package:try1second/core/app_state.dart';
import 'package:try1second/ui/screens/rewards_screen.dart';

/// Regression (owner 22 Oct: "iss wale section mai v image sahi ni hai aur
/// button v hidden hai"): the Top Picks rail clipped its CTA button when a
/// card carried a price badge, and deal promo art was cover-cropped to a
/// sliver. Both must never regress.
void main() {
  testWidgets('TopPickCard shows its CTA fully inside the 186px rail (price badge present)', (tester) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1.0;
    final pick = RewardTopPick.fromJson(const {
      'vertical': 'ecommerce', 'source': 'admin', 'partnerName': 'Amazon',
      'headline': 'Bank Offer Upto Rs 1,000.00 discount on credit card EMI',
      'offerText': '10% off with Amazon Pay ICICI card', 'priceBadge': 'Rs 999',
      'badgeText': '80% OFF', 'image': '', 'ctaText': 'View Deal', 'url': '',
    });
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: SizedBox(
          height: 186,
          child: ListView(scrollDirection: Axis.horizontal, children: [TopPickCard(pick: pick, state: AppState.instance)]),
        ),
      ),
    ));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull); // no RenderFlex overflow
    final cta = find.text('View Deal');
    expect(cta, findsOneWidget);
    // the CTA must be fully inside the card (not clipped by the card edge)
    final ctaBox = tester.renderObject<RenderBox>(cta);
    final cardBox = tester.renderObject<RenderBox>(find.byType(TopPickCard));
    expect(ctaBox.size.height, greaterThan(10));
    expect(ctaBox.localToGlobal(Offset.zero).dy + ctaBox.size.height,
        lessThanOrEqualTo(cardBox.localToGlobal(Offset.zero).dy + cardBox.size.height + 0.5));
  });

  testWidgets('DealCard bank offer renders a contained 72px logo tile + visible Get Deal button', (tester) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1.0;
    final deal = Deal.fromJson(const {
      'id': 'd1', 'kind': 'bank_offer', 'merchantName': 'Amazon',
      'title': 'Bank Offer Upto Rs 1,000.00 discount',
      'imageUrl': 'https://x/banner.png', 'code': 'SAVE100',
      'url': '/api/out?t=1.sig', 'vertical': 'ecommerce',
    });
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: ListView(children: [DealCard(deal: deal, apiBase: 'https://www.try1second.com')]),
      ),
    ));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    // 72x72 white logo tile present (owner rule: contained rounded-square tile)
    final tile = find.byWidgetPredicate((w) {
      if (w is! Container) return false;
      final d = w.constraints;
      return d != null && d.maxWidth == 72 && d.maxHeight == 72;
    });
    expect(tile, findsOneWidget);
    final btn = find.text('Get Deal');
    expect(btn, findsOneWidget);
    final btnBox = tester.renderObject<RenderBox>(btn);
    final cardBox = tester.renderObject<RenderBox>(find.byType(DealCard));
    expect(btnBox.localToGlobal(Offset.zero).dy + btnBox.size.height,
        lessThanOrEqualTo(cardBox.localToGlobal(Offset.zero).dy + cardBox.size.height + 0.5));
    expect(find.text('VERIFIED'), findsOneWidget);
  });
}
