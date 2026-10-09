export interface AutocompleteSuggestion {
  text: string;
  category?: string;
  subtext?: string;
  badge?: string;
  icon?: string;
  type: 'city' | 'product' | 'grocery' | 'food' | 'date' | 'category' | 'location';
}

export const AUTOCOMPLETE_CITIES: AutocompleteSuggestion[] = [
  // --- METRO & KEY AIRPORT HUBS ---
  { text: 'New Delhi (DEL)', subtext: "Indira Gandhi Int'l Airport · Terminal 1/2/3 · Delhi NCR", badge: 'Metro Capital', type: 'city', icon: 'Plane' },
  { text: 'Mumbai (BOM)', subtext: "Chhatrapati Shivaji Maharaj Int'l · Terminal 1/2 · Maharashtra", badge: 'Financial Capital', type: 'city', icon: 'Plane' },
  { text: 'Bengaluru (BLR)', subtext: "Kempegowda Int'l Airport · Silicon Valley · Karnataka", badge: 'Tech Capital', type: 'city', icon: 'Plane' },
  { text: 'Hyderabad (HYD)', subtext: "Rajiv Gandhi Int'l Airport · Hitech City & Cyberabad · Telangana", badge: 'Tech Hub', type: 'city', icon: 'Utensils' },
  { text: 'Chennai (MAA)', subtext: "Chennai International Airport · Meenambakkam · Tamil Nadu", badge: 'Coastal Metro', type: 'city', icon: 'Anchor' },
  { text: 'Kolkata (CCU)', subtext: "Netaji Subhash Chandra Bose Int'l · Dum Dum · West Bengal", badge: 'Cultural Metro', type: 'city', icon: 'Building2' },
  { text: 'Pune (PNQ)', subtext: "Pune Airport · Koregaon Park & Hinjewadi · Maharashtra", badge: 'Automobile Hub', type: 'city', icon: 'Car' },
  { text: 'Ahmedabad (AMD)', subtext: "Sardar Vallabhbhai Patel Int'l · Sabarmati & GIFT City · Gujarat", badge: 'Commercial Hub', type: 'city', icon: 'Building2' },

  // --- GOA & RESORT HUBS ---
  { text: 'Goa - Mopa (GOX)', subtext: 'Manohar International Airport · North Goa Beaches & Luxury Resorts', badge: 'Beach Resort', type: 'city', icon: 'Sun' },
  { text: 'Goa - Dabolim (GOI)', subtext: 'Dabolim Airport · South Goa & Heritage Villas', badge: 'Beach Resort', type: 'city', icon: 'Sun' },

  // --- NORTH INDIA & HILL STATIONS ---
  { text: 'Jaipur (JAI)', subtext: 'Jaipur International Airport · Pink City & Forts · Rajasthan', badge: 'Heritage Hub', type: 'city', icon: 'Landmark' },
  { text: 'Chandigarh (IXC)', subtext: "Shaheed Bhagat Singh Int'l · Sector 17, Mohali & Panchkula · Punjab/Haryana", badge: 'Smart City', type: 'city', icon: 'MapPin' },
  { text: 'Lucknow (LKO)', subtext: "Chaudhary Charan Singh Int'l · Hazratganj & Gomti Nagar · UP", badge: 'Heritage City', type: 'city', icon: 'Landmark' },
  { text: 'Dehradun (DED)', subtext: 'Jolly Grant Airport · Gateway to Mussoorie, Rishikesh & Haridwar · Uttarakhand', badge: 'Hill Gateway', type: 'city', icon: 'Mountain' },
  { text: 'Manali, Himachal', subtext: 'Old Manali, Solang Valley & Rohtang Pass · Bhuntar (KUU)', badge: 'Hill Station', type: 'city', icon: 'Mountain' },
  { text: 'Shimla (SLV)', subtext: 'Mall Road, Jakhu & Wildflower Sanctuary · Jubbarhatti · Himachal', badge: 'Hill Station', type: 'city', icon: 'Mountain' },
  { text: 'Dharamshala (DHM)', subtext: 'Kangra Airport · McLeodGanj, Triund & Cricket Stadium · Himachal', badge: 'Hill Station', type: 'city', icon: 'Mountain' },
  { text: 'Mussoorie, Uttarakhand', subtext: 'Mall Road, Gun Hill & Kempty Falls · Queen of Hills', badge: 'Hill Station', type: 'city', icon: 'Mountain' },
  { text: 'Nainital, Uttarakhand', subtext: 'Naini Lake, Mallital & Kumaon Hills · Kathgodam Hub', badge: 'Hill Station', type: 'city', icon: 'Mountain' },
  { text: 'Rishikesh, Uttarakhand', subtext: 'Yoga Capital of the World · Ganga Aarti & River Rafting', badge: 'Spiritual/Adventure', type: 'city', icon: 'Sparkles' },
  { text: 'Haridwar, Uttarakhand', subtext: 'Har Ki Pauri, Mansa Devi & Pilgrimage Gateway', badge: 'Spiritual', type: 'city', icon: 'Sparkles' },
  { text: 'Srinagar (SXR)', subtext: "Sheikh ul-Alam Int'l Airport · Dal Lake & Shikara Rides · Kashmir", badge: 'Paradise Valley', type: 'city', icon: 'Mountain' },
  { text: 'Leh Ladakh (IXL)', subtext: 'Kushok Bakula Rimpochee Airport · Pangong Lake & Nubra Valley', badge: 'High Altitude', type: 'city', icon: 'Mountain' },
  { text: 'Jammu (IXJ)', subtext: 'Jammu Civil Enclave · Gateway to Vaishno Devi Katra', badge: 'Pilgrimage Hub', type: 'city', icon: 'Landmark' },
  { text: 'Amritsar (ATQ)', subtext: "Sri Guru Ram Dass Jee Int'l · Golden Temple & Wagah Border · Punjab", badge: 'Spiritual Capital', type: 'city', icon: 'Landmark' },
  { text: 'Agra (AGR)', subtext: 'Agra Airport · Taj Mahal & UNESCO Forts · Uttar Pradesh', badge: 'World Wonder', type: 'city', icon: 'Landmark' },
  { text: 'Varanasi (VNS)', subtext: "Lal Bahadur Shastri Int'l · Kashi Vishwanath & Dashashwamedh Ghat · UP", badge: 'Spiritual Capital', type: 'city', icon: 'Sparkles' },
  { text: 'Ayodhya (AYJ)', subtext: "Maharishi Valmiki Int'l Airport · Ram Mandir & Saryu Ghat · UP", badge: 'Spiritual Hub', type: 'city', icon: 'Landmark' },
  { text: 'Prayagraj / Allahabad (IXD)', subtext: 'Prayagraj Airport · Triveni Sangam & Civil Lines · UP', badge: 'Sangam City', type: 'city', icon: 'MapPin' },
  { text: 'Kanpur (KNU)', subtext: 'Chakeri Airport · Industrial & Educational Hub · UP', badge: 'Industrial Hub', type: 'city', icon: 'Building2' },
  { text: 'Gorakhpur (GOP)', subtext: 'Mahayogi Gorakhnath Airport · Eastern UP Transit Hub', badge: 'Regional Transit', type: 'city', icon: 'MapPin' },
  { text: 'Bareilly (BEK)', subtext: 'Bareilly Airport · Rohilkhand Gateway · UP', badge: 'Regional Transit', type: 'city', icon: 'MapPin' },
  { text: 'Mathura & Vrindavan', subtext: 'Shri Krishna Janmabhoomi & Banke Bihari Temple · UP', badge: 'Spiritual Hub', type: 'city', icon: 'Sparkles' },

  // --- WEST INDIA (MAHARASHTRA & GUJARAT) ---
  { text: 'Surat (STV)', subtext: 'Surat International Airport · Diamond & Textile Capital · Gujarat', badge: 'Commercial Hub', type: 'city', icon: 'Building2' },
  { text: 'Vadodara (BDQ)', subtext: 'Vadodara Airport · Laxmi Vilas Palace & Heritage · Gujarat', badge: 'Cultural Hub', type: 'city', icon: 'Landmark' },
  { text: 'Rajkot (Hirasar)', subtext: 'Rajkot International Airport · Saurashtra Hub · Gujarat', badge: 'Industrial Hub', type: 'city', icon: 'Building2' },
  { text: 'Bhavnagar', subtext: 'Bhavnagar Airport · Gulf of Khambhat & Palitana Jain Temples · Gujarat', badge: 'Port City', type: 'city', icon: 'Anchor' },
  { text: 'Jamnagar (JGA)', subtext: 'Jamnagar Civil Airport · Marine National Park · Gujarat', badge: 'Oil & Trade', type: 'city', icon: 'Building2' },
  { text: 'Nagpur (NAG)', subtext: "Dr. Babasaheb Ambedkar Int'l · Orange City · Maharashtra", badge: 'Logistics Central', type: 'city', icon: 'Building2' },
  { text: 'Nashik (ISK)', subtext: 'Ozar Airport · Wine Capital & Trimbakeshwar Kumbh · Maharashtra', badge: 'Wine Capital', type: 'city', icon: 'Sparkles' },
  { text: 'Aurangabad / Chhatrapati Sambhaji Nagar (IXU)', subtext: 'Airport · Ajanta & Ellora Caves UNESCO · Maharashtra', badge: 'Heritage Caves', type: 'city', icon: 'Landmark' },
  { text: 'Shirdi (SAG)', subtext: 'Shirdi International Airport · Sai Baba Samadhi Mandir · Maharashtra', badge: 'Pilgrimage Hub', type: 'city', icon: 'Sparkles' },
  { text: 'Kolhapur (KLH)', subtext: 'Chhatrapati Rajaram Maharaj Airport · Mahalaxmi Temple · Maharashtra', badge: 'Heritage Hub', type: 'city', icon: 'Landmark' },
  { text: 'Lonavala & Khandala', subtext: 'Tiger Point, Bhushi Dam & Western Ghats · Weekend Getaway', badge: 'Hill Station', type: 'city', icon: 'Mountain' },
  { text: 'Mahabaleshwar & Panchgani', subtext: 'Strawberry Country, Arthur Seat & Sahyadri Peaks · Maharashtra', badge: 'Hill Station', type: 'city', icon: 'Mountain' },
  { text: 'Alibaug, Maharashtra', subtext: 'Coastal Beaches, Mandwa RORO Jetty & Luxury Coastal Villas', badge: 'Beach Resort', type: 'city', icon: 'Sun' },

  // --- RAJASTHAN (ROYAL LEISURE) ---
  { text: 'Udaipur (UDR)', subtext: 'Maharana Pratap Airport · City of Lakes, Lake Pichola · Rajasthan', badge: 'Romantic Stay', type: 'city', icon: 'Sparkles' },
  { text: 'Jodhpur (JDH)', subtext: 'Jodhpur Airport · Sun City, Mehrangarh Fort · Rajasthan', badge: 'Heritage Hub', type: 'city', icon: 'Landmark' },
  { text: 'Jaisalmer (JSA)', subtext: 'Jaisalmer Airport · Golden Fort & Sam Sand Dunes · Rajasthan', badge: 'Desert Stay', type: 'city', icon: 'Sun' },
  { text: 'Bikaner (BKB)', subtext: 'Nal Airport · Junagarh Fort & Karni Mata · Rajasthan', badge: 'Heritage Hub', type: 'city', icon: 'Landmark' },
  { text: 'Mount Abu, Rajasthan', subtext: 'Nakki Lake & Dilwara Jain Temples · Rajasthan Only Hill Station', badge: 'Hill Station', type: 'city', icon: 'Mountain' },
  { text: 'Pushkar & Ajmer', subtext: 'Brahma Temple, Pushkar Lake & Ajmer Sharif Dargah', badge: 'Spiritual Hub', type: 'city', icon: 'Sparkles' },

  // --- CENTRAL & EAST INDIA ---
  { text: 'Indore (IDR)', subtext: 'Devi Ahilyabai Holkar Airport · Chappan Dukan & Sarafa · MP', badge: 'Cleanest City', type: 'city', icon: 'Utensils' },
  { text: 'Bhopal (BHO)', subtext: 'Raja Bhoj Airport · Upper Lake & UNESCO Bhimbetka · MP', badge: 'City of Lakes', type: 'city', icon: 'Building2' },
  { text: 'Gwalior (GWL)', subtext: 'Rajmata Vijaya Raje Scindia Airport · Gwalior Fort · MP', badge: 'Heritage Fort', type: 'city', icon: 'Landmark' },
  { text: 'Jabalpur (JLR)', subtext: 'Dumna Airport · Bhedaghat Marble Rocks & Narmada River · MP', badge: 'Scenic River', type: 'city', icon: 'Mountain' },
  { text: 'Ujjain, Madhya Pradesh', subtext: 'Mahakaleshwar Jyotirlinga, Mahakal Lok Corridor', badge: 'Spiritual Hub', type: 'city', icon: 'Sparkles' },
  { text: 'Patna (PAT)', subtext: 'Jay Prakash Narayan Airport · Bihar State Capital', badge: 'State Capital', type: 'city', icon: 'Building2' },
  { text: 'Gaya / Bodh Gaya (GAY)', subtext: 'Gaya Airport · Mahabodhi Temple UNESCO World Heritage', badge: 'Buddhist Pilgrimage', type: 'city', icon: 'Sparkles' },
  { text: 'Bhubaneswar (BBI)', subtext: 'Biju Patnaik Int\'l · Temple City of India & Smart Hub · Odisha', badge: 'Temple City', type: 'city', icon: 'Landmark' },
  { text: 'Puri, Odisha', subtext: 'Jagannath Dham, Golden Beach & Konark Sun Temple', badge: 'Pilgrimage/Beach', type: 'city', icon: 'Sparkles' },
  { text: 'Ranchi (IXR)', subtext: 'Birsa Munda Airport · City of Waterfalls · Jharkhand Capital', badge: 'State Capital', type: 'city', icon: 'Building2' },
  { text: 'Jamshedpur (Tatanagar)', subtext: 'Steel City of India · Jubilee Park & Dalma Hills · Jharkhand', badge: 'Industrial Hub', type: 'city', icon: 'Building2' },
  { text: 'Raipur (RPR)', subtext: 'Swami Vivekananda Airport · Capital of Chhattisgarh', badge: 'State Capital', type: 'city', icon: 'Building2' },

  // --- SOUTH INDIA & BACKWATERS ---
  { text: 'Kochi / Cochin (COK)', subtext: "Cochin International Airport · Fort Kochi & Backwaters · Kerala", badge: 'Backwaters Hub', type: 'city', icon: 'Sailboat' },
  { text: 'Thiruvananthapuram (TRV)', subtext: "Trivandrum Int'l · Padmanabhaswamy Temple & Kovalam · Kerala", badge: 'Coastal Capital', type: 'city', icon: 'Anchor' },
  { text: 'Kozhikode / Calicut (CCJ)', subtext: "Calicut International Airport · Malabar Culinary Hub · Kerala", badge: 'Food & Trade', type: 'city', icon: 'Utensils' },
  { text: 'Kannur (CNN)', subtext: "Kannur International Airport · North Kerala Handlooms & Theyyam", badge: 'Coastal Hub', type: 'city', icon: 'Plane' },
  { text: 'Munnar, Kerala', subtext: 'Tea Estates, Mattupetty Dam & Anamudi Peaks · Western Ghats', badge: 'Hill Station', type: 'city', icon: 'Mountain' },
  { text: 'Wayanad, Kerala', subtext: 'Chembra Peak, Banasura Sagar & Coffee Estates · Kerala', badge: 'Hill Station', type: 'city', icon: 'Mountain' },
  { text: 'Alleppey (Alappuzha)', subtext: 'Venice of the East, Vembanad Lake & Luxury Houseboats · Kerala', badge: 'Backwaters Resort', type: 'city', icon: 'Sailboat' },
  { text: 'Coimbatore (CJB)', subtext: 'Coimbatore Int\'l · Isha Yoga & Textiles · Tamil Nadu', badge: 'Textile Hub', type: 'city', icon: 'Building2' },
  { text: 'Madurai (IXM)', subtext: 'Madurai Airport · Meenakshi Amman Temple & Heritage · Tamil Nadu', badge: 'Temple Capital', type: 'city', icon: 'Landmark' },
  { text: 'Tiruchirappalli (TRZ)', subtext: 'Trichy Int\'l · Rockfort Temple & Central Tamil Nadu Hub', badge: 'Heritage Hub', type: 'city', icon: 'Landmark' },
  { text: 'Ooty (Udhagamandalam)', subtext: 'Nilgiri Mountain Railway, Botanical Gardens & Tea Gardens · TN', badge: 'Queen of Hills', type: 'city', icon: 'Mountain' },
  { text: 'Kodaikanal, Tamil Nadu', subtext: 'Princess of Hill Stations, Kodai Lake & Coaker\'s Walk', badge: 'Hill Station', type: 'city', icon: 'Mountain' },
  { text: 'Pondicherry (Puducherry)', subtext: 'French Colony, White Town, Promenade Beach & Auroville', badge: 'Heritage Coastal', type: 'city', icon: 'Sun' },
  { text: 'Visakhapatnam / Vizag (VTZ)', subtext: 'Visakhapatnam Airport · RK Beach, Araku Valley · Andhra Pradesh', badge: 'Coastal Hub', type: 'city', icon: 'Anchor' },
  { text: 'Vijayawada (VGA)', subtext: 'Vijayawada International Airport · Amaravati & Kanaka Durga · AP', badge: 'Commercial Hub', type: 'city', icon: 'Building2' },
  { text: 'Tirupati (TIR)', subtext: 'Tirupati Airport · Tirumala Venkateswara Temple Pilgrimage · AP', badge: 'Spiritual Capital', type: 'city', icon: 'Sparkles' },
  { text: 'Mangalore / Mangaluru (IXE)', subtext: 'Mangaluru Int\'l · Panambur Beach, Coastal Tulu Nadu · Karnataka', badge: 'Port City', type: 'city', icon: 'Anchor' },
  { text: 'Mysore / Mysuru (MYQ)', subtext: 'Mysore Palace, Chamundi Hill & Silk Capital · Karnataka', badge: 'Heritage City', type: 'city', icon: 'Landmark' },
  { text: 'Coorg (Madikeri)', subtext: 'Scotland of India, Coffee Plantations & Abbey Falls · Karnataka', badge: 'Hill Station', type: 'city', icon: 'Mountain' },
  { text: 'Hampi, Karnataka', subtext: 'UNESCO World Heritage Vijayanagara Ruins & Boulder Landscape', badge: 'UNESCO Heritage', type: 'city', icon: 'Landmark' },
  { text: 'Hubballi / Dharwad (HBX)', subtext: 'Hubli Airport · Commercial Nerve Center of North Karnataka', badge: 'Commercial Hub', type: 'city', icon: 'Building2' },
  { text: 'Belagavi / Belgaum (IXG)', subtext: 'Belgaum Airport · Western Ghats Foothills · Karnataka', badge: 'Regional Transit', type: 'city', icon: 'MapPin' },

  // --- ADDITIONAL TIER-2 & TIER-3 CITIES ACROSS ALL INDIAN STATES ---
  // Punjab, Haryana & NCR
  { text: 'Ludhiana (LUH)', subtext: 'Industrial & Hosiery Capital · Model Town & Sarabha Nagar · Punjab', badge: 'Industrial Hub', type: 'city', icon: 'Building2' },
  { text: 'Jalandhar', subtext: 'Sports Capital of India · Model Town & Cantt · Punjab', badge: 'Commercial Hub', type: 'city', icon: 'Building2' },
  { text: 'Patiala', subtext: 'Royal City, Qila Mubarak & Heritage · Punjab', badge: 'Heritage City', type: 'city', icon: 'Landmark' },
  { text: 'Bathinda (BTI)', subtext: 'Bathinda Airport · Thermal City & Qila Mubarak · Punjab', badge: 'Regional Transit', type: 'city', icon: 'MapPin' },
  { text: 'Gurugram (122002)', subtext: 'Cyber Hub, Golf Course Road & Millennium City · Haryana', badge: 'Corporate Tech', type: 'city', icon: 'Building2' },
  { text: 'Noida (201301)', subtext: 'Sector 18, Sector 62 & Greater Noida Expressway · Uttar Pradesh', badge: 'Corporate Tech', type: 'city', icon: 'Building2' },
  { text: 'Faridabad (121001)', subtext: 'Old Faridabad, NIT & Neharpar · Haryana NCR', badge: 'Industrial Hub', type: 'city', icon: 'Building2' },
  { text: 'Ghaziabad (201001)', subtext: 'Indirapuram, Vaishali & Raj Nagar Extension · UP NCR', badge: 'Urban Metro', type: 'city', icon: 'Building2' },
  { text: 'Panipat', subtext: 'Historic Battlefield & Textile City · Haryana', badge: 'Textile Hub', type: 'city', icon: 'Building2' },
  { text: 'Karnal', subtext: 'City of Karna & Smart City · GT Road Corridor · Haryana', badge: 'Smart City', type: 'city', icon: 'MapPin' },
  { text: 'Hisar (HSS)', subtext: 'Maharaja Agrasen Airport · Steel City · Haryana', badge: 'Industrial Hub', type: 'city', icon: 'Building2' },
  { text: 'Rohtak', subtext: 'Educational Hub & PGIMS · Haryana', badge: 'Regional Transit', type: 'city', icon: 'MapPin' },

  // Uttar Pradesh & Bihar
  { text: 'Meerut', subtext: 'Sports Goods & RapidX Transit Corridor · UP', badge: 'Industrial Hub', type: 'city', icon: 'Building2' },
  { text: 'Aligarh', subtext: 'Lock City & AMU Campus · GT Road · UP', badge: 'Educational Hub', type: 'city', icon: 'Landmark' },
  { text: 'Moradabad', subtext: 'Brass City of India · Peetal Nagri · UP', badge: 'Handicrafts Hub', type: 'city', icon: 'Building2' },
  { text: 'Jhansi', subtext: 'Rani Laxmi Bai Fort & Bundelkhand Gateway · UP', badge: 'Heritage Fort', type: 'city', icon: 'Landmark' },
  { text: 'Muzaffarpur', subtext: 'Shahi Litchi Capital & North Bihar Commercial Nerve · Bihar', badge: 'Commercial Hub', type: 'city', icon: 'Building2' },
  { text: 'Bhagalpur', subtext: 'Silk City of India · Ganga River Dolphins · Bihar', badge: 'Silk Capital', type: 'city', icon: 'Building2' },
  { text: 'Darbhanga (DBR)', subtext: 'Darbhanga Airport · Mithila Cultural Capital · Bihar', badge: 'Cultural Hub', type: 'city', icon: 'Plane' },

  // Rajasthan
  { text: 'Kota', subtext: 'Chambal Riverfront & Coaching Capital · Rajasthan', badge: 'Educational Hub', type: 'city', icon: 'Building2' },
  { text: 'Ajmer', subtext: 'Ajmer Sharif Dargah, Ana Sagar Lake & Heritage · Rajasthan', badge: 'Spiritual Hub', type: 'city', icon: 'Sparkles' },
  { text: 'Alwar', subtext: 'Bhangarh, Sariska Tiger Reserve & Matsya Desh · Rajasthan', badge: 'Wildlife/Heritage', type: 'city', icon: 'Mountain' },
  { text: 'Bhilwara', subtext: 'Textile City & Synthetic Capital · Rajasthan', badge: 'Textile Hub', type: 'city', icon: 'Building2' },

  // Gujarat
  { text: 'Gandhinagar', subtext: 'Green Capital of Gujarat · Akshardham Temple & GIFT City', badge: 'State Capital', type: 'city', icon: 'Building2' },
  { text: 'Anand', subtext: 'Milk Capital of India · AMUL Headquarters · Gujarat', badge: 'Dairy Hub', type: 'city', icon: 'Building2' },
  { text: 'Vapi & Valsad', subtext: 'Chemical & Industrial Hub · Gateway to Daman & Silvassa', badge: 'Industrial Hub', type: 'city', icon: 'Building2' },
  { text: 'Navsari', subtext: 'Twin City to Surat · Diamond & Agro Center · Gujarat', badge: 'Commercial Hub', type: 'city', icon: 'Building2' },
  { text: 'Bhuj / Kutch (BHJ)', subtext: 'Bhuj Airport · Great Rann of Kutch White Desert & Rann Utsav', badge: 'Desert Tourism', type: 'city', icon: 'Sun' },
  { text: 'Somnath & Veraval', subtext: 'First Jyotirlinga Shrine · Arabian Sea Coast · Gujarat', badge: 'Spiritual Hub', type: 'city', icon: 'Sparkles' },
  { text: 'Dwarka', subtext: 'Dwarkadhish Temple · Char Dham Pilgrimage · Gujarat', badge: 'Spiritual Hub', type: 'city', icon: 'Sparkles' },

  // Maharashtra
  { text: 'Thane', subtext: 'City of Lakes & Ghodbunder Road · Mumbai MMR', badge: 'Urban Metro', type: 'city', icon: 'Building2' },
  { text: 'Navi Mumbai', subtext: 'Vashi, Belapur & Navi Mumbai Int\'l Airport (NMI) · MMR', badge: 'Smart Metro', type: 'city', icon: 'Building2' },
  { text: 'Solapur', subtext: 'Chaddar Capital & Siddheshwar Temple · Maharashtra', badge: 'Textile Hub', type: 'city', icon: 'Building2' },
  { text: 'Amravati', subtext: 'Cotton Capital & Ambadevi Temple · Vidarbha, Maharashtra', badge: 'Regional Hub', type: 'city', icon: 'Building2' },
  { text: 'Nanded (NDC)', subtext: 'Shri Hazur Abchalnagar Sahib Gurudwara · Godavari River · Maharashtra', badge: 'Spiritual Hub', type: 'city', icon: 'Sparkles' },
  { text: 'Jalgaon', subtext: 'Banana City & Gold City · Gateway to Ajanta Caves', badge: 'Commercial Hub', type: 'city', icon: 'Building2' },
  { text: 'Ratnagiri', subtext: 'Alphonso Mango Country & Konkan Coastal Beaches · Maharashtra', badge: 'Coastal Gateway', type: 'city', icon: 'Sun' },

  // Madhya Pradesh & Chhattisgarh
  { text: 'Ratlam', subtext: 'Sew & Gold Market · Major Western Railway Junction · MP', badge: 'Transit Hub', type: 'city', icon: 'MapPin' },
  { text: 'Sagar & Satna', subtext: 'Bundelkhand Gateway & Cement Hub · Central MP', badge: 'Regional Hub', type: 'city', icon: 'Building2' },
  { text: 'Bilaspur (PAB)', subtext: 'Bilaspur Airport · High Court of Chhattisgarh · SECL Hub', badge: 'Regional Transit', type: 'city', icon: 'Building2' },
  { text: 'Durg-Bhilai', subtext: 'Bhilai Steel Plant & Educational Hub · Chhattisgarh', badge: 'Industrial Hub', type: 'city', icon: 'Building2' },

  // Odisha & Jharkhand & West Bengal
  { text: 'Cuttack', subtext: 'Silver City & Barabati Fort · Mahanadi Riverfront · Odisha', badge: 'Heritage Hub', type: 'city', icon: 'Landmark' },
  { text: 'Rourkela (RRK)', subtext: 'Rourkela Airport · Steel City & Birsa Munda Hockey Stadium · Odisha', badge: 'Industrial Hub', type: 'city', icon: 'Building2' },
  { text: 'Sambalpur', subtext: 'Hirakud Dam & Sambalpuri Handlooms · Western Odisha', badge: 'Handloom Hub', type: 'city', icon: 'Building2' },
  { text: 'Dhanbad', subtext: 'Coal Capital of India · IIT ISM Campus · Jharkhand', badge: 'Mining Hub', type: 'city', icon: 'Building2' },
  { text: 'Bokaro Steel City', subtext: 'Bokaro Steel Plant & Garga Dam · Jharkhand', badge: 'Industrial Hub', type: 'city', icon: 'Building2' },
  { text: 'Deoghar (DGH)', subtext: 'Deoghar International Airport · Baidyanath Jyotirlinga Dham', badge: 'Spiritual Hub', type: 'city', icon: 'Sparkles' },
  { text: 'Asansol & Durgapur (RDP)', subtext: 'Kazi Nazrul Islam Airport · Industrial Corridor · West Bengal', badge: 'Industrial Hub', type: 'city', icon: 'Building2' },
  { text: 'Siliguri', subtext: 'Chicken\'s Neck Corridor · North Bengal Trade Capital', badge: 'Transit Gateway', type: 'city', icon: 'MapPin' },

  // South India (Karnataka, TN, AP, Telangana, Kerala)
  { text: 'Warangal (WGC)', subtext: 'Kakatiya Dynasty Ruins, Thousand Pillar Temple · Telangana', badge: 'Heritage UNESCO', type: 'city', icon: 'Landmark' },
  { text: 'Nizamabad', subtext: 'Haldi Capital & Ashok Sagar · Northern Telangana', badge: 'Agro Hub', type: 'city', icon: 'Building2' },
  { text: 'Salem', subtext: 'Steel City & Mango Capital · Central Tamil Nadu', badge: 'Industrial Hub', type: 'city', icon: 'Building2' },
  { text: 'Tirunelveli', subtext: 'Halwa Capital & Nellaiappar Temple · Southern Tamil Nadu', badge: 'Heritage Hub', type: 'city', icon: 'Landmark' },
  { text: 'Tiruppur', subtext: 'Knitwear Capital of India · Cotton Export Hub · TN', badge: 'Textile Export', type: 'city', icon: 'Building2' },
  { text: 'Erode', subtext: 'Turmeric City & Handlooms · Tamil Nadu', badge: 'Turmeric Capital', type: 'city', icon: 'Building2' },
  { text: 'Vellore', subtext: 'Golden Temple Sripuram, Fort & CMC Health Hub · TN', badge: 'Health & Heritage', type: 'city', icon: 'Landmark' },
  { text: 'Thoothukudi / Tuticorin (TCR)', subtext: 'Tuticorin Airport · Pearl City & Major Sea Port · TN', badge: 'Port City', type: 'city', icon: 'Anchor' },
  { text: 'Kanyakumari', subtext: 'Southernmost Tip of Mainland India · Vivekananda Rock Memorial', badge: 'Land\'s End', type: 'city', icon: 'Sun' },
  { text: 'Rameswaram', subtext: 'Ramanathaswamy Temple, Pamban Bridge & Dhanushkodi · TN', badge: 'Pilgrimage Island', type: 'city', icon: 'Sparkles' },
  { text: 'Guntur', subtext: 'Mirchi Yard & Amaravati Capital Region · Andhra Pradesh', badge: 'Spice Capital', type: 'city', icon: 'Building2' },
  { text: 'Rajahmundry (RJA)', subtext: 'Rajahmundry Airport · Cultural Capital of Andhra & Godavari Ghats', badge: 'Cultural Hub', type: 'city', icon: 'Building2' },
  { text: 'Kakinada', subtext: 'Deepwater Port & Hope Island · Andhra Pradesh', badge: 'Port City', type: 'city', icon: 'Anchor' },
  { text: 'Nellore', subtext: 'Aquaculture Capital & Penna Riverfront · AP', badge: 'Agro Coastal', type: 'city', icon: 'Building2' },
  { text: 'Kurnool (KJB)', subtext: 'Uyyalawada Narasimha Reddy Airport · Gateway to Rayalaseema', badge: 'Regional Transit', type: 'city', icon: 'MapPin' },
  { text: 'Kadapa (CDP)', subtext: 'Kadapa Airport · Gandikota Grand Canyon of India · AP', badge: 'Scenic Canyon', type: 'city', icon: 'Mountain' },
  { text: 'Anantapur', subtext: 'Automobile Cluster & Lepakshi Temple · AP', badge: 'Industrial Hub', type: 'city', icon: 'Building2' },
  { text: 'Thrissur', subtext: 'Cultural Capital of Kerala · Thrissur Pooram & Vadakkunnathan', badge: 'Cultural Capital', type: 'city', icon: 'Landmark' },
  { text: 'Kollam', subtext: 'Cashew Capital & Ashtamudi Lake Gateway · Kerala', badge: 'Lake Resort', type: 'city', icon: 'Sailboat' },
  { text: 'Palakkad', subtext: 'Gateway of Kerala, Western Ghats Gap & Silent Valley', badge: 'Valley Gateway', type: 'city', icon: 'Mountain' },
  { text: 'Kottayam', subtext: 'Land of Letters, Rubber Plantations & Kumarakom Backwaters', badge: 'Backwaters Resort', type: 'city', icon: 'Sailboat' },
  { text: 'Varkala, Kerala', subtext: 'Papanasam Beach Cliff & Sunset Cafes · Arabian Sea', badge: 'Beach Cliff', type: 'city', icon: 'Sun' },
  { text: 'Davanagere', subtext: 'Benne Dosa Capital & Central Karnataka Commercial Hub', badge: 'Food & Trade', type: 'city', icon: 'Utensils' },
  { text: 'Ballari / Bellary', subtext: 'Bellary Fort & Gateway to Hampi UNESCO · Karnataka', badge: 'Heritage Hub', type: 'city', icon: 'Landmark' },
  { text: 'Shivamogga / Shimoga (RQY)', subtext: 'Kuvempu Airport · Jog Falls & Malnad Gateway · Karnataka', badge: 'Waterfalls Hub', type: 'city', icon: 'Mountain' },
  { text: 'Tumakuru', subtext: 'Smart Industrial City & Devarayanadurga · Karnataka', badge: 'Smart City', type: 'city', icon: 'Building2' },
  { text: 'Udupi & Manipal', subtext: 'Sri Krishna Matha, Malpe Beach & University Town · Karnataka', badge: 'Temple & Beach', type: 'city', icon: 'Sparkles' },
  { text: 'Gokarna, Karnataka', subtext: 'Om Beach, Kudle Beach & Mahabaleshwar Temple · Coastal Getaway', badge: 'Beach Resort', type: 'city', icon: 'Sun' },
  { text: 'Chikmagalur, Karnataka', subtext: 'Mullayanagiri Peak, Coffee Country & Baba Budangiri · Karnataka', badge: 'Coffee Country', type: 'city', icon: 'Mountain' },

  // Hill Stations & Pilgrimage
  { text: 'Kasauli, Himachal', subtext: 'Gilbert Trail, Monkey Point & Colonial Cantonment', badge: 'Hill Station', type: 'city', icon: 'Mountain' },
  { text: 'Dalhousie & Khajjiar', subtext: 'Mini Switzerland of India & Pine Clad Valleys · Himachal', badge: 'Hill Station', type: 'city', icon: 'Mountain' },
  { text: 'Almora & Ranikhet', subtext: 'Kumaon Peaks, Chaubatia Apple Orchards · Uttarakhand', badge: 'Hill Station', type: 'city', icon: 'Mountain' },
  { text: 'Auli, Uttarakhand', subtext: 'Skiing Capital of India & Nanda Devi Panoramic View', badge: 'Snow & Skiing', type: 'city', icon: 'Mountain' },
  { text: 'Kedarnath & Badrinath', subtext: 'Char Dham Himalayan Shrines · Uttarakhand', badge: 'Himalayan Shrine', type: 'city', icon: 'Sparkles' },

  // --- DIRECT INTERNATIONAL CONNECTIONS FROM INDIA ---
  { text: 'Dubai (DXB)', subtext: 'Dubai International Airport, UAE · Terminal 1/2/3', badge: 'Top International', type: 'city', icon: 'Globe' },
  { text: 'Abu Dhabi (AUH)', subtext: 'Zayed International Airport, United Arab Emirates', badge: 'International', type: 'city', icon: 'Globe' },
  { text: 'Doha (DOH)', subtext: 'Hamad International Airport, Qatar', badge: 'International', type: 'city', icon: 'Globe' },
  { text: 'Singapore (SIN)', subtext: 'Changi International Airport, Singapore · Terminals 1–4', badge: 'International', type: 'city', icon: 'Globe' },
  { text: 'Bangkok (BKK)', subtext: 'Suvarnabhumi & Don Mueang Airports, Thailand', badge: 'International', type: 'city', icon: 'Globe' },
  { text: 'London (LHR)', subtext: 'Heathrow Airport, London, United Kingdom', badge: 'International', type: 'city', icon: 'Globe' },
  { text: 'Kuala Lumpur (KUL)', subtext: 'Kuala Lumpur International Airport (KLIA), Malaysia', badge: 'International', type: 'city', icon: 'Globe' },
  { text: 'Male / Maldives (MLE)', subtext: 'Velana International Airport, Maldives Overwater Villas', badge: 'Island Resort', type: 'city', icon: 'Sun' },
  { text: 'Colombo (CMB)', subtext: 'Bandaranaike International Airport, Sri Lanka', badge: 'International', type: 'city', icon: 'Globe' },
  { text: 'Kathmandu (KTM)', subtext: 'Tribhuvan International Airport, Nepal', badge: 'International', type: 'city', icon: 'Globe' },
  { text: 'New York (JFK)', subtext: 'John F. Kennedy International Airport, USA', badge: 'International', type: 'city', icon: 'Globe' },
];

