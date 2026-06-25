import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useDeviceConnection } from '../hooks/useDeviceConnection';
import type { DeviceConnectionState } from '../types/deviceTransport';

const DeviceConnectionContext = createContext<DeviceConnectionState | undefined>(undefined);

export function DeviceConnectionProvider({ children }: { children: ReactNode }) {
  const connection = useDeviceConnection();
  return <DeviceConnectionContext.Provider value={connection}>{children}</DeviceConnectionContext.Provider>;
}

export function useDeviceConnectionContext(): DeviceConnectionState {
  const context = useContext(DeviceConnectionContext);
  if (context === undefined) {
    throw new Error('useDeviceConnectionContext must be used within a DeviceConnectionProvider');
  }
  return context;
}

/** @deprecated Use useDeviceConnectionContext */
export const WebSocketProvider = DeviceConnectionProvider;

/** @deprecated Use useDeviceConnectionContext */
export function useWebSocketContext(): DeviceConnectionState {
  return useDeviceConnectionContext();
}
