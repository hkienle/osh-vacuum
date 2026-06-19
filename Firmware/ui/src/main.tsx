import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { DeviceConnectionProvider } from './contexts/DeviceConnectionContext.tsx';
import { ThemeProvider } from './components/theme/ThemeProvider.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <DeviceConnectionProvider>
        <App />
      </DeviceConnectionProvider>
    </ThemeProvider>
  </StrictMode>,
);
