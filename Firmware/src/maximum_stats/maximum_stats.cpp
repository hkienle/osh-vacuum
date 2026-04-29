#include "maximum_stats.h"

#include <Arduino.h>
#include <Preferences.h>
#include <math.h>

namespace {

constexpr char PREFS_NS[] = "oshvac";
constexpr char KEY_FLAGS[] = "mstat_fl";
constexpr char KEY_RPM[] = "mstat_rpm";
constexpr char KEY_VOLT[] = "mstat_vf";
constexpr char KEY_TEMP[] = "mstat_tf";

constexpr uint8_t FL_RPM = 1U;
constexpr uint8_t FL_VOLT = 2U;
constexpr uint8_t FL_TEMP = 4U;

struct PackedStats {
  uint8_t flags;
  uint32_t maxRpm;
  float maxVoltageV;
  float maxMotorTempC;
};

PackedStats g_live{};
PackedStats g_lastNvs{};

bool s_lastMotorActive = false;
bool s_prefsReady = false;

bool nearlySameFloat(float a, float b) {
  return fabsf(a - b) < 0.0005f;
}

bool packedEqual(const PackedStats& a, const PackedStats& b) {
  if (a.flags != b.flags) {
    return false;
  }
  if ((a.flags & FL_RPM) != 0 && a.maxRpm != b.maxRpm) {
    return false;
  }
  if ((a.flags & FL_VOLT) != 0 && !nearlySameFloat(a.maxVoltageV, b.maxVoltageV)) {
    return false;
  }
  if ((a.flags & FL_TEMP) != 0 && !nearlySameFloat(a.maxMotorTempC, b.maxMotorTempC)) {
    return false;
  }
  return true;
}

bool writeStatsToNvs(const PackedStats& s) {
  Preferences prefs;
  if (!prefs.begin(PREFS_NS, false)) {
    return false;
  }
  const bool okFl = prefs.putUChar(KEY_FLAGS, s.flags) > 0;
  const bool okRpm = prefs.putUInt(KEY_RPM, s.maxRpm) > 0;
  const bool okV = prefs.putFloat(KEY_VOLT, s.maxVoltageV) > 0;
  const bool okT = prefs.putFloat(KEY_TEMP, s.maxMotorTempC) > 0;
  prefs.end();
  return okFl && okRpm && okV && okT;
}

void persistIfChanged() {
  if (!s_prefsReady) {
    return;
  }
  if (packedEqual(g_live, g_lastNvs)) {
    return;
  }
  if (writeStatsToNvs(g_live)) {
    g_lastNvs = g_live;
    Serial.println("[MaxStats] NVS updated");
  } else {
    Serial.println("[MaxStats] NVS write failed");
  }
}

}  // namespace

void initMaximumStats() {
  Preferences prefs;
  if (!prefs.begin(PREFS_NS, true)) {
    g_live = {};
    g_lastNvs = {};
    s_prefsReady = false;
    s_lastMotorActive = false;
    return;
  }
  g_live.flags = prefs.getUChar(KEY_FLAGS, 0);
  g_live.maxRpm = prefs.getUInt(KEY_RPM, 0);
  g_live.maxVoltageV = prefs.getFloat(KEY_VOLT, 0.0f);
  g_live.maxMotorTempC = prefs.getFloat(KEY_TEMP, 0.0f);
  prefs.end();
  if (g_live.flags > (FL_RPM | FL_VOLT | FL_TEMP)) {
    g_live = {};
  }
  g_lastNvs = g_live;
  s_prefsReady = true;
  s_lastMotorActive = false;
}

void maximumStatsOnMotorLoop(bool motorActive, float rpm, bool rpmReady, float batteryVoltage, float motorTempC, bool motorTempReady) {
  if (motorActive) {
    if (rpmReady) {
      const uint32_t r = static_cast<uint32_t>(lroundf(rpm < 0.0f ? 0.0f : rpm));
      if ((g_live.flags & FL_RPM) == 0 || r > g_live.maxRpm) {
        g_live.maxRpm = r;
        g_live.flags |= FL_RPM;
      }
    }
    if (batteryVoltage > 0.05f) {
      if ((g_live.flags & FL_VOLT) == 0 || batteryVoltage > g_live.maxVoltageV) {
        g_live.maxVoltageV = batteryVoltage;
        g_live.flags |= FL_VOLT;
      }
    }
    if (motorTempReady) {
      if ((g_live.flags & FL_TEMP) == 0 || motorTempC > g_live.maxMotorTempC) {
        g_live.maxMotorTempC = motorTempC;
        g_live.flags |= FL_TEMP;
      }
    }
  }

  if (motorActive != s_lastMotorActive) {
    s_lastMotorActive = motorActive;
    persistIfChanged();
  }
}

void maximumStatsClearPersisted() {
  g_live = {};
  g_lastNvs = {};
  if (writeStatsToNvs(g_live)) {
    g_lastNvs = g_live;
    s_prefsReady = true;
    Serial.println("[MaxStats] Cleared");
  } else {
    Serial.println("[MaxStats] Clear NVS failed");
  }
}

MaximumStatsForDisplay maximumStatsGetForDisplay() {
  MaximumStatsForDisplay d{};
  d.hasMaxRpm = (g_live.flags & FL_RPM) != 0;
  d.maxRpm = g_live.maxRpm;
  d.hasMaxVoltage = (g_live.flags & FL_VOLT) != 0;
  d.maxVoltageV = g_live.maxVoltageV;
  d.hasMaxMotorTemp = (g_live.flags & FL_TEMP) != 0;
  d.maxMotorTempC = g_live.maxMotorTempC;
  return d;
}
