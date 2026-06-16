import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { consumeAppleAuthRedirect } from './services/auth.js'

if (
  window.location.hash === "" &&
  /^\/player\/profile\/[^/]+\/?$/.test(window.location.pathname)
) {
  const normalizedPath = window.location.pathname.replace(/\/+$/, "");
  window.history.replaceState(
    null,
    "",
    `${window.location.origin}/#${normalizedPath}`,
  );
}

consumeAppleAuthRedirect()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
