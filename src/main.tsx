import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import MiniWindow from './mini/MiniWindow';
import './index.css';

// The desktop app opens /mini in its own small always-on-top window.
const isMini = window.location.pathname === '/mini';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isMini ? (
      <MiniWindow />
    ) : (
      <BrowserRouter>
        <App />
      </BrowserRouter>
    )}
  </StrictMode>,
);
