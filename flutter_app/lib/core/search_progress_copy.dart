/// SearchProgress copy (owner 27 Oct, screenshots of three reference designs):
/// the ONE loading experience for every vertical in the app.
///
/// Owner's words: "jb load ho tho aise aaye jiss se user ko maalum ho ki search
/// ho raha hai ... please wait we are getting the best deal for you, comparing
/// prices across the web at warp speed your ultimate steal is arriving — but
/// instead of count down".
///
/// So the 3-2-1 countdown is gone. What shows instead is real, visible progress:
/// a vertical-appropriate heading, a live green-dot pill naming the source being
/// queried right now, a hard "7 of 9 sites" count, an advancing bar and
/// result-shaped skeleton cards.
///
/// Every name below is a site this app genuinely queries (the owner-mandated
/// source list), so "Checking Croma…" is never decoration.
library;

class SearchCopy {
  final String heading;
  final String sub;
  final String unit;
  final List<String> sources;
  const SearchCopy({
    required this.heading,
    required this.sub,
    required this.unit,
    required this.sources,
  });
}

const _fallback = SearchCopy(
  heading: 'Finding your best deal…',
  sub: 'Comparing prices across the web at warp speed. Your ultimate steal is on its way.',
  unit: 'sites',
  sources: ['our sources'],
);

const Map<String, SearchCopy> kSearchCopy = {
  'flights': SearchCopy(
    heading: 'Finding your best fare…',
    sub: 'Every airline and booking site prices the same seat differently. We are checking them all right now.',
    unit: 'airlines & booking sites',
    sources: ['Air India', 'IndiGo', 'Akasa Air', 'SpiceJet', 'MakeMyTrip', 'EaseMyTrip', 'Ixigo', 'Yatra', 'Cleartrip'],
  ),
  'hotels': SearchCopy(
    heading: 'Finding your best room rate…',
    sub: 'Booking sites do not always agree. We are finding out who is cheapest right now.',
    unit: 'hotels & booking sites',
    sources: ['MakeMyTrip', 'Goibibo', 'Booking.com', 'Agoda', 'Yatra', 'Cleartrip', 'EaseMyTrip', 'OYO', 'SaffronStays'],
  ),
  'bus': SearchCopy(
    heading: 'Finding your best seat price…',
    sub: 'Every operator, every boarding point, every site. Checking them all now.',
    unit: 'operators & booking sites',
    sources: ['redBus', 'AbhiBus', 'MakeMyTrip', 'Yatra', 'Ixigo'],
  ),
  'cab': SearchCopy(
    heading: 'Finding your best fare…',
    sub: 'Each cab app quotes differently for the same ride. Comparing all of them now.',
    unit: 'cab apps',
    sources: ['Ola', 'Uber', 'inDrive', 'Meru', 'Snap-E'],
  ),
  'ecommerce': SearchCopy(
    heading: 'Finding your best price…',
    sub: 'The same product is priced differently on every store. We are checking them all right now.',
    unit: 'stores',
    sources: ['Amazon India', 'Flipkart', 'Meesho', 'Myntra', 'Ajio', 'Tata CLiQ', 'Croma', 'Reliance Digital', 'JioMart'],
  ),
  'grocery': SearchCopy(
    heading: 'Finding your best basket price…',
    sub: 'Every 10-minute store near you is quoting right now. Comparing all of them.',
    unit: 'quick stores',
    sources: ['Blinkit', 'Zepto', 'Swiggy Instamart', 'BigBasket', 'Flipkart Minutes', 'JioMart'],
  ),
  'food': SearchCopy(
    heading: 'Finding your best meal deal…',
    sub: 'Restaurants price the same dish differently on each app. Checking them all.',
    unit: 'apps & restaurants',
    sources: ['Zomato', 'Swiggy', "Domino's", 'Oven Story', 'EatSure'],
  ),
  'movie': SearchCopy(
    heading: 'Finding your cheapest tickets…',
    sub: 'Same film, same seat, different price on every booking site. Comparing now.',
    unit: 'cinemas & booking sites',
    sources: ['BookMyShow', 'District', 'Paytm', 'PVR INOX', 'Cinepolis', 'TicketNew'],
  ),
  'loans': SearchCopy(
    heading: 'Finding your best rate…',
    sub: 'Banks rarely advertise their cheapest rate. We are checking anyway.',
    unit: 'lenders',
    sources: ['Paisabazaar', 'BankBazaar', 'Policybazaar', 'Money View', 'KreditBee', 'Navi'],
  ),
  'insurance': SearchCopy(
    heading: 'Finding your best premium…',
    sub: 'The same cover costs different amounts everywhere. Comparing all of them now.',
    unit: 'insurers',
    sources: ['Policybazaar', 'Ditto', 'InsuranceDekho', 'Acko', 'Digit', 'Coverfox'],
  ),
  'creditcards': SearchCopy(
    heading: 'Finding your best card…',
    sub: 'Rewards, fees, waivers. We are reading every card on every site right now.',
    unit: 'cards & marketplaces',
    sources: ['Paisabazaar', 'BankBazaar', 'Policybazaar', 'Card Insider', 'CreditMantri'],
  ),
  'account': SearchCopy(
    heading: 'Finding your best account…',
    sub: 'Savings rates, minimum balance and perks, compared live across banks.',
    unit: 'banks',
    sources: ['Paisabazaar', 'BankBazaar', 'Policybazaar', 'HDFC Bank', 'ICICI Bank', 'SBI'],
  ),
};

SearchCopy searchCopyFor(String? verticalId) => kSearchCopy[verticalId] ?? _fallback;
