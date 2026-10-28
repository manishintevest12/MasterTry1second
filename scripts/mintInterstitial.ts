import { createInterstitialPointer } from '../server/redirect/interstitial';
console.log(createInterstitialPointer(process.argv[2], process.argv[3] || 'myntra.com', null));
