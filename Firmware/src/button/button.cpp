#include <Arduino.h>
#include "button.h"
#include "../settings/settings.h"
#include "../battery_soc/battery_soc.h"

static uint8_t speedPercent = 0;
static bool motorActive = false;

static bool triggerState = false;
static bool triggerLastState = false;
static bool upState = false;
static bool upLastState = false;
static bool downState = false;
static bool downLastState = false;

static unsigned long lastDebounceTime = 0;
static constexpr unsigned long DEBOUNCE_DELAY = 50;
static bool displayInfoMode = false;
static uint8_t displayInfoPage = 0;
static unsigned long dualButtonHoldStart = 0;
static unsigned long infoModeExitHoldStart = 0;
/** After opening the dev menu, user must release both buttons before a new UP+DOWN hold can exit (avoids one continuous hold counting as exit). */
static bool devMenuExitArmed = false;
static bool hadButtonActivity = false;
static unsigned long triggerHoldStart = 0;
static bool triggerStopArmed = true;
static unsigned long lastTriggerReleaseMs = 0;
static bool doublePressLatched = false;
static bool momentaryTriggerRun = false;

namespace {
constexpr uint8_t kDevMenuPageCount = 13U;
constexpr unsigned long DOUBLE_PRESS_WINDOW_MS = 300;

void cycleUint8InList(uint8_t& v, const uint8_t* list, size_t n) {
  for (size_t i = 0; i < n; ++i) {
    if (list[i] == v) {
      v = list[(i + 1U) % n];
      return;
    }
  }
  v = list[0];
}

void cycleDevSettingAndSave(uint8_t page) {
  RuntimeSettings& rs = getRuntimeSettings();
  static constexpr uint8_t kAutoOff[] = {0, 1, 2, 5, 10, 30};
  static constexpr uint8_t kTempLim[] = {0, 30, 35, 40, 45, 50, 55, 60, 65, 70};
  static constexpr uint8_t kSpdStep[] = {1, 5, 10, 20, 25};
  static constexpr uint8_t kMinDuty[] = {
      1,  2,  3,  4,  5,  6,  7,  8,  9,  10,
      11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
      21, 22, 23, 24, 25, 26, 27, 28, 29, 30};
  static constexpr uint8_t kSleepTimer[] = {1, 2, 5, 10, 30};

  switch (page) {
    case 5:
      cycleUint8InList(rs.autoOffMinutes, kAutoOff, sizeof(kAutoOff));
      break;
    case 6:
      cycleUint8InList(rs.tempLimitC, kTempLim, sizeof(kTempLim));
      break;
    case 7:
      cycleUint8InList(rs.speedStepPercent, kSpdStep, sizeof(kSpdStep));
      break;
    case 8:
      cycleUint8InList(rs.minDutyPercent, kMinDuty, sizeof(kMinDuty));
      break;
    case 9: {
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
      break;
    }
    case 10: {
      uint8_t m = static_cast<uint8_t>(rs.motorDisplayMode);
      m = static_cast<uint8_t>((m + 1U) % 4U);
      rs.motorDisplayMode = static_cast<MotorDisplayMode>(m);
      break;
    }
    case 11:
      cycleUint8InList(rs.sleepTimerMinutes, kSleepTimer, sizeof(kSleepTimer));
      break;
    case 12: {
      uint8_t t = static_cast<uint8_t>(rs.triggerMode);
      t = static_cast<uint8_t>((t + 1U) % 2U);
      rs.triggerMode = static_cast<TriggerMode>(t);
      break;
    }
    default:
      return;
  }
  if (saveRuntimeSettings(rs)) {
    Serial.printf("[Button] Dev setting page %u saved\n", static_cast<unsigned>(page));
  } else {
    Serial.println("[Button] Dev setting save failed");
  }
}
}  // namespace

void initButtons() {
  pinMode(TRIGGER_PIN, INPUT_PULLUP);
  pinMode(UP_PIN, INPUT_PULLUP);
  pinMode(DOWN_PIN, INPUT_PULLUP);

  pinMode(MOSFET_PIN, OUTPUT);
  digitalWrite(MOSFET_PIN, LOW);

  speedPercent = 0;
  displayInfoMode = false;
  displayInfoPage = 0;
  dualButtonHoldStart = 0;
  infoModeExitHoldStart = 0;
  devMenuExitArmed = false;
  lastTriggerReleaseMs = 0;
  doublePressLatched = false;
  momentaryTriggerRun = false;

  triggerLastState = digitalRead(TRIGGER_PIN);
  upLastState = digitalRead(UP_PIN);
  downLastState = digitalRead(DOWN_PIN);
}

