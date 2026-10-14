import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateNotification,
  createNotification,
  userNotifications,
  broadcastNotifications,
  markRead,
  markAllRead,
  deactivateNotification,
  priceDropCopy,
  recordPriceDropNotification,
} from '../server/notifications/notifications';

const rand = Date.now() % 100000;

test('notifications: validation is honest (no short titles, no non-https links)', () => {
  assert.equal(validateNotification({ kind: 'admin', title: 'Hi', body: 'Hello there everyone' }).ok, false);
  assert.equal(validateNotification({ kind: 'admin', title: 'Sale live', body: 'x' }).ok, false);
  assert.equal(validateNotification({ kind: 'weird' as any, title: 'Sale live', body: 'Prices are live' }).ok, false);
  assert.equal(validateNotification({ kind: 'admin', title: 'Sale live', body: 'Prices are live', ctaUrl: 'javascript:alert(1)' }).ok, false);
  assert.equal(validateNotification({ kind: 'admin', title: 'Sale live', body: 'Prices are live', ctaUrl: 'http://insecure.com' }).ok, false);
  assert.equal(validateNotification({ kind: 'admin', title: 'Sale live', body: 'Prices are live', ctaUrl: 'https://www.try1second.com' }).ok, true);
});

test('notifications: broadcast visible to everyone, targeted only to owner, read state per user', async () => {
  const U1 = 800000 + rand, U2 = U1 + 1;
  const b = await createNotification({ kind: 'admin', title: `Broadcast ${rand}`, body: 'New feature is live on Try1second', createdBy: 'test' });
  assert.equal(b.ok, true);
  const t = await createNotification({ userId: U1, kind: 'price_drop', title: `Targeted ${rand}`, body: 'Your tracked item dropped', searchQuery: 'boat airdopes 141', priceNow: 799, targetPrice: 800, seller: 'Amazon.in' });
  assert.equal(t.ok, true);

  // owner sees both, other user sees only the broadcast
  const forOwner = await userNotifications(U1);
  const forOther = await userNotifications(U2);
  assert.ok(forOwner.items.some((n: any) => n.id === b.id));
  assert.ok(forOwner.items.some((n: any) => n.id === t.id));
  assert.ok(!forOther.items.some((n: any) => n.id === t.id));
  assert.ok(forOther.items.some((n: any) => n.id === b.id));

  // anonymous: broadcasts only
  const anon = await broadcastNotifications();
  assert.ok(anon.some((n: any) => n.id === b.id));
  assert.ok(!anon.some((n: any) => n.id === t.id));

  // unread counts, per-user read state
  assert.equal(forOwner.unread >= 2, true);
  await markRead(U1, Number(b.id));
  const afterOne = await userNotifications(U1);
  assert.equal(afterOne.items.find((n: any) => n.id === b.id).read, true);
  assert.equal((await userNotifications(U2)).items.find((n: any) => n.id === b.id).read, false); // other user unaffected
  const n = await markAllRead(U1);
  assert.equal((await userNotifications(U1)).unread, 0);
  assert.equal(n >= 1, true);

  // deactivate: broadcast disappears for everyone
  assert.equal(await deactivateNotification(Number(b.id)), true);
  assert.equal(await deactivateNotification(999999), false);
  const afterDel = await userNotifications(U2);
  assert.ok(!afterDel.items.some((x: any) => x.id === b.id));
  // targeted row persists for owner until separately removed
  assert.ok((await userNotifications(U1)).items.some((x: any) => x.id === t.id));
});

test('notifications: price-drop copy is generated from REAL data only', () => {
  const c = priceDropCopy({ product_title: 'Apple iPhone 17 256GB', target_price: 80000 }, 74999, 'Flipkart');
  assert.ok(c.title.includes('₹74,999'));
  assert.ok(c.body.includes('Flipkart'));
  assert.ok(c.body.includes('₹80,000'));
  const pct = Math.round((1 - 74999 / 80000) * 100);
  assert.ok(c.body.includes(`${pct}% below`));
  // at-target (0%) copy has no fake percent claim
  const c2 = priceDropCopy({ product_title: 'X', target_price: 100 }, 100, 'Amazon.in');
  assert.ok(!/%/.test(c2.body));
});

test('notifications: alert worker records a drop notification with query + price for the product page', async () => {
  const U = 810000 + rand;
  await recordPriceDropNotification(
    { id: 1, user_id: U, product_title: 'boAt Airdopes 141', search_query: 'boat airdopes 141', target_price: 800, image: 'https://m.media-amazon.com/images/I/x.jpg' },
    { price: 766, seller: 'Flipkart', url: 'https://www.try1second.com/api/out?x=1' },
  );
  const mine = await userNotifications(U);
  const n = mine.items[0];
  assert.equal(n.kind, 'price_drop');
  assert.equal(n.searchQuery, 'boat airdopes 141');
  assert.equal(n.priceNow, 766);
  assert.equal(n.targetPrice, 800);
  assert.equal(n.seller, 'Flipkart');
  assert.equal(n.image, 'https://m.media-amazon.com/images/I/x.jpg');
});
