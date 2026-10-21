import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLead } from '../server/marketing/leads';

// Owner 21 Oct: finance leads (Loans, Insurance, Credit, Accounts) persist
// server-side. These tests pin the validation contract the web CPL modal,
// PartnerInquiryModal and the Flutter LeadSheet all rely on.
// Owner rule (21 Oct): ALL form fields are mandatory; phone is collected but
// there is deliberately NO OTP verification — only a format check.

const FULL = { phone: '9876543210', email: 'ravi@example.com' };

test('leads: valid lead_form lead passes (account vertical, age captured)', () => {
  const v = validateLead({ source: 'lead_form', vertical: 'account', accountType: 'savings', firstName: 'Ravi', lastName: 'Kumar', age: 28, salary: 45000, location: 'Indore 452001', ...FULL });
  assert.equal(v.ok, true, v.error);
  assert.equal(v.clean?.firstName, 'Ravi');
});

test('leads: age outside 18-100 rejected', () => {
  assert.equal(validateLead({ firstName: 'A', lastName: 'B', age: 17, location: 'Pune', ...FULL }).ok, false);
  assert.equal(validateLead({ firstName: 'A', lastName: 'B', age: 101, location: 'Pune', ...FULL }).ok, false);
  assert.equal(validateLead({ firstName: 'A', lastName: 'B', age: 'abc', location: 'Pune', ...FULL }).ok, false);
});

test('leads: missing name or location rejected; negative salary rejected', () => {
  assert.equal(validateLead({ lastName: 'B', age: 30, location: 'Pune', ...FULL }).ok, false);
  assert.equal(validateLead({ firstName: 'A', age: 30, ...FULL }).ok, false);
  assert.equal(validateLead({ firstName: 'A', lastName: 'B', age: 30, location: 'Pune', salary: -1, ...FULL }).ok, false);
});

test('leads: phone is mandatory (owner rule) — no OTP, format check only', () => {
  const base = { firstName: 'A', lastName: 'B', age: 30, location: 'Pune', email: 'a@b.com' };
  assert.equal(validateLead({ ...base }).ok, false); // missing phone
  const noPhone = validateLead({ ...base });
  assert.match(String(noPhone.error || ''), /mobile/i);
  assert.equal(validateLead({ ...base, phone: '12345' }).ok, false); // too short
  assert.equal(validateLead({ ...base, phone: '1234567890' }).ok, false); // not 6-9 start
  assert.equal(validateLead({ ...base, phone: '98765' }).ok, false);
  assert.equal(validateLead({ ...base, phone: '+91 98765 43210' }).ok, true); // formatted ok
  assert.equal(validateLead({ ...base, phone: '09876543210' }).ok, true); // 0-prefix ok
});

test('leads: email is mandatory (owner rule)', () => {
  const base = { firstName: 'A', lastName: 'B', age: 30, location: 'Pune', phone: '9876543210' };
  assert.equal(validateLead({ ...base }).ok, false); // missing email
  const noEmail = validateLead({ ...base });
  assert.match(String(noEmail.error || ''), /email/i);
  assert.equal(validateLead({ ...base, email: 'x@' }).ok, false); // invalid format
  assert.equal(validateLead({ ...base, email: 'a@b.com' }).ok, true);
});

test('leads: all four finance verticals accepted, others rejected', () => {
  for (const vertical of ['loans', 'insurance', 'creditcards', 'account']) {
    assert.equal(validateLead({ vertical, firstName: 'A', lastName: 'B', age: 30, location: 'Pune', ...FULL }).ok, true, vertical);
  }
  assert.equal(validateLead({ vertical: 'flights', firstName: 'A', lastName: 'B', age: 30, location: 'Pune', ...FULL }).ok, false);
});

test('leads: accountType restricted to savings/current/demat', () => {
  assert.equal(validateLead({ vertical: 'account', accountType: 'demat', firstName: 'A', lastName: 'B', age: 30, location: 'Pune', ...FULL }).ok, true);
  assert.equal(validateLead({ vertical: 'account', accountType: 'nps', firstName: 'A', lastName: 'B', age: 30, location: 'Pune', ...FULL }).ok, false);
});

test('leads: partner_inquiry needs business + a contact route (phone/email both work)', () => {
  assert.equal(validateLead({ source: 'partner_inquiry', business: 'Acme Bank', email: 'b2b@acme.com' }).ok, true);
  assert.equal(validateLead({ source: 'partner_inquiry', business: 'Acme Bank' }).ok, false);
  assert.equal(validateLead({ source: 'partner_inquiry', email: 'b2b@acme.com' }).ok, false);
  assert.equal(validateLead({ source: 'partner_inquiry', business: 'Acme Bank', phone: '9876543210' }).ok, true);
});

test('leads: unknown source falls back to lead_form rules (never silently dropped as unknown)', () => {
  const v = validateLead({ source: 'mystery', firstName: 'A', lastName: 'B', age: 30, location: 'Pune', ...FULL } as any);
  assert.equal(v.ok, true);
});

// ---------- web CPL modal + Flutter mirror parity (owner 21 Oct) ----------
import { readFileSync } from 'node:fs';

test('leads: web CPL modal enforces all-fields-mandatory client-side (no OTP)', () => {
  const modal = readFileSync('src/components/CplLeadCaptureModal.tsx', 'utf8');
  if (!/All Details Required/.test(modal)) throw new Error('missing all-fields toast');
  if (!/\[6-9\]\\d\{9\}/.test(modal)) throw new Error('missing 10-digit phone check');
  if (!/Invalid Email/.test(modal)) throw new Error('missing email format check');
  if (!/Location Required/.test(modal)) throw new Error('missing city/pincode check');
  if (/✓ Verified/.test(modal)) throw new Error('fabricated verified badge back');
  if (!/No OTP needed/.test(modal)) throw new Error('missing honest no-OTP label');
});

test('leads: Flutter LeadSheet mirrors mandatory validation (parity rule)', () => {
  const sheet = readFileSync('flutter_app/lib/ui/widgets/lead_sheet.dart', 'utf8');
  if (!/Mobile number is required/.test(sheet)) throw new Error('flutter phone required missing');
  if (!/hasMatch\(phoneDigits\)/.test(sheet)) throw new Error('flutter phone format check missing');
  if (!/Enter a valid email address/.test(sheet)) throw new Error('flutter email check missing');
  if (!/Monthly income is required/.test(sheet)) throw new Error('flutter salary required missing');
});
