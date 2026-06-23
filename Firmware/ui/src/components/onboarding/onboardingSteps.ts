export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  /** Short alt text for the screenshot (screen readers only). */
  screenshotAlt: string;
  /** Path under public/, e.g. /onboarding/welcome.png */
  screenshotSrc?: string;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome',
    description: 'A quick look at caznic connect.',
    screenshotAlt: 'caznic connect home screen, disconnected',
    screenshotSrc: '/onboarding/welcome.png',
  },
  {
    id: 'control',
    title: 'Control & metrics',
    description: 'Set speed, start and stop the motor, watch live data.',
    screenshotAlt: 'Motor speed controls and live metrics',
    screenshotSrc: '/onboarding/control.png',
  },
  {
    id: 'settings',
    title: 'Settings',
    description: 'WebUI preferences and vacuum settings from the device.',
    screenshotAlt: 'Vacuum settings dialog',
    screenshotSrc: '/onboarding/settings.png',
  },
  {
    id: 'battery',
    title: 'Battery test',
    description: 'Run a guided discharge test and export results.',
    screenshotAlt: 'Battery test dialog',
    screenshotSrc: '/onboarding/battery.png',
  },
  {
    id: 'connection',
    title: 'Connect',
    description: 'WiFi or Bluetooth — pick a transport and connect.',
    screenshotAlt: 'Connection panel, ready to connect via WiFi',
    screenshotSrc: '/onboarding/connection.png',
  },
  {
    id: 'done',
    title: 'Ready to go',
    description: 'Replay this tour anytime under Settings → WebUI Settings.',
    screenshotAlt: 'Connection panel, connected via WiFi',
    screenshotSrc: '/onboarding/connection-connected.png',
  },
];
