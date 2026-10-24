import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:try1second/core/api.dart';
import 'package:try1second/core/app_state.dart';
import 'package:try1second/ui/screens/address_picker_screen.dart';

/// Owner 24 Oct: granular address picker (10-min delivery, food, cab).
/// The screen must turn /api/geo/suggest rows (Photon/OSM structured parts)
/// into a picked spot carrying colony/street/city/pincode + exact coordinates,
/// and render the granular secondary address line the reference screens show.

/// Minimal override: extends the real client so only geoSuggest is faked.
class _FakeGeoApi extends Try1SecondApi {
  _FakeGeoApi();

  @override
  Future<List<Map<String, dynamic>>> geoSuggest(String q, {double? lat, double? lng}) async {
    if (q.contains('apna sw')) {
      return const [
        {
          'name': 'Apna Sweets',
          'address': 'Sapna Sangeeta Road, Patel Nagar, Indore, Madhya Pradesh',
          'street': 'Sapna Sangeeta Road',
          'colony': 'Patel Nagar',
          'city': 'Indore',
          'pincode': '452001',
          'lat': 22.6995,
          'lng': 75.8669,
          'distanceKm': 3.7,
        },
        {
          'name': 'Apna Sweets Pigdambar',
          'address': 'Mhow Bypass, Pigdambar, Indore, Madhya Pradesh',
          'street': 'Mhow Bypass',
          'colony': 'Pigdambar',
          'city': 'Indore',
          'pincode': '453331',
          'lat': 22.6111,
          'lng': 75.7973,
          'distanceKm': 11.2,
        },
      ];
    }
    return const [];
  }
}

/// Harness: a button that opens the picker and records the popped result.
class _Harness extends StatefulWidget {
  const _Harness({required this.holder});
  final ValueNotifier<Map<String, dynamic>?> holder;
  @override
  State<_Harness> createState() => _HarnessState();
}

class _HarnessState extends State<_Harness> {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Scaffold(
        body: Builder(
          builder: (c) => Center(
            child: TextButton(
              onPressed: () async {
                final spot = await Navigator.push(
                  c,
                  MaterialPageRoute(
                    builder: (_) => const AddressPickerScreen(title: 'Select Your Location'),
                  ),
                );
                widget.holder.value = spot is Map<String, dynamic> ? spot : null;
              },
              child: const Text('OPEN PICKER'),
            ),
          ),
        ),
      ),
    );
  }
}

void main() {
  testWidgets('AddressPickerScreen: renders granular rows and pops a structured spot',
      (tester) async {
    final savedApi = AppState.instance.api;
    AppState.instance.api = _FakeGeoApi();
    final holder = ValueNotifier<Map<String, dynamic>?>(null);
    addTearDown(() {
      AppState.instance.api = savedApi;
      holder.dispose();
    });

    await tester.pumpWidget(_Harness(holder: holder));
    await tester.tap(find.text('OPEN PICKER'));
    await tester.pumpAndSettle();

    // The screen carries the picker title (reference: "Select Your Location").
    expect(find.text('Select Your Location'), findsOneWidget);
    expect(find.text('Use my current location'), findsOneWidget);
    expect(find.text('Set location on map'), findsOneWidget);

    // Type the owner's example query; both suggest rows render.
    await tester.enterText(find.byType(TextField), 'apna sw');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();

    expect(find.text('Apna Sweets'), findsOneWidget);
    expect(find.text('Apna Sweets Pigdambar'), findsOneWidget);
    expect(
      find.text('Sapna Sangeeta Road, Patel Nagar, Indore, Madhya Pradesh'),
      findsOneWidget,
      reason: 'colony + street must show in the secondary address line',
    );
    expect(find.text('3.7 km'), findsOneWidget, reason: 'distance from user coords shows');
    expect(find.text('11.2 km'), findsOneWidget);

    // Tap the first result; the popped spot carries granular parts + coords.
    await tester.tap(find.text('Apna Sweets'));
    await tester.pumpAndSettle();

    final spot = holder.value;
    expect(spot, isNotNull, reason: 'picker must return the chosen spot');
    expect(spot!['lat'], 22.6995);
    expect(spot['lng'], 75.8669);
    expect(spot['locality'], 'Patel Nagar, Sapna Sangeeta Road',
        reason: 'locality is colony + street, the granular entry users asked for');
    expect(spot['city'], 'Indore');
    expect(spot['pincode'], '452001');
    expect(spot['address'], 'Apna Sweets, Sapna Sangeeta Road, Patel Nagar, Indore, Madhya Pradesh');
  }, timeout: const Timeout(Duration(seconds: 60)));

  testWidgets('AddressPickerScreen: unknown query shows the honest empty state',
      (tester) async {
    final savedApi = AppState.instance.api;
    AppState.instance.api = _FakeGeoApi();
    final holder = ValueNotifier<Map<String, dynamic>?>(null);
    addTearDown(() {
      AppState.instance.api = savedApi;
      holder.dispose();
    });

    await tester.pumpWidget(_Harness(holder: holder));
    await tester.tap(find.text('OPEN PICKER'));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), 'zzzzqqq');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();

    expect(find.textContaining('No matching address'), findsOneWidget,
        reason: 'no invented places — honest empty state only');
    expect(holder.value, isNull, reason: 'nothing picked while empty');
  }, timeout: const Timeout(Duration(seconds: 60)));
}
