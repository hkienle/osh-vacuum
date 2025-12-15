#ifndef TEMPERATURE_H
#define TEMPERATURE_H

// Initialize temperature sensor
void initTemperature();

// Update temperature reading (call this in loop())
void updateTemperature();

// Get last read temperature in Celsius
float getTemperature();

// Check if temperature is ready (has been read at least once)
bool isTemperatureReady();

#endif // TEMPERATURE_H

