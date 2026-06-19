#include "device_link.h"

#include "../ble/ble_transport.h"
#include "../device_protocol/device_protocol.h"
#include "../websocket/websocket.h"

namespace {
volatile bool settingsBroadcastPending = false;
}  // namespace

void deviceLinkInit() {
  initWebSocket();
  initBleTransport();
}

void deviceLinkUpdate() {
  updateWebSocket();
  updateBleTransport();
  if (settingsBroadcastPending) {
    settingsBroadcastPending = false;
    String payload;
    deviceProtocolBuildSettingsPayload(payload);
    deviceLinkBroadcast(payload.c_str());
  }
}

void deviceLinkBroadcast(const char* json) {
  if (json == nullptr || json[0] == '\0') {
    return;
  }
  broadcastWebSocket(json);
  if (bleTransportHasClient()) {
    bleTransportSendJson(json);
  }
}

void deviceLinkSendToWebSocketClient(uint8_t client, const char* json) {
  sendWebSocketToClient(client, json);
}

void deviceLinkRequestSettingsBroadcast() {
  settingsBroadcastPending = true;
}

bool deviceLinkHasActiveClients() {
  return isWebSocketRunning() || bleTransportHasClient();
}
