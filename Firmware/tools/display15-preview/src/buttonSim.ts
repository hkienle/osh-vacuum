import type { Display15Scenario, DisplayTelemetry } from './types';
import {
  cycleRuntimeSetting,
  DEFAULT_RUNTIME_SETTINGS,
  devMenuPageCount,
  devSettingAtPage,
  formatSettingSubline,
  formatSettingValue,
  INFO_PAGE_COUNT,
  type RuntimeSettings,
} from './settings';

export const TRIGGER_START_HOLD_MS = 1250;
export const INFO_MODE_HOLD_MS = 1500;
export const DEBOUNCE_DELAY_MS = 50;
export const DOUBLE_PRESS_WINDOW_MS = 300;

export type ButtonId = 'trigger' | 'up' | 'down';

export interface ButtonSimSnapshot {
  speedPercent: number;
  motorActive: boolean;
  displayInfoMode: boolean;
  displayInfoPage: number;
  triggerHeld: boolean;
  settings: RuntimeSettings;
  dualHoldProgress: number;
  triggerHoldProgress: number;
  statusLine: string;
}

export interface ButtonSimEnv {
  wifi: { ssid: string; ip: string; rssi: number | null; apMode?: boolean };
  hostname: string;
  batteryVoltage: number;
  batterySocPercent: number;
  temperatureC: number;
  motorTemperatureReady: boolean;
  mcuTempC: number;
  rpmReady: boolean;
  uptimeSeconds: number;
  freeHeapBytes: number;
  maxStatsRpm: number;
  maxStatsHasRpm: boolean;
  maxStatsVoltageV: number;
  maxStatsHasVoltage: boolean;
  maxStatsMotorTempC: number;
  maxStatsHasMotorTemp: boolean;
  otaActive: boolean;
  otaProgressPercent: number;
}

export const DEFAULT_ENV: ButtonSimEnv = {
  wifi: { ssid: 'TheLab IoT', ip: '192.168.1.42', rssi: -58 },
  hostname: 'osh-vac',
  batteryVoltage: 18.5,
  batterySocPercent: 72,
  temperatureC: 42.3,
  motorTemperatureReady: true,
  mcuTempC: 38.1,
  rpmReady: true,
  uptimeSeconds: 3600 + 23 * 60,
  freeHeapBytes: 180_000,
  maxStatsRpm: 42_500,
  maxStatsHasRpm: true,
  maxStatsVoltageV: 19.2,
  maxStatsHasVoltage: true,
  maxStatsMotorTempC: 55.4,
  maxStatsHasMotorTemp: true,
  otaActive: false,
  otaProgressPercent: 0,
};

export class ButtonSimulator {
  private speedPercent = 0;
  private motorActive = false;
  private displayInfoMode = false;
  private displayInfoPage = 0;
  private settings: RuntimeSettings = structuredClone(DEFAULT_RUNTIME_SETTINGS);
  private env: ButtonSimEnv = structuredClone(DEFAULT_ENV);
  private nowMs = 0;

  private pressed = { trigger: false, up: false, down: false };
  private upState = false;
  private downState = false;
  private triggerLastState = false;
  private lastDebounceTime = 0;
  private dualButtonHoldStart = 0;
  private infoModeExitHoldStart = 0;
  private devMenuExitArmed = false;
  private triggerHoldStart = 0;
  private triggerStopArmed = true;
  private lastTriggerReleaseMs = 0;
  private doublePressLatched = false;
  private momentaryTriggerRun = false;
  private statusLine = 'Ready — use UP / DOWN / TRIGGER';

  setButton(id: ButtonId, down: boolean): void {
    this.pressed[id] = down;
  }

  getSnapshot(): ButtonSimSnapshot {
    return {
      speedPercent: this.speedPercent,
      motorActive: this.motorActive,
      displayInfoMode: this.displayInfoMode,
      displayInfoPage: this.displayInfoPage,
      triggerHeld: this.isTriggerPressed(),
      settings: structuredClone(this.settings),
      dualHoldProgress: this.dualHoldProgress(),
      triggerHoldProgress: this.triggerHoldProgress(),
      statusLine: this.statusLine,
    };
  }

