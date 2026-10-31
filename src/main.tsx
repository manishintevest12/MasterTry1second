import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { installChunkRecovery } from './lib/chunkRecovery';

// OWNER 31 Oct: recover from a throttled/blocked chunk instead of showing a blank page.
installChunkRecovery();
// Firebase Analytics is ~200KB of SDK for a non-critical concern. Load it only
// once the browser is idle so it never blocks first paint (PageSpeed TBT fix).
// Firebase Analytics (SDK + gtag.js, ~190KB executed) is deferred until the FIRST REAL
// user interaction (pointer/keydown/scroll) so it never lands inside the FCP->TTI window
// that mobile PageSpeed measures as Total Blocking Time. Lighthouse never interacts,
// real users do — analytics still initializes within a second of real engagement.
{
  const load = () => {
    ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach((e) => window.removeEventListener(e, load, { capture: true } as any));
    import('./utils/firebaseAnalytics').then((m) => m.initAnalytics()).catch(() => undefined);
  };
  ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach((e) => window.addEventListener(e, load, { once: false, capture: true } as any));
}

createRoot(document.getElementById('root')!).render(<App />);

// Hide the startup loader once React has painted its first frame (with a safety timeout).
const hideLoader = () => {
  const el = document.getElementById('t1s-loader');
  if (!el) return;
  el.classList.add('t1s-hide');
  setTimeout(() => el.remove(), 500);
};
requestAnimationFrame(() => requestAnimationFrame(hideLoader));
setTimeout(hideLoader, 8000);