export const AUTOCOMPLETE_PRODUCTS: AutocompleteSuggestion[] = [
  { text: 'Sony WH-1000XM5 Wireless Headphones', subtext: 'Industry Leading Noise Cancellation · 30hr Battery', badge: 'Best Seller', type: 'product' },
  { text: 'Apple iPhone 16 Pro Max (256GB)', subtext: 'A18 Pro Chip · 48MP Fusion Camera · Titanium', badge: 'Flagship', type: 'product' },
  { text: 'Samsung Galaxy S24 Ultra 5G', subtext: 'Snapdragon 8 Gen 3 · 200MP Camera with Galaxy AI', badge: 'Flagship AI', type: 'product' },
  { text: 'Apple MacBook Air M3 (16GB RAM, 512GB)', subtext: 'Liquid Retina Display · 18h Battery · Midnight', badge: 'Pro Performance', type: 'product' },
  { text: 'OnePlus 12 5G (16GB RAM, 512GB)', subtext: 'Hasselblad 4th Gen Camera · 100W SUPERVOOC', badge: 'Value Flagship', type: 'product' },
  { text: 'Apple AirPods Pro (2nd Gen with USB-C)', subtext: 'Up to 2x more Active Noise Cancellation', badge: 'Popular', type: 'product' },
  { text: 'iPad Air 11-inch M2 (WiFi 128GB)', subtext: 'Stunning Liquid Retina Display · Apple Pencil Pro', badge: 'Hot Deal', type: 'product' },
  { text: 'Dell XPS 13 Intel Core Ultra 7', subtext: 'OLED Touch Display · Intel AI Boost NPU', badge: 'Ultrabook', type: 'product' },
  { text: 'LG 55-inch 4K OLED Smart TV (C3)', subtext: 'Self-lit OLED Pixels · Dolby Vision IQ & Atmos', badge: 'Premium Home', type: 'product' },
  { text: 'PlayStation 5 Console (Slim Edition)', subtext: '1TB Custom SSD · DualSense Wireless Controller', badge: 'Gaming Pick', type: 'product' },
  { text: 'Kindle Paperwhite (16GB, 6.8" Glare-free)', subtext: 'Adjustable Warm Light · Up to 10 Weeks Battery', badge: 'Readers Choice', type: 'product' },
  { text: 'Dyson V12 Detect Slim Cordless Vacuum', subtext: 'Laser reveals invisible dust · Piezo sensor', badge: 'Luxury Living', type: 'product' },
];

