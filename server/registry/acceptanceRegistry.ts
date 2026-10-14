/**
 * SECTION 16 — Mandatory source-by-source acceptance registry.
 * Every explicitly mandated source has its own entry, capability rows and a live
 * probe definition. Registration alone proves nothing: a row only earns
 * LIVE_VERIFIED when the acceptance runner extracts and validates real data.
 */
export type AcceptanceStatus =
  | 'NOT_REGISTERED' | 'REGISTERED' | 'IMPLEMENTATION_PENDING' | 'IMPLEMENTED_NOT_TESTED'
  | 'TEST_BLOCKED' | 'LIVE_TEST_FAILED' | 'PARTIALLY_VERIFIED' | 'LIVE_VERIFIED'
  | 'TEMPORARILY_UNAVAILABLE' | 'SOURCE_RETIRED';

export type ParserKind =
  | 'cardInsider'
  | 'paisabazaarCards'
  | 'amazonIn' | 'flipkart' | 'zomato' | 'booking' | 'bankbazaarLoans' | 'bankbazaarInsurance'
  | 'overpass' | 'openflights' | 'wikidata' | 'osrm' | 'openlibrary' | 'vcommission';

export interface CapabilityProbe {
  capability: string;
  /** Probe URL exercised live by the runner. */
  url: string;
  /** Implemented parser to exercise for full field-level verification, if any. */
  parser?: ParserKind;
  method?: 'GET' | 'POST';
  body?: string;
  headers?: Record<string, string>;
  /** Status override when live access is structurally impossible (no probe). */
  retiredNote?: string;
}

export interface AcceptanceTarget {
  id: string;
  name: string;
  vertical: string;
  /** 'mandated' = explicitly listed in Section 16; 'implemented' = our own live source. */
  tier: 'mandated' | 'implemented';
  probes: CapabilityProbe[];
}

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const CI = '2026-11-01';
const CO = '2026-11-02';

