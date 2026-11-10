/** Live finance routing after GroMo became the universal advisor exit (owner 10 Nov). */
import { affiliateNetworkFor } from '../server/affiliate/deeplink';
const D = ('axisbank.com hdfcbank.com hdfc.bank.in axis.bank.in icicibank.com kotak.com kotak811.com sbicard.com '
  + 'idfcfirstbank.com federalbank.co.in aubank.in indusind.com yesbank.in rblbank.com bobcard.co.in hsbc.co.in '
  + 'sc.com americanexpress.com bajajfinserv.in tatacapital.com hdfcergo.com icicilombard.com godigit.com acko.com '
  + 'groww.in zerodha.com navi.com policybazaar.com paisabazaar.com bankbazaar.com coverfox.com insurancedekho.com '
  + 'cardinsider.com kredit.pe getditto.com makemytrip.com myntra.com swiggy.com').split(' ');
const rows = D.map((d) => [d, affiliateNetworkFor(d) || 'direct'] as const);
for (const [d, n] of rows) console.log(d.padEnd(24), n);
console.log('\nsummary:', rows.reduce((a, [, n]) => (a[n] = (a[n] || 0) + 1, a), {} as Record<string, number>));
