import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from '@/app/App'
import '@/styles/fonts.css'
import '@/styles/tokens.css'
import '@/styles/reset.css'
import '@/styles/global.css'

const rootElement = document.getElementById('root')

if (rootElement === null) {
  throw new Error('CASMS Web could not find the #root mount element.')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
