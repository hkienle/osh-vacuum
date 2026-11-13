#include "mcu_temp.h"

#include <ESP.h>

static float lastMcuTempC = NAN;
static uint32_t lastSampleMs = 0;

constexpr uint32_t kSampleIntervalMs = 500;

void initMcuTemperature() {
  lastMcuTempC = NAN;
  lastSampleMs = 0;
}

void updateMcuTemperature() {
  const uint32_t now = millis();
  if (lastSampleMs != 0U && (now - lastSampleMs) < kSampleIntervalMs) {
    return;
  }
  lastSampleMs = now;
  lastMcuTempC = temperatureRead();
}

float getMcuTemperatureC() {
  return lastMcuTempC;
}
