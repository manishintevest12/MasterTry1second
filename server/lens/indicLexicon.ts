/**
 * Ask Try1Second — INDIC LANGUAGE LEXICON (owner 10 Nov: "ab aise hi pure india ke language mai isko kro
 * jiss se ki v language ka aadmi iss se baat kr ke results le kr aa jaayega").
 *
 * Why a lexicon and not a translator: the assistant only needs to understand WHAT to compare, not to write
 * prose. A deterministic word map keeps it free, offline, instant, and impossible to hallucinate a price.
 * Each language maps the words a real question is built from - the vertical, the product, price/cheapest,
 * the date, the verb, and the city - onto the same Latin vocabulary the rest of the engine already speaks.
 *
 * Coverage: Bengali, Gujarati, Punjabi, Tamil, Telugu, Kannada, Malayalam, Odia, Urdu (+ romanised forms of
 * each, which is how most people actually type: "chennai la hotel venum", "kolkata te koto").
 * Devanagari (Hindi/Marathi) lives in questionNormalizer.ts, which this module feeds.
 */

export type IndicScript = 'bengali' | 'gujarati' | 'gurmukhi' | 'tamil' | 'telugu' | 'kannada' | 'malayalam' | 'odia' | 'urdu';

const SCRIPT_RANGES: { script: IndicScript; re: RegExp }[] = [
  { script: 'bengali', re: /[\u0980-\u09FF]/ },
  { script: 'gurmukhi', re: /[\u0A00-\u0A7F]/ },
  { script: 'gujarati', re: /[\u0A80-\u0AFF]/ },
  { script: 'odia', re: /[\u0B00-\u0B7F]/ },
  { script: 'tamil', re: /[\u0B80-\u0BFF]/ },
  { script: 'telugu', re: /[\u0C00-\u0C7F]/ },
  { script: 'kannada', re: /[\u0C80-\u0CFF]/ },
  { script: 'malayalam', re: /[\u0D00-\u0D7F]/ },
  { script: 'urdu', re: /[\u0600-\u06FF]/ },
];

/** Which Indic script a string uses (first one found), or null for Latin/Devanagari-free text. */
export function detectIndicScript(text: string): IndicScript | null {
  for (const s of SCRIPT_RANGES) if (s.re.test(text)) return s.script;
  return null;
}

type Dict = Record<string, string>;

/** Shared Latin targets: every language maps onto these exact words. */
const HOTEL: Dict = {
  'হোটেল': 'hotel', 'হোটেলের': 'hotel', 'હોટેલ': 'hotel', 'ਹੋਟਲ': 'hotel', 'ஹோட்டல்': 'hotel',
  'హోటల్': 'hotel', 'ಹೋಟೆಲ್': 'hotel', 'ഹോട്ടൽ': 'hotel', 'ହୋଟେଲ': 'hotel', 'ہوٹل': 'hotel',
};

const BENGALI: Dict = {
  ...HOTEL,
  'ফ্লাইট': 'flight', 'উড়ান': 'flight', 'বাস': 'bus', 'ট্রেন': 'train', 'ক্যাব': 'cab', 'ট্যাক্সি': 'taxi',
  'সিনেমা': 'movie', 'ছবি': 'movie', 'টিকিট': 'ticket', 'মুভি': 'movie',
  'দাম': 'price', 'দামে': 'price', 'কত': 'kitna', 'কতটা': 'kitna', 'সস্তা': 'sasta', 'সস্তায়': 'sasta',
  'কোথায়': 'kaha', 'আজ': 'aaj', 'কাল': 'kal', 'পরশু': 'parso', 'আগামীকাল': 'kal',
  'দুধ': 'milk', 'আটা': 'flour', 'চাল': 'rice', 'ডাল': 'dal', 'বিরিয়ানি': 'biryani',
  'মুরগি': 'chicken', 'পিজা': 'pizza', 'কসমেটিক': 'cosmetics', 'প্রসাধনী': 'cosmetics',
  'মোবাইল': 'mobile', 'ল্যাপটপ': 'laptop', 'জুতো': 'shoes', 'শার্ট': 'shirt',
  'ঋণ': 'loan', 'বিমা': 'insurance', 'ক্রেডিট': 'credit', 'কার্ড': 'card', 'অ্যাকাউন্ট': 'account',
  'মধ্যে': 'me', 'থেকে': 'se', 'পর্যন্ত': 'tak', 'চাই': 'chahiye', 'বলুন': 'batao', 'দেখান': 'dikhao',
  'কলকাতা': 'Kolkata', 'কোলকাতা': 'Kolkata', 'দিল্লি': 'Delhi', 'মুম্বই': 'Mumbai', 'মুম্বাই': 'Mumbai',
  'চেন্নাই': 'Chennai', 'বেঙ্গালুরু': 'Bangalore', 'হায়দরাবাদ': 'Hyderabad', 'পুনে': 'Pune',
  'জয়পুর': 'Jaipur', 'লখনউ': 'Lucknow', 'পাটনা': 'Patna', 'গুয়াহাটি': 'Guwahati', 'ভুবনেশ্বর': 'Bhubaneswar',
  'সিলিগুড়ি': 'Siliguri', 'দার্জিলিং': 'Darjeeling', 'রাঁচি': 'Ranchi', 'কটক': 'Cuttack', 'গোয়া': 'Goa',
};

