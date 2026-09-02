import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { consumeAppleAuthRedirect } from './services/auth.js'
import { clearLegacySharedAuthCookies } from './play-dates/services/authToken.js'
import { initAnalytics } from './utils/analyticsProvider.ts'

clearLegacySharedAuthCookies()
consumeAppleAuthRedirect()
initAnalytics()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