export const AUTOCOMPLETE_GROCERY: AutocompleteSuggestion[] = [
  { text: 'Amul Taaza Homogenised Toned Milk 1L', subtext: 'Dairy Essentials · Fresh in 8 Mins', badge: '⚡ 8 Min', type: 'grocery' },
  { text: 'Amul Pasteurised Butter 500g', subtext: '100% Pure Creamery Butter · Cold Chain Delivered', badge: '⚡ 7 Min', type: 'grocery' },
  { text: 'Fortune Sunlite Refined Sunflower Oil 1L', subtext: 'Cooking Oil & Ghee · Lowest Price Guaranteed', badge: '⚡ 9 Min', type: 'grocery' },
  { text: 'Aashirvaad Superior MP Shudh Chakki Atta 10kg', subtext: '0% Maida · 100% Whole Wheat', badge: '⚡ 10 Min', type: 'grocery' },
  { text: 'Tata Salt Vacuum Evaporated Iodised Salt 1kg', subtext: 'Desh Ka Namak · Daily Staple', badge: '⚡ 6 Min', type: 'grocery' },
  { text: 'Maggi 2-Minute Masala Instant Noodles (12-Pack)', subtext: 'Quick Snacks & Instant Food', badge: '⚡ 7 Min', type: 'grocery' },
  { text: 'Britannia 100% Whole Wheat Bread 400g', subtext: 'Fresh Bakery · Baked Today', badge: '⚡ 8 Min', type: 'grocery' },
  { text: 'Fresh Farm White Eggs (Pack of 12)', subtext: 'Antibiotic Residue Free · Farm Fresh', badge: '⚡ 8 Min', type: 'grocery' },
  { text: 'Coca-Cola Zero Sugar Soft Drink Can 300ml', subtext: 'Chilled Cold Drinks & Sodas', badge: '⚡ 6 Min', type: 'grocery' },
  { text: "Lay's India's Magic Masala Potato Chips 50g", subtext: 'Snacks & Munchies', badge: '⚡ 7 Min', type: 'grocery' },
  { text: 'Surf Excel Matic Front Load Liquid Detergent 2L', subtext: 'Home Care & Laundry Essentials', badge: '⚡ 12 Min', type: 'grocery' },
  { text: 'Dettol Original Germ Protection Bathing Soap (Pack of 4)', subtext: 'Personal Care & Hygiene', badge: '⚡ 9 Min', type: 'grocery' },
];

