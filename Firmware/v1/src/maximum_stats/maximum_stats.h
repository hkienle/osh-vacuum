#ifndef MAXIMUM_STATS_H
#define MAXIMUM_STATS_H

#include <stdbool.h>
#include <stdint.h>

struct MaximumStatsForDisplay {
  uint32_t maxRpm;
  bool hasMaxRpm;
  float maxVoltageV;
  bool hasMaxVoltage;
  float maxMotorTempC;
  bool hasMaxMotorTemp;
};

void initMaximumStats();

/** Call each loop after sensors; updates peaks while motor runs and persists on motor on/off edges. */
void maximumStatsOnMotorLoop(bool motorActive, float rpm, bool rpmReady, float batteryVoltage, float motorTempC, bool motorTempReady);

void maximumStatsClearPersisted();

MaximumStatsForDisplay maximumStatsGetForDisplay();

#endif  // MAXIMUM_STATS_H
