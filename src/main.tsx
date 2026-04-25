import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '@/App';
import '@/styles/index.css';

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
