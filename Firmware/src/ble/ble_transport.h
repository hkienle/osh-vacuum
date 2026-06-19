#ifndef BLE_TRANSPORT_H
#define BLE_TRANSPORT_H

#include <stdint.h>

void initBleTransport();
void updateBleTransport();

/** Send JSON to the connected BLE client (chunked when needed). */
void bleTransportSendJson(const char* json);

bool bleTransportHasClient();

#endif  // BLE_TRANSPORT_H
