import { useEffect, useMemo, useState } from 'react';
import type { SettingsSchema, SettingsValues } from '../types/settings';
import { requestSettings, setSetting } from '../services/settingsBridge';
import { useWebSocketContext } from '../contexts/WebSocketContext';

interface UseDeviceSettingsReturn {
  schema: SettingsSchema | null;
  values: SettingsValues;
  motorType: number;
  ready: boolean;
  setField: (key: string, value: number) => void;
}

export function useDeviceSettings(): UseDeviceSettingsReturn {
  const { connected, sendMessage, lastMessage } = useWebSocketContext();
  const [schema, setSchema] = useState<SettingsSchema | null>(null);
  const [values, setValues] = useState<SettingsValues>({});
  const [motorType, setMotorType] = useState<number>(0);

  useEffect(() => {
    if (connected) {
      requestSettings(sendMessage);
    }
  }, [connected, sendMessage]);

  useEffect(() => {
    if (!lastMessage) return;
    const payload = lastMessage as { schema?: SettingsSchema; settings?: SettingsValues; motor_type?: number };
    if (payload.schema) setSchema(payload.schema);
    if (payload.settings) setValues((prev) => ({ ...prev, ...payload.settings }));
    if (typeof payload.motor_type === 'number') setMotorType(payload.motor_type);
  }, [lastMessage]);

  const setField = (key: string, value: number) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSetting(sendMessage, key, value);
  };

  return useMemo(
    () => ({ schema, values, motorType, ready: !!schema, setField }),
    [schema, values, motorType]
  );
}
