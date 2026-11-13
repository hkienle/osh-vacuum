#ifndef MOTOR_DRIVER_H
#define MOTOR_DRIVER_H

#include <stdint.h>

#include "../settings/dev_menu.h"

#ifdef __cplusplus
extern "C" {
#endif

struct MotorSpeedLevel {
  uint8_t valuePercent;
  const char* label;
};

struct MotorSpeedLevels {
  uint8_t count;
  const MotorSpeedLevel* levels;
};

struct MotorCapabilities {
  bool hasRpm;
  bool isDiscreteSpeed;
  bool overridesSpeedStep;
};

struct MotorDriverSettings {
  uint8_t count;
  const DevSettingDescriptor* items;
};

struct MotorDriver {
  const char* name;
  const char* nvsValue;
  MotorCapabilities caps;
  void (*init)();
  void (*deinit)();
  void (*update)();
  void (*onPowerOn)();
  void (*onPowerOff)();
  void (*setSpeedPercent)(uint8_t percent);
  bool (*isRunning)();
  float (*getRpm)();
  bool (*isRpmReady)();
  MotorSpeedLevels (*getSpeedLevels)(uint8_t configuredStepPct, uint8_t minDutyPct, uint8_t maxDutyPct);
  void (*handleWebSocketCommand)(const char* key, int value);
  void (*handleHeartbeat)();
  bool (*supportsGlobalSetting)(DevSettingId id);
  MotorDriverSettings (*driverSettings)();
};

#ifdef __cplusplus
}
#endif

#endif  // MOTOR_DRIVER_H
