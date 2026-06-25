#include "motor.h"

#include <Arduino.h>

#include "../motor_generic_pwm/motor_generic_pwm.h"
#include "../motor_xiaomi_g/motor_xiaomi_g.h"
#include "../settings/settings.h"

static const MotorDriver* s_active = nullptr;
static bool s_nonPwmPowerSeq = false;

static const MotorDriver* motorDriverForType(MotorType t) {
  switch (t) {
    case MotorType::XiaomiG:
      return &kXiaomiGDriver;
    case MotorType::GenericPwm:
    default:
      return &kGenericPwmDriver;
  }
}

void initMotor(MotorType type) {
  const MotorDriver* next = motorDriverForType(type);
  if (s_active && s_active->deinit) {
    s_active->deinit();
  }
  s_active = next;
  s_nonPwmPowerSeq = false;
  if (s_active && s_active->init) {
    s_active->init();
  }
}

void updateMotor() {
  if (s_active && s_active->update) {
    s_active->update();
  }
}

void setMotorSpeedPercent(uint8_t percent) {
  if (!s_active || !s_active->setSpeedPercent) {
    return;
  }
  s_active->setSpeedPercent(percent);
}

void setMotorDuty(int duty) {
  if (s_active == &kGenericPwmDriver) {
    motorGenericPwmSetDuty(duty);
  }
}

void startMotor() {
  if (s_active == &kGenericPwmDriver) {
    motorGenericPwmStart();
    return;
  }
  if (!s_nonPwmPowerSeq && s_active && s_active->onPowerOn) {
    s_active->onPowerOn();
    s_nonPwmPowerSeq = true;
  }
}

void stopMotor() {
  if (s_active == &kGenericPwmDriver) {
    motorGenericPwmStop();
    return;
  }
  if (s_nonPwmPowerSeq && s_active && s_active->onPowerOff) {
    s_active->onPowerOff();
    s_nonPwmPowerSeq = false;
  }
}

int getMotorDuty() {
  if (s_active == &kGenericPwmDriver) {
    return motorGenericPwmGetDuty();
  }
  return 0;
}

bool isMotorRunning() {
  if (s_active == &kGenericPwmDriver) {
    return motorGenericPwmIsRunning();
  }
  if (s_active && s_active->isRunning) {
    return s_active->isRunning();
  }
  return false;
}

void handleMotorCommand(const char* key, int value) {
  if (s_active && s_active->handleWebSocketCommand) {
    s_active->handleWebSocketCommand(key, value);
  }
}

void handleMotorHeartbeat() {
  if (s_active && s_active->handleHeartbeat) {
    s_active->handleHeartbeat();
  }
}

bool motorHasRpm() {
  return s_active && s_active->caps.hasRpm;
}

float motorGetRpm() {
  if (!motorHasRpm() || !s_active || !s_active->getRpm) {
    return 0.0f;
  }
  return s_active->getRpm();
}

bool motorIsRpmReady() {
  if (!motorHasRpm() || !s_active || !s_active->isRpmReady) {
    return false;
  }
  return s_active->isRpmReady();
}

MotorSpeedLevels motorGetSpeedLevels() {
  if (!s_active || !s_active->getSpeedLevels) {
    return MotorSpeedLevels{0, nullptr};
  }
  const RuntimeSettings& rs = getRuntimeSettings();
  return s_active->getSpeedLevels(rs.speedStepPercent, rs.minDutyPercent, rs.maxDutyPercent);
}

uint8_t motorNextSpeedPercent(uint8_t current) {
  MotorSpeedLevels lv = motorGetSpeedLevels();
  if (lv.count == 0 || !lv.levels) {
    return current >= 100 ? 100 : static_cast<uint8_t>(current + 1);
  }
  for (uint8_t i = 0; i < lv.count; ++i) {
    if (lv.levels[i].valuePercent > current) {
      return lv.levels[i].valuePercent;
    }
  }
  return lv.levels[lv.count - 1].valuePercent;
}

uint8_t motorPrevSpeedPercent(uint8_t current) {
  MotorSpeedLevels lv = motorGetSpeedLevels();
  if (lv.count == 0 || !lv.levels) {
    return current == 0 ? 0 : static_cast<uint8_t>(current - 1);
  }
  if (current == 0) {
    return 0;
  }
  uint8_t prev = lv.levels[0].valuePercent;
  for (uint8_t i = 0; i < lv.count; ++i) {
    if (lv.levels[i].valuePercent >= current) {
      break;
    }
    prev = lv.levels[i].valuePercent;
  }
  return prev;
}

const char* motorActiveDriverName() {
  if (!s_active || !s_active->name) {
    return "?";
  }
  return s_active->name;
}

bool motorDriverSupportsGlobalSetting(DevSettingId id) {
  if (!s_active || !s_active->supportsGlobalSetting) {
    return true;
  }
  return s_active->supportsGlobalSetting(id);
}

MotorDriverSettings motorActiveDriverSettings() {
  if (!s_active || !s_active->driverSettings) {
    return MotorDriverSettings{0, nullptr};
  }
  return s_active->driverSettings();
}
