#include "settings_schema.h"

#include <stdio.h>
#include <string.h>

#include "../battery_soc/battery_soc.h"

namespace {
constexpr char KEY_AUTO_OFF[] = "auto_off";
constexpr char KEY_TEMP_LIM[] = "temp_lim";
constexpr char KEY_SPD_STEP[] = "spd_step";
constexpr char KEY_MIN_DUTY[] = "min_duty";
constexpr char KEY_MAX_DUTY[] = "max_duty";
constexpr char KEY_BAT_CELLS[] = "bat_cells";
constexpr char KEY_SLEEP_TMR[] = "sleep_tmr";
constexpr char KEY_TRIG_MODE[] = "trig_mode";
constexpr char KEY_MTR_DISP[] = "mtr_disp";
constexpr char KEY_LED_IDLE[] = "led_idle";
constexpr char KEY_LED_DISP[] = "led_disp";
constexpr char KEY_LED_DIM[] = "led_dim";
constexpr char KEY_DISP_CONTRAST[] = "disp_contrast";
constexpr char KEY_LED_THEME[] = "led_theme";
constexpr char KEY_MTR_TYPE[] = "mtr_type";

constexpr uint8_t kAutoOffValues[] = {0, 1, 2, 5, 10, 30};
constexpr uint8_t kTempValues[] = {0, 30, 35, 40, 45, 50, 55, 60, 65, 70};
constexpr uint8_t kSpeedStepValues[] = {1, 5, 10, 20, 25};
constexpr uint8_t kMinDutyValues[] = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
                                      16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30};
constexpr uint8_t kBatteryCellsValues[] = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14};
constexpr uint8_t kSleepValues[] = {1, 2, 5, 10, 30};
constexpr uint8_t kLedDimValues[] = {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30, 35, 40, 45, 50};
constexpr uint8_t kDisplayContrastValues[] = {10, 20, 30, 40, 50, 60, 70, 80, 90, 100};

constexpr SettingEnumOption kTriggerOptions[] = {{static_cast<uint8_t>(TriggerMode::Hold), "Hold"},
                                                 {static_cast<uint8_t>(TriggerMode::DoublePress), "Double-Press"}};
constexpr SettingEnumOption kMotorDispOptions[] = {{static_cast<uint8_t>(MotorDisplayMode::Speed), "Speed"},
                                                   {static_cast<uint8_t>(MotorDisplayMode::Voltage), "Voltage"},
                                                   {static_cast<uint8_t>(MotorDisplayMode::Rpm), "RPM"},
                                                   {static_cast<uint8_t>(MotorDisplayMode::MotorTemp), "MOT Temp"}};
constexpr SettingEnumOption kLedIdleOptions[] = {{static_cast<uint8_t>(LedIdleDisplayMode::Soc), "SOC"},
                                                 {static_cast<uint8_t>(LedIdleDisplayMode::Speed), "Speed"},
                                                 {static_cast<uint8_t>(LedIdleDisplayMode::Rpm), "RPM"}};
constexpr SettingEnumOption kLedDispOptions[] = {{static_cast<uint8_t>(LedDisplayMode::Soc), "SOC"},
                                                 {static_cast<uint8_t>(LedDisplayMode::Rpm), "RPM"},
                                                 {static_cast<uint8_t>(LedDisplayMode::Speed), "Speed"},
                                                 {static_cast<uint8_t>(LedDisplayMode::Temp), "Temp"}};
constexpr SettingEnumOption kThemeOptions[] = {{static_cast<uint8_t>(LedTheme::Off), "Off"},
                                               {static_cast<uint8_t>(LedTheme::White), "White"},
                                               {static_cast<uint8_t>(LedTheme::Blue), "Blue"},
                                               {static_cast<uint8_t>(LedTheme::Green), "Green"},
                                               {static_cast<uint8_t>(LedTheme::Pink), "Pink"},
                                               {static_cast<uint8_t>(LedTheme::Orange), "Orange"},
                                               {static_cast<uint8_t>(LedTheme::Yellow), "Yellow"}};
constexpr SettingEnumOption kMotorTypeOptions[] = {{static_cast<uint8_t>(MotorType::GenericPwm), "Generic (PWM)"},
                                                   {static_cast<uint8_t>(MotorType::XiaomiG), "Xiaomi G"}};

