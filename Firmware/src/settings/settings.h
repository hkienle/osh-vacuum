#ifndef SETTINGS_H
#define SETTINGS_H

#include <stdint.h>

enum class DisplayType : uint8_t {
  None = 0,
  Waveshare091I2C,
  Waveshare15I2C
};

/** Motor-on main display: Speed %, pack voltage, RPM, or motor NTC temp. */
enum class MotorDisplayMode : uint8_t {
  Speed = 0,
  Voltage = 1,
  Rpm = 2,
  MotorTemp = 3,
};

enum class TriggerMode : uint8_t {
  Hold = 0,
  DoublePress = 1,
};

/** Motor-on LED bar (5 LEDs): SOC, RPM, speed %, or motor NTC temp. */
enum class LedDisplayMode : uint8_t {
  Soc = 0,
  Rpm = 1,
  Speed = 2,
  Temp = 3,
};

/** Idle (motor off) LED bar: SOC, speed setting, or RPM. */
enum class LedIdleDisplayMode : uint8_t {
  Soc = 0,
  Speed = 1,
  Rpm = 2,
};

/** Bar / OTA accent color (lit segments); Off hides colored lit segments. */
enum class LedTheme : uint8_t {
  Off = 0,
  White = 1,
  Blue = 2,
  Green = 3,
  Pink = 4,
  Orange = 5,
  Yellow = 6,
};

struct RuntimeSettings {
  DisplayType displayType = DisplayType::Waveshare091I2C;
  uint8_t batterySeriesCells = 5;  // Series cell count for pack voltage -> SOC mapping (1–32 NVS; UI cycles 1–14S)
  /** 0 = standby sleep disabled; else minutes until light sleep. */
  uint8_t autoOffMinutes = 2;
  /** UI/controller sleep timer in minutes (1,2,5,10,30). */
  uint8_t sleepTimerMinutes = 2;
  /** 0 = off; else NTC °C limit — motor stops if exceeded. */
  uint8_t tempLimitC = 0;
  /** UP/DOWN speed step: 5, 10, 20, or 25. */
  uint8_t speedStepPercent = 20;
  /** Minimum PWM floor as % of 255 when motor runs (0,5,…,30). */
  uint8_t minDutyPercent = 0;
  /** Maximum PWM at speed 100 %: 50–100 % in 1 % steps, always > minDutyPercent. */
  uint8_t maxDutyPercent = 100;
  MotorDisplayMode motorDisplayMode = MotorDisplayMode::Rpm;
  TriggerMode triggerMode = TriggerMode::Hold;
  LedIdleDisplayMode ledIdleDisplayMode = LedIdleDisplayMode::Soc;
  LedDisplayMode ledDisplayMode = LedDisplayMode::Soc;
  /** Inactive bar segments: 0–10 % in 1 % steps, then 15–50 % in 5 % steps. */
  uint8_t ledDimPercent = 0;
  LedTheme ledTheme = LedTheme::White;
};

// Initialize settings subsystem.
void initSettings();

// Load persisted runtime settings into internal store and return reference.
RuntimeSettings& loadRuntimeSettings();

// Save full runtime settings to NVS.
bool saveRuntimeSettings(const RuntimeSettings& settings);

// Mutable live settings (populated by loadRuntimeSettings in setup).
RuntimeSettings& getRuntimeSettings();

// Parse/stringify display type identifiers.
DisplayType parseDisplayType(const char* value);
const char* displayTypeToString(DisplayType type);

/** Lowest allowed max-duty % for a given minimum duty (>= 50 and >= min+1). */
uint8_t maxDutyPercentLowerBound(uint8_t minDutyPercent);
/** Clamp max duty to 50–100 % and strictly above min duty. */
uint8_t clampMaxDutyPercent(uint8_t maxDutyPercent, uint8_t minDutyPercent);

#endif  // SETTINGS_H
