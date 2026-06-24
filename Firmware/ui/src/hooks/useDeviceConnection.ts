import { useCallback, useEffect, useRef, useState } from 'react';
import { BleTransport } from '../transports/bleTransport';
import { WifiTransport } from '../transports/wifiTransport';
import {
  detectUnexpectedMotorStop,
  formatNotificationForConsole,
  handleDeviceMessageNotify,
  onMotorBecameActive,
  resetDeviceNotifications,
  showDeviceNotification,
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

const RECONNECT_DELAY_MS = 3000;
const CONNECTION_TIMEOUT_MS = 10_000;
const CONNECTION_CHECK_INTERVAL_MS = 2000;

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
  const prevMessageRef = useRef<DeviceMessage | null>(null);
  const userDisconnectedRef = useRef(false);
  const reconnectTimerRef = useRef<number | null>(null);
  const lastMessageAtRef = useRef(0);
  const isReconnectingRef = useRef(false);
  const transportRef = useRef<TransportKind>(transport);
  const attemptReconnectRef = useRef<() => Promise<void>>(async () => undefined);

  useEffect(() => {
    transportRef.current = transport;
  }, [transport]);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const bleAvailability = getBleAvailability();
  const bleSupported = bleAvailability.ok;
  const bleUnavailableReason = bleAvailability.reason;

  const addConsoleMessage = useCallback((message: string) => {
    setConsoleMessages((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  }, []);

  const logNotification = useCallback(
    (notify: Parameters<typeof formatNotificationForConsole>[0]) => {
      addConsoleMessage(formatNotificationForConsole(notify));
    },
    [addConsoleMessage],
  );

  const onMessage = useCallback(
    (data: DeviceMessage) => {
      lastMessageAtRef.current = Date.now();

      const prevMessage = prevMessageRef.current;
      const prevMotorActive = prevMessage?.motor_active;

      const deviceNotify = handleDeviceMessageNotify(data);
      if (deviceNotify) {
        logNotification(deviceNotify);
      }

      const packVoltage = data.voltage ?? data.battery ?? prevMessage?.voltage;
      const unexpectedStop = detectUnexpectedMotorStop(prevMotorActive, data, {
        packVoltage: typeof packVoltage === 'number' ? packVoltage : undefined,
        seriesCells:
          typeof prevMessage?.settings?.bat_cells === 'number'
            ? prevMessage.settings.bat_cells
            : undefined,
      });
      if (unexpectedStop && showDeviceNotification(unexpectedStop)) {
        logNotification(unexpectedStop);
      }

      if (data.motor_active === true && prevMotorActive !== true) {
        onMotorBecameActive();
      }

      setLastMessage((prev) => {
        const next = mergeDeviceMessage(prev, data);
        prevMessageRef.current = next;
        return next;
      });
    },
    [logNotification],
  );

  const handleTransportConnect = useCallback(() => {
    isReconnectingRef.current = false;
    lastMessageAtRef.current = Date.now();
    clearReconnectTimer();
    setConnected(true);
  }, [clearReconnectTimer]);

  const scheduleReconnect = useCallback(
    (reason: string) => {
      if (userDisconnectedRef.current || reconnectTimerRef.current !== null) {
        return;
      }

      setConnected(false);
      addConsoleMessage(`${reason} Reconnecting in ${RECONNECT_DELAY_MS / 1000} seconds...`);
      showDeviceNotification({
        id: 'connection_lost',
        text: 'Connection lost. Reconnecting…',
        level: 'warning',
      });

      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        void attemptReconnectRef.current();
      }, RECONNECT_DELAY_MS);
    },
    [addConsoleMessage],
  );

  const handleTransportDisconnect = useCallback(
    (unexpected: boolean) => {
      setConnected(false);
      isReconnectingRef.current = false;
      if (unexpected && !userDisconnectedRef.current) {
        scheduleReconnect('Connection lost.');
      }
    },
    [scheduleReconnect],
  );

  const createTransportOptions = useCallback(
    () => ({
      onLog: addConsoleMessage,
      onMessage,
      onConnect: handleTransportConnect,
      onDisconnect: handleTransportDisconnect,
    }),
    [addConsoleMessage, handleTransportConnect, handleTransportDisconnect, onMessage],
  );

  const ensureWifi = useCallback(() => {
    if (!wifiRef.current) {
      wifiRef.current = new WifiTransport(createTransportOptions());
    }
    return wifiRef.current;
  }, [createTransportOptions]);

  const ensureBle = useCallback(() => {
    if (!bleRef.current) {
      bleRef.current = new BleTransport(createTransportOptions());
    }
    return bleRef.current;
  }, [createTransportOptions]);

  const attemptReconnect = useCallback(async () => {
    if (userDisconnectedRef.current || isReconnectingRef.current) {
      return;
    }

    isReconnectingRef.current = true;
    addConsoleMessage('Reconnecting...');

    try {
      if (transportRef.current === 'ble') {
        const ble = ensureBle();
        if (!ble.hasPairedDevice) {
          throw new Error('Choose the device again to reconnect via Bluetooth');
        }
        if (ble.connected) {
          handleTransportConnect();
          return;
        }
        await ble.reconnect();
        window.setTimeout(() => {
          if (bleRef.current?.connected) {
            void bleRef.current.send({ command: 'get_settings' });
          }
        }, 600);
        return;
      }

      const ip = lastWifiTarget.current || localStorage.getItem(IP_STORAGE_KEY) || '';
      if (!ip) {
        throw new Error('No previous WiFi target to reconnect to');
      }
      ensureWifi().connect(ip);
    } catch (error) {
      isReconnectingRef.current = false;
      const message = error instanceof Error ? error.message : String(error);
      addConsoleMessage(`Reconnect failed: ${message}`);
      const bleNeedsPicker =
        transportRef.current === 'ble' && !bleRef.current?.hasPairedDevice;
      if (bleNeedsPicker) {
        showDeviceNotification({
          id: 'ble_reconnect_manual',
          text: 'Bluetooth reconnect needs you to choose the device again.',
          level: 'info',
        });
        return;
      }
      if (!userDisconnectedRef.current && reconnectTimerRef.current === null) {
        addConsoleMessage(`Retrying in ${RECONNECT_DELAY_MS / 1000} seconds...`);
        reconnectTimerRef.current = window.setTimeout(() => {
          reconnectTimerRef.current = null;
          void attemptReconnectRef.current();
        }, RECONNECT_DELAY_MS);
      }
    }
  }, [addConsoleMessage, ensureBle, ensureWifi, handleTransportConnect]);

  useEffect(() => {
    attemptReconnectRef.current = attemptReconnect;
  }, [attemptReconnect]);

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
      userDisconnectedRef.current = false;
      clearReconnectTimer();
      isReconnectingRef.current = false;

      if (transport === 'ble') {
        if (!bleSupported) {
          addConsoleMessage(bleUnavailableReason || 'Web Bluetooth is not available');
          return;
        }
        const ble = ensureBle();
        await ble.connect();
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
    },
    [
      addConsoleMessage,
      bleSupported,
      bleUnavailableReason,
      clearReconnectTimer,
      ensureBle,
      ensureWifi,
      sendMessage,
      transport,
    ],
  );

  const disconnect = useCallback(() => {
    userDisconnectedRef.current = true;
    clearReconnectTimer();
    isReconnectingRef.current = false;
    wifiRef.current?.disconnect();
    bleRef.current?.disconnect();
    resetDeviceNotifications();
    lastMessageAtRef.current = 0;
    setConnected(false);
  }, [clearReconnectTimer]);

  const reconnect = useCallback(() => {
    userDisconnectedRef.current = false;
    clearReconnectTimer();
    void attemptReconnect();
  }, [attemptReconnect, clearReconnectTimer]);

  useEffect(() => {
    if (!connected) {
      resetDeviceNotifications();
      prevMessageRef.current = null;
    }
  }, [connected]);

  useEffect(() => {
    if (!connected) return;
    const heartbeatMs = transport === 'ble' ? 3000 : 1000;
    const heartbeat = window.setInterval(() => {
      sendMessage({ command: 'heartbeat' });
    }, heartbeatMs);
    return () => window.clearInterval(heartbeat);
  }, [connected, sendMessage, transport]);

  useEffect(() => {
    if (!connected || userDisconnectedRef.current) {
      return;
    }

    const interval = window.setInterval(() => {
      if (userDisconnectedRef.current || !lastMessageAtRef.current) {
        return;
      }

      const elapsed = Date.now() - lastMessageAtRef.current;
      if (elapsed < CONNECTION_TIMEOUT_MS) {
        return;
      }

      addConsoleMessage(
        `No data received for ${CONNECTION_TIMEOUT_MS / 1000} seconds. Dropping connection…`,
      );

      if (transportRef.current === 'ble') {
        bleRef.current?.dropConnection();
      } else {
        wifiRef.current?.dropConnection();
      }
    }, CONNECTION_CHECK_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [addConsoleMessage, connected]);

  useEffect(() => {
    if (transport !== 'wifi') return;
    const interval = window.setInterval(() => {
      const isOpen = wifiRef.current?.connected ?? false;
      if (!isOpen && connected) {
        setConnected(false);
      }
    }, 500);
    return () => window.clearInterval(interval);
  }, [connected, transport]);

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
      clearReconnectTimer();
      wifiRef.current?.dispose();
      bleRef.current?.dispose();
    };
  }, [clearReconnectTimer]);

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
