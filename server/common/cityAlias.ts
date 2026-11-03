/**
 * Indian cities have official/legacy spellings and OTAs disagree (verified live, Oct 2026):
 * Cleartrip only has legacy pages (bangalore, mysore, allahabad, pondicherry, "new delhi" for Delhi) while
 * Ixigo accepts almost any. cityVariants() returns the spellings to try, best first, so a user typing
 * "Bengaluru" or "Delhi" still gets every site's prices instead of a silent empty result.
 */
const ALIAS_GROUPS: string[][] = [
  ['bengaluru', 'bangalore'], ['delhi', 'new delhi'], ['gurugram', 'gurgaon'], ['mysuru', 'mysore'],
  ['puducherry', 'pondicherry'], ['prayagraj', 'allahabad'], ['kochi', 'cochin'], ['thiruvananthapuram', 'trivandrum'],
  ['mumbai', 'bombay'], ['kolkata', 'calcutta'], ['chennai', 'madras'], ['vadodara', 'baroda'],
  ['varanasi', 'banaras', 'benares'], ['pune', 'poona'], ['mangaluru', 'mangalore'], ['visakhapatnam', 'vizag'],
  ['shimla', 'simla'], ['kozhikode', 'calicut'], ['panaji', 'panjim', 'goa'], ['ayodhya', 'faizabad'],
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

export function cityVariants(city: string): string[] {
  const n = norm(city);
  const out: string[] = [n];
  for (const g of ALIAS_GROUPS) if (g.includes(n)) for (const a of g) if (!out.includes(a)) out.push(a);
  return out;
}

export const slugOf = (s: string) => norm(s).replace(/\s+/g, '-');

/**
 * OWNER 3 Nov ("redirection ke baad jo 404 aa raha hai usko permanently fix karo"): the app's
 * location chip reads "Juni Indore Tahsil" (a reverse-geocoded REVENUE VILLAGE, not the city), and
 * that raw string went straight into every hotel seller's path slug:
 *   https://www.oyorooms.com/hotels-in-juni-indore-tahsil/ -> HTTP 404 "we don't have the page"
 *   https://www.oyorooms.com/hotels-in-indore/             -> HTTP 200, real Indore hotels
 * MEASURED: juni-indore-tahsil 404, indore-tahsil 404, indore-district 404, madhya-pradesh 404,
 * indore 200. So a locality/administrative qualifier must never reach a merchant URL: exits are
 * minted from the CITY inside the string, and only when no known city matches do we clean the
 * qualifier off and use what is left.
 */
const NOISE_TOKENS = new Set([
  'tahsil', 'tehsil', 'taluka', 'taluk', 'district', 'dist', 'distt', 'subdistrict', 'sub', 'division',
  'block', 'city', 'urban', 'rural', 'village', 'vill', 'gram', 'gaon', 'town', 'municipality',
  'nagar', 'palika', 'nigam', 'panchayat', 'near', 'india', 'state', 'zone', 'area', 'region',
  'hobli', 'firka', 'mandal', 'circle', 'ward', 'post', 'po', 'ps', 'thana', 'road',
]);

/** Major Indian cities + the spellings OTAs actually publish paths for. */
const KNOWN_CITIES = new Set<string>([
  'agra','ahmedabad','aizawl','ajmer','akola','aligarh','allahabad','alwar','ambala','amravati','amritsar','anand',
  'asansol','aurangabad','ayodhya','bareilly','belagavi','bengaluru','bhagalpur','bharuch','bhatinda','bhavnagar',
  'bhilai','bhiwandi','bhopal','bhubaneswar','bhuj','bikaner','bilaspur','bokaro','chandigarh','chandrapur',
  'chennai','chhatarpur','coimbatore','cuttack','daman','davangere','dehradun','delhi','dhanbad','dharamshala',
  'durgapur','erode','faridabad','gandhinagar','gangtok','gaya','ghaziabad','goa','gondia','gorakhpur','guntur',
  'gurugram','guwahati','gwalior','haldia','hamirpur','hisar','hubli','hyderabad','imphal','indore','itanagar',
  'jabalpur','jaipur','jaisalmer','jalandhar','jalgaon','jammu','jamnagar','jamshedpur','jhansi','jodhpur',
  'junagadh','kanpur','kanyakumari','kargil','karimnagar','karnal','kasaragod','kavaratti','kohima','kolhapur',
  'kolkata','kollam','kochi','kottayam','kozhikode','kurnool','leh','lucknow','ludhiana','madurai','mangaluru',
  'manali','mandi','mathura','meerut','mohali','moradabad','mumbai','mussoorie','mysuru','nagpur','nainital',
  'nanded','nashik','navi mumbai','nellore','new delhi','noida','palanpur','palakkad','panaji','panipat','pathankot',
  'patiala','patna','pimpri','pondicherry','port blair','prayagraj','puducherry','pune','raipur','rajahmundry',
  'rajkot','ranchi','ratlam','rourkela','rourkee','roorkee','salem','satna','secunderabad','shillong','shimla',
  'sikar','silchar','siliguri','solapur','srinagar','surat','thane','thanjavur','thiruvananthapuram','thrissur',
  'tiruchirappalli','tirunelveli','tirupati','tirupur','udaipur','udupi','ujjain','vadodara','varanasi','vellore',
  'vijayawada','visakhapatnam','warangal','wayanad','gandhidham','hospet','hampi','gokarna','varkala','alleppey',
  'alappuzha','munnar','thekkady','coorg','madikeri','chikmagalur','lonavala','mahabaleshwar','panchgani','pushkar',
  'mount abu','ranikhet','kasauli','dalhousie','khajjiar','palampur','kufri','chail','kanatal','auli','rudraprayag',
  'haridwar','rishikesh','deoghar','puri','konark','gopalpur','digha','mandarmani','shirdi','nashik road','tirumala',
  'gurgaon','bangalore','mysore','trivandrum','cochin','calicut','mangalore','belgaum','vizag','simla','bombay',
  'calcutta','madras','baroda','poona','benares','banaras','pondy','ooty','udhagamandalam','kodaikanal','yercaud',
  'tirupathi','bhubaneshwar','jajpur','sambalpur','berhampur','balasore','dhanbad','giridih','hazaribagh','deogarh',
  'kota','bundi','chittorgarh','banswara','dungarpur','bhilwara','pali','bharatpur','alwar','sikar','jhunjhunu',
]);

/** Title-case a slug-ish city name ("navi mumbai" -> "Navi Mumbai"). */
function titleCity(v: string): string {
  return v.split(' ').filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/**
 * The CITY a merchant should be asked for, from whatever the geocoder handed us.
 * "Juni Indore Tahsil" -> "Indore"; "Indore, Madhya Pradesh" -> "Indore"; "goa" -> "Goa".
 * Unknown strings keep their own name (minus administrative qualifiers) so a small town still
 * gets its own seller page instead of being flattened onto a metro.
 */
export function canonicalCity(raw: string | null | undefined): string {
  const n = norm(raw || '');
  if (!n) return '';
  // 1) An exact known spelling (multi-word first, so "new delhi" is not read as "delhi").
  if (KNOWN_CITIES.has(n)) return titleCity(n);
  // 2) Drop administrative/locality qualifiers, keep the tokens that could be a place.
  const tokens = n.split(' ').filter((t) => t && !NOISE_TOKENS.has(t));
  if (tokens.length === 0) return '';
  // 3) Longest known-city phrase inside the string wins ("juni indore tahsil" -> "indore").
  for (let len = Math.min(3, tokens.length); len >= 1; len--) {
    for (let i = 0; i + len <= tokens.length; i++) {
      const phrase = tokens.slice(i, i + len).join(' ');
      if (KNOWN_CITIES.has(phrase)) return titleCity(phrase);
    }
  }
  // 4) No known city: the last surviving token is the place name in Indian address order.
  return titleCity(tokens[tokens.length - 1]);
}
