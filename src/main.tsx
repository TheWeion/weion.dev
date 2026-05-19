import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '@/App';
import '@fontsource/orbitron/latin-400.css';
import '@fontsource/orbitron/latin-600.css';
import '@fontsource/orbitron/latin-700.css';
import '@fontsource/orbitron/latin-900.css';
import '@fontsource/rajdhani/latin-400.css';
import '@fontsource/rajdhani/latin-500.css';
import '@fontsource/rajdhani/latin-600.css';
import '@fontsource/rajdhani/latin-700.css';
import '@fontsource/share-tech-mono/latin-400.css';
import '@/styles/index.css';

// Refreshes should land at the top of the page.
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}
window.scrollTo(0, 0);

// React DOM entry point. The `#root` lookup is intentionally fail-fast: if the
// element is missing, the app cannot mount and a thrown error surfaces sooner
// than a silent render-to-nothing.
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Failed to locate #root element.');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Web vitals are only logged in dev.
if (import.meta.env.DEV) {
  import('@/lib/reportVitals').then(({ reportVitals }) => reportVitals());
}
