class PlaceItem {
  final String city;
  final String country;
  final String airport;
  final String iata;

  const PlaceItem({
    required this.city,
    required this.country,
    required this.airport,
    required this.iata,
  });

  String get formatted => '$city ($iata)';
}

const kIndianAirports = <PlaceItem>[
  PlaceItem(city: 'Mumbai', country: 'India', airport: 'Chhatrapati Shivaji Maharaj International Airport', iata: 'BOM'),
  PlaceItem(city: 'New Delhi', country: 'India', airport: 'Indira Gandhi International Airport', iata: 'DEL'),
  PlaceItem(city: 'Bengaluru', country: 'India', airport: 'Kempegowda International Airport', iata: 'BLR'),
  PlaceItem(city: 'Hyderabad', country: 'India', airport: 'Rajiv Gandhi International Airport', iata: 'HYD'),
  PlaceItem(city: 'Chennai', country: 'India', airport: 'Chennai International Airport', iata: 'MAA'),
  PlaceItem(city: 'Kolkata', country: 'India', airport: 'Netaji Subhash Chandra Bose International Airport', iata: 'CCU'),
  PlaceItem(city: 'Pune', country: 'India', airport: 'Pune Airport', iata: 'PNQ'),
  PlaceItem(city: 'Ahmedabad', country: 'India', airport: 'Sardar Vallabhbhai Patel International Airport', iata: 'AMD'),
  PlaceItem(city: 'Goa (Mopa)', country: 'India', airport: 'Manohar International Airport', iata: 'GOX'),
  PlaceItem(city: 'Goa (Dabolim)', country: 'India', airport: 'Dabolim Airport', iata: 'GOI'),
  PlaceItem(city: 'Jaipur', country: 'India', airport: 'Jaipur International Airport', iata: 'JAI'),
  PlaceItem(city: 'Lucknow', country: 'India', airport: 'Chaudhary Charan Singh International Airport', iata: 'LKO'),
  PlaceItem(city: 'Chandigarh', country: 'India', airport: 'Shaheed Bhagat Singh International Airport', iata: 'IXC'),
  PlaceItem(city: 'Guwahati', country: 'India', airport: 'Lokpriya Gopinath Bordoloi International Airport', iata: 'GAU'),
  PlaceItem(city: 'Varanasi', country: 'India', airport: 'Lal Bahadur Shastri International Airport', iata: 'VNS'),
  PlaceItem(city: 'Amritsar', country: 'India', airport: 'Sri Guru Ram Dass Jee International Airport', iata: 'ATQ'),
  PlaceItem(city: 'Indore', country: 'India', airport: 'Devi Ahilya Bai Holkar Airport', iata: 'IDR'),
  PlaceItem(city: 'Bhopal', country: 'India', airport: 'Raja Bhoj Airport', iata: 'BHO'),
  PlaceItem(city: 'Coimbatore', country: 'India', airport: 'Coimbatore International Airport', iata: 'CJB'),
  PlaceItem(city: 'Kochi', country: 'India', airport: 'Cochin International Airport', iata: 'COK'),
  PlaceItem(city: 'Thiruvananthapuram', country: 'India', airport: 'Trivandrum International Airport', iata: 'TRV'),
  PlaceItem(city: 'Visakhapatnam', country: 'India', airport: 'Visakhapatnam Airport', iata: 'VTZ'),
  PlaceItem(city: 'Patna', country: 'India', airport: 'Jay Prakash Narayan Airport', iata: 'PAT'),
  PlaceItem(city: 'Bhubaneswar', country: 'India', airport: 'Biju Patnaik International Airport', iata: 'BBI'),
  PlaceItem(city: 'Srinagar', country: 'India', airport: 'Sheikh ul-Alam International Airport', iata: 'SXR'),
  PlaceItem(city: 'Jammu', country: 'India', airport: 'Jammu Airport', iata: 'IXJ'),
  PlaceItem(city: 'Leh', country: 'India', airport: 'Kushok Bakula Rimpochee Airport', iata: 'IXL'),
  PlaceItem(city: 'Dehradun', country: 'India', airport: 'Jolly Grant Airport', iata: 'DED'),
  PlaceItem(city: 'Udaipur', country: 'India', airport: 'Maharana Pratap Airport', iata: 'UDR'),
  PlaceItem(city: 'Jodhpur', country: 'India', airport: 'Jodhpur Airport', iata: 'JDH'),
  PlaceItem(city: 'Bagdogra', country: 'India', airport: 'Bagdogra Airport', iata: 'IXB'),
  PlaceItem(city: 'Port Blair', country: 'India', airport: 'Veer Savarkar International Airport', iata: 'IXZ'),
  PlaceItem(city: 'Kozhikode', country: 'India', airport: 'Calicut International Airport', iata: 'CCJ'),
  PlaceItem(city: 'Kannur', country: 'India', airport: 'Kannur International Airport', iata: 'CNN'),
  PlaceItem(city: 'Vijayawada', country: 'India', airport: 'Vijayawada International Airport', iata: 'VGA'),
  PlaceItem(city: 'Tirupati', country: 'India', airport: 'Tirupati Airport', iata: 'TIR'),
  PlaceItem(city: 'Surat', country: 'India', airport: 'Surat International Airport', iata: 'STV'),
  PlaceItem(city: 'Vadodara', country: 'India', airport: 'Vadodara Airport', iata: 'BDQ'),
  PlaceItem(city: 'Rajkot', country: 'India', airport: 'Rajkot International Airport', iata: 'HSR'),
  PlaceItem(city: 'Nashik', country: 'India', airport: 'Nashik Airport', iata: 'ISK'),
  PlaceItem(city: 'Aurangabad', country: 'India', airport: 'Chhatrapati Sambhaji Nagar Airport', iata: 'IXU'),
  PlaceItem(city: 'Shirdi', country: 'India', airport: 'Shirdi International Airport', iata: 'SAG'),
  PlaceItem(city: 'Kolhapur', country: 'India', airport: 'Kolhapur Airport', iata: 'KLH'),
  PlaceItem(city: 'Jabalpur', country: 'India', airport: 'Dumna Airport', iata: 'JLR'),
  PlaceItem(city: 'Gwalior', country: 'India', airport: 'Gwalior Airport', iata: 'GWL'),
  PlaceItem(city: 'Ranchi', country: 'India', airport: 'Birsa Munda Airport', iata: 'IXR'),
  PlaceItem(city: 'Raipur', country: 'India', airport: 'Swami Vivekananda Airport', iata: 'RPR'),
  PlaceItem(city: 'Gaya', country: 'India', airport: 'Gaya Airport', iata: 'GAY'),
  PlaceItem(city: 'Agartala', country: 'India', airport: 'Maharaja Bir Bikram Airport', iata: 'IXA'),
  PlaceItem(city: 'Imphal', country: 'India', airport: 'Bir Tikendrajit International Airport', iata: 'IMF'),
  PlaceItem(city: 'Dibrugarh', country: 'India', airport: 'Dibrugarh Airport', iata: 'DIB'),
  PlaceItem(city: 'Silchar', country: 'India', airport: 'Silchar Airport', iata: 'IXS'),
  PlaceItem(city: 'Dimapur', country: 'India', airport: 'Dimapur Airport', iata: 'DMU'),
  PlaceItem(city: 'Aizawl', country: 'India', airport: 'Lengpui Airport', iata: 'AJL'),
  PlaceItem(city: 'Shillong', country: 'India', airport: 'Shillong Airport', iata: 'SHL'),
  PlaceItem(city: 'Hubli', country: 'India', airport: 'Hubballi Airport', iata: 'HBX'),
  PlaceItem(city: 'Belgaum', country: 'India', airport: 'Belagavi Airport', iata: 'IXG'),
  PlaceItem(city: 'Mangalore', country: 'India', airport: 'Mangaluru International Airport', iata: 'IXE'),
  PlaceItem(city: 'Madurai', country: 'India', airport: 'Madurai Airport', iata: 'IXM'),
  PlaceItem(city: 'Tiruchirappalli', country: 'India', airport: 'Tiruchirappalli International Airport', iata: 'TRZ'),
];

