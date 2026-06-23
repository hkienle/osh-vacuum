import { toast } from 'sonner';
import type { DeviceMessage, DeviceNotify, DeviceNotifyLevel } from '../types/deviceTransport';

let lastNotifyId: string | null = null;

function normalizeLevel(value: unknown): DeviceNotifyLevel {
  if (value === 'error' || value === 'warning' || value === 'info') {
    return value;
  }
  return 'info';
}

export function resetDeviceNotifications(): void {
  lastNotifyId = null;
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

export function showDeviceNotification(notify: DeviceNotify): void {
  if (notify.id === lastNotifyId) {
    return;
  }
  lastNotifyId = notify.id;

  const options = { duration: 6000 };
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
}

export function handleDeviceMessageNotify(data: DeviceMessage): void {
  const notify = parseDeviceNotify(data);
  if (notify) {
    showDeviceNotification(notify);
  }
}
