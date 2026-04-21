import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './config/queryClient'
import './index.css'
import './polyfills/cryptoRandomUUID.js'
import App from './App.jsx'
import './config/setupAxios.js'

import ErrorBoundary from './ErrorBoundary';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </QueryClientProvider>
  </StrictMode>,
)
