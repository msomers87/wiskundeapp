import React from 'react';
import ReactDOM from 'react-dom/client';
import 'katex/dist/katex.min.css';
import 'mathlive';
import { MathfieldElement } from 'mathlive';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './styles.css';

// MathLive: fonts zelf hosten (door vite-plugin-static-copy naar /fonts
// gekopieerd) en geluiden uit — belangrijk voor offline/PWA-gebruik.
MathfieldElement.fontsDirectory = '/fonts';
MathfieldElement.soundsDirectory = null;

// Service worker: cachet de app-shell zodat de app snel (en offline)
// opent. De AI-calls zelf hebben uiteraard internet nodig.
registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
