/*
 * Xiaomi G motor — ESC UART on GPIO TX=17, RX=18 (Serial2).
 * Protocol: periodic CTRL + SETP frames; discrete Eco / Medium / High (MM) only.
 */

#include "motor_xiaomi_g.h"

#include <Arduino.h>

#include "xiaomi_g_protocol.h"
#include "xiaomi_g_uart.h"

namespace {

constexpr uint32_t kCyclePeriodMs = 50;
constexpr uint32_t kCtrlSetpGapMs = 25;
constexpr uint32_t kStopGapMs = 25;
constexpr uint8_t kStopRepeats = 3;

enum class CyclePhase : uint8_t {
  IdleBeforeCtrl,
  WaitBeforeSetp,
};

static bool s_initialized = false;
static bool s_motorOn = false;
static XgEscMode s_currentMode = kXgEscModeEco;
static bool s_wakeDone = false;
static uint32_t s_lastCycleMs = 0;
static uint32_t s_phaseStartMs = 0;
static CyclePhase s_phase = CyclePhase::IdleBeforeCtrl;

static const MotorSpeedLevel kLevels[] = {
    {0, "Off"},
    {33, "Eco"},
    {67, "Mid"},
    {100, "Boost"},
};

void sendStopFrame(void) {
  uint8_t f[XG_SETP_LEN];
  xgBuildSetpStop(f);
  xgUartSendFrame(f, XG_SETP_LEN);
}

void runStopSequence(void) {
  uint8_t ctrl[XG_CTRL_LEN];
  uint8_t setp[XG_SETP_LEN];
  xgBuildSetpStop(setp);
  for (uint8_t i = 0; i < kStopRepeats; ++i) {
    xgBuildCtrl(ctrl, s_currentMode, false);
    xgUartSendFrame(ctrl, XG_CTRL_LEN);
    delay(kStopGapMs);
    xgUartSendFrame(setp, XG_SETP_LEN);
    if (i + 1 < kStopRepeats) {
      delay(kStopGapMs * 3);
    }
  }
}

void xgInit(void) {
  xgUartBegin();
  s_initialized = true;
  s_motorOn = false;
  s_currentMode = kXgEscModeEco;
  s_wakeDone = false;
  s_lastCycleMs = 0;
  s_phaseStartMs = 0;
  s_phase = CyclePhase::IdleBeforeCtrl;
  Serial.println("[Xiaomi G] UART 9600 8E1 TX=17 RX=18");
}

void xgDeinit(void) {
  if (!s_initialized) {
    return;
  }
  sendStopFrame();
  xgUartEnd();
  s_initialized = false;
  s_motorOn = false;
  s_wakeDone = false;
  Serial.println("[Xiaomi G] UART deinit");
}

void xgUpdate(void) {
  if (!s_motorOn || !s_initialized) {
    return;
  }

  if (s_phase == CyclePhase::IdleBeforeCtrl) {
    if ((uint32_t)(millis() - s_lastCycleMs) < kCyclePeriodMs) {
      return;
    }
    uint8_t ctrl[XG_CTRL_LEN];
    xgBuildCtrl(ctrl, s_currentMode, true);
    xgUartSendFrame(ctrl, XG_CTRL_LEN);
    s_phaseStartMs = millis();
    s_phase = CyclePhase::WaitBeforeSetp;
    return;
  }

  if (s_phase == CyclePhase::WaitBeforeSetp) {
    if ((uint32_t)(millis() - s_phaseStartMs) < kCtrlSetpGapMs) {
      return;
    }
    uint8_t setp[XG_SETP_LEN];
    xgBuildSetpRun(setp, s_currentMode);
    xgUartSendFrame(setp, XG_SETP_LEN);
    s_lastCycleMs = millis();
    s_phase = CyclePhase::IdleBeforeCtrl;
  }
}

void xgOnPowerOn(void) {
  if (!s_initialized) {
    xgUartBegin();
    s_initialized = true;
  }
  if (!s_wakeDone) {
    xgUartSendWake();
    delay(kStopGapMs);
    s_wakeDone = true;
  }
  s_motorOn = true;
  s_phase = CyclePhase::IdleBeforeCtrl;
  s_lastCycleMs = 0;
}

void xgOnPowerOff(void) {
  s_motorOn = false;
  if (!s_initialized) {
    return;
  }
  runStopSequence();
}

void xgSetSpeedPercent(uint8_t percent) {
  s_currentMode = xgPercentToMode(percent);
}

bool xgIsRunning(void) {
  return s_motorOn;
}

float xgGetRpm(void) {
  return 0.0f;
}

bool xgIsRpmReady(void) {
  return false;
}

MotorSpeedLevels xgGetSpeedLevels(uint8_t /*step*/, uint8_t /*minD*/, uint8_t /*maxD*/) {
  return MotorSpeedLevels{static_cast<uint8_t>(sizeof(kLevels) / sizeof(kLevels[0])), kLevels};
}

void xgHandleWsCommand(const char* key, int value) {
  (void)key;
  (void)value;
  Serial.println("[Xiaomi G] WebSocket motor command not implemented for UART backend");
}

void xgHandleHeartbeat(void) {}

bool xgSupportsGlobal(DevSettingId id) {
  return id != DevSettingId::SpeedStep && id != DevSettingId::MinDuty && id != DevSettingId::MaxDuty;
}

MotorDriverSettings xgDriverSettings(void) {
  return MotorDriverSettings{0, nullptr};
}

}  // namespace

const MotorDriver kXiaomiGDriver = {
    "Xiaomi G",
    "xiaomi-g",
    MotorCapabilities{false, true, true},
    xgInit,
    xgDeinit,
    xgUpdate,
    xgOnPowerOn,
    xgOnPowerOff,
    xgSetSpeedPercent,
    xgIsRunning,
    xgGetRpm,
    xgIsRpmReady,
    xgGetSpeedLevels,
    xgHandleWsCommand,
    xgHandleHeartbeat,
    xgSupportsGlobal,
    xgDriverSettings,
};
