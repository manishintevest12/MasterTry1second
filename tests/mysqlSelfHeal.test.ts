/**
 * Self-healing MySQL access recovery (owner 21 Oct, ER_ACCESS_DENIED_ERROR):
 * (1) localHostCandidates() lists co-located hosts, skipping the configured one;
 * (2) recoverMysqlWithLocalHost() returns false cleanly (never throws) when no
 * URL is configured.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { localHostCandidates, recoverMysqlWithLocalHost } from '../server/common/db';

describe('MySQL localhost self-heal', () => {
  it('returns false cleanly when no MySQL URL is configured (never throws)', async () => {
    assert.equal(await recoverMysqlWithLocalHost(null), false);
    assert.equal(await recoverMysqlWithLocalHost(''), false);
  });

  it('tries co-located hosts in order and skips the configured host', () => {
    assert.deepEqual(localHostCandidates('185.185.185.185'), ['localhost', '127.0.0.1']);
    assert.deepEqual(localHostCandidates('localhost'), ['127.0.0.1'], 'localhost already configured — only 127.0.0.1 retried');
    assert.deepEqual(localHostCandidates('127.0.0.1'), ['localhost']);
    assert.deepEqual(localHostCandidates('LOCALHOST'), ['127.0.0.1'], 'comparison is case-insensitive');
  });
});
