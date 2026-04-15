#ifndef OTA_H
#define OTA_H

#include <stdint.h>

// ArduinoOTA: password from SettingsConfig::OTA_HTTP_PASSWORD (must match
// platformio.ini [env:esp32-s3-ota] --auth). See Firmware README → OTA.

// Initialize OTA state (does not start network services yet).
void initOTA();

// Start OTA when WiFi is ready and handle OTA events.
void updateOTA();

// True while a firmware OTA transfer is in progress (for display overlay).
bool isOtaUpdateActive();

// 0–100 while active; last value may remain briefly after completion.
uint8_t getOtaProgressPercent();

#endif  // OTA_H
