import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SettingsSchema, SettingsValues } from '../types/settings';
import { requestSettings, setSetting } from '../services/settingsBridge';
import { useDeviceConnectionContext } from '../contexts/DeviceConnectionContext';

interface UseDeviceSettingsOptions {
  /** When true, requests fresh settings from the device (e.g. modal open). */
  enabled?: boolean;
}

interface UseDeviceSettingsReturn {
  schema: SettingsSchema | null;
  values: SettingsValues;
  motorType: number;
  ready: boolean;
  loadError: boolean;
  setField: (key: string, value: number) => void;
  retry: () => void;
}

const WIFI_RETRY_MS = 1500;
const BLE_RETRY_MS = 2500;
const WIFI_MAX_ATTEMPTS = 10;
const BLE_MAX_ATTEMPTS = 30;

export function useDeviceSettings(options: UseDeviceSettingsOptions = {}): UseDeviceSettingsReturn {
  const { enabled = true } = options;
  const { connected, sendMessage, lastMessage, transport } = useDeviceConnectionContext();
  const [schema, setSchema] = useState<SettingsSchema | null>(null);
  const [values, setValues] = useState<SettingsValues>({});
  const [motorType, setMotorType] = useState<number>(0);
  const [loadError, setLoadError] = useState(false);
  const attemptsRef = useRef(0);

  useEffect(() => {
    if (!connected) {
      setSchema(null);
      setValues({});
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
    if (lastMessage.settings) setValues((prev) => ({ ...prev, ...lastMessage.settings! }));
    if (typeof lastMessage.motor_type === 'number') setMotorType(lastMessage.motor_type);
  }, [lastMessage]);

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

    const requestLater = window.setTimeout(() => {
      requestFromDevice();
    }, initialDelayMs);

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
      window.clearTimeout(requestLater);
      window.clearInterval(interval);
    };
  }, [connected, enabled, requestFromDevice, lastMessage?.schema, schema, transport]);

  const setField = useCallback(
    (key: string, value: number) => {
      setValues((prev) => ({ ...prev, [key]: value }));
      setSetting(sendMessage, key, value);
    },
    [sendMessage],
  );

  const retry = useCallback(() => {
    setLoadError(false);
    attemptsRef.current = 0;
    requestFromDevice();
  }, [requestFromDevice]);

  const effectiveSchema = schema ?? lastMessage?.schema ?? null;
  const effectiveValues = useMemo(
    () => ({ ...values, ...(lastMessage?.settings ?? {}) }),
    [values, lastMessage?.settings],
  );

  return useMemo(
    () => ({
      schema: effectiveSchema,
      values: effectiveValues,
      motorType,
      ready: !!effectiveSchema,
      loadError,
      setField,
      retry,
    }),
    [effectiveSchema, effectiveValues, motorType, loadError, setField, retry],
  );
}
