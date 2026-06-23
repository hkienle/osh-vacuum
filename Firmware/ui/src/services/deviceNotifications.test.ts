import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  handleDeviceMessageNotify,
  parseDeviceNotify,
  resetDeviceNotifications,
  showDeviceNotification,
} from './deviceNotifications';

const toastMock = vi.hoisted(() => ({
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: toastMock,
}));

describe('deviceNotifications', () => {
  afterEach(() => {
    resetDeviceNotifications();
    vi.clearAllMocks();
  });

  it('parses structured notify payloads', () => {
    expect(
      parseDeviceNotify({
        notify: {
          id: 'thermal_stop',
          text: 'Motor stopped due to over-temperature (limit 80 °C)',
          level: 'warning',
        },
      }),
    ).toEqual({
      id: 'thermal_stop',
      text: 'Motor stopped due to over-temperature (limit 80 °C)',
      level: 'warning',
    });
  });

  it('shows warning toast once per notify id', () => {
    showDeviceNotification({
      id: 'thermal_stop',
      text: 'Motor stopped due to over-temperature (limit 80 °C)',
      level: 'warning',
    });
    showDeviceNotification({
      id: 'thermal_stop',
      text: 'Motor stopped due to over-temperature (limit 80 °C)',
      level: 'warning',
    });

    expect(toastMock.warning).toHaveBeenCalledTimes(1);
    expect(toastMock.warning).toHaveBeenCalledWith(
      'Motor stopped due to over-temperature (limit 80 °C)',
      { duration: 6000 },
    );
  });

  it('handles incoming device messages', () => {
    handleDeviceMessageNotify({
      notify: {
        id: 'auto_off',
        text: 'Motor stopped: auto-off after 15 min',
        level: 'info',
      },
    });

    expect(toastMock.info).toHaveBeenCalledWith('Motor stopped: auto-off after 15 min', {
      duration: 6000,
    });
  });
});