const GUJARATI: Dict = {
  ...HOTEL,
  'ફ્લાઇટ': 'flight', 'બસ': 'bus', 'કેબ': 'cab', 'ટેક્સી': 'taxi', 'સિનેમા': 'movie', 'મૂવી': 'movie',
  'ટિકિટ': 'ticket', 'ભાવ': 'price', 'કિંમત': 'price', 'કેટલું': 'kitna', 'કેટલા': 'kitna',
  'સસ્તું': 'sasta', 'સસ્તા': 'sasta', 'ક્યાં': 'kaha', 'આજે': 'aaj', 'કાલે': 'kal', 'પરમદિવસે': 'parso',
  'દૂધ': 'milk', 'લોટ': 'flour', 'ચોખા': 'rice', 'દાળ': 'dal', 'બિરયાની': 'biryani', 'ચિકન': 'chicken',
  'કોસ્મેટિક': 'cosmetics', 'કોસ્મેટિક્સ': 'cosmetics', 'મેકઅપ': 'makeup', 'સૌંદર્ય': 'beauty', 'મોબાઇલ': 'mobile', 'લેપટોપ': 'laptop',
  'લોન': 'loan', 'વીમો': 'insurance', 'ક્રેડિટ': 'credit', 'કાર્ડ': 'card', 'ખાતું': 'account',
  'માં': 'me', 'થી': 'se', 'સુધી': 'tak', 'જોઈએ': 'chahiye', 'કહો': 'batao', 'બતાવો': 'dikhao',
  'અમદાવાદ': 'Ahmedabad', 'સુરત': 'Surat', 'વડોદરા': 'Vadodara', 'રાજકોટ': 'Rajkot', 'ભાવનગર': 'Bhavnagar',
  'ગાંધીનગર': 'Gandhinagar', 'જામનગર': 'Jamnagar', 'મુંબઈ': 'Mumbai', 'દિલ્હી': 'Delhi', 'ગોવા': 'Goa',
};

