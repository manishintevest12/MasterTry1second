/** Renders artifacts/affiliate-coverage.json into the partnership-gap PDF (owner 10 Nov). */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const data = JSON.parse(readFileSync('artifacts/affiliate-coverage.json', 'utf8'));
const rows: { domain: string; verticals: string; network: string | null }[] = data.rows;

const ROUTE: Record<string, string> = {
  flights: 'Cuelinks/Admitad me airline+OTA campaign, warna direct partner program (airline ka apna program rarely)',
  hotels: 'Booking.com affiliate, Agoda partners, Expedia via Impact; OYO/chain hotels direct',
  bus: 'redBus/AbhiBus/zingbus Cuelinks ya Admitad campaign',
  cab: 'CPA nahi milta — referral/CPL deal ya ads only',
  ecommerce: 'Cuelinks/Admitad campaign ya direct program (Flipkart Affiliate, Amazon Associates)',
  grocery: 'BigBasket/Zepto/Blinkit: network campaign (kam), warna ads only',
  food: 'Aggregator affiliate approve nahi karte — ads only',
  movies: 'BookMyShow/PVR/District network campaign',
  loans: 'BankBazaar/Paisabazaar publisher program (CPL) — sabse high payout',
  creditcards: 'BankBazaar/Paisabazaar/SBICard direct + cardinsider network',
  insurance: 'PolicyBazaar/Coverfox/InsuranceDekho/Ditto publisher (CPL)',
  account: 'BankBazaar/Groww/Zerodha referral',
  other: 'manual review',
};

