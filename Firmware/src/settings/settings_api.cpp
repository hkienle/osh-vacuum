#include "settings_api.h"

#include <string.h>

#include "settings_schema.h"

namespace {

void writeSchema(JsonObject outSchema, const RuntimeSettings& rs) {
  JsonArray entries = outSchema.createNestedArray("entries");
  for (size_t i = 0; i < settingsSchemaEntryCount(); ++i) {
    const SettingSchemaEntry* entry = settingsSchemaEntryAt(i);
    if (!entry) {
      continue;
    }
    JsonObject j = entries.createNestedObject();
    j["id"] = static_cast<uint8_t>(entry->id);
    j["key"] = entry->key;
    j["title"] = entry->title;
    j["visible"] = settingsGlobalVisibleForMotorType(entry->id, rs.motorType);
    if (entry->subline) {
      j["subline"] = entry->subline;
    }
    char dynamicSubline[48];
    settingsFormatSubline(entry->id, rs, dynamicSubline, sizeof(dynamicSubline));
    if (dynamicSubline[0] != '\0') {
      j["subline_dynamic"] = dynamicSubline;
    }

    size_t allowedCount = 0;
    const uint8_t* allowed = settingsGetAllowedValues(entry->id, &allowedCount);
    if (allowed && allowedCount > 0) {
      JsonArray vals = j.createNestedArray("allowed_values");
      for (size_t k = 0; k < allowedCount; ++k) {
        vals.add(allowed[k]);
      }
    }
    uint8_t rangeMin = 0;
    uint8_t rangeMax = 0;
    bool hasRange = false;
    settingsGetAllowedRange(entry->id, rs, &rangeMin, &rangeMax, &hasRange);
    if (hasRange) {
      j["range_min"] = rangeMin;
      j["range_max"] = rangeMax;
    }
    if (entry->enumOptions && entry->enumOptionCount > 0) {
      JsonArray enums = j.createNestedArray("enum_options");
      for (size_t e = 0; e < entry->enumOptionCount; ++e) {
        JsonObject o = enums.createNestedObject();
        o["value"] = entry->enumOptions[e].value;
        o["label"] = entry->enumOptions[e].label;
      }
    }
  }
}

uint8_t parseNumeric(JsonVariantConst value, uint8_t fallback) {
  if (value.is<int>()) {
    int raw = value.as<int>();
    if (raw < 0) {
      return 0;
    }
    if (raw > 255) {
      return 255;
    }
    return static_cast<uint8_t>(raw);
  }
  if (value.is<float>()) {
    float f = value.as<float>();
    if (f < 0.0f) {
      return 0;
    }
    if (f > 255.0f) {
      return 255;
    }
    return static_cast<uint8_t>(f);
  }
  return fallback;
}

}  // namespace

void settingsApiWriteValues(JsonObject outValues, const RuntimeSettings& rs) {
  outValues["auto_off"] = rs.autoOffMinutes;
  outValues["temp_lim"] = rs.tempLimitC;
  outValues["spd_step"] = rs.speedStepPercent;
  outValues["min_duty"] = rs.minDutyPercent;
  outValues["max_duty"] = rs.maxDutyPercent;
  outValues["bat_cells"] = rs.batterySeriesCells;
  outValues["sleep_tmr"] = rs.sleepTimerMinutes;
  outValues["trig_mode"] = static_cast<uint8_t>(rs.triggerMode);
  outValues["mtr_disp"] = static_cast<uint8_t>(rs.motorDisplayMode);
  outValues["led_idle"] = static_cast<uint8_t>(rs.ledIdleDisplayMode);
  outValues["led_disp"] = static_cast<uint8_t>(rs.ledDisplayMode);
  outValues["led_dim"] = rs.ledDimPercent;
  outValues["disp_contrast"] = rs.displayContrastPercent;
  outValues["led_theme"] = static_cast<uint8_t>(rs.ledTheme);
  outValues["mtr_type"] = static_cast<uint8_t>(rs.motorType);
}

void settingsApiWritePayload(JsonObject out) {
  RuntimeSettings& rs = getRuntimeSettings();
  settingsApiWriteValues(out.createNestedObject("settings"), rs);
  writeSchema(out.createNestedObject("schema"), rs);
  out["motor_type"] = static_cast<uint8_t>(rs.motorType);
}

bool settingsApiApplySetting(RuntimeSettings& rs, const char* key, JsonVariantConst value) {
  if (!key || key[0] == '\0') {
    return false;
  }
  if (strcmp(key, "auto_off") == 0) {
    rs.autoOffMinutes = parseNumeric(value, rs.autoOffMinutes);
  } else if (strcmp(key, "temp_lim") == 0) {
    rs.tempLimitC = parseNumeric(value, rs.tempLimitC);
  } else if (strcmp(key, "spd_step") == 0) {
    rs.speedStepPercent = parseNumeric(value, rs.speedStepPercent);
  } else if (strcmp(key, "min_duty") == 0) {
    rs.minDutyPercent = parseNumeric(value, rs.minDutyPercent);
    rs.maxDutyPercent = clampMaxDutyPercent(rs.maxDutyPercent, rs.minDutyPercent);
  } else if (strcmp(key, "max_duty") == 0) {
    rs.maxDutyPercent = parseNumeric(value, rs.maxDutyPercent);
  } else if (strcmp(key, "bat_cells") == 0) {
    rs.batterySeriesCells = parseNumeric(value, rs.batterySeriesCells);
  } else if (strcmp(key, "sleep_tmr") == 0) {
    rs.sleepTimerMinutes = parseNumeric(value, rs.sleepTimerMinutes);
  } else if (strcmp(key, "trig_mode") == 0) {
    rs.triggerMode = static_cast<TriggerMode>(parseNumeric(value, static_cast<uint8_t>(rs.triggerMode)));
  } else if (strcmp(key, "mtr_disp") == 0) {
    rs.motorDisplayMode = static_cast<MotorDisplayMode>(parseNumeric(value, static_cast<uint8_t>(rs.motorDisplayMode)));
  } else if (strcmp(key, "led_idle") == 0) {
    rs.ledIdleDisplayMode = static_cast<LedIdleDisplayMode>(parseNumeric(value, static_cast<uint8_t>(rs.ledIdleDisplayMode)));
  } else if (strcmp(key, "led_disp") == 0) {
    rs.ledDisplayMode = static_cast<LedDisplayMode>(parseNumeric(value, static_cast<uint8_t>(rs.ledDisplayMode)));
  } else if (strcmp(key, "led_dim") == 0) {
    rs.ledDimPercent = parseNumeric(value, rs.ledDimPercent);
  } else if (strcmp(key, "disp_contrast") == 0) {
    rs.displayContrastPercent = parseNumeric(value, rs.displayContrastPercent);
  } else if (strcmp(key, "led_theme") == 0) {
    rs.ledTheme = static_cast<LedTheme>(parseNumeric(value, static_cast<uint8_t>(rs.ledTheme)));
  } else if (strcmp(key, "mtr_type") == 0) {
    rs.motorType = parseMotorType(parseNumeric(value, static_cast<uint8_t>(rs.motorType)));
  } else {
    return false;
  }
  return saveRuntimeSettings(rs);
}
