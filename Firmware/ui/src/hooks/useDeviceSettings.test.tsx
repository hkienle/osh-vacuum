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

  it('edits locally and saves batched changes', () => {
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
    expect(result.current.dirty).toBe(false);

    act(() => result.current.setField('auto_off', 0));
    expect(result.current.values.auto_off).toBe(0);
    expect(result.current.dirty).toBe(true);
    // Editing must NOT touch the device until the user saves.
    expect(mocked.ctx.sendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ command: 'set_settings' }),
    );

    act(() => result.current.save());
    expect(mocked.ctx.sendMessage).toHaveBeenCalledWith({
      command: 'set_settings',
      values: { auto_off: 0 },
    });
    expect(result.current.dirty).toBe(false);
  });

  it('stages factory defaults on reset', () => {
    const { result, rerender } = renderHook(() => useDeviceSettings({ enabled: true }));
    mocked.ctx.lastMessage = {
      schema: {
        entries: [
          { id: 0, key: 'auto_off', title: 'Auto-Off', visible: true, allowed_values: [0, 1, 2], def: 2 },
        ],
      },
      settings: { auto_off: 0 },
      motor_type: 0,
    };
    rerender();
    expect(result.current.values.auto_off).toBe(0);

    act(() => result.current.resetToDefault());
    expect(result.current.values.auto_off).toBe(2);
    expect(result.current.dirty).toBe(true);
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