const kInternationalAirports = <PlaceItem>[
  PlaceItem(city: 'Dubai', country: 'UAE', airport: 'Dubai International Airport', iata: 'DXB'),
  PlaceItem(city: 'London', country: 'United Kingdom', airport: 'London Heathrow Airport', iata: 'LHR'),
  PlaceItem(city: 'Singapore', country: 'Singapore', airport: 'Changi Airport', iata: 'SIN'),
  PlaceItem(city: 'Bangkok', country: 'Thailand', airport: 'Suvarnabhumi Airport', iata: 'BKK'),
  PlaceItem(city: 'Kuala Lumpur', country: 'Malaysia', airport: 'Kuala Lumpur International Airport', iata: 'KUL'),
  PlaceItem(city: 'Doha', country: 'Qatar', airport: 'Hamad International Airport', iata: 'DOH'),
  PlaceItem(city: 'Abu Dhabi', country: 'UAE', airport: 'Zayed International Airport', iata: 'AUH'),
  PlaceItem(city: 'New York', country: 'United States', airport: 'John F. Kennedy International Airport', iata: 'JFK'),
  PlaceItem(city: 'San Francisco', country: 'United States', airport: 'San Francisco International Airport', iata: 'SFO'),
  PlaceItem(city: 'Toronto', country: 'Canada', airport: 'Toronto Pearson International Airport', iata: 'YYZ'),
  PlaceItem(city: 'Sydney', country: 'Australia', airport: 'Sydney Kingsford Smith Airport', iata: 'SYD'),
  PlaceItem(city: 'Tokyo', country: 'Japan', airport: 'Tokyo Haneda Airport', iata: 'HND'),
  PlaceItem(city: 'Paris', country: 'France', airport: 'Paris Charles de Gaulle Airport', iata: 'CDG'),
  PlaceItem(city: 'Frankfurt', country: 'Germany', airport: 'Frankfurt Airport', iata: 'FRA'),
  PlaceItem(city: 'Istanbul', country: 'Turkey', airport: 'Istanbul Airport', iata: 'IST'),
  PlaceItem(city: 'Colombo', country: 'Sri Lanka', airport: 'Bandaranaike International Airport', iata: 'CMB'),
  PlaceItem(city: 'Malé', country: 'Maldives', airport: 'Velana International Airport', iata: 'MLE'),
  PlaceItem(city: 'Bali', country: 'Indonesia', airport: 'Ngurah Rai International Airport', iata: 'DPS'),
  PlaceItem(city: 'Kathmandu', country: 'Nepal', airport: 'Tribhuvan International Airport', iata: 'KTM'),
  PlaceItem(city: 'Dhaka', country: 'Bangladesh', airport: 'Hazrat Shahjalal International Airport', iata: 'DAC'),
];

