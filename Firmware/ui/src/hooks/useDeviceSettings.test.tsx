import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useDeviceSettings } from './useDeviceSettings';

const mocked = vi.hoisted(() => ({
  ctx: {
    connected: true,
    sendMessage: vi.fn(),
    lastMessage: null as any,
  },
}));

vi.mock('../contexts/DeviceConnectionContext', () => ({
  useDeviceConnectionContext: () => mocked.ctx,
}));

describe('useDeviceSettings', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocked.ctx.connected = true;
    mocked.ctx.lastMessage = null;
    mocked.ctx.sendMessage.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('requests settings and sends set_setting', () => {
    const { result, rerender } = renderHook(() => useDeviceSettings({ enabled: true }));
    expect(mocked.ctx.sendMessage).toHaveBeenCalledWith({ command: 'get_settings' });

    mocked.ctx.lastMessage = {
      schema: { entries: [{ id: 0, key: 'auto_off', title: 'Auto-Off', visible: true, allowed_values: [0, 1] }] },
      settings: { auto_off: 1 },
      motor_type: 0,
    };
    rerender();
    expect(result.current.values.auto_off).toBe(1);
    expect(result.current.ready).toBe(true);
    act(() => result.current.setField('auto_off', 0));
    expect(mocked.ctx.sendMessage).toHaveBeenCalledWith({ command: 'set_setting', key: 'auto_off', value: 0 });
  });

  it('retries until schema arrives', () => {
    renderHook(() => useDeviceSettings({ enabled: true }));
    expect(mocked.ctx.sendMessage).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(mocked.ctx.sendMessage).toHaveBeenCalledTimes(2);
  });
});
