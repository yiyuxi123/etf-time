import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { installApiInterceptor } from './lib/api';
import { TradeStoreProvider } from './stores/trade-store';
import { SipStoreProvider } from './stores/sip-store';
import { NavStoreProvider } from './stores/nav-store';

// Install global fetch interceptor for API routing (APK → remote server)
installApiInterceptor();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TradeStoreProvider>
      <SipStoreProvider>
        <NavStoreProvider>
          <App />
        </NavStoreProvider>
      </SipStoreProvider>
    </TradeStoreProvider>
  </StrictMode>,
);
