/**
 * Every city and town this site publishes pages for, grouped by the state/UT answer page it belongs to.
 *
 * OWNER 10 Nov: "sb city sb place pr kro kissi ko v mt leave kro". Before this the corpus was 38 cities, so a
 * search for any other place (Kozhikode, Siliguri, Bhilai, Warangal, Jodhpur's neighbours, the whole north-east)
 * had no page at all while Google already shows us for such long-tail place queries. This list is the single
 * source of truth: /<vertical>/<city> pages, sitemap entries, the state answer pages' city lists and the
 * city -> state link all read from here, so no place can be missed in one layer and present in another.
 *
 * Rules kept: real places only (no invented towns), one slug per place (a duplicate name gets its state appended,
 * e.g. Aurangabad in Maharashtra stays 'aurangabad'), and the state slug must match ANSWER_STATES.
 */
export interface CorpusCity {
  slug: string;
  name: string;
  /** State/UT slug from ANSWER_STATES. */
  state: string;
}

const RAW: [state: string, ...names: string[]][] = [
  ['andhra-pradesh', 'Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Kurnool', 'Rajahmundry', 'Tirupati', 'Kakinada', 'Kadapa', 'Anantapur', 'Vizianagaram', 'Eluru', 'Ongole', 'Chittoor', 'Bhimavaram', 'Machilipatnam', 'Tenali', 'Proddatur', 'Hindupur'],
  ['arunachal-pradesh', 'Itanagar', 'Naharlagun', 'Pasighat', 'Tawang', 'Ziro', 'Bomdila', 'Tezu'],
  ['assam', 'Guwahati', 'Silchar', 'Dibrugarh', 'Jorhat', 'Tezpur', 'Nagaon', 'Bongaigaon', 'Tinsukia', 'Dhubri', 'Diphu', 'Goalpara'],
  ['bihar', 'Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Darbhanga', 'Purnia', 'Bihar Sharif', 'Arrah', 'Begusarai', 'Katihar', 'Chhapra', 'Munger', 'Saharsa', 'Sasaram', 'Hajipur', 'Motihari', 'Bettiah', 'Siwan', 'Jamalpur'],
  ['chhattisgarh', 'Raipur', 'Bhilai', 'Bilaspur', 'Korba', 'Durg', 'Rajnandgaon', 'Jagdalpur', 'Ambikapur', 'Raigarh', 'Dhamtari', 'Chirmiri'],
  ['goa', 'Goa', 'Panaji', 'Margao', 'Vasco Da Gama', 'Calangute', 'Candolim', 'Anjuna', 'Ponda', 'Mapusa'],
  ['gujarat', 'Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Junagadh', 'Gandhinagar', 'Gandhidham', 'Anand', 'Navsari', 'Morbi', 'Vapi', 'Veraval', 'Porbandar', 'Bhuj', 'Mehsana', 'Palanpur', 'Valsad', 'Bharuch', 'Godhra', 'Patan', 'Dahod'],
  ['haryana', 'Gurugram', 'Faridabad', 'Panipat', 'Ambala', 'Yamunanagar', 'Rohtak', 'Hisar', 'Karnal', 'Sonipat', 'Panchkula', 'Bhiwani', 'Sirsa', 'Kurukshetra', 'Rewari', 'Palwal', 'Jind', 'Kaithal'],
  ['himachal-pradesh', 'Shimla', 'Manali', 'Dharamshala', 'Solan', 'Mandi', 'Kullu', 'Palampur', 'Kangra', 'Una', 'Chamba', 'Hamirpur', 'Baddi', 'Nahan', 'Keylong'],
  ['jharkhand', 'Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro Steel City', 'Deoghar', 'Hazaribagh', 'Giridih', 'Ramgarh', 'Medininagar', 'Chaibasa', 'Dumka', 'Sahibganj'],
  ['karnataka', 'Bengaluru', 'Mysuru', 'Mangaluru', 'Hubballi', 'Dharwad', 'Belagavi', 'Kalaburagi', 'Davanagere', 'Ballari', 'Vijayapura', 'Shivamogga', 'Tumakuru', 'Udupi', 'Hassan', 'Mandya', 'Chikkamagaluru', 'Bidar', 'Raichur', 'Kolar', 'Bagalkot', 'Gadag', 'Hospet', 'Karwar', 'Madikeri'],
  ['kerala', 'Kochi', 'Thiruvananthapuram', 'Kozhikode', 'Thrissur', 'Kollam', 'Kannur', 'Alappuzha', 'Palakkad', 'Malappuram', 'Kottayam', 'Munnar', 'Varkala', 'Kovalam', 'Wayanad', 'Idukki', 'Pathanamthitta', 'Kasaragod', 'Kannur', 'Thalassery', 'Nilambur'],
  ['madhya-pradesh', 'Indore', 'Bhopal', 'Jabalpur', 'Gwalior', 'Ujjain', 'Sagar', 'Rewa', 'Satna', 'Ratlam', 'Dewas', 'Singrauli', 'Katni', 'Chhindwara', 'Khandwa', 'Morena', 'Bhind', 'Vidisha', 'Hoshangabad', 'Shivpuri', 'Damoh', 'Mandsaur', 'Khargone', 'Neemuch', 'Betul', 'Sehore', 'Guna', 'Shahdol', 'Chhatarpur', 'Pithampur', 'Omkareshwar', 'Maheshwar'],
  ['maharashtra', 'Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Thane', 'Navi Mumbai', 'Aurangabad', 'Solapur', 'Amravati', 'Kolhapur', 'Sangli', 'Jalgaon', 'Akola', 'Latur', 'Dhule', 'Ahmednagar', 'Chandrapur', 'Parbhani', 'Nanded', 'Satara', 'Ratnagiri', 'Alibaug', 'Lonavala', 'Mahabaleshwar', 'Shirdi', 'Panvel', 'Vasai-Virar', 'Bhiwandi', 'Ichalkaranji', 'Nandurbar', 'Wardha', 'Gondia', 'Yavatmal', 'Buldhana', 'Osmanabad', 'Jalna', 'Beed', 'Karad', 'Baramati', 'Palghar', 'Badlapur', 'Ambernath'],
  ['manipur', 'Imphal', 'Thoubal', 'Churachandpur', 'Bishnupur', 'Kakching'],
  ['meghalaya', 'Shillong', 'Tura', 'Cherrapunji', 'Jowai', 'Nongstoin', 'Williamnagar'],
  ['mizoram', 'Aizawl', 'Lunglei', 'Champhai', 'Serchhip', 'Kolasib'],
  ['nagaland', 'Kohima', 'Dimapur', 'Mokokchung', 'Tuensang', 'Wokha', 'Zunheboto'],
  ['odisha', 'Bhubaneswar', 'Cuttack', 'Rourkela', 'Berhampur', 'Sambalpur', 'Puri', 'Balasore', 'Bhadrak', 'Baripada', 'Jharsuguda', 'Angul', 'Koraput', 'Rayagada', 'Bargarh', 'Konark'],
  ['punjab', 'Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 'Mohali', 'Hoshiarpur', 'Batala', 'Pathankot', 'Moga', 'Abohar', 'Malerkotla', 'Barnala', 'Firozpur', 'Kapurthala', 'Sangrur', 'Fazilka'],
  ['rajasthan', 'Jaipur', 'Udaipur', 'Jodhpur', 'Kota', 'Bikaner', 'Ajmer', 'Bhilwara', 'Alwar', 'Sikar', 'Pali', 'Sri Ganganagar', 'Bharatpur', 'Chittorgarh', 'Mount Abu', 'Pushkar', 'Jaisalmer', 'Sawai Madhopur', 'Bundi', 'Beawar', 'Hanumangarh', 'Nagaur', 'Tonk', 'Kishangarh', 'Ranthambore'],
  ['sikkim', 'Gangtok', 'Namchi', 'Gyalshing', 'Mangan', 'Pelling', 'Lachung'],
  ['tamil-nadu', 'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli', 'Tiruppur', 'Erode', 'Vellore', 'Thoothukudi', 'Thanjavur', 'Dindigul', 'Kanyakumari', 'Ooty', 'Kumbakonam', 'Nagercoil', 'Hosur', 'Karur', 'Cuddalore', 'Kanchipuram', 'Rameswaram', 'Pollachi', 'Namakkal', 'Villupuram', 'Ariyalur', 'Nagapattinam', 'Pudukkottai', 'Yercaud', 'Kodaikanal', 'Mahabalipuram'],
  ['telangana', 'Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam', 'Ramagundam', 'Secunderabad', 'Mahbubnagar', 'Nalgonda', 'Adilabad', 'Siddipet', 'Medak', 'Suryapet', 'Miryalaguda', 'Jagtial'],
  ['tripura', 'Agartala', 'Dharmanagar', 'Kailashahar', 'Belonia', 'Khowai', 'Ambassa'],
  ['uttar-pradesh', 'Lucknow', 'Noida', 'Ghaziabad', 'Agra', 'Varanasi', 'Kanpur', 'Meerut', 'Prayagraj', 'Bareilly', 'Aligarh', 'Moradabad', 'Saharanpur', 'Gorakhpur', 'Jhansi', 'Muzaffarnagar', 'Mathura', 'Ayodhya', 'Firozabad', 'Budaun', 'Rampur', 'Shahjahanpur', 'Farrukhabad', 'Hapur', 'Etawah', 'Mirzapur', 'Bulandshahr', 'Amroha', 'Hardoi', 'Fatehpur', 'Raebareli', 'Orai', 'Sitapur', 'Bahraich', 'Unnao', 'Jaunpur', 'Hathras', 'Banda', 'Pilibhit', 'Barabanki', 'Gonda', 'Mainpuri', 'Etah', 'Deoria', 'Ghazipur', 'Sultanpur', 'Azamgarh', 'Basti', 'Ballia', 'Greater Noida', 'Vrindavan', 'Sarnath', 'Naimisharanya'],
  ['uttarakhand', 'Dehradun', 'Haridwar', 'Rishikesh', 'Roorkee', 'Haldwani', 'Rudrapur', 'Kashipur', 'Nainital', 'Mussoorie', 'Almora', 'Pithoragarh', 'Kotdwar', 'Ramnagar', 'Kedarnath', 'Badrinath', 'Joshimath', 'Chamoli', 'Tehri', 'Bageshwar'],
  ['west-bengal', 'Kolkata', 'Howrah', 'Durgapur', 'Asansol', 'Siliguri', 'Bardhaman', 'Malda', 'Kharagpur', 'Haldia', 'Darjeeling', 'Jalpaiguri', 'Kalyani', 'Krishnanagar', 'Barasat', 'Barrackpore', 'Hugli-Chinsurah', 'Raiganj', 'Medinipur', 'Cooch Behar', 'Bankura', 'Purulia', 'Bolpur', 'Kalimpong', 'Digha', 'Mandarmani'],
  ['andaman-and-nicobar-islands', 'Port Blair', 'Havelock Island', 'Neil Island', 'Diglipur'],
  ['chandigarh', 'Chandigarh'],
  ['dadra-and-nagar-haveli-and-daman-and-diu', 'Silvassa', 'Daman', 'Diu'],
  ['delhi', 'Delhi', 'New Delhi', 'Dwarka', 'Rohini'],
  ['jammu-and-kashmir', 'Srinagar', 'Jammu', 'Anantnag', 'Baramulla', 'Udhampur', 'Kathua', 'Sopore', 'Gulmarg', 'Pahalgam', 'Katra', 'Sonamarg'],
  ['ladakh', 'Leh', 'Kargil', 'Nubra Valley', 'Pangong'],
  ['lakshadweep', 'Kavaratti', 'Agatti', 'Minicoy'],
  ['puducherry', 'Puducherry', 'Karaikal', 'Mahe', 'Yanam', 'Auroville'],
];

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const build = (): CorpusCity[] => {
  const seen = new Set<string>();
  const out: CorpusCity[] = [];
  for (const [state, ...names] of RAW) {
    const inState = new Set<string>();
    for (const name of names) {
      const key = name.trim().toLowerCase();
      if (inState.has(key)) continue; // a name repeated inside its own state is one place, not two
      inState.add(key);
      let slug = slugify(name);
      // Two different places can share a name (Aurangabad, Bilaspur). The first keeps the plain slug, the
      // next is qualified by its state so a page can never silently overwrite another place.
      if (seen.has(slug)) slug = `${slug}-${state}`;
      if (seen.has(slug)) continue;
      seen.add(slug);
      out.push({ slug, name, state });
    }
  }
  return out;
};

export const INDIAN_CITIES: CorpusCity[] = build();

/** City name (lowercase) -> state slug, so a city page always knows its state answer page. */
export const CITY_STATE: Record<string, string> = Object.fromEntries(
  INDIAN_CITIES.map((c) => [c.name.trim().toLowerCase(), c.state]),
);

/** The cities of one state/UT, in corpus order (the state answer pages list these). */
export function citiesOfState(stateSlug: string): string[] {
  return INDIAN_CITIES.filter((c) => c.state === stateSlug).map((c) => c.name);
}