constexpr SettingSchemaEntry kEntries[] = {
    {DevSettingId::AutoOff, KEY_AUTO_OFF, "Auto-Off", "Motor Shutdown", nullptr, 0},
    {DevSettingId::TempLimit, KEY_TEMP_LIM, "Temp. Shutdown", "Motor NTC", nullptr, 0},
    {DevSettingId::SpeedStep, KEY_SPD_STEP, "Speed Steps", "Increase by ...", nullptr, 0},
    {DevSettingId::MinDuty, KEY_MIN_DUTY, "Minimum Duty", "Motor PWM Floor", nullptr, 0},
    {DevSettingId::MaxDuty, KEY_MAX_DUTY, "Maximum Duty", "@ speed 100%", nullptr, 0},
    {DevSettingId::BatteryCells, KEY_BAT_CELLS, "Battery Cells", nullptr, nullptr, 0},
    {DevSettingId::SleepTimer, KEY_SLEEP_TMR, "Sleep Timer", "UI + Controller", nullptr, 0},
    {DevSettingId::TriggerMode, KEY_TRIG_MODE, "Trigger Mode", nullptr, kTriggerOptions, sizeof(kTriggerOptions) / sizeof(kTriggerOptions[0])},
    {DevSettingId::MotorDisplayMode, KEY_MTR_DISP, "Live-Display", nullptr, kMotorDispOptions, sizeof(kMotorDispOptions) / sizeof(kMotorDispOptions[0])},
    {DevSettingId::LedIdle, KEY_LED_IDLE, "LED (Idle)", nullptr, kLedIdleOptions, sizeof(kLedIdleOptions) / sizeof(kLedIdleOptions[0])},
    {DevSettingId::LedDisplay, KEY_LED_DISP, "LED (Motor On)", nullptr, kLedDispOptions, sizeof(kLedDispOptions) / sizeof(kLedDispOptions[0])},
    {DevSettingId::LedDim, KEY_LED_DIM, "Off-Led", "Brightness", nullptr, 0},
    {DevSettingId::LedTheme, KEY_LED_THEME, "LED Theme", nullptr, kThemeOptions, sizeof(kThemeOptions) / sizeof(kThemeOptions[0])},
    {DevSettingId::DisplayContrast, KEY_DISP_CONTRAST, "Display Brightness", "OLED Contrast", nullptr, 0},
    {DevSettingId::MotorType, KEY_MTR_TYPE, "Motor Type", nullptr, kMotorTypeOptions, sizeof(kMotorTypeOptions) / sizeof(kMotorTypeOptions[0])},
};

void cycleInList(uint8_t& v, const uint8_t* list, size_t n) {
  for (size_t i = 0; i < n; ++i) {
    if (list[i] == v) {
      v = list[(i + 1U) % n];
      return;
    }
  }
  v = list[0];
}

}  // namespace

const SettingSchemaEntry* settingsSchemaById(DevSettingId id) {
  const size_t idx = static_cast<size_t>(id);
  if (idx >= sizeof(kEntries) / sizeof(kEntries[0])) {
    return nullptr;
  }
  return &kEntries[idx];
}

const SettingSchemaEntry* settingsSchemaByKey(const char* key) {
  if (!key || key[0] == '\0') {
    return nullptr;
  }
  for (size_t i = 0; i < sizeof(kEntries) / sizeof(kEntries[0]); ++i) {
    if (strcmp(key, kEntries[i].key) == 0) {
      return &kEntries[i];
    }
  }
  return nullptr;
}

size_t settingsSchemaEntryCount() {
  return sizeof(kEntries) / sizeof(kEntries[0]);
}

const SettingSchemaEntry* settingsSchemaEntryAt(size_t idx) {
  if (idx >= settingsSchemaEntryCount()) {
    return nullptr;
  }
  return &kEntries[idx];
}

uint8_t settingsDefaultValue(DevSettingId id) {
  static const RuntimeSettings d{};
  switch (id) {
    case DevSettingId::AutoOff:
      return d.autoOffMinutes;
    case DevSettingId::TempLimit:
      return d.tempLimitC;
    case DevSettingId::SpeedStep:
      return d.speedStepPercent;
    case DevSettingId::MinDuty:
      return d.minDutyPercent;
    case DevSettingId::MaxDuty:
      return d.maxDutyPercent;
    case DevSettingId::BatteryCells:
      return d.batterySeriesCells;
    case DevSettingId::SleepTimer:
      return d.sleepTimerMinutes;
    case DevSettingId::TriggerMode:
      return static_cast<uint8_t>(d.triggerMode);
    case DevSettingId::MotorDisplayMode:
      return static_cast<uint8_t>(d.motorDisplayMode);
    case DevSettingId::LedIdle:
      return static_cast<uint8_t>(d.ledIdleDisplayMode);
    case DevSettingId::LedDisplay:
      return static_cast<uint8_t>(d.ledDisplayMode);
    case DevSettingId::LedDim:
      return d.ledDimPercent;
    case DevSettingId::DisplayContrast:
      return d.displayContrastPercent;
    case DevSettingId::LedTheme:
      return static_cast<uint8_t>(d.ledTheme);
    case DevSettingId::MotorType:
      return static_cast<uint8_t>(d.motorType);
    default:
      return 0;
  }
}

