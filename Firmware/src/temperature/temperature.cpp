#include <Arduino.h>
#include "temperature.h"
#include <math.h>

#define THERM_PIN 4

// Hardware configuration
const bool  THERMISTOR_TO_GND = false;   // NTC to 3V3, fixed to GND
const float SERIES_R  = 10000.0f;        // 10k fixed resistor (to GND)

// ADC configuration
const uint16_t ADC12_MAX = 4095;         // 12-bit ADC (0..4095)

// Thermistor parameters
const float R0        = 10000.0f;        // 10k at 25°C
const float T0_K      = 298.15f;         // 25 °C in Kelvin
const float BETA      = 3950.0f;         // Beta parameter

// Sampling configuration
const uint8_t N = 8;                     // Number of samples to average

// State variables
static float lastTemperature = 0.0f;
static bool temperatureReady = false;
static unsigned long lastReadTime = 0;
const unsigned long READ_INTERVAL = 250; // Read every 250ms

void initTemperature() {
  pinMode(THERM_PIN, INPUT);
  lastReadTime = millis();
}

void updateTemperature() {
  unsigned long currentTime = millis();
  
  // Only read every 250ms
  if (currentTime - lastReadTime < READ_INTERVAL) {
    return;
  }
  
  lastReadTime = currentTime;
  
  // Take N samples and average
  uint32_t acc = 0;
  for (uint8_t i = 0; i < N; i++) {
    acc += analogRead(THERM_PIN);
    delayMicroseconds(350); // Small delay between samples
  }
  
  uint16_t adc = acc / N;
  
  // Constrain ADC to [1 .. ADC12_MAX-1] to avoid division by zero
  if (adc < 1) adc = 1;
  if (adc >= ADC12_MAX) adc = ADC12_MAX - 1;
  
  // Calculate thermistor resistance
  // Because NTC is on top (3V3 side) and fixed 10k to GND:
  // Vout = Vcc * (Rs / (Rth + Rs))
  // Rth = SERIES_R * (ADCmax - adc) / adc
  float Rth = SERIES_R * ((float)(ADC12_MAX - adc) / (float)adc);
  
  // Calculate temperature using Beta equation
  // 1/T = 1/T0 + (1/B) * ln(R/R0)
  // T_K = 1 / (1/T0 + (1/BETA) * ln(R / R0))
  float T_K = 1.0f / (1.0f / T0_K + (1.0f / BETA) * log(Rth / R0));
  
  // Convert to Celsius
  float T_C = T_K - 273.15f;
  
  lastTemperature = T_C;
  temperatureReady = true;
}

float getTemperature() {
  return lastTemperature;
}

bool isTemperatureReady() {
  return temperatureReady;
}