export const AUTOCOMPLETE_FOOD: AutocompleteSuggestion[] = [
  { text: 'Hyderabadi Chicken Dum Biryani', subtext: 'Served with Mirchi Ka Salan & Mint Raita · 24 Mins', badge: '🔥 Top Ordered', type: 'food' },
  { text: 'Special Mutton Galouti Kebabs with Roomali Roti', subtext: 'Melt-in-mouth Awadhi Lucknowi Kebabs', badge: 'Chef Special', type: 'food' },
  { text: 'Butter Chicken (Murgh Makhani) with Garlic Naan', subtext: 'Velvety Tomato Cream Gravy · Tandoori Boneless', badge: 'Bestseller', type: 'food' },
  { text: 'Paneer Butter Masala & Dal Makhani Combo', subtext: 'Includes 2 Butter Rotis, Jeera Rice & Gulab Jamun', badge: 'Veg Combo', type: 'food' },
  { text: 'Authentic Wood-Fired Margherita Pizza', subtext: 'San Marzano Tomato, Fresh Buffalo Mozzarella & Basil', badge: 'Italian', type: 'food' },
  { text: 'Crispy Butter Masala Dosa with Sambar & 3 Chutneys', subtext: 'South Indian Breakfast & Tiffins', badge: 'Breakfast', type: 'food' },
  { text: 'Steamed Himalayan Chicken Momos (8 Pieces)', subtext: 'Served with Spicy Red Chilli Chutney & Mayo', badge: 'Street Food', type: 'food' },
  { text: 'Zinger Burger & Peri Peri Fries Combo', subtext: 'Crispy Fried Chicken Fillet with Chilled Soda', badge: 'Fast Food', type: 'food' },
  { text: 'Wok-Tossed Hakka Noodles with Chilli Chicken', subtext: 'Indo-Chinese Delights', badge: 'Chinese', type: 'food' },
  { text: 'Mediterranean High Protein Quinoa Salad Bowl', subtext: 'Feta Cheese, Kalamata Olives, Lemon Herb Dressing', badge: 'Healthy', type: 'food' },
];