const uncovered = rows.filter((r) => !r.network);
const covered = rows.filter((r) => r.network);
const byVertical = new Map<string, string[]>();
for (const r of uncovered) {
  const v = (r.verticals.split(', ')[0] || 'other').trim();
  if (!byVertical.has(v)) byVertical.set(v, []);
  byVertical.get(v)!.push(r.domain);
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const coveredRows = covered.map((r) => `<tr><td>${esc(r.domain)}</td><td>${esc(r.network!)}</td><td>${esc(r.verticals)}</td></tr>`).join('');

const sections = [...byVertical.entries()]
  .sort((a, b) => b[1].length - a[1].length)
  .map(([v, domains]) => `
  <h3>${esc(v)} <span class="count">${domains.length} merchants</span></h3>
  <table><thead><tr><th style="width:34%">Merchant domain</th><th>Kaise pursue karein</th></tr></thead>
  ${domains.map((d) => `<tr><td>${esc(d)}</td><td>${esc(ROUTE[v] || ROUTE.other)}</td></tr>`).join('')}
  </table>`)
  .join('');

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Try1Second — Affiliate Network Coverage & Partnership Gaps</title>
<style>
@page{size:A4;margin:16mm 14mm}
body{font:10.4pt/1.5 "Segoe UI",-apple-system,Roboto,Arial,sans-serif;color:#0f172a;margin:0}
h1{font-size:21pt;margin:0 0 4px;letter-spacing:-.4px}
h2{font-size:13pt;margin:20px 0 6px;border-bottom:2px solid #e7000b;padding-bottom:3px}
h3{font-size:10.6pt;margin:12px 0 4px}
.count{font-weight:400;color:#64748b;font-size:9pt}
.sub{color:#64748b;font-size:9.4pt;margin-bottom:12px}
table{width:100%;border-collapse:collapse;font-size:8.9pt;margin-bottom:8px}
th{text-align:left;background:#f1f5f9}
th,td{border:1px solid #e2e8f0;padding:4px 5px;vertical-align:top}
tr{page-break-inside:avoid}
.kpi{display:flex;gap:10px;margin:10px 0}
.kpi div{flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:8px 9px}
.kpi b{display:block;font-size:15pt;line-height:1.1}
.kpi span{font-size:8.2pt;color:#64748b;text-transform:uppercase;letter-spacing:.06em}
.note{background:#fff7ed;border-left:3px solid #f59e0b;padding:8px 10px;font-size:9.2pt;margin:8px 0}
.ok{color:#047857;font-weight:700}
footer{margin-top:14px;border-top:1px solid #e2e8f0;padding-top:7px;font-size:8.2pt;color:#64748b}
</style></head><body>
<h1>Affiliate Network Coverage &amp; Partnership Gaps</h1>
<div class="sub">10 November 2026 · har merchant ka routing code aur environment se nikala gaya (affiliateNetworkFor) · try1second.com</div>

<div class="kpi">
  <div><span>Merchant domains scan kiye</span><b>${data.total}</b></div>
  <div><span>Kisi network se covered</span><b class="ok">${data.covered}</b></div>
  <div><span>Kahin se nahi (targets)</span><b>${data.uncovered}</b></div>
</div>

<div class="note"><b>Routing kaise kaam karta hai ab:</b> har exit pehle admin override dekhta hai, phir Amazon tag, phir
wahi network jo us merchant ko claim karta hai — Admitad (<code>ADMITAD_MERCHANTS</code> + <code>ADMITAD_LINK_TEMPLATE</code>),
VCommission, INRDeals, Cuelinks, LinkInR, Ekaro/EarnKaro — aur agar koi nahi, to seedha merchant.
Ek merchant sirf ek hi network se paisa deta hai, isliye double attribution nahi hota.
Admin dashboard (<code>affiliate_configs</code>) se kisi bhi merchant ko manually kisi bhi network pe override kar sakte hain.</div>

<h2>1. Abhi kaun paisa de raha hai (${covered.length})</h2>
<table><thead><tr><th style="width:40%">Merchant</th><th style="width:22%">Network</th><th>Vertical</th></tr></thead>${coveredRows}</table>

<h2>2. Jo kahin se nahi hai — partnership target list (${uncovered.length})</h2>
<p>Ye domains engine exit kar sakta hai, par abhi kisi joined affiliate network me nahi hain, isliye in par click ₹0 dega.
Vertical-wise grouped hain, saath me har category ke liye pursue karne ka raasta.</p>
${sections}

<h2>3. Agla kadam</h2>
<ol>
<li><b>Finance pehle</b> (${(byVertical.get('loans') || []).length + (byVertical.get('creditcards') || []).length + (byVertical.get('insurance') || []).length + (byVertical.get('account') || []).length} domains): BankBazaar/Paisabazaar/PolicyBazaar publisher programs — CPA sabse zyada.</li>
<li><b>Travel/OTA</b> (${(byVertical.get('flights') || []).length + (byVertical.get('hotels') || []).length + (byVertical.get('bus') || []).length} domains): Cuelinks/Admitad me campaign join, phir domain <code>CUELINKS_EXTRA_MERCHANTS</code> ya us network ke <code>*_MERCHANTS</code> me daal dein.</li>
<li><b>Chain hotels</b> (Marriott/Hilton/Accor/ITC/Taj): inke apne partner programs hain (Impact/partner portals) — direct onboarding better hai.</li>
<li><b>Airlines</b>: koi public affiliate nahi — in par sirf ads, isliye affiliate effort waste na karein.</li>
<li><b>Har join ke baad</b> wahi domain env me add karein — dobara code deploy nahi chahiye.</li>
</ol>

<footer>Report generated 10 Nov 2026 from the live routing code (server/affiliate/deeplink.ts: affiliateNetworkFor) + current environment.
Ek caveat: admin <code>affiliate_configs</code> rows production MySQL me hain aur yahan readable nahi hain, isliye jis merchant ka wahan manual row hai
wo paid ho sakta hai chahe yahan "none" dikhe. Baaki saare layers (Cuelinks allow-list, Amazon tag, LinkInR sheet, Ekaro key, env networks) exact hain.</footer>
</body></html>`;

writeFileSync('artifacts/affiliate-coverage.html', html);
execFileSync('google-chrome', ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-pdf-header-footer',
  '--print-to-pdf=artifacts/affiliate-coverage.pdf', `file://${process.cwd()}/artifacts/affiliate-coverage.html`], { stdio: 'ignore' });
console.log('pdf written');
