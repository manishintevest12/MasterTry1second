# Hotel Normalization & Matching Specification

This document defines the exact specification, algorithm steps, and test vectors for normalizing hotel property names and matching identical hotel listings across different travel providers (Cleartrip, Airbnb, Booking.com, Ixigo, MakeMyTrip, Goibibo, Agoda, etc.).

It is designed so that client platforms (e.g. Flutter / Dart worker) can implement a 1:1 identical normalization and matching engine.

---

## 1. Algorithm Overview

Hotel normalization transforms raw hotel titles into canonical token strings by stripping location suffixes, stopwords, star ratings, and punctuation, expanding abbreviations, and preserving brand prefixes.

### Function Signatures
- `normalizeHotelName(name: string, city?: string): string`
- `hotelSimilarity(nameA: string, nameB: string, cityA?: string, cityB?: string): number`
- `sameHotel(hotelA: HotelComparable, hotelB: HotelComparable): boolean`

---

## 2. Normalization Steps (`normalizeHotelName`)

1. **Lowercase & Accent Normalization**:
   - Normalize string using Unicode NFD and strip combining diacritical marks (`[\u0300-\u036f]`).
   - Convert to lowercase.
2. **Unify Ampersands**:
   - Replace `&` with ` and `.
3. **Separator & Suffix Stripping**:
   - Split title on separators: `,`, ` - `, `|`, ` in `, ` near `.
   - If trailing parts after the first part contain the city name or common location suffixes (`airport`, `railway station`, `stn`, `rly`, `city center`, `pvt ltd`, `a unit of`), drop those trailing parts.
4. **City Word Removal**:
   - If `city` is provided, remove word boundary matches of the city name from the string (`\b<city>\b`).
5. **Abbreviation Expansion**:
   - `\brd\b` → `road`
   - `\bint'?l\b` → `international`
   - `\bapt\b` → `airport`
   - `\bstn\b` → `station`
   - `\brly\b` → `railway`
6. **Brand Prefix Handling**:
   - `\b(oyo|fabhotel|fabhotels|treebo)\s+(flagship|premium|trend|rooms)?\s*\d+\b` → `$1`
   - `\btreebo\s+trend\b` → `treebo`
   - `\bfab\s*hotels?\b` → `fabhotel`
   - `\bradisson\s+(blu|red)\b` → `radisson blu`
7. **Star Rating & Numeric Token Removal**:
   - Strip `5 star`, `3-star`, `4*`, `5star`, and standalone digit tokens (`\b\d+\b`).
8. **Punctuation Stripping**:
   - Replace non-alphanumeric characters (except spaces) with space.
9. **Stopword Removal**:
   - Remove tokens matching stopwords: `hotel`, `hotels`, `the`, `by`, `resort`, `resorts`, `spa`, `suite`, `suites`, `inn`, `unit`, `of`, `a`, `an`, `and`, `near`, `in`, `at`, `pvt`, `ltd`, `private`, `limited`, `heritage`, `boutique`, `luxury`, `premium`, `collection`, `grand`, `palace`, `stay`, `stays`, `room`, `rooms`, `residency`, `residence`, `residences`, `international`, `intl`, `airport`, `apt`, `city`, `center`, `centre`, `best`.
10. **Token Deduplication & Join**:
    - Preserve order of unique remaining tokens, joining with a single space.

---

## 3. Same-Hotel Matching Rules (`sameHotel`)

Two listings `hotelA` and `hotelB` are matched if:
1. **Same-Site Guard**: `hotelA.site != hotelB.site` (Listings from the exact same site never merge).
2. **City Match Guard**: If both cities are specified, `cityA == cityB` (Case/accent insensitive). Different cities NEVER merge.
3. **Geo-Distance Guard**: If both have valid `lat` and `lng` coordinates, Haversine distance must be **<= 600 meters**.
4. **Locality Guard**: If both listings are in the same city, but their differing tokens contain distinct locality words (e.g. `bandra`, `kurla`, `nariman`, `point`, `andheri`, `goregaon`, `juhu`, `powai`, `sahar`, `aerocity`, `connaught`, `gurgaon`, `noida`, `koramangala`, `indiranagar`, `whitefield`, `hitec`, `gachibowli`, etc.), return `false` (prevents merging different branches of the same chain in a single city).
5. **Similarity Criteria**:
   - **Exact Normalized Match**: `normalize(A) == normalize(B)` → `true`.
   - **Jaccard Similarity**: Token-set Jaccard score **>= 0.6** → `true`.
   - **Subset Match**: Distinctive tokens of one are a subset of the other, provided:
     - Subset contains at least 1 token of length >= 3.
     - Token size difference `abs(sizeA - sizeB) <= 1`.

---

## 4. Test Vectors (JSON Specification)

```json
[
  {
    "input": { "name": "Café Royal", "city": "Mumbai" },
    "expected_normalized": "cafe royal"
  },
  {
    "input": { "name": "5 Star Hotel St. Regis", "city": "Mumbai" },
    "expected_normalized": "st regis"
  },
  {
    "input": { "name": "Trident, Bandra Kurla, Mumbai", "city": "Mumbai" },
    "expected_normalized": "trident bandra kurla"
  },
  {
    "input": { "name": "Ginger Hotel - Airport, Mumbai", "city": "Mumbai" },
    "expected_normalized": "ginger"
  },
  {
    "input": { "name": "The Lalit Resort & Spa", "city": "Goa" },
    "expected_normalized": "lalit"
  },
  {
    "input": { "name": "Treebo Trend Grand Vistara", "city": "Bengaluru" },
    "expected_normalized": "treebo vistara"
  },
  {
    "input": { "name": "OYO Flagship 1234 Hotel Green", "city": "Delhi" },
    "expected_normalized": "oyo green"
  },
  {
    "input": { "name": "The Lalit Grand Palace Srinagar", "city": "Srinagar" },
    "expected_normalized": "lalit"
  }
]
```

```json
[
  {
    "hotelA": { "name": "The LaLiT Mumbai", "city": "Mumbai", "site": "agoda" },
    "hotelB": { "name": "The Lalit Mumbai", "city": "Mumbai", "site": "booking" },
    "expected_same_hotel": true
  },
  {
    "hotelA": { "name": "Hotel Sea Princess", "city": "Mumbai", "site": "agoda" },
    "hotelB": { "name": "Hotel Sea Princess Juhu", "city": "Mumbai", "site": "agoda" },
    "expected_same_hotel": false
  },
  {
    "hotelA": { "name": "Ginger Hotel", "city": "Mumbai", "site": "agoda" },
    "hotelB": { "name": "Ginger Hotel", "city": "Pune", "site": "booking" },
    "expected_same_hotel": false
  },
  {
    "hotelA": { "name": "Trident, Bandra Kurla, Mumbai", "city": "Mumbai", "site": "agoda" },
    "hotelB": { "name": "Trident, Nariman Point, Mumbai", "city": "Mumbai", "site": "booking" },
    "expected_same_hotel": false
  },
  {
    "hotelA": { "name": "JW Marriott Sahar", "city": "Mumbai", "site": "agoda" },
    "hotelB": { "name": "JW Marriott Sahar Hotel & Apartments", "city": "Mumbai", "site": "booking" },
    "expected_same_hotel": true
  }
]
```
