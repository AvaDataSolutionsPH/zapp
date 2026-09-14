// Leaflet's stylesheet FIRST so our own rules keep winning, exactly as when
// it was a <link> ahead of the bundle in index.html. It is bundled rather
// than fetched from unpkg so a blocked/slow CDN can never break the maps.
import 'leaflet/dist/leaflet.css'
import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ToastProvider } from './components/ui/Toast'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <App />
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)