void settingsFormatValue(DevSettingId id, const RuntimeSettings& rs, char* out, size_t n) {
  switch (id) {
    case DevSettingId::AutoOff:
      snprintf(out, n, rs.autoOffMinutes == 0 ? "OFF" : "%um", static_cast<unsigned>(rs.autoOffMinutes));
      break;
    case DevSettingId::TempLimit:
      snprintf(out, n, rs.tempLimitC == 0 ? "OFF" : "%uC", static_cast<unsigned>(rs.tempLimitC));
      break;
    case DevSettingId::SpeedStep:
      snprintf(out, n, "%u%%", static_cast<unsigned>(rs.speedStepPercent));
      break;
    case DevSettingId::MinDuty:
      snprintf(out, n, "%u%%", static_cast<unsigned>(rs.minDutyPercent));
      break;
    case DevSettingId::MaxDuty:
      snprintf(out, n, "%u%%", static_cast<unsigned>(rs.maxDutyPercent));
      break;
    case DevSettingId::BatteryCells:
      snprintf(out, n, "%uS", static_cast<unsigned>(rs.batterySeriesCells));
      break;
    case DevSettingId::SleepTimer:
      snprintf(out, n, "%um", static_cast<unsigned>(rs.sleepTimerMinutes));
      break;
    case DevSettingId::TriggerMode:
      snprintf(out, n, "%u", static_cast<unsigned>(rs.triggerMode) + 1U);
      break;
    case DevSettingId::MotorDisplayMode:
      snprintf(out, n, "%u", static_cast<unsigned>(rs.motorDisplayMode) + 1U);
      break;
    case DevSettingId::LedIdle:
      snprintf(out, n, "%u", static_cast<unsigned>(rs.ledIdleDisplayMode) + 1U);
      break;
    case DevSettingId::LedDisplay:
      snprintf(out, n, "%u", static_cast<unsigned>(rs.ledDisplayMode) + 1U);
      break;
    case DevSettingId::LedDim:
      snprintf(out, n, "%u%%", static_cast<unsigned>(rs.ledDimPercent));
      break;
    case DevSettingId::DisplayContrast:
      snprintf(out, n, "%u%%", static_cast<unsigned>(rs.displayContrastPercent));
      break;
    case DevSettingId::LedTheme:
      snprintf(out, n, "%u", static_cast<unsigned>(rs.ledTheme));
      break;
    case DevSettingId::MotorType:
      snprintf(out, n, "%u", static_cast<unsigned>(rs.motorType) + 1U);
      break;
    default:
      snprintf(out, n, "-");
      break;
  }
}

void settingsFormatSubline(DevSettingId id, const RuntimeSettings& rs, char* out, size_t n) {
  switch (id) {
    case DevSettingId::BatteryCells:
      snprintf(out, n, "Max V: %.1fV", static_cast<double>(static_cast<float>(rs.batterySeriesCells) * 4.2f));
      break;
    case DevSettingId::TriggerMode:
      snprintf(out, n, "%s", rs.triggerMode == TriggerMode::Hold ? "Hold" : "Double-Press");
      break;
    case DevSettingId::MotorDisplayMode:
      snprintf(out, n, "Show: %s", kMotorDispOptions[static_cast<uint8_t>(rs.motorDisplayMode)].label);
      break;
    case DevSettingId::LedIdle:
      snprintf(out, n, "%s", kLedIdleOptions[static_cast<uint8_t>(rs.ledIdleDisplayMode)].label);
      break;
    case DevSettingId::LedDisplay:
      snprintf(out, n, "%s", kLedDispOptions[static_cast<uint8_t>(rs.ledDisplayMode)].label);
      break;
    case DevSettingId::LedTheme:
      snprintf(out, n, "%s", kThemeOptions[static_cast<uint8_t>(rs.ledTheme)].label);
      break;
    case DevSettingId::MotorType:
      snprintf(out, n, "%s", motorTypeDisplayName(rs.motorType));
      break;
    default:
      out[0] = '\0';
      break;
  }
}

