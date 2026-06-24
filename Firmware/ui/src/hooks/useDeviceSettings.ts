import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SettingsSchema, SettingsValues } from '../types/settings';
import { requestSettings, setSettings } from '../services/settingsBridge';
import { useDeviceConnectionContext } from '../contexts/DeviceConnectionContext';

interface UseDeviceSettingsOptions {
  /** When true, requests fresh settings from the device (e.g. modal open). */
  enabled?: boolean;
}

interface UseDeviceSettingsReturn {
  schema: SettingsSchema | null;
  /** Working copy shown in the form (local, unsaved edits live here). */
  values: SettingsValues;
  motorType: number;
  ready: boolean;
  loadError: boolean;
  /** True when the draft differs from the values last loaded from the device. */
  dirty: boolean;
  setField: (key: string, value: number) => void;
  /** Push all changed draft values to the device. */
  save: () => void;
  /** Stage every setting's factory default into the draft (requires save). */
  resetToDefault: () => void;
  retry: () => void;
}

const WIFI_RETRY_MS = 1500;
const BLE_RETRY_MS = 2500;
const WIFI_MAX_ATTEMPTS = 10;
const BLE_MAX_ATTEMPTS = 30;

function valuesEqual(a: SettingsValues, b: SettingsValues): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => a[key] === b[key]);
}

export function useDeviceSettings(options: UseDeviceSettingsOptions = {}): UseDeviceSettingsReturn {
  const { enabled = true } = options;
  const { connected, sendMessage, lastMessage, transport } = useDeviceConnectionContext();
  const [schema, setSchema] = useState<SettingsSchema | null>(null);
  const [deviceValues, setDeviceValues] = useState<SettingsValues>({});
  const [draft, setDraft] = useState<SettingsValues>({});
  const [dirty, setDirty] = useState(false);
  const [motorType, setMotorType] = useState<number>(0);
  const [loadError, setLoadError] = useState(false);
  const attemptsRef = useRef(0);

  useEffect(() => {
    if (!connected) {
      setSchema(null);
      setDeviceValues({});
      setDraft({});
      setDirty(false);
      setMotorType(0);
      setLoadError(false);
      attemptsRef.current = 0;
    }
  }, [connected]);

  useEffect(() => {
    if (!lastMessage) return;
    if (lastMessage.schema) {
      setSchema(lastMessage.schema);
      setLoadError(false);
    }
    if (lastMessage.settings) {
      setDeviceValues((prev) => ({ ...prev, ...lastMessage.settings! }));
    }
    if (typeof lastMessage.motor_type === 'number') setMotorType(lastMessage.motor_type);
  }, [lastMessage]);

  // Keep the draft synced to the device values until the user edits it.
  useEffect(() => {
    if (dirty) return;
    setDraft((prev) => (valuesEqual(prev, deviceValues) ? prev : { ...deviceValues }));
  }, [deviceValues, dirty]);

  const requestFromDevice = useCallback(() => {
    requestSettings(sendMessage);
  }, [sendMessage]);

  useEffect(() => {
    if (!connected || !enabled) {
      return;
    }

    const retryMs = transport === 'ble' ? BLE_RETRY_MS : WIFI_RETRY_MS;
    const maxAttempts = transport === 'ble' ? BLE_MAX_ATTEMPTS : WIFI_MAX_ATTEMPTS;
    const initialDelayMs = transport === 'ble' ? 1200 : 0;

    attemptsRef.current = 0;
    setLoadError(false);

    // BLE waits briefly so the notification subscription is ready; other
    // transports can request immediately.
    let requestLater: number | undefined;
    if (initialDelayMs > 0) {
      requestLater = window.setTimeout(() => {
        requestFromDevice();
      }, initialDelayMs);
    } else {
      requestFromDevice();
    }

    const interval = window.setInterval(() => {
      attemptsRef.current += 1;
      if (schema ?? lastMessage?.schema) {
        window.clearInterval(interval);
        return;
      }
      if (attemptsRef.current >= maxAttempts) {
        setLoadError(true);
        window.clearInterval(interval);
        return;
      }
      requestFromDevice();
    }, retryMs);

    return () => {
      if (requestLater !== undefined) window.clearTimeout(requestLater);
      window.clearInterval(interval);
    };
  }, [connected, enabled, requestFromDevice, lastMessage?.schema, schema, transport]);

  const setField = useCallback((key: string, value: number) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }, []);

  const save = useCallback(() => {
    const changed: SettingsValues = {};
    for (const key of Object.keys(draft)) {
      if (draft[key] !== deviceValues[key]) {
        changed[key] = draft[key];
      }
    }
    if (Object.keys(changed).length > 0) {
      setSettings(sendMessage, changed);
      setDeviceValues((prev) => ({ ...prev, ...changed }));
    }
    setDirty(false);
  }, [draft, deviceValues, sendMessage]);

  const resetToDefault = useCallback(() => {
    if (!schema) return;
    const defaults: SettingsValues = {};
    for (const entry of schema.entries) {
      if (typeof entry.def === 'number') {
        defaults[entry.key] = entry.def;
      }
    }
    setDraft((prev) => ({ ...prev, ...defaults }));
    setDirty(true);
  }, [schema]);

  const retry = useCallback(() => {
    setLoadError(false);
    setDirty(false);
    attemptsRef.current = 0;
    requestFromDevice();
  }, [requestFromDevice]);

  return useMemo(
    () => ({
      schema,
      values: draft,
      motorType,
      ready: !!schema,
      loadError,
      dirty,
      setField,
      save,
      resetToDefault,
      retry,
    }),
    [schema, draft, motorType, loadError, dirty, setField, save, resetToDefault, retry],
  );
}
