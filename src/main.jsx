import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { consumeAppleAuthRedirect } from './services/auth.js'
import { initAnalytics } from './utils/analyticsProvider.ts'

consumeAppleAuthRedirect()
initAnalytics()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
