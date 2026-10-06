import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './stil.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Yayındaki sürümde service worker: dosyaları (özellikle optik okuyucunun OpenCV'si) önbelleğe alır.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => {})
  })
}
