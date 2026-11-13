#ifndef SETTINGS_API_H
#define SETTINGS_API_H

#include <ArduinoJson.h>

#include "settings.h"

void settingsApiWritePayload(JsonObject out);
void settingsApiWriteValues(JsonObject outValues, const RuntimeSettings& rs);
bool settingsApiApplySetting(RuntimeSettings& rs, const char* key, JsonVariantConst value);

#endif  // SETTINGS_API_H
