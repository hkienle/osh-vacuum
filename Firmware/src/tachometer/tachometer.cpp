#include <Arduino.h>
#include "tachometer.h"

#define FG_PIN 16

// Tachometer parameters
const uint8_t PULSES_PER_REV = 1;  // adjust to your motor/fan FG output

// Pulse counting (volatile for ISR access)
volatile uint32_t fgPulseCount = 0;

// State variables
static float rpm_cached = 0.0f;
static bool rpmReady = false;
static unsigned long lastUpdateTime = 0;
const unsigned long UPDATE_INTERVAL = 200; // Update every 200ms

// Interrupt Service Routine for FG pulse
void IRAM_ATTR onFgPulse() {
  fgPulseCount++;
}

void initTachometer() {
  pinMode(FG_PIN, INPUT);
  attachInterrupt(digitalPinToInterrupt(FG_PIN), onFgPulse, RISING);
  lastUpdateTime = millis();
}

void updateTachometer() {
  unsigned long currentTime = millis();
  
  // Only update every UPDATE_INTERVAL ms
  if (currentTime - lastUpdateTime < UPDATE_INTERVAL) {
    return;
  }
  
  unsigned long dt = currentTime - lastUpdateTime;
  lastUpdateTime = currentTime;
  
  // Copy and reset pulse count with interrupts disabled
  uint32_t count;
  noInterrupts();
  count = fgPulseCount;
  fgPulseCount = 0;
  interrupts();
  
  // Compute Hz
  float hz = (float)count * 1000.0f / (float)dt;
  
  // Compute RPM
  rpm_cached = hz * 60.0f / (float)PULSES_PER_REV;
  
  rpmReady = true;
}

float getRPM() {
  return rpm_cached;
}

bool isRPMReady() {
  return rpmReady;
}