List<PlaceItem> get kAllAirports => [...kIndianAirports, ...kInternationalAirports];

List<PlaceItem> searchAirports(String query) {
  final q = query.trim().toLowerCase();
  if (q.isEmpty) return kAllAirports;

  // Search by prefix match first, then substring match
  final all = kAllAirports;
  
  final iataPrefix = <PlaceItem>[];
  final cityPrefix = <PlaceItem>[];
  final airportPrefix = <PlaceItem>[];
  final countryPrefix = <PlaceItem>[];
  final containsMatch = <PlaceItem>[];

  for (final item in all) {
    final iata = item.iata.toLowerCase();
    final city = item.city.toLowerCase();
    final airport = item.airport.toLowerCase();
    final country = item.country.toLowerCase();

    if (iata.startsWith(q)) {
      iataPrefix.add(item);
    } else if (city.startsWith(q)) {
      cityPrefix.add(item);
    } else if (airport.startsWith(q)) {
      airportPrefix.add(item);
    } else if (country.startsWith(q)) {
      countryPrefix.add(item);
    } else if (iata.contains(q) || city.contains(q) || airport.contains(q) || country.contains(q)) {
      containsMatch.add(item);
    }
  }

  return [...iataPrefix, ...cityPrefix, ...airportPrefix, ...countryPrefix, ...containsMatch];
}
