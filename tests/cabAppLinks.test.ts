import test from 'node:test';
import assert from 'node:assert/strict';
import { cabLinks, cabAppOpenUrl, isCabAppScheme } from '../server/affiliate/cabLinks';

const PICK = { lat: 22.7196, lng: 75.8577, name: 'Vijay Nagar, Indore' };
const DROP = { lat: 28.6139, lng: 77.209, name: 'Connaught Place, Delhi' };

// Owner 27 Oct: apps present on the device (Uber, Ola, Rapido…) get APP-level links.
test('cab merchants with a native app get an app scheme + web fallback', () => {
  const uber = cabLinks('Uber', { pickup: PICK, drop: DROP });
  assert.ok(uber.scheme.startsWith('uber://?action=setPickup'), uber.scheme);
  assert.ok(/dropoff\[latitude\]=28.6139/.test(uber.scheme));
  assert.ok(uber.web.startsWith('https://'));

  const ola = cabLinks('Ola', { pickup: PICK, drop: DROP });
  assert.ok(ola.scheme.startsWith('olacabs://app/launch?lat=22.7196'), ola.scheme);

  const rapido = cabLinks('Rapido', { pickup: PICK, drop: DROP });
  assert.ok(rapido.scheme.startsWith('rapido://ride?pickup_lat=22.7196'), rapido.scheme);

  const indrive = cabLinks('InDrive', { pickup: PICK, drop: DROP });
  assert.ok(indrive.scheme.startsWith('indrive://'), indrive.scheme);
});

test('no coordinates -> no invented app launch, web page only', () => {
  const l = cabLinks('Uber', {});
  assert.equal(l.scheme, '');
  assert.ok(l.web.startsWith('https://'));
  assert.equal(cabLinks('Ola', { pickup: PICK }).scheme, ''); // Ola needs both ends
});

test('web-only merchants return no scheme', () => {
  assert.equal(cabLinks('Fastdeals', { pickup: PICK, drop: DROP }).scheme, '');
});

test('app-open bridge accepts only whitelisted cab schemes', () => {
  assert.ok(isCabAppScheme('uber://x'));
  assert.ok(isCabAppScheme('olacabs://app/launch'));
  assert.ok(!isCabAppScheme('javascript:alert(1)'));
  assert.ok(!isCabAppScheme('https://evil.example'));
  const url = cabAppOpenUrl(cabLinks('Uber', { pickup: PICK, drop: DROP }), 'off_1');
  assert.ok(url.startsWith('/api/app-open?'), url);
  assert.ok(url.includes('s=uber') && url.includes('o=off_1'));
});
