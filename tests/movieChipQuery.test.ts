import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { effectiveMovieQuery, isExperienceOnlyQuery } from '../server/workers/parsers/bookmyshow';

/**
 * Owner 23 Oct ('koi v vertical results de he ni raha app pr'): the compare screen's
 * suggestion chips are EXPERIENCE queries, not movie titles. Strict title matching
 * dropped every card ("IMAX 3D evening show with recliner" matched no title) and the
 * movies vertical served zero. Experience-only chips must fall back to honest city
 * discovery (empty query -> all now-showing cards); real titles keep the strict filter.
 */
describe('effectiveMovieQuery (owner 23 Oct: experience chips -> city discovery)', () => {
  it('treats experience chips as city discovery (empty query)', () => {
    assert.equal(effectiveMovieQuery('imax 3d evening with recliner'), '');
    assert.equal(effectiveMovieQuery('weekend under 350'), '');
    assert.equal(effectiveMovieQuery('dolby atmos recliner seats'), '');
  });

  it('keeps strict title matching for real movie names', () => {
    assert.equal(effectiveMovieQuery('kantara'), 'kantara');
    assert.equal(effectiveMovieQuery('jailer 2'), 'jailer 2');
  });

  it('mixed queries keep their title tokens (title wins over experience words)', () => {
    // A real title plus experience words still filters by the title tokens.
    assert.equal(effectiveMovieQuery('kantara imax 3d'), 'kantara imax 3d');
    assert.equal(isExperienceOnlyQuery('kantara imax 3d'), false);
  });

  it('numeric/price tokens alone are experience queries', () => {
    assert.equal(isExperienceOnlyQuery('under 350'), true);
    assert.equal(isExperienceOnlyQuery('tickets under 250 se'), true);
  });

  it('empty string is not an experience query (no-op, caller already had no entity)', () => {
    assert.equal(isExperienceOnlyQuery(''), false);
    assert.equal(effectiveMovieQuery(''), '');
  });
});
