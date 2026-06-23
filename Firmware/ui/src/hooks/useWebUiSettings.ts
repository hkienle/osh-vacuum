import { useCallback, useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { useDeviceConnectionContext } from '@/contexts/DeviceConnectionContext';
import { getStoredIP } from '@/hooks/useDeviceConnection';
import {
  IP_STORAGE_KEY,
  TRANSPORT_STORAGE_KEY,
  getBleAvailability,
  isEmbeddedDeviceUi,
  isHostedDeviceUi,
  type TransportKind,
} from '@/types/deviceTransport';

export const SETTINGS_TAB_KEY = 'oshvac_settings_tab';

export type SettingsTab = 'webui' | 'vac';

export function getStoredSettingsTab(): SettingsTab {
  const stored = localStorage.getItem(SETTINGS_TAB_KEY);
  return stored === 'webui' ? 'webui' : 'vac';
}

export function useWebUiSettings() {
  const { theme, setTheme } = useTheme();
  const { transport, setTransport } = useDeviceConnectionContext();
  const [vacuumHost, setVacuumHostState] = useState(() => getStoredIP());
  const [mounted, setMounted] = useState(false);

  const bleAvailability = getBleAvailability();
  const embeddedUi = isEmbeddedDeviceUi();
  const hostedUi = isHostedDeviceUi();

  useEffect(() => {
    setMounted(true);
  }, []);

  const setVacuumHost = useCallback((host: string) => {
    const trimmed = host.trim();
    setVacuumHostState(trimmed);
    if (trimmed) {
      localStorage.setItem(IP_STORAGE_KEY, trimmed);
    } else {
      localStorage.removeItem(IP_STORAGE_KEY);
    }
  }, []);

  const setDefaultTransport = useCallback(
    (next: TransportKind) => {
      localStorage.setItem(TRANSPORT_STORAGE_KEY, next);
      setTransport(next);
    },
    [setTransport],
  );

  return {
    mounted,
    theme: theme ?? 'system',
    setTheme,
    transport,
    setDefaultTransport,
    vacuumHost,
    setVacuumHost,
    bleSupported: bleAvailability.ok,
    bleUnavailableReason: bleAvailability.reason,
    embeddedUi,
    hostedUi,
  };
}
