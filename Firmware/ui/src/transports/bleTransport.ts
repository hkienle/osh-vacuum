import {
  NUS_RX_UUID,
  NUS_SERVICE_UUID,
  NUS_TX_UUID,
  mergeDeviceMessage,
  type DeviceMessage,
} from '../types/deviceTransport';

type LogFn = (message: string) => void;
type MessageFn = (data: DeviceMessage) => void;

export interface BleTransportOptions {
  onLog: LogFn;
  onMessage: MessageFn;
  onConnect?: () => void;
  onDisconnect?: (unexpected: boolean) => void;
}

interface FragmentAssembly {
  total: number;
  parts: Map<number, Uint8Array>;
}

export class BleTransport {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private rxCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private fragmentAssembly: FragmentAssembly | null = null;
  private disconnectListenerAttached = false;
  private userInitiatedDisconnect = false;
  private readonly options: BleTransportOptions;

  constructor(options: BleTransportOptions) {
    this.options = options;
  }

  get connected(): boolean {
    return this.device?.gatt?.connected ?? false;
  }

  get hasPairedDevice(): boolean {
    return this.device !== null;
  }

  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  async connect(): Promise<void> {
    if (!BleTransport.isSupported()) {
      throw new Error('Web Bluetooth is not supported in this browser');
    }

    const bluetooth = navigator.bluetooth;
    if (!bluetooth) {
      throw new Error('Web Bluetooth is not available');
    }

    this.userInitiatedDisconnect = false;
    this.options.onLog('Requesting BLE device (osh-vac)...');
    this.device = await bluetooth.requestDevice({
      filters: [{ services: [NUS_SERVICE_UUID] }],
      optionalServices: [NUS_SERVICE_UUID],
    });

    this.options.onLog(`Selected ${this.device.name ?? 'device'}`);
    this.attachDisconnectListener();
    await this.setupGattConnection();
    this.options.onLog('Connected via Bluetooth');
    this.options.onConnect?.();
  }

  async reconnect(): Promise<void> {
    if (!this.device) {
      throw new Error('No BLE device to reconnect to');
    }
    this.userInitiatedDisconnect = false;
    await this.setupGattConnection();
    this.options.onLog('Reconnected via Bluetooth');
    this.options.onConnect?.();
  }

  /** Drop GATT without clearing the device (e.g. connection timeout). */
  dropConnection(): void {
    this.fragmentAssembly = null;
    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.server = null;
    this.rxCharacteristic = null;
  }

  disconnect(): void {
    this.userInitiatedDisconnect = true;
    this.fragmentAssembly = null;
    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.device = null;
    this.server = null;
    this.rxCharacteristic = null;
    this.disconnectListenerAttached = false;
    this.options.onLog('Disconnecting BLE...');
  }

  private attachDisconnectListener(): void {
    if (!this.device || this.disconnectListenerAttached) {
      return;
    }
    this.device.addEventListener('gattserverdisconnected', this.handleGattDisconnected);
    this.disconnectListenerAttached = true;
  }

  private handleGattDisconnected = (): void => {
    this.options.onLog('BLE disconnected');
    this.fragmentAssembly = null;
    this.server = null;
    this.rxCharacteristic = null;
    if (!this.userInitiatedDisconnect) {
      this.options.onDisconnect?.(true);
    }
    this.userInitiatedDisconnect = false;
  };

  private async setupGattConnection(): Promise<void> {
    if (!this.device?.gatt) {
      throw new Error('BLE device has no GATT server');
    }

    this.server = await this.device.gatt.connect();
    const service = await this.server.getPrimaryService(NUS_SERVICE_UUID);
    this.rxCharacteristic = await service.getCharacteristic(NUS_RX_UUID);
    const txCharacteristic = await service.getCharacteristic(NUS_TX_UUID);

    await txCharacteristic.startNotifications();
    txCharacteristic.addEventListener('characteristicvaluechanged', (event: Event) => {
      const target = event.target as BluetoothRemoteGATTCharacteristic;
      const value = target.value;
      if (!value) return;
      this.handleNotification(value);
    });
  }

  async send(message: object): Promise<void> {
    if (!this.rxCharacteristic) {
      this.options.onLog('Cannot send: BLE not connected');
      return;
    }
    const json = `${JSON.stringify(message)}\n`;
    const data = new TextEncoder().encode(json);
    await this.writeInChunks(data);
    this.options.onLog(`Sent: ${json.trim()}`);
  }

  private async writeInChunks(data: Uint8Array): Promise<void> {
    const chunkSize = 180;
    for (let offset = 0; offset < data.length; offset += chunkSize) {
      const chunk = data.slice(offset, offset + chunkSize);
      await this.rxCharacteristic!.writeValueWithoutResponse(chunk);
    }
  }

  private handleNotification(value: DataView): void {
    const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    if (bytes.length >= 4 && bytes[0] === 79 && bytes[1] === 86) {
      this.handleFragment(bytes[2], bytes[3], bytes.slice(4));
      return;
    }

    const text = new TextDecoder().decode(bytes);
    this.dispatchJson(text);
  }

  private handleFragment(index: number, total: number, payload: Uint8Array): void {
    if (!this.fragmentAssembly || this.fragmentAssembly.total !== total) {
      this.fragmentAssembly = { total, parts: new Map() };
    }
    this.fragmentAssembly.parts.set(index, payload);
    if (this.fragmentAssembly.parts.size < total) {
      return;
    }

    const ordered: Uint8Array[] = [];
    for (let i = 0; i < total; i++) {
      const part = this.fragmentAssembly.parts.get(i);
      if (!part) return;
      ordered.push(part);
    }

    const totalLen = ordered.reduce((sum, part) => sum + part.length, 0);
    const merged = new Uint8Array(totalLen);
    let offset = 0;
    for (const part of ordered) {
      merged.set(part, offset);
      offset += part.length;
    }
    this.fragmentAssembly = null;
    this.dispatchJson(new TextDecoder().decode(merged));
  }

  private dispatchJson(text: string): void {
    try {
      const data = JSON.parse(text) as DeviceMessage;
      this.options.onMessage(data);
      this.options.onLog(`Received: ${text.length > 120 ? `${text.slice(0, 120)}…` : text}`);
    } catch {
      this.options.onLog(`Error parsing BLE JSON (${text.length} chars)`);
    }
  }

  dispose(): void {
    this.disconnect();
  }
}

export function mergeBleMessage(prev: DeviceMessage | null, data: DeviceMessage): DeviceMessage {
  return mergeDeviceMessage(prev, data);
}
