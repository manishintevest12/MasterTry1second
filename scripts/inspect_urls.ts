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
  } catch (err: any) {
    console.log(`Error: ${err.message}`);
  }
}

async function main() {
  await inspect('https://www.paisabazaar.com/personal-loan/interest-rates/', 'Paisabazaar Loans');
  await inspect('https://www.policybazaar.com/personal-loan/', 'Policybazaar Loans');
  await inspect('https://www.policybazaar.com/health-insurance/', 'Policybazaar Insurance');
  await inspect('https://www.acko.com/health-insurance/', 'Acko Insurance');
  await inspect('https://www.insurancedekho.com/health-insurance', 'InsuranceDekho Insurance');
}

main().catch(console.error);
