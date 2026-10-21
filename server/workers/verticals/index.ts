/** Loads every vertical worker so they self-register. One import = all 13 vertical workers. */
import './ecommerce';
import './loans';
import './hotels';
import './flights';
import './food';
import './cab';
import './insurance';
import './grocery';
import './movies';
import './bus';
import './creditcards';
import './account';
export { allVerticalWorkers, getVerticalWorker } from '../verticalWorker';
