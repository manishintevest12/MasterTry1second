import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:try1second/core/verticals.dart';
import 'package:try1second/ui/screens/compare_screen.dart';

void main() {
  testWidgets('cab pickup + drop fields are full-width stacked on a 360px phone (owner 22 Oct: "Inc"/"Bh" clipped)', (tester) async {
    tester.view.physicalSize = const Size(360 * 3, 800 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    final from = TextEditingController(text: 'Indore');
    final to = TextEditingController(text: 'Bhopal');
    final meta = kVerticals.firstWhere((v) => v.id == 'cab');
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(body: SingleChildScrollView(child: buildSearchCardForTest(meta: meta, from: from, to: to))),
    ));
    await tester.pump();

    final fields = find.byType(TextField);
    expect(fields, findsNWidgets(2));
    // Measure the whole tappable box (ancestor Container), not just the inner text strip.
    final pickup = tester.getRect(find.byKey(const ValueKey('hintfield-box-pickup')));
    final drop = tester.getRect(find.byKey(const ValueKey('hintfield-box-drop')));
    final pickupText = tester.getRect(fields.at(0));
    expect(pickupText.width, greaterThan(150), reason: 'text area too narrow: ${pickupText.width}');
    // Side-by-side gave ~60-110px. Stacked must give well over 200px and sit one under the other.
    // ignore: avoid_print
    print('PICKUP w=${pickup.width.toStringAsFixed(0)} h=${pickup.height.toStringAsFixed(0)} | DROP w=${drop.width.toStringAsFixed(0)} h=${drop.height.toStringAsFixed(0)}');
    expect(pickup.height, greaterThan(54), reason: 'pickup tap strip too thin: ${pickup.height} (owner: typing was painful)');
    expect(drop.width, greaterThan(200), reason: 'drop field too narrow: ${drop.width}');
    expect(drop.top, greaterThan(pickup.bottom - 1), reason: 'drop must be BELOW pickup, not beside it');
    expect(drop.height, greaterThan(54), reason: 'drop tap strip too thin: ${drop.height}');
  });
}
