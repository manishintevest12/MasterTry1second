import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
// Firebase Analytics is ~200KB of SDK for a non-critical concern. Load it only
// once the browser is idle so it never blocks first paint (PageSpeed TBT fix).
const idle = (window as any).requestIdleCallback || ((cb: () => void) => setTimeout(cb, 1200));
idle(() => { import('./utils/firebaseAnalytics').then((m) => m.initAnalytics()).catch(() => undefined); });

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
