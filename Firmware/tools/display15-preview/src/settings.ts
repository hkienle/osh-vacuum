/** Runtime settings mirrored from Firmware/src/settings/settings.h + settings_schema.cpp */

export type TriggerMode = 0 | 1;
export type MotorDisplayMode = 0 | 1 | 2 | 3;
export type MotorType = 0 | 1;

export interface RuntimeSettings {
  autoOffMinutes: number;
  tempLimitC: number;
  speedStepPercent: number;
  minDutyPercent: number;
  maxDutyPercent: number;
  batterySeriesCells: number;
  sleepTimerMinutes: number;
  triggerMode: TriggerMode;
  motorDisplayMode: MotorDisplayMode;
  ledIdleDisplayMode: number;
  ledDisplayMode: number;
  ledDimPercent: number;
  displayContrastPercent: number;
  ledTheme: number;
  motorType: MotorType;
}

export const DEFAULT_RUNTIME_SETTINGS: RuntimeSettings = {
  autoOffMinutes: 2,
  tempLimitC: 40,
  speedStepPercent: 20,
  minDutyPercent: 0,
  maxDutyPercent: 100,
  batterySeriesCells: 5,
  sleepTimerMinutes: 2,
  triggerMode: 0,
  motorDisplayMode: 2,
  ledIdleDisplayMode: 1,
  ledDisplayMode: 2,
  ledDimPercent: 5,
  displayContrastPercent: 20,
  ledTheme: 1,
  motorType: 0,
};

const kAutoOff = [0, 1, 2, 5, 10, 30];
const kTempLim = [0, 30, 35, 40, 45, 50, 55, 60, 65, 70];
const kSpdStep = [1, 5, 10, 20, 25];
const kMinDuty = Array.from({ length: 30 }, (_, i) => i + 1);
const kBatCells = Array.from({ length: 14 }, (_, i) => i + 1);
const kSleep = [1, 2, 5, 10, 30];
const kLedDim = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30, 35, 40, 45, 50];
const kDisplayContrast = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

const kTriggerLabels = ['Hold', 'Double-Press'];
const kMotorDispLabels = ['Speed', 'Voltage', 'RPM', 'MOT Temp'];
const kLedIdleLabels = ['SOC', 'Speed', 'RPM'];
const kLedDispLabels = ['SOC', 'RPM', 'Speed', 'Temp'];
const kThemeLabels = ['Off', 'White', 'Blue', 'Green', 'Pink', 'Orange', 'Yellow'];
const kMotorTypeLabels = ['Generic (PWM)', 'Xiaomi G'];

function cycleInList(v: number, list: number[]): number {
  const idx = list.indexOf(v);
  return list[(idx >= 0 ? idx + 1 : 0) % list.length];
}

function maxDutyLowerBound(minDuty: number): number {
  return Math.max(50, minDuty + 1);
}

function clampMaxDuty(max: number, min: number): number {
  const lo = maxDutyLowerBound(min);
  return Math.min(100, Math.max(lo, max));
}

export function cycleRuntimeSetting(rs: RuntimeSettings, key: keyof RuntimeSettings): void {
  switch (key) {
    case 'autoOffMinutes':
      rs.autoOffMinutes = cycleInList(rs.autoOffMinutes, kAutoOff);
      break;
    case 'tempLimitC':
      rs.tempLimitC = cycleInList(rs.tempLimitC, kTempLim);
      break;
    case 'speedStepPercent':
      rs.speedStepPercent = cycleInList(rs.speedStepPercent, kSpdStep);
      break;
    case 'minDutyPercent':
      rs.minDutyPercent = cycleInList(rs.minDutyPercent, kMinDuty);
      rs.maxDutyPercent = clampMaxDuty(rs.maxDutyPercent, rs.minDutyPercent);
      break;
    case 'maxDutyPercent': {
      const lo = maxDutyLowerBound(rs.minDutyPercent);
      let v = clampMaxDuty(rs.maxDutyPercent, rs.minDutyPercent);
      v = v < 100 ? v + 1 : lo;
      rs.maxDutyPercent = v;
      break;
    }
    case 'batterySeriesCells':
      rs.batterySeriesCells = cycleInList(rs.batterySeriesCells, kBatCells);
      break;
    case 'sleepTimerMinutes':
      rs.sleepTimerMinutes = cycleInList(rs.sleepTimerMinutes, kSleep);
      break;
    case 'triggerMode':
      rs.triggerMode = rs.triggerMode === 0 ? 1 : 0;
      break;
    case 'motorDisplayMode':
      rs.motorDisplayMode = ((rs.motorDisplayMode + 1) % 4) as MotorDisplayMode;
      break;
    case 'ledIdleDisplayMode':
      rs.ledIdleDisplayMode = (rs.ledIdleDisplayMode + 1) % 3;
      break;
    case 'ledDisplayMode':
      rs.ledDisplayMode = (rs.ledDisplayMode + 1) % 4;
      break;
    case 'ledDimPercent':
      rs.ledDimPercent = cycleInList(rs.ledDimPercent, kLedDim);
      break;
    case 'displayContrastPercent':
      rs.displayContrastPercent = cycleInList(rs.displayContrastPercent, kDisplayContrast);
      break;
    case 'ledTheme':
      rs.ledTheme = (rs.ledTheme + 1) % 7;
      break;
    case 'motorType':
      rs.motorType = rs.motorType === 0 ? 1 : 0;
      break;
  }
}

