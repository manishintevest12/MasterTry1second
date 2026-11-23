import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePostback, userIdFromSubid, normalizeStatus } from '../server/orders/partnerOrders';

/**
 * OWNER 23 Nov: "acha ye possible hai ki humere partner pr jo order dete hai wo order humere sites and flutter app pr
 * dikhe agar haan tho uss feature ko add kro".
 *
 * We can never read a partner's own order table — what we receive is the network's conversion report. These tests pin
 * the two things that decide whether a real order lands correctly: the ping is parsed under every network's field
 * names, and it is attributed to a user only when OUR subid says who it was.
 */

test('a Cuelinks-style ping becomes one order', () => {
  const o = parsePostback({
    oid: 'CL-99881',
    subid: '278473.42',
    sale_amount: '1,299.00',
    commission: '64.95',
    status: 'approved',
    merchant: 'DigiHaat',
    order_date: '2026-11-22 18:04:11',
  }, 'cuelinks');
  assert.ok(o);
  assert.equal(o!.orderRef, 'CL-99881');
  assert.equal(o!.userId, 42);
  assert.equal(o!.orderValue, 1299);
  assert.equal(o!.commission, 64.95);
  assert.equal(o!.status, 'approved');
  assert.equal(o!.merchant, 'DigiHaat');
  assert.equal(o!.network, 'cuelinks');
  assert.equal(o!.orderedAt, '2026-11-22 18:04:11');
});

test('the other networks\' field names work too', () => {
  const admitad = parsePostback({ order_id: 'A-1', aff_sub: '278473-7', amount: '500', payout: '25' }, 'admitad');
  assert.equal(admitad!.orderRef, 'A-1');
  assert.equal(admitad!.userId, 7);
  assert.equal(admitad!.orderValue, 500);
  assert.equal(admitad!.commission, 25);

  const amazon = parsePostback({ transaction_id: 'T-9', subid1: '278473_9', total: '899', status: 'completed' });
  assert.equal(amazon!.userId, 9);
  assert.equal(amazon!.status, 'approved');
});

test('a ping with no order id is never stored as an order', () => {
  assert.equal(parsePostback({ subid: '278473.42', amount: '500' }), null);
  assert.equal(parsePostback({}), null);
});

test('subid attribution only ever accepts a plain user id', () => {
  assert.equal(userIdFromSubid('278473.42'), 42);
  assert.equal(userIdFromSubid('278473-42'), 42);
  assert.equal(userIdFromSubid('278473_42'), 42);
  assert.equal(userIdFromSubid('42'), 42);
  // no user attached: the plain publisher id, a session key, or junk
  // the bare publisher id is NOT a user: today's links carry no user, and every order would land on user 278473
  assert.equal(userIdFromSubid('278473'), null);
  assert.equal(userIdFromSubid('sess_abc123'), null);
  assert.equal(userIdFromSubid(''), null);
  assert.equal(userIdFromSubid(undefined), null);
  assert.equal(userIdFromSubid('0'), null);
});

test('status words are normalised, and an unknown word stays pending (never silently approved)', () => {
  assert.equal(normalizeStatus('approved'), 'approved');
  assert.equal(normalizeStatus('CONFIRMED'), 'approved');
  assert.equal(normalizeStatus('paid'), 'approved');
  assert.equal(normalizeStatus('cancelled'), 'cancelled');
  assert.equal(normalizeStatus('rejected by advertiser'), 'cancelled');
  assert.equal(normalizeStatus('refund'), 'cancelled');
  assert.equal(normalizeStatus('pending'), 'pending');
  assert.equal(normalizeStatus(''), 'pending');
  assert.equal(normalizeStatus(undefined, null), 'pending');
  assert.equal(normalizeStatus('something-new'), 'pending');
});

test('money is read as a number and never invented', () => {
  const o = parsePostback({ order_id: 'X1', order_value: '₹1,44,990', commission: '' });
  assert.equal(o!.orderValue, 144990);
  assert.equal(o!.commission, null);
  assert.equal(o!.status, 'pending');
  assert.equal(o!.userId, null);
});
