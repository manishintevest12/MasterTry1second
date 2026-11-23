import test from 'node:test';
import assert from 'node:assert/strict';
import { rowPhotos, rowPhoto } from '../server/lens/relatedRowImages';

/**
 * OWNER 23 Nov (Product Page screenshots): "jb mai product ka link daal raha hoon tho related products mai jiska link
 * copy kiya hoon ussi ka image sb mai aa raha hai jb ki usme uss product se related aana chaiye tha jaise pp ke liye
 * uss oppo mobile ka image".
 *
 * Root cause was the row builder appending the SEARCHED product's gallery to every related row, so a row with no
 * photo of its own showed the parent's picture. These tests pin the rule that fixed it: a row only ever gets ITS OWN
 * photo.
 */

const SHOES = 'https://rukminim2.flixcart.com/image/832/832/shoes-hotstyle.jpeg';

test('a row with its own photo keeps exactly that photo', () => {
  assert.deepEqual(rowPhotos({ title: 'OPPO Reno16c 5G', image: 'https://cdn.example.com/oppo.jpg' }), [
    'https://cdn.example.com/oppo.jpg',
  ]);
  assert.equal(rowPhoto({ title: 'OPPO Reno16c 5G', image: 'https://cdn.example.com/oppo.jpg' }), 'https://cdn.example.com/oppo.jpg');
});

test('every parser spelling is read (attributes.image_url, attributes.image, imageUrl, thumbnail, gallery)', () => {
  assert.equal(rowPhoto({ attributes: { image_url: 'https://a.example.com/1.jpg' } }), 'https://a.example.com/1.jpg');
  assert.equal(rowPhoto({ attributes: { image: 'https://a.example.com/2.jpg' } }), 'https://a.example.com/2.jpg');
  assert.equal(rowPhoto({ imageUrl: 'https://a.example.com/3.jpg' }), 'https://a.example.com/3.jpg');
  assert.equal(rowPhoto({ thumbnail: 'https://a.example.com/4.jpg' }), 'https://a.example.com/4.jpg');
  assert.equal(rowPhoto({ attributes: { image_urls: 'https://a.example.com/5.jpg|https://a.example.com/6.jpg' } }), 'https://a.example.com/5.jpg');
});

test('a row with NO photo of its own gets none — the parent product picture is never borrowed', () => {
  // this is the exact shape that painted twelve different titles with the searched shoe
  const photoLess = { title: 'QRIOH Abstract Printed Realme P4', seller: 'Flipkart', attributes: {} };
  assert.deepEqual(rowPhotos(photoLess), []);
  assert.equal(rowPhoto(photoLess), null);
  // the parent's gallery is not an input to this function at all, so it cannot leak in
  assert.equal(rowPhoto(null), null);
  assert.equal(rowPhoto(undefined), null);
});

test('junk, relative and duplicate photos are dropped, first real https photo wins', () => {
  assert.equal(rowPhoto({ image: '/local/path.jpg', imageUrl: 'https://real.example.com/x.jpg' }), 'https://real.example.com/x.jpg');
  assert.equal(rowPhoto({ image: '', thumbnail: '' }), null);
  const dupe = rowPhotos({ image: 'https://a.example.com/1.jpg', attributes: { image_urls: 'https://a.example.com/1.jpg|https://a.example.com/2.jpg' } });
  assert.deepEqual(dupe, ['https://a.example.com/1.jpg', 'https://a.example.com/2.jpg']);
});

test('the shoes photo only ever belongs to the shoe row itself', () => {
  const rows = [
    { title: 'HOTSTYLE Running Shoes For Men', image: SHOES },
    { title: 'OPPO Reno16c 5G', image: 'https://cdn.example.com/oppo.jpg' },
    { title: 'CASE CREATION Superhero Printed', attributes: {} },
  ];
  const photos = rows.map((r) => rowPhoto(r));
  assert.equal(photos[0], SHOES);
  assert.equal(photos[1], 'https://cdn.example.com/oppo.jpg');
  assert.equal(photos[2], null, 'the photo-less row must not show the shoe');
  assert.equal(new Set(photos.filter(Boolean)).size, 2, 'no two different products share one image');
});
