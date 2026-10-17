import { cffiFetch } from '../server/common/curlCffiFetch';

const PROFILES = ['chrome', 'safari', 'safari17_0', 'firefox', 'edge'];

const URLS = [
  // LOANS
  { name: 'Paisabazaar Loans', url: 'https://www.paisabazaar.com/personal-loan/interest-rates/' },
  { name: 'Bajaj Finserv Loans', url: 'https://www.bajajfinserv.in/personal-loan-processing-fees-and-interest-rates' },
  { name: 'HDFC Bank Loans', url: 'https://www.hdfcbank.com/personal/borrow/popular-loans/personal-loan/interest-rates-and-charges' },
  { name: 'Money View Loans', url: 'https://moneyview.in/personal-loan-interest-rates-and-charges' },
  { name: 'KreditBee Loans', url: 'https://www.kreditbee.in/personal-loan' },
  { name: 'Policybazaar Loans', url: 'https://www.policybazaar.com/personal-loan/' },
  { name: 'BankBazaar Loans', url: 'https://www.bankbazaar.com/personal-loan.html' },
  { name: 'Navi Loans', url: 'https://navi.com/personal-loan' },

  // INSURANCE
  { name: 'Policybazaar Insurance', url: 'https://www.policybazaar.com/health-insurance/' },
  { name: 'Acko Insurance', url: 'https://www.acko.com/health-insurance/' },
  { name: 'Digit Insurance', url: 'https://www.godigit.com/health-insurance' },
  { name: 'HDFC Ergo Insurance', url: 'https://www.hdfcergo.com/health-insurance' },
  { name: 'InsuranceDekho Insurance', url: 'https://www.insurancedekho.com/health-insurance' },
  { name: 'BankBazaar Insurance', url: 'https://www.bankbazaar.com/insurance/health-insurance.html' },
  { name: 'Ditto Insurance', url: 'https://www.getditto.com/' },
  { name: 'Coverfox Insurance', url: 'https://www.coverfox.com/health-insurance/' },

  // CREDIT CARDS
  { name: 'CardInsider HDFC', url: 'https://cardinsider.com/hdfc-bank/' },
  { name: 'Paisabazaar HDFC CC', url: 'https://www.paisabazaar.com/hdfc-bank/credit-card/' },
  { name: 'BankBazaar CC', url: 'https://www.bankbazaar.com/credit-card.html' },
];

async function main() {
  for (const item of URLS) {
    console.log(`\n=== Testing ${item.name} (${item.url}) ===`);
    for (const p of PROFILES) {
      try {
        const start = Date.now();
        const res = await cffiFetch(item.url, { impersonate: p, timeoutMs: 10_000 });
        console.log(`  [${p.padEnd(10)}] status: ${res.status}, len: ${res.body?.length || 0} (${Date.now() - start}ms)`);
      } catch (err: any) {
        console.log(`  [${p.padEnd(10)}] error: ${err.message}`);
      }
    }
  }
}

main().catch(console.error);
