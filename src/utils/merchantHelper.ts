/**
 * Merchant detection helper: maps outbound hostnames, full URLs, or site names
 * to deals-registry merchant slugs (e.g. 'amazon', 'flipkart', 'tatacliq', 'swiggy').
 */

export function merchantKeyFor(input: string): string {
  if (!input) return '';
  let s = String(input).trim().toLowerCase();

  // If full URL, extract hostname
  if (s.includes('://')) {
    try {
      s = new URL(s).hostname;
    } catch {
      s = s.split('://')[1].split('/')[0];
    }
  } else if (s.includes('/') && !s.includes(' ')) {
    s = s.split('/')[0];
  }

  // Strip leading www. and trailing port
  s = s.replace(/^www\./, '').split(':')[0];

  const map: Record<string, string> = {
    'amazon india': 'amazon',
    'swiggy instamart': 'swiggy',
    "domino's india": 'dominos',
    'dominos india': 'dominos',
    "domino's pizza": 'dominos',
    'dominos pizza': 'dominos',
    "domino's": 'dominos',
    'dominos': 'dominos',
    'tata cliq': 'tatacliq',
    'tatacliq': 'tatacliq',
    'book my show': 'bookmyshow',
    'bookmyshow': 'bookmyshow',
    'make my trip': 'makemytrip',
    'makemytrip': 'makemytrip',
    'go ibibo': 'goibibo',
    'goibibo': 'goibibo',
    'ease my trip': 'easemytrip',
    'easemytrip': 'easemytrip',
    'big basket': 'bigbasket',
    'bigbasket': 'bigbasket',
  };

  if (map[s]) return map[s];

  // Map known domain fragments directly
  if (s.includes('amazon.')) return 'amazon';
  if (s.includes('flipkart.')) return 'flipkart';
  if (s.includes('myntra.')) return 'myntra';
  if (s.includes('ajio.')) return 'ajio';
  if (s.includes('tatacliq.')) return 'tatacliq';
  if (s.includes('meesho.')) return 'meesho';
  if (s.includes('bigbasket.')) return 'bigbasket';
  if (s.includes('blinkit.')) return 'blinkit';
  if (s.includes('zepto')) return 'zepto';
  if (s.includes('jiomart.')) return 'jiomart';
  if (s.includes('swiggy.')) return 'swiggy';
  if (s.includes('zomato.')) return 'zomato';
  if (s.includes('dominos.')) return 'dominos';
  if (s.includes('bookmyshow.')) return 'bookmyshow';
  if (s.includes('makemytrip.')) return 'makemytrip';
  if (s.includes('goibibo.')) return 'goibibo';
  if (s.includes('easemytrip.')) return 'easemytrip';
  if (s.includes('yatra.')) return 'yatra';
  if (s.includes('cleartrip.')) return 'cleartrip';
  if (s.includes('redbus.')) return 'redbus';
  if (s.includes('abhibus.')) return 'abhibus';

  // Strip common TLDs
  s = s.replace(/\.(com|in|co\.in|org|net|store|io|app)\b/g, '');

  const alias: Record<string, string> = {
    amzn: 'amazon',
    tata: 'tatacliq',
    bms: 'bookmyshow',
    book: 'bookmyshow',
    mmt: 'makemytrip',
  };

  const clean = s.replace(/[^a-z0-9]/g, '');
  if (alias[clean]) return alias[clean];

  // Check substring matches for known merchant slugs
  const knownMerchants = [
    'amazon', 'flipkart', 'makemytrip', 'goibibo', 'blinkit', 'zomato',
    'swiggy', 'tatacliq', 'myntra', 'ajio', 'meesho', 'bigbasket', 'zepto',
    'jiomart', 'dominos', 'bookmyshow', 'easemytrip', 'yatra', 'cleartrip',
    'redbus', 'abhibus', 'croma', 'nykaa', 'pvr'
  ];

  for (const m of knownMerchants) {
    if (clean === m || clean.includes(m)) return m;
  }

  return clean;
}
