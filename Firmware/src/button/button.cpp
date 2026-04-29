#include <Arduino.h>
#include "button.h"
#include "../settings/settings.h"
#include "../settings/dev_menu.h"
#include "../motor/motor.h"
#include "../battery_soc/battery_soc.h"
#include "../maximum_stats/maximum_stats.h"

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
constexpr unsigned long DOUBLE_PRESS_WINDOW_MS = 300;
constexpr unsigned long MAX_STATS_CLEAR_HOLD_MS = 2000UL;
static unsigned long maxStatsClearHoldStartMs = 0;
static bool maxStatsClearLatched = false;

void cycleDevSettingAndSave(uint8_t page) {
  if (page < kDevMenuInfoPageCount) {
    return;
  }
  const size_t idx = static_cast<size_t>(page - kDevMenuInfoPageCount);
  const DevSettingDescriptor* d = devMenuVisibleAt(idx);
  if (!d || !d->cycleAndSave) {
    return;
  }
  d->cycleAndSave();
  if (d->isGlobal && d->globalId == DevSettingId::MotorType) {
    initMotor(getRuntimeSettings().motorType);
    devMenuRebuildVisible();
    // Stay on Motor Type: visible indices shift when PWM-only pages disappear.
    for (size_t i = 0; i < devMenuVisibleCount(); ++i) {
      const DevSettingDescriptor* vd = devMenuVisibleAt(i);
      if (vd && vd->isGlobal && vd->globalId == DevSettingId::MotorType) {
        displayInfoPage = static_cast<uint8_t>(kDevMenuInfoPageCount + i);
        return;
      }
    }
    const uint8_t total = devMenuTotalPageCount();
    if (total > 0 && displayInfoPage >= total) {
      displayInfoPage = static_cast<uint8_t>(total - 1U);
    }
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
          displayInfoPage =
              static_cast<uint8_t>((static_cast<unsigned>(displayInfoPage) + 1U) % static_cast<unsigned>(devMenuTotalPageCount()));
        }
        if (downReading && !downState) {
          const uint8_t total = devMenuTotalPageCount();
          displayInfoPage = static_cast<uint8_t>((static_cast<unsigned>(displayInfoPage) + static_cast<unsigned>(total) - 1U) %
                                                  static_cast<unsigned>(total));
        }
      }
      upState = upReading;
      downState = downReading;
    }

    if (debounced && !bothHeld) {
      if (displayInfoPage == 0U) {
        if (triggerReading) {
          if (maxStatsClearHoldStartMs == 0) {
            maxStatsClearHoldStartMs = currentTime;
          } else if (!maxStatsClearLatched && (currentTime - maxStatsClearHoldStartMs >= MAX_STATS_CLEAR_HOLD_MS)) {
            maximumStatsClearPersisted();
            maxStatsClearLatched = true;
          }
        } else {
          maxStatsClearHoldStartMs = 0;
          maxStatsClearLatched = false;
        }
      } else {
        maxStatsClearHoldStartMs = 0;
        maxStatsClearLatched = false;
      }
    }

    if (triggerPressedEdge && displayInfoPage >= kDevMenuInfoPageCount) {
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

  if (debounced && !bothHeld) {
    if (upReading && !upState) {
      speedPercent = motorNextSpeedPercent(speedPercent);
      Serial.printf("[Button] Speed increased to %d%%\n", speedPercent);
    }

    if (downReading && !downState) {
      speedPercent = motorPrevSpeedPercent(speedPercent);
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
  maxStatsClearHoldStartMs = 0;
  maxStatsClearLatched = false;
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
  devMenuRebuildVisible();
}