  loadPreset(partial: {
    speedPercent?: number;
    motorActive?: boolean;
    displayInfoMode?: boolean;
    displayInfoPage?: number;
    triggerHeld?: boolean;
    settings?: Partial<RuntimeSettings>;
    env?: Partial<ButtonSimEnv>;
  }): void {
    if (partial.speedPercent !== undefined) this.speedPercent = partial.speedPercent;
    if (partial.motorActive !== undefined) this.motorActive = partial.motorActive;
    if (partial.displayInfoMode !== undefined) this.displayInfoMode = partial.displayInfoMode;
    if (partial.displayInfoPage !== undefined) this.displayInfoPage = partial.displayInfoPage;
    if (partial.settings) Object.assign(this.settings, partial.settings);
    if (partial.env) Object.assign(this.env, partial.env);
    this.resetButtonEdges();
    if (partial.triggerHeld) this.pressed.trigger = true;
    this.statusLine = 'Preset loaded';
  }

  tick(nowMs: number): void {
    this.nowMs = nowMs;
    const triggerReading = this.pressed.trigger;
    const upReading = this.pressed.up;
    const downReading = this.pressed.down;
    const bothHeld = upReading && downReading;

    if (upReading !== this.upState || downReading !== this.downState) {
      this.lastDebounceTime = nowMs;
    }
    const debounced = nowMs - this.lastDebounceTime > DEBOUNCE_DELAY_MS;
    const triggerPressedEdge = triggerReading && !this.triggerLastState;

    if (this.displayInfoMode) {
      this.tickInfoMode(nowMs, triggerReading, upReading, downReading, bothHeld, debounced, triggerPressedEdge);
      this.triggerLastState = triggerReading;
      return;
    }

    this.tickMainMode(nowMs, triggerReading, upReading, downReading, bothHeld, debounced, triggerPressedEdge);
    this.triggerLastState = triggerReading;
  }

  buildScenario(): Display15Scenario {
    const snap = this.getSnapshot();
    const rpm = snap.motorActive ? 800 + snap.speedPercent * 640 : 0;
    const telemetry: DisplayTelemetry = {
      speedPercent: snap.speedPercent,
      batteryVoltage: this.env.batteryVoltage,
      temperatureC: this.env.temperatureC,
      motorTemperatureReady: this.env.motorTemperatureReady,
      mcuTempC: this.env.mcuTempC,
      rpm,
      triggerHeld: snap.triggerHeld,
      rpmReady: this.env.rpmReady,
      batterySocPercent: this.env.batterySocPercent,
      motorActive: snap.motorActive,
      displayInfoMode: snap.displayInfoMode,
      displayInfoPage: snap.displayInfoPage,
      uptimeSeconds: this.env.uptimeSeconds,
      freeHeapBytes: this.env.freeHeapBytes,
      batterySeriesCells: snap.settings.batterySeriesCells,
      otaActive: this.env.otaActive,
      otaProgressPercent: this.env.otaProgressPercent,
      motorDisplayMode: snap.settings.motorDisplayMode,
      maxStatsRpm: this.env.maxStatsRpm,
      maxStatsHasRpm: this.env.maxStatsHasRpm,
      maxStatsVoltageV: this.env.maxStatsVoltageV,
      maxStatsHasVoltage: this.env.maxStatsHasVoltage,
      maxStatsMotorTempC: this.env.maxStatsMotorTempC,
      maxStatsHasMotorTemp: this.env.maxStatsHasMotorTemp,
    };

    const scenario: Display15Scenario = {
      id: 'interactive',
      label: 'Interactive',
      telemetry,
      wifi: this.env.wifi,
      hostname: this.env.hostname,
    };

    const devMeta = devSettingAtPage(snap.settings, snap.displayInfoPage);
    if (devMeta && snap.displayInfoMode) {
      const sub = devMeta.subline ?? formatSettingSubline(snap.settings, devMeta.key);
      scenario.devSetting = {
        title: devMeta.title,
        subline: sub || undefined,
        value: formatSettingValue(snap.settings, devMeta.key),
      };
    }

    return scenario;
  }