export function formatSettingValue(rs: RuntimeSettings, key: keyof RuntimeSettings): string {
  switch (key) {
    case 'autoOffMinutes':
      return rs.autoOffMinutes === 0 ? 'OFF' : `${rs.autoOffMinutes}m`;
    case 'tempLimitC':
      return rs.tempLimitC === 0 ? 'OFF' : `${rs.tempLimitC}C`;
    case 'speedStepPercent':
      return `${rs.speedStepPercent}%`;
    case 'minDutyPercent':
    case 'maxDutyPercent':
      return `${rs[key]}%`;
    case 'batterySeriesCells':
      return `${rs.batterySeriesCells}S`;
    case 'sleepTimerMinutes':
      return `${rs.sleepTimerMinutes}m`;
    case 'triggerMode':
      return `${rs.triggerMode + 1}`;
    case 'motorDisplayMode':
    case 'ledIdleDisplayMode':
    case 'ledDisplayMode':
    case 'ledTheme':
      return `${rs[key] + 1}`;
    case 'ledDimPercent':
    case 'displayContrastPercent':
      return `${rs[key]}%`;
    case 'motorType':
      return `${rs.motorType + 1}`;
    default:
      return '-';
  }
}

export function formatSettingSubline(rs: RuntimeSettings, key: keyof RuntimeSettings): string {
  switch (key) {
    case 'batterySeriesCells':
      return `Max V: ${(rs.batterySeriesCells * 4.2).toFixed(1)}V`;
    case 'triggerMode':
      return kTriggerLabels[rs.triggerMode];
    case 'motorDisplayMode':
      return `Show: ${kMotorDispLabels[rs.motorDisplayMode]}`;
    case 'ledIdleDisplayMode':
      return kLedIdleLabels[rs.ledIdleDisplayMode];
    case 'ledDisplayMode':
      return kLedDispLabels[rs.ledDisplayMode];
    case 'ledTheme':
      return kThemeLabels[rs.ledTheme];
    case 'motorType':
      return kMotorTypeLabels[rs.motorType];
    default:
      return '';
  }
}

export function settingVisibleForMotorType(key: keyof RuntimeSettings, motorType: MotorType): boolean {
  if (motorType === 1) {
    return key !== 'speedStepPercent' && key !== 'minDutyPercent' && key !== 'maxDutyPercent';
  }
  return true;
}

export interface DevSettingMeta {
  key: keyof RuntimeSettings;
  title: string;
  subline?: string;
}

export const DEV_SETTING_ORDER: DevSettingMeta[] = [
  { key: 'autoOffMinutes', title: 'Auto-Off', subline: 'Motor Shutdown' },
  { key: 'tempLimitC', title: 'Temp. Shutdown', subline: 'Motor NTC' },
  { key: 'speedStepPercent', title: 'Speed Steps', subline: 'Increase by ...' },
  { key: 'minDutyPercent', title: 'Minimum Duty', subline: 'Motor PWM Floor' },
  { key: 'maxDutyPercent', title: 'Maximum Duty', subline: '@ speed 100%' },
  { key: 'batterySeriesCells', title: 'Battery Cells' },
  { key: 'sleepTimerMinutes', title: 'Sleep Timer', subline: 'UI + Controller' },
  { key: 'triggerMode', title: 'Trigger Mode' },
  { key: 'motorDisplayMode', title: 'Live-Display' },
  { key: 'ledIdleDisplayMode', title: 'LED (Idle)' },
  { key: 'ledDisplayMode', title: 'LED (Motor On)' },
  { key: 'ledDimPercent', title: 'Off-Led', subline: 'Brightness' },
  { key: 'ledTheme', title: 'LED Theme' },
  { key: 'displayContrastPercent', title: 'Display Brightness', subline: 'OLED Contrast' },
  { key: 'motorType', title: 'Motor Type' },
];

export const INFO_PAGE_COUNT = 6;

export function devMenuPageCount(rs: RuntimeSettings): number {
  const visible = DEV_SETTING_ORDER.filter((d) => settingVisibleForMotorType(d.key, rs.motorType));
  return INFO_PAGE_COUNT + visible.length;
}

export function devSettingAtPage(rs: RuntimeSettings, page: number): DevSettingMeta | null {
  if (page < INFO_PAGE_COUNT) return null;
  const visible = DEV_SETTING_ORDER.filter((d) => settingVisibleForMotorType(d.key, rs.motorType));
  const idx = page - INFO_PAGE_COUNT;
  return visible[idx] ?? null;
}
