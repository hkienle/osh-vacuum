#include <Arduino.h>
#include <ESP.h>
#include <stdio.h>
#include "wifi/wifi.h"
#include "led/led.h"
#include "temperature/temperature.h"
#include "battery/battery.h"
#include "battery_soc/battery_soc.h"
#include "tachometer/tachometer.h"
#include "websocket/websocket.h"
#include "motor_pwm/motor_pwm.h"
#include "webserver/webserver.h"
#include "ota/ota.h"
#include "button/button.h"
#include "settings/settings.h"
#include "display/display.h"
#include "mcu_temp/mcu_temp.h"
#include "power/power.h"
#include "maximum_stats/maximum_stats.h"

long nextBroadcastTime = 0;
int broadcastInterval = 250;
void setup() {
  // Pull IO7 low (will be controlled by button module)
  pinMode(7, OUTPUT);
  digitalWrite(7, LOW);

  // Black out WS2812 as early as possible (before USB wait) so they stay off until boot glow.
  initLED();

  Serial.begin(115200);
  delay(1000);  // Blocking wait only in setup() (Serial/USB attach)

  initButtons();
  initTemperature();
  initBattery();
  initTachometer();
  initMotorPWM();
  initWebServer();
  initOTA();
  setupWiFi();
  initWebSocket();
  initSettings();
  loadRuntimeSettings();
  initMaximumStats();
  initBatterySOC(getRuntimeSettings().batterySeriesCells);
  initDisplay(getRuntimeSettings());
  initMcuTemperature();
  initPowerManagement();
  // Optional settle time for 1.5" splash (blocking only allowed in setup()).
  if (getRuntimeSettings().displayType == DisplayType::Waveshare15I2C) {
    delay(100);
  }

  printNetworkSummaryToSerial();
  enableLEDBarDisplay(static_cast<uint8_t>(getRuntimeSettings().ledTheme));
}

