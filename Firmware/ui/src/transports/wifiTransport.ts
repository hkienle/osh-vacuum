import type { DeviceMessage } from '../types/deviceTransport';
import { buildDeviceWebSocketUrl, mergeDeviceMessage } from '../types/deviceTransport';

type LogFn = (message: string) => void;
type MessageFn = (data: DeviceMessage) => void;

export interface WifiTransportOptions {
  onLog: LogFn;
  onMessage: MessageFn;
}

export class WifiTransport {
  private ws: WebSocket | null = null;
  private lastIp = '';
  private reconnectTimer: number | null = null;
  private readonly reconnectDelay = 3000;
  private readonly options: WifiTransportOptions;

  constructor(options: WifiTransportOptions) {
    this.options = options;
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  connect(ip: string): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.lastIp = ip;
    const wsUrl = buildDeviceWebSocketUrl(ip);
    this.options.onLog(`Connecting to ${wsUrl}...`);

    const ws = new WebSocket(wsUrl);
    this.ws = ws;
    let wasConnected = false;

    ws.onopen = () => {
      wasConnected = true;
      this.options.onLog('Connected via WiFi');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(String(event.data)) as DeviceMessage;
        this.options.onMessage(data);
        this.options.onLog(`Received: ${event.data}`);
      } catch {
        this.options.onLog(`Error parsing message: ${event.data}`);
      }
    };

    ws.onclose = (event) => {
      const wasCurrent = this.ws === ws;
      if (wasCurrent) {
        this.ws = null;
      }
      if (wasConnected) {
        this.options.onLog(`Disconnected (code ${event.code})`);
        if (event.code !== 1000 && this.lastIp) {
          this.reconnectTimer = window.setTimeout(() => this.connect(this.lastIp), this.reconnectDelay);
        }
      } else if (wasCurrent) {
        this.options.onLog(`Connection failed (code ${event.code})`);
      }
    };
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.lastIp = '';
    this.ws?.close(1000, 'User disconnected');
    this.ws = null;
    this.options.onLog('Disconnecting WiFi...');
  }

  reconnect(): void {
    if (this.lastIp) {
      this.connect(this.lastIp);
    }
  }

  send(message: object): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.options.onLog('Cannot send: WiFi transport not connected');
      return;
    }
    const json = JSON.stringify(message);
    this.ws.send(json);
    this.options.onLog(`Sent: ${json}`);
  }

  dispose(): void {
    this.disconnect();
  }
}

export function parseIncomingJson(raw: string, prev: DeviceMessage | null): DeviceMessage {
  const data = JSON.parse(raw) as DeviceMessage;
  return mergeDeviceMessage(prev, data);
}
