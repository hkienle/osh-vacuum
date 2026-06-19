#ifndef DEVICE_LINK_H
#define DEVICE_LINK_H

#include <stdint.h>

/** Initialize all device transports (WebSocket, BLE). */
void deviceLinkInit();

/** Pump transport event loops (call from main loop). */
void deviceLinkUpdate();

/** Broadcast JSON to all connected clients on every transport. */
void deviceLinkBroadcast(const char* json);

/** Send JSON to a single WebSocket client (legacy client id). */
void deviceLinkSendToWebSocketClient(uint8_t client, const char* json);

/** Queue settings payload broadcast on next update tick. */
void deviceLinkRequestSettingsBroadcast();

bool deviceLinkHasActiveClients();

#endif  // DEVICE_LINK_H
