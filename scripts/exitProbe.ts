import { buildSecureDeeplink } from '../server/affiliate/deeplink';
const urls = [
  'https://www.cleartrip.com/hotels/india/indore-hotels',
  'https://www.cleartrip.com/flights/results?from=IDR&to=DEL',
  'https://www.nykaa.com/skin/c/8377',
  'https://www.makemytrip.com/hotels/',
  'https://www.booking.com/searchresults.html?ss=Indore',
  'https://www.redbus.in/bus-tickets',
  'https://www.yatra.com/flights',
];
for (const u of urls) {
  const r: any = await buildSecureDeeplink(u, { vertical: 'hotels' } as any);
  console.log(u.slice(8, 52).padEnd(46), String(r?.network).padEnd(11), String(r?.trackingUrl || '').slice(0, 78));
}
