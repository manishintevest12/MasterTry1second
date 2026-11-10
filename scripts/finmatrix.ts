import { buildSecureDeeplink } from '../server/affiliate/deeplink';
const urls = [
  'https://www.hdfcbank.com/personal/borrow/popular-loans/personal-loan',
  'https://www.hdfc.bank.in/credit-cards',
  'https://web.axis.bank.in/credit-card',
  'https://www.acko.com/', 'https://www.icicilombard.com/', 'https://www.kotak811.com/',
  'https://www.zurichkotak.com/', 'https://www.bobcards.com/', 'https://www.godigit.com/',
  'https://www.hdfcergo.com/', 'https://www.getditto.com/', 'https://www.bajajfinserv.in/personal-loan',
  'https://www.kreditbee.in/', 'https://www.moneyview.in/', 'https://www.bankbazaar.com/credit-card.html',
  'https://www.paisabazaar.com/personal-loan/', 'https://www.policybazaar.com/health-insurance/',
  'https://www.coverfox.com/', 'https://www.insurancedekho.com/', 'https://www.cardinsider.com/',
  'https://groww.in/mutual-funds', 'https://zerodha.com/open-account',
];
for (const u of urls) {
  const r: any = await buildSecureDeeplink(u);
  const t = String(r?.trackingUrl || '');
  const dest = t.includes('url=') ? 'deep-kept' : (t ? 'campaign-fixed' : 'direct');
  console.log(new URL(u).hostname.replace(/^www\./,'').padEnd(30), String(r?.network || 'direct').padEnd(9), String(r?.matchedProfile || '').padEnd(18), dest);
}