  private tickInfoMode(
    nowMs: number,
    triggerReading: boolean,
    upReading: boolean,
    downReading: boolean,
    bothHeld: boolean,
    debounced: boolean,
    triggerPressedEdge: boolean,
  ): void {
    const pageCount = devMenuPageCount(this.settings);

    if (!bothHeld) {
      this.devMenuExitArmed = true;
      this.infoModeExitHoldStart = 0;
    }

    if (bothHeld && this.devMenuExitArmed) {
      if (this.infoModeExitHoldStart === 0) {
        this.infoModeExitHoldStart = nowMs;
      } else if (nowMs - this.infoModeExitHoldStart >= INFO_MODE_HOLD_MS) {
        this.displayInfoMode = false;
        this.devMenuExitArmed = false;
        this.infoModeExitHoldStart = 0;
        this.dualButtonHoldStart = 0;
        this.statusLine = 'Dev menu closed (UP+DOWN hold)';
        this.upState = upReading;
        this.downState = downReading;
        return;
      }
      this.statusLine = 'Hold UP+DOWN to close menu…';
    } else if (bothHeld) {
      this.infoModeExitHoldStart = 0;
      this.statusLine = 'Release UP+DOWN first, then hold to close';
    }

    if (debounced && !bothHeld) {
      if (upReading && !this.upState) {
        this.displayInfoPage = (this.displayInfoPage + 1) % pageCount;
        this.statusLine = `Page ${this.displayInfoPage + 1}/${pageCount}`;
      }
      if (downReading && !this.downState) {
        this.displayInfoPage = (this.displayInfoPage + pageCount - 1) % pageCount;
        this.statusLine = `Page ${this.displayInfoPage + 1}/${pageCount}`;
      }
      this.upState = upReading;
      this.downState = downReading;
    }

    if (triggerPressedEdge && this.displayInfoPage >= INFO_PAGE_COUNT) {
      const meta = devSettingAtPage(this.settings, this.displayInfoPage);
      if (meta) {
        cycleRuntimeSetting(this.settings, meta.key);
        this.statusLine = `Cycled ${meta.title}`;
      }
    }
  }

  private tickMainMode(
    nowMs: number,
    triggerReading: boolean,
    upReading: boolean,
    downReading: boolean,
    bothHeld: boolean,
    debounced: boolean,
    triggerPressedEdge: boolean,
  ): void {
    if (bothHeld) {
      if (this.dualButtonHoldStart === 0) {
        this.dualButtonHoldStart = nowMs;
      } else if (nowMs - this.dualButtonHoldStart >= INFO_MODE_HOLD_MS) {
        this.displayInfoMode = true;
        this.displayInfoPage = 0;
        this.dualButtonHoldStart = 0;
        this.infoModeExitHoldStart = 0;
        this.devMenuExitArmed = false;
        this.upState = upReading;
        this.downState = downReading;
        this.statusLine = 'Dev menu opened (UP+DOWN hold)';
        return;
      }
      this.statusLine = 'Hold UP+DOWN to open menu…';
    } else {
      this.dualButtonHoldStart = 0;
    }

    if (this.settings.triggerMode === 0) {
      this.tickTriggerHoldMode(nowMs, triggerReading, triggerPressedEdge);
    } else {
      this.tickTriggerDoubleMode(nowMs, triggerReading, triggerPressedEdge);
    }

    if (debounced && !bothHeld) {
      const step = this.settings.speedStepPercent;
      if (upReading && !this.upState) {
        this.speedPercent = Math.min(100, this.speedPercent + step);
        this.statusLine = `Speed ${this.speedPercent}%`;
      }
      if (downReading && !this.downState) {
        this.speedPercent = Math.max(0, this.speedPercent - step);
        this.statusLine = `Speed ${this.speedPercent}%`;
      }
      this.upState = upReading;
      this.downState = downReading;
    }
  }

