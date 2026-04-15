#ifndef DISPLAY_OLED_H
#define DISPLAY_OLED_H

#include <stdint.h>

// Initialize 0.91" SSD1306 OLED over I2C.
void initDisplayOled();

// Update OLED status values.
void updateDisplayOled(uint8_t speedPercent, float batteryVoltage, float rpm, bool triggerHeld, bool rpmReady, int8_t batterySocPercent, bool motorActive, bool displayInfoMode, uint8_t displayInfoPage, uint32_t uptimeSeconds, uint32_t freeHeapBytes, uint8_t batterySeriesCells, uint8_t autoOffMinutes, uint8_t sleepTimerMinutes, uint8_t tempLimitC, uint8_t speedStepPct, uint8_t minDutyPct, uint8_t motorDisplayMode, uint8_t triggerMode, float motorTempC, bool motorTemperatureReady, float mcuTempC, bool otaActive, uint8_t otaProgressPercent);
void drawOtaScreenOled(uint8_t percent);
void prepareDisplayOledSleep();
void resumeDisplayOled();

#endif // DISPLAY_OLED_H