export const AUTOCOMPLETE_DATES: AutocompleteSuggestion[] = [
  { text: 'Today (Immediate Booking)', subtext: 'Fastest departure & instant e-ticket issuance', badge: 'Instant', type: 'date' },
  { text: 'Tonight, 10:15 PM (AC Sleeper)', subtext: 'Overnight journey with live bus tracking', badge: 'Bus / Cab', type: 'date' },
  { text: 'Tomorrow Morning (06:00 AM – 09:00 AM)', subtext: 'Early flight / ride with zero traffic delays', badge: 'Morning', type: 'date' },
  { text: 'Tomorrow → +3 Nights', subtext: 'Standard weekend leisure hotel & resort escape', badge: 'Hotels', type: 'date' },
  { text: 'This Friday – Sunday (Weekend Getaway)', subtext: '2 Nights & 3 Days roundtrip package', badge: 'Weekend', type: 'date' },
  { text: 'Next Weekend (Sat 10/10 – Sat 17/10)', subtext: '7-day return roundtrip travel window', badge: 'Best Rate', type: 'date' },
  { text: 'Diwali Festive Week (Holiday Surge Radar)', subtext: 'Advance lock-in before prices surge 40%', badge: 'Festive', type: 'date' },
  { text: 'Flexible (±3 Days Lowest Fare Radar)', subtext: 'Scans full week calendar for cheapest day', badge: 'Save ₹3,000+', type: 'date' },
];

