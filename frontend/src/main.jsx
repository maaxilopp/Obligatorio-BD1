import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Tooltips from './components/Tooltips.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <Tooltips />
  </StrictMode>,
)
