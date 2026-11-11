/**
 * OWNER 11 Nov: the admin portal showed "Could not send the login code right now" and there was no way in,
 * because Resend is the only delivery channel. These tests pin the break-glass path: it must fail closed
 * without ADMIN_RECOVERY_CODE, only accept the exact code, only for an eligible admin, and never log it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { settings } from '../server/common/settings';
import { verifyAdminRecovery } from '../server/auth/otpService';

const GOOD = 'recover-' + 'x'.repeat(24);

function withRecovery<T>(fn: () => Promise<T>): Promise<T> {
  const prevCode = settings.adminRecoveryCode;
  const prevEmails = settings.adminEmails;
  (settings as any).adminRecoveryCode = GOOD;
  (settings as any).adminEmails = ['standardpetro.in@gmail.com'];
  return fn().finally(() => {
    (settings as any).adminRecoveryCode = prevCode;
    (settings as any).adminEmails = prevEmails;
  });
}

test('recovery sign-in fails closed when ADMIN_RECOVERY_CODE is not set', async () => {
  const prev = settings.adminRecoveryCode;
  (settings as any).adminRecoveryCode = '';
  const r = await verifyAdminRecovery('standardpetro.in@gmail.com', GOOD);
  (settings as any).adminRecoveryCode = prev;
  assert.equal(r.ok, false);
  assert.match(String(r.error), /not configured/i);
});

test('recovery sign-in accepts only the exact code, for an eligible admin', async () => {
  await withRecovery(async () => {
    const ok = await verifyAdminRecovery('standardpetro.in@gmail.com', GOOD);
    assert.equal(ok.ok, true);
    assert.equal(ok.email, 'standardpetro.in@gmail.com');

    const wrong = await verifyAdminRecovery('standardpetro.in@gmail.com', GOOD + 'z');
    assert.equal(wrong.ok, false);
    assert.match(String(wrong.error), /invalid/i);

    const short = await verifyAdminRecovery('standardpetro.in@gmail.com', 'abc');
    assert.equal(short.ok, false);

    const stranger = await verifyAdminRecovery('someone@else.com', GOOD);
    assert.equal(stranger.ok, false);
    assert.match(String(stranger.error), /not an admin/i);
  });
});

test('the recovery route exists and the code is never logged', () => {
  const routes = readFileSync('server/api/routes.ts', 'utf8');
  assert.ok(routes.includes("'/auth/otp/recovery'"), 'POST /api/auth/otp/recovery must be mounted');
  const svc = readFileSync('server/auth/otpService.ts', 'utf8');
  // No log line may interpolate the configured secret.
  assert.ok(!/log\.[a-z]+\([^)]*adminRecoveryCode/.test(svc), 'the recovery code must never be logged');
  assert.ok(!/return\s*\{[^}]*adminRecoveryCode[^}]*\}/.test(svc), 'the recovery code must never be returned');
});

test('the admin page offers the recovery path instead of a dead end', () => {
  const view = readFileSync('src/components/admin/AdminLoginView.tsx', 'utf8');
  assert.ok(view.includes('adminOtpRecovery'), 'login view must call the recovery endpoint');
  assert.ok(/recovery code/i.test(view), 'login view must name the recovery option');
});
