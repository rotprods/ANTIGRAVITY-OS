// ═══════════════════════════════════════════════════
// OCULOPS — React Entry Point
// ═══════════════════════════════════════════════════

import React from 'react'
import ReactDOM from 'react-dom/client'
import { initSentry } from './lib/sentry'
import App from './App.jsx'
import './styles/tokens.css'
import './styles/global.css'
import './styles/animations.css'

// Initialize Sentry before React renders (no-op if DSN not set)
initSentry()

window.addEventListener('error', (e) => {
  if (import.meta.env.DEV) console.error('[CRITICAL] Runtime error:', e.message, e.filename, e.lineno);
});

window.addEventListener('unhandledrejection', (e) => {
  if (import.meta.env.DEV) console.error('[CRITICAL] Unhandled promise rejection:', e.reason);
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  if (import.meta.env.DEV) console.error('[FATAL] Root element not found!');
} else {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
