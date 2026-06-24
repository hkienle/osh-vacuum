import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SettingsModal } from './SettingsModal';

const mocked = vi.hoisted(() => ({
  useDeviceSettings: vi.fn(),
  connected: true,
  webUi: {
    mounted: true,
    theme: 'system',
    setTheme: vi.fn(),
    transport: 'wifi' as const,
    setDefaultTransport: vi.fn(),
    vacuumHost: 'osh-vac.local',
    setVacuumHost: vi.fn(),
    bleSupported: true,
    bleUnavailableReason: '',
    embeddedUi: false,
    hostedUi: true,
  },
}));

vi.mock('../../hooks/useDeviceSettings', () => ({
  useDeviceSettings: mocked.useDeviceSettings,
}));

vi.mock('../../contexts/DeviceConnectionContext', () => ({
  useDeviceConnectionContext: () => ({
    connected: mocked.connected,
    lastMessage: null,
    sendMessage: vi.fn(),
  }),
}));

vi.mock('../../hooks/useWebUiSettings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useWebUiSettings')>();
  return {
    ...actual,
    useWebUiSettings: () => mocked.webUi,
  };
});

describe('SettingsModal', () => {
  beforeEach(() => {
    localStorage.setItem('oshvac_settings_tab', 'vac');
    mocked.connected = true;
    mocked.useDeviceSettings.mockReturnValue({
      ready: true,
      loadError: false,
      schema: {
        entries: [
          { id: 0, key: 'auto_off', title: 'Auto-Off', visible: true, allowed_values: [0, 1] },
          { id: 1, key: 'spd_step', title: 'Speed Steps', visible: false, allowed_values: [1, 5] },
        ],
      },
      values: { auto_off: 1, spd_step: 5 },
      motorType: 1,
      dirty: false,
      setField: vi.fn(),
      save: vi.fn(),
      resetToDefault: vi.fn(),
      retry: vi.fn(),
    });
  });

  it('renders visible vac fields only on Vacuum Settings tab', async () => {
    render(<SettingsModal isOpen={true} onClose={() => undefined} />);
    expect(screen.getByText('Auto-Off')).toBeInTheDocument();
    expect(screen.queryByText('Speed Steps')).not.toBeInTheDocument();
  });

  it('shows Caznic Connect settings on Caznic Connect Settings tab', async () => {
    const user = userEvent.setup();
    render(<SettingsModal isOpen={true} onClose={() => undefined} />);
    await user.click(screen.getByRole('tab', { name: 'Caznic Connect Settings' }));
    expect(screen.getByText('Theme')).toBeInTheDocument();
    expect(screen.getByText('Default transport')).toBeInTheDocument();
    expect(screen.queryByText('Auto-Off')).not.toBeInTheDocument();
  });

  it('renders display brightness stepper from schema on vac tab', () => {
    mocked.useDeviceSettings.mockReturnValue({
      ready: true,
      loadError: false,
      schema: {
        entries: [
          {
            id: 13,
            key: 'disp_contrast',
            title: 'Display Brightness',
            subline: 'OLED Contrast',
            visible: true,
            allowed_values: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
          },
        ],
      },
      values: { disp_contrast: 20 },
      motorType: 0,
      dirty: false,
      setField: vi.fn(),
      save: vi.fn(),
      resetToDefault: vi.fn(),
      retry: vi.fn(),
    });
    render(<SettingsModal isOpen={true} onClose={() => undefined} />);
    expect(screen.getByText('Display Brightness')).toBeInTheDocument();
    expect(screen.getByText('OLED Contrast')).toBeInTheDocument();
  });

  it('requests settings when modal is open and connected', () => {
    render(<SettingsModal isOpen={true} onClose={() => undefined} />);
    expect(mocked.useDeviceSettings).toHaveBeenCalledWith({ enabled: true });
  });

  it('shows connect hint on vac tab when disconnected', () => {
    mocked.connected = false;
    render(<SettingsModal isOpen={true} onClose={() => undefined} />);
    expect(screen.getByText(/Connect your vacuum to view and edit device settings/)).toBeInTheDocument();
    expect(screen.queryByText('Auto-Off')).not.toBeInTheDocument();
  });
});
