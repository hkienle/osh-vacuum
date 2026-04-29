#include "settings.h"
#include "settings_config.h"

#include <Preferences.h>
#include <string.h>

namespace {
constexpr char SETTINGS_NAMESPACE[] = "oshvac";
constexpr char KEY_DISPLAY_TYPE[] = "display_type";
constexpr char KEY_BAT_CELLS[] = "bat_cells";
constexpr char KEY_AUTO_OFF[] = "auto_off";
constexpr char KEY_SLEEP_TMR[] = "sleep_tmr";
constexpr char KEY_TEMP_LIM[] = "temp_lim";
constexpr char KEY_SPD_STEP[] = "spd_step";
constexpr char KEY_MIN_DUTY[] = "min_duty";
constexpr char KEY_MAX_DUTY[] = "max_duty";
constexpr char KEY_MTR_DISP[] = "mtr_disp";
constexpr char KEY_TRIG_MODE[] = "trig_mode";
constexpr char KEY_LED_DISP[] = "led_disp";
constexpr char KEY_LED_IDLE[] = "led_idle";
constexpr char KEY_LED_DIM[] = "led_dim";
constexpr char KEY_LED_THEME[] = "led_theme";
constexpr char KEY_MTR_TYPE[] = "mtr_type";
constexpr char DISPLAY_091[] = "0.91-I2C-Waveshare";
constexpr char DISPLAY_15[] = "1.5-I2C-Waveshare";
constexpr char DISPLAY_NONE[] = "none";

static RuntimeSettings s_rt;

uint8_t clampAutoOff(uint8_t v) {
  if (v == 0 || v == 1 || v == 2 || v == 5 || v == 10 || v == 30) {
    return v;
  }
  return SettingsConfig::DEFAULT_AUTO_OFF_MINUTES;
}

uint8_t clampTempLim(uint8_t v) {
  if (v == 0 || (v >= 30 && v <= 70 && (v % 5) == 0)) {
    return v;
  }
  return SettingsConfig::DEFAULT_TEMP_LIMIT_C;
}

uint8_t clampSleepTimer(uint8_t v) {
  if (v == 1 || v == 2 || v == 5 || v == 10 || v == 30) {
    return v;
  }
  return SettingsConfig::DEFAULT_SLEEP_TIMER_MINUTES;
}

uint8_t clampSpeedStep(uint8_t v) {
  if (v == 1 || v == 5 || v == 10 || v == 20 || v == 25) {
    return v;
  }
  return SettingsConfig::DEFAULT_SPEED_STEP_PERCENT;
}

uint8_t clampMinDuty(uint8_t v) {
  if (v == 0 || (v >= 1 && v <= 30)) {
    return v;
  }
  return SettingsConfig::DEFAULT_MIN_DUTY_PERCENT;
}

MotorDisplayMode clampMotorDisp(uint8_t v) {
  if (v <= static_cast<uint8_t>(MotorDisplayMode::MotorTemp)) {
    return static_cast<MotorDisplayMode>(v);
  }
  return static_cast<MotorDisplayMode>(SettingsConfig::DEFAULT_MOTOR_DISPLAY_MODE);
}

TriggerMode clampTriggerMode(uint8_t v) {
  if (v <= static_cast<uint8_t>(TriggerMode::DoublePress)) {
    return static_cast<TriggerMode>(v);
  }
  return static_cast<TriggerMode>(SettingsConfig::DEFAULT_TRIGGER_MODE);
}

LedDisplayMode clampLedDisp(uint8_t v) {
  if (v <= static_cast<uint8_t>(LedDisplayMode::Temp)) {
    return static_cast<LedDisplayMode>(v);
  }
  return static_cast<LedDisplayMode>(SettingsConfig::DEFAULT_LED_DISPLAY_MODE);
}

LedIdleDisplayMode clampLedIdle(uint8_t v) {
  if (v <= static_cast<uint8_t>(LedIdleDisplayMode::Rpm)) {
    return static_cast<LedIdleDisplayMode>(v);
  }
  return static_cast<LedIdleDisplayMode>(SettingsConfig::DEFAULT_LED_IDLE_DISPLAY_MODE);
}

uint8_t clampLedDimPercent(uint8_t v) {
  if (v <= 10) {
    return v;
  }
  if (v >= 15 && v <= 50 && (v - 15) % 5 == 0) {
    return v;
  }
  return SettingsConfig::DEFAULT_LED_DIM_PERCENT;
}

LedTheme clampLedTheme(uint8_t v) {
  if (v <= static_cast<uint8_t>(LedTheme::Yellow)) {
    return static_cast<LedTheme>(v);
  }
  return static_cast<LedTheme>(SettingsConfig::DEFAULT_LED_THEME);
}

MotorType clampMotorType(uint8_t v) {
  if (v <= static_cast<uint8_t>(MotorType::XiaomiG)) {
    return static_cast<MotorType>(v);
  }
  return static_cast<MotorType>(SettingsConfig::DEFAULT_MOTOR_TYPE);
}
}  // namespace

