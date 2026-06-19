#ifndef DEVICE_PROTOCOL_H
#define DEVICE_PROTOCOL_H

#include <stddef.h>
#include <stdint.h>

#include <WString.h>

struct DeviceCommandResult {
  bool handled = false;
  bool motorTypeChanged = false;
  bool requestSettingsBroadcast = false;
  bool hasUnicast = false;
  String unicastJson;
};

/** Parse a JSON command from any transport (WebSocket, BLE, …). */
DeviceCommandResult deviceProtocolHandleJson(const char* json, size_t len);

/** Full settings + schema payload (same shape as WebSocket get_settings). */
void deviceProtocolBuildSettingsPayload(String& out);

/** Live telemetry JSON broadcast every control loop tick. */
void deviceProtocolBuildTelemetryJson(String& out,
                                      float tempC,
                                      float batteryV,
                                      float rpm,
                                      uint8_t speedPercent,
                                      bool motorActive,
                                      int8_t batterySoc);

#endif  // DEVICE_PROTOCOL_H
