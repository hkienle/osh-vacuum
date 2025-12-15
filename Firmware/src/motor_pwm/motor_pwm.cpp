#include <Arduino.h>
#include <string.h>
#include "motor_pwm.h"

// PWM configuration
const uint8_t PWM_PIN   = 5;
const int PWM_CHANNEL   = 0;
const int PWM_RES_BITS  = 8;      // 0..255
const int PWM_FREQ_HZ   = 1000;   // 1 kHz

// State variables
static int duty = 0;               // PWM duty cycle (0-255)
static bool running = false;       // Motor running state
static bool pinAttached = true;    // Track if PWM is attached to pin

void initMotorPWM() {
  ledcSetup(PWM_CHANNEL, PWM_FREQ_HZ, PWM_RES_BITS);
  running = false;
  duty = 0;
  pinAttached = false;
  
  // Pull pin to GND initially (duty is 0)
  ledcDetachPin(PWM_PIN);
  pinMode(PWM_PIN, OUTPUT);
  digitalWrite(PWM_PIN, LOW);
}

void setMotorDuty(int newDuty) {
  // Constrain duty to valid range
  if (newDuty < 0) newDuty = 0;
  if (newDuty > 255) newDuty = 255;
  
  duty = newDuty;
  
  // If duty is 0, pull pin to GND
  if (duty == 0) {
    if (pinAttached) {
      ledcDetachPin(PWM_PIN);
      pinAttached = false;
    }
    pinMode(PWM_PIN, OUTPUT);
    digitalWrite(PWM_PIN, LOW);
    running = false;
  } else {
    // If pin was not attached, attach PWM
    if (!pinAttached) {
      ledcAttachPin(PWM_PIN, PWM_CHANNEL);
      pinAttached = true;
    }
    
    // Update PWM only if motor is running
    if (running) {
      ledcWrite(PWM_CHANNEL, duty);
    }
  }
}

void startMotor() {
  // Ensure PWM is attached if duty > 0
  if (duty > 0 && !pinAttached) {
    ledcAttachPin(PWM_PIN, PWM_CHANNEL);
    pinAttached = true;
  }
  running = true;
  if (duty > 0) {
    ledcWrite(PWM_CHANNEL, duty);
  }
}

void stopMotor() {
  running = false;
  ledcWrite(PWM_CHANNEL, 0);
  
  // Pull pin to GND when stopped
  if (pinAttached) {
    ledcDetachPin(PWM_PIN);
    pinAttached = false;
  }
  pinMode(PWM_PIN, OUTPUT);
  digitalWrite(PWM_PIN, LOW);
}

int getMotorDuty() {
  return duty;
}

bool isMotorRunning() {
  return running;
}

void handleMotorCommand(const char* key, int value) {
  if (strcmp(key, "speed") == 0) {
    // Constrain speed to 0-255 range
    int speed = value;
    if (speed < 0) speed = 0;
    if (speed > 255) speed = 255;
    
    Serial.printf("[Motor] Setting speed to %d\n", speed);
    
    if (speed == 0) {
      // Stop motor if speed is 0
      stopMotor();
      Serial.println("[Motor] Motor stopped");
    } else {
      // Set duty cycle and start motor
      setMotorDuty(speed);
      startMotor();
      Serial.printf("[Motor] Motor started at duty %d\n", speed);
    }
  }
}

void handleMotorHeartbeat() {
  // Heartbeat mechanism removed - PCB works standalone
  // Keep function for backward compatibility
}

void updateMotor() {
  // Heartbeat timeout check removed - motor runs based on button control
  // Keep function for backward compatibility
}