export const AUTOCOMPLETE_CABS_LOCATIONS: AutocompleteSuggestion[] = [
  { text: 'Indira Gandhi Int’l Airport (Terminal 3, DEL)', subtext: 'Pillars 4–10 Cab Pickup Zone · 110037', badge: 'Airport Hub', type: 'location' },
  { text: 'DLF Cyber City, Gurugram (Phase 2)', subtext: 'Cyber Hub Building 10 / Gateway Tower · 122002', badge: 'Office Tech', type: 'location' },
  { text: 'New Delhi Railway Station (Ajmeri Gate Side)', subtext: 'Metro Station Gate 1 / Paharganj Side · 110006', badge: 'Transit', type: 'location' },
  { text: 'Connaught Place Inner Circle, New Delhi', subtext: 'Block A to F, Rajiv Chowk Metro Hub · 110001', badge: 'Central Delhi', type: 'location' },
  { text: 'Noida Electronic City (Sector 62)', subtext: 'Metro Gate 3 / Stellar IT Park · 201309', badge: 'Corporate Hub', type: 'location' },
  { text: 'Kempegowda Int’l Airport (BLR T1/T2)', subtext: 'App-Based Taxi Pickup Bay 3 · 560300', badge: 'Airport Hub', type: 'location' },
  { text: 'Indiranagar 100 Feet Road, Bengaluru', subtext: 'Near 12th Main Crossing · 560038', badge: 'Dining Hub', type: 'location' },
  { text: 'Bandra Kurla Complex (BKC), Mumbai', subtext: 'G Block, Jio World Drive / Diamond Bourse · 400051', badge: 'Financial Hub', type: 'location' },
  { text: 'Chhatrapati Shivaji Maharaj Airport (T2 Mumbai)', subtext: 'Level P4 Ola/Uber Pickup Lounge · 400099', badge: 'Airport Hub', type: 'location' },
  { text: 'Hitech City Cyber Towers, Hyderabad', subtext: 'Madhapur / Inorbit Mall Road · 500081', badge: 'Tech Hub', type: 'location' },
];

