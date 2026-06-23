import type { SettingsSchema, SettingsValues } from '../types/settings';

export type TransportKind = 'ble' | 'wifi';

export type DeviceNotifyLevel = 'info' | 'warning' | 'error';

export interface DeviceNotify {
  id: string;
  text: string;
  level: DeviceNotifyLevel;
}

export type WiFiRole = 'ap' | 'sta' | 'none';

export interface DeviceMessage {
  rpm?: number;
  temp?: number;
  battery?: number;
  battery_soc?: number;
  temperature?: number;
  voltage?: number;
  speed?: number;
  motor_active?: boolean;
  wifi_role?: WiFiRole;
  ap_ssid?: string;
  schema?: SettingsSchema;
  settings?: SettingsValues;
  motor_type?: number;
  ack?: string;
  ok?: boolean;
  key?: string;
  notify?: DeviceNotify | Record<string, unknown>;
  message?: string;
  notify_id?: string;
  level?: DeviceNotifyLevel;
  [key: string]: unknown;
}

export interface DeviceConnectionState {
  connected: boolean;
  transport: TransportKind;
  connect: (target?: string) => Promise<void> | void;
  disconnect: () => void;
  reconnect: () => void;
  sendMessage: (message: object) => void;
  lastMessage: DeviceMessage | null;
  consoleMessages: string[];
  bleSupported: boolean;
  bleUnavailableReason: string;
  setTransport: (transport: TransportKind) => void;
}

export const TRANSPORT_STORAGE_KEY = 'oshvac_transport';
export const IP_STORAGE_KEY = 'esp32_ip_address';
export const DEFAULT_VACUUM_HOST = 'caznic.local';

export const NUS_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
export const NUS_RX_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
export const NUS_TX_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

export const WS_PROXY_PATH = '/device-ws';

export function normalizeDeviceHost(host: string): string {
  return host
    .trim()
    .replace(/^wss?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/:81$/, '')
    .split(':')[0];
}

/**
 * Embedded UI (http://osh-vac.local): direct ws://device:81
 * Hosted UI (separate server): same-origin /device-ws proxy → device:81
 */
export function buildDeviceWebSocketUrl(deviceHost: string): string {
  const host = normalizeDeviceHost(deviceHost);
  if (typeof window === 'undefined' || isEmbeddedDeviceUi()) {
    return `ws://${host}:81`;
  }
  const params = new URLSearchParams({ target: `${host}:81` });
  const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProto}//${window.location.host}${WS_PROXY_PATH}?${params.toString()}`;
}

export function isHostedDeviceUi(): boolean {
  return typeof window !== 'undefined' && !isEmbeddedDeviceUi();
}

export interface BleAvailability {
  ok: boolean;
  reason: string;
}

/** Safari (macOS/iOS) does not implement the Web Bluetooth API. */
export function isSafariBrowser(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  const ua = navigator.userAgent;
  return /Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR|Firefox/i.test(ua);
}

/** Why Web Bluetooth may be unavailable (browser, secure context, etc.). */
export function getBleAvailability(): BleAvailability {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return { ok: false, reason: 'Not running in a browser.' };
  }
  if (!('bluetooth' in navigator)) {
    if (!window.isSecureContext) {
      return {
        ok: false,
        reason: `Web Bluetooth requires HTTPS or localhost. You opened ${window.location.origin} — use https://… or http://localhost:8080.`,
      };
    }
    if (isSafariBrowser()) {
      return {
        ok: false,
        reason: 'Safari does not support Web Bluetooth. Use WiFi here, or open this app in Chrome or Edge for Bluetooth pairing.',
      };
    }
    return {
      ok: false,
      reason: 'This browser has no Web Bluetooth. Use Chrome or Edge on desktop/Android, or connect via WiFi.',
    };
  }
  return { ok: true, reason: '' };
}

export function isEmbeddedDeviceUi(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const hostname = window.location.hostname;
  return (
    window.location.protocol === 'http:' &&
    hostname !== 'localhost' &&
    hostname !== '127.0.0.1'
  );
}

export function defaultTransport(): TransportKind {
  if (isEmbeddedDeviceUi()) {
    return 'wifi';
  }
  const fromEnv = import.meta.env.VITE_DEFAULT_TRANSPORT;
  if (fromEnv === 'wifi' || fromEnv === 'ble') {
    return fromEnv;
  }
  // Hosted app (not served by ESP): WiFi via proxy until BLE is production-ready.
  return 'wifi';
}

export function mergeDeviceMessage(prev: DeviceMessage | null, data: DeviceMessage): DeviceMessage {
  const next: DeviceMessage = { ...(prev ?? {}), ...data };
  next.temperature = data.temp ?? data.temperature ?? prev?.temperature;
  next.voltage = data.battery ?? data.voltage ?? prev?.voltage;
  if ('rpm' in data) next.rpm = data.rpm;
  if ('motor_active' in data) next.motor_active = data.motor_active;
  if ('speed' in data && data.speed !== undefined) next.speed = data.speed;
  if ('battery_soc' in data && data.battery_soc !== undefined) next.battery_soc = data.battery_soc;
  if ('schema' in data && data.schema) next.schema = data.schema;
  else if (prev?.schema) next.schema = prev.schema;
  if ('settings' in data && data.settings) next.settings = { ...(prev?.settings ?? {}), ...data.settings };
  else if (prev?.settings) next.settings = prev.settings;
  if ('motor_type' in data && typeof data.motor_type === 'number') next.motor_type = data.motor_type;
  else if (prev?.motor_type !== undefined) next.motor_type = prev.motor_type;
  if ('wifi_role' in data && typeof data.wifi_role === 'string') next.wifi_role = data.wifi_role as WiFiRole;
  else if (prev?.wifi_role) next.wifi_role = prev.wifi_role;
  if ('ap_ssid' in data && typeof data.ap_ssid === 'string') next.ap_ssid = data.ap_ssid;
  else if (prev?.ap_ssid) next.ap_ssid = prev.ap_ssid;
  return next;
}
