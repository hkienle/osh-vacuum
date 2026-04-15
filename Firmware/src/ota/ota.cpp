#include "ota.h"

#include <Arduino.h>
#include <ArduinoOTA.h>

#include "display/display.h"
#include "settings/settings_config.h"
#include "wifi/wifi.h"

namespace {
bool otaRunning = false;
volatile bool otaUpdateActive = false;
volatile uint8_t otaProgressPercent = 0;
volatile uint32_t otaOverlayUntilMs = 0;
}  // namespace

bool isOtaUpdateActive() {
  return otaUpdateActive;
}

uint8_t getOtaProgressPercent() {
  return otaProgressPercent;
}

void initOTA() {
  otaRunning = false;
  otaUpdateActive = false;
  otaProgressPercent = 0;
  otaOverlayUntilMs = 0;
}

void updateOTA() {
  if (!otaRunning && isWiFiStackReady()) {
    ArduinoOTA.setHostname(SettingsConfig::DEVICE_HOSTNAME);
    ArduinoOTA.setPassword(SettingsConfig::OTA_HTTP_PASSWORD);
    ArduinoOTA.setRebootOnSuccess(false);

    ArduinoOTA.onStart([]() {
      otaUpdateActive = true;
      otaProgressPercent = 0;
      otaOverlayUntilMs = 0;
      updateDisplayOtaScreen(0);
      Serial.println("[OTA] Start");
    });
    ArduinoOTA.onEnd([]() {
      otaProgressPercent = 100;
      otaUpdateActive = true;
      otaOverlayUntilMs = millis() + 1000UL;
      updateDisplayOtaScreen(100);
      Serial.println("\n[OTA] End");
      delay(200);
      ESP.restart();
    });
    ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
      const unsigned int pct = total == 0 ? 0U : (progress * 100U) / total;
      otaUpdateActive = true;
      otaOverlayUntilMs = 0;
      otaProgressPercent = static_cast<uint8_t>(pct > 100U ? 100U : pct);
      updateDisplayOtaScreen(otaProgressPercent);
      Serial.printf("[OTA] Progress: %u%%\r", pct);
    });
    ArduinoOTA.onError([](ota_error_t error) {
      otaUpdateActive = false;
      otaProgressPercent = 0;
      otaOverlayUntilMs = 0;
      Serial.printf("[OTA] Error[%u]\n", static_cast<unsigned>(error));
    });

    ArduinoOTA.begin();
    otaRunning = true;

    Serial.printf("[OTA] Ready: pio run -e esp32-s3-ota -t upload --upload-port %s.local\n",
                  SettingsConfig::DEVICE_HOSTNAME);
  }

  if (otaRunning) {
    ArduinoOTA.handle();
  }

  if (otaUpdateActive && otaOverlayUntilMs != 0) {
    if (static_cast<int32_t>(millis() - otaOverlayUntilMs) >= 0) {
      otaUpdateActive = false;
      otaOverlayUntilMs = 0;
    }
  }
}
