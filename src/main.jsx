// ═══════════════════════════════════════════════════
// ANTIGRAVITY OS v10 — React Entry Point
// ═══════════════════════════════════════════════════

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/tokens.css'
import './styles/global.css'
import './styles/animations.css'

window.addEventListener('error', (e) => {
  console.error('[CRITICAL] Runtime error:', e.message, e.filename, e.lineno);
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('[CRITICAL] Unhandled promise rejection:', e.reason);
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('❌ [FATAL] Root element not found!');
} else {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