uint8_t maxDutyPercentLowerBound(uint8_t minDutyPercent) {
  uint8_t m = minDutyPercent;
  if (!(m == 0 || (m >= 1 && m <= 30))) {
    m = SettingsConfig::DEFAULT_MIN_DUTY_PERCENT;
  }
  uint8_t lo = 50;
  const unsigned need = static_cast<unsigned>(m) + 1U;
  if (need > static_cast<unsigned>(lo)) {
    lo = static_cast<uint8_t>(need > 100U ? 100U : need);
  }
  return lo;
}

uint8_t clampMaxDutyPercent(uint8_t maxDutyPercent, uint8_t minDutyPercent) {
  const uint8_t lo = maxDutyPercentLowerBound(minDutyPercent);
  if (maxDutyPercent < lo) {
    return lo;
  }
  if (maxDutyPercent > 100) {
    return 100;
  }
  return maxDutyPercent;
}

void initSettings() {}

DisplayType parseDisplayType(const char* value) {
  if (value == nullptr || value[0] == '\0') {
    return DisplayType::Waveshare091I2C;
  }

  if (strcmp(value, DISPLAY_091) == 0) {
    return DisplayType::Waveshare091I2C;
  }
  if (strcmp(value, DISPLAY_15) == 0) {
    return DisplayType::Waveshare15I2C;
  }
  if (strcmp(value, DISPLAY_NONE) == 0) {
    return DisplayType::None;
  }

  return DisplayType::Waveshare091I2C;
}

const char* displayTypeToString(DisplayType type) {
  switch (type) {
    case DisplayType::Waveshare091I2C:
      return DISPLAY_091;
    case DisplayType::Waveshare15I2C:
      return DISPLAY_15;
    case DisplayType::None:
    default:
      return DISPLAY_NONE;
  }
}

MotorType parseMotorType(uint8_t v) {
  return clampMotorType(v);
}

const char* motorTypeToString(MotorType type) {
  switch (type) {
    case MotorType::XiaomiG:
      return "xiaomi-g";
    case MotorType::GenericPwm:
    default:
      return "generic-pwm";
  }
}

const char* motorTypeDisplayName(MotorType type) {
  switch (type) {
    case MotorType::XiaomiG:
      return "Xiaomi G";
    case MotorType::GenericPwm:
    default:
      return "Generic (PWM)";
  }
}

