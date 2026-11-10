/** Which finance merchants already pay through a GroMo advisor link, and which still fall through. */
import { affiliateNetworkFor } from '../server/affiliate/deeplink';
const D = 'axisbank.com hdfcbank.com icicibank.com kotak.com kotak811.com sbicard.com idfcfirstbank.com federalbank.co.in aubank.in indusind.com yesbank.in rblbank.com bobcard.co.in hsbc.co.in sc.com americanexpress.com bajajfinserv.in tatacapital.com hdfcergo.com icicilombard.com godigit.com acko.com policybazaar.com paisabazaar.com bankbazaar.com coverfox.com insurancedekho.com cardinsider.com kredit.pe groww.in zerodha.com'.split(' ');
for (const d of D) console.log(d.padEnd(24), affiliateNetworkFor(d) || 'direct');
