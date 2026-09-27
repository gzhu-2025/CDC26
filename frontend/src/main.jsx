import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import Explorer from './explorer/Explorer.jsx'
import './explorer/explorer.css'

import Chart from './Chart.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/explorer" element={<Explorer />} />
        <Route path="/chart" element={<Chart />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
