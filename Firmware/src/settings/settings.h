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
  MotorDisplayMode motorDisplayMode = MotorDisplayMode::Rpm;
  TriggerMode triggerMode = TriggerMode::Hold;
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

#endif  // SETTINGS_H
