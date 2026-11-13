#include "display_waveshare_091_i2c.h"

#include "../display_oled/display_oled.h"

void initDisplayWaveshare091I2C() {
  initDisplayOled();
}

void updateDisplayWaveshare091I2C(uint8_t speedPercent, float batteryVoltage, float temperatureC, bool motorTemperatureReady, float mcuTempC, float rpm, bool triggerHeld, bool rpmReady, int8_t batterySocPercent, bool motorActive, bool displayInfoMode, uint8_t displayInfoPage, uint32_t uptimeSeconds, uint32_t freeHeapBytes, uint8_t batterySeriesCells, uint8_t autoOffMinutes, uint8_t sleepTimerMinutes, uint8_t tempLimitC, uint8_t speedStepPct, uint8_t minDutyPct, uint8_t maxDutyPct, uint8_t motorDisplayMode, uint8_t triggerMode, uint8_t ledIdleDisplayMode, uint8_t ledDisplayMode, uint8_t ledDimPercent, uint8_t ledTheme, uint32_t maxStatsRpm, bool maxStatsHasRpm, float maxStatsVoltageV, bool maxStatsHasVoltage, float maxStatsMotorTempC, bool maxStatsHasMotorTemp, bool otaActive, uint8_t otaProgressPercent) {
  updateDisplayOled(speedPercent, batteryVoltage, rpm, triggerHeld, rpmReady, batterySocPercent, motorActive, displayInfoMode, displayInfoPage, uptimeSeconds, freeHeapBytes, batterySeriesCells, autoOffMinutes, sleepTimerMinutes, tempLimitC, speedStepPct, minDutyPct, maxDutyPct, motorDisplayMode, triggerMode, ledIdleDisplayMode, ledDisplayMode, ledDimPercent, ledTheme, maxStatsRpm, maxStatsHasRpm, maxStatsVoltageV, maxStatsHasVoltage, maxStatsMotorTempC, maxStatsHasMotorTemp, temperatureC, motorTemperatureReady, mcuTempC, otaActive, otaProgressPercent);
}

void drawOtaScreenWaveshare091(uint8_t percent) {
  drawOtaScreenOled(percent);
}

void prepareDisplayWaveshare091I2CSleep() {
  prepareDisplayOledSleep();
}

void resumeDisplayWaveshare091I2C() {
  resumeDisplayOled();
}
