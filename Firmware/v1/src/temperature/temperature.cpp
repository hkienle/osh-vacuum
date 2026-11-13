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
constexpr uint32_t SAMPLE_SPACING_US = 350;

// State variables
static float lastTemperature = 0.0f;
static bool temperatureReady = false;
static unsigned long lastReadTime = 0;
const unsigned long READ_INTERVAL = 250; // Start a new multi-sample cycle every 250ms

static uint8_t tempSampleIdx = 0;
static uint32_t tempAcc = 0;
static uint32_t nextThermSampleAtUs = 0;

void initTemperature() {
  pinMode(THERM_PIN, INPUT);
  lastReadTime = millis();
  tempSampleIdx = 0;
  tempAcc = 0;
}

void updateTemperature() {
  const unsigned long currentTime = millis();

  if (tempSampleIdx == 0) {
    if (currentTime - lastReadTime < READ_INTERVAL) {
      return;
    }
    lastReadTime = currentTime;
    tempAcc = 0;
  } else {
    const uint32_t nowUs = micros();
    // Signed delta so micros() wrap (~71 min) still yields correct wait vs scheduled sample time.
    if (static_cast<int32_t>(nowUs - nextThermSampleAtUs) < 0) {
      return;
    }
  }

  tempAcc += static_cast<uint32_t>(analogRead(THERM_PIN));
  tempSampleIdx++;

  if (tempSampleIdx < N) {
    nextThermSampleAtUs = micros() + SAMPLE_SPACING_US;
    return;
  }

  tempSampleIdx = 0;
  uint16_t adc = static_cast<uint16_t>(tempAcc / N);

  if (adc < 1) {
    adc = 1;
  }
  if (adc >= ADC12_MAX) {
    adc = ADC12_MAX - 1;
  }

  float Rth = SERIES_R * ((float)(ADC12_MAX - adc) / (float)adc);
  float T_K = 1.0f / (1.0f / T0_K + (1.0f / BETA) * log(Rth / R0));
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