RuntimeSettings& loadRuntimeSettings() {
  s_rt.displayType = parseDisplayType(SettingsConfig::DEFAULT_DISPLAY_TYPE);
  s_rt.batterySeriesCells = SettingsConfig::DEFAULT_BATTERY_SERIES_CELLS;
  s_rt.autoOffMinutes = SettingsConfig::DEFAULT_AUTO_OFF_MINUTES;
  s_rt.sleepTimerMinutes = SettingsConfig::DEFAULT_SLEEP_TIMER_MINUTES;
  s_rt.tempLimitC = SettingsConfig::DEFAULT_TEMP_LIMIT_C;
  s_rt.speedStepPercent = SettingsConfig::DEFAULT_SPEED_STEP_PERCENT;
  s_rt.minDutyPercent = SettingsConfig::DEFAULT_MIN_DUTY_PERCENT;
  s_rt.maxDutyPercent = SettingsConfig::DEFAULT_MAX_DUTY_PERCENT;
  s_rt.motorDisplayMode = clampMotorDisp(SettingsConfig::DEFAULT_MOTOR_DISPLAY_MODE);
  s_rt.triggerMode = clampTriggerMode(SettingsConfig::DEFAULT_TRIGGER_MODE);
  s_rt.ledIdleDisplayMode = clampLedIdle(SettingsConfig::DEFAULT_LED_IDLE_DISPLAY_MODE);
  s_rt.ledDisplayMode = clampLedDisp(SettingsConfig::DEFAULT_LED_DISPLAY_MODE);
  s_rt.ledDimPercent = clampLedDimPercent(SettingsConfig::DEFAULT_LED_DIM_PERCENT);
  s_rt.ledTheme = clampLedTheme(SettingsConfig::DEFAULT_LED_THEME);
  s_rt.motorType = clampMotorType(SettingsConfig::DEFAULT_MOTOR_TYPE);

  Preferences prefs;
  if (!prefs.begin(SETTINGS_NAMESPACE, true)) {
    return s_rt;
  }

  char displayTypeBuffer[32];
  displayTypeBuffer[0] = '\0';
  prefs.getString(KEY_DISPLAY_TYPE, displayTypeBuffer, sizeof(displayTypeBuffer));
  if (displayTypeBuffer[0] != '\0') {
    s_rt.displayType = parseDisplayType(displayTypeBuffer);
  }

  const uint8_t cells = prefs.getUChar(KEY_BAT_CELLS, s_rt.batterySeriesCells);
  if (cells >= 1 && cells <= 32) {
    s_rt.batterySeriesCells = cells;
  }

  s_rt.autoOffMinutes = clampAutoOff(prefs.getUChar(KEY_AUTO_OFF, s_rt.autoOffMinutes));
  s_rt.sleepTimerMinutes = clampSleepTimer(prefs.getUChar(KEY_SLEEP_TMR, s_rt.sleepTimerMinutes));
  s_rt.tempLimitC = clampTempLim(prefs.getUChar(KEY_TEMP_LIM, s_rt.tempLimitC));
  s_rt.speedStepPercent = clampSpeedStep(prefs.getUChar(KEY_SPD_STEP, s_rt.speedStepPercent));
  s_rt.minDutyPercent = clampMinDuty(prefs.getUChar(KEY_MIN_DUTY, s_rt.minDutyPercent));
  s_rt.maxDutyPercent = clampMaxDutyPercent(prefs.getUChar(KEY_MAX_DUTY, s_rt.maxDutyPercent), s_rt.minDutyPercent);
  s_rt.motorDisplayMode = clampMotorDisp(prefs.getUChar(KEY_MTR_DISP, static_cast<uint8_t>(s_rt.motorDisplayMode)));
  s_rt.triggerMode = clampTriggerMode(prefs.getUChar(KEY_TRIG_MODE, static_cast<uint8_t>(s_rt.triggerMode)));
  s_rt.ledIdleDisplayMode = clampLedIdle(prefs.getUChar(KEY_LED_IDLE, static_cast<uint8_t>(s_rt.ledIdleDisplayMode)));
  s_rt.ledDisplayMode = clampLedDisp(prefs.getUChar(KEY_LED_DISP, static_cast<uint8_t>(s_rt.ledDisplayMode)));
  s_rt.ledDimPercent = clampLedDimPercent(prefs.getUChar(KEY_LED_DIM, s_rt.ledDimPercent));
  s_rt.ledTheme = clampLedTheme(prefs.getUChar(KEY_LED_THEME, static_cast<uint8_t>(s_rt.ledTheme)));
  s_rt.motorType = clampMotorType(prefs.getUChar(KEY_MTR_TYPE, static_cast<uint8_t>(s_rt.motorType)));

  prefs.end();
  return s_rt;
}

