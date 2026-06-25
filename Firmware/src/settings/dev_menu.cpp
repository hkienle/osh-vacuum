#include "dev_menu.h"

#include "settings.h"
#include "settings_schema.h"

#include <Arduino.h>
#include <stdio.h>
#include <string.h>

#include "../battery_soc/battery_soc.h"
#include "../motor/motor.h"

namespace {

bool saveRsLog() {
  RuntimeSettings& rs = getRuntimeSettings();
  if (saveRuntimeSettings(rs)) {
    Serial.println("[DevMenu] Settings saved");
    return true;
  }
  Serial.println("[DevMenu] Save failed");
  return false;
}

void formatAutoOffVal(char* out, size_t n) { settingsFormatValue(DevSettingId::AutoOff, getRuntimeSettings(), out, n); }
void formatTempLimVal(char* out, size_t n) { settingsFormatValue(DevSettingId::TempLimit, getRuntimeSettings(), out, n); }
void formatSpdStepVal(char* out, size_t n) { settingsFormatValue(DevSettingId::SpeedStep, getRuntimeSettings(), out, n); }
void formatMinDutyVal(char* out, size_t n) { settingsFormatValue(DevSettingId::MinDuty, getRuntimeSettings(), out, n); }
void formatMaxDutyVal(char* out, size_t n) { settingsFormatValue(DevSettingId::MaxDuty, getRuntimeSettings(), out, n); }
void formatBatteryCellsVal(char* out, size_t n) { settingsFormatValue(DevSettingId::BatteryCells, getRuntimeSettings(), out, n); }
void formatSleepTmrVal(char* out, size_t n) { settingsFormatValue(DevSettingId::SleepTimer, getRuntimeSettings(), out, n); }
void formatTrigModeVal(char* out, size_t n) { settingsFormatValue(DevSettingId::TriggerMode, getRuntimeSettings(), out, n); }
void formatMotorDispVal(char* out, size_t n) { settingsFormatValue(DevSettingId::MotorDisplayMode, getRuntimeSettings(), out, n); }
void formatLedIdleVal(char* out, size_t n) { settingsFormatValue(DevSettingId::LedIdle, getRuntimeSettings(), out, n); }
void formatLedMotorVal(char* out, size_t n) { settingsFormatValue(DevSettingId::LedDisplay, getRuntimeSettings(), out, n); }
void formatLedDimVal(char* out, size_t n) { settingsFormatValue(DevSettingId::LedDim, getRuntimeSettings(), out, n); }
void formatLedThemeVal(char* out, size_t n) { settingsFormatValue(DevSettingId::LedTheme, getRuntimeSettings(), out, n); }
void formatDisplayContrastVal(char* out, size_t n) { settingsFormatValue(DevSettingId::DisplayContrast, getRuntimeSettings(), out, n); }
void formatMotorTypeVal(char* out, size_t n) { settingsFormatValue(DevSettingId::MotorType, getRuntimeSettings(), out, n); }
void formatBatteryCellsSub(char* out, size_t n) { settingsFormatSubline(DevSettingId::BatteryCells, getRuntimeSettings(), out, n); }
void formatTrigModeSub(char* out, size_t n) { settingsFormatSubline(DevSettingId::TriggerMode, getRuntimeSettings(), out, n); }
void formatMotorDispSub(char* out, size_t n) { settingsFormatSubline(DevSettingId::MotorDisplayMode, getRuntimeSettings(), out, n); }
void formatLedIdleSub(char* out, size_t n) { settingsFormatSubline(DevSettingId::LedIdle, getRuntimeSettings(), out, n); }
void formatLedMotorSub(char* out, size_t n) { settingsFormatSubline(DevSettingId::LedDisplay, getRuntimeSettings(), out, n); }
void formatLedThemeSub(char* out, size_t n) { settingsFormatSubline(DevSettingId::LedTheme, getRuntimeSettings(), out, n); }
void formatMotorTypeSub(char* out, size_t n) { settingsFormatSubline(DevSettingId::MotorType, getRuntimeSettings(), out, n); }

void cycleAndSave(DevSettingId id) {
  RuntimeSettings& rs = getRuntimeSettings();
  settingsCycleGlobalValue(rs, id);
  saveRsLog();
}

void cycleAutoOff() { cycleAndSave(DevSettingId::AutoOff); }
void cycleTempLim() { cycleAndSave(DevSettingId::TempLimit); }
void cycleSpeedStep() { cycleAndSave(DevSettingId::SpeedStep); }
void cycleMinDuty() { cycleAndSave(DevSettingId::MinDuty); }
void cycleMaxDuty() { cycleAndSave(DevSettingId::MaxDuty); }
void cycleBatteryCells() { cycleAndSave(DevSettingId::BatteryCells); }
void cycleSleepTimer() { cycleAndSave(DevSettingId::SleepTimer); }
void cycleTriggerMode() { cycleAndSave(DevSettingId::TriggerMode); }
void cycleMotorDisp() { cycleAndSave(DevSettingId::MotorDisplayMode); }
void cycleLedIdle() { cycleAndSave(DevSettingId::LedIdle); }
void cycleLedDisp() { cycleAndSave(DevSettingId::LedDisplay); }
void cycleLedDim() { cycleAndSave(DevSettingId::LedDim); }
void cycleLedTheme() { cycleAndSave(DevSettingId::LedTheme); }
void cycleDisplayContrast() { cycleAndSave(DevSettingId::DisplayContrast); }
void cycleMotorType() { cycleAndSave(DevSettingId::MotorType); }

static DevSettingDescriptor kGlobalDescriptors[] = {
    {true, DevSettingId::AutoOff, nullptr, "Auto-Off", formatAutoOffVal, "Motor Shutdown", nullptr, cycleAutoOff},
    {true, DevSettingId::TempLimit, nullptr, "Temp. Shutdown", formatTempLimVal, "Motor NTC", nullptr, cycleTempLim},
    {true, DevSettingId::SpeedStep, nullptr, "Speed Steps", formatSpdStepVal, "Increase by ...", nullptr, cycleSpeedStep},
    {true, DevSettingId::MinDuty, nullptr, "Minimum Duty", formatMinDutyVal, "Motor PWM Floor", nullptr, cycleMinDuty},
    {true, DevSettingId::MaxDuty, nullptr, "Maximum Duty", formatMaxDutyVal, "@ speed 100%", nullptr, cycleMaxDuty},
    {true, DevSettingId::BatteryCells, nullptr, "Battery Cells", formatBatteryCellsVal, nullptr, formatBatteryCellsSub, cycleBatteryCells},
    {true, DevSettingId::SleepTimer, nullptr, "Sleep Timer", formatSleepTmrVal, "UI + Controller", nullptr, cycleSleepTimer},
    {true, DevSettingId::TriggerMode, nullptr, "Trigger Mode", formatTrigModeVal, nullptr, formatTrigModeSub, cycleTriggerMode},
    {true, DevSettingId::MotorDisplayMode, nullptr, "Live-Display", formatMotorDispVal, nullptr, formatMotorDispSub, cycleMotorDisp},
    {true, DevSettingId::LedIdle, nullptr, "LED (Idle)", formatLedIdleVal, nullptr, formatLedIdleSub, cycleLedIdle},
    {true, DevSettingId::LedDisplay, nullptr, "LED (Motor On)", formatLedMotorVal, nullptr, formatLedMotorSub, cycleLedDisp},
    {true, DevSettingId::LedDim, nullptr, "Off-Led", formatLedDimVal, "Brightness", nullptr, cycleLedDim},
    {true, DevSettingId::LedTheme, nullptr, "LED Theme", formatLedThemeVal, nullptr, formatLedThemeSub, cycleLedTheme},
    {true, DevSettingId::DisplayContrast, nullptr, "Display Brightness", formatDisplayContrastVal, "OLED Contrast", nullptr, cycleDisplayContrast},
    {true, DevSettingId::MotorType, nullptr, "Motor Type", formatMotorTypeVal, nullptr, formatMotorTypeSub, cycleMotorType},
};

static_assert(
    sizeof(kGlobalDescriptors) / sizeof(kGlobalDescriptors[0]) == static_cast<size_t>(DevSettingId::GlobalCount),
    "kGlobalDescriptors count must match DevSettingId::GlobalCount");

static const DevSettingDescriptor* s_visible[kDevMenuMaxVisibleSettings];
static size_t s_visibleCount = 0;

}  // namespace

