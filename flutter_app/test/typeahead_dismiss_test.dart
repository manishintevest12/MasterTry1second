import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:try1second/ui/widgets/typeahead_field.dart';

/// OWNER 29 Oct (movies screenshot): typing in the search bar opened the hint list, and the list
/// stayed pinned over the screen — going to another page left it floating on top, hiding whatever
/// was behind it. It must close the moment the user moves on (taps elsewhere or opens a page) while
/// still being tappable itself.
void main() {
  const presets = <String>[
    'All Theatres & Multiplexes',
    'IMAX 3D Experience',
    '4DX Motion Seating',
  ];

  Widget harness(TextEditingController c, {required VoidCallback onOpenPage}) {
    return MaterialApp(
      home: Scaffold(
        body: Column(
          children: [
            TypeaheadField(
              controller: c,
              hint: 'Movie or cinema name',
              cities: false,
              presets: presets,
              icon: Icons.search,
            ),
            Expanded(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () {},
                child: const Center(child: Text('movie list')),
              ),
            ),
            TextButton(onPressed: onOpenPage, child: const Text('open page')),
          ],
        ),
      ),
    );
  }

  testWidgets('hint list closes when the user taps somewhere else', (tester) async {
    final c = TextEditingController();
    await tester.pumpWidget(harness(c, onOpenPage: () {}));
    await tester.enterText(find.byType(TextField), 'a');
    await tester.pumpAndSettle();
    expect(find.text('All Theatres & Multiplexes'), findsOneWidget);

    // tap the content below the field — the hint must not stay pinned there
    await tester.tap(find.text('movie list'));
    await tester.pumpAndSettle();
    expect(find.text('All Theatres & Multiplexes'), findsNothing);
  });

  testWidgets('hint list closes when another page is opened', (tester) async {
    final c = TextEditingController();
    late BuildContext ctx;
    await tester.pumpWidget(MaterialApp(
      home: Builder(builder: (context) {
        ctx = context;
        return harness(c, onOpenPage: () {
          Navigator.of(ctx).push(MaterialPageRoute(builder: (_) => const Scaffold(body: Text('other page'))));
        });
      }),
      navigatorObservers: [_TestObserver()],
    ));
    await tester.enterText(find.byType(TextField), 'a');
    await tester.pumpAndSettle();
    expect(find.text('IMAX 3D Experience'), findsOneWidget);

    await tester.tap(find.text('open page'));
    await tester.pumpAndSettle();
    expect(find.text('other page'), findsOneWidget);
    expect(find.text('IMAX 3D Experience'), findsNothing);
  });

  testWidgets('tapping a hint still selects it', (tester) async {
    final c = TextEditingController();
    await tester.pumpWidget(harness(c, onOpenPage: () {}));
    await tester.enterText(find.byType(TextField), 'imax');
    await tester.pumpAndSettle();
    await tester.tap(find.text('IMAX 3D Experience'));
    await tester.pumpAndSettle();
    expect(c.text, 'IMAX 3D Experience');
    expect(find.text('4DX Motion Seating'), findsNothing);
  });
}

/// Mirrors the app's real observer (lib/main.dart): unfocus on push so an autocomplete overlay
/// cannot outlive the page that opened it.
class _TestObserver extends NavigatorObserver {
  void _clear() {
    final f = FocusManager.instance.primaryFocus;
    if (f != null && f.hasFocus) f.unfocus();
  }

  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) => _clear();
}
