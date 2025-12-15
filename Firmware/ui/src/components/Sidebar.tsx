import { useMemo } from 'react';
import { StatusLED } from './StatusLED';
import { ConsoleBox } from './ConsoleBox';
import { useWebSocketContext } from '../contexts/WebSocketContext';
import './Sidebar.css';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { connected, connect, disconnect, reconnect, consoleMessages } = useWebSocketContext();

  // Automatically use the current hostname (or localhost as fallback)
  const targetHost = useMemo(() => {
    const hostname = window.location.hostname;
    // Use localhost if accessed via localhost/127.0.0.1, otherwise use the actual hostname
    return (hostname === 'localhost' || hostname === '127.0.0.1') ? 'localhost' : hostname;
  }, []);

  const handleConnect = () => {
    if (connected) {
      disconnect();
    } else {
      connect(targetHost);
    }
  };

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      <div className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2 className="sidebar-title">Connection</h2>
          <button className="sidebar-close" onClick={onClose}>×</button>
        </div>
        
        <div className="sidebar-content">
          <div className="connection-controls">
            <button
              key={connected ? 'connected' : 'disconnected'}
              onClick={handleConnect}
              className={`connect-button ${connected ? 'disconnect' : 'connect'}`}
            >
              {connected ? 'Disconnect' : 'Connect'}
            </button>
            {!connected && (
              <button
                onClick={reconnect}
                className="connect-button connect"
                style={{ marginTop: '12px' }}
              >
                Reconnect
              </button>
            )}
          </div>

          <div className="status-section">
            <StatusLED connected={connected} />
          </div>

          <div className="console-section">
            <h3 className="section-title">Console</h3>
            <ConsoleBox messages={consoleMessages} />
          </div>
        </div>
      </div>
    </>
  );
}

