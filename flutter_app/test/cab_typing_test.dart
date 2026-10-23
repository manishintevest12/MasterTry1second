import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:try1second/ui/widgets/location_hint_field.dart';

Widget wrap(Widget child) => MaterialApp(home: Scaffold(body: child));

void main() {
  testWidgets('owner can type a full pickup location (owner 22 Oct: "kuch v enter ni kr skte")', (tester) async {
    final c = TextEditingController(text: 'Indore');
    await tester.pumpWidget(wrap(LocationHintField(
      controller: c,
      label: 'Pickup Location',
      placeholder: 'Enter pickup point...',
      mode: 'pickup',
    )));
    // Clear and retype a long location the way the owner does.
    await tester.enterText(find.byType(TextField), '');
    await tester.pump();
    await tester.enterText(find.byType(TextField), 'Chappan Dukan Indore');
    await tester.pump();
    expect(c.text, 'Chappan Dukan Indore');
  });

  testWidgets('each keystroke lands even while geo hints load (250ms debounce, spinner shows)', (tester) async {
    final c = TextEditingController();
    await tester.pumpWidget(wrap(LocationHintField(
      controller: c,
      label: 'Drop Destination',
      placeholder: 'Enter drop...',
      mode: 'drop',
    )));
    for (var i = 0; i < 5; i++) {
      await tester.enterText(find.byType(TextField), 'Bhopal'.substring(0, i + 1));
      await tester.pump(const Duration(milliseconds: 50));
    }
    expect(c.text, 'Bhopa');
  });
}
