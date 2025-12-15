import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import type { UseWebSocketReturn } from '../hooks/useWebSocket';

const WebSocketContext = createContext<UseWebSocketReturn | undefined>(undefined);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const websocket = useWebSocket();
  return (
    <WebSocketContext.Provider value={websocket}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketContext(): UseWebSocketReturn {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
}

