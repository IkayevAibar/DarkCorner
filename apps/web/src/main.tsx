import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import { SheetProvider } from './components/Sheet';
import { I18nProvider } from './i18n';
// Listens for the browser's install prompt from the first moment.
import { inApp } from './install';
import { SessionProvider } from './session';
import './styles.css';

// The Android app's back button (src/native.ts); only the solo build ships it.
if (__SOLO__ && inApp()) void import('./native').then((native) => native.startNative());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <I18nProvider>
        <SessionProvider>
          <SheetProvider>
            <App />
          </SheetProvider>
        </SessionProvider>
      </I18nProvider>
    </BrowserRouter>
  </StrictMode>,
);
