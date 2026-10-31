/**
 * Owner 31 Oct: homepage "Currently Showing" section — same card as Upcoming Movies, red
 * "Book" CTA that opens the movies vertical. The card needs the likes count and genres the
 * reference design shows, so these pin the two honest readers: the likes text BMS bakes into
 * the poster CDN URL, and genres from the movie's own page JSON.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { bmsPosterLikes, bmsPageGenres, parseNowShowingCards } from '../server/workers/parsers/bookmyshow';

// Real BMS poster URL shapes (truncated to the text segments that matter).
const POSTER_LIKES = 'https://assets-in.bmscdn.com/discovery-catalog/events/tr:w-400:l-image,i-x.png,lx-24,ly-617,w-29,l-end:l-text,ie-NTE4SysgTGlrZXM%3D,fs-29,co-FFFFFF,ly-612,lx-70,pa-8_0_0_0,l-end/et00451914-portrait.jpg';
const POSTER_LANG = 'https://assets-in.bmscdn.com/discovery-catalog/events/tr:w-400:l-text,ie-SGluZGk%3D,fs-20,l-end/et001-portrait.jpg';

test('likes are decoded from the poster URL text segment', () => {
  assert.equal(bmsPosterLikes(POSTER_LIKES), '518K+ Likes');
});

test('a poster carrying only a language never reads as likes', () => {
  assert.equal(bmsPosterLikes(POSTER_LANG), null);
  assert.equal(bmsPosterLikes(''), null);
  assert.equal(bmsPosterLikes(undefined as any), null);
});

test('genres come from the movie page JSON array', () => {
  const html = '<script>{"genre":["Action","Adventure","Drama","Mythological"],"description":"x"}</script>';
  assert.equal(bmsPageGenres(html), 'Action/Adventure/Drama');
  assert.equal(bmsPageGenres('<html>no json</html>'), null);
});

test('now-showing cards map title, certification, languages and page', () => {
  const payload = {
    listings: [{
      cards: [
        {
          ctaUrl: 'https://in.bookmyshow.com/movies/indore/ramayana/ET00451914',
          text: [
            { components: [{ text: 'Ramayana' }] },
            { components: [{ text: 'U' }] },
            { components: [{ text: 'Hindi, Kannada, Telugu' }] },
          ],
          image: { url: POSTER_LIKES },
        },
        // Promo / explore cards are not movies and must never appear as a card.
        { ctaUrl: 'https://in.bookmyshow.com/explore/upcoming-movies-indore?ref=1', text: [{ components: [{ text: 'Explore' }] }] },
      ],
    }],
  };
  const rows = parseNowShowingCards(payload as any, { regionCode: 'IND', regionSlug: 'indore', regionName: 'Indore' } as any);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, 'Ramayana');
  assert.equal(rows[0].certification, 'U');
  assert.equal(rows[0].languages, 'Hindi, Kannada, Telugu');
  assert.equal(rows[0].eventCode, 'ET00451914');
  assert.equal(bmsPosterLikes(rows[0].poster || ''), '518K+ Likes');
});