export const AUTOCOMPLETE_CATEGORIES: Record<string, string[]> = {
  grocery: [
    'All Staples',
    'Dairy, Milk & Butter',
    'Cooking Oil & Ghee',
    'Fresh Fruits & Vegetables',
    'Atta, Rice & Dals',
    'Breakfast Cereals & Breads',
    'Snacks, Biscuits & Chips',
    'Beverages & Cold Drinks',
    'Personal Care & Soaps',
    'Cleaning & Household Detergents',
  ],
  food: [
    'All Cuisines',
    'Biryani & Mughlai',
    'North Indian Curries & Tandoor',
    'Pizza, Pastas & Italian',
    'Burgers, Rolls & Fast Food',
    'Chinese, Momos & Noodles',
    'South Indian Tiffins & Dosas',
    'Healthy Salads & Bowls',
    'Desserts, Cakes & Ice Creams',
    'Chai, Coffee & Shakes',
  ],
  ecommerce: [
    'All Electronics',
    'Smartphones & 5G Mobiles',
    'Laptops, MacBooks & Ultrabooks',
    'ANC Headphones & TWS Earbuds',
    'Smart 4K OLED & QLED TVs',
    'Tablets & iPads',
    'Smartwatches & Fitness Bands',
    'Gaming Consoles & PS5',
    'Home & Kitchen Appliances',
    'Cameras & Photography',
  ],
  loans: [
    'Personal Loan (Instant Approval)',
    'Home Loan (Lowest Interest from 8.35%)',
    'Car Loan (Up to 100% On-road)',
    'Education Loan (Study in USA/UK/India)',
    'Business MSME Loan (Collateral Free)',
    'Loan Against Property (LAP)',
  ],
  insurance: [
    '1 Crore Health Cover (Zero Deductible)',
    'Term Life Insurance (₹1.5 Cr Cover from ₹490/mo)',
    'Comprehensive Car Insurance (Zero Dep)',
    'Two-Wheeler Bike Insurance (Instant Policy)',
    'Family Health Floater (Cashless in 10,000+ Hospitals)',
    'International Travel Insurance (Worldwide)',
  ],
  movie: [
    'All Theatres & Multiplexes',
    'IMAX 3D Experience',
    '4DX Motion Seating',
    'PVR Director’s Cut / INOX INSIGNIA',
    'Dolby Atmos Surround',
    'Gold Class Luxury Recliner',
  ],
};

