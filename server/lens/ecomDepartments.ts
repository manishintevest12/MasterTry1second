/**
 * Department (category browse) intent for e-commerce (owner 29 Oct).
 *
 * Complaint: "tab pr click kr ke smart watch ya kuch v karo, pehle to results nahi aata,
 * phir jab aata hai tab sirf reliance ka bina image wala aa jata hai. results har seller
 * ka aana chahiye."
 *
 * Measured on that exact path (local pipeline, department labels):
 *   Laptops 0 rows, Audio & ANC 0, Smart TVs 0, Gaming & PS5 1 (Reliance only),
 *   Home Tech 0, Smart Home 0, Storage & SSDs 0, Power & Cables 0, Fashion & Tech 0.
 *
 * Two separate faults, both from treating a DEPARTMENT like a PRODUCT:
 *   1. the model-number gate read "Gaming & PS5" as "the model must contain 5", so it
 *      withheld 64 of 71 real rows and left one lonely card;
 *   2. the accessory gate + token overlap threw away the department's OWN products
 *      ("JBL Live Beam 3 ANC" dropped because of "case" later in the title) while
 *      ADMITTING look-alikes ("SanDisk ... Smartphone Compatible" passed a "smartphones"
 *      search), and a browse label never matches one product family, so whatever one
 *      fast source answered became the whole page.
 *
 * This module makes a department query mean what the user means when they tap the tab:
 * browse THIS product category. It resolves the label to a department, gives the
 * pipeline a market-friendly acquisition term, and judges a row by its category - the
 * product noun must lead the title, and a different device or a mere accessory of one
 * ("iPhone 15 Silicone Case", "Controller Stand for PS5", "SanDisk ... SSD") is not it.
 */

export interface EcomDepartment {
  id: string;
  /** User-facing department label (shortName in the frontend tabs). */
  label: string;
  /** What we actually ask the marketplaces (a term they answer well). */
  acquisition: string;
  /** Every string that must resolve to this department (labels, plurals, tab ids). */
  aliases: string[];
  /** Product nouns/brands that make a row part of this department. */
  product: RegExp;
  /**
   * Words that mean the row is an ACCESSORY of something, not the product itself.
   * Checked only in the head of the title (the product-type position) so bundles and
   * feature lists later in the title ("... with Silicone Strap", "... + Pen + Folio")
   * still count as the product.
   */
  accessoryHead?: RegExp;
  /**
   * Brand tokens that identify this category when the TITLE is a bare model code
   * ("HP 15s-fq5329TU", "boAt Wave Call 2"). Used only for CATALOGUE rows, which are a
   * vertical-wide dump and so need positive evidence; LIVE rows were fetched by the
   * department's own acquisition term and need none.
   */
  brands?: RegExp;
}

/** Head of a title = the first N words, i.e. where the product type is named. */
const HEAD_WORDS = 7;

const head = (title: string): string =>
  String(title || '')
    .toLowerCase()
    .replace(/[|/,+]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, HEAD_WORDS)
    .join(' ');