const DevSettingDescriptor* devSettingByGlobalId(DevSettingId id) {
  const size_t u = static_cast<size_t>(id);
  if (u >= static_cast<size_t>(DevSettingId::GlobalCount)) {
    return nullptr;
  }
  return &kGlobalDescriptors[u];
}

void devMenuRebuildVisible() {
  size_t n = 0;
  for (size_t i = 0; i < static_cast<size_t>(DevSettingId::GlobalCount); ++i) {
    const auto id = static_cast<DevSettingId>(i);
    if (!motorDriverSupportsGlobalSetting(id)) {
      continue;
    }
    const DevSettingDescriptor* d = devSettingByGlobalId(id);
    if (d && n < kDevMenuMaxVisibleSettings) {
      s_visible[n++] = d;
    }
  }
  const MotorDriverSettings mds = motorActiveDriverSettings();
  for (uint8_t j = 0; j < mds.count && n < kDevMenuMaxVisibleSettings; ++j) {
    s_visible[n++] = &mds.items[j];
  }
  s_visibleCount = n;
}

size_t devMenuVisibleCount() {
  return s_visibleCount;
}

const DevSettingDescriptor* devMenuVisibleAt(size_t idx) {
  if (idx >= s_visibleCount) {
    return nullptr;
  }
  return s_visible[idx];
}

uint8_t devMenuTotalPageCount() {
  return static_cast<uint8_t>(kDevMenuInfoPageCount + s_visibleCount);
}

