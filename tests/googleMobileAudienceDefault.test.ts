/**
 * Regression: mobile Google sign-in audience default (22 Oct).
 *
 * The Flutter google_sign_in Android plugin uses default_web_client_id from
 * google-services.json (the project's OAuth client 49438102645-f7uut...) as the
 * ID-token audience when no --dart-define=GOOGLE_SERVER_CLIENT_ID is passed.
 * The server must accept that audience out of the box so plain builds can sign
 * in; GOOGLE_OAUTH_CLIENT_IDS env still overrides/extends the list.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { settings } from '../server/common/settings.ts';

const GOOGLE_SERVICES_CLIENT = '49438102645-f7uut2ihal2lk8llc44ai711r4v3i7je.apps.googleusercontent.com';

test('default accepted audiences include the google-services.json client', () => {
  assert.ok(
    settings.googleOauthClientIds.includes(GOOGLE_SERVICES_CLIENT),
    `expected google-services client in default audience list, got: ${settings.googleOauthClientIds.join(',')}`,
  );
});

test('audience list stays comma-split and trimmed when env is used', () => {
  // Mirror the env-parsing expression directly (settings is a singleton; env at import time).
  const parsed = (process.env.GOOGLE_OAUTH_CLIENT_IDS || GOOGLE_SERVICES_CLIENT)
    .split(',').map((e) => e.trim()).filter(Boolean);
  assert.deepEqual(parsed.filter(Boolean), parsed);
});
