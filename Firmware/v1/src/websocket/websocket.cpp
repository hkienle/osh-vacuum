#include <Arduino.h>
#include <string.h>
#include "websocket.h"
#include "wifi/wifi.h"
#include <WebSocketsServer.h>
#include <ArduinoJson.h>
#include "motor/motor.h"
#include "button/button.h"
#include "settings/settings_api.h"
#include "settings/settings.h"
#include "settings/dev_menu.h"

#define WEBSOCKET_PORT 81

// WebSocket server instance
WebSocketsServer webSocket = WebSocketsServer(WEBSOCKET_PORT);

// State
static bool serverRunning = false;
static WebSocketCommandCallback commandCallback = nullptr;
static volatile bool settingsBroadcastPending = false;
constexpr size_t kSettingsJsonCapacity = 8192;

namespace {
void sendSettingsPayloadToClient(uint8_t client) {
  DynamicJsonDocument outDoc(kSettingsJsonCapacity);
  settingsApiWritePayload(outDoc.to<JsonObject>());
  if (outDoc.overflowed()) {
    Serial.println("[WebSocket] WARN: settings payload JSON overflow (client)");
  }
  String out;
  out.reserve(6144);
  serializeJson(outDoc, out);
  webSocket.sendTXT(client, out);
}
}

// WebSocket event handler
void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.printf("[WebSocket] Client %u disconnected\n", num);
      break;
      
    case WStype_CONNECTED:
      {
        IPAddress ip = webSocket.remoteIP(num);
        Serial.printf("[WebSocket] Client %u connected from %d.%d.%d.%d\n", num, ip[0], ip[1], ip[2], ip[3]);
        Serial.printf("[WebSocket] Total connected clients: %u\n", webSocket.connectedClients());
      }
      break;
      
    case WStype_TEXT:
      {
        Serial.printf("[WebSocket] Received: %s\n", payload);
        
        // Parse JSON command
        StaticJsonDocument<200> doc;
        DeserializationError error = deserializeJson(doc, payload);
        
        if (error) {
          Serial.printf("[WebSocket] JSON parse error: %s\n", error.c_str());
          return;
        }
        
        // Check for command strings first (motor_start, motor_stop)
        if (doc.containsKey("command") && doc["command"].is<const char*>()) {
          const char* command = doc["command"];
          if (strcmp(command, "motor_start") == 0) {
            setMotorState(true);
            Serial.println("[WebSocket] Motor START command received");
            return;
          } else if (strcmp(command, "motor_stop") == 0) {
            setMotorState(false);
            Serial.println("[WebSocket] Motor STOP command received");
            return;
          } else if (strcmp(command, "heartbeat") == 0) {
            handleMotorHeartbeat();
            return;
          } else if (strcmp(command, "get_settings") == 0) {
            sendSettingsPayloadToClient(num);
            return;
          } else if (strcmp(command, "set_setting") == 0) {
            const char* key = doc["key"] | "";
            const JsonVariantConst value = doc["value"];
            RuntimeSettings& rs = getRuntimeSettings();
            const MotorType oldType = rs.motorType;
            const bool ok = settingsApiApplySetting(rs, key, value);
            if (ok && oldType != rs.motorType) {
              initMotor(rs.motorType);
              devMenuRebuildVisible();
            }
            StaticJsonDocument<160> ackDoc;
            ackDoc["ack"] = "set_setting";
            ackDoc["key"] = key;
            ackDoc["ok"] = ok;
            String ack;
            serializeJson(ackDoc, ack);
            webSocket.sendTXT(num, ack);
            return;
          }
        }
        
        // Process each key-value pair in the JSON
        JsonObject obj = doc.as<JsonObject>();
        for (JsonPair pair : obj) {
          const char* key = pair.key().c_str();
          
          // Handle speed command (0-100%)
          if (strcmp(key, "speed") == 0) {
            if (pair.value().is<int>()) {
              int speed = pair.value().as<int>();
              // Constrain to 0-100 and round to 20% steps
              if (speed < 0) speed = 0;
              if (speed > 100) speed = 100;
              setSpeed(speed);
              Serial.printf("[WebSocket] Speed set to %d%%\n", speed);
            } else if (pair.value().is<float>()) {
              int speed = (int)pair.value().as<float>();
              if (speed < 0) speed = 0;
              if (speed > 100) speed = 100;
              setSpeed(speed);
              Serial.printf("[WebSocket] Speed set to %d%%\n", speed);
            }
            continue;
          }
          
          // Check if value is a number
          if (pair.value().is<int>()) {
            int value = pair.value().as<int>();
            Serial.printf("[WebSocket] Command: %s = %d\n", key, value);
            
            // Handle motor commands (legacy support)
            handleMotorCommand(key, value);
            
            // Call callback if set (for other commands)
            if (commandCallback != nullptr) {
              commandCallback(key, value);
            }
          } else if (pair.value().is<float>()) {
            int value = (int)pair.value().as<float>();
            Serial.printf("[WebSocket] Command: %s = %d\n", key, value);
            
            // Handle motor commands (legacy support)
            handleMotorCommand(key, value);
            
            // Call callback if set (for other commands)
            if (commandCallback != nullptr) {
              commandCallback(key, value);
            }
          }
        }
      }
      break;
      
    default:
      break;
  }
}

void initWebSocket() {
  // Server will be started when WiFi is ready
  serverRunning = false;
}

void updateWebSocket() {
  // Check if WiFi is ready and server is not running
  if (!serverRunning && isWiFiStackReady()) {
    // Start WebSocket server
    webSocket.begin();
    webSocket.onEvent(webSocketEvent);
    serverRunning = true;
    
    IPAddress ip;
    if (WiFi.status() == WL_CONNECTED) {
      ip = WiFi.localIP();
    } else {
      ip = WiFi.softAPIP();
    }
    
    Serial.printf("[WebSocket] Server started on ws://%d.%d.%d.%d:%d\n", 
                  ip[0], ip[1], ip[2], ip[3], WEBSOCKET_PORT);
  }
  
  // Handle WebSocket events if server is running
  if (serverRunning) {
    webSocket.loop();
    if (settingsBroadcastPending) {
      settingsBroadcastPending = false;
      broadcastSettingsToClients();
    }
  }
}

void broadcastWebSocket(const char* json) {
  if (serverRunning) {
    webSocket.broadcastTXT(json);
  }
}

void broadcastSettingsToClients() {
  if (!serverRunning) {
    return;
  }
  DynamicJsonDocument outDoc(kSettingsJsonCapacity);
  settingsApiWritePayload(outDoc.to<JsonObject>());
  if (outDoc.overflowed()) {
    Serial.println("[WebSocket] WARN: settings payload JSON overflow (broadcast)");
  }
  String out;
  out.reserve(6144);
  serializeJson(outDoc, out);
  webSocket.broadcastTXT(out);
}

void requestSettingsBroadcast() {
  settingsBroadcastPending = true;
}

bool isWebSocketRunning() {
  return serverRunning;
}

void setWebSocketCommandCallback(WebSocketCommandCallback callback) {
  commandCallback = callback;
}

