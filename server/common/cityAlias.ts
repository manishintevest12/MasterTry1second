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
