export interface AirportItem {
  city: string;
  country: string;
  airport: string;
  iata: string;
  state?: string;
  popular?: boolean;
}

export const AIRPORTS_DATA: AirportItem[] = [
  // Top Popular Indian Airports
  { city: 'Mumbai', country: 'India', airport: 'Chhatrapati Shivaji Maharaj International Airport', iata: 'BOM', state: 'Maharashtra', popular: true },
  { city: 'New Delhi', country: 'India', airport: 'Indira Gandhi International Airport', iata: 'DEL', state: 'Delhi', popular: true },
  { city: 'Bengaluru', country: 'India', airport: 'Kempegowda International Airport', iata: 'BLR', state: 'Karnataka', popular: true },
  { city: 'Hyderabad', country: 'India', airport: 'Rajiv Gandhi International Airport', iata: 'HYD', state: 'Telangana', popular: true },
  { city: 'Chennai', country: 'India', airport: 'Chennai International Airport', iata: 'MAA', state: 'Tamil Nadu', popular: true },
  { city: 'Kolkata', country: 'India', airport: 'Netaji Subhash Chandra Bose International Airport', iata: 'CCU', state: 'West Bengal', popular: true },
  { city: 'Pune', country: 'India', airport: 'Pune Airport', iata: 'PNQ', state: 'Maharashtra', popular: true },
  { city: 'Goa (Dabolim)', country: 'India', airport: 'Dabolim Airport', iata: 'GOI', state: 'Goa', popular: true },
  { city: 'Goa (Mopa)', country: 'India', airport: 'Manohar International Airport', iata: 'GOX', state: 'Goa', popular: true },
  { city: 'Ahmedabad', country: 'India', airport: 'Sardar Vallabhbhai Patel International Airport', iata: 'AMD', state: 'Gujarat', popular: true },
  { city: 'Jaipur', country: 'India', airport: 'Jaipur International Airport', iata: 'JAI', state: 'Rajasthan', popular: true },
  { city: 'Lucknow', country: 'India', airport: 'Chaudhary Charan Singh International Airport', iata: 'LKO', state: 'Uttar Pradesh', popular: true },
  { city: 'Kochi', country: 'India', airport: 'Cochin International Airport', iata: 'COK', state: 'Kerala', popular: true },
  { city: 'Guwahati', country: 'India', airport: 'Lokpriya Gopinath Bordoloi International Airport', iata: 'GAU', state: 'Assam', popular: true },
  { city: 'Chandigarh', country: 'India', airport: 'Chandigarh Airport', iata: 'IXC', state: 'Chandigarh', popular: true },
  { city: 'Thiruvananthapuram', country: 'India', airport: 'Trivandrum International Airport', iata: 'TRV', state: 'Kerala', popular: true },
  { city: 'Varanasi', country: 'India', airport: 'Lal Bahadur Shastri International Airport', iata: 'VNS', state: 'Uttar Pradesh', popular: true },
  { city: 'Indore', country: 'India', airport: 'Devi Ahilya Bai Holkar Airport', iata: 'IDR', state: 'Madhya Pradesh', popular: true },
  { city: 'Bhubaneswar', country: 'India', airport: 'Biju Patnaik International Airport', iata: 'BBI', state: 'Odisha', popular: true },
  { city: 'Amritsar', country: 'India', airport: 'Sri Guru Ram Dass Jee International Airport', iata: 'ATQ', state: 'Punjab', popular: true },

  // Additional Indian Airports (~80 more)
  { city: 'Agartala', country: 'India', airport: 'Maharaja Bir Bikram Airport', iata: 'IXA', state: 'Tripura' },
  { city: 'Agra', country: 'India', airport: 'Agra Airport', iata: 'AGR', state: 'Uttar Pradesh' },
  { city: 'Aizawl', country: 'India', airport: 'Lengpui Airport', iata: 'AJL', state: 'Mizoram' },
  { city: 'Allahabad (Prayagraj)', country: 'India', airport: 'Prayagraj Airport', iata: 'IXD', state: 'Uttar Pradesh' },
  { city: 'Aurangabad (Chhatrapati Sambhaji Nagar)', country: 'India', airport: 'Aurangabad Airport', iata: 'IXU', state: 'Maharashtra' },
  { city: 'Bagdogra', country: 'India', airport: 'Bagdogra Airport', iata: 'IXB', state: 'West Bengal' },
  { city: 'Bareilly', country: 'India', airport: 'Bareilly Airport', iata: 'BEK', state: 'Uttar Pradesh' },
  { city: 'Belagavi', country: 'India', airport: 'Belagavi Airport', iata: 'IXG', state: 'Karnataka' },
  { city: 'Bhopal', country: 'India', airport: 'Raja Bhoj Airport', iata: 'BHO', state: 'Madhya Pradesh' },
  { city: 'Bhuj', country: 'India', airport: 'Bhuj Airport', iata: 'BHJ', state: 'Gujarat' },
  { city: 'Bikaner', country: 'India', airport: 'Nal Airport', iata: 'BKB', state: 'Rajasthan' },
  { city: 'Bilaspur', country: 'India', airport: 'Bilaspur Airport', iata: 'PAB', state: 'Chhattisgarh' },
  { city: 'Calicut (Kozhikode)', country: 'India', airport: 'Calicut International Airport', iata: 'CCJ', state: 'Kerala' },
  { city: 'Coimbatore', country: 'India', airport: 'Coimbatore International Airport', iata: 'CJB', state: 'Tamil Nadu' },
  { city: 'Coonoor', country: 'India', airport: 'Coimbatore Airport', iata: 'CJB', state: 'Tamil Nadu' },
  { city: 'Cuttack', country: 'India', airport: 'Biju Patnaik Airport', iata: 'BBI', state: 'Odisha' },
  { city: 'Darbhanga', country: 'India', airport: 'Darbhanga Airport', iata: 'DBR', state: 'Bihar' },
  { city: 'Dehradun', country: 'India', airport: 'Jolly Grant Airport', iata: 'DED', state: 'Uttarakhand' },
  { city: 'Deoghar', country: 'India', airport: 'Deoghar Airport', iata: 'DGH', state: 'Jharkhand' },
  { city: 'Dharamsala', country: 'India', airport: 'Kangra Airport', iata: 'DHM', state: 'Himachal Pradesh' },
  { city: 'Dibrugarh', country: 'India', airport: 'Dibrugarh Airport', iata: 'DBR', state: 'Assam' },
  { city: 'Dimapur', country: 'India', airport: 'Dimapur Airport', iata: 'DMU', state: 'Nagaland' },
  { city: 'Durgapur', country: 'India', airport: 'Kazi Nazrul Islam Airport', iata: 'RRG', state: 'West Bengal' },
  { city: 'Gaya', country: 'India', airport: 'Gaya Airport', iata: 'GAY', state: 'Bihar' },
  { city: 'Gorakhpur', country: 'India', airport: 'Gorakhpur Airport', iata: 'GOP', state: 'Uttar Pradesh' },
  { city: 'Gwalior', country: 'India', airport: 'Rajmata Vijaya Raje Scindia Airport', iata: 'GWL', state: 'Madhya Pradesh' },
  { city: 'Hubballi', country: 'India', airport: 'Hubballi Airport', iata: 'HBX', state: 'Karnataka' },
  { city: 'Imphal', country: 'India', airport: 'Bir Tikendrajit International Airport', iata: 'IMF', state: 'Manipur' },
  { city: 'Itanagar (Hollongi)', country: 'India', airport: 'Donyi Polo Airport', iata: 'HGI', state: 'Arunachal Pradesh' },
  { city: 'Jabalpur', country: 'India', airport: 'Jabalpur Airport', iata: 'JLR', state: 'Madhya Pradesh' },
  { city: 'Jagdalpur', country: 'India', airport: 'Maa Danteshwari Airport', iata: 'JGB', state: 'Chhattisgarh' },
  { city: 'Jaisalmer', country: 'India', airport: 'Jaisalmer Airport', iata: 'JSA', state: 'Rajasthan' },
  { city: 'Jammu', country: 'India', airport: 'Jammu Airport', iata: 'IXJ', state: 'Jammu and Kashmir' },
  { city: 'Jamnagar', country: 'India', airport: 'Jamnagar Airport', iata: 'JGA', state: 'Gujarat' },
  { city: 'Jharsuguda', country: 'India', airport: 'Veer Surendra Sai Airport', iata: 'JRG', state: 'Odisha' },
  { city: 'Jodhpur', country: 'India', airport: 'Jodhpur Airport', iata: 'JDH', state: 'Rajasthan' },
  { city: 'Jorhat', country: 'India', airport: 'Jorhat Airport', iata: 'JRH', state: 'Assam' },
  { city: 'Kadapa', country: 'India', airport: 'Kadapa Airport', iata: 'CDP', state: 'Andhra Pradesh' },
  { city: 'Kannur', country: 'India', airport: 'Kannur International Airport', iata: 'CNN', state: 'Kerala' },
  { city: 'Kanpur', country: 'India', airport: 'Kanpur Airport', iata: 'KNU', state: 'Uttar Pradesh' },
  { city: 'Khajuraho', country: 'India', airport: 'Khajuraho Airport', iata: 'HJR', state: 'Madhya Pradesh' },
  { city: 'Kolhapur', country: 'India', airport: 'Chhatrapati Rajaram Maharaj Airport', iata: 'KLH', state: 'Maharashtra' },
  { city: 'Kota', country: 'India', airport: 'Kota Airport', iata: 'KTU', state: 'Rajasthan' },
  { city: 'Kullu (Bhuntar)', country: 'India', airport: 'Kullu–Manali Airport', iata: 'KUU', state: 'Himachal Pradesh' },
  { city: 'Kurnool', country: 'India', airport: 'Uyyalawada Narasimha Reddy Airport', iata: 'KJB', state: 'Andhra Pradesh' },
  { city: 'Leh', country: 'India', airport: 'Kushok Bakula Rimpochee Airport', iata: 'IXL', state: 'Ladakh' },
  { city: 'Ludhiana', country: 'India', airport: 'Sahnewal Airport', iata: 'LUH', state: 'Punjab' },
  { city: 'Madurai', country: 'India', airport: 'Madurai Airport', iata: 'IXM', state: 'Tamil Nadu' },
  { city: 'Mangaluru', country: 'India', airport: 'Mangaluru International Airport', iata: 'IXE', state: 'Karnataka' },
  { city: 'Mundra', country: 'India', airport: 'Mundra Airport', iata: 'MIU', state: 'Gujarat' },
  { city: 'Mysuru', country: 'India', airport: 'Mysore Airport', iata: 'MYQ', state: 'Karnataka' },
  { city: 'Nanded', country: 'India', airport: 'Shri Guru Gobind Singh Ji Airport', iata: 'NDC', state: 'Maharashtra' },
  { city: 'Nashik', country: 'India', airport: 'Nashik Airport', iata: 'ISK', state: 'Maharashtra' },
  { city: 'North Lakhimpur', country: 'India', airport: 'Lilabari Airport', iata: 'IXI', state: 'Assam' },
  { city: 'Pantnagar', country: 'India', airport: 'Pantnagar Airport', iata: 'PGH', state: 'Uttarakhand' },
  { city: 'Pasighat', country: 'India', airport: 'Pasighat Airport', iata: 'IXT', state: 'Arunachal Pradesh' },
  { city: 'Patna', country: 'India', airport: 'Jay Prakash Narayan Airport', iata: 'PAT', state: 'Bihar' },
  { city: 'Pondicherry', country: 'India', airport: 'Puducherry Airport', iata: 'PNY', state: 'Puducherry' },
  { city: 'Port Blair', country: 'India', airport: 'Veer Savarkar International Airport', iata: 'IXZ', state: 'Andaman and Nicobar Islands' },
  { city: 'Rajahmundry', country: 'India', airport: 'Rajahmundry Airport', iata: 'RJA', state: 'Andhra Pradesh' },
  { city: 'Rajkot', country: 'India', airport: 'Rajkot International Airport', iata: 'HSR', state: 'Gujarat' },
  { city: 'Ranchi', country: 'India', airport: 'Birsa Munda Airport', iata: 'IXR', state: 'Jharkhand' },
  { city: 'Rourkela', country: 'India', airport: 'Rourkela Airport', iata: 'RRK', state: 'Odisha' },
  { city: 'Salem', country: 'India', airport: 'Salem Airport', iata: 'SXV', state: 'Tamil Nadu' },
  { city: 'Shillong', country: 'India', airport: 'Shillong Airport', iata: 'SHL', state: 'Meghalaya' },
  { city: 'Shimla', country: 'India', airport: 'Shimla Airport', iata: 'SLV', state: 'Himachal Pradesh' },
  { city: 'Shirdi', country: 'India', airport: 'Shirdi Airport', iata: 'SAG', state: 'Maharashtra' },
  { city: 'Silchar', country: 'India', airport: 'Silchar Airport', iata: 'IXS', state: 'Assam' },
  { city: 'Srinagar', country: 'India', airport: 'Sheikh ul-Alam International Airport', iata: 'SXR', state: 'Jammu and Kashmir' },
  { city: 'Surat', country: 'India', airport: 'Surat Airport', iata: 'STV', state: 'Gujarat' },
  { city: 'Tezpur', country: 'India', airport: 'Tezpur Airport', iata: 'TEZ', state: 'Assam' },
  { city: 'Tiruchirappalli', country: 'India', airport: 'Tiruchirappalli International Airport', iata: 'TRZ', state: 'Tamil Nadu' },
  { city: 'Tirupati', country: 'India', airport: 'Tirupati Airport', iata: 'TIR', state: 'Andhra Pradesh' },
  { city: 'Tuticorin (Thoothukudi)', country: 'India', airport: 'Tuticorin Airport', iata: 'TCR', state: 'Tamil Nadu' },
  { city: 'Udaipur', country: 'India', airport: 'Maharana Pratap Airport', iata: 'UDR', state: 'Rajasthan' },
  { city: 'Vadodara', country: 'India', airport: 'Vadodara Airport', iata: 'BDQ', state: 'Gujarat' },
  { city: 'Vijayawada', country: 'India', airport: 'Vijayawada International Airport', iata: 'VGA', state: 'Andhra Pradesh' },
  { city: 'Visakhapatnam', country: 'India', airport: 'Visakhapatnam International Airport', iata: 'VTZ', state: 'Andhra Pradesh' },

  // Top 25 International Airports
  { city: 'Dubai', country: 'United Arab Emirates', airport: 'Dubai International Airport', iata: 'DXB', popular: true },
  { city: 'London (Heathrow)', country: 'United Kingdom', airport: 'London Heathrow Airport', iata: 'LHR', popular: true },
  { city: 'Singapore', country: 'Singapore', airport: 'Singapore Changi Airport', iata: 'SIN', popular: true },
  { city: 'Bangkok (Suvarnabhumi)', country: 'Thailand', airport: 'Suvarnabhumi Airport', iata: 'BKK', popular: true },
  { city: 'Bangkok (Don Mueang)', country: 'Thailand', airport: 'Don Mueang International Airport', iata: 'DMK' },
  { city: 'Kuala Lumpur', country: 'Malaysia', airport: 'Kuala Lumpur International Airport', iata: 'KUL', popular: true },
  { city: 'Doha', country: 'Qatar', airport: 'Hamad International Airport', iata: 'DOH', popular: true },
  { city: 'Abu Dhabi', country: 'United Arab Emirates', airport: 'Zayed International Airport', iata: 'AUH', popular: true },
  { city: 'New York (JFK)', country: 'United States', airport: 'John F. Kennedy International Airport', iata: 'JFK', popular: true },
  { city: 'San Francisco', country: 'United States', airport: 'San Francisco International Airport', iata: 'SFO', popular: true },
  { city: 'Toronto', country: 'Canada', airport: 'Toronto Pearson International Airport', iata: 'YYZ', popular: true },
  { city: 'Paris (Charles de Gaulle)', country: 'France', airport: 'Charles de Gaulle Airport', iata: 'CDG', popular: true },
  { city: 'Frankfurt', country: 'Germany', airport: 'Frankfurt Airport', iata: 'FRA', popular: true },
  { city: 'Amsterdam', country: 'Netherlands', airport: 'Amsterdam Airport Schiphol', iata: 'AMS', popular: true },
  { city: 'Bali (Denpasar)', country: 'Indonesia', airport: 'Ngurah Rai International Airport', iata: 'DPS', popular: true },
  { city: 'Phuket', country: 'Thailand', airport: 'Phuket International Airport', iata: 'HKT', popular: true },
  { city: 'Tokyo (Haneda)', country: 'Japan', airport: 'Tokyo Haneda Airport', iata: 'HND', popular: true },
  { city: 'Tokyo (Narita)', country: 'Japan', airport: 'Narita International Airport', iata: 'NRT' },
  { city: 'Sydney', country: 'Australia', airport: 'Sydney Kingsford Smith Airport', iata: 'SYD', popular: true },
  { city: 'Melbourne', country: 'Australia', airport: 'Melbourne Airport', iata: 'MEL' },
  { city: 'Istanbul', country: 'Turkey', airport: 'Istanbul Airport', iata: 'IST', popular: true },
  { city: 'Jeddah', country: 'Saudi Arabia', airport: 'King Abdulaziz International Airport', iata: 'JED', popular: true },
  { city: 'Riyadh', country: 'Saudi Arabia', airport: 'King Khalid International Airport', iata: 'RUH' },
  { city: 'Colombo', country: 'Sri Lanka', airport: 'Bandaranaike International Airport', iata: 'CMB', popular: true },
  { city: 'Kathmandu', country: 'Nepal', airport: 'Tribhuvan International Airport', iata: 'KTM', popular: true },
  { city: 'Malé', country: 'Maldives', airport: 'Velana International Airport', iata: 'MLE', popular: true },
];

/**
 * Filter airports by search query. Matches city, airport name, or IATA code.
 * Prioritizes prefix matches on IATA code and city name.
 */
export function searchAirports(query: string): AirportItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return AIRPORTS_DATA;

  const prefixMatches: AirportItem[] = [];
  const containsMatches: AirportItem[] = [];

  for (const item of AIRPORTS_DATA) {
    const iataLower = item.iata.toLowerCase();
    const cityLower = item.city.toLowerCase();
    const airportLower = item.airport.toLowerCase();
    const countryLower = item.country.toLowerCase();

    if (iataLower.startsWith(q) || cityLower.startsWith(q)) {
      prefixMatches.push(item);
    } else if (iataLower.includes(q) || cityLower.includes(q) || airportLower.includes(q) || countryLower.includes(q)) {
      containsMatches.push(item);
    }
  }

  return [...prefixMatches, ...containsMatches];
}