const norm = (s: string): string =>
  String(s || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const DEPARTMENTS: EcomDepartment[] = [
  {
    id: 'ecom-smartphones',
    label: 'Smartphones',
    acquisition: 'mobile phone',
    aliases: ['smartphones', 'smartphone', 'mobile phones', 'mobile phone', 'mobiles', 'mobile', 'phones', 'phone', 'ecom smartphones'],
    product: /\b(smart ?phones?|mobile ?phones?|mobiles?|phones?|iphone|galaxy [a-z]\d|galaxy m\d|redmi|realme|oppo|vivo|iqoo|oneplus|pixel \d|poco|motorola|moto g|nokia|infinix|tecno|lava|itel|honor|nothing phone|micromax|zenfone|gionee)\b/,
    accessoryHead: /\b(case|cases|cover|tempered|protector|guard|sleeve|skin|sticker|stand|holder|mount|pouch|bag|backpack|charger|cable|adapter|ssd|hdd|drive|card|pen|laptop|notebook|workstation|tablet|tab|watch|tv|television|earbud|earbuds|headphone|headphones|speaker|soundbar|camera|printer|router|monitor|keyboard|mouse|dock|strap|band)\b/,
    brands: /\b(apple|samsung|redmi|xiaomi|realme|oppo|vivo|iqoo|oneplus|motorola|moto|nokia|infinix|tecno|lava|itel|honor|poco|nothing|google|micromax|gionee)\b/,
  },
  {
    id: 'ecom-laptops',
    label: 'Laptops',
    acquisition: 'laptop',
    aliases: ['laptops', 'laptop', 'notebooks', 'macbooks', 'macbook', 'ecom laptops'],
    product: /\b(laptops?|notebooks?|macbooks?|chromebooks?|ultrabooks?|thinkpad|ideapad|pavilion|vivobook|zenbook|aspire|nitro|legion|inspiron|latitude|elitebook|surface laptop|galaxy ?book[0-9]*|rog strix|tuf gaming|loq)\b/,
    accessoryHead: /\b(bag|bags|backpack|sleeve|case|cover|skin|stand|holder|cooling|pad|ram|memory|ssd|hdd|charger|adapter|dock|keyboard|mouse|protector|sticker|table|desk)\b/,
    brands: /\b(hp|lenovo|dell|asus|acer|msi|apple|macbook|infinix|avita|vaio|lg|gram|samsung|galaxy book|microsoft|surface|primebook|thomson|realme)\b/,
  },
  {
    id: 'ecom-audio',
    label: 'Audio & ANC',
    acquisition: 'bluetooth headphones',
    aliases: ['audio and anc', 'audio anc', 'audio', 'headphones', 'headphone', 'earphones', 'earbuds', 'tws', 'anc earbuds', 'ecom audio'],
    product: /\b(headphones?|headsets?|earphones?|earbuds?|tws|buds|neckbands?|airpods|speakers?|soundbars?|anc|boat|jbl|bose|sennheiser|soundcore)\b/,
    accessoryHead: /\b(case|cases|cover|earpads?|cushion|foam|tips|sleeve|stand|holder|cable|adapter|splitter|transmitter|receiver|dock|mount|pouch)\b/,
    brands: /\b(boat|jbl|sony|bose|sennheiser|airpods|apple|noise|boult|oneplus|realme|oppo|samsung|soundcore|marshall|beats|nothing|xiaomi|redmi|mi|tcl|philips|zebronics|mivi|pibox)\b/,
  },
  {
    id: 'ecom-tvs',
    label: 'Smart TVs',
    acquisition: 'smart tv',
    aliases: ['smart tvs', 'smart tv', 'televisions', 'television', 'tv', 'tvs', 'ecom tvs'],
    product: /\b(tvs?|televisions?|smart tv|qled|oled|led tv|4k tv|uhd tv|soundbars?|mi tv|oneplus tv|realme tv|tcl|hisense|coocaa|acerpure|thomson|kodak tv|iffalcon)\b/,
    accessoryHead: /\b(stand|mount|bracket|remote|cover|case|splitter|cable|antenna|stabilizer|inverter|box|chromecast|stick)\b/,
    brands: /\b(samsung|lg|sony|mi|oneplus|realme|tcl|hisense|panasonic|haier|coocaa|thomson|kodak|acer|vise|iffalcon|vu|daiwa|marq|intex)\b/,
  },
  {
    id: 'ecom-tablets',
    label: 'Tablets',
    acquisition: 'tablet',
    aliases: ['tablets', 'tablet', 'ipads', 'ipad', 'ecom tablets'],
    product: /\b(tablets?|ipads?|tab|galaxy tab|lenovo tab|redmi pad|realme pad|honor pad|oneplus pad|xiaomi pad|ipad air|ipad pro|ipad mini)\b/,
    accessoryHead: /\b(case|cases|cover|folio|stand|sleeve|protector|guard|keyboard|stylus|pen|holder|mount|skin|pouch|bag)\b/,
    brands: /\b(samsung|lenovo|apple|ipad|xiaomi|redmi|realme|oppo|oneplus|honor|motorola|infinix|nokia|lava|micromax|iball|tab)\b/,
  },
  {
    id: 'ecom-wearables',
    label: 'Smartwatches',
    acquisition: 'smartwatch',
    aliases: ['smartwatches', 'smartwatch', 'smart watches', 'smart watch', 'fitness bands', 'fitness band', 'wearables', 'ecom wearables'],
    product: /\b(smart ?watch(es)?|fitness bands?|smart bands?|apple watch|galaxy watch|watch|watches|amazfit|garmin|fitbit|fastrack)\b/,
    accessoryHead: /\b(case|cases|cover|protector|guard|screen guard|charger|cable|dock|sleeve|bag)\b/,
    brands: /\b(noise|boat|fire ?boltt|fastrack|titan|amazfit|garmin|fitbit|apple|samsung|oneplus|realme|oppo|xiaomi|redmi|honor|huawei|fossil|timex|suunto|pebble)\b/,
  },
  {
    id: 'ecom-gaming',
    label: 'Gaming & PS5',
    acquisition: 'gaming console',
    aliases: ['gaming and ps5', 'gaming ps5', 'gaming', 'ps5', 'playstation', 'consoles', 'gaming consoles', 'ecom gaming'],
    product: /\b(ps5|ps4|playstation|xbox|nintendo|switch|consoles?|controllers?|gamepads?|gaming (headset|keyboard|mouse|chair|monitor)|steam deck|rog ally|dual ?sense)\b/,
    accessoryHead: /\b(stand|stands|holder|case|cover|skin|grip|thumbs?|analog|joystick|cap|caps|charger|cable|dock|mount|faceplate)\b/,
    brands: /\b(sony|playstation|ps5|ps4|xbox|microsoft|nintendo|asus|rog|lenovo|legion|hp|omen|acer|nitro|predator|msi|razer|steam|valve|logitech|redragon|cosmic byte|ant esports|nacon|8bitdo)\b/,
  },
  {
    id: 'ecom-cameras',
    label: 'Cameras',
    acquisition: 'digital camera',
    aliases: ['cameras', 'camera', 'dslr', 'mirrorless', 'ecom cameras'],
    product: /\b(cameras?|dslrs?|mirrorless|gopro|action cam\w*|instant cam\w*|canon|nikon|sony alpha|fujifilm|lumix|webcam)\b/,
    accessoryHead: /\b(bag|case|cover|tripod|stand|monopod|strap|protector|card|battery|charger|lens cap|filter|holder|mount)\b/,
    brands: /\b(canon|nikon|sony|fujifilm|panasonic|lumix|olympus|leica|gopro|dji|insta360|kodak|polaroid|sigma|tamron)\b/,
  },
  {
    id: 'ecom-home-appliances',
    label: 'Home Tech',
    acquisition: 'refrigerator',
    aliases: ['home tech', 'home appliances', 'appliances', 'ecom home appliances'],
    product: /\b(refrigerators?|fridge|washing machines?|microwaves?|air conditioners?|acs?|split ac|window ac|mixers?|grinders?|vacuum cleaners?|irons?|fans?|purifiers?|dishwashers?|ovens?|kettles?|induction|water heaters?|geysers?|chimney|air fryers?|espresso)\b/,
    accessoryHead: /\b(cover|case|stand|mount|cable|pipe|filter|spare|remote|board|stabilizer)\b/,
    brands: /\b(samsung|lg|whirlpool|haier|godrej|bosch|siemens|ifb|panasonic|voltas|daikin|hitachi|carrier|blue ?star|midea|symphony|bajaj|havells|philips|preethi|butterfly|prestige|hawkins|pigeon|dyson|eureka|forbes|kent|aquaguard|livpure|usha|orient|atomberg|crompton|v-guard|morphy|agaro)\b/,
  },
  {
    id: 'ecom-smarthome',
    label: 'Smart Home',
    acquisition: 'smart home device',
    aliases: ['smart home', 'home security', 'ecom smart home'],
    product: /\b(smart (bulbs?|plugs?|cameras?|locks?|lights?|doorbells?|switch|switches|sensors?|bands?)|cctv|security cameras?|alexa|echo dot|google nest|fire tv stick|video doorbells?|sensors?|smart home)\b/,
    accessoryHead: /\b(case|cover|stand|mount|cable|adapter|holder)\b/,
    brands: /\b(mi|xiaomi|redmi|realme|tp-?link|wipro|philips|samsung|lg|google|nest|amazon|alexa|echo|ring|arlo|yale|godrej|havells|bosch|hikvision|cpplus|imou|tapo|ezviz|aqara|sonoff)\b/,
  },
  {
    id: 'ecom-storage',
    label: 'Storage & SSDs',
    acquisition: 'external ssd',
    aliases: ['storage and ssds', 'storage ssds', 'storage', 'ssds', 'ssd', 'hard drives', 'hard drive', 'ecom storage'],
    product: /\b(ssds?|hdd|hard (drives?|disks?)|pen ?drives?|flash drives?|memory cards?|micro ?sd|external drives?|portable ssd|nas)\b/,
    accessoryHead: /\b(enclosure|case|cover|adapter|cable|dock|stand|pouch|bag)\b/,
    brands: /\b(sandisk|samsung|seagate|western digital|wd|toshiba|crucial|kingston|lexar|hp|lenovo|transcend|adata|pny|verbatim|sony|hikvision)\b/,
  },
  {
    id: 'ecom-cables-chargers',
    label: 'Power & Cables',
    acquisition: 'power bank',
    aliases: ['power and cables', 'power cables', 'power bank', 'power banks', 'chargers', 'cables', 'ecom cables chargers'],
    product: /\b(power ?banks?|chargers?|cables?|adapters?|fast chargers?|type ?c|usb ?c|lightning cable|wireless chargers?|car chargers?|charging bricks?)\b/,
    accessoryHead: /\b(case|cover|stand|holder|pouch|bag)\b/,
    brands: /\b(anker|portronics|boat|mi|xiaomi|samsung|realme|oppo|vivo|oneplus|ambrane|syska|havells|belkin|spigen|cmf|nothing|apple|baseus|ugreen|zebronics|mivi|toreto)\b/,
  },
  {
    id: 'ecom-monitors',
    label: 'Monitors',
    acquisition: 'monitor',
    aliases: ['monitors', 'monitor', 'displays', 'ecom monitors'],
    product: /\b(monitors?|led monitor|gaming monitor|curved monitor|display screen)\b/,
    accessoryHead: /\b(stand|arm|mount|bracket|cover|case|cleaner|cable|adapter|dock)\b/,
    brands: /\b(samsung|lg|dell|hp|acer|asus|benq|msi|aoc|viewsonic|lenovo|philips|gigabyte|zebronics|intex|acerpure|boat|mi|xiaomi|realme|frontech)\b/,
  },
  {
    id: 'ecom-fashion',
    label: 'Fashion & Tech',
    acquisition: 'smart glasses',
    aliases: ['fashion and tech', 'fashion tech', 'fashion', 'smart glasses', 'eyewear', 'ecom fashion'],
    product: /\b(smart glasses|eyewear|sunglasses|ray ?ban meta|watch straps?|watch bands?|apple watch band|goggles)\b/,
    accessoryHead: /\b(case|cover|cleaner)\b/,
    brands: /\b(ray ?-?ban|meta|oakley|fastrack|titan|noise|boat|apple|samsung|garmin|fossil|guess|mi|xiaomi|realme)\b/,
  },
];

const ALIAS_INDEX = new Map<string, EcomDepartment>();
for (const d of DEPARTMENTS) {
  for (const a of [d.id, d.label, ...d.aliases]) {
    const k = norm(a);
    if (k && !ALIAS_INDEX.has(k)) ALIAS_INDEX.set(k, d);
  }
}

/** Resolve a typed query / tapped department label to a department, or null. */
export function resolveEcomDepartment(query: string): EcomDepartment | null {
  const key = norm(query);
  if (!key) return null;
  return ALIAS_INDEX.get(key) ?? null;
}

export function getEcomDepartment(id: string | null | undefined): EcomDepartment | null {
  if (!id) return null;
  return DEPARTMENTS.find((d) => d.id === id) ?? null;
}

export function listEcomDepartments(): EcomDepartment[] {
  return DEPARTMENTS;
}

/** Acquisition terms the warmer keeps hot so a tab tap is never cold. */
export function departmentSeedQueries(): string[] {
  return [...new Set(DEPARTMENTS.map((d) => d.acquisition))];
}

/**
 * Is this row part of the department? The product noun must be present, and the HEAD of
 * the title (product-type position) must not name an accessory or a different device.
 * A department that SELLS that word keeps it ("Power & Cables" sells cables, "Storage &
 * SSDs" sells SSDs). Nothing is rewritten or re-priced; the row is only kept or withheld.
 */
/** Every other department's product nouns, as one test — "is the head about something else?" */
const OTHER = new Map<string, RegExp>();
function otherCategoryRe(dept: EcomDepartment): RegExp {
  const cached = OTHER.get(dept.id);
  if (cached) return cached;
  const alts: string[] = [];
  for (const d of DEPARTMENTS) {
    if (d.id === dept.id || !d.product) continue;
    const src = d.product.source.replace(/^\^?/, '').replace(/\$$/, '');
    alts.push(`(?:${src})`);
  }
  const re = new RegExp(alts.join('|'), 'i');
  OTHER.set(dept.id, re);
  return re;
}

/** Accessories of ANY device: never the product, unless this department sells them. */
const GLOBAL_ACCESSORY = /\b(tempered|screen guard|protectors?|cases?|covers?|sleeves?|skins?|stickers?|stands?|holders?|mounts?|pouch(es)?|bags?|backpacks?|enclosures?|docks?)\b/;

export function rowMatchesDepartment(title: string, dept: EcomDepartment): boolean {
  const t = String(title || '').toLowerCase();
  if (!t.trim()) return false;
  const headText = head(t);
  const ownInHead = dept.product.test(headText);

  // 1. The product-type position names ANOTHER category's product ("realme Watch" is not a
  //    TV, "Motorola G06" is not a camera, "boAt Airdopes" is not fashion eyewear).
  if (!ownInHead && otherCategoryRe(dept).test(headText)) return false;

  // 2. The product-type position names an accessory ("Tempered Glass", "iPhone 16 Case",
  //    "Controller Stand"). Accessory first = it IS the product here ("Cable organizer",
  //    "Power Bank", "SSD enclosure" for the storage tab is still an enclosure → withheld).
  const accWordIsProduct = (word: string) => {
    try { return new RegExp(`\\b${word}\\b`, 'i').test(dept.product.source) || dept.product.test(word); } catch { return false; }
  };
  const acc = dept.accessoryHead ? dept.accessoryHead.exec(headText) : null;
  if (acc && !accWordIsProduct(String(acc[0] || ''))) return false;
  const gacc = GLOBAL_ACCESSORY.exec(headText);
  if (gacc && !accWordIsProduct(String(gacc[0] || ''))) return false;

  // 3. Bare model codes ("HP 15s-fq5329TU") carry no category noun; the caller decides
  //    whether it has brand evidence (catalogue) or was fetched by the term (live).
  return true;
}

/**
 * Positive category evidence for CATALOGUE rows (a vertical-wide dump that must never be
 * shown whole): the title names the product family, or the title/brand belongs to one of
 * the family's brands ("HP 15s-fq5329TU" is a laptop). Live rows skip this check - they
 * were fetched by the department's own acquisition term.
 */
const GENERIC_BRANDS = /\b(samsung|lg|apple|sony|mi|xiaomi|redmi|realme|boat|oneplus|oppo|vivo|philips|hp|lenovo|dell|acer|asus|msi|nothing|google|amazon|motorola|nokia|infinix|tecno|lava|itel|honor|poco)\b/;

export function rowHasCategoryEvidence(title: string, brand: string, dept: EcomDepartment): boolean {
  const t = String(title || '').toLowerCase();
  if (!t.trim()) return false;
  // 1. The title names the product family: always enough.
  if (dept.product.test(t)) return true;
  // 2. A bare model code ("HP 15s-fq5329TU", "EVM 1TB SSD"): brand evidence needs a model
  //    number, because a brand alone says nothing - Samsung sells phones, fridges and TVs
  //    and "Samsung Galaxy Book4" is a laptop, not a Home Tech appliance.
  const hasModelCode = /\d/.test(t);
  const brandHit = Boolean(dept.brands && dept.brands.test(t.replace(/-/g, ' ')));
  const rowBrand = String(brand || '').toLowerCase().replace(/-/g, ' ');
  const rowBrandHit = Boolean(rowBrand && dept.brands && dept.brands.test(rowBrand));
  if (!(brandHit || rowBrandHit)) return false;
  if (!hasModelCode) return false;
  // 3. A generic multi-category brand only counts together with a model code AND only when
  //    the head does not name another category (checked by the caller).
  return true;
}

/** Filter one result set for a department browse. */
export function filterRowsForDepartment<T extends { title?: string }>(rows: T[], dept: EcomDepartment): T[] {
  return rows.filter((r) => rowMatchesDepartment(String(r?.title || ''), dept));
}