  private tickTriggerHoldMode(nowMs: number, triggerReading: boolean, triggerPressedEdge: boolean): void {
    if (!this.motorActive) {
      if (!this.triggerStopArmed) {
        this.triggerHoldStart = 0;
        if (!triggerReading) this.triggerStopArmed = true;
      } else if (triggerReading) {
        if (this.triggerHoldStart === 0) {
          this.triggerHoldStart = nowMs;
        } else if (nowMs - this.triggerHoldStart >= TRIGGER_START_HOLD_MS) {
          this.motorActive = true;
          this.triggerStopArmed = false;
          this.triggerHoldStart = 0;
          this.statusLine = 'Motor started (trigger hold)';
        } else {
          this.statusLine = 'Hold trigger to start…';
        }
      } else {
        this.triggerHoldStart = 0;
      }
    } else {
      this.triggerHoldStart = 0;
      if (!this.triggerStopArmed) {
        if (!triggerReading) this.triggerStopArmed = true;
      } else if (triggerPressedEdge) {
        this.motorActive = false;
        this.triggerStopArmed = false;
        this.statusLine = 'Motor stopped';
      }
    }
    this.doublePressLatched = false;
    this.momentaryTriggerRun = false;
    this.lastTriggerReleaseMs = 0;
  }

  private tickTriggerDoubleMode(nowMs: number, triggerReading: boolean, triggerPressedEdge: boolean): void {
    this.triggerHoldStart = 0;
    const triggerReleasedEdge = !triggerReading && this.triggerLastState;

    if (triggerPressedEdge) {
      if (this.doublePressLatched) {
        this.motorActive = false;
        this.doublePressLatched = false;
        this.momentaryTriggerRun = false;
        this.triggerStopArmed = false;
        this.statusLine = 'Motor stopped (double-press mode)';
      } else {
        const isDouble =
          this.lastTriggerReleaseMs !== 0 &&
          nowMs - this.lastTriggerReleaseMs <= DOUBLE_PRESS_WINDOW_MS;
        if (isDouble) {
          this.motorActive = true;
          this.doublePressLatched = true;
          this.momentaryTriggerRun = false;
          this.triggerStopArmed = true;
          this.statusLine = 'Motor latched on (double-press)';
        } else {
          this.motorActive = true;
          this.momentaryTriggerRun = true;
          this.triggerStopArmed = true;
          this.statusLine = 'Motor momentary on';
        }
      }
    }

    if (triggerReleasedEdge) {
      this.lastTriggerReleaseMs = nowMs;
      if (this.momentaryTriggerRun && !this.doublePressLatched) {
        this.motorActive = false;
        this.momentaryTriggerRun = false;
        this.triggerStopArmed = false;
        this.statusLine = 'Motor momentary off';
      } else {
        this.momentaryTriggerRun = false;
      }
    }
  }

  private isTriggerPressed(): boolean {
    if (!this.motorActive && !this.triggerStopArmed) return false;
    return this.pressed.trigger;
  }

  private dualHoldProgress(): number {
    const start = this.displayInfoMode ? this.infoModeExitHoldStart : this.dualButtonHoldStart;
    if (start === 0) return 0;
    return Math.min(1, (this.nowMs - start) / INFO_MODE_HOLD_MS);
  }

  private triggerHoldProgress(): number {
    if (this.triggerHoldStart === 0 || this.motorActive) return 0;
    return Math.min(1, (this.nowMs - this.triggerHoldStart) / TRIGGER_START_HOLD_MS);
  }

  private resetButtonEdges(): void {
    this.upState = false;
    this.downState = false;
    this.triggerLastState = false;
    this.triggerHoldStart = 0;
    this.dualButtonHoldStart = 0;
    this.infoModeExitHoldStart = 0;
    this.triggerStopArmed = true;
    this.pressed = { trigger: false, up: false, down: false };
  }
}
