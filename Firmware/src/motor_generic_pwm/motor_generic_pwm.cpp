#include "motor_generic_pwm.h"

#include <Arduino.h>
#include <string.h>

#include "../settings/settings.h"
#include "../tachometer/tachometer.h"

namespace {
constexpr uint8_t PWM_PIN = 5;
constexpr int PWM_CHANNEL = 0;
constexpr int PWM_RES_BITS = 8;
constexpr int PWM_FREQ_HZ = 1000;

static int duty = 0;
static bool running = false;
static bool pinAttached = false;

// Speed-level synthesis (max 101 steps if step==1)
constexpr uint8_t kMaxSynthLevels = 101;
static MotorSpeedLevel s_levels[kMaxSynthLevels];
static char s_levelLabels[kMaxSynthLevels][12];

void applyDutyFromSpeedPercent(uint8_t speedPct) {
  const uint8_t minP = getRuntimeSettings().minDutyPercent;
  const uint8_t maxP = clampMaxDutyPercent(getRuntimeSettings().maxDutyPercent, minP);
  int pwmDuty = 0;
  if (speedPct > 0) {
    const int minDuty = static_cast<int>((minP * 255) / 100);
    const int maxDuty = static_cast<int>((maxP * 255) / 100);
    pwmDuty = minDuty + (static_cast<int>(speedPct) * (maxDuty - minDuty)) / 100;
  }
  motorGenericPwmSetDuty(pwmDuty);
}

void pwmInit() {
  ledcSetup(PWM_CHANNEL, PWM_FREQ_HZ, PWM_RES_BITS);
  running = false;
  duty = 0;
  pinAttached = false;
  ledcDetachPin(PWM_PIN);
  pinMode(PWM_PIN, OUTPUT);
  digitalWrite(PWM_PIN, LOW);
}

void pwmDeinit() {
  motorGenericPwmStop();
}

void pwmUpdate() {}

void pwmOnPowerOn() {}

void pwmOnPowerOff() {}

void pwmSetSpeedPercent(uint8_t percent) {
  if (percent > 100) {
    percent = 100;
  }
  applyDutyFromSpeedPercent(percent);
}

bool pwmIsRunning() {
  return running;
}

float pwmGetRpm() {
  return getRPM();
}

bool pwmIsRpmReady() {
  return isRPMReady();
}

MotorSpeedLevels pwmGetSpeedLevels(uint8_t configuredStepPct, uint8_t /*minDutyPct*/, uint8_t /*maxDutyPct*/) {
  uint8_t step = configuredStepPct;
  if (step == 0) {
    step = 20;
  }
  uint8_t n = 0;
  for (unsigned v = 0; v <= 100 && n < kMaxSynthLevels; v += step) {
    snprintf(s_levelLabels[n], sizeof(s_levelLabels[n]), "%u %%", static_cast<unsigned>(v));
    s_levels[n].valuePercent = static_cast<uint8_t>(v);
    s_levels[n].label = s_levelLabels[n];
    ++n;
  }
  if (n > 0 && s_levels[n - 1].valuePercent < 100) {
    snprintf(s_levelLabels[n], sizeof(s_levelLabels[n]), "100 %%");
    s_levels[n].valuePercent = 100;
    s_levels[n].label = s_levelLabels[n];
    ++n;
  }
  return MotorSpeedLevels{n, s_levels};
}

void pwmHandleWsCommand(const char* key, int value) {
  if (strcmp(key, "speed") != 0) {
    return;
  }
  int speed = value;
  if (speed < 0) {
    speed = 0;
  }
  if (speed > 255) {
    speed = 255;
  }
  Serial.printf("[Motor] Setting speed to %d\n", speed);
  if (speed == 0) {
    motorGenericPwmStop();
    Serial.println("[Motor] Motor stopped");
  } else {
    motorGenericPwmSetDuty(speed);
    motorGenericPwmStart();
    Serial.printf("[Motor] Motor started at duty %d\n", speed);
  }
}

void pwmHandleHeartbeat() {}

bool pwmSupportsGlobal(DevSettingId /*id*/) {
  return true;
}

MotorDriverSettings pwmDriverSettings() {
  return MotorDriverSettings{0, nullptr};
}

}  // namespace

void motorGenericPwmSetDuty(int newDuty) {
  if (newDuty < 0) {
    newDuty = 0;
  }
  if (newDuty > 255) {
    newDuty = 255;
  }
  duty = newDuty;
  if (duty == 0) {
    if (pinAttached) {
      ledcDetachPin(PWM_PIN);
      pinAttached = false;
    }
    pinMode(PWM_PIN, OUTPUT);
    digitalWrite(PWM_PIN, LOW);
    running = false;
  } else {
    if (!pinAttached) {
      ledcAttachPin(PWM_PIN, PWM_CHANNEL);
      pinAttached = true;
    }
    if (running) {
      ledcWrite(PWM_CHANNEL, duty);
    }
  }
}

void motorGenericPwmStart() {
  if (duty > 0 && !pinAttached) {
    ledcAttachPin(PWM_PIN, PWM_CHANNEL);
    pinAttached = true;
  }
  running = true;
  if (duty > 0) {
    ledcWrite(PWM_CHANNEL, duty);
  }
}

void motorGenericPwmStop() {
  running = false;
  ledcWrite(PWM_CHANNEL, 0);
  if (pinAttached) {
    ledcDetachPin(PWM_PIN);
    pinAttached = false;
  }
  pinMode(PWM_PIN, OUTPUT);
  digitalWrite(PWM_PIN, LOW);
}

int motorGenericPwmGetDuty() {
  return duty;
}

bool motorGenericPwmIsRunning() {
  return running;
}

const MotorDriver kGenericPwmDriver = {
    "Generic (PWM)",
    "generic-pwm",
    MotorCapabilities{true, false, false},
    pwmInit,
    pwmDeinit,
    pwmUpdate,
    pwmOnPowerOn,
    pwmOnPowerOff,
    pwmSetSpeedPercent,
    pwmIsRunning,
    pwmGetRpm,
    pwmIsRpmReady,
    pwmGetSpeedLevels,
    pwmHandleWsCommand,
    pwmHandleHeartbeat,
    pwmSupportsGlobal,
    pwmDriverSettings,
};
