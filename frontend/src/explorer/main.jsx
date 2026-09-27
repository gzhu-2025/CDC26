import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../theme/tokens.css'
import './explorer.css'
import Explorer from './Explorer.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Explorer />
  </StrictMode>,
)
