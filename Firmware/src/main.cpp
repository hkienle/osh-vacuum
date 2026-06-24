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
#include "device_link/device_link.h"
#include "device_protocol/device_protocol.h"
#include "motor/motor.h"
#include "webserver/webserver.h"
#include "ota/ota.h"
#include "button/button.h"
#include "settings/settings.h"
#include "settings/settings_config.h"
#include "settings/dev_menu.h"
#include "display/display.h"
#include "mcu_temp/mcu_temp.h"
#include "power/power.h"
#include "maximum_stats/maximum_stats.h"

long nextBroadcastTime = 0;
int broadcastInterval = 250;

namespace {
void onRuntimeSettingsChanged(const RuntimeSettings& settings) {
  applyDisplayContrast(settings.displayContrastPercent);
  deviceLinkRequestSettingsBroadcast();
}
}  // namespace

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
#ifndef OSHVAC_BLE_PRIMARY
  initWebServer();
#endif
  initOTA();
  setupWiFi();
  deviceLinkInit();
  initSettings();
  loadRuntimeSettings();
  setRuntimeSettingsChangedCallback(onRuntimeSettingsChanged);
  initMotor(getRuntimeSettings().motorType);
  devMenuRebuildVisible();
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
  static uint32_t undervoltageBelowSinceMs = 0;

  // Update buttons (handles speed changes and trigger state)
  updateButtons();
  
  if (isMotorActive()) {
    const uint8_t speed = getSpeed();
    setMotorSpeedPercent(speed);
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
      motorGetRpm(),
      motorIsRpmReady(),
      getBatteryVoltage(),
      getTemperature(),
      isTemperatureReady());

  {
    const RuntimeSettings& rsLed = getRuntimeSettings();
    const MaximumStatsForDisplay mxLed = maximumStatsGetForDisplay();
    updateLEDBarGraph(
        getBatterySOC(),
        motorGetRpm(),
        motorIsRpmReady(),
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
        if (deviceLinkHasActiveClients()) {
          String notifyJson;
          char text[96];
          snprintf(text,
                   sizeof(text),
                   "Motor stopped: auto-off after %u min",
                   static_cast<unsigned>(autoOffMin));
          deviceProtocolBuildNotifyJson(notifyJson, "auto_off", text, "info");
          deviceLinkBroadcast(notifyJson.c_str());
        }
      }
    }

    const uint8_t lim = getRuntimeSettings().tempLimitC;
    if (lim > 0 && isTemperatureReady() && getTemperature() > static_cast<float>(lim)) {
      setMotorState(false);
      motorRunStartMs = 0;
      triggerThermalOffBlink();
      Serial.printf("[Main] Motor stopped: NTC > %u C\n", static_cast<unsigned>(lim));
      if (deviceLinkHasActiveClients()) {
        String notifyJson;
        char text[96];
        snprintf(text,
                 sizeof(text),
                 "Motor stopped due to over-temperature (limit %u °C)",
                 static_cast<unsigned>(lim));
        deviceProtocolBuildNotifyJson(notifyJson, "thermal_stop", text, "warning");
        deviceLinkBroadcast(notifyJson.c_str());
      }
    }

    const uint8_t cells = getRuntimeSettings().batterySeriesCells;
    if (cells > 0) {
      const float packV = getBatteryVoltage();
      if (packV > 0.05f) {
        const float cellV = packV / static_cast<float>(cells);
        const float minCellV = SettingsConfig::DEFAULT_MIN_CELL_VOLTAGE_CUTOFF;
        if (cellV < minCellV) {
          const uint32_t now = millis();
          if (undervoltageBelowSinceMs == 0) {
            undervoltageBelowSinceMs = now;
          } else if ((now - undervoltageBelowSinceMs) >= 400) {
            setMotorState(false);
            motorRunStartMs = 0;
            undervoltageBelowSinceMs = 0;
            Serial.printf("[Main] Motor stopped: pack undervoltage (%.2f V, %.2f V/cell)\n",
                          static_cast<double>(packV),
                          static_cast<double>(cellV));
            if (deviceLinkHasActiveClients()) {
              String notifyJson;
              char text[96];
              snprintf(text,
                       sizeof(text),
                       "Motor stopped: battery undervoltage (%.2f V, %.2f V/cell)",
                       static_cast<double>(packV),
                       static_cast<double>(cellV));
              deviceProtocolBuildNotifyJson(notifyJson, "undervoltage_stop", text, "warning");
              deviceLinkBroadcast(notifyJson.c_str());
            }
          }
        } else {
          undervoltageBelowSinceMs = 0;
        }
      }
    }
  } else {
    undervoltageBelowSinceMs = 0;
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
    motorGetRpm(),
    isTriggerPressed(),
    motorIsRpmReady(),
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
    static_cast<uint8_t>(rs.motorType),
    mx.maxRpm,
    mx.hasMaxRpm,
    mx.maxVoltageV,
    mx.hasMaxVoltage,
    mx.maxMotorTempC,
    mx.hasMaxMotorTemp,
  };
  updateDisplay(telemetry);
  updateMotor();  // Check heartbeat timeout
#ifndef OSHVAC_BLE_PRIMARY
  updateWebServer();
#endif
  deviceLinkUpdate();

  if (millis() > nextBroadcastTime) {
    const uint8_t speedPercent = getSpeed();
    const float batteryVoltage = getBatteryVoltage();
    const float rpmValue = motorGetRpm();
    const bool motorActive = isMotorActive();

    char serialLine[160];
    snprintf(serialLine, sizeof(serialLine),
             "Temperature: %.2f / Battery: %.2f / RPM: %.0f / Speed: %u%%",
             getTemperature(), batteryVoltage, rpmValue, static_cast<unsigned>(speedPercent));
    Serial.println(serialLine);

    if (deviceLinkHasActiveClients()) {
      String jsonBuffer;
      deviceProtocolBuildTelemetryJson(jsonBuffer,
                                       getTemperature(),
                                       getBatteryVoltage(),
                                       motorGetRpm(),
                                       speedPercent,
                                       motorActive,
                                       getBatterySOC());
      if (jsonBuffer.length() > 0) {
        deviceLinkBroadcast(jsonBuffer.c_str());
      }
    }
    
    nextBroadcastTime = millis() + broadcastInterval;
  }
}

