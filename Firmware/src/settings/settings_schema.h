#ifndef SETTINGS_SCHEMA_H
#define SETTINGS_SCHEMA_H

#include <stddef.h>
#include <stdint.h>

#include "dev_menu.h"
#include "settings.h"

struct SettingEnumOption {
  uint8_t value;
  const char* label;
};

struct SettingSchemaEntry {
  DevSettingId id;
  const char* key;
  const char* title;
  const char* subline;
  const SettingEnumOption* enumOptions;
  size_t enumOptionCount;
};

const SettingSchemaEntry* settingsSchemaById(DevSettingId id);
const SettingSchemaEntry* settingsSchemaByKey(const char* key);
size_t settingsSchemaEntryCount();
const SettingSchemaEntry* settingsSchemaEntryAt(size_t idx);

void settingsFormatValue(DevSettingId id, const RuntimeSettings& rs, char* out, size_t n);
void settingsFormatSubline(DevSettingId id, const RuntimeSettings& rs, char* out, size_t n);

void settingsCycleGlobalValue(RuntimeSettings& rs, DevSettingId id);
bool settingsGlobalVisibleForMotorType(DevSettingId id, MotorType type);

void settingsGetAllowedRange(DevSettingId id, const RuntimeSettings& rs, uint8_t* outMin, uint8_t* outMax, bool* outHasRange);
const uint8_t* settingsGetAllowedValues(DevSettingId id, size_t* outCount);

#endif  // SETTINGS_SCHEMA_H
