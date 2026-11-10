import { buildSecureDeeplink } from '../server/affiliate/deeplink';
const cases = [
  ['cleartrip.com/hotels', 'https://www.cleartrip.com/hotels'],
  ['makemytrip flights', 'https://www.makemytrip.com/flights/'],
  ['goibibo hotels', 'https://www.goibibo.com/hotels/'],
  ['easemytrip', 'https://www.easemytrip.com/hotels/'],
  ['nykaa', 'https://www.nykaa.com/skin/c/8377'],
  ['croma', 'https://www.croma.com/mobiles/c/1'],
  ['myntra (pending)', 'https://www.myntra.com/men-tshirts'],
  ['ajio (pending)', 'https://www.ajio.com/s/men-tshirts'],
  ['flipkart (pending)', 'https://www.flipkart.com/search?q=shoes'],
  ['redbus (applied)', 'https://www.redbus.in/bus-tickets'],
  ['yatra', 'https://www.yatra.com/flights'],
  ['bookmyshow', 'https://in.bookmyshow.com/explore/movies-bengaluru'],
  ['booking (cj)', 'https://www.booking.com/searchresults.html?ss=Indore'],
  ['bankbazaar (finance)', 'https://www.bankbazaar.com/personal-loan.html'],
];
for (const [name, u] of cases) {
  const r: any = await buildSecureDeeplink(u, { vertical: 'hotels' } as any);
  const t = String(r?.trackingUrl || '');
  console.log(name.padEnd(22), String(r?.network || 'direct').padEnd(10), (t.match(/^https:\/\/([^/]+)/)?.[1] || '').padEnd(24), t.includes(encodeURIComponent(u)) ? 'DEEP-OK' : 'DEEP-LOST');
}
