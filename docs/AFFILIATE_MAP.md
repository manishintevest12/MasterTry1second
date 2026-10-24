# Try1Second — Affiliate Map: Kaun Si Site Pe Kaun Sa Affiliate Laga Hai
_Last updated: 24 Oct 2026 (commit 13d5edf)_

## 1. Ek line me summary

Site se bahar JAANE wala har link `/api/out` se jaata hai. Click hote hi `affiliate_clicks` table me record ban jaata hai (konsa merchant, konsa network, kab). Link jo affiliate network ka tracking URL banta hai, uski priority neeche di hai. Jo pehle match ho jaata hai, wahi lagta hai.

## 2. Priority chain (upar se neeche, pehla match jeet-ta hai)

| # | Layer | Kya hai | Kaun pe |
|---|-------|---------|---------|
| 1 | `affiliate_configs` (MySQL) | Admin panel se manually set kiya gaya per-merchant config | Jo bhi admin set kare — SABSE ZYADA PRIORITY |
| 2 | `affiliate_links` (MySQL) | Affiliate sync cron (VCommission / Admitad / Cuelinks) kiye hue campaign templates | Jo network ka offer mile |
| 3 | **Amazon Associates** | Humara apna store tag `try1second-21` | Sirf amazon.in / amzn.to |
| 4 | **Cuelinks** | Publisher 278473, cid 326794 (linkkit deeplink) | Sirf MakeMyTrip + Goibibo |
| 5 | **LinkInR (INR Deals)** | 169 active campaigns, inventory `dkNuid`, sub_id `try1second-<click>` | Baaki saare merchants jinke naam campaign sheet me hain |
| 6 | **Ekaro (EarnKaro converter)** | API: `ekaro-api.affiliaters.in/api/converter` — sirf EarnKaro-catalog merchants (Flipkart→fktr.in, Myntra→myntr.it). EKARO_API_KEY zaroori | Jo upar kahin nahi match hue |
| 7 | **Direct hop** | Koi affiliate nahi — seedha merchant site (kabhi fake parameter nahi) | Bacha hua sab |

**Note:** Cab in-app booking links (m.uber.com/looking, book.olacabs.com, rapido.cc) jaan-boojh ke DIRECT rakhe gaye hain — affiliate converter trip details (pickup/drop) kho deta hai, isliye attribution URL me hi bake kiya gaya hai.

## 3. Merchant-wise mapping (main sites)

| Merchant / Site | Affiliate jo lagega | Rate / Payout | Commission kahan dikhega |
|---|---|---|---|
| Amazon.in | Amazon Associates (humara tag) | Product category wise | Amazon Associates dashboard |
| MakeMyTrip | Cuelinks (campaign 3801 "MMT Hotels" — domain-wise sab cover) | Hotels CPS | Cuelinks dashboard (pub 278473) |
| Goibibo | Cuelinks (campaign 3942 "Goibibo Hotels") | Upto ₹288 CPS | Cuelinks dashboard |
| **Agoda** | **LinkInR — "Agoda" CPS Flat 4.8%** | 4.8% | **LinkInR / INR Deals dashboard** |
| Cleartrip | LinkInR (Upto ₹288) | CPS | LinkInR dashboard |
| Yatra | LinkInR — "Yatra (Hotel and Flights)" | Upto ₹70 | LinkInR dashboard |
| Flipkart | LinkInR (Upto 5.76%) — LinkInR fail ho to Ekaro (fktr.in) | CPS | LinkInR / EarnKaro |
| Myntra | LinkInR (Upto 8%) — fail ho to Ekaro (myntr.it) | CPS | LinkInR / EarnKaro |
| Ajio | LinkInR (Upto 8.64%) | CPS | LinkInR dashboard |
| Tata CLiQ | LinkInR (Flat 3.4%) | CPS | LinkInR dashboard |
| Uber (site link) | LinkInR (Flat ₹120) | CPA | LinkInR dashboard |
| Air India | LinkInR (Upto 0.6%) | CPS | LinkInR dashboard |
| Blinkit / Zepto / Instamart / BigBasket / FK Minutes | Ekaro try karta hai — EarnKaro catalog me NAHI hote → honest DIRECT hop | — | (Koi affiliate nahi — inke apne programs join karne padenge) |
| Zomato / Swiggy / BookMyShow / Paytm / redBus / AbhiBus / IndiGo / OYO etc. | LinkInR sheet me campaign nahi → Ekaro catalog me bhi nahi → **DIRECT** | — | Direct partnership join karni padegi (ya admin config banao) |
| Ola / Rapido cab booking | Direct (trip params preserved) | — | — |

(Priority 1–2 layers — admin configs aur sync kiye networks — in sabko OVERRIDE kar sakte hain. Production me jo laga hai wo `affiliate_clicks.network_id` column se pakka pata chalega.)

## 4. Tumhari Agoda hotel booking — info kahan milegi

1. **Click record (humari side):** Production Hostinger MySQL me:
   ```sql
   SELECT id, network_id, vendor_domain, destination_url, click_id, created_at
   FROM affiliate_clicks
   WHERE vendor_domain LIKE '%agoda%'
   ORDER BY id DESC LIMIT 20;
   ```
   Yahan dikhega: kab click hua, kaunsa network use hua (`linkinr` hona chahiye), aur click_id.
2. **Booking + commission (network ki side):** Agoda ki booking detail aur 4.8% commission **LinkInR (INR Deals) dashboard** me confirm hoti hai — wahan pe click_id se match ho jaata hai. Networks ko confirm hone me 1–7 din lag sakte hain (stay complete hone ke baad bhi validation hota hai).
3. **Important:** Agoda humein booking ki detail API se nahi bhejta. Humari site tak sirf CLICK aata hai; booking/commission network dashboard me hi dikhti hai. Jab dashboard me dikh jaaye, admin se conversion import b ho sakta hai (`affiliate_conversions` table — sirf authorized report se).

## 5. Koi merchant ka affiliate badalna ho to

- **Sabse fast:** `affiliate_configs` table me us merchant ka row banao (slug/domain + network + template). Ye sab layers ko override karta hai.
- **Naya merchant join kiya kisi network me:** LinkInR ke liye campaigns.csv update hoga; Cuelinks ke liye dashboard me merchant join karo (code me `CUELINKS_MERCHANTS` set me domain add hota hai); EarnKaro deals admin panel me manually add hote hain.
- **Kabhi bhi fake/guessed affiliate parameter nahi** — jo network configured nahi hai, wo link direct jaata hai.

## 6. Abhi ke pending setup items

- `EKARO_API_KEY` production (hPanel env) me set karna hai + Node restart — tab grocery exits Ekaro try kar payengi (abhi key absent = direct hop, self-heal ho jaayega jab key aa jaayegi).
- Admitad / VCommission / Cuelinks API keys (jo bhi use karna ho) affiliate sync cron ke liye — `affiliate_links` table ke saath zyada merchants auto-cover ho jaayenge.
