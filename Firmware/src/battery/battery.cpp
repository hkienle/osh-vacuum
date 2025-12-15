#include <Arduino.h>
#include "battery.h"

#define VBAT_PIN 6

// Hardware divider configuration
const float VBAT_R_TOP = 330000.0f;  // 330k
const float VBAT_R_BOT = 22000.0f;    // 22k
const float VBAT_SCALE = (VBAT_R_TOP + VBAT_R_BOT) / VBAT_R_BOT; // 16.0

// Calibration points
const float CAL_VTRUE1  = 12.000f;   // known real voltage 1
const float CAL_VTRUE2  = 36.000f;   // known real voltage 2

float CAL_VMEAS1 = 11.640f;          // what your device "thinks" at 12.000 V
float CAL_VMEAS2 = 35.280f;          // what your device "thinks" at 36.000 V

// Calibration coefficients (calculated in initBattery)
float VBAT_CAL_SLOPE = 1.0f;
float VBAT_CAL_OFFSET = 0.0f;

// Sampling configuration
const uint8_t N = 8;                 // Number of samples to average

// State variables
static float lastBatteryVoltage = 0.0f;
static float lastBatteryVoltageRaw = 0.0f;
static bool batteryReady = false;
static unsigned long lastReadTime = 0;
const unsigned long READ_INTERVAL = 250; // Read every 250ms

void initBattery() {
  pinMode(VBAT_PIN, INPUT);
  
  // Calculate calibration slope and offset
  VBAT_CAL_SLOPE = (CAL_VTRUE2 - CAL_VTRUE1) / (CAL_VMEAS2 - CAL_VMEAS1);
  VBAT_CAL_OFFSET = CAL_VTRUE1 - VBAT_CAL_SLOPE * CAL_VMEAS1;
  
  lastReadTime = millis();
}

void updateBattery() {
  unsigned long currentTime = millis();
  
  // Only read every 250ms
  if (currentTime - lastReadTime < READ_INTERVAL) {
    return;
  }
  
  lastReadTime = currentTime;
  
  // Take N samples and average (using analogReadMilliVolts)
  uint32_t mv = 0;
  for (uint8_t i = 0; i < N; i++) {
    mv += analogReadMilliVolts(VBAT_PIN);
  }
  
  // Convert millivolts to volts at GPIO6
  float vpin = (float)mv / (float)N / 1000.0f;
  
  // Calculate raw battery voltage from divider
  float vmeas = vpin * VBAT_SCALE;
  lastBatteryVoltageRaw = vmeas;
  
  // Apply 2-point calibration
  float vcal = vmeas * VBAT_CAL_SLOPE + VBAT_CAL_OFFSET;
  
  // Clamp for safety
  if (vcal < 0.0f) vcal = 0.0f;
  if (vcal > 60.0f) vcal = 60.0f;
  
  lastBatteryVoltage = vcal;
  batteryReady = true;
}

float getBatteryVoltage() {
  return lastBatteryVoltage;
}

float getBatteryVoltageRaw() {
  return lastBatteryVoltageRaw;
}

bool isBatteryReady() {
  return batteryReady;
}