void settingsCycleGlobalValue(RuntimeSettings& rs, DevSettingId id) {
  switch (id) {
    case DevSettingId::AutoOff:
      cycleInList(rs.autoOffMinutes, kAutoOffValues, sizeof(kAutoOffValues));
      break;
    case DevSettingId::TempLimit:
      cycleInList(rs.tempLimitC, kTempValues, sizeof(kTempValues));
      break;
    case DevSettingId::SpeedStep:
      cycleInList(rs.speedStepPercent, kSpeedStepValues, sizeof(kSpeedStepValues));
      break;
    case DevSettingId::MinDuty:
      cycleInList(rs.minDutyPercent, kMinDutyValues, sizeof(kMinDutyValues));
      rs.maxDutyPercent = clampMaxDutyPercent(rs.maxDutyPercent, rs.minDutyPercent);
      break;
    case DevSettingId::MaxDuty: {
      uint8_t v = clampMaxDutyPercent(rs.maxDutyPercent, rs.minDutyPercent);
      if (v < 100) {
        ++v;
      } else {
        v = maxDutyPercentLowerBound(rs.minDutyPercent);
      }
      rs.maxDutyPercent = v;
      break;
    }
    case DevSettingId::BatteryCells:
      cycleInList(rs.batterySeriesCells, kBatteryCellsValues, sizeof(kBatteryCellsValues));
      initBatterySOC(rs.batterySeriesCells);
      break;
    case DevSettingId::SleepTimer:
      cycleInList(rs.sleepTimerMinutes, kSleepValues, sizeof(kSleepValues));
      break;
    case DevSettingId::TriggerMode:
      rs.triggerMode = rs.triggerMode == TriggerMode::Hold ? TriggerMode::DoublePress : TriggerMode::Hold;
      break;
    case DevSettingId::MotorDisplayMode:
      rs.motorDisplayMode = static_cast<MotorDisplayMode>((static_cast<uint8_t>(rs.motorDisplayMode) + 1U) % 4U);
      break;
    case DevSettingId::LedIdle:
      rs.ledIdleDisplayMode = static_cast<LedIdleDisplayMode>((static_cast<uint8_t>(rs.ledIdleDisplayMode) + 1U) % 3U);
      break;
    case DevSettingId::LedDisplay:
      rs.ledDisplayMode = static_cast<LedDisplayMode>((static_cast<uint8_t>(rs.ledDisplayMode) + 1U) % 4U);
      break;
    case DevSettingId::LedDim:
      cycleInList(rs.ledDimPercent, kLedDimValues, sizeof(kLedDimValues));
      break;
    case DevSettingId::DisplayContrast:
      cycleInList(rs.displayContrastPercent, kDisplayContrastValues, sizeof(kDisplayContrastValues));
      break;
    case DevSettingId::LedTheme:
      rs.ledTheme = static_cast<LedTheme>((static_cast<uint8_t>(rs.ledTheme) + 1U) % 7U);
      break;
    case DevSettingId::MotorType:
      rs.motorType = rs.motorType == MotorType::GenericPwm ? MotorType::XiaomiG : MotorType::GenericPwm;
      break;
    default:
      break;
  }
}

bool settingsGlobalVisibleForMotorType(DevSettingId id, MotorType type) {
  if (type == MotorType::XiaomiG) {
    return id != DevSettingId::SpeedStep && id != DevSettingId::MinDuty && id != DevSettingId::MaxDuty;
  }
  return true;
}

void settingsGetAllowedRange(DevSettingId id, const RuntimeSettings& rs, uint8_t* outMin, uint8_t* outMax, bool* outHasRange) {
  if (!outMin || !outMax || !outHasRange) {
    return;
  }
  if (id == DevSettingId::MaxDuty) {
    *outHasRange = true;
    *outMin = maxDutyPercentLowerBound(rs.minDutyPercent);
    *outMax = 100;
    return;
  }
  *outHasRange = false;
  *outMin = 0;
  *outMax = 0;
}

const uint8_t* settingsGetAllowedValues(DevSettingId id, size_t* outCount) {
  if (outCount) {
    *outCount = 0;
  }
  switch (id) {
    case DevSettingId::AutoOff:
      if (outCount) *outCount = sizeof(kAutoOffValues);
      return kAutoOffValues;
    case DevSettingId::TempLimit:
      if (outCount) *outCount = sizeof(kTempValues);
      return kTempValues;
    case DevSettingId::SpeedStep:
      if (outCount) *outCount = sizeof(kSpeedStepValues);
      return kSpeedStepValues;
    case DevSettingId::MinDuty:
      if (outCount) *outCount = sizeof(kMinDutyValues);
      return kMinDutyValues;
    case DevSettingId::BatteryCells:
      if (outCount) *outCount = sizeof(kBatteryCellsValues);
      return kBatteryCellsValues;
    case DevSettingId::SleepTimer:
      if (outCount) *outCount = sizeof(kSleepValues);
      return kSleepValues;
    case DevSettingId::LedDim:
      if (outCount) *outCount = sizeof(kLedDimValues);
      return kLedDimValues;
    case DevSettingId::DisplayContrast:
      if (outCount) *outCount = sizeof(kDisplayContrastValues);
      return kDisplayContrastValues;
    default:
      return nullptr;
  }
}
