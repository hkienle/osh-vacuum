import { useState, useEffect } from 'react';
import { StatusLED } from './StatusLED';
import { ConsoleBox } from './ConsoleBox';
import { useWebSocket, getStoredIP } from '../hooks/useWebSocket';
import './ConnectionPanel.css';

export function ConnectionPanel() {
  const [ipAddress, setIpAddress] = useState('');
  const { connected, connect, disconnect, consoleMessages } = useWebSocket();

  useEffect(() => {
    const stored = getStoredIP();
    if (stored) {
      setIpAddress(stored);
    }
  }, []);

  const handleConnect = () => {
    if (ipAddress.trim()) {
      if (connected) {
        disconnect();
      } else {
        connect(ipAddress.trim());
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleConnect();
    }
  };

  return (
    <div className="connection-panel">
      <h2 className="panel-title">Connection</h2>
      
      <div className="connection-controls">
        <div className="ip-input-group">
          <label htmlFor="ip-input" className="input-label">
            ESP32 IP Address
          </label>
          <input
            id="ip-input"
            type="text"
            value={ipAddress}
            onChange={(e) => setIpAddress(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="192.168.1.100"
            className="ip-input"
            disabled={connected}
          />
        </div>
        
        <button
          onClick={handleConnect}
          className={`connect-button ${connected ? 'disconnect' : 'connect'}`}
        >
          {connected ? 'Disconnect' : 'Connect'}
        </button>
      </div>

      <div className="status-section">
        <StatusLED connected={connected} />
      </div>

      <div className="console-section">
        <h3 className="section-title">Console</h3>
        <ConsoleBox messages={consoleMessages} />
      </div>
    </div>
  );
}

