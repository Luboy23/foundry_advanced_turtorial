import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { loadRuntimeConfig } from './lib/runtime-config'

const bootstrap = async () => {
  await loadRuntimeConfig()
  const { default: App } = await import('./App')

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap()
