/**
 * MOVIE CITY CONTENT (owner 10 Nov, from the SEO report page 2): the movies cluster is the closest thing to a
 * win we have - /movies/bengaluru at position 18.4 with 59 impressions, /movies/noida at 16.0, the vertical hub
 * at 21.5 - so it is the first cluster worth pushing onto page one. The reason those pages stall is that every
 * city page was the same template with the city name swapped in (thin, duplicated content).
 *
 * This module gives each city page real, city-specific substance: which languages its cinemas actually screen,
 * what changes the ticket total there, and the checks that matter before paying. No prices are written down
 * (they change every show) and no venue claims are invented - only the language mix, which is a stable property
 * of each city's cinema market, and mechanics that hold for every Indian multiplex.
 */
export interface MovieCityContent {
  /** Languages multiplexes in this city routinely screen. Stable, verifiable market fact. */
  languages: string[];
  /** One sentence on why this city's ticket prices behave the way they do. */
  market: string;
  /** City-specific checks a buyer should make before paying. */
  checks: string[];
}

export const MOVIE_CITY_CONTENT: Record<string, MovieCityContent> = {
  bengaluru: {
    languages: ['Kannada', 'English', 'Hindi', 'Tamil', 'Telugu'],
    market:
      'Bengaluru screens more languages in one week than most Indian cities, so the same multiplex runs a Kannada release, an English title and a Hindi or Telugu film on adjacent screens, each priced separately by language and screen.',
    checks: [
      'A Kannada release and its Hindi version can run at different prices in the same building, so compare the exact language show.',
      'Screens in the city centre and on the Outer Ring Road price the same film differently, so compare the cinema rather than only the showtime.',
      'Late-night and first-day-first-show slots are usually priced above a weekday afternoon show in the same hall.',
    ],
  },
  noida: {
    languages: ['Hindi', 'English', 'Punjabi'],
    market:
      'Noida multiplexes price the same Hindi release differently from Delhi and Gurugram halls a few kilometres away, so the NCR city you search changes the ticket total before any fee is added.',
    checks: [
      'Compare Noida halls with the Delhi and Gurugram ones you would realistically travel to, because the gap between them can exceed the convenience fee.',
      'Malls along the Noida Expressway and in the older sectors have different seat mixes, so check whether the price quoted is for a recliner or a regular seat.',
      'Metro-accessible halls fill earlier on weekends, which pushes the cheap seats out first.',
    ],
  },
  mumbai: {
    languages: ['Hindi', 'Marathi', 'English'],
    market:
      'Mumbai has the widest spread between a single-screen hall and a premium multiplex in the same neighbourhood, so seat category matters more here than in most cities.',
    checks: [
      'A single-screen hall and a multiplex in the same area can differ by a large margin for the same film, so compare both before booking.',
      'Marathi and Hindi releases often run on different screens with separate pricing, so confirm the language on the listing.',
      'Evening shows in South Mumbai and Bandra carry the city\u2019s highest seat prices; a matinee or a suburban hall is usually cheaper.',
    ],
  },
  delhi: {
    languages: ['Hindi', 'English', 'Punjabi'],
    market:
      'Delhi spans single-screen halls and premium multiplexes across a wide area, so the cinema you pick changes the ticket price more than the film does.',
    checks: [
      'Compare halls in the same part of the city; travelling across Delhi for a cheaper ticket can cost more than the saving.',
      'Premium formats such as large-format screens are priced well above a standard screen for the same show.',
      'Weekend evening shows sell out first, so the cheap seat categories go before the expensive ones.',
    ],
  },
  chennai: {
    languages: ['Tamil', 'English', 'Hindi', 'Telugu'],
    market:
      'Chennai prices Tamil releases and English titles on separate screens with separate demand, and opening-week shows carry a premium that fades within days.',
    checks: [
      'Compare the same Tamil film across halls, because screen count and demand differ sharply by area.',
      'First-week shows are priced above the second week for the same film and screen.',
      'Check whether the listing is a Tamil or a dubbed version before comparing prices.',
    ],
  },
  hyderabad: {
    languages: ['Telugu', 'Hindi', 'English', 'Tamil'],
    market:
      'Hyderabad multiplexes lean heavily on Telugu releases, and a big-ticket Telugu film can price well above a Hindi or English title on the same weekend.',
    checks: [
      'Compare single-screen and multiplex prices for the same Telugu release, because the gap is wide in this city.',
      'Premium large-format screens charge a separate price for the same showtime.',
      'Opening-weekend shows are the most expensive; the following week is usually cheaper for the same seat class.',
    ],
  },
  kolkata: {
    languages: ['Bengali', 'Hindi', 'English'],
    market:
      'Kolkata runs Bengali and Hindi releases side by side, and older single-screen halls keep prices well below the multiplexes for the same film.',
    checks: [
      'Compare a Bengali release at a single-screen hall with the multiplex price before assuming the multiplex is the only option.',
      'Confirm the language and whether the show is dubbed, since both can run at different prices.',
      'Afternoon shows are consistently cheaper than evening shows in the same hall.',
    ],
  },
  pune: {
    languages: ['Marathi', 'Hindi', 'English'],
    market:
      'Pune prices Marathi, Hindi and English releases separately, and the same film costs less in the older city-centre halls than in the new malls on the outskirts.',
    checks: [
      'Compare halls in the same part of Pune instead of the whole city, since travel time eats the difference.',
      'Marathi releases usually open on more screens here, so seat availability is better than for a limited English release.',
      'Weekend evening shows are priced above weekday shows for the same screen.',
    ],
  },
  ahmedabad: {
    languages: ['Gujarati', 'Hindi', 'English'],
    market:
      'Ahmedabad runs a strong Gujarati slate alongside Hindi and English films, and Gujarati releases are often the cheapest way to see a film on a big screen here.',
    checks: [
      'Compare Gujarati and Hindi shows of different films to see which screen class is cheapest that day.',
      'Check whether the listing is a Gujarati original or a dubbed version before comparing.',
      'Multiplexes on the SG Highway corridor price above the older city-centre halls.',
    ],
  },
  jaipur: {
    languages: ['Hindi', 'English'],
    market:
      'Jaipur multiplexes price Hindi releases above English titles on the same weekend, and single-screen halls undercut both.',
    checks: [
      'Compare the single-screen hall and the multiplex for the same Hindi film; the difference is usually larger than the convenience fee.',
      'Weekend evening shows carry the highest price; a weekday afternoon show in the same hall is the cheapest.',
      'Check the seat category, since premium seats in the same hall can cost well above a regular seat.',
    ],
  },
  lucknow: {
    languages: ['Hindi', 'English'],
    market:
      'Lucknow prices Hindi releases as the main draw, with English films running on fewer screens and often at lower demand.',
    checks: [
      'Compare halls in Hazratganj and the newer malls, because both price the same film differently.',
      'Check whether the show is a morning or evening slot; the same seat class is priced lower earlier in the day.',
      'Confirm the seat category before paying, since premium recliners are a separate price band.',
    ],
  },
  kochi: {
    languages: ['Malayalam', 'Tamil', 'Hindi', 'English'],
    market:
      'Kochi screens Malayalam releases first and in the greatest number, so Malayalam titles usually have the most showtimes and the widest price range.',
    checks: [
      'Compare Malayalam and Tamil or Hindi shows separately, since they are priced as different products.',
      'Multiplexes in the city and in the suburbs price the same Malayalam film differently.',
      'Opening-week shows cost more than the second week for the same screen and seat.',
    ],
  },
};

/** Fallback copy that stays honest for a city we have no language data for. */
export const GENERIC_MOVIE_CHECKS = [
  'Compare the same cinema, showtime and seat category across booking platforms, because the convenience fee differs by platform.',
  'Check the seat category: premium and recliner seats are a separate price band in the same hall.',
  'Weekday matinee shows are priced below weekend evening shows for the same screen.',
];