const GURMUKHI: Dict = {
  ...HOTEL,
  'ਫਲਾਈਟ': 'flight', 'ਬੱਸ': 'bus', 'ਕੈਬ': 'cab', 'ਟੈਕਸੀ': 'taxi', 'ਫਿਲਮ': 'movie', 'ਟਿਕਟ': 'ticket',
  'ਕੀਮਤ': 'price', 'ਕਿੰਨਾ': 'kitna', 'ਕਿੰਨੇ': 'kitna', 'ਸਸਤਾ': 'sasta', 'ਸਸਤੀ': 'sasta', 'ਕਿੱਥੇ': 'kaha',
  'ਅੱਜ': 'aaj', 'ਕੱਲ੍ਹ': 'kal', 'ਪਰਸੋਂ': 'parso', 'ਦੁੱਧ': 'milk', 'ਆਟਾ': 'flour', 'ਚਾਵਲ': 'rice',
  'ਦਾਲ': 'dal', 'ਬਿਰਯਾਨੀ': 'biryani', 'ਚਿਕਨ': 'chicken', 'ਕਾਸਮੈਟਿਕ': 'cosmetics', 'ਮੋਬਾਈਲ': 'mobile',
  'ਲੈਪਟਾਪ': 'laptop', 'ਕਰਜ਼ਾ': 'loan', 'ਬੀਮਾ': 'insurance', 'ਕ੍ਰੈਡਿਟ': 'credit', 'ਕਾਰਡ': 'card',
  'ਖਾਤਾ': 'account', 'ਵਿੱਚ': 'me', 'ਤੋਂ': 'se', 'ਤੱਕ': 'tak', 'ਚਾਹੀਦਾ': 'chahiye', 'ਦੱਸੋ': 'batao',
  'ਦਿਖਾਓ': 'dikhao', 'ਅੰਮ੍ਰਿਤਸਰ': 'Amritsar', 'ਲੁਧਿਆਣਾ': 'Ludhiana', 'ਜਲੰਧਰ': 'Jalandhar',
  'ਚੰਡੀਗੜ੍ਹ': 'Chandigarh', 'ਪਟਿਆਲਾ': 'Patiala', 'ਦਿੱਲੀ': 'Delhi', 'ਮੁਹਾਲੀ': 'Mohali', 'ਬਠਿੰਡਾ': 'Bathinda',
};

const TAMIL: Dict = {
  ...HOTEL,
  'ஹோட்டலில்': 'hotel', 'விமானம்': 'flight', 'பஸ்': 'bus', 'பேருந்து': 'bus', 'கேப்': 'cab', 'டாக்ஸி': 'taxi',
  'சினிமா': 'movie', 'படம்': 'movie', 'டிக்கெட்': 'ticket', 'விலை': 'price', 'எவ்வளவு': 'kitna',
  'மலிவான': 'sasta', 'மலிவு': 'sasta', 'எங்கே': 'kaha', 'இன்று': 'aaj', 'நாளை': 'kal', 'நாளைக்கு': 'kal',
  'பால்': 'milk', 'மாவு': 'flour', 'அரிசி': 'rice', 'பருப்பு': 'dal', 'பிரியாணி': 'biryani', 'கோழி': 'chicken',
  'அழகு': 'beauty', 'காஸ்மெட்டிக்': 'cosmetics', 'காஸ்மெடிக்': 'cosmetics',
  'அழகுசாதனம்': 'cosmetics', 'சீப்': 'sasta', 'குறைந்த': 'sasta', 'இந்தோர்': 'Indore', 'இந்தூர்': 'Indore', 'மொபைல்': 'mobile', 'லேப்டாப்': 'laptop',
  'கடன்': 'loan', 'காப்பீடு': 'insurance', 'கிரெடிட்': 'credit', 'கார்டு': 'card', 'கணக்கு': 'account',
  'இருந்து': 'se', 'வரை': 'tak', 'வேண்டும்': 'chahiye', 'வேணும்': 'chahiye',
  'சொல்லுங்க': 'batao', 'காட்டு': 'dikhao', 'சென்னை': 'Chennai', 'கோயம்புத்தூர்': 'Coimbatore',
  'மதுரை': 'Madurai', 'திருச்சி': 'Trichy', 'சேலம்': 'Salem', 'திருநெல்வேலி': 'Tirunelveli', 'வேலூர்': 'Vellore',
  'பெங்களூரு': 'Bangalore', 'ஹைதராபாத்': 'Hyderabad', 'மும்பை': 'Mumbai', 'டெல்லி': 'Delhi',
  'போபால்': 'Bhopal', 'கோயா': 'Goa', 'புனே': 'Pune', 'ஜெய்ப்பூர்': 'Jaipur',
};

