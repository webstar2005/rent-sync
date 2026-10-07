import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// Theme before first paint so the initial screen is already correct.
try {
  const stored = localStorage.getItem('rentsync.theme')
  document.documentElement.dataset.theme = stored === 'light' ? 'light' : 'dark'
} catch {
  document.documentElement.dataset.theme = 'dark'
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