RuntimeSettings& getRuntimeSettings() {
  return s_rt;
}

bool saveRuntimeSettings(const RuntimeSettings& settings) {
  Preferences prefs;
  if (!prefs.begin(SETTINGS_NAMESPACE, false)) {
    return false;
  }

  const bool okDisplay = prefs.putString(KEY_DISPLAY_TYPE, displayTypeToString(settings.displayType)) > 0;
  const uint8_t cells = settings.batterySeriesCells < 1 ? 1 : (settings.batterySeriesCells > 32 ? 32 : settings.batterySeriesCells);
  const bool okCells = prefs.putUChar(KEY_BAT_CELLS, cells) > 0;
  const bool okAuto = prefs.putUChar(KEY_AUTO_OFF, clampAutoOff(settings.autoOffMinutes)) > 0;
  const bool okSleep = prefs.putUChar(KEY_SLEEP_TMR, clampSleepTimer(settings.sleepTimerMinutes)) > 0;
  const bool okTemp = prefs.putUChar(KEY_TEMP_LIM, clampTempLim(settings.tempLimitC)) > 0;
  const bool okStep = prefs.putUChar(KEY_SPD_STEP, clampSpeedStep(settings.speedStepPercent)) > 0;
  const uint8_t minClamped = clampMinDuty(settings.minDutyPercent);
  const bool okMin = prefs.putUChar(KEY_MIN_DUTY, minClamped) > 0;
  const uint8_t maxClamped = clampMaxDutyPercent(settings.maxDutyPercent, minClamped);
  const bool okMaxDuty = prefs.putUChar(KEY_MAX_DUTY, maxClamped) > 0;
  const uint8_t md = static_cast<uint8_t>(clampMotorDisp(static_cast<uint8_t>(settings.motorDisplayMode)));
  const bool okDisp = prefs.putUChar(KEY_MTR_DISP, md) > 0;
  const uint8_t tm = static_cast<uint8_t>(clampTriggerMode(static_cast<uint8_t>(settings.triggerMode)));
  const bool okTrigMode = prefs.putUChar(KEY_TRIG_MODE, tm) > 0;
  const uint8_t li = static_cast<uint8_t>(clampLedIdle(static_cast<uint8_t>(settings.ledIdleDisplayMode)));
  const bool okLedIdle = prefs.putUChar(KEY_LED_IDLE, li) > 0;
  const uint8_t ld = static_cast<uint8_t>(clampLedDisp(static_cast<uint8_t>(settings.ledDisplayMode)));
  const bool okLedDisp = prefs.putUChar(KEY_LED_DISP, ld) > 0;
  const uint8_t dim = clampLedDimPercent(settings.ledDimPercent);
  const bool okLedDim = prefs.putUChar(KEY_LED_DIM, dim) > 0;
  const uint8_t th = static_cast<uint8_t>(clampLedTheme(static_cast<uint8_t>(settings.ledTheme)));
  const bool okLedTheme = prefs.putUChar(KEY_LED_THEME, th) > 0;
  const uint8_t mt = static_cast<uint8_t>(clampMotorType(static_cast<uint8_t>(settings.motorType)));
  const bool okMotorType = prefs.putUChar(KEY_MTR_TYPE, mt) > 0;
  prefs.end();
  return okDisplay && okCells && okAuto && okSleep && okTemp && okStep && okMin && okMaxDuty && okDisp && okTrigMode &&
         okLedIdle && okLedDisp && okLedDim && okLedTheme && okMotorType;
}
