import { useCallback, useEffect, useRef, useState } from 'react';
import { BleTransport } from '../transports/bleTransport';
import { WifiTransport } from '../transports/wifiTransport';
import {
  IP_STORAGE_KEY,
  TRANSPORT_STORAGE_KEY,
  defaultTransport,
  getBleAvailability,
  isEmbeddedDeviceUi,
  isHostedDeviceUi,
  mergeDeviceMessage,
  type DeviceConnectionState,
  type DeviceMessage,
  type TransportKind,
} from '../types/deviceTransport';

export function useDeviceConnection(): DeviceConnectionState {
  const [connected, setConnected] = useState(false);
  const [transport, setTransportState] = useState<TransportKind>(() => {
    if (isEmbeddedDeviceUi()) {
      return 'wifi';
    }
    const stored = localStorage.getItem(TRANSPORT_STORAGE_KEY);
    if (stored === 'ble' || stored === 'wifi') return stored;
    return defaultTransport();
  });
  const [lastMessage, setLastMessage] = useState<DeviceMessage | null>(null);
  const [consoleMessages, setConsoleMessages] = useState<string[]>([]);

  const wifiRef = useRef<WifiTransport | null>(null);
  const bleRef = useRef<BleTransport | null>(null);
  const lastWifiTarget = useRef('');

  const bleAvailability = getBleAvailability();
  const bleSupported = bleAvailability.ok;
  const bleUnavailableReason = bleAvailability.reason;

  const addConsoleMessage = useCallback((message: string) => {
    setConsoleMessages((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  }, []);

  const onMessage = useCallback((data: DeviceMessage) => {
    setLastMessage((prev) => mergeDeviceMessage(prev, data));
  }, []);

  const ensureWifi = useCallback(() => {
    if (!wifiRef.current) {
      wifiRef.current = new WifiTransport({ onLog: addConsoleMessage, onMessage });
    }
    return wifiRef.current;
  }, [addConsoleMessage, onMessage]);

  const ensureBle = useCallback(() => {
    if (!bleRef.current) {
      bleRef.current = new BleTransport({ onLog: addConsoleMessage, onMessage });
    }
    return bleRef.current;
  }, [addConsoleMessage, onMessage]);

  const setTransport = useCallback((next: TransportKind) => {
    localStorage.setItem(TRANSPORT_STORAGE_KEY, next);
    setTransportState(next);
  }, []);

  const connect = useCallback(
    async (target?: string) => {
      if (transport === 'ble') {
        if (!bleSupported) {
          addConsoleMessage(bleUnavailableReason || 'Web Bluetooth is not available');
          return;
        }
        const ble = ensureBle();
        await ble.connect();
        setConnected(true);
        return;
      }

      const ip =
        target ??
        (lastWifiTarget.current ||
          localStorage.getItem(IP_STORAGE_KEY) ||
          (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
            ? window.location.hostname
            : ''));

      if (!ip) {
        addConsoleMessage('WiFi connect needs a device IP address');
        return;
      }

      lastWifiTarget.current = ip;
      localStorage.setItem(IP_STORAGE_KEY, ip);
      ensureWifi().connect(ip);

      const poll = window.setInterval(() => {
        const isOpen = wifiRef.current?.connected ?? false;
        setConnected(isOpen);
        if (isOpen) {
          window.clearInterval(poll);
        }
      }, 200);
      window.setTimeout(() => window.clearInterval(poll), 5000);
    },
    [addConsoleMessage, bleSupported, bleUnavailableReason, ensureBle, ensureWifi, transport],
  );

  const disconnect = useCallback(() => {
    wifiRef.current?.disconnect();
    bleRef.current?.disconnect();
    setConnected(false);
  }, []);

  const reconnect = useCallback(() => {
    if (transport === 'ble') {
      void connect();
      return;
    }
    const ip = lastWifiTarget.current || localStorage.getItem(IP_STORAGE_KEY) || '';
    if (ip) {
      void connect(ip);
    } else {
      addConsoleMessage('No previous WiFi target to reconnect to');
    }
  }, [addConsoleMessage, connect, transport]);

  const sendMessage = useCallback(
    (message: object) => {
      if (transport === 'ble') {
        void bleRef.current?.send(message);
        return;
      }
      wifiRef.current?.send(message);
    },
    [transport],
  );

  useEffect(() => {
    if (!connected) return;
    const heartbeat = window.setInterval(() => {
      sendMessage({ command: 'heartbeat' });
    }, 1000);
    return () => window.clearInterval(heartbeat);
  }, [connected, sendMessage]);

  useEffect(() => {
    if (transport !== 'wifi') return;
    const interval = window.setInterval(() => {
      setConnected(wifiRef.current?.connected ?? false);
    }, 500);
    return () => window.clearInterval(interval);
  }, [transport]);

  useEffect(() => {
    if (transport !== 'ble') return;
    const interval = window.setInterval(() => {
      setConnected(bleRef.current?.connected ?? false);
    }, 500);
    return () => window.clearInterval(interval);
  }, [transport]);

  // Auto-connect via WiFi when UI is served from the device (http://osh-vac.local).
  useEffect(() => {
    if (transport !== 'wifi' || isHostedDeviceUi()) {
      return;
    }
    const hostname = window.location.hostname;
    const target =
      hostname !== 'localhost' && hostname !== '127.0.0.1'
        ? hostname
        : localStorage.getItem(IP_STORAGE_KEY) ?? '';

    if (!target) {
      return;
    }

    const timer = window.setTimeout(() => {
      addConsoleMessage('Auto-connecting via WiFi...');
      void connect(target);
    }, 400);

    return () => window.clearTimeout(timer);
    // Mount-only: same behavior as legacy useWebSocket auto-connect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      wifiRef.current?.dispose();
      bleRef.current?.dispose();
    };
  }, []);

  return {
    connected,
    transport,
    connect,
    disconnect,
    reconnect,
    sendMessage,
    lastMessage,
    consoleMessages,
    bleSupported,
    bleUnavailableReason,
    setTransport,
  };
}

export function getStoredIP(): string {
  return localStorage.getItem(IP_STORAGE_KEY) || '';
}

// Backward-compatible aliases for existing imports.
export type WebSocketMessage = DeviceMessage;
export type UseWebSocketReturn = DeviceConnectionState;
