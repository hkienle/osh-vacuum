#ifndef BATTERY_SOC_H
#define BATTERY_SOC_H

#include <stdint.h>

// Call after settings load: cellCount = series cells in pack (1–32).
void initBatterySOC(uint8_t cellCount);

// Call each loop(): samples pack voltage when motor is off, 100 ms interval, rolling avg of 50.
void updateBatterySOC();

// Mapped SOC 0–100 from rolling average (per-cell curve × cell count), or -1 if no samples yet.
int8_t getBatterySOC();

// False while motor is running or before any sample exists.
bool isBatterySOCValid();

#endif  // BATTERY_SOC_H
