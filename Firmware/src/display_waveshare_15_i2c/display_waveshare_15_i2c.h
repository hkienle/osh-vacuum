#ifndef DISPLAY_WAVESHARE_15_I2C_H
#define DISPLAY_WAVESHARE_15_I2C_H

#include <stdint.h>

void initDisplayWaveshare15I2C();
void updateDisplayWaveshare15I2C(uint8_t speedPercent, float batteryVoltage, float temperatureC, bool motorTemperatureReady, float mcuTempC, float rpm, bool triggerHeld, bool rpmReady, int8_t batterySocPercent, bool motorActive, bool displayInfoMode, uint8_t displayInfoPage, uint32_t uptimeSeconds, uint32_t freeHeapBytes, uint8_t batterySeriesCells, uint8_t autoOffMinutes, uint8_t sleepTimerMinutes, uint8_t tempLimitC, uint8_t speedStepPercent, uint8_t minDutyPercent, uint8_t motorDisplayMode, uint8_t triggerMode, bool otaActive, uint8_t otaProgressPercent);
void drawOtaScreenWaveshare15(uint8_t percent);
void prepareDisplayWaveshare15I2CSleep();
void resumeDisplayWaveshare15I2C();

#endif  // DISPLAY_WAVESHARE_15_I2C_H
