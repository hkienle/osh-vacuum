#include "battery_soc.h"

#include <Arduino.h>
#include <math.h>

#include "../battery/battery.h"
#include "../button/button.h"

namespace {

constexpr size_t kBufferSize = 50;
constexpr uint32_t kSampleIntervalMs = 100;
constexpr uint32_t kMotorCooldownMs = 2000;

struct CurvePoint {
  float voltage;
  float socPercent;
};

// Single Li-ion cell, ascending by voltage (calibrated table).
constexpr CurvePoint kCellCurve[] = {
    {3.520f, 0.0f},   {3.534f, 5.0f},   {3.549f, 10.0f},  {3.568f, 15.0f},
    {3.590f, 20.0f},  {3.626f, 25.0f},  {3.662f, 30.0f},  {3.687f, 35.0f},
    {3.711f, 40.0f},  {3.737f, 45.0f},  {3.762f, 50.0f},  {3.787f, 55.0f},
    {3.811f, 60.0f},  {3.834f, 65.0f},  {3.852f, 70.0f},  {3.878f, 75.0f},
    {3.896f, 80.0f},  {3.922f, 85.0f},  {3.951f, 90.0f},  {3.990f, 95.0f},
    {4.080f, 100.0f},
};

constexpr size_t kCurveLen = sizeof(kCellCurve) / sizeof(kCellCurve[0]);

float samples[kBufferSize];
uint8_t sampleCount = 0;
uint8_t writeIndex = 0;
float runningSum = 0.0f;

bool motorWasActive = false;
uint32_t nextSampleDueMs = 0;
uint8_t seriesCells = 5;

float interpolateSocFromCellVoltage(float cellVoltage) {
  if (cellVoltage >= kCellCurve[kCurveLen - 1].voltage) {
    return kCellCurve[kCurveLen - 1].socPercent;
  }
  if (cellVoltage <= kCellCurve[0].voltage) {
    return kCellCurve[0].socPercent;
  }

  for (size_t i = 0; i + 1 < kCurveLen; ++i) {
    const float v0 = kCellCurve[i].voltage;
    const float v1 = kCellCurve[i + 1].voltage;
    if (cellVoltage >= v0 && cellVoltage <= v1) {
      const float s0 = kCellCurve[i].socPercent;
      const float s1 = kCellCurve[i + 1].socPercent;
      const float t = (cellVoltage - v0) / (v1 - v0);
      return s0 + t * (s1 - s0);
    }
  }
  return 0.0f;
}

float averagePackVoltage() {
  if (sampleCount == 0) {
    return 0.0f;
  }
  return runningSum / static_cast<float>(sampleCount);
}

void pushSample(float v) {
  if (sampleCount < kBufferSize) {
    samples[sampleCount] = v;
    runningSum += v;
    ++sampleCount;
    return;
  }

  runningSum -= samples[writeIndex];
  samples[writeIndex] = v;
  runningSum += v;
  writeIndex = (writeIndex + 1) % kBufferSize;
}

}  // namespace

void initBatterySOC(uint8_t cellCount) {
  if (cellCount < 1) {
    cellCount = 1;
  }
  if (cellCount > 32) {
    cellCount = 32;
  }
  seriesCells = cellCount;

  sampleCount = 0;
  writeIndex = 0;
  runningSum = 0.0f;
  motorWasActive = false;
  nextSampleDueMs = millis() + kSampleIntervalMs;
}

void updateBatterySOC() {
  const bool motorOn = isMotorActive();
  const uint32_t now = millis();

  if (motorOn) {
    motorWasActive = true;
    return;
  }

  if (motorWasActive) {
    motorWasActive = false;
    nextSampleDueMs = now + kMotorCooldownMs;
  }

  if (static_cast<int32_t>(now - nextSampleDueMs) < 0) {
    return;
  }

  if (!isBatteryReady()) {
    nextSampleDueMs = now + kSampleIntervalMs;
    return;
  }

  pushSample(getBatteryVoltage());
  nextSampleDueMs = now + kSampleIntervalMs;
}

int8_t getBatterySOC() {
  if (sampleCount == 0 || seriesCells < 1) {
    return -1;
  }
  const float packAvg = averagePackVoltage();
  const float cellVoltage = packAvg / static_cast<float>(seriesCells);
  const float soc = interpolateSocFromCellVoltage(cellVoltage);
  int rounded = static_cast<int>(lroundf(soc));
  if (rounded < 0) {
    rounded = 0;
  }
  if (rounded > 100) {
    rounded = 100;
  }
  return static_cast<int8_t>(rounded);
}

bool isBatterySOCValid() {
  if (isMotorActive()) {
    return false;
  }
  return sampleCount > 0;
}