void loop() {
  static uint32_t motorRunStartMs = 0;

  // Update buttons (handles speed changes and trigger state)
  updateButtons();
  
  if (isMotorActive()) {
    const uint8_t speed = getSpeed();
    const uint8_t minP = getRuntimeSettings().minDutyPercent;
    const uint8_t maxP = clampMaxDutyPercent(getRuntimeSettings().maxDutyPercent, minP);
    int pwmDuty = 0;
    if (speed > 0) {
      const int minDuty = static_cast<int>((minP * 255) / 100);
      const int maxDuty = static_cast<int>((maxP * 255) / 100);
      pwmDuty = minDuty + (static_cast<int>(speed) * (maxDuty - minDuty)) / 100;
    }
    setMotorDuty(pwmDuty);
    startMotor();
    if (motorRunStartMs == 0) {
      motorRunStartMs = millis();
    }
  } else {
    // Motor is stopped: stop PWM output
    stopMotor();
    motorRunStartMs = 0;
  }
  
  updateTemperature();
  updateMcuTemperature();
  updateBattery();
  updateBatterySOC();
  updateTachometer();
  updateOTA();

  maximumStatsOnMotorLoop(
      isMotorActive(),
      getRPM(),
      isRPMReady(),
      getBatteryVoltage(),
      getTemperature(),
      isTemperatureReady());

  {
    const RuntimeSettings& rsLed = getRuntimeSettings();
    const MaximumStatsForDisplay mxLed = maximumStatsGetForDisplay();
    updateLEDBarGraph(
        getBatterySOC(),
        getRPM(),
        isRPMReady(),
        mxLed.maxRpm,
        mxLed.hasMaxRpm,
        getSpeed(),
        getTemperature(),
        isTemperatureReady(),
        rsLed.tempLimitC,
        isMotorActive(),
        static_cast<uint8_t>(rsLed.ledIdleDisplayMode),
        static_cast<uint8_t>(rsLed.ledDisplayMode),
        rsLed.ledDimPercent,
        static_cast<uint8_t>(rsLed.ledTheme),
        isOtaUpdateActive(),
        getOtaProgressPercent());
  }
  updateLED();

  if (isMotorActive()) {
    const uint8_t autoOffMin = getRuntimeSettings().autoOffMinutes;
    if (autoOffMin > 0 && motorRunStartMs != 0) {
      const uint32_t runElapsedMs = millis() - motorRunStartMs;
      const uint32_t autoOffMs = static_cast<uint32_t>(autoOffMin) * 60UL * 1000UL;
      if (runElapsedMs >= autoOffMs) {
        setMotorState(false);
        motorRunStartMs = 0;
        Serial.printf("[Main] Motor stopped: auto-off after %u min\n", static_cast<unsigned>(autoOffMin));
      }
    }

    const uint8_t lim = getRuntimeSettings().tempLimitC;
    if (lim > 0 && isTemperatureReady() && getTemperature() > static_cast<float>(lim)) {
      setMotorState(false);
      motorRunStartMs = 0;
      triggerThermalOffBlink();
      Serial.printf("[Main] Motor stopped: NTC > %u C\n", static_cast<unsigned>(lim));
    }
  }

  const bool buttonActivity = hadButtonActivityAndClear();
  if (updatePowerManagement(buttonActivity, isMotorActive(), isOtaUpdateActive())) {
    return;
  }
  const RuntimeSettings& rs = getRuntimeSettings();
  const MaximumStatsForDisplay mx = maximumStatsGetForDisplay();
  DisplayTelemetry telemetry {
    getSpeed(),
    getBatteryVoltage(),
    getTemperature(),
    isTemperatureReady(),
    getMcuTemperatureC(),
    getRPM(),
    isTriggerPressed(),
    isRPMReady(),
    getBatterySOC(),
    isMotorActive(),
    isDisplayInfoMode(),
    getDisplayInfoPage(),
    static_cast<uint32_t>(millis() / 1000UL),
    ESP.getFreeHeap(),
    rs.batterySeriesCells,
    isOtaUpdateActive(),
    getOtaProgressPercent(),
    rs.autoOffMinutes,
    rs.sleepTimerMinutes,
    rs.tempLimitC,
    rs.speedStepPercent,
    rs.minDutyPercent,
    rs.maxDutyPercent,
    static_cast<uint8_t>(rs.motorDisplayMode),
    static_cast<uint8_t>(rs.triggerMode),
    static_cast<uint8_t>(rs.ledIdleDisplayMode),
    static_cast<uint8_t>(rs.ledDisplayMode),
    rs.ledDimPercent,
    static_cast<uint8_t>(rs.ledTheme),
    mx.maxRpm,
    mx.hasMaxRpm,
    mx.maxVoltageV,
    mx.hasMaxVoltage,
    mx.maxMotorTempC,
    mx.hasMaxMotorTemp,
  };
  updateDisplay(telemetry);
  updateMotor();  // Check heartbeat timeout
  updateWebServer();
  updateWebSocket();

  if(millis() > nextBroadcastTime) {  
    const uint8_t speedPercent = getSpeed();
    const float batteryVoltage = getBatteryVoltage();
    const float rpmValue = getRPM();
    const bool motorActive = isMotorActive();

    char serialLine[160];
    snprintf(serialLine, sizeof(serialLine),
             "Temperature: %.2f / Battery: %.2f / RPM: %.0f / Speed: %u%%",
             getTemperature(), batteryVoltage, rpmValue, static_cast<unsigned>(speedPercent));
    Serial.println(serialLine);

    if (isWebSocketRunning()) {
      char jsonBuffer[320];
      const int n = snprintf(jsonBuffer, sizeof(jsonBuffer),
                             "{\"temp\":%.2f,\"battery\":%.2f,\"rpm\":%.0f,\"speed\":%u,\"motor_active\":%s,\"battery_soc\":%d}",
                             getTemperature(),
                             batteryVoltage,
                             rpmValue,
                             static_cast<unsigned>(speedPercent),
                             motorActive ? "true" : "false",
                             static_cast<int>(getBatterySOC()));
      if (n > 0 && static_cast<size_t>(n) < sizeof(jsonBuffer)) {
        broadcastWebSocket(jsonBuffer);
      }
    }
    
    nextBroadcastTime = millis() + broadcastInterval;
  }
}