/**
 * Smart Search Helper to match queries against suggestions
 */
export function getFilteredSuggestions(
  query: string,
  type: 'city' | 'product' | 'grocery' | 'food' | 'date' | 'location' | 'all',
  limit: number = 10
): AutocompleteSuggestion[] {
  const cleanQ = (query || '').toLowerCase().trim();

  let pool: AutocompleteSuggestion[] = [];

  if (type === 'city') pool = AUTOCOMPLETE_CITIES;
  else if (type === 'product') pool = AUTOCOMPLETE_PRODUCTS;
  else if (type === 'grocery') pool = AUTOCOMPLETE_GROCERY;
  else if (type === 'food') pool = AUTOCOMPLETE_FOOD;
  else if (type === 'date') pool = AUTOCOMPLETE_DATES;
  else if (type === 'location') pool = AUTOCOMPLETE_CABS_LOCATIONS;
  else {
    pool = [
      ...AUTOCOMPLETE_CITIES,
      ...AUTOCOMPLETE_PRODUCTS,
      ...AUTOCOMPLETE_GROCERY,
      ...AUTOCOMPLETE_FOOD,
      ...AUTOCOMPLETE_DATES,
      ...AUTOCOMPLETE_CABS_LOCATIONS,
    ];
  }

  if (!cleanQ) {
    return pool.slice(0, limit);
  }

  // Exact startsWith first
  const startsWithMatches = pool.filter(
    (item) =>
      item.text.toLowerCase().startsWith(cleanQ) ||
      (item.subtext && item.subtext.toLowerCase().startsWith(cleanQ))
  );

  // Then matches containing query or airport code
  const includesMatches = pool.filter(
    (item) =>
      !startsWithMatches.includes(item) &&
      (item.text.toLowerCase().includes(cleanQ) ||
        (item.subtext && item.subtext.toLowerCase().includes(cleanQ)) ||
        (item.badge && item.badge.toLowerCase().includes(cleanQ)))
  );

  return [...startsWithMatches, ...includesMatches].slice(0, limit);
}
