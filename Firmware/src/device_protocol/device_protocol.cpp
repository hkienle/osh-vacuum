#include "device_protocol.h"

#include <Arduino.h>
#include <ArduinoJson.h>
#include <ESP.h>
#include <string.h>

#include "../motor/motor.h"
#include "../button/button.h"
#include "../settings/dev_menu.h"
#include "../settings/settings.h"
#include "../settings/settings_api.h"
#include "../wifi/wifi.h"
#include "../wifi/wifi_credentials.h"

namespace {
constexpr size_t kSettingsJsonCapacity = 8192;

void applyMotorTypeChangeIfNeeded(bool motorTypeChanged) {
  if (motorTypeChanged) {
    initMotor(getRuntimeSettings().motorType);
    devMenuRebuildVisible();
  }
}

void deviceProtocolWriteWifiStatus(JsonObject out) {
  switch (getWiFiLinkRole()) {
    case WiFiLinkRole::Sta:
      out["wifi_role"] = "sta";
      break;
    case WiFiLinkRole::AccessPoint:
      out["wifi_role"] = "ap";
      out["ap_ssid"] = ap_ssid;
      break;
    default:
      out["wifi_role"] = "none";
      break;
  }
}

bool isValidStaSsid(const char* ssid) {
  if (ssid == nullptr) {
    return false;
  }
  const size_t len = strlen(ssid);
  return len > 0 && len <= WIFI_STA_SSID_MAX;
}

bool isValidStaPassword(const char* password) {
  if (password == nullptr) {
    return true;
  }
  return strlen(password) <= WIFI_STA_PASSWORD_MAX;
}
}  // namespace

DeviceCommandResult deviceProtocolHandleJson(const char* json, size_t len) {
  DeviceCommandResult result;

  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, json, len);
  if (error) {
    Serial.printf("[DeviceProtocol] JSON parse error: %s\n", error.c_str());
    return result;
  }

  if (doc.containsKey("command") && doc["command"].is<const char*>()) {
    const char* command = doc["command"];
    if (strcmp(command, "motor_start") == 0) {
      setMotorState(true);
      result.handled = true;
      return result;
    }
    if (strcmp(command, "motor_stop") == 0) {
      setMotorState(false);
      result.handled = true;
      return result;
    }
    if (strcmp(command, "heartbeat") == 0) {
      handleMotorHeartbeat();
      result.handled = true;
      return result;
    }
    if (strcmp(command, "get_settings") == 0) {
      deviceProtocolBuildSettingsPayload(result.unicastJson);
      result.hasUnicast = true;
      result.handled = true;
      return result;
    }
    if (strcmp(command, "set_setting") == 0) {
      const char* key = doc["key"] | "";
      const JsonVariantConst value = doc["value"];
      RuntimeSettings& rs = getRuntimeSettings();
      const MotorType oldType = rs.motorType;
      const bool ok = settingsApiApplySetting(rs, key, value);
      result.motorTypeChanged = ok && oldType != rs.motorType;
      applyMotorTypeChangeIfNeeded(result.motorTypeChanged);

      StaticJsonDocument<160> ackDoc;
      ackDoc["ack"] = "set_setting";
      ackDoc["key"] = key;
      ackDoc["ok"] = ok;
      serializeJson(ackDoc, result.unicastJson);
      result.hasUnicast = true;
      result.handled = true;
      return result;
    }
    if (strcmp(command, "set_wifi") == 0) {
      const char* ssid = doc["ssid"] | "";
      const char* password = doc["password"] | "";
      const bool inApMode = getWiFiLinkRole() == WiFiLinkRole::AccessPoint;
      const bool valid = inApMode && isValidStaSsid(ssid) && isValidStaPassword(password);
      bool ok = false;

      if (valid) {
        ok = wifiCredentialsSave(ssid, password);
        if (ok) {
          wifiCredentialsSetProbePending();
          result.requestRestart = true;
        }
      }

      StaticJsonDocument<192> ackDoc;
      ackDoc["ack"] = "set_wifi";
      ackDoc["ok"] = ok;
      if (!inApMode) {
        ackDoc["error"] = "not_ap_mode";
      } else if (!isValidStaSsid(ssid)) {
        ackDoc["error"] = "invalid_ssid";
      } else if (!isValidStaPassword(password)) {
        ackDoc["error"] = "invalid_password";
      } else if (!ok) {
        ackDoc["error"] = "save_failed";
      }
      serializeJson(ackDoc, result.unicastJson);
      result.hasUnicast = true;
      result.handled = true;
      return result;
    }
  }

  JsonObject obj = doc.as<JsonObject>();
  for (JsonPair pair : obj) {
    const char* key = pair.key().c_str();

    if (strcmp(key, "speed") == 0) {
      int speed = 0;
      if (pair.value().is<int>()) {
        speed = pair.value().as<int>();
      } else if (pair.value().is<float>()) {
        speed = static_cast<int>(pair.value().as<float>());
      }
      if (speed < 0) {
        speed = 0;
      }
      if (speed > 100) {
        speed = 100;
      }
      setSpeed(static_cast<uint8_t>(speed));
      result.handled = true;
      continue;
    }

    if (pair.value().is<int>() || pair.value().is<float>()) {
      const int value = pair.value().is<int>() ? pair.value().as<int>()
                                               : static_cast<int>(pair.value().as<float>());
      handleMotorCommand(key, value);
      result.handled = true;
    }
  }

  return result;
}

void deviceProtocolBuildSettingsPayload(String& out) {
  DynamicJsonDocument outDoc(kSettingsJsonCapacity);
  settingsApiWritePayload(outDoc.to<JsonObject>());
  deviceProtocolWriteWifiStatus(outDoc.to<JsonObject>());
  if (outDoc.overflowed()) {
    Serial.println("[DeviceProtocol] WARN: settings payload JSON overflow");
  }
  out.reserve(6144);
  serializeJson(outDoc, out);
}

void deviceProtocolBuildTelemetryJson(String& out,
                                      float tempC,
                                      float batteryV,
                                      float rpm,
                                      uint8_t speedPercent,
                                      bool motorActive,
                                      int8_t batterySoc) {
  const char* roleStr = "none";
  switch (getWiFiLinkRole()) {
    case WiFiLinkRole::Sta:
      roleStr = "sta";
      break;
    case WiFiLinkRole::AccessPoint:
      roleStr = "ap";
      break;
    default:
      break;
  }

  char buffer[384];
  const int n = snprintf(buffer,
                         sizeof(buffer),
                         "{\"temp\":%.2f,\"battery\":%.2f,\"rpm\":%.0f,\"speed\":%u,\"motor_active\":%s,\"battery_soc\":%d,\"wifi_role\":\"%s\"}",
                         tempC,
                         batteryV,
                         rpm,
                         static_cast<unsigned>(speedPercent),
                         motorActive ? "true" : "false",
                         static_cast<int>(batterySoc),
                         roleStr);
  if (n > 0 && static_cast<size_t>(n) < sizeof(buffer)) {
    out = buffer;
  } else {
    out = "{}";
  }
}

void deviceProtocolBuildNotifyJson(String& out,
                                   const char* id,
                                   const char* text,
                                   const char* level) {
  StaticJsonDocument<384> doc;
  JsonObject notify = doc.createNestedObject("notify");
  notify["id"] = id;
  notify["text"] = text;
  notify["level"] = level;
  serializeJson(doc, out);
}

void deviceProtocolAfterCommand(const DeviceCommandResult& result) {
  if (result.requestRestart) {
    delay(800);
    ESP.restart();
  }
}
