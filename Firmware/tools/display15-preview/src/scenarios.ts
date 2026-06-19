import type { DevSettingPreview, Display15Scenario, DisplayTelemetry } from './types';
import type { ButtonSimulator } from './buttonSim';

const BASE_TELEMETRY: DisplayTelemetry = {
  speedPercent: 0,
  batteryVoltage: 18.5,
  temperatureC: 42.3,
  motorTemperatureReady: true,
  mcuTempC: 38.1,
  rpm: 0,
  triggerHeld: false,
  rpmReady: true,
  batterySocPercent: 72,
  motorActive: false,
  displayInfoMode: false,
  displayInfoPage: 0,
  uptimeSeconds: 3600 + 23 * 60,
  freeHeapBytes: 180_000,
  batterySeriesCells: 5,
  otaActive: false,
  otaProgressPercent: 0,
  motorDisplayMode: 2,
  maxStatsRpm: 42_500,
  maxStatsHasRpm: true,
  maxStatsVoltageV: 19.2,
  maxStatsHasVoltage: true,
  maxStatsMotorTempC: 55.4,
  maxStatsHasMotorTemp: true,
};

function withTelemetry(partial: Partial<DisplayTelemetry>): DisplayTelemetry {
  return { ...BASE_TELEMETRY, ...partial };
}

function infoScenario(
  id: string,
  label: string,
  page: number,
  extra: Partial<Display15Scenario> = {},
): Display15Scenario {
  return {
    id,
    label,
    telemetry: withTelemetry({ displayInfoMode: true, displayInfoPage: page }),
    ...extra,
  };
}

export const SCENARIOS: Display15Scenario[] = [
  {
    id: 'main-idle',
    label: 'Main — idle (Start)',
    telemetry: withTelemetry({ speedPercent: 0, motorActive: false }),
  },
  {
    id: 'main-hold',
    label: 'Main — trigger hold',
    telemetry: withTelemetry({ triggerHeld: true, speedPercent: 40 }),
  },
  {
    id: 'main-motor-rpm',
    label: 'Main — motor on (RPM)',
    telemetry: withTelemetry({
      motorActive: true,
      speedPercent: 65,
      motorDisplayMode: 2,
      rpm: 38_420,
    }),
  },
  {
    id: 'main-motor-speed',
    label: 'Main — motor on (Speed %)',
    telemetry: withTelemetry({
      motorActive: true,
      speedPercent: 80,
      motorDisplayMode: 0,
      rpm: 41_200,
    }),
  },
  {
    id: 'main-low-battery',
    label: 'Main — low SOC blink',
    telemetry: withTelemetry({ batterySocPercent: 12, speedPercent: 25 }),
  },
  infoScenario('info-max-stats', 'Info — Maximum Stats', 0),
  infoScenario('info-battery', 'Info — Battery', 1),
  infoScenario('info-wifi', 'Info — WiFi (STA)', 2, {
    wifi: { ssid: 'TheLab IoT', ip: '192.168.1.42', rssi: -58 },
  }),
  infoScenario('info-wifi-ap', 'Info — WiFi (AP mode)', 2, {
    wifi: { ssid: 'osh-vac', ip: '192.168.4.1', rssi: null, apMode: true },
  }),
  infoScenario('info-ble', 'Info — BLE', 3),
  infoScenario('info-sensor', 'Info — Sensor', 4),
  infoScenario('info-system', 'Info — System', 5, { hostname: 'osh-vac' }),
  {
    id: 'dev-auto-off',
    label: 'Dev menu — Auto-Off',
    telemetry: withTelemetry({ displayInfoMode: true, displayInfoPage: 6 }),
    settings: { autoOffMinutes: 2 },
  },
  {
    id: 'dev-display-brightness',
    label: 'Dev menu — Display Brightness',
    telemetry: withTelemetry({ displayInfoMode: true, displayInfoPage: 19 }),
    settings: { displayContrastPercent: 40 },
  },
  {
    id: 'dev-led-theme',
    label: 'Dev menu — LED Theme',
    telemetry: withTelemetry({ displayInfoMode: true, displayInfoPage: 18 }),
    settings: { ledTheme: 6 },
  },
  {
    id: 'ota-45',
    label: 'OTA — 45%',
    telemetry: withTelemetry({ otaActive: true, otaProgressPercent: 45 }),
  },
  {
    id: 'ota-100',
    label: 'OTA — 100%',
    telemetry: withTelemetry({ otaActive: true, otaProgressPercent: 100 }),
  },
];

export function scenarioById(id: string): Display15Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

export function defaultDevSetting(): DevSettingPreview {
  return { title: 'Setting', subline: 'Subline', value: '—' };
}

export function loadScenarioIntoSim(sim: ButtonSimulator, scenario: Display15Scenario): void {
  const t = scenario.telemetry;
  sim.loadPreset({
    speedPercent: t.speedPercent,
    motorActive: t.motorActive,
    displayInfoMode: t.displayInfoMode,
    displayInfoPage: t.displayInfoPage,
    triggerHeld: t.triggerHeld,
    env: {
      batteryVoltage: t.batteryVoltage,
      batterySocPercent: t.batterySocPercent,
      temperatureC: t.temperatureC,
      motorTemperatureReady: t.motorTemperatureReady,
      mcuTempC: t.mcuTempC,
      rpmReady: t.rpmReady,
      uptimeSeconds: t.uptimeSeconds,
      freeHeapBytes: t.freeHeapBytes,
      maxStatsRpm: t.maxStatsRpm,
      maxStatsHasRpm: t.maxStatsHasRpm,
      maxStatsVoltageV: t.maxStatsVoltageV,
      maxStatsHasVoltage: t.maxStatsHasVoltage,
      maxStatsMotorTempC: t.maxStatsMotorTempC,
      maxStatsHasMotorTemp: t.maxStatsHasMotorTemp,
      otaActive: t.otaActive,
      otaProgressPercent: t.otaProgressPercent,
      wifi: scenario.wifi,
      hostname: scenario.hostname,
    },
    settings: {
      batterySeriesCells: t.batterySeriesCells,
      motorDisplayMode: t.motorDisplayMode as 0 | 1 | 2 | 3,
      ...scenario.settings,
    },
  });
}
