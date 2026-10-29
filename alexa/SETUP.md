# Alexa: connecting Try1Second to voice (owner 29 Oct)

Voice is an extra front door to the same engine. **Nothing on the website or in the app changes**:
no new button, no new section, no copy change. Alexa simply calls `POST /api/alexa`, the handler runs
the normal `runSearch` pipeline, and the answer is spoken from the rows our own scan returned.

## What is already deployed (server-side)

| Piece | Where |
| --- | --- |
| Voice webhook | `POST https://www.try1second.com/api/alexa` |
| Liveness probe (no data) | `GET https://www.try1second.com/api/alexa` |
| Intent handling, SSML, honesty rules | `server/alexa/handler.ts` |
| Voice's search call (same answer the web feed gets) | `server/alexa/searchClient.ts` |
| Skill model to paste into Amazon | `alexa/interaction-model.json` |
| Skill manifest to paste into Amazon | `alexa/skill-manifest.json` |
| Skill icons | `public/icons/alexa-108.png`, `public/icons/alexa-512.png` |

Rules the handler enforces, so voice can never overstate what we know:

- Only prices an actual scan returned are spoken. No verified price → it says so and points at the site.
- Cheapest verified offer first, one line per seller, capped at three sellers.
- SSML is escaped, so an `&` or quotes in a product name cannot break the sentence.
- Requests older than 150 seconds are refused (Amazon's replay rule).
- Once `ALEXA_SKILL_ID` is set, requests for any other skill are refused.
- Voice does not run its own copy of the pipeline: it reads `POST /api/scrape/live` over loopback,
  so it gets exactly the rows the website shows (last-chance pass, last-verified rows, relevance
  ranking included). Anything that heals the web feed heals voice.
- Budget is 7s with one retry on the leftover time, inside Alexa's ~8s window.
- A route-level row with no shop name (bus/flights) is spoken as a price only; no shop is invented.

## Owner steps in the Amazon Developer Console (one-time, ~10 minutes)

1. Go to <https://developer.amazon.com/alexa/console/ask> → **Create Skill**.
   Name: `Try1Second`. Primary locale: **English (India)**. Model: **Custom**. Hosting: **Provision your own**.
2. **Invocation** tab → set the invocation name to `try one second`.
3. **JSON Editor** (Interaction Model) → paste the whole content of `alexa/interaction-model.json` → **Save Model** → **Build Model**.
4. **Endpoint** tab → Service endpoint type **HTTPS** → Default region:
   `https://www.try1second.com/api/alexa`
   SSL certificate type: *My development endpoint has a certificate from a trusted certificate authority*.
5. Copy the **Skill ID** (`amzn1.ask.skill.…`) and set it on the server:
   hPanel → Node.js environment variable `ALEXA_SKILL_ID` = that id → restart Node.
   (Without it the webhook still answers, but anyone could point a skill at it; set it before publishing.)
6. **Test** tab → set to **Development**, then type or say:
   - `open try one second`
   - `compare iphone 16`
   - `bus from Indore to Bhopal`
   - `movie tickets in Indore`
7. Optional but recommended for reach: **Distribution → Availability → India**, fill the store listing
   from `alexa/skill-manifest.json`, then submit for certification.

Amazon asks for a privacy policy and terms URL; the manifest points at
`https://www.try1second.com/privacy` and `/terms`. If either page is missing, certification will
reject the skill, so check those two URLs exist before submitting.

## What the user hears

> "Alexa, ask try one second to compare iPhone 16"
>
> "On Try1Second, the lowest verified price for iphone 16 is 69,900 rupees at Croma. I also found
> Reliance Digital at 69,900 rupees. 3 sellers compared. Prices update live."

> "Alexa, ask try one second for bus from Indore to Bhopal"
>
> "On Try1Second, the lowest verified price for bus from Indore to Bhopal is 357 rupees. I also found
> 373 rupees elsewhere. Prices update live."

Both lines above are real output from the live engine (verified 29 Oct), not examples written by hand.

## Honest limits

- Voice answers with prices only; it never books, pays or stores a passenger/traveller detail.
- The Alexa card links to the site home page. A `?q=` deep link that would open the search directly is
  a **UI/flow change**, so it needs the owner's explicit approval before it is added.
- Alexa certification is Amazon's decision; the code and model here are complete, the review is not.
- Google Assistant/Action and Siri App Intents are not part of this change; each is its own integration.
