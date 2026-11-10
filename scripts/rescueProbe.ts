import { rescueFetch, describeRescue } from '../server/sources/rescueFetch';
(async () => {
  const url = 'https://www.booking.com/searchresults.html?ss=Goa&checkin=2026-11-20&checkout=2026-11-23&lang=en-gb&selected_currency=INR';
  const r = await rescueFetch(url, {
    timeoutMs: 45000,
    minHtmlBytes: 5000,
    validate: (b) => /property-card/.test(b),
  });
  const cards = (r.body.match(/property-card/g) || []).length;
  const inr = (r.body.match(/(₹|INR)\s?[0-9]/g) || []).length;
  console.log('BOOKING via', r.via, '| status', r.status, '| bytes', r.body.length, '| cards', cards, '| inr', inr);
  console.log('   ', describeRescue(r).slice(0, 300));
})();
