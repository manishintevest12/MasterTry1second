export interface HotelDestinationItem {
  id: string;
  name: string;
  country: string;
  type: 'City' | 'Region' | 'Island';
  popular?: boolean;
  category?: 'beaches' | 'mountains' | 'heritage' | 'metropolitan';
  gradient?: string;
  image?: string;
}

export const POPULAR_HOTEL_DESTINATIONS: HotelDestinationItem[] = [
  { id: 'goa', name: 'Goa, India', country: 'India', type: 'City', popular: true, category: 'beaches', gradient: 'from-blue-600 via-teal-500 to-emerald-400' },
  { id: 'mumbai', name: 'Mumbai, India', country: 'India', type: 'City', popular: true, category: 'metropolitan', gradient: 'from-purple-600 to-indigo-600' },
  { id: 'delhi', name: 'New Delhi, India', country: 'India', type: 'City', popular: true, category: 'heritage', gradient: 'from-amber-600 to-orange-600' },
  { id: 'bengaluru', name: 'Bengaluru, India', country: 'India', type: 'City', popular: true, category: 'metropolitan', gradient: 'from-emerald-600 to-teal-700' },
  { id: 'jaipur', name: 'Jaipur, India', country: 'India', type: 'City', popular: true, category: 'heritage', gradient: 'from-pink-600 to-rose-600' },
  { id: 'udaipur', name: 'Udaipur, India', country: 'India', type: 'City', popular: true, category: 'heritage', gradient: 'from-amber-500 to-yellow-600' },
  { id: 'manali', name: 'Manali, Himachal Pradesh, India', country: 'India', type: 'City', popular: true, category: 'mountains', gradient: 'from-cyan-600 to-blue-700' },
  { id: 'shimla', name: 'Shimla, Himachal Pradesh, India', country: 'India', type: 'City', popular: true, category: 'mountains', gradient: 'from-slate-700 to-cyan-800' },
  { id: 'kochi', name: 'Kochi, Kerala, India', country: 'India', type: 'City', popular: true, category: 'beaches', gradient: 'from-teal-600 to-emerald-600' },
  { id: 'ooty', name: 'Ooty, Tamil Nadu, India', country: 'India', type: 'City', popular: true, category: 'mountains', gradient: 'from-emerald-700 to-green-800' },
  { id: 'dubai', name: 'Dubai, United Arab Emirates', country: 'UAE', type: 'City', popular: true, category: 'metropolitan', gradient: 'from-amber-600 to-yellow-500' },
  { id: 'singapore', name: 'Singapore', country: 'Singapore', type: 'City', popular: true, category: 'metropolitan', gradient: 'from-red-600 to-rose-600' },
  { id: 'bali', name: 'Bali, Indonesia', country: 'Indonesia', type: 'Island', popular: true, category: 'beaches', gradient: 'from-blue-500 to-emerald-500' },
  { id: 'phuket', name: 'Phuket, Thailand', country: 'Thailand', type: 'Island', popular: true, category: 'beaches', gradient: 'from-cyan-500 to-blue-600' },
];

export const BEACH_DESTINATIONS: HotelDestinationItem[] = [
  { id: 'goa', name: 'Goa', country: 'India', type: 'Region', category: 'beaches', gradient: 'from-blue-600 via-teal-500 to-emerald-400' },
  { id: 'bali', name: 'Bali', country: 'Indonesia', type: 'Island', category: 'beaches', gradient: 'from-blue-500 via-indigo-500 to-teal-400' },
  { id: 'phuket', name: 'Phuket', country: 'Thailand', type: 'Island', category: 'beaches', gradient: 'from-cyan-600 to-blue-700' },
  { id: 'male', name: 'Maldives', country: 'Maldives', type: 'Island', category: 'beaches', gradient: 'from-sky-500 via-teal-400 to-emerald-300' },
  { id: 'kovalam', name: 'Kovalam', country: 'India', type: 'City', category: 'beaches', gradient: 'from-amber-500 to-teal-600' },
  { id: 'gokarna', name: 'Gokarna', country: 'India', type: 'City', category: 'beaches', gradient: 'from-teal-600 to-blue-600' },
];

export const MOUNTAIN_DESTINATIONS: HotelDestinationItem[] = [
  { id: 'manali', name: 'Manali', country: 'India', type: 'City', category: 'mountains', gradient: 'from-cyan-700 via-blue-800 to-indigo-900' },
  { id: 'shimla', name: 'Shimla', country: 'India', type: 'City', category: 'mountains', gradient: 'from-slate-800 to-blue-900' },
  { id: 'munnar', name: 'Munnar', country: 'India', type: 'City', category: 'mountains', gradient: 'from-emerald-700 to-teal-800' },
  { id: 'darjeeling', name: 'Darjeeling', country: 'India', type: 'City', category: 'mountains', gradient: 'from-green-700 to-cyan-800' },
  { id: 'srinagar', name: 'Srinagar', country: 'India', type: 'City', category: 'mountains', gradient: 'from-blue-600 to-slate-800' },
  { id: 'leh', name: 'Leh Ladakh', country: 'India', type: 'Region', category: 'mountains', gradient: 'from-amber-700 via-stone-800 to-slate-900' },
];

/**
 * Filter destinations by query string.
 */
export function searchHotelDestinations(query: string): HotelDestinationItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return POPULAR_HOTEL_DESTINATIONS;

  return POPULAR_HOTEL_DESTINATIONS.filter(item =>
    item.name.toLowerCase().includes(q) ||
    item.country.toLowerCase().includes(q)
  );
}
