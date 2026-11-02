import { test } from 'node:test';
import assert from 'node:assert/strict';
import { repairEtraveliDeeplink } from '../server/affiliate/deeplinkDate';

/**
 * The URLs below are REAL, captured live on 2 Nov 2026 from
 * in.flightnetwork.com/graphql/SearchOnResultPage for IDR-DEL and DEL-BOM. The stale-day
 * variant is the exact shape that made a 19 Nov search open 3 Nov fares.
 */
const REAL_19NOV =
  'https://in.flightnetwork.com/from/sharedurl/air/IDRDEL19NOV/1/-/-/c:Y?selectionKey=6E6627-19Nov26-R%2Cbcbtyh%2C%3A%3Ag_0%3Ah_0%3Aa_C3%3Ab_8Z%3Ac_8Z%3Ad_6ff428%3Ae_25e4aa%3Af_4E%3Ai_1.0.0%3Aj_OM%3Az_rk79zs';
const REAL_03NOV =
  'https://in.flightnetwork.com/from/sharedurl/air/IDRDEL03NOV/1/-/-/c:Y?selectionKey=6E6627-03Nov26-R%2Cbcbtyh%2C%3A%3Ag_0%3Ah_0%3Aa_C3%3Ab_8Z%3Ac_8Z%3Ad_6ff428%3Ae_25e4aa%3Af_4E%3Ai_1.0.0%3Aj_OM%3Az_rk79zs';
const REAL_GOTOGATE =
  'https://in.gotogate.com/from/sharedurl/air/DELBOM19NOV/1/-/-/c:Y?selectionKey=QP1116-19Nov26-U%2Cbvu5xi%2C%3A%3Ag_0%3Ah_0%3Aa_109%3Ab_8Z%3Ac_8Z%3Ad_71ff98%3Ae_10c8e0%3Af_4E%3Ai_1.0.0%3Aj_OM%3Az_qfjm7g';

test('a stale-day shared deeplink is rewritten to the requested day', () => {
  const fixed = repairEtraveliDeeplink(REAL_03NOV, { fromCode: 'IDR', toCode: 'DEL', dateIso: '2026-11-19' });
  assert.match(fixed, /\/air\/IDRDEL19NOV\//, 'path must carry the searched day');
  assert.ok(!fixed.includes('03NOV'), 'the old day must be gone');
});

test('a stale selectionKey is dropped, never hand-edited', () => {
  const fixed = repairEtraveliDeeplink(REAL_03NOV, { fromCode: 'IDR', toCode: 'DEL', dateIso: '2026-11-19' });
  assert.ok(!/selectionKey=/.test(fixed), 'the itinerary token from the other day must not survive');
  assert.ok(fixed.startsWith('https://in.flightnetwork.com/from/sharedurl/air/IDRDEL19NOV/'));
  assert.ok(!fixed.endsWith('?') && !fixed.endsWith('&'), 'no dangling query separator');
});

test('a link that already points at the requested day is untouched', () => {
  for (const url of [REAL_19NOV, REAL_GOTOGATE]) {
    const same = repairEtraveliDeeplink(url, {
      fromCode: url.includes('IDRDEL') ? 'IDR' : 'DEL',
      toCode: url.includes('IDRDEL') ? 'DEL' : 'BOM',
      dateIso: '2026-11-19',
    });
    assert.equal(same, url, 'no needless rewrite (keeps the brand itinerary selection)');
  }
});

test('gotogate stale day is repaired the same way', () => {
  const stale = REAL_GOTOGATE.replace('DELBOM19NOV', 'DELBOM03NOV').replace('19Nov26', '03Nov26');
  const fixed = repairEtraveliDeeplink(stale, { fromCode: 'DEL', toCode: 'BOM', dateIso: '2026-11-19' });
  assert.match(fixed, /\/air\/DELBOM19NOV\//);
  assert.ok(!fixed.includes('03NOV'));
  assert.ok(!/selectionKey=/.test(fixed));
});

test('links we do not understand are never touched', () => {
  const bare = 'https://in.flightnetwork.com/rf/result';
  assert.equal(repairEtraveliDeeplink(bare, { fromCode: 'IDR', toCode: 'DEL', dateIso: '2026-11-19' }), bare);
  assert.equal(repairEtraveliDeeplink('', { fromCode: 'IDR', toCode: 'DEL', dateIso: '2026-11-19' }), '');
  // A malformed requested date must not corrupt the link either.
  assert.equal(repairEtraveliDeeplink(REAL_03NOV, { fromCode: 'IDR', toCode: 'DEL', dateIso: '19-11-2026' }), REAL_03NOV);
});

test('year-crossing months are formatted correctly', () => {
  const jan = REAL_03NOV.replace('IDRDEL03NOV', 'IDRDEL03NOV');
  const fixed = repairEtraveliDeeplink(jan, { fromCode: 'IDR', toCode: 'DEL', dateIso: '2027-01-05' });
  assert.match(fixed, /\/air\/IDRDEL05JAN\//);
});
