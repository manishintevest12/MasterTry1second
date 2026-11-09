/**
 * Indian states + union territories covered by the answer-page layer (/best/<vertical>/<state>).
 * Dependency-free on purpose: server/seo/data.ts imports it to build sitemap URLs, and
 * server/seo/answerPages.ts imports it to render the pages, so neither has to require the other.
 */
export interface AnswerState { name: string; slug: string; cities: string[] }

/**
 * 28 states + 8 union territories, each with the cities this site already has pages for. A state with no
 * city in the corpus still gets a page (it is a state-LEVEL query), it just links to the vertical instead
 * of city pages.
 */
export const ANSWER_STATES: AnswerState[] = [
  { name: 'Andhra Pradesh', slug: 'andhra-pradesh', cities: ['Vijayawada', 'Visakhapatnam'] },
  { name: 'Arunachal Pradesh', slug: 'arunachal-pradesh', cities: [] },
  { name: 'Assam', slug: 'assam', cities: ['Guwahati'] },
  { name: 'Bihar', slug: 'bihar', cities: ['Patna'] },
  { name: 'Chhattisgarh', slug: 'chhattisgarh', cities: [] },
  { name: 'Goa', slug: 'goa', cities: ['Goa'] },
  { name: 'Gujarat', slug: 'gujarat', cities: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot'] },
  { name: 'Haryana', slug: 'haryana', cities: ['Gurugram'] },
  { name: 'Himachal Pradesh', slug: 'himachal-pradesh', cities: ['Shimla'] },
  { name: 'Jharkhand', slug: 'jharkhand', cities: ['Ranchi'] },
  { name: 'Karnataka', slug: 'karnataka', cities: ['Bengaluru'] },
  { name: 'Kerala', slug: 'kerala', cities: ['Kochi'] },
  { name: 'Madhya Pradesh', slug: 'madhya-pradesh', cities: ['Indore', 'Bhopal', 'Jabalpur'] },
  { name: 'Maharashtra', slug: 'maharashtra', cities: ['Mumbai', 'Pune', 'Nagpur', 'Nashik'] },
  { name: 'Manipur', slug: 'manipur', cities: [] },
  { name: 'Meghalaya', slug: 'meghalaya', cities: [] },
  { name: 'Mizoram', slug: 'mizoram', cities: [] },
  { name: 'Nagaland', slug: 'nagaland', cities: [] },
  { name: 'Odisha', slug: 'odisha', cities: [] },
  { name: 'Punjab', slug: 'punjab', cities: ['Ludhiana', 'Amritsar'] },
  { name: 'Rajasthan', slug: 'rajasthan', cities: ['Jaipur', 'Udaipur', 'Jodhpur'] },
  { name: 'Sikkim', slug: 'sikkim', cities: [] },
  { name: 'Tamil Nadu', slug: 'tamil-nadu', cities: ['Chennai', 'Coimbatore'] },
  { name: 'Telangana', slug: 'telangana', cities: ['Hyderabad'] },
  { name: 'Tripura', slug: 'tripura', cities: [] },
  { name: 'Uttar Pradesh', slug: 'uttar-pradesh', cities: ['Lucknow', 'Noida', 'Agra', 'Varanasi', 'Kanpur'] },
  { name: 'Uttarakhand', slug: 'uttarakhand', cities: ['Dehradun'] },
  { name: 'West Bengal', slug: 'west-bengal', cities: ['Kolkata'] },
  { name: 'Andaman and Nicobar Islands', slug: 'andaman-and-nicobar-islands', cities: [] },
  { name: 'Chandigarh', slug: 'chandigarh', cities: ['Chandigarh'] },
  { name: 'Dadra and Nagar Haveli and Daman and Diu', slug: 'dadra-and-nagar-haveli-and-daman-and-diu', cities: [] },
  { name: 'Delhi', slug: 'delhi', cities: ['Delhi'] },
  { name: 'Jammu and Kashmir', slug: 'jammu-and-kashmir', cities: [] },
  { name: 'Ladakh', slug: 'ladakh', cities: [] },
  { name: 'Lakshadweep', slug: 'lakshadweep', cities: [] },
  { name: 'Puducherry', slug: 'puducherry', cities: [] },
];