export const ACCEPTANCE_TARGETS: AcceptanceTarget[] = [
  // ---- 16.2 Global hotels ----
  { id: 'booking_com', name: 'Booking.com', vertical: 'hotels', tier: 'mandated', probes: [
    { capability: 'hotel search', url: `https://www.booking.com/searchresults.html?ss=Goa&checkin=${CI}&checkout=${CO}&group_adults=2&no_rooms=1`, parser: 'booking' } ] },
  { id: 'expedia', name: 'Expedia', vertical: 'hotels', tier: 'mandated', probes: [
    { capability: 'hotel search', url: 'https://www.expedia.com/Hotel-Search?destination=Goa&d1=' + CI + '&d2=' + CO } ] },
  { id: 'agoda', name: 'Agoda', vertical: 'hotels', tier: 'mandated', probes: [
    { capability: 'hotel search', url: 'https://www.agoda.com/search?city=17193&checkIn=' + CI + '&los=1' } ] },
  { id: 'trip_com', name: 'Trip.com', vertical: 'hotels', tier: 'mandated', probes: [
    { capability: 'hotel search', url: 'https://us.trip.com/hotels/list?city=32&checkin=' + CI + '&checkout=' + CO } ] },
  { id: 'priceline', name: 'Priceline', vertical: 'hotels', tier: 'mandated', probes: [
    { capability: 'hotel search', url: 'https://www.priceline.com/m/hotels/results?searchType=all&destination=Goa' } ] },
  { id: 'airbnb', name: 'Airbnb', vertical: 'hotels', tier: 'mandated', probes: [
    { capability: 'stays search', url: 'https://www.airbnb.com/s/Goa/homes' } ] },
  { id: 'hotwire', name: 'Hotwire', vertical: 'hotels', tier: 'mandated', probes: [
    { capability: 'hotel search', url: 'https://www.hotwire.com/' } ] },
  { id: 'orbitz', name: 'Orbitz', vertical: 'hotels', tier: 'mandated', probes: [
    { capability: 'hotel search', url: 'https://www.orbitz.com/Hotel-Search?destination=Goa&d1=' + CI + '&d2=' + CO } ] },
  { id: 'traveloka', name: 'Traveloka', vertical: 'hotels', tier: 'mandated', probes: [
    { capability: 'hotel search', url: 'https://www.traveloka.com/en-in/' } ] },
  { id: 'hotels_com', name: 'Hotels.com', vertical: 'hotels', tier: 'mandated', probes: [
    { capability: 'hotel search', url: 'https://www.hotels.com/search?q=Goa' } ] },
  { id: 'hostelworld', name: 'Hostelworld', vertical: 'hotels', tier: 'mandated', probes: [
    { capability: 'hostel search', url: 'https://www.hostelworld.com/st/hostels/asia/india/goa/' } ] },
  { id: 'destinia', name: 'Destinia', vertical: 'hotels', tier: 'mandated', probes: [
    { capability: 'hotel search', url: 'https://www.destinia.com/' } ] },
  { id: 'tiket_com', name: 'Tiket.com', vertical: 'hotels', tier: 'mandated', probes: [
    { capability: 'hotel search', url: 'https://www.tiket.com/hotel/search?query=Goa' } ] },
  { id: 'lastminute_com', name: 'LastMinute.com', vertical: 'hotels', tier: 'mandated', probes: [
    { capability: 'hotel search', url: 'https://www.lastminute.com/hotels/goa/' } ] },
  { id: 'marriott', name: 'Marriott Bonvoy', vertical: 'hotels', tier: 'mandated', probes: [
    { capability: 'hotel search', url: 'https://www.marriott.com/' } ] },
  { id: 'hilton', name: 'Hilton', vertical: 'hotels', tier: 'mandated', probes: [
    { capability: 'hotel search', url: 'https://www.hilton.com/' } ] },
  { id: 'ihg', name: 'IHG Hotels & Resorts', vertical: 'hotels', tier: 'mandated', probes: [
    { capability: 'hotel search', url: 'https://www.ihg.com/hotels/us/en/find-hotels' } ] },
  // ---- 16.3 Global airlines ----
  { id: 'emirates', name: 'Emirates', vertical: 'flights', tier: 'mandated', probes: [
    { capability: 'flight search', url: 'https://www.emirates.com/english/' } ] },
  { id: 'qatar_airways', name: 'Qatar Airways', vertical: 'flights', tier: 'mandated', probes: [
    { capability: 'flight search', url: 'https://www.qatarairways.com/en-in/homepage.html' } ] },
  { id: 'singapore_airlines', name: 'Singapore Airlines', vertical: 'flights', tier: 'mandated', probes: [
    { capability: 'flight search', url: 'https://www.singaporeair.com/' } ] },
  // ---- 16.4 Indian travel platforms (hotel + flight tested separately) ----
  { id: 'makemytrip', name: 'MakeMyTrip', vertical: 'hotels', tier: 'mandated', probes: [
    { capability: 'hotel search', url: 'https://www.makemytrip.com/hotels/hotel-listing/?city=CTGOI&checkin=10112026&checkout=11112026' },
    { capability: 'flight search', url: 'https://www.makemytrip.com/flight/search?itinerary=DEL-BOM-16102026' } ] },
  { id: 'goibibo', name: 'Goibibo', vertical: 'hotels', tier: 'mandated', probes: [
    { capability: 'hotel search', url: 'https://www.goibibo.com/hotels/hotels-in-goa-ct/' },
    { capability: 'flight search', url: 'https://www.goibibo.com/flights/air-DEL-BOM/' } ] },
  { id: 'easemytrip', name: 'EaseMyTrip', vertical: 'hotels', tier: 'mandated', probes: [
    { capability: 'hotel search', url: 'https://www.easemytrip.com/hotels/india/goa/' },
    { capability: 'flight search', url: 'https://www.easemytrip.com/flight-status' } ] },
  { id: 'yatra', name: 'Yatra', vertical: 'hotels', tier: 'mandated', probes: [
    { capability: 'hotel search', url: 'https://www.yatra.com/hotels/hotels-in-goa' },
    { capability: 'flight search', url: 'https://www.yatra.com/flight-schedules/del-bom' } ] },
  { id: 'cleartrip', name: 'Cleartrip', vertical: 'hotels', tier: 'mandated', probes: [
    { capability: 'hotel search', url: 'https://www.cleartrip.com/hotels/india/goa' },
    { capability: 'flight search', url: 'https://www.cleartrip.com/flights' } ] },
  { id: 'oyo_rooms', name: 'OYO Rooms', vertical: 'hotels', tier: 'mandated', probes: [
    { capability: 'hotel search', url: 'https://www.oyorooms.com/hotels-in-goa/' } ] },
  { id: 'happyeasygo', name: 'HappyEasyGo', vertical: 'hotels', tier: 'mandated', probes: [
    { capability: 'hotel search', url: 'https://www.happyeasygo.com/hotel' },
    { capability: 'flight search', url: 'https://www.happyeasygo.com/flight' } ] },
  // ---- 16.5 Indian airlines ----
  { id: 'indigo', name: 'IndiGo', vertical: 'flights', tier: 'mandated', probes: [
    { capability: 'flight search', url: 'https://www.goindigo.in/flight-booking.html' } ] },
  { id: 'air_india', name: 'Air India', vertical: 'flights', tier: 'mandated', probes: [
    { capability: 'flight search', url: 'https://www.airindia.com/' } ] },
  { id: 'akasa_air', name: 'Akasa Air', vertical: 'flights', tier: 'mandated', probes: [
    { capability: 'flight search', url: 'https://www.akasaair.com/web/book-a-flight' } ] },
  // ---- 16.6 Cabs & ride-hailing (incl. Rapido) ----
  { id: 'ola_cabs', name: 'Ola Cabs', vertical: 'cab', tier: 'mandated', probes: [
    { capability: 'cab quote', url: 'https://book.olacabs.com/?lat=12.97&lng=77.59&drop_lat=13.08&drop_lng=80.27' } ] },
  { id: 'uber_india', name: 'Uber India', vertical: 'cab', tier: 'mandated', probes: [
    { capability: 'cab quote', url: 'https://www.uber.com/in/en/' } ] },
  { id: 'indrive', name: 'inDrive', vertical: 'cab', tier: 'mandated', probes: [
    { capability: 'cab quote', url: 'https://indrive.com/' } ] },
  { id: 'blusmart', name: 'BluSmart', vertical: 'cab', tier: 'mandated', probes: [
    { capability: 'cab quote', url: 'https://blu-smart.com/' } ] },
  { id: 'rapido', name: 'Rapido', vertical: 'cab', tier: 'mandated', probes: [
    { capability: 'cab quote', url: 'https://www.rapido.bike/' } ] },
  // ---- 16.7 Bus booking ----
  { id: 'redbus', name: 'redBus', vertical: 'bus', tier: 'mandated', probes: [
    { capability: 'bus search', url: 'https://www.redbus.in/bus-tickets/bangalore-to-hyderabad' } ] },
  { id: 'abhibus', name: 'AbhiBus', vertical: 'bus', tier: 'mandated', probes: [
    { capability: 'bus search', url: 'https://www.abhibus.com/bus_search/Bangalore/3/Hyderabad/6/09-10-2026/O' } ] },
  { id: 'zingbus', name: 'Zingbus', vertical: 'bus', tier: 'mandated', probes: [
    { capability: 'bus search', url: 'https://www.zingbus.com/' } ] },
  { id: 'intrcity', name: 'IntrCity SmartBus', vertical: 'bus', tier: 'mandated', probes: [
    { capability: 'bus search', url: 'https://www.intrcity.com/' } ] },
  // ---- 16.8 E-commerce ----
  { id: 'amazon_in', name: 'Amazon India', vertical: 'ecommerce', tier: 'mandated', probes: [
    { capability: 'product search', url: 'https://www.amazon.in/s?k=iphone%2015', parser: 'amazonIn' } ] },
  { id: 'flipkart', name: 'Flipkart', vertical: 'ecommerce', tier: 'mandated', probes: [
    { capability: 'product search', url: 'https://www.flipkart.com/search?q=iphone%2015', parser: 'flipkart' } ] },
  { id: 'myntra', name: 'Myntra', vertical: 'ecommerce', tier: 'mandated', probes: [
    { capability: 'product search', url: 'https://www.myntra.com/jeans' } ] },
  { id: 'meesho', name: 'Meesho', vertical: 'ecommerce', tier: 'mandated', probes: [
    { capability: 'product search', url: 'https://www.meesho.com/jeans' } ] },
  { id: 'ajio', name: 'AJIO', vertical: 'ecommerce', tier: 'mandated', probes: [
    { capability: 'product search', url: 'https://www.ajio.com/s/jeans' } ] },
  // ---- 16.9 Quick commerce (highest priority) ----
  { id: 'blinkit', name: 'Blinkit', vertical: 'grocery', tier: 'mandated', probes: [
    { capability: 'grocery search', url: 'https://blinkit.com/s?q=milk' } ] },
  { id: 'zepto', name: 'Zepto', vertical: 'grocery', tier: 'mandated', probes: [
    { capability: 'grocery search', url: 'https://www.zeptonow.com/search?query=milk' } ] },
  { id: 'swiggy_instamart', name: 'Swiggy Instamart', vertical: 'grocery', tier: 'mandated', probes: [
    { capability: 'grocery search', url: 'https://www.swiggy.com/instamart' } ] },
  { id: 'bigbasket', name: 'BigBasket / BB Now', vertical: 'grocery', tier: 'mandated', probes: [
    { capability: 'grocery search', url: 'https://www.bigbasket.com/ps/?q=milk' } ] },
  { id: 'flipkart_minutes', name: 'Flipkart Minutes', vertical: 'grocery', tier: 'mandated', probes: [
    { capability: 'grocery search', url: 'https://www.flipkart.com/minutes-store' } ] },
  // ---- 16.10 Movies & events ----
  { id: 'bookmyshow', name: 'BookMyShow', vertical: 'movies', tier: 'mandated', probes: [
    { capability: 'movie showtimes', url: 'https://in.bookmyshow.com/explore/movies-mumbai' } ] },
  { id: 'paytm_insider', name: 'Paytm Insider', vertical: 'movies', tier: 'mandated', probes: [
    { capability: 'event discovery', url: 'https://insider.in/all-events-in-mumbai' } ] },
  { id: 'pvr_cinemas', name: 'PVR Cinemas', vertical: 'movies', tier: 'mandated', probes: [
    { capability: 'showtimes', url: 'https://www.pvrcinemas.com/' } ] },
  { id: 'cinepolis_india', name: 'Cinepolis India', vertical: 'movies', tier: 'mandated', probes: [
    { capability: 'showtimes', url: 'https://www.cinepolisindia.com/movies' } ] },
  // ---- 16.11 Loans ----
  { id: 'cashe', name: 'CASHe', vertical: 'loans', tier: 'mandated', probes: [
    { capability: 'loan products', url: 'https://www.cashe.co.in/' } ] },
  { id: 'mpokket', name: 'mPokket', vertical: 'loans', tier: 'mandated', probes: [
    { capability: 'loan products', url: 'https://www.mpokket.com/' } ] },
  { id: 'kreditbee', name: 'KreditBee', vertical: 'loans', tier: 'mandated', probes: [
    { capability: 'loan products', url: 'https://www.kreditbee.in/' } ] },
  // ---- 16.12 Insurance ----
  { id: 'acko', name: 'ACKO General Insurance', vertical: 'insurance', tier: 'mandated', probes: [
    { capability: 'insurance products', url: 'https://www.acko.com/car-insurance/' } ] },
  { id: 'digit_insurance', name: 'Digit Insurance', vertical: 'insurance', tier: 'mandated', probes: [
    { capability: 'insurance products', url: 'https://www.godigit.com/' } ] },
  { id: 'navi_insurance', name: 'Navi Insurance', vertical: 'insurance', tier: 'mandated', probes: [
    { capability: 'insurance products', url: 'https://navi.com/motor-insurance' } ] },
  // ---- 16.13 Food delivery (incl. additions) ----
  { id: 'zomato', name: 'Zomato', vertical: 'food', tier: 'mandated', probes: [
    { capability: 'restaurant discovery', url: 'https://www.zomato.com/ncr/restaurants?q=biryani', parser: 'zomato' } ] },
  { id: 'swiggy_food', name: 'Swiggy Food', vertical: 'food', tier: 'mandated', probes: [
    { capability: 'restaurant discovery', url: 'https://www.swiggy.com/' } ] },
  { id: 'eatsure', name: 'EatSure', vertical: 'food', tier: 'mandated', probes: [
    { capability: 'restaurant discovery', url: 'https://www.eatsure.com/' } ] },
  { id: 'uber_eats', name: 'Uber Eats', vertical: 'food', tier: 'mandated', probes: [
    { capability: 'restaurant discovery', url: 'https://www.ubereats.com/in', retiredNote: 'Uber Eats exited India in 2020 (business sold to Zomato); no Indian operations to test. Retired per policy 16.15.' } ] },
  { id: 'toing', name: 'Toing', vertical: 'food', tier: 'mandated', probes: [
    { capability: 'restaurant discovery', url: 'https://www.toing.com/' } ] },
  // ---- 16.14 Coupons / gift cards / banking offers ----
  { id: 'vcommission', name: 'VCommission (affiliate)', vertical: 'coupons', tier: 'implemented', probes: [
    { capability: 'affiliate offers feed', url: 'vcommission-api', parser: 'vcommission' } ] },
  { id: 'admitad', name: 'Admitad (affiliate)', vertical: 'coupons', tier: 'implemented', probes: [
    { capability: 'affiliate offers feed', url: 'admitad-api', parser: 'vcommission' } ] },
  { id: 'cuelinks', name: 'Cuelinks (affiliate)', vertical: 'coupons', tier: 'mandated', probes: [
    { capability: 'affiliate offers feed', url: 'https://www.cuelinks.com/' } ] },
  { id: 'optimise_media', name: 'Optimise Media (affiliate)', vertical: 'coupons', tier: 'mandated', probes: [
    { capability: 'affiliate offers feed', url: 'https://www.optimisemedia.com/' } ] },
  // ---- Our implemented open-data sources (capability-level proof) ----
  { id: 'openstreetmap', name: 'OpenStreetMap (Overpass)', vertical: 'hotels', tier: 'implemented', probes: [
    { capability: 'hotel discovery', url: 'overpass', parser: 'overpass' } ] },
  { id: 'openflights', name: 'OpenFlights', vertical: 'flights', tier: 'implemented', probes: [
    { capability: 'airline routes', url: 'openflights', parser: 'openflights' } ] },
  { id: 'wikidata', name: 'Wikidata', vertical: 'movies', tier: 'implemented', probes: [
    { capability: 'film releases', url: 'wikidata', parser: 'wikidata' } ] },
  { id: 'osrm', name: 'OSRM', vertical: 'cab', tier: 'implemented', probes: [
    { capability: 'route distance/duration', url: 'osrm', parser: 'osrm' } ] },
  { id: 'bankbazaar_loans', name: 'BankBazaar loans', vertical: 'loans', tier: 'implemented', probes: [
    { capability: 'lender rates', url: 'https://www.bankbazaar.com/home-loan.html', parser: 'bankbazaarLoans' } ] },
  { id: 'cardinsider', name: 'CardInsider credit cards', vertical: 'creditcards', tier: 'implemented', probes: [
    { capability: 'credit card fees and rewards', url: 'https://cardinsider.com/hdfc-bank/hdfc-bank-millennia-credit-card/', parser: 'cardInsider' } ] },
  { id: 'paisabazaar_cards', name: 'Paisabazaar credit cards', vertical: 'creditcards', tier: 'implemented', probes: [
    { capability: 'credit card fees', url: 'https://www.paisabazaar.com/axis-bank/flipkart-axis-bank-credit-card/', parser: 'paisabazaarCards' } ] },
  { id: 'bankbazaar_creditcards', name: 'BankBazaar credit cards', vertical: 'creditcards', tier: 'mandated', probes: [
    { capability: 'credit card list', url: 'https://www.bankbazaar.com/credit-card.html' } ] },
  { id: 'bankbazaar_insurance', name: 'BankBazaar insurance', vertical: 'insurance', tier: 'implemented', probes: [
    { capability: 'insurer CSR', url: 'https://www.bankbazaar.com/insurance/term-insurance.html', parser: 'bankbazaarInsurance' } ] },
  { id: 'open_library', name: 'Open Library', vertical: 'ecommerce', tier: 'implemented', probes: [
    { capability: 'book search', url: 'https://openlibrary.org/search.json?q=atomic%20habits&limit=5', parser: 'openlibrary' } ] },
];
