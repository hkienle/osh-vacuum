import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { ControlPanel } from './components/ControlPanel';
import { BatteryTestModal } from './components/BatteryTestModal';
import { SettingsModal } from './components/settings/SettingsModal';
import { IconButton } from './components/ui/IconButton';
import { Button } from './components/ui/Button';
import './App.css';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="app">
      <div className="app-container">
        <header className="app-header">
          <IconButton className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} label="Toggle sidebar">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </IconButton>
          <Button className="battery-test-toggle" onClick={() => setTestModalOpen(true)} aria-label="Open battery test modal">
            Battery Test
          </Button>
          <Button className="battery-test-toggle" onClick={() => setSettingsOpen(true)} aria-label="Open settings modal">
            Settings
          </Button>
          <h1 className="app-title">OSH Vacuum Controller</h1>
        </header>
        <main className="app-main">
          <ControlPanel />
        </main>
      </div>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <BatteryTestModal isOpen={testModalOpen} onClose={() => setTestModalOpen(false)} />
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

export default App;
