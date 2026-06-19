/** Mock telemetry aligned with Firmware/src/display/display.h */
export interface DisplayTelemetry {
  speedPercent: number;
  batteryVoltage: number;
  temperatureC: number;
  motorTemperatureReady: boolean;
  mcuTempC: number;
  rpm: number;
  triggerHeld: boolean;
  rpmReady: boolean;
  batterySocPercent: number;
  motorActive: boolean;
  displayInfoMode: boolean;
  displayInfoPage: number;
  uptimeSeconds: number;
  freeHeapBytes: number;
  batterySeriesCells: number;
  otaActive: boolean;
  otaProgressPercent: number;
  motorDisplayMode: number;
  maxStatsRpm: number;
  maxStatsHasRpm: boolean;
  maxStatsVoltageV: number;
  maxStatsHasVoltage: boolean;
  maxStatsMotorTempC: number;
  maxStatsHasMotorTemp: boolean;
}

export interface DevSettingPreview {
  title: string;
  subline?: string;
  value: string;
}

export interface Display15Scenario {
  id: string;
  label: string;
  telemetry: DisplayTelemetry;
  /** When set, overrides dev-menu page from telemetry.displayInfoPage */
  devSetting?: DevSettingPreview;
  /** Mock WiFi strings for info page 2 */
  wifi?: { ssid: string; ip: string; rssi: number | null; apMode?: boolean };
  /** Mock hostname for info page 5 */
  hostname?: string;
  /** Optional runtime settings for preset accuracy */
  settings?: Partial<import('./settings').RuntimeSettings>;
}

export const DISPLAY_WIDTH = 128;
export const DISPLAY_HEIGHT = 128;

/** Waveshare 1.5″ 128×128 OLED — active area is square; diagonal spec is 1.5 in. */
export const DISPLAY_DIAGONAL_INCHES = 1.5;
/** Side length in mm: (diagonal / √2) × 25.4 */
export const DISPLAY_SIDE_MM = (DISPLAY_DIAGONAL_INCHES / Math.SQRT2) * 25.4;

export const OTA_GRAY = '#bbbbbb';
