#ifndef BLE_TRANSPORT_H
#define BLE_TRANSPORT_H

#include <stdint.h>

void initBleTransport();
void updateBleTransport();

/** Send JSON to the connected BLE client (chunked when needed). */
void bleTransportSendJson(const char* json);

bool bleTransportHasClient();

/** True while a (possibly multi-fragment) BLE TX is in progress or queued. */
bool bleTransportIsTxBusy();

#endif  // BLE_TRANSPORT_H