void updateButtons() {
  const unsigned long currentTime = millis();

  const bool triggerReading = !digitalRead(TRIGGER_PIN);
  const bool upReading = !digitalRead(UP_PIN);
  const bool downReading = !digitalRead(DOWN_PIN);
  const bool bothHeld = upReading && downReading;
  if (triggerReading != triggerLastState || upReading != upLastState || downReading != downLastState) {
    hadButtonActivity = true;
  }

  if (upReading != upLastState || downReading != downLastState) {
    lastDebounceTime = currentTime;
  }
  const bool debounced = (currentTime - lastDebounceTime) > DEBOUNCE_DELAY;
  const bool triggerPressedEdge = triggerReading && !triggerLastState;

  if (displayInfoMode) {
    hadButtonActivity = true;

    if (!bothHeld) {
      devMenuExitArmed = true;
      infoModeExitHoldStart = 0;
    }

    if (bothHeld && devMenuExitArmed) {
      if (infoModeExitHoldStart == 0) {
        infoModeExitHoldStart = currentTime;
      } else if (currentTime - infoModeExitHoldStart >= INFO_MODE_HOLD_MS) {
        displayInfoMode = false;
        devMenuExitArmed = false;
        infoModeExitHoldStart = 0;
        dualButtonHoldStart = 0;
        upState = upReading;
        downState = downReading;
        upLastState = upReading;
        downLastState = downReading;
        triggerLastState = triggerReading;
        triggerState = triggerReading;
        lastDebounceTime = currentTime;
        Serial.println("[Button] Display info mode OFF (UP+DOWN hold)");
      }
    } else if (bothHeld && !devMenuExitArmed) {
      infoModeExitHoldStart = 0;
    }

    if (debounced) {
      if (!bothHeld) {
        if (upReading && !upState) {
          displayInfoPage = static_cast<uint8_t>((static_cast<unsigned>(displayInfoPage) + 1U) % kDevMenuPageCount);
        }
        if (downReading && !downState) {
          displayInfoPage = static_cast<uint8_t>((static_cast<unsigned>(displayInfoPage) + kDevMenuPageCount - 1U) % kDevMenuPageCount);
        }
      }
      upState = upReading;
      downState = downReading;
    }

    if (triggerPressedEdge && displayInfoPage >= 5U) {
      cycleDevSettingAndSave(displayInfoPage);
    }

    triggerState = triggerReading;
    triggerLastState = triggerReading;
    upLastState = upReading;
    downLastState = downReading;

    if (motorActive) {
      digitalWrite(MOSFET_PIN, HIGH);
    } else {
      digitalWrite(MOSFET_PIN, LOW);
    }
    return;
  }

  if (bothHeld) {
    if (dualButtonHoldStart == 0) {
      dualButtonHoldStart = currentTime;
    } else if (currentTime - dualButtonHoldStart >= INFO_MODE_HOLD_MS) {
      displayInfoMode = true;
      displayInfoPage = 0;
      dualButtonHoldStart = 0;
      infoModeExitHoldStart = 0;
      devMenuExitArmed = false;
      Serial.println("[Button] Display info mode ON");
      upState = upReading;
      downState = downReading;
      upLastState = upReading;
      downLastState = downReading;
      triggerLastState = triggerReading;
      if (motorActive) {
        digitalWrite(MOSFET_PIN, HIGH);
      } else {
        digitalWrite(MOSFET_PIN, LOW);
      }
      return;
    }
  } else {
    dualButtonHoldStart = 0;
  }

  triggerState = triggerReading;

  const TriggerMode triggerMode = getRuntimeSettings().triggerMode;
  if (triggerMode == TriggerMode::Hold) {
    if (!motorActive) {
      if (!triggerStopArmed) {
        triggerHoldStart = 0;
        if (!triggerReading) {
          triggerStopArmed = true;
        }
      } else if (triggerReading) {
        if (triggerHoldStart == 0) {
          triggerHoldStart = currentTime;
        } else if (currentTime - triggerHoldStart >= TRIGGER_START_HOLD_MS) {
          motorActive = true;
          triggerStopArmed = false;
          triggerHoldStart = 0;
          Serial.println("[Button] Motor START (trigger long-press)");
        }
      } else {
        triggerHoldStart = 0;
      }
    } else {
      triggerHoldStart = 0;
      if (!triggerStopArmed) {
        if (!triggerReading) {
          triggerStopArmed = true;
        }
      } else if (triggerPressedEdge) {
        motorActive = false;
        triggerStopArmed = false;
        Serial.println("[Button] Motor STOP (trigger press)");
      }
    }
    doublePressLatched = false;
    momentaryTriggerRun = false;
    lastTriggerReleaseMs = 0;
  } else {
    triggerHoldStart = 0;
    const bool triggerReleasedEdge = !triggerReading && triggerLastState;

    if (triggerPressedEdge) {
      if (doublePressLatched) {
        motorActive = false;
        doublePressLatched = false;
        momentaryTriggerRun = false;
        triggerStopArmed = false;
        Serial.println("[Button] Motor STOP (trigger press, double mode latch)");
      } else {
        const bool isDoublePress = (lastTriggerReleaseMs != 0) && ((currentTime - lastTriggerReleaseMs) <= DOUBLE_PRESS_WINDOW_MS);
        if (isDoublePress) {
          motorActive = true;
          doublePressLatched = true;
          momentaryTriggerRun = false;
          triggerStopArmed = true;
          Serial.println("[Button] Motor LATCH ON (trigger double-press)");
        } else {
          motorActive = true;
          momentaryTriggerRun = true;
          triggerStopArmed = true;
          Serial.println("[Button] Motor MOMENTARY ON (trigger hold, double mode)");
        }
      }
    }

    if (triggerReleasedEdge) {
      lastTriggerReleaseMs = currentTime;
      if (momentaryTriggerRun && !doublePressLatched) {
        motorActive = false;
        momentaryTriggerRun = false;
        triggerStopArmed = false;
        Serial.println("[Button] Motor MOMENTARY OFF (trigger release, double mode)");
      } else {
        momentaryTriggerRun = false;
      }
    }
  }

  triggerLastState = triggerReading;

  if (motorActive) {
    digitalWrite(MOSFET_PIN, HIGH);
  } else {
    digitalWrite(MOSFET_PIN, LOW);
  }

  const uint8_t step = getRuntimeSettings().speedStepPercent;

  if (debounced && !bothHeld) {
    if (upReading && !upState) {
      const unsigned add = step;
      if (speedPercent <= 100U - add) {
        speedPercent = static_cast<uint8_t>(speedPercent + add);
      } else {
        speedPercent = 100;
      }
      Serial.printf("[Button] Speed increased to %d%%\n", speedPercent);
    }

    if (downReading && !downState) {
      if (speedPercent > step) {
        speedPercent = static_cast<uint8_t>(speedPercent - step);
      } else {
        speedPercent = 0;
      }
      Serial.printf("[Button] Speed decreased to %d%%\n", speedPercent);
    }

    upState = upReading;
    downState = downReading;
  }

  upLastState = upReading;
  downLastState = downReading;
}

