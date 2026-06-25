#ifndef WEBSOCKET_H
#define WEBSOCKET_H

#include <WiFi.h>

// Initialize WebSocket server
void initWebSocket();

// Update WebSocket (call this in loop())
void updateWebSocket();

// Broadcast JSON message to all connected clients
void broadcastWebSocket(const char* json);
void sendWebSocketToClient(uint8_t client, const char* json);
void broadcastSettingsToClients();
void requestSettingsBroadcast();

// Check if WebSocket server is running
bool isWebSocketRunning();

// Callback function type for received commands
typedef void (*WebSocketCommandCallback)(const char* key, int value);

// Set callback for received commands
void setWebSocketCommandCallback(WebSocketCommandCallback callback);

#endif // WEBSOCKET_H

