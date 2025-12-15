#ifndef BATTERY_H
#define BATTERY_H

// Initialize battery voltage sensor
void initBattery();

// Update battery voltage reading (call this in loop())
void updateBattery();

// Get last read battery voltage in Volts
float getBatteryVoltage();

// Get raw measured voltage (before calibration)
float getBatteryVoltageRaw();

// Check if battery voltage is ready (has been read at least once)
bool isBatteryReady();

#endif // BATTERY_H