const TELUGU: Dict = {
  ...HOTEL,
  'హోటల్లో': 'hotel', 'విమానం': 'flight', 'బస్సు': 'bus', 'క్యాబ్': 'cab', 'టాక్సీ': 'taxi',
  'సినిమా': 'movie', 'టికెట్': 'ticket', 'ధర': 'price', 'ఎంత': 'kitna', 'చవకైన': 'sasta',
  'ఎక్కడ': 'kaha', 'ఈరోజు': 'aaj', 'రేపు': 'kal', 'ఎర్రజు': 'parso', 'పాలు': 'milk', 'పిండి': 'flour',
  'బియ్యం': 'rice', 'పప్పు': 'dal', 'బిర్యానీ': 'biryani', 'చికెన్': 'chicken', 'కాస్మెటిక్': 'cosmetics',
  'మొబైల్': 'mobile', 'ల్యాప్టాప్': 'laptop', 'కాస్మెటిక్స్': 'cosmetics', 'అందం': 'beauty', 'చీప్': 'sasta', 'రుణం': 'loan', 'బీమా': 'insurance', 'క్రెడిట్': 'credit',
  'కార్డు': 'card', 'ఖాతా': 'account', 'లో': 'me', 'నుండి': 'se', 'వరకు': 'tak', 'కావాలి': 'chahiye',
  'చెప్పండి': 'batao', 'చూపించు': 'dikhao', 'హైదరాబాద్': 'Hyderabad', 'విజయవాడ': 'Vijayawada',
  'విశాఖపట్నం': 'Visakhapatnam', 'గుంటూరు': 'Guntur', 'వరంగల్': 'Warangal', 'తిరుపతి': 'Tirupati',
  'బెంగళూరు': 'Bangalore', 'చెన్నై': 'Chennai', 'ముంబై': 'Mumbai', 'ఢిల్లీ': 'Delhi',
  'ఇండోర్': 'Indore', 'భోపాల్': 'Bhopal', 'గోవా': 'Goa', 'పుణె': 'Pune', 'జైపూర్': 'Jaipur',
};

const KANNADA: Dict = {
  ...HOTEL,
  'ಹೋಟೆಲ್ನಲ್ಲಿ': 'hotel', 'ವಿಮಾನ': 'flight', 'ಬಸ್': 'bus', 'ಕ್ಯಾಬ್': 'cab', 'ಟ್ಯಾಕ್ಸಿ': 'taxi',
  'ಸಿನಿಮಾ': 'movie', 'ಟಿಕೆಟ್': 'ticket', 'ಬೆಲೆ': 'price', 'ದರ': 'price', 'ಎಷ್ಟು': 'kitna',
  'ಅಗ್ಗದ': 'sasta', 'ಎಲ್ಲಿ': 'kaha', 'ಇಂದು': 'aaj', 'ನಾಳೆ': 'kal', 'ಹಾಲು': 'milk', 'ಹಿಟ್ಟು': 'flour',
  'ಅಕ್ಕಿ': 'rice', 'ಬೇಳೆ': 'dal', 'ಬಿರಿಯಾನಿ': 'biryani', 'ಚಿಕನ್': 'chicken', 'ಕಾಸ್ಮೆಟಿಕ್': 'cosmetics',
  'ಮೊಬೈಲ್': 'mobile', 'ಲ್ಯಾಪ್ಟಾಪ್': 'laptop', 'ಕಾಸ್ಮೆಟಿಕ್ಸ್': 'cosmetics', 'ಅಂದ': 'beauty', 'ಅಗ್ಗ': 'sasta', 'ಸಾಲ': 'loan', 'ವಿಮೆ': 'insurance', 'ಕ್ರೆಡಿಟ್': 'credit',
  'ಕಾರ್ಡ್': 'card', 'ಖಾತೆ': 'account', 'ನಲ್ಲಿ': 'me', 'ಇಂದ': 'se', 'ವರೆಗೆ': 'tak', 'ಬೇಕು': 'chahiye',
  'ಹೇಳಿ': 'batao', 'ತೋರಿಸಿ': 'dikhao', 'ಬೆಂಗಳೂರು': 'Bangalore', 'ಮೈಸೂರು': 'Mysore', 'ಮಂಗಳೂರು': 'Mangalore',
  'ಹುಬ್ಬಳ್ಳಿ': 'Hubli', 'ಬೆಳಗಾವಿ': 'Belgaum', 'ಚೆನ್ನೈ': 'Chennai', 'ಹೈದರಾಬಾದ್': 'Hyderabad',
  'ಇಂದೋರ್': 'Indore', 'ಭೋಪಾಲ್': 'Bhopal', 'ಗೋವಾ': 'Goa', 'ಪುಣೆ': 'Pune', 'ಜೈಪುರ': 'Jaipur',
};

