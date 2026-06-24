import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  detectUnexpectedMotorStop,
  handleDeviceMessageNotify,
  markUserMotorStop,
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

  it('debounces the same notify id within a short window', () => {
    const notify = {
      id: 'thermal_stop',
      text: 'Motor stopped due to over-temperature (limit 80 °C)',
      level: 'warning' as const,
    };
    expect(showDeviceNotification(notify)).toBe(true);
    expect(showDeviceNotification(notify)).toBe(false);

    expect(toastMock.warning).toHaveBeenCalledTimes(1);
    expect(toastMock.warning).toHaveBeenCalledWith(
      'Motor stopped due to over-temperature (limit 80 °C)',
      { duration: 8000 },
    );
  });

  it('handles incoming device messages', () => {
    const shown = handleDeviceMessageNotify({
      notify: {
        id: 'auto_off',
        text: 'Motor stopped: auto-off after 15 min',
        level: 'info',
      },
    });

    expect(shown?.text).toBe('Motor stopped: auto-off after 15 min');
    expect(toastMock.info).toHaveBeenCalledWith('Motor stopped: auto-off after 15 min', {
      duration: 8000,
    });
  });

  it('detects unexpected motor stop when not user-initiated', () => {
    const notify = detectUnexpectedMotorStop(true, { motor_active: false });
    expect(notify).toEqual({
      id: 'unexpected_stop',
      text: 'Motor stopped unexpectedly',
      level: 'warning',
    });
  });

  it('ignores motor stop right after user pressed stop in the Web UI', () => {
    markUserMotorStop();
    expect(detectUnexpectedMotorStop(true, { motor_active: false })).toBeNull();
  });

  it('detects undervoltage when motor stops with low pack voltage', () => {
    const notify = detectUnexpectedMotorStop(true, { motor_active: false, voltage: 14.2 }, { seriesCells: 5 });
    expect(notify?.id).toBe('undervoltage_stop');
    expect(notify?.text).toMatch(/undervoltage/i);
  });

  it('parses firmware undervoltage notify payloads', () => {
    expect(
      parseDeviceNotify({
        notify: {
          id: 'undervoltage_stop',
          text: 'Motor stopped: battery undervoltage (14.20 V, 2.84 V/cell)',
          level: 'warning',
        },
      }),
    ).toMatchObject({ id: 'undervoltage_stop', level: 'warning' });
  });

  it('does not duplicate when device already sent a notify on the same message', () => {
    const notify = detectUnexpectedMotorStop(true, {
      motor_active: false,
      notify: {
        id: 'auto_off',
        text: 'Motor stopped: auto-off after 2 min',
        level: 'info',
      },
    });
    expect(notify).toBeNull();
  });
});
