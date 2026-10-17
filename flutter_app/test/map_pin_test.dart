import 'package:flutter_test/flutter_test.dart';
import 'package:try1second/ui/screens/map_pin_picker_screen.dart';

void main() {
  group('PickedSpot.label (cab form chip)', () {
    test('locality + city compose when city is not already in the locality', () {
      const spot = PickedSpot(
        lat: 28.4946, lng: 77.0889,
        address: 'DLF Tower 10th Road, DLF Cyber City, Gurugram, Haryana 122010',
        locality: 'DLF Cyber City',
        city: 'Gurugram',
        pincode: '122010',
      );
      expect(spot.label, 'DLF Cyber City, Gurugram');
    });

    test('city not duplicated when locality already contains it', () {
      const spot = PickedSpot(
        lat: 22.7196, lng: 75.8577,
        address: 'Chappan Dukan, Indore, Madhya Pradesh 452001',
        locality: 'Indore',
        city: 'Indore',
      );
      expect(spot.label, 'Indore');
    });

    test('unnamed spot falls back to coordinates, never an invented address', () {
      const spot = PickedSpot(
        lat: 23.45678, lng: 77.01234,
        address: '23.45678, 77.01234',
        locality: '',
        city: '',
      );
      expect(spot.label, '23.45678, 77.01234');
    });
  });
}