const MALAYALAM: Dict = {
  ...HOTEL,
  'ഹോട്ടലിൽ': 'hotel', 'വിമാനം': 'flight', 'ബസ്': 'bus', 'ക്യാബ്': 'cab', 'ടാക്സി': 'taxi',
  'സിനിമ': 'movie', 'ടിക്കറ്റ്': 'ticket', 'വില': 'price', 'എത്ര': 'kitna', 'വിലകുറഞ്ഞ': 'sasta',
  'എവിടെ': 'kaha', 'ഇന്ന്': 'aaj', 'നാളെ': 'kal', 'പാൽ': 'milk', 'മാവ്': 'flour', 'അരി': 'rice',
  'പരിപ്പ്': 'dal', 'ബിരിയാണി': 'biryani', 'ചിക്കൻ': 'chicken', 'കോസ്മെറ്റിക്': 'cosmetics',
  'മൊബൈൽ': 'mobile', 'ലാപ്ടോപ്പ്': 'laptop', 'കോസ്മെറ്റിക്സ്': 'cosmetics', 'സൗന്ദര്യം': 'beauty', 'വിലകുറവ': 'sasta', 'വായ്പ': 'loan', 'ഇൻഷുറൻസ്': 'insurance',
  'ക്രെഡിറ്റ്': 'credit', 'കാർഡ്': 'card', 'അക്കൗണ്ട്': 'account', 'ഇൽ': 'me', 'നിന്ന്': 'se',
  'വരെ': 'tak', 'വേണം': 'chahiye', 'പറയൂ': 'batao', 'കാണിക്കൂ': 'dikhao', 'കൊച്ചി': 'Kochi',
  'തിരുവനന്തപുരം': 'Thiruvananthapuram', 'കോഴിക്കോട്': 'Kozhikode', 'തൃശൂർ': 'Thrissur',
  'കോട്ടയം': 'Kottayam', 'ആലപ്പുഴ': 'Alappuzha', 'ചെന്നൈ': 'Chennai', 'ബെംഗളൂരു': 'Bangalore',
  'ഇൻഡോർ': 'Indore', 'ഭോപ്പാൽ': 'Bhopal', 'ഗോവ': 'Goa', 'പുനെ': 'Pune', 'ജയ്പൂർ': 'Jaipur',
};

const ODIA: Dict = {
  ...HOTEL,
  'ଫ୍ଲାଇଟ': 'flight', 'ବସ': 'bus', 'କ୍ୟାବ': 'cab', 'ଟ୍ୟାକ୍ସି': 'taxi', 'ସିନେମା': 'movie',
  'ଟିକେଟ': 'ticket', 'ଦାମ': 'price', 'କେତେ': 'kitna', 'ଶସ୍ତା': 'sasta', 'କେଉଁଠି': 'kaha',
  'ଆଜି': 'aaj', 'କାଲି': 'kal', 'ପରଦିନ': 'parso', 'ଦୁଧ': 'milk', 'ଅଟା': 'flour', 'ଚାଉଳ': 'rice',
  'ଡାଲି': 'dal', 'ବିରିୟାନି': 'biryani', 'ଚିକେନ': 'chicken', 'କସମେଟିକ': 'cosmetics',
  'ମୋବାଇଲ': 'mobile', 'ଲାପଟପ': 'laptop', 'ଋଣ': 'loan', 'ବୀମା': 'insurance', 'କ୍ରେଡିଟ': 'credit',
  'କାର୍ଡ': 'card', 'ଖାତା': 'account', 'ରେ': 'me', 'ରୁ': 'se', 'ପର୍ଯ୍ୟନ୍ତ': 'tak', 'ଦରକାର': 'chahiye',
  'କୁହ': 'batao', 'ଦେଖାଅ': 'dikhao', 'ଭୁବନେଶ୍ୱର': 'Bhubaneswar', 'କଟକ': 'Cuttack', 'ରାଉରକେଲା': 'Rourkela',
  'ପୁରୀ': 'Puri', 'ବାଲେଶ୍ୱର': 'Balasore', 'ସମ୍ବଲପୁର': 'Sambalpur',
};

