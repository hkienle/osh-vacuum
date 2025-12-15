import { useState, useEffect, useRef, useCallback } from 'react';

export interface WebSocketMessage {
  rpm?: number;
  temp?: number;
  battery?: number;
  temperature?: number; // For backward compatibility
  voltage?: number; // For backward compatibility
  speed?: number; // Speed setting (0-100%)
  motor_active?: boolean; // Motor state (true = running, false = stopped)
  [key: string]: unknown;
}

export interface UseWebSocketReturn {
  connected: boolean;
  connect: (ip: string) => void;
  disconnect: () => void;
  reconnect: () => void;
  sendMessage: (message: object) => void;
  lastMessage: WebSocketMessage | null;
  consoleMessages: string[];
}

const IP_STORAGE_KEY = 'esp32_ip_address';

export function useWebSocket(): UseWebSocketReturn {
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [consoleMessages, setConsoleMessages] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const reconnectDelay = 3000; // 3 seconds
  const lastIPRef = useRef<string>('');

  const addConsoleMessage = useCallback((message: string) => {
    setConsoleMessages((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  }, []);

  const connect = useCallback((ip: string) => {
    // Clear any pending reconnect attempts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // Close existing connection if any (including CONNECTING state)
    if (wsRef.current) {
      // Only close if not already open (to avoid unnecessary disconnects)
      if (wsRef.current.readyState !== WebSocket.OPEN) {
        // Close the old connection - onclose handler will clean up
        const oldWs = wsRef.current;
        oldWs.close();
        // Clear ref immediately so onclose handler knows it's not current
        wsRef.current = null;
      } else {
        // Already connected, no need to reconnect
        return;
      }
    }

    // Store IP for reconnection
    lastIPRef.current = ip;
    reconnectAttemptsRef.current = 0;
    
    addConsoleMessage(`Trying to connect to ${ip}...`);
    // Ensure we start with disconnected state
    setConnected(false);

    try {
      const wsUrl = `ws://${ip}:81`;
      addConsoleMessage(`Connecting to ${wsUrl}...`);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      let wasConnected = false;
      
      // Log readyState changes for debugging (only on state changes)
      const logReadyState = (state: string) => {
        const states = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];
        // Only log important state changes, not every event
        if (state === 'Open' || state === 'Close') {
          addConsoleMessage(`WebSocket state: ${state} (${states[ws.readyState] || ws.readyState})`);
        }
      };

      ws.onopen = () => {
        wasConnected = true;
        reconnectAttemptsRef.current = 0; // Reset reconnect attempts on successful connection
        
        // Use functional update to ensure state is set correctly
        setConnected((prev) => {
          if (!prev) {
            // Only log if we weren't already connected
            addConsoleMessage('Connected to ESP32');
            localStorage.setItem(IP_STORAGE_KEY, ip);
            logReadyState('Open');
          }
          return true;
        });
      };

      ws.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data);
          // Normalize field names: map battery -> voltage, temp -> temperature
          const normalizedData: WebSocketMessage = {
            ...data,
            temperature: data.temp ?? data.temperature,
            voltage: data.battery ?? data.voltage,
          };
          // Merge with existing lastMessage to preserve all fields
          // Important: Always update motor_active and speed when present (even if false/0)
          setLastMessage((prev) => {
            const updated: WebSocketMessage = {
              ...prev,
              // Preserve normalized fields
              temperature: normalizedData.temperature ?? prev?.temperature,
              voltage: normalizedData.voltage ?? prev?.voltage,
              rpm: normalizedData.rpm ?? prev?.rpm,
            };
            
            // Always update motor control fields when present in the message (check if key exists in original data)
            // This ensures false/0 values are properly updated
            if ('motor_active' in data) {
              updated.motor_active = data.motor_active;
            } else if (prev) {
              updated.motor_active = prev.motor_active;
            }
            
            if ('speed' in data && data.speed !== undefined) {
              updated.speed = data.speed;
            } else if (prev) {
              updated.speed = prev.speed;
            }
            
            return updated;
          });
          addConsoleMessage(`Received: ${event.data}`);
        } catch (error) {
          addConsoleMessage(`Error parsing message: ${event.data}`);
        }
      };

      ws.onerror = (error) => {
        // Log error details for debugging
        console.error('WebSocket error:', error);
        // Note: Error event doesn't provide much detail, wait for onclose for more info
      };

      ws.onclose = (event) => {
        const wasCurrentConnection = wsRef.current === ws;
        logReadyState('Close');
        
        // Only clear the ref and update state if this is still the current connection
        if (wasCurrentConnection) {
          wsRef.current = null;
          setConnected(false);
        }
        
        if (wasConnected) {
          // Was connected, so this is a clean disconnect
          addConsoleMessage(`Disconnected from ESP32 (code: ${event.code}${event.reason ? ', reason: ' + event.reason : ''})`);
          
          // Auto-reconnect if it was an unexpected disconnect (not user-initiated)
          if (event.code !== 1000 && lastIPRef.current) {
            addConsoleMessage(`Attempting to reconnect in ${reconnectDelay / 1000} seconds...`);
            reconnectAttemptsRef.current = 0;
            reconnectTimeoutRef.current = window.setTimeout(() => {
              if (lastIPRef.current && !wsRef.current) {
                connect(lastIPRef.current);
              }
            }, reconnectDelay);
          }
        } else if (wasCurrentConnection) {
          // Never connected, so this is a connection failure
          const closeReason = event.reason || 'No reason provided';
          if (event.code === 1006) {
            addConsoleMessage(`Connection failed: Unable to reach ${ip}:81 (abnormal closure, code 1006).`);
            addConsoleMessage(`Possible causes: ESP32 not running, wrong IP, firewall blocking, or network issue.`);
            addConsoleMessage(`Note: If Postman works, check browser console for more details.`);
          } else if (event.code === 1000) {
            addConsoleMessage(`Connection closed normally (code: ${event.code})`);
          } else {
            addConsoleMessage(`Connection failed: Error code ${event.code}${closeReason ? ', reason: ' + closeReason : ''}.`);
          }
        }
      };
    } catch (error) {
      addConsoleMessage(`Failed to connect: ${error}`);
      setConnected(false);
    }
  }, [addConsoleMessage]);

  const disconnect = useCallback(() => {
    // Clear any pending reconnect attempts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    lastIPRef.current = ''; // Clear stored IP to prevent auto-reconnect
    
    if (wsRef.current) {
      // Close with a normal closure code - let onclose handler clean up
      wsRef.current.close(1000, 'User disconnected');
      // Don't set wsRef.current = null here - let onclose handler do it
    }
    // Still set connected to false immediately for UI responsiveness
    setConnected(false);
    addConsoleMessage('Disconnecting...');
  }, [addConsoleMessage]);

  const reconnect = useCallback(() => {
    if (lastIPRef.current) {
      addConsoleMessage('Reconnecting...');
      reconnectAttemptsRef.current = 0;
      connect(lastIPRef.current);
    } else {
      const storedIP = getStoredIP();
      if (storedIP) {
        addConsoleMessage('Reconnecting to last known IP...');
        reconnectAttemptsRef.current = 0;
        connect(storedIP);
      } else {
        addConsoleMessage('No previous connection to reconnect to');
      }
    }
  }, [connect, addConsoleMessage]);

  const sendMessage = useCallback((message: object) => {
    if (!wsRef.current) {
      addConsoleMessage('Cannot send: WebSocket is null');
      return;
    }
    
    const readyState = wsRef.current.readyState;
    if (readyState === WebSocket.OPEN) {
      const jsonMessage = JSON.stringify(message);
      wsRef.current.send(jsonMessage);
      addConsoleMessage(`Sent: ${jsonMessage}`);
    } else {
      const stateNames = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];
      addConsoleMessage(`Cannot send: WebSocket not open (state: ${stateNames[readyState] || readyState})`);
    }
  }, [addConsoleMessage]);

  // Heartbeat: send heartbeat command once per second when connected
  useEffect(() => {
    if (!connected) {
      return;
    }

    const heartbeatInterval = setInterval(() => {
      sendMessage({ command: 'heartbeat' });
    }, 1000);

    return () => {
      clearInterval(heartbeatInterval);
    };
  }, [connected, sendMessage]);

  // Auto-connect on page load if we have a stored IP
  useEffect(() => {
    const storedIP = getStoredIP();
    if (storedIP && !connected && !wsRef.current) {
      // Small delay to ensure everything is initialized
      const autoConnectTimer = setTimeout(() => {
        addConsoleMessage('Auto-connecting to last known IP...');
        connect(storedIP);
      }, 500);
      
      return () => clearTimeout(autoConnectTimer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount - connect and addConsoleMessage are stable

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  return {
    connected,
    connect,
    disconnect,
    reconnect,
    sendMessage,
    lastMessage,
    consoleMessages,
  };
}

export function getStoredIP(): string {
  return localStorage.getItem(IP_STORAGE_KEY) || '';
}

