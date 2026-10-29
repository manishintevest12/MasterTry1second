/**
 * Alexa skill tests (owner 29 Oct: voice as a new channel, no UI/design change).
 *
 * These pin the contract that matters: the spoken answer only ever contains prices our scan
 * returned, never a fabricated figure; SSML is escaped; the skill is pinned to our application id;
 * stale Amazon retries are refused; and a dead search is answered honestly instead of silently.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSpokenAnswer,
  handleAlexaRequest,
  inferVertical,
  isFreshRequest,
  isOurSkill,
  pickVoiceHits,
  speakPrice,
  ssmlEscape,
} from '../server/alexa/handler';

const offer = (price: number, seller: string, title = 'Apple iPhone 16 (128GB)') => ({
  title,
  seller,
  prices: { effectivePrice: price, currency: 'INR' },
  sellerUrl: 'https://www.flipkart.com/x',
});

const response = (results: any[]) => ({ results } as any);

const envelope = (intent: string, slots: Record<string, string>, extra: any = {}) => ({
  version: '1.0',
  session: { new: true },
  context: { System: { application: { applicationId: 'amzn1.ask.skill.test' } } },
  request: {
    type: 'IntentRequest',
    requestId: 'r1',
    timestamp: extra.timestamp || new Date().toISOString(),
    intent: { name: intent, slots: Object.fromEntries(Object.entries(slots).map(([k, v]) => [k, { value: v }])) },
  },
  ...extra.root,
});

test('SSML escaping keeps Alexa from dropping the sentence', () => {
  assert.equal(ssmlEscape('Tom & Jerry <b>'), 'Tom &amp; Jerry &lt;b&gt;');
  assert.equal(ssmlEscape("kids' toys"), 'kids&apos; toys');
});

test('only rows with a real price are spoken, cheapest first, one row per seller', () => {
  const hits = pickVoiceHits(response([
    offer(71999, 'Amazon'),
    offer(70500, 'Flipkart', 'Apple iPhone 16 (256GB)'), // same seller: the cheaper Flipkart row wins
    offer(69900, 'Flipkart'),
    { title: 'Apple iPhone 16', seller: 'Croma', prices: { currency: 'INR' } }, // no price -> dropped
  ]));
  assert.deepEqual(hits.map((h) => [h.seller, h.price]), [['Flipkart', 69900], ['Amazon', 71999]]);
  assert.equal(pickVoiceHits(response([])).length, 0, 'no rows -> nothing invented');
});

test('the spoken answer states the lowest price, the runners-up and the seller count', () => {
  const spoken = buildSpokenAnswer('iPhone 16', pickVoiceHits(response([offer(69900, 'Flipkart'), offer(71999, 'Amazon')])), 2);
  assert.match(spoken, /lowest verified price for iPhone 16 is 69,900 rupees at Flipkart/);
  assert.match(spoken, /Amazon at 71,999 rupees/);
  assert.match(spoken, /2 sellers compared/);
});

test('no verified price is spoken as a gap, never as a number', () => {
  const spoken = buildSpokenAnswer('unobtainium', [], 0);
  assert.doesNotMatch(spoken, /rupees/);
  assert.match(spoken, /could not verify a live price for unobtainium/);
});

test('prices read the Indian way', () => {
  assert.equal(speakPrice(1234567), '12,34,567 rupees');
});

test('stale Amazon retries are refused', () => {
  const old = new Date(Date.now() - 10 * 60_000).toISOString();
  assert.equal(isFreshRequest(old), false);
  assert.equal(isFreshRequest(new Date().toISOString()), true);
  assert.equal(isFreshRequest(undefined), false);
});

test('the skill only answers its own application id once configured', () => {
  assert.equal(isOurSkill(envelope('SearchIntent', {}), 'amzn1.ask.skill.test').ok, true);
  assert.equal(isOurSkill(envelope('SearchIntent', {}), 'amzn1.ask.skill.other').ok, false);
  assert.equal(isOurSkill(envelope('SearchIntent', {}), undefined).ok, true, 'unconfigured skill id must not lock the owner out');
});

test('vertical hints come from the words the user actually said', () => {
  assert.equal(inferVertical('bus from Indore to Bhopal'), 'bus');
  assert.equal(inferVertical('cheapest flight to Delhi'), 'flights');
  assert.equal(inferVertical('price of iphone 16'), 'ecommerce');
  assert.equal(inferVertical('anything', 'flight'), 'flights');
});

test('a spoken product search runs the real engine and answers with verified rows', async () => {
  let received: any = null;
  const reply = await handleAlexaRequest(envelope('SearchIntent', { query: 'iphone 16' }), {
    skillId: 'amzn1.ask.skill.test',
    search: async (input) => {
      received = input;
      return response([offer(69900, 'Flipkart'), offer(71999, 'Amazon')]) as any;
    },
  });
  const speech = reply.response.outputSpeech.ssml;
  assert.match(speech, /69,900 rupees at Flipkart/);
  assert.equal(received.vertical, 'ecommerce');
  assert.equal(received.query, 'iphone 16');
  assert.equal(reply.response.shouldEndSession, true);
  assert.match(String(reply.response.card?.content || ''), /try1second\.com/);
});

test('a travel sentence goes to the travel vertical with both places', async () => {
  let received: any = null;
  await handleAlexaRequest(envelope('TravelIntent', { vertical: 'bus', from: 'Indore', to: 'Bhopal' }), {
    skillId: 'amzn1.ask.skill.test',
    search: async (input) => { received = input; return response([offer(349, 'redBus', 'Indore to Bhopal')]) as any; },
  });
  assert.equal(received.vertical, 'bus');
  assert.equal(received.query, 'Indore to Bhopal');
});

test('"movie tickets in Indore" does not dead-end on a missing title', async () => {
  let received: any = null;
  await handleAlexaRequest(envelope('MovieTicketIntent', { city: 'Indore' }), {
    skillId: 'amzn1.ask.skill.test',
    search: async (input) => { received = input; return response([offer(190, 'District', 'Movie ticket')]) as any; },
  });
  assert.equal(received.vertical, 'movies');
  assert.match(String(received.query), /Indore/);
});

test('a broken engine is answered honestly instead of leaving the device silent', async () => {
  const reply = await handleAlexaRequest(envelope('SearchIntent', { query: 'iphone 16' }), {
    skillId: 'amzn1.ask.skill.test',
    search: async () => { throw new Error('sources gated'); },
  });
  assert.match(reply.response.outputSpeech.ssml, /could not verify a live price/);
  assert.equal(reply.response.outputSpeech.type, 'SSML');
});

test('help and stop intents behave like a real skill', async () => {
  const help = await handleAlexaRequest(envelope('AMAZON.HelpIntent', {}), { search: async () => response([]) as any });
  assert.match(help.response.outputSpeech.ssml, /Say what you want to compare/);
  const stop = await handleAlexaRequest(envelope('AMAZON.StopIntent', {}), { search: async () => response([]) as any });
  assert.match(stop.response.outputSpeech.ssml, /Goodbye/);
  assert.equal(stop.response.shouldEndSession, true);
});

test('a foreign application id is refused', async () => {
  const reply = await handleAlexaRequest(envelope('SearchIntent', { query: 'iphone' }), {
    skillId: 'amzn1.ask.skill.mine',
    search: async () => response([offer(100, 'X')]) as any,
  });
  assert.match(reply.response.outputSpeech.ssml, /not available to this device/);
});
