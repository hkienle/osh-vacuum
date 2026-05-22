import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useDeviceSettings } from './useDeviceSettings';

const mocked = vi.hoisted(() => ({
  ctx: {
    connected: true,
    sendMessage: vi.fn(),
    lastMessage: null as any,
  },
}));

vi.mock('../contexts/WebSocketContext', () => ({
  useWebSocketContext: () => mocked.ctx,
}));

describe('useDeviceSettings', () => {
  it('requests settings and sends set_setting', () => {
    const { result, rerender } = renderHook(() => useDeviceSettings());
    expect(mocked.ctx.sendMessage).toHaveBeenCalledWith({ command: 'get_settings' });

    mocked.ctx.lastMessage = {
      schema: { entries: [{ id: 0, key: 'auto_off', title: 'Auto-Off', visible: true, allowed_values: [0, 1] }] },
      settings: { auto_off: 1 },
      motor_type: 0,
    };
    rerender();
    expect(result.current.values.auto_off).toBe(1);
    act(() => result.current.setField('auto_off', 0));
    expect(mocked.ctx.sendMessage).toHaveBeenCalledWith({ command: 'set_setting', key: 'auto_off', value: 0 });
  });
});
