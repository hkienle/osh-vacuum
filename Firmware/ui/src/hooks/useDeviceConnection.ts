import { useCallback, useEffect, useRef, useState } from 'react';
import { BleTransport } from '../transports/bleTransport';
import { WifiTransport } from '../transports/wifiTransport';
import {
  handleDeviceMessageNotify,
  resetDeviceNotifications,
} from '../services/deviceNotifications';
import {
  IP_STORAGE_KEY,
  TRANSPORT_STORAGE_KEY,
  defaultTransport,
  effectiveTransport,
  getBleAvailability,
  isEmbeddedDeviceUi,
  isHostedDeviceUi,
  DEFAULT_VACUUM_HOST,
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
    const initial =
      stored === 'ble' || stored === 'wifi' ? (stored as TransportKind) : defaultTransport();
    return effectiveTransport(initial);
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
    handleDeviceMessageNotify(data);
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
    const resolved = effectiveTransport(next);
    localStorage.setItem(TRANSPORT_STORAGE_KEY, resolved);
    setTransportState(resolved);
  }, []);

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
        window.setTimeout(() => {
          sendMessage({ command: 'get_settings' });
        }, 600);
        return;
      }

      let raw = target?.trim();
      if (!raw) {
        raw =
          lastWifiTarget.current ||
          localStorage.getItem(IP_STORAGE_KEY) ||
          (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
            ? window.location.hostname
            : '');
      }
      const ip = raw.trim() || DEFAULT_VACUUM_HOST;

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
    [addConsoleMessage, bleSupported, bleUnavailableReason, ensureBle, ensureWifi, sendMessage, transport],
  );

  const disconnect = useCallback(() => {
    wifiRef.current?.disconnect();
    bleRef.current?.disconnect();
    resetDeviceNotifications();
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

  useEffect(() => {
    if (!connected) {
      resetDeviceNotifications();
    }
  }, [connected]);

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
