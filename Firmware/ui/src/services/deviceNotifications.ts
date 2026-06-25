import { toast } from 'sonner';
import type { DeviceMessage, DeviceNotify, DeviceNotifyLevel } from '../types/deviceTransport';

const NOTIFY_DEBOUNCE_MS = 8000;
const NOTIFY_GRACE_AFTER_DEVICE_MS = 4000;
const USER_MOTOR_STOP_GRACE_MS = 2500;

const lastShownAtById = new Map<string, number>();
let recentNotifyGraceUntil = 0;
let userRequestedMotorStopUntil = 0;

function normalizeLevel(value: unknown): DeviceNotifyLevel {
  if (value === 'error' || value === 'warning' || value === 'info') {
    return value;
  }
  return 'info';
}

export function resetDeviceNotifications(): void {
  lastShownAtById.clear();
  recentNotifyGraceUntil = 0;
  userRequestedMotorStopUntil = 0;
}

/** Call before sending motor_stop from the Web UI (control panel, battery test, …). */
export function markUserMotorStop(): void {
  userRequestedMotorStopUntil = Date.now() + USER_MOTOR_STOP_GRACE_MS;
}

/** Match firmware DEFAULT_MIN_CELL_VOLTAGE_CUTOFF (settings_config.h). */
export const MIN_CELL_VOLTAGE_CUTOFF = 3.0;

export interface UnexpectedStopContext {
  packVoltage?: number;
  seriesCells?: number;
}

function seriesCellsFromMessage(msg: DeviceMessage | null | undefined): number {
  const cells = msg?.settings?.bat_cells;
  if (typeof cells === 'number' && cells > 0) {
    return cells;
  }
  return 5;
}

function buildUndervoltageNotify(packVoltage: number, seriesCells: number): DeviceNotify {
  const cellV = packVoltage / seriesCells;
  return {
    id: 'undervoltage_stop',
    text: `Motor stopped: battery undervoltage (${packVoltage.toFixed(2)} V, ${cellV.toFixed(2)} V/cell)`,
    level: 'warning',
  };
}

function isUndervoltage(packVoltage: number, seriesCells: number): boolean {
  if (packVoltage <= 0 || seriesCells <= 0) {
    return false;
  }
  return packVoltage / seriesCells < MIN_CELL_VOLTAGE_CUTOFF + 0.05;
}

export function markUserMotorStart(): void {
  userRequestedMotorStopUntil = 0;
  lastShownAtById.delete('auto_off');
  lastShownAtById.delete('thermal_stop');
  lastShownAtById.delete('undervoltage_stop');
  lastShownAtById.delete('unexpected_stop');
}

export function parseDeviceNotify(data: DeviceMessage): DeviceNotify | null {
  const raw = data.notify;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const notify = raw as Record<string, unknown>;
    const text =
      typeof notify.text === 'string'
        ? notify.text
        : typeof notify.message === 'string'
          ? notify.message
          : null;
    if (!text) {
      return null;
    }
    return {
      id: typeof notify.id === 'string' ? notify.id : text,
      text,
      level: normalizeLevel(notify.level),
    };
  }

  if (typeof data.message === 'string' && data.message.length > 0) {
    return {
      id: typeof data.notify_id === 'string' ? data.notify_id : data.message,
      text: data.message,
      level: normalizeLevel(data.level),
    };
  }

  return null;
}

function shouldShowNotify(notify: DeviceNotify): boolean {
  const now = Date.now();
  const last = lastShownAtById.get(notify.id);
  if (last !== undefined && now - last < NOTIFY_DEBOUNCE_MS) {
    return false;
  }
  lastShownAtById.set(notify.id, now);
  return true;
}

/** Show a toast for a device notification. Returns true if a toast was shown. */
export function showDeviceNotification(notify: DeviceNotify): boolean {
  if (!shouldShowNotify(notify)) {
    return false;
  }

  recentNotifyGraceUntil = Date.now() + NOTIFY_GRACE_AFTER_DEVICE_MS;

  const options = { duration: 8000 };
  switch (notify.level) {
    case 'error':
      toast.error(notify.text, options);
      break;
    case 'warning':
      toast.warning(notify.text, options);
      break;
    default:
      toast.info(notify.text, options);
      break;
  }
  return true;
}

export function formatNotificationForConsole(notify: DeviceNotify): string {
  const prefix =
    notify.level === 'error' ? 'Error' : notify.level === 'warning' ? 'Warning' : 'Notice';
  return `[${prefix}] ${notify.text}`;
}

/**
 * Fallback when motor_active drops without a device notify (e.g. sleep, link glitch).
 * Skips stops initiated from this Web UI or already explained by a recent notify.
 */
export function detectUnexpectedMotorStop(
  prevMotorActive: boolean | undefined,
  data: DeviceMessage,
  context?: UnexpectedStopContext,
): DeviceNotify | null {
  if (prevMotorActive !== true || data.motor_active !== false) {
    return null;
  }
  if (Date.now() < userRequestedMotorStopUntil) {
    return null;
  }
  if (Date.now() < recentNotifyGraceUntil) {
    return null;
  }
  if (parseDeviceNotify(data)) {
    return null;
  }

  const packVoltage = context?.packVoltage ?? data.voltage ?? data.battery;
  const seriesCells = context?.seriesCells ?? seriesCellsFromMessage(data);
  if (typeof packVoltage === 'number' && isUndervoltage(packVoltage, seriesCells)) {
    return buildUndervoltageNotify(packVoltage, seriesCells);
  }

  return {
    id: 'unexpected_stop',
    text: 'Motor stopped unexpectedly',
    level: 'warning',
  };
}

export function onMotorBecameActive(): void {
  markUserMotorStart();
}

/** Parse notify payloads and show toasts. Returns the notification if shown. */
export function handleDeviceMessageNotify(data: DeviceMessage): DeviceNotify | null {
  const notify = parseDeviceNotify(data);
  if (!notify) {
    return null;
  }
  return showDeviceNotification(notify) ? notify : null;
}
