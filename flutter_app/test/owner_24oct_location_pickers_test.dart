import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import 'package:try1second/ui/widgets/location_hint_field.dart';
import 'dart:io';

/// Owner 24 Oct evening: food delivery-address and cab pickup/drop fields must
/// open the SAME full-screen granular AddressPickerScreen used by the 10-min
/// grocery vertical (search-as-you-type + GPS + map pin) instead of inline
/// typing. Source-parity pins:
///  1) LocationHintField supports onFieldTap and renders read-only + without
///     its inline dropdown when set.
///  2) The compare form wires food + cab pickup + cab drop to that hook.
///  3) The state exposes the two sheet methods that push AddressPickerScreen.
void main() {
  final dir = Directory.current;
  final fieldSrc = File('${dir.path}/lib/ui/widgets/location_hint_field.dart').readAsStringSync();
  final screenSrc = File('${dir.path}/lib/ui/screens/compare_screen.dart').readAsStringSync();

  test('LocationHintField: onFieldTap opens the full-screen picker, inline dropdown suppressed', () {
    expect(fieldSrc.contains('onFieldTap'), isTrue, reason: 'hook param exists');
    expect(
      fieldSrc.contains('widget.onFieldTap != null ? widget.onFieldTap!() : _focus.requestFocus()'),
      isTrue,
      reason: 'tap routes to the picker when set, inline focus otherwise',
    );
    expect(
      fieldSrc.contains("readOnly: widget.onFieldTap != null"),
      isTrue,
      reason: 'picker mode is read-only display of the chosen address',
    );
    expect(
      fieldSrc.contains("widget.onFieldTap == null && _showing"),
      isTrue,
      reason: 'inline dropdown never shows in picker mode',
    );
  });

  test('compare form: food delivery address + cab pickup/drop wired to granular picker', () {
    expect(screenSrc.contains('onPickFoodAddressSheet: _openFoodAddressSheet'), isTrue,
        reason: 'food field opens the address sheet');
    expect(screenSrc.contains('onOpenCabSpotPicker: _openCabSpotSheet'), isTrue,
        reason: 'cab form gets the spot picker callback');
    expect(screenSrc.contains("onOpenCabSpotPicker != null ? () => onOpenCabSpotPicker!(true) : null"), isTrue,
        reason: 'cab pickup tap opens the granular picker');
    expect(screenSrc.contains("onOpenCabSpotPicker != null ? () => onOpenCabSpotPicker!(false) : null"), isTrue,
        reason: 'cab drop tap opens the granular picker');
    expect(screenSrc.contains("onFieldTap: onPickFoodAddressSheet"), isTrue,
        reason: 'food delivery-address field uses the hook');
  });

  test('sheet methods push AddressPickerScreen with the right titles', () {
    expect(screenSrc.contains("_openFoodAddressSheet()"), isTrue);
    expect(screenSrc.contains("title: 'Delivery Address'"), isTrue);
    expect(screenSrc.contains("_openCabSpotSheet(bool pickup)"), isTrue);
    expect(screenSrc.contains("pickup ? 'Pickup Location' : 'Drop Destination'"), isTrue);
    // Pickup selection must update the location context exactly like the map-pin path.
    expect(screenSrc.contains("Pickup set: \$label"), isTrue);
  });


// Owner 25 Oct: food delivery address + cab pickup/drop must LOOK like the
// 10-min grocery location pill (red pin + text + chevron), not a typing box.
group('grocery-style picker pill (owner 25 Oct)', () {
  testWidgets('picker-mode field renders the grocery pill, not a TextField', (tester) async {
    var tapped = 0;
    final c = TextEditingController();
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: LocationHintField(
          controller: c,
          label: 'Pickup Location',
          placeholder: 'Enter pickup point...',
          mode: 'pickup',
          large: true,
          onFieldTap: () => tapped++,
        ),
      ),
    ));
    expect(find.byType(TextField), findsNothing, reason: 'picker pill has no inline typing box');
    expect(find.byIcon(Icons.location_on_outlined), findsOneWidget, reason: 'red map pin like grocery');
    expect(find.byIcon(Icons.expand_more_rounded), findsOneWidget, reason: 'dropdown chevron like grocery');
    expect(find.text('Enter pickup point...'), findsOneWidget, reason: 'placeholder shows when empty');
    await tester.tap(find.byKey(const ValueKey('hintfield-box-pickup')));
    await tester.pump();
    expect(tapped, 1, reason: 'tap opens the full-screen granular picker');
    c.text = 'Chappan Dukan, Indore';
    await tester.pump();
    expect(find.text('Chappan Dukan, Indore'), findsOneWidget, reason: 'chosen address shows in the pill');
  });
});
}