uint8_t getSpeed() {
  // In TriggerMode::DoublePress with momentary hold, ensure non-zero output
  // so the motor can spin even when the stored speed setting is 0%.
  if (getRuntimeSettings().triggerMode == TriggerMode::DoublePress &&
      momentaryTriggerRun &&
      speedPercent == 0) {
    return 1;
  }
  return speedPercent;
}

bool hadButtonActivityAndClear() {
  const bool result = hadButtonActivity;
  hadButtonActivity = false;
  return result;
}

bool isTriggerPressed() {
  if (!motorActive && !triggerStopArmed) {
    return false;
  }
  return triggerState;
}

void setSpeed(uint8_t speed) {
  speedPercent = speed;
  if (speedPercent > 100) {
    speedPercent = 100;
  }
  Serial.printf("[Button] Speed set to %d%% (from web UI)\n", speedPercent);
}

bool isMotorActive() {
  return motorActive;
}

void setMotorState(bool active) {
  motorActive = active;
  triggerHoldStart = 0;
  momentaryTriggerRun = false;
  if (!active) {
    doublePressLatched = false;
  }
  if (motorActive) {
    triggerStopArmed = !triggerState;
    digitalWrite(MOSFET_PIN, HIGH);
    Serial.println("[Button] Motor state: START (from web UI)");
  } else {
    triggerStopArmed = false;
    digitalWrite(MOSFET_PIN, LOW);
    Serial.println("[Button] Motor state: STOP (from web UI)");
  }
}

bool isDisplayInfoMode() {
  return displayInfoMode;
}

uint8_t getDisplayInfoPage() {
  return displayInfoPage;
}

void resetButtonRuntimeStateKeepSpeed() {
  motorActive = false;
  triggerState = false;
  triggerLastState = !digitalRead(TRIGGER_PIN);
  upState = false;
  upLastState = !digitalRead(UP_PIN);
  downState = false;
  downLastState = !digitalRead(DOWN_PIN);
  displayInfoMode = false;
  displayInfoPage = 0;
  dualButtonHoldStart = 0;
  infoModeExitHoldStart = 0;
  devMenuExitArmed = false;
  hadButtonActivity = false;
  triggerHoldStart = 0;
  triggerStopArmed = false;
  lastTriggerReleaseMs = 0;
  doublePressLatched = false;
  momentaryTriggerRun = false;
  digitalWrite(MOSFET_PIN, LOW);
}
