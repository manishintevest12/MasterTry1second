// Owner 21 Oct: finance lead sheet validation mirror test.
// ALL fields mandatory; phone is a 10-digit format check with deliberately
// NO OTP verification; email format-checked — same contract as web + server.
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import 'package:try1second/ui/widgets/lead_sheet.dart';

Future<void> _open(WidgetTester t) async {
  await t.pumpWidget(MaterialApp(
    home: Builder(
      builder: (ctx) => Scaffold(
        body: ElevatedButton(
          onPressed: () => showLeadSheet(ctx, vertical: 'loans', serviceType: 'Personal Loan', sellerName: 'Test Bank'),
          child: const Text('open'),
        ),
      ),
    ),
  ));
  await t.tap(find.text('open'));
  await t.pumpAndSettle();
}

Future<void> _fill(WidgetTester t, String name, String age, String salary, String location, String phone, String email) async {
  await t.enterText(find.byType(TextField).at(0), name);
  await t.enterText(find.byType(TextField).at(1), age);
  await t.enterText(find.byType(TextField).at(2), salary);
  await t.enterText(find.byType(TextField).at(3), location);
  await t.enterText(find.byType(TextField).at(4), phone);
  await t.enterText(find.byType(TextField).at(5), email);
}

void main() {
  testWidgets('lead sheet blocks missing phone/email (all fields mandatory)', (t) async {
    await _open(t);
    await _fill(t, 'Ravi Kumar', '30', '50000', 'Indore', '', '');
    await t.tap(find.text('Submit enquiry'));
    await t.pump();
    expect(find.text('Mobile number is required'), findsOneWidget);
  });

  testWidgets('lead sheet rejects an invalid 10-digit mobile (no OTP flow)', (t) async {
    await _open(t);
    await _fill(t, 'Ravi Kumar', '30', '50000', 'Indore', '1234567890', 'ravi@example.com');
    await t.tap(find.text('Submit enquiry'));
    await t.pump();
    expect(find.textContaining('valid 10-digit Indian mobile number'), findsOneWidget);
  });

  testWidgets('lead sheet rejects an invalid email', (t) async {
    await _open(t);
    await _fill(t, 'Ravi Kumar', '30', '50000', 'Indore', '9876543210', 'bad@');
    await t.tap(find.text('Submit enquiry'));
    await t.pump();
    expect(find.text('Enter a valid email address'), findsOneWidget);
  });

  testWidgets('lead sheet rejects missing income and location', (t) async {
    await _open(t);
    await _fill(t, 'Ravi Kumar', '30', '', '', '9876543210', 'ravi@example.com');
    await t.tap(find.text('Submit enquiry'));
    await t.pump();
    expect(find.text('Monthly income is required'), findsOneWidget);
  });
}
