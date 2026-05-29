import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ToastProvider } from './components/ui/Toast'
import App from './App'

// Dev-only: expose aiService helpers on `window.aiService` so the
// Gemini connectivity smoke-test (Phase 2D-1) can run from the
// browser console. Production builds strip this branch entirely.
if (import.meta.env.DEV) {
  void import('./services/aiService').then((mod) => {
    (window as unknown as { aiService: typeof mod }).aiService = mod;
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <App />
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)
