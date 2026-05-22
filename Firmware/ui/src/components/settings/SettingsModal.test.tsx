import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SettingsModal } from './SettingsModal';

const mocked = vi.hoisted(() => ({
  useDeviceSettings: vi.fn(),
}));

vi.mock('../../hooks/useDeviceSettings', () => ({
  useDeviceSettings: mocked.useDeviceSettings,
}));

describe('SettingsModal', () => {
  it('renders visible fields only', () => {
    mocked.useDeviceSettings.mockReturnValue({
      ready: true,
      schema: {
        entries: [
          { id: 0, key: 'auto_off', title: 'Auto-Off', visible: true, allowed_values: [0, 1] },
          { id: 1, key: 'spd_step', title: 'Speed Steps', visible: false, allowed_values: [1, 5] },
        ],
      },
      values: { auto_off: 1, spd_step: 5 },
      motorType: 1,
      setField: vi.fn(),
    });
    render(<SettingsModal isOpen={true} onClose={() => undefined} />);
    expect(screen.getByText('Auto-Off')).toBeInTheDocument();
    expect(screen.queryByText('Speed Steps')).not.toBeInTheDocument();
  });
});
