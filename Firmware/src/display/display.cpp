#include "display.h"

#include <Arduino.h>
#include "../display_waveshare_091_i2c/display_waveshare_091_i2c.h"
#include "../display_waveshare_15_i2c/display_waveshare_15_i2c.h"

namespace {
DisplayType activeDisplayType = DisplayType::None;
}

void initDisplay(const RuntimeSettings& settings) {
  activeDisplayType = settings.displayType;
  Serial.printf("Display: selected type %s\n", displayTypeToString(activeDisplayType));

  switch (activeDisplayType) {
    case DisplayType::Waveshare091I2C:
      initDisplayWaveshare091I2C();
      break;
    case DisplayType::Waveshare15I2C:
      initDisplayWaveshare15I2C();
      break;
    case DisplayType::None:
    default:
      Serial.println("Display: disabled");
      break;
  }
}

void updateDisplay(const DisplayTelemetry& telemetry) {
  switch (activeDisplayType) {
    case DisplayType::Waveshare091I2C:
      updateDisplayWaveshare091I2C(
          telemetry.speedPercent,
          telemetry.batteryVoltage,
          telemetry.temperatureC,
          telemetry.motorTemperatureReady,
          telemetry.mcuTempC,
          telemetry.rpm,
          telemetry.triggerHeld,
          telemetry.rpmReady,
          telemetry.batterySocPercent,
          telemetry.motorActive,
          telemetry.displayInfoMode,
          telemetry.displayInfoPage,
          telemetry.uptimeSeconds,
          telemetry.freeHeapBytes,
          telemetry.batterySeriesCells,
          telemetry.autoOffMinutes,
          telemetry.sleepTimerMinutes,
          telemetry.tempLimitC,
          telemetry.speedStepPercent,
          telemetry.minDutyPercent,
          telemetry.maxDutyPercent,
          telemetry.motorDisplayMode,
          telemetry.triggerMode,
          telemetry.ledIdleDisplayMode,
          telemetry.ledDisplayMode,
          telemetry.ledDimPercent,
          telemetry.ledTheme,
          telemetry.maxStatsRpm,
          telemetry.maxStatsHasRpm,
          telemetry.maxStatsVoltageV,
          telemetry.maxStatsHasVoltage,
          telemetry.maxStatsMotorTempC,
          telemetry.maxStatsHasMotorTemp,
          telemetry.otaActive,
          telemetry.otaProgressPercent);
      break;
    case DisplayType::Waveshare15I2C:
      updateDisplayWaveshare15I2C(
          telemetry.speedPercent,
          telemetry.batteryVoltage,
          telemetry.temperatureC,
          telemetry.motorTemperatureReady,
          telemetry.mcuTempC,
          telemetry.rpm,
          telemetry.triggerHeld,
          telemetry.rpmReady,
          telemetry.batterySocPercent,
          telemetry.motorActive,
          telemetry.displayInfoMode,
          telemetry.displayInfoPage,
          telemetry.uptimeSeconds,
          telemetry.freeHeapBytes,
          telemetry.batterySeriesCells,
          telemetry.autoOffMinutes,
          telemetry.sleepTimerMinutes,
          telemetry.tempLimitC,
          telemetry.speedStepPercent,
          telemetry.minDutyPercent,
          telemetry.maxDutyPercent,
          telemetry.motorDisplayMode,
          telemetry.triggerMode,
          telemetry.ledIdleDisplayMode,
          telemetry.ledDisplayMode,
          telemetry.ledDimPercent,
          telemetry.ledTheme,
          telemetry.maxStatsRpm,
          telemetry.maxStatsHasRpm,
          telemetry.maxStatsVoltageV,
          telemetry.maxStatsHasVoltage,
          telemetry.maxStatsMotorTempC,
          telemetry.maxStatsHasMotorTemp,
          telemetry.otaActive,
          telemetry.otaProgressPercent);
      break;
    case DisplayType::None:
    default:
      break;
  }
}

void updateDisplayOtaScreen(uint8_t percent) {
  switch (activeDisplayType) {
    case DisplayType::Waveshare091I2C:
      drawOtaScreenWaveshare091(percent);
      break;
    case DisplayType::Waveshare15I2C:
      drawOtaScreenWaveshare15(percent);
      break;
    case DisplayType::None:
    default:
      break;
  }
}

void prepareDisplayForSleep() {
  switch (activeDisplayType) {
    case DisplayType::Waveshare091I2C:
      prepareDisplayWaveshare091I2CSleep();
      break;
    case DisplayType::Waveshare15I2C:
      prepareDisplayWaveshare15I2CSleep();
      break;
    case DisplayType::None:
    default:
      break;
  }
}

void resumeDisplayAfterSleep() {
  switch (activeDisplayType) {
    case DisplayType::Waveshare091I2C:
      resumeDisplayWaveshare091I2C();
      break;
    case DisplayType::Waveshare15I2C:
      resumeDisplayWaveshare15I2C();
      break;
    case DisplayType::None:
    default:
      break;
  }
}

DisplayType getActiveDisplayType() {
  return activeDisplayType;
}