const URDU: Dict = {
  ...HOTEL,
  'فلائٹ': 'flight', 'طیارہ': 'flight', 'بس': 'bus', 'ٹیکسی': 'taxi', 'فلم': 'movie', 'سنیما': 'cinema',
  'ٹکٹ': 'ticket', 'قیمت': 'price', 'ریٹ': 'rate', 'کتنا': 'kitna', 'کتنی': 'kitna', 'سستا': 'sasta',
  'کہاں': 'kaha', 'آج': 'aaj', 'کل': 'kal', 'پرسوں': 'parso', 'دودھ': 'milk', 'آٹا': 'flour', 'چاول': 'rice',
  'دال': 'dal', 'بریانی': 'biryani', 'چکن': 'chicken', 'کاسمیٹک': 'cosmetics', 'میک اپ': 'makeup',
  'موبائل': 'mobile', 'لیپ ٹاپ': 'laptop', 'قرض': 'loan', 'بیمہ': 'insurance', 'کریڈٹ': 'credit',
  'کارڈ': 'card', 'اکاؤنٹ': 'account', 'میں': 'me', 'سے': 'se', 'تک': 'tak', 'چاہیے': 'chahiye',
  'بتائیں': 'batao', 'دکھائیں': 'dikhao', 'دہلی': 'Delhi', 'ممبئی': 'Mumbai', 'حیدرآباد': 'Hyderabad',
  'لکھنؤ': 'Lucknow', 'جے پور': 'Jaipur', 'بھوپال': 'Bhopal', 'پٹنہ': 'Patna', 'کانپور': 'Kanpur',
};

const DICTS: Record<IndicScript, Dict> = {
  bengali: BENGALI, gujarati: GUJARATI, gurmukhi: GURMUKHI, tamil: TAMIL,
  telugu: TELUGU, kannada: KANNADA, malayalam: MALAYALAM, odia: ODIA, urdu: URDU,
};

/**
 * Romanised function words, the way people type a local language in Latin letters
 * ("chennai la hotel venum", "kolkata te koto", "indore madhe hotel kiti").
 */
const ROMANISED: Dict = {
  venum: 'chahiye', vendum: 'chahiye', venam: 'chahiye', beku: 'chahiye', kavali: 'chahiye', kavale: 'chahiye',
  lagbe: 'chahiye', dorkar: 'chahiye', darkar: 'chahiye', chahije: 'chahiye', chahida: 'chahiye', pahije: 'chahiye',
  evlo: 'kitna', evvalavu: 'kitna', ethra: 'kitna', estu: 'kitna', entha: 'kitna', koto: 'kitna', kemon: 'kitna',
  ketlu: 'kitna', kiti: 'kitna', kinnu: 'kitna', kete: 'kitna', kati: 'kitna', enni: 'kitna', enti: 'kitna',
  saste: 'sasta', kom: 'sasta', kammi: 'sasta', agga: 'sasta', olavala: 'sasta', sosta: 'sasta', sastha: 'sasta',
  la: 'me', le: 'me', te: 'me', 'e': 'me', madhe: 'me', alli: 'me', lo: 'me', me: 'me', il: 'me',
  irundhu: 'se', nundi: 'se', theke: 'se', thi: 'se', inda: 'se', pasun: 'se', se: 'se',
  epdi: 'kaise', ekkada: 'kaha', kothay: 'kaha', elli: 'kaha', kuthe: 'kaha', kahan: 'kaha',
};

/** Translate a native-script question into the Latin vocabulary the engine understands. */
export function translateIndic(text: string): { text: string; changed: boolean; script: IndicScript | null } {
  const script = detectIndicScript(text);
  let changed = false;
  let out = String(text || '');
  if (script) {
    const dict = DICTS[script];
    // Longest keys first so a phrase beats its own substring.
    const keys = Object.keys(dict).sort((a, b) => b.length - a.length);
    for (const k of keys) {
      if (out.includes(k)) { out = out.split(k).join(dict[k]); changed = true; }
    }
  }
  // Romanised helper words, whole-word only, so "te" never eats "test".
  out = out.replace(/\b[a-z]{2,10}\b/gi, (w) => {
    const hit = ROMANISED[w.toLowerCase()];
    if (!hit) return w;
    changed = true;
    return hit;
  });
  return { text: out, changed, script };
}
