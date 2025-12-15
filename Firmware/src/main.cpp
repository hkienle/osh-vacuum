#include <Arduino.h>
#include "wifi/wifi.h"
#include "led/led.h"
#include "temperature/temperature.h"
#include "battery/battery.h"
#include "tachometer/tachometer.h"
#include "websocket/websocket.h"
#include "motor_pwm/motor_pwm.h"
#include "webserver/webserver.h"
#include "button/button.h"

long nextBroadcastTime = 0;
int broadcastInterval = 250;
unsigned long bootTime = 0;

void setup() {
  Serial.begin(115200);
  // Wait for Serial to be ready (non-blocking)
  delay(1000);

  bootTime = millis();

  // Pull IO7 low (will be controlled by button module)
  pinMode(7, OUTPUT);
  digitalWrite(7, LOW);

  initLED();
  initButtons();
  initTemperature();
  initBattery();
  initTachometer();
  initMotorPWM();
  initWebServer();
  setupWiFi();
  initWebSocket();
}

void loop() {
  // Update buttons (handles speed changes and trigger state)
  updateButtons();
  
  // Check if we should switch to speed display mode (after 2 seconds)
  checkSpeedDisplayMode(bootTime);
  
  // Update LED speed display if in speed display mode
  if (millis() - bootTime >= 2000) {
    setLEDSpeedDisplay(getSpeed(), isMotorActive());
  }
  
  // Control PWM based on unified motor state and speed
  if (isMotorActive()) {
    // Motor is active: output PWM based on speed setting
    uint8_t speed = getSpeed();
    // Convert 0-100% to 0-255 PWM duty cycle
    int pwmDuty = (speed * 255) / 100;
    setMotorDuty(pwmDuty);
    startMotor();
  } else {
    // Motor is stopped: stop PWM output
    stopMotor();
  }
  
  updateLED();
  updateTemperature();
  updateBattery();
  updateTachometer();
  updateMotor();  // Check heartbeat timeout
  updateWebServer();
  updateWebSocket();

  if(millis() > nextBroadcastTime) {  
    // Serial output
    String temperature = String(getTemperature());
    String battery = String(getBatteryVoltage());
    String rpm = String(getRPM());
    String speed = String(getSpeed());
    String message = "Temperature: " + temperature + " / Battery: " + battery + " / RPM: " + rpm + " / Speed: " + speed + "%";
    Serial.println(message);
    
    // WebSocket broadcast
    if (isWebSocketRunning()) {
      char jsonBuffer[100];
      
      // Broadcast temperature
      snprintf(jsonBuffer, sizeof(jsonBuffer), "{\"temp\":%.2f}", getTemperature());
      broadcastWebSocket(jsonBuffer);
      
      // Broadcast battery
      snprintf(jsonBuffer, sizeof(jsonBuffer), "{\"battery\":%.2f}", getBatteryVoltage());
      broadcastWebSocket(jsonBuffer);
      
      // Broadcast RPM
      snprintf(jsonBuffer, sizeof(jsonBuffer), "{\"rpm\":%.0f}", getRPM());
      broadcastWebSocket(jsonBuffer);
      
      // Broadcast speed
      snprintf(jsonBuffer, sizeof(jsonBuffer), "{\"speed\":%d}", getSpeed());
      broadcastWebSocket(jsonBuffer);
      
      // Broadcast motor state
      snprintf(jsonBuffer, sizeof(jsonBuffer), "{\"motor_active\":%s}", isMotorActive() ? "true" : "false");
      broadcastWebSocket(jsonBuffer);
    }
    
    nextBroadcastTime = millis() + broadcastInterval;
  }
}

