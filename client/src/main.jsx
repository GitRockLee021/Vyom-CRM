import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import './styles/global.css';

const rootElement = document.getElementById('root');

function render() {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </React.StrictMode>,
  );
}

// Keep the splash visible until the icon & body fonts are actually loaded,
// so the UI never paints with raw ligatures or fallback fonts. Hard timeout
// guarantees the app always mounts even if a font request hangs.
function fontsReady() {
  if (!document.fonts || typeof document.fonts.load !== 'function' || !{}.then) return Promise.resolve();
  const wanted = [
    document.fonts.load('20px "Material Symbols Outlined"'),
    document.fonts.load('600 16px Inter'),
    document.fonts.ready,
  ];
  const timeout = new Promise((resolve) => setTimeout(resolve, 3000));
  return Promise.all(wanted.map((p) => Promise.race([p, timeout])));
}

fontsReady().then(render).catch(render);
