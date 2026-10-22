import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { pickCommonsLogoHit, lenderNameFrom } from '../server/pipeline/lenderLogo.ts';

test('lenderNameFrom strips product words, keeps the institution (owner 22 Oct)', () => {
  assert.equal(lenderNameFrom('Axis Bank Personal Loan'), 'Axis Bank');
  assert.equal(lenderNameFrom('Union Bank of India Personal Loan'), 'Union Bank of India');
  assert.equal(lenderNameFrom('HDFC Ergo Health Insurance Plan'), 'HDFC Ergo');
});

test('P154-missing banks resolve via Commons search (real hits, 22 Oct)', () => {
  // Actual commons search results observed live for these banks.
  const cases: Array<[string, string[], string | null]> = [
    ['Bank of Maharashtra', [
      'File:Bank of Maharashtra logo.svg',
      'File:Maharashtra Gramin Bank new logo.png',
      'File:The Union Finance Minister, Maharashtra.jpg',
    ], 'Bank of Maharashtra logo.svg'],
    ['Yes Bank', [
      'File:Yes Bank Logo in 2024.png',
      'File:Yes Bank Logo 2024.jpg',
      'File:Yes Bank SVG Logo.svg',
    ], 'Yes Bank Logo in 2024.png'],
    ['Tata Capital', [
      'File:Tata Capital Logo-01.jpg',
      'File:TataLogo.jpg',
      'File:The chairman, Investment Company.jpg',
    ], 'Tata Capital Logo-01.jpg'],
    ['IIFL', ['File:IIFL Logo.svg', 'File:Vincolo Soprintendenza.jpg'], 'IIFL Logo.svg'],
    ['HDB Financial Services', [
      'File:Logo of the HDB Financial Services.jpg',
      'File:HDB Financial Services logo.png',
      'File:HDB Annual Report 1999-2000.pdf',
    ], 'Logo of the HDB Financial Services.jpg'],
    ['Punjab and Sind Bank', [
      'File:Punjab & Sind Bank.svg',
      'File:PSB logo 23 Nov.svg',
    ], 'Punjab & Sind Bank.svg'],
    ['South Indian Bank', ['File:South indian bank logo.png'], 'South indian bank logo.png'],
  ];
  for (const [name, titles, expected] of cases) {
    assert.equal(pickCommonsLogoHit(titles, name), expected, `failed for ${name}`);
  }
});

test('wrong-bank logos are REJECTED, photos are never picked (owner: "jo aa raha hai wo sahi ni hai")', () => {
  // Searching "Bank of India" surfaces OTHER banks' logos — must not be used.
  assert.equal(pickCommonsLogoHit(['File:Union Bank of India Logo.svg', 'File:Bank of Maharashtra logo.svg', 'File:SBI-logo.svg'], 'Bank of India'), null);
  // Karnataka Bank is NOT Karnataka Gramin Bank.
  assert.equal(pickCommonsLogoHit(['File:Karnataka Gramin Bank Logo.png'], 'Karnataka Bank'), null);
  // Building photos / press shots never pass, even when they name the bank.
  assert.equal(pickCommonsLogoHit(['File:UCO Bank 20180823.jpg'], 'UCO Bank'), null);
  assert.equal(pickCommonsLogoHit(['File:IDBI Bank headquarters.jpg'], 'IDBI Bank'), null);
  // A partial name match (TataLogo for Tata Capital) is rejected too.
  assert.equal(pickCommonsLogoHit(['File:TataLogo.jpg'], 'Tata Capital'), null);
  // "Bank of India" must NOT adopt the Reserve Bank of India's logo (live hit 22 Oct).
  assert.equal(pickCommonsLogoHit(['File:Reserve_Bank_of_India_logo.svg'], 'Bank of India'), null);
});
