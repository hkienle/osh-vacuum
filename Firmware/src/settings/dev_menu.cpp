#include "dev_menu.h"

#include "settings.h"

#include <Arduino.h>
#include <stdio.h>
#include <string.h>

#include "../battery_soc/battery_soc.h"
#include "../motor/motor.h"

namespace {

void cycleUint8InList(uint8_t& v, const uint8_t* list, size_t n) {
  for (size_t i = 0; i < n; ++i) {
    if (list[i] == v) {
      v = list[(i + 1U) % n];
      return;
    }
  }
  v = list[0];
}

void cycleMaxDutyPercentValue(uint8_t minDuty, uint8_t& maxDuty) {
  const uint8_t lo = maxDutyPercentLowerBound(minDuty);
  uint8_t v = clampMaxDutyPercent(maxDuty, minDuty);
  if (v < 100) {
    ++v;
  } else {
    v = lo;
  }
  maxDuty = v;
}

bool saveRsLog() {
  RuntimeSettings& rs = getRuntimeSettings();
  if (saveRuntimeSettings(rs)) {
    Serial.println("[DevMenu] Settings saved");
    return true;
  }
  Serial.println("[DevMenu] Save failed");
  return false;
}

void formatAutoOffVal(char* out, size_t n) {
  const uint8_t m = getRuntimeSettings().autoOffMinutes;
  if (m == 0) {
    snprintf(out, n, "OFF");
  } else {
    snprintf(out, n, "%um", static_cast<unsigned>(m));
  }
}

void formatTempLimVal(char* out, size_t n) {
  const uint8_t t = getRuntimeSettings().tempLimitC;
  if (t == 0) {
    snprintf(out, n, "OFF");
  } else {
    snprintf(out, n, "%uC", static_cast<unsigned>(t));
  }
}

void formatSpdStepVal(char* out, size_t n) {
  snprintf(out, n, "%u%%", static_cast<unsigned>(getRuntimeSettings().speedStepPercent));
}

void formatMinDutyVal(char* out, size_t n) {
  snprintf(out, n, "%u%%", static_cast<unsigned>(getRuntimeSettings().minDutyPercent));
}

void formatMaxDutyVal(char* out, size_t n) {
  snprintf(out, n, "%u%%", static_cast<unsigned>(getRuntimeSettings().maxDutyPercent));
}

void formatBatteryCellsVal(char* out, size_t n) {
  snprintf(out, n, "%uS", static_cast<unsigned>(getRuntimeSettings().batterySeriesCells));
}

void formatBatteryCellsSub(char* out, size_t n) {
  const uint8_t seriesCells = getRuntimeSettings().batterySeriesCells;
  const float packMax = static_cast<float>(seriesCells) * 4.2f;
  snprintf(out, n, "Max V: %.1fV", static_cast<double>(packMax));
}

void formatSleepTmrVal(char* out, size_t n) {
  snprintf(out, n, "%um", static_cast<unsigned>(getRuntimeSettings().sleepTimerMinutes));
}

void formatTrigModeVal(char* out, size_t n) {
  snprintf(out, n, "%u", static_cast<unsigned>(getRuntimeSettings().triggerMode) + 1U);
}

void formatTrigModeSub(char* out, size_t n) {
  snprintf(out, n, "%s", getRuntimeSettings().triggerMode == TriggerMode::Hold ? "Hold" : "Double-Press");
}

void formatMotorDispVal(char* out, size_t n) {
  snprintf(out, n, "%u", static_cast<unsigned>(getRuntimeSettings().motorDisplayMode) + 1U);
}

void formatMotorDispSub(char* out, size_t n) {
  const char* modeName = "RPM";
  switch (getRuntimeSettings().motorDisplayMode) {
    case MotorDisplayMode::Speed:
      modeName = "Speed";
      break;
    case MotorDisplayMode::Voltage:
      modeName = "Voltage";
      break;
    case MotorDisplayMode::Rpm:
      modeName = "RPM";
      break;
    case MotorDisplayMode::MotorTemp:
    default:
      modeName = "MOT Temp";
      break;
  }
  snprintf(out, n, "Show: %s", modeName);
}

void formatLedIdleVal(char* out, size_t n) {
  snprintf(out, n, "%u", static_cast<unsigned>(getRuntimeSettings().ledIdleDisplayMode) + 1U);
}

void formatLedIdleSub(char* out, size_t n) {
  const char* idleName = "SOC";
  switch (getRuntimeSettings().ledIdleDisplayMode) {
    case LedIdleDisplayMode::Speed:
      idleName = "Speed";
      break;
    case LedIdleDisplayMode::Rpm:
      idleName = "RPM";
      break;
    case LedIdleDisplayMode::Soc:
    default:
      idleName = "SOC";
      break;
  }
  snprintf(out, n, "%s", idleName);
}

void formatLedMotorVal(char* out, size_t n) {
  snprintf(out, n, "%u", static_cast<unsigned>(getRuntimeSettings().ledDisplayMode) + 1U);
}

void formatLedMotorSub(char* out, size_t n) {
  const char* ledName = "SOC";
  switch (getRuntimeSettings().ledDisplayMode) {
    case LedDisplayMode::Soc:
      ledName = "SOC";
      break;
    case LedDisplayMode::Rpm:
      ledName = "RPM";
      break;
    case LedDisplayMode::Speed:
      ledName = "Speed";
      break;
    case LedDisplayMode::Temp:
    default:
      ledName = "Temp";
      break;
  }
  snprintf(out, n, "%s", ledName);
}

void formatLedDimVal(char* out, size_t n) {
  snprintf(out, n, "%u%%", static_cast<unsigned>(getRuntimeSettings().ledDimPercent));
}

void formatLedThemeVal(char* out, size_t n) {
  snprintf(out, n, "%u", static_cast<unsigned>(getRuntimeSettings().ledTheme));
}

void formatLedThemeSub(char* out, size_t n) {
  const char* themeName = "Off";
  switch (getRuntimeSettings().ledTheme) {
    case LedTheme::White:
      themeName = "White";
      break;
    case LedTheme::Blue:
      themeName = "Blue";
      break;
    case LedTheme::Green:
      themeName = "Green";
      break;
    case LedTheme::Pink:
      themeName = "Pink";
      break;
    case LedTheme::Orange:
      themeName = "Orange";
      break;
    case LedTheme::Yellow:
      themeName = "Yellow";
      break;
    case LedTheme::Off:
    default:
      themeName = "Off";
      break;
  }
  snprintf(out, n, "%s", themeName);
}

void formatMotorTypeVal(char* out, size_t n) {
  const auto t = static_cast<unsigned>(getRuntimeSettings().motorType);
  snprintf(out, n, "%u", t + 1U);
}

void formatMotorTypeSub(char* out, size_t n) {
  snprintf(out, n, "%s", motorTypeDisplayName(getRuntimeSettings().motorType));
}

// --- cycle + save ---

void cycleAutoOff() {
  static constexpr uint8_t k[] = {0, 1, 2, 5, 10, 30};
  RuntimeSettings& rs = getRuntimeSettings();
  cycleUint8InList(rs.autoOffMinutes, k, sizeof(k));
  saveRsLog();
}

void cycleTempLim() {
  static constexpr uint8_t k[] = {0, 30, 35, 40, 45, 50, 55, 60, 65, 70};
  RuntimeSettings& rs = getRuntimeSettings();
  cycleUint8InList(rs.tempLimitC, k, sizeof(k));
  saveRsLog();
}

void cycleSpeedStep() {
  static constexpr uint8_t k[] = {1, 5, 10, 20, 25};
  RuntimeSettings& rs = getRuntimeSettings();
  cycleUint8InList(rs.speedStepPercent, k, sizeof(k));
  saveRsLog();
}

void cycleMinDuty() {
  static constexpr uint8_t k[] = {
      1,  2,  3,  4,  5,  6,  7,  8,  9,  10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
      21, 22, 23, 24, 25, 26, 27, 28, 29, 30};
  RuntimeSettings& rs = getRuntimeSettings();
  cycleUint8InList(rs.minDutyPercent, k, sizeof(k));
  rs.maxDutyPercent = clampMaxDutyPercent(rs.maxDutyPercent, rs.minDutyPercent);
  saveRsLog();
}

void cycleMaxDuty() {
  RuntimeSettings& rs = getRuntimeSettings();
  cycleMaxDutyPercentValue(rs.minDutyPercent, rs.maxDutyPercent);
  saveRsLog();
}

void cycleBatteryCells() {
  RuntimeSettings& rs = getRuntimeSettings();
  uint8_t c = rs.batterySeriesCells;
  if (c < 1 || c > 14) {
    c = 1;
  } else if (c >= 14) {
    c = 1;
  } else {
    ++c;
  }
  rs.batterySeriesCells = c;
  initBatterySOC(rs.batterySeriesCells);
  saveRsLog();
}

void cycleSleepTimer() {
  static constexpr uint8_t k[] = {1, 2, 5, 10, 30};
  RuntimeSettings& rs = getRuntimeSettings();
  cycleUint8InList(rs.sleepTimerMinutes, k, sizeof(k));
  saveRsLog();
}

void cycleTriggerMode() {
  RuntimeSettings& rs = getRuntimeSettings();
  uint8_t t = static_cast<uint8_t>(rs.triggerMode);
  t = static_cast<uint8_t>((t + 1U) % 2U);
  rs.triggerMode = static_cast<TriggerMode>(t);
  saveRsLog();
}

void cycleMotorDisp() {
  RuntimeSettings& rs = getRuntimeSettings();
  uint8_t m = static_cast<uint8_t>(rs.motorDisplayMode);
  m = static_cast<uint8_t>((m + 1U) % 4U);
  rs.motorDisplayMode = static_cast<MotorDisplayMode>(m);
  saveRsLog();
}

void cycleLedIdle() {
  RuntimeSettings& rs = getRuntimeSettings();
  uint8_t l = static_cast<uint8_t>(rs.ledIdleDisplayMode);
  l = static_cast<uint8_t>((l + 1U) % 3U);
  rs.ledIdleDisplayMode = static_cast<LedIdleDisplayMode>(l);
  saveRsLog();
}

void cycleLedDisp() {
  RuntimeSettings& rs = getRuntimeSettings();
  uint8_t l = static_cast<uint8_t>(rs.ledDisplayMode);
  l = static_cast<uint8_t>((l + 1U) % 4U);
  rs.ledDisplayMode = static_cast<LedDisplayMode>(l);
  saveRsLog();
}

void cycleLedDim() {
  static constexpr uint8_t k[] = {0,  1,  2,  3,  4,  5,  6,  7,  8,  9,  10,
                                  15, 20, 25, 30, 35, 40, 45, 50};
  RuntimeSettings& rs = getRuntimeSettings();
  cycleUint8InList(rs.ledDimPercent, k, sizeof(k));
  saveRsLog();
}

void cycleLedTheme() {
  RuntimeSettings& rs = getRuntimeSettings();
  uint8_t t = static_cast<uint8_t>(rs.ledTheme);
  t = static_cast<uint8_t>((static_cast<unsigned>(t) + 1U) % 7U);
  rs.ledTheme = static_cast<LedTheme>(t);
  saveRsLog();
}

void cycleMotorType() {
  RuntimeSettings& rs = getRuntimeSettings();
  uint8_t t = static_cast<uint8_t>(rs.motorType);
  t = static_cast<uint8_t>((t + 1U) % 2U);
  rs.motorType = static_cast<MotorType>(t);
  saveRsLog();
}

static DevSettingDescriptor kGlobalDescriptors[] = {
    {true,
     DevSettingId::AutoOff,
     nullptr,
     "Auto-Off",
     formatAutoOffVal,
     "Motor Shutdown",
     nullptr,
     cycleAutoOff},
    {true,
     DevSettingId::TempLimit,
     nullptr,
     "Temp. Shutdown",
     formatTempLimVal,
     "Motor NTC",
     nullptr,
     cycleTempLim},
    {true,
     DevSettingId::SpeedStep,
     nullptr,
     "Speed Steps",
     formatSpdStepVal,
     "Increase by ...",
     nullptr,
     cycleSpeedStep},
    {true,
     DevSettingId::MinDuty,
     nullptr,
     "Minimum Duty",
     formatMinDutyVal,
     "Motor PWM Floor",
     nullptr,
     cycleMinDuty},
    {true,
     DevSettingId::MaxDuty,
     nullptr,
     "Maximum Duty",
     formatMaxDutyVal,
     "@ speed 100%",
     nullptr,
     cycleMaxDuty},
    {true,
     DevSettingId::BatteryCells,
     nullptr,
     "Battery Cells",
     formatBatteryCellsVal,
     nullptr,
     formatBatteryCellsSub,
     cycleBatteryCells},
    {true,
     DevSettingId::SleepTimer,
     nullptr,
     "Sleep Timer",
     formatSleepTmrVal,
     "UI + Controller",
     nullptr,
     cycleSleepTimer},
    {true,
     DevSettingId::TriggerMode,
     nullptr,
     "Trigger Mode",
     formatTrigModeVal,
     nullptr,
     formatTrigModeSub,
     cycleTriggerMode},
    {true,
     DevSettingId::MotorDisplayMode,
     nullptr,
     "Live-Display",
     formatMotorDispVal,
     nullptr,
     formatMotorDispSub,
     cycleMotorDisp},
    {true,
     DevSettingId::LedIdle,
     nullptr,
     "LED (Idle)",
     formatLedIdleVal,
     nullptr,
     formatLedIdleSub,
     cycleLedIdle},
    {true,
     DevSettingId::LedDisplay,
     nullptr,
     "LED (Motor On)",
     formatLedMotorVal,
     nullptr,
     formatLedMotorSub,
     cycleLedDisp},
    {true,
     DevSettingId::LedDim,
     nullptr,
     "Off-Led",
     formatLedDimVal,
     "Brightness",
     nullptr,
     cycleLedDim},
    {true,
     DevSettingId::LedTheme,
     nullptr,
     "LED Theme",
     formatLedThemeVal,
     nullptr,
     formatLedThemeSub,
     cycleLedTheme},
    {true,
     DevSettingId::MotorType,
     nullptr,
     "Motor Type",
     formatMotorTypeVal,
     nullptr,
     formatMotorTypeSub,
     cycleMotorType},
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

