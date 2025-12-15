#include <Arduino.h>
#include "button.h"

// Speed variable (0-100%)
static uint8_t speedPercent = 0;

// Motor state (unified for physical and web control)
static bool motorActive = false;

// Button state tracking
static bool triggerState = false;
static bool triggerLastState = false;
static bool upState = false;
static bool upLastState = false;
static bool downState = false;
static bool downLastState = false;

// Debounce timing
static unsigned long lastDebounceTime = 0;
static const unsigned long DEBOUNCE_DELAY = 50; // 50ms debounce

void initButtons() {
  // Configure button pins as inputs with pull-up
  pinMode(TRIGGER_PIN, INPUT_PULLUP);
  pinMode(UP_PIN, INPUT_PULLUP);
  pinMode(DOWN_PIN, INPUT_PULLUP);
  
  // MOSFET pin is already configured in main.cpp, but ensure it's low
  pinMode(MOSFET_PIN, OUTPUT);
  digitalWrite(MOSFET_PIN, LOW);
  
  // Initialize speed to 0%
  speedPercent = 0;
  
  // Read initial states
  triggerLastState = digitalRead(TRIGGER_PIN);
  upLastState = digitalRead(UP_PIN);
  downLastState = digitalRead(DOWN_PIN);
}

void updateButtons() {
  unsigned long currentTime = millis();
  
  // Read current button states (inverted because of pull-up)
  bool triggerReading = !digitalRead(TRIGGER_PIN);
  bool upReading = !digitalRead(UP_PIN);
  bool downReading = !digitalRead(DOWN_PIN);
  
  // Update trigger state immediately (no debounce needed for trigger)
  bool triggerChanged = (triggerReading != triggerLastState);
  triggerState = triggerReading;
  
  // Physical trigger always takes precedence when pressed
  // If trigger is held, motor must be active (overrides web UI)
  if (triggerState) {
    if (!motorActive) {
      motorActive = true; // motor_start
      Serial.println("[Button] Motor START (physical trigger override)");
    }
  } else {
    // Trigger released - only update motor state on edge change
    // This allows web UI to control motor when trigger is not pressed
    if (triggerChanged) {
      motorActive = false; // motor_stop
      Serial.println("[Button] Motor STOP (physical trigger released)");
    }
  }
  
  triggerLastState = triggerReading;
  
  // Control MOSFET based on motor state
  if (motorActive) {
    digitalWrite(MOSFET_PIN, HIGH);
  } else {
    digitalWrite(MOSFET_PIN, LOW);
  }
  
  // Debounce UP and DOWN buttons
  if (upReading != upLastState || downReading != downLastState) {
    lastDebounceTime = currentTime;
  }
  
  if ((currentTime - lastDebounceTime) > DEBOUNCE_DELAY) {
    // UP button pressed (state changed from not pressed to pressed)
    if (upReading && !upState) {
      speedPercent += 20;
      if (speedPercent > 100) {
        speedPercent = 100;
      }
      Serial.printf("[Button] Speed increased to %d%%\n", speedPercent);
    }
    
    // DOWN button pressed (state changed from not pressed to pressed)
    if (downReading && !downState) {
      if (speedPercent >= 20) {
        speedPercent -= 20;
      } else {
        speedPercent = 0;
      }
      Serial.printf("[Button] Speed decreased to %d%%\n", speedPercent);
    }
    
    upState = upReading;
    downState = downReading;
  }
  
  upLastState = upReading;
  downLastState = downReading;
  
  // Note: triggerLastState is updated above in trigger handling
}

uint8_t getSpeed() {
  return speedPercent;
}

bool isTriggerPressed() {
  return triggerState;
}

void setSpeed(uint8_t speed) {
  // Accept exact value (0-100%) - no rounding for PWM control
  speedPercent = speed;
  if (speedPercent > 100) speedPercent = 100;
  Serial.printf("[Button] Speed set to %d%% (from web UI)\n", speedPercent);
}

bool isMotorActive() {
  return motorActive;
}

void setMotorState(bool active) {
  motorActive = active;
  // Control MOSFET based on motor state
  if (motorActive) {
    digitalWrite(MOSFET_PIN, HIGH);
    Serial.println("[Button] Motor state: START (from web UI)");
  } else {
    digitalWrite(MOSFET_PIN, LOW);
    Serial.println("[Button] Motor state: STOP (from web UI)");
  }
}

