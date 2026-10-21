import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLead } from '../server/marketing/leads';

// Owner 21 Oct: finance leads (Loans, Insurance, Credit, Accounts) persist
// server-side. These tests pin the validation contract the web CPL modal,
// PartnerInquiryModal and the Flutter LeadSheet all rely on.

test('leads: valid lead_form lead passes (account vertical, age captured)', () => {
  const v = validateLead({ source: 'lead_form', vertical: 'account', accountType: 'savings', firstName: 'Ravi', lastName: 'Kumar', age: 28, salary: 45000, location: 'Indore 452001', phone: '9876543210', email: 'ravi@example.com' });
  assert.equal(v.ok, true, v.error);
  assert.equal(v.clean?.firstName, 'Ravi');
});

test('leads: age outside 18-100 rejected', () => {
  assert.equal(validateLead({ firstName: 'A', lastName: 'B', age: 17, location: 'Pune' }).ok, false);
  assert.equal(validateLead({ firstName: 'A', lastName: 'B', age: 101, location: 'Pune' }).ok, false);
  assert.equal(validateLead({ firstName: 'A', lastName: 'B', age: 'abc', location: 'Pune' }).ok, false);
});

test('leads: missing name or location rejected; negative salary rejected', () => {
  assert.equal(validateLead({ lastName: 'B', age: 30, location: 'Pune' }).ok, false);
  assert.equal(validateLead({ firstName: 'A', age: 30 }).ok, false);
  assert.equal(validateLead({ firstName: 'A', lastName: 'B', age: 30, location: 'Pune', salary: -1 }).ok, false);
});

test('leads: all four finance verticals accepted, others rejected', () => {
  for (const vertical of ['loans', 'insurance', 'creditcards', 'account']) {
    assert.equal(validateLead({ vertical, firstName: 'A', lastName: 'B', age: 30, location: 'Pune' }).ok, true, vertical);
  }
  assert.equal(validateLead({ vertical: 'flights', firstName: 'A', lastName: 'B', age: 30, location: 'Pune' }).ok, false);
});

test('leads: accountType restricted to savings/current/demat', () => {
  assert.equal(validateLead({ vertical: 'account', accountType: 'demat', firstName: 'A', lastName: 'B', age: 30, location: 'Pune' }).ok, true);
  assert.equal(validateLead({ vertical: 'account', accountType: 'nps', firstName: 'A', lastName: 'B', age: 30, location: 'Pune' }).ok, false);
});

test('leads: partner_inquiry needs business + a contact route', () => {
  assert.equal(validateLead({ source: 'partner_inquiry', business: 'Acme Bank', email: 'b2b@acme.com' }).ok, true);
  assert.equal(validateLead({ source: 'partner_inquiry', business: 'Acme Bank' }).ok, false);
  assert.equal(validateLead({ source: 'partner_inquiry', email: 'b2b@acme.com' }).ok, false);
  assert.equal(validateLead({ source: 'partner_inquiry', business: 'Acme Bank', phone: '9876543210' }).ok, true);
});

test('leads: unknown source falls back to lead_form rules (never silently dropped as unknown)', () => {
  const v = validateLead({ source: 'mystery', firstName: 'A', lastName: 'B', age: 30, location: 'Pune' } as any);
  assert.equal(v.ok, true);
});
