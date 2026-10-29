/**
 * OWNER 29 OCT ("reward section mai aise hi kr na ... admin mai end to end system banao"):
 * banner cadence is server-owned config, so web and the Android app can never disagree about
 * how often a strip repeats inside a results list. These tests pin the merge/clamp rules that
 * stop a bad admin value (0, negative, 1, or a 10 000-row gap) from wrecking a list.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_BANNER_SLOTS, mergeBannerSlots } from '../server/home/bannerSlots';

test('defaults repeat the strip every 12 results in Quick Apps and Rewards', () => {
  assert.equal(DEFAULT_BANNER_SLOTS.quickapps.everyN, 12);
  assert.equal(DEFAULT_BANNER_SLOTS.rewards.everyN, 12);
  assert.equal(DEFAULT_BANNER_SLOTS.home.everyN, 0, 'the home strip is page-controlled, never list-cadenced');
});

test('a stored override wins over the default', () => {
  const slots = mergeBannerSlots({ rewards: { everyN: 9 } });
  assert.equal(slots.rewards.everyN, 9);
  assert.equal(slots.quickapps.everyN, 12, 'untouched pools keep their default');
});

test('the setting can arrive as JSON text from app_settings', () => {
  const slots = mergeBannerSlots(JSON.stringify({ quickapps: { everyN: 15 } }));
  assert.equal(slots.quickapps.everyN, 15);
});

test('a cadence that would carpet a list is clamped, not obeyed', () => {
  assert.equal(mergeBannerSlots({ rewards: { everyN: 1 } }).rewards.everyN, 3);
  assert.equal(mergeBannerSlots({ rewards: { everyN: -4 } }).rewards.everyN, 0, 'zero/negative turns the list cadence off');
  assert.equal(mergeBannerSlots({ rewards: { everyN: 10_000 } }).rewards.everyN, 60);
});

test('malformed settings never break the pools', () => {
  for (const bad of [null, undefined, 'not json', 42, { rewards: 'nope' }]) {
    const slots = mergeBannerSlots(bad as unknown);
    assert.equal(slots.rewards.everyN, 12);
    assert.equal(slots.quickapps.enabled, true);
  }
});

test('a pool can be paused and its homepage fallback turned off independently', () => {
  const slots = mergeBannerSlots({ quickapps: { enabled: false, fallbackToHome: false } });
  assert.equal(slots.quickapps.enabled, false);
  assert.equal(slots.quickapps.fallbackToHome, false);
  assert.equal(slots.rewards.enabled, true, 'other pools stay live');
});
