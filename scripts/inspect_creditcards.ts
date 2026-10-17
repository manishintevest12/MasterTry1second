import { cffiFetch } from '../server/common/curlCffiFetch';
import * as cheerio from 'cheerio';

async function inspect(url: string, name: string) {
  console.log(`\n--- Fetching ${name}: ${url} ---`);
  try {
    const r = await cffiFetch(url, { impersonate: 'chrome', timeoutMs: 15_000 });
    console.log(`Status: ${r.status}, Body length: ${r.body.length}`);
    const $ = cheerio.load(r.body);
    const tables = $('table');
    console.log(`Tables found: ${tables.length}`);
    tables.each((i, t) => {
      const rows = $(t).find('tr');
      console.log(`  Table ${i}: ${rows.length} rows`);
      rows.slice(0, 3).each((j, tr) => {
        const text = $(tr).text().replace(/\s+/g, ' ').trim();
        console.log(`    Row ${j}: ${text.slice(0, 120)}`);
      });
    });
    // also check for card links or headings
    const cardLinks = $('a[href*="credit-card"]');
    console.log(`Card links count: ${cardLinks.length}`);
  } catch (err: any) {
    console.log(`Error: ${err.message}`);
  }
}

async function main() {
  await inspect('https://www.bankbazaar.com/credit-card.html', 'BankBazaar Credit Cards');
  await inspect('https://www.bankbazaar.com/hdfc-bank-credit-card.html', 'BankBazaar HDFC CC');
  await inspect('https://cardinsider.com/hdfc-bank/', 'CardInsider HDFC');
  await inspect('https://www.paisabazaar.com/hdfc-bank/credit-card/', 'Paisabazaar HDFC');
}

main().catch(console.error);
