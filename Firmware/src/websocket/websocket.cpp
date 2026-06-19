#include <Arduino.h>
#include <string.h>
#include "websocket.h"
#include "wifi/wifi.h"
#include <WebSocketsServer.h>
#include "../device_protocol/device_protocol.h"

#define WEBSOCKET_PORT 81

WebSocketsServer webSocket = WebSocketsServer(WEBSOCKET_PORT);

static bool serverRunning = false;
static WebSocketCommandCallback commandCallback = nullptr;

void webSocketEvent(uint8_t num, WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      Serial.printf("[WebSocket] Client %u disconnected\n", num);
      break;

    case WStype_CONNECTED: {
      IPAddress ip = webSocket.remoteIP(num);
      Serial.printf("[WebSocket] Client %u connected from %d.%d.%d.%d\n", num, ip[0], ip[1], ip[2], ip[3]);
      Serial.printf("[WebSocket] Total connected clients: %u\n", webSocket.connectedClients());
      break;
    }

    case WStype_TEXT: {
      Serial.printf("[WebSocket] Received: %s\n", payload);
      DeviceCommandResult result = deviceProtocolHandleJson(reinterpret_cast<const char*>(payload), length);
      if (result.hasUnicast) {
        webSocket.sendTXT(num, result.unicastJson);
      }
      break;
    }

    default:
      break;
  }
}

void initWebSocket() {
  serverRunning = false;
}

void updateWebSocket() {
  if (!serverRunning && isWiFiStackReady()) {
    webSocket.begin();
    webSocket.onEvent(webSocketEvent);
    serverRunning = true;

    IPAddress ip;
    if (WiFi.status() == WL_CONNECTED) {
      ip = WiFi.localIP();
    } else {
      ip = WiFi.softAPIP();
    }

    Serial.printf("[WebSocket] Server started on ws://%d.%d.%d.%d:%d\n", ip[0], ip[1], ip[2], ip[3], WEBSOCKET_PORT);
  }

  if (serverRunning) {
    webSocket.loop();
  }
}

void broadcastWebSocket(const char* json) {
  if (serverRunning && json != nullptr) {
    webSocket.broadcastTXT(json);
  }
}

void sendWebSocketToClient(uint8_t client, const char* json) {
  if (serverRunning && json != nullptr) {
    webSocket.sendTXT(client, json);
  }
}

void broadcastSettingsToClients() {
  String payload;
  deviceProtocolBuildSettingsPayload(payload);
  broadcastWebSocket(payload.c_str());
}

void requestSettingsBroadcast() {
  broadcastSettingsToClients();
}

bool isWebSocketRunning() {
  return serverRunning;
}

void setWebSocketCommandCallback(WebSocketCommandCallback callback) {
  commandCallback = callback;
}
