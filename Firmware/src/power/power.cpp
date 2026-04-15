#include "power.h"

#include <Arduino.h>
#include <driver/gpio.h>
#include <esp_sleep.h>

#include "../button/button.h"
#include "../display/display.h"
#include "../led/led.h"
#include "../motor_pwm/motor_pwm.h"
#include "../settings/settings.h"
#include "../settings/settings_config.h"

namespace {
uint32_t inactivitySleepMsForSettings() {
  const uint8_t m = getRuntimeSettings().sleepTimerMinutes;
  if (m == 0) {
    return UINT32_MAX;
  }
  return static_cast<uint32_t>(m) * 60UL * 1000UL;
}
constexpr uint32_t WAKE_GUARD_MS = 500UL;

uint32_t lastActivityMs = 0;
uint32_t wakeGuardUntilMs = 0;

void configureWakeupButtons() {
  gpio_wakeup_enable(static_cast<gpio_num_t>(TRIGGER_PIN), GPIO_INTR_LOW_LEVEL);
  gpio_wakeup_enable(static_cast<gpio_num_t>(UP_PIN), GPIO_INTR_LOW_LEVEL);
  gpio_wakeup_enable(static_cast<gpio_num_t>(DOWN_PIN), GPIO_INTR_LOW_LEVEL);
  esp_sleep_enable_gpio_wakeup();
}

void disableWakeupButtons() {
  gpio_wakeup_disable(static_cast<gpio_num_t>(TRIGGER_PIN));
  gpio_wakeup_disable(static_cast<gpio_num_t>(UP_PIN));
  gpio_wakeup_disable(static_cast<gpio_num_t>(DOWN_PIN));
}
}  // namespace

void initPowerManagement() {
  lastActivityMs = millis();
  wakeGuardUntilMs = 0;
}

bool updatePowerManagement(bool buttonActivity, bool motorActive, bool otaActive) {
  const uint32_t now = millis();
  if (buttonActivity || motorActive || otaActive) {
    lastActivityMs = now;
    return false;
  }

  if (static_cast<int32_t>(now - wakeGuardUntilMs) < 0) {
    return false;
  }

  const uint32_t sleepAfter = inactivitySleepMsForSettings();
  if (sleepAfter == UINT32_MAX) {
    lastActivityMs = now;
    return false;
  }
  if (now - lastActivityMs < sleepAfter) {
    return false;
  }

  stopMotor();
  setMotorState(false);
  turnOffLEDsNow();
  prepareDisplayForSleep();

  configureWakeupButtons();
  Serial.println("[Power] Entering light sleep...");
  delay(10);
  esp_light_sleep_start();
  Serial.printf("[Power] Wakeup cause: %d\n", static_cast<int>(esp_sleep_get_wakeup_cause()));
  disableWakeupButtons();

  resetButtonRuntimeStateKeepSpeed();
  resumeDisplayAfterSleep();
  const uint32_t resumeNow = millis();
  wakeGuardUntilMs = resumeNow + WAKE_GUARD_MS;
  lastActivityMs = resumeNow;
  return true;
}
