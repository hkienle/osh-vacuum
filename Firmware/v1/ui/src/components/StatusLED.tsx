import './StatusLED.css';

interface StatusLEDProps {
  connected: boolean;
}

export function StatusLED({ connected }: StatusLEDProps) {
  return (
    <div className="status-led-container">
      <div className={`status-led ${connected ? 'connected' : 'disconnected'}`} />
      <span className="status-text">{connected ? 'Connected' : 'Disconnected'}</span>
    </div>
  );
}

