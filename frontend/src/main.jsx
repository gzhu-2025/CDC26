import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import Explorer from './explorer/Explorer.jsx'
import Analysis from './Analysis/Analysis.jsx'
import Insights from './Resources/Resources.jsx'
import Layout from './Layout.jsx'
import './explorer/explorer.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/explorer" element={<Explorer />} />
          <Route path="/analysis" element={<Analysis />} />
          <Route path="/resources" element={<Insights />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  </StrictMode>,
)
