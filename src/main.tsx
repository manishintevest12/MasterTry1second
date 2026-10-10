import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

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
