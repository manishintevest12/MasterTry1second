import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toingShellGroups, toingShellCursor, toingMenuDishes, toingItem } from '../server/workers/parsers/toing';

const source: any = { id: 'w_food_toing', method: 'direct_http', vertical: 'food' };

const shellSample = JSON.stringify({
  tid: 't', sid: 's',
  success: {
    cards: [
      { card: { card: { '@type': 'type.googleapis.com/swiggy.gandalf.widgets.v2.GridWidget', layout: {} } } },
      { card: { card: {
        '@type': 'type.googleapis.com/swiggy.presentation.food.v2.RestaurantDishGroup',
        dishGroup: {
          restaurant: { info: { id: '34715', name: 'Kok Pa Chinese', areaName: 'Deccan Gymkhana',
            costForTwo: '₹250 for two', cuisines: ['Chinese', 'Asian'], avgRating: 4.0,
            sla: { slaString: '25-35 mins' }, cloudinaryImageId: 'gvvdbegf1guwzww6rsbh' } },
          dishes: [
            { info: { id: '6986402', name: 'Veg Schezwan Noodles', price: 16000, inStock: 1, isVeg: 1,
              isBestseller: true, imageId: 'oazxqwvbjgk9atq4pxzd', description: 'Bold flavors',
              ratings: { aggregatedRating: { rating: '3.9', ratingCountV2: '953' } } } },
            { info: { id: '6986403', name: 'Free dish (no price)', price: 0, inStock: 1 } },
          ] } } } },
      { card: { card: {
        '@type': 'type.googleapis.com/swiggy.presentation.food.v2.RestaurantDishGroup',
        dishGroup: {
          restaurant: { info: { id: '34715', name: 'Kok Pa Chinese (duplicate page entry)' } },
          dishes: [] } } } },
    ],
    pageOffset: { nextOffset: 'CURSOR==', widgetOffset: { Foodpage_Toing_ItemCollectionWidget: '6' } },
    nextFetch: 1,
  },
});

const menuSample = JSON.stringify({
  success: { cards: [
    { card: { card: { '@type': 'type.googleapis.com/swiggy.presentation.food.v2.TextBoxV2', text: 'Ratings 4.0+' } } },
    { card: { card: {
      '@type': 'type.googleapis.com/swiggy.presentation.food.v2.ItemCategory',
      title: 'Recommended',
      itemCards: [
        { card: { card: { '@type': 'type.googleapis.com/swiggy.presentation.food.v2.Dish',
          info: { id: '6986324', name: 'Veg Hot and Sour Soup', price: 20000, inStock: 1, isVeg: 1 } } } },
        { card: { card: { '@type': 'type.googleapis.com/swiggy.presentation.food.v2.Dish',
          info: { id: '6986325', name: 'Priced-out dish', price: 0, inStock: 0 } } } },
        { card: { card: { '@type': 'type.googleapis.com/swiggy.presentation.food.v2.Dish',
          info: { id: '6986324', name: 'Veg Hot and Sour Soup (dup)', price: 20000, inStock: 1 } } } },
      ] } } },
  ] },
});

test('toing: shell parses restaurant groups with priced featured dishes, dedupes restaurants', () => {
  const g = toingShellGroups(shellSample);
  assert.ok(g.ok);
  assert.equal(g.restaurants.length, 1); // duplicate restaurant dropped
  assert.equal(g.restaurants[0].name, 'Kok Pa Chinese');
  const dishes = g.dishesByRestaurant.get('34715')!;
  assert.equal(dishes.length, 1); // price-less dish skipped
  assert.equal(dishes[0].name, 'Veg Schezwan Noodles');
});

test('toing: shell cursor extracted for pagination', () => {
  const cur = toingShellCursor(shellSample);
  assert.equal(cur.pageOffset, 'CURSOR==');
  assert.equal(cur.widgetOffset?.Foodpage_Toing_ItemCollectionWidget, '6');
});

test('toing: dynamicmenu parses ItemCategory dishes, skips unpriced, dedupes', () => {
  const dishes = toingMenuDishes(menuSample);
  assert.equal(dishes.length, 1);
  assert.equal(dishes[0].name, 'Veg Hot and Sour Soup');
});

test('toing: item maps paise to rupees, app-only labels, real image CDN', () => {
  const g = toingShellGroups(shellSample);
  const rest = g.restaurants[0];
  const d = g.dishesByRestaurant.get('34715')![0];
  const it = toingItem(source, 'https://disc.swiggy.com/api/v1/json/shell/toing-app?lat=18.5204&lng=73.8567', rest, d, 'Pune', 'fp', 'test basis') as any;
  assert.equal(it.title, 'Veg Schezwan Noodles');
  assert.equal(it.price, 160); // 16000 paise -> Rs 160
  assert.equal(it.seller, 'Toing');
  assert.equal(it.sellerUrl, 'https://www.toingit.com/');
  assert.equal(it.availability, 'in_stock');
  assert.match(it.attributes.image_url, /^https:\/\/media-assets\.swiggy\.com\/.*oazxqwvbjgk9atq4pxzd$/);
  assert.equal(it.attributes.veg, 'veg');
  assert.equal(it.attributes.bestseller, 'yes');
  assert.equal(it.attributes.rating, '3.9');
  assert.equal(it.attributes.eta, '25-35 mins');
  assert.match(it.attributes.availability_note, /available only on app/);
  assert.equal(it.attributes.restaurant, 'Kok Pa Chinese');
});
