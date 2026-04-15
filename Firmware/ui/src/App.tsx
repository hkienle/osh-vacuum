import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { ControlPanel } from './components/ControlPanel';
import { BatteryTestModal } from './components/BatteryTestModal';
import './App.css';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [testModalOpen, setTestModalOpen] = useState(false);

  return (
    <div className="app">
      <div className="app-container">
        <header className="app-header">
          <button 
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          <button
            className="battery-test-toggle"
            onClick={() => setTestModalOpen(true)}
            aria-label="Open battery test modal"
          >
            Battery Test
          </button>
          <h1 className="app-title">OSH Vacuum Controller</h1>
        </header>
        <main className="app-main">
          <ControlPanel />
        </main>
      </div>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <BatteryTestModal isOpen={testModalOpen} onClose={() => setTestModalOpen(false)} />
    </div>
  );
}

export default App;
