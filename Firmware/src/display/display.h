#ifndef DISPLAY_H
#define DISPLAY_H

#include "../settings/settings.h"

struct DisplayTelemetry {
  uint8_t speedPercent;
  float batteryVoltage;
  float temperatureC;
  bool motorTemperatureReady;
  float mcuTempC;
  float rpm;
  bool triggerHeld;
  bool rpmReady;
  int8_t batterySocPercent;  // 0-100, or -1 if unavailable
  bool motorActive;
  bool displayInfoMode;
  uint8_t displayInfoPage;  // 0–4 info, 5–12 settings
  uint32_t uptimeSeconds;
  uint32_t freeHeapBytes;
  uint8_t batterySeriesCells;

  bool otaActive;
  uint8_t otaProgressPercent;

  /** Snapshot for settings pages & motor display (0=Speed 1=Volt 2=RPM 3=MOT-Temp). */
  uint8_t autoOffMinutes;
  uint8_t sleepTimerMinutes;
  uint8_t tempLimitC;
  uint8_t speedStepPercent;
  uint8_t minDutyPercent;
  uint8_t motorDisplayMode;
  uint8_t triggerMode;
};

void initDisplay(const RuntimeSettings& settings);
void updateDisplay(const DisplayTelemetry& telemetry);
void updateDisplayOtaScreen(uint8_t percent);
void prepareDisplayForSleep();
void resumeDisplayAfterSleep();
DisplayType getActiveDisplayType();

#endif  // DISPLAY_H
