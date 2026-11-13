#include <Arduino.h>
#include "led.h"
#include <math.h>

#define LED_PIN 39
#define NUM_LEDS 5
#define LED_TYPE WS2812B
#define COLOR_ORDER GRB

namespace {

CRGB leds[NUM_LEDS];

LedPattern currentPattern = LED_OFF;
uint8_t currentR = 0;
uint8_t currentG = 0;
uint8_t currentB = 0;
uint16_t patternSpeed = 500;

unsigned long lastUpdate = 0;
bool blinkState = false;
uint8_t pulseBrightness = 0;

bool barDisplayEnabled = false;
bool barSuspendedBySleep = false;

int8_t barSocPercent = -1;
float barRpm = 0.0f;
bool barRpmReady = false;
uint32_t barMaxRecordedRpm = 0;
bool barHasMaxRecordedRpm = false;
uint8_t barSpeedPercent = 0;
float barTemperatureC = 0.0f;
bool barTempReady = false;
uint8_t barTempLimitC = 0;
bool barMotorActive = false;
uint8_t barLedIdleMode = 0;
uint8_t barLedDisplayMode = 0;
uint8_t barLedDimPercent = 0;
uint8_t barLedTheme = 1;
bool barOtaActive = false;
uint8_t barOtaProgressPercent = 0;

bool bootGlowActive = false;
uint32_t bootGlowStartMs = 0;
uint8_t bootGlowTheme = 1;

bool thermalBlinkActive = false;
uint32_t thermalBlinkStartMs = 0;
constexpr uint32_t THERMAL_BLINK_TOTAL_MS = 5000UL;
constexpr uint32_t THERMAL_BLINK_INTERVAL_MS = 200UL;

constexpr CRGB kRedFull(255, 0, 0);
/** Keep in sync with OLED splash total: BOOT_APPEAR_MS + BOOT_HOLD_MS + BOOT_MOVE_OUT_MS + UI_MOVE_IN_MS. */
constexpr uint32_t kBootLedGlowDurationMs = 1000U + 1000U + 250U + 250U;

CRGB barThemeForeground(uint8_t theme) {
  switch (theme) {
    case 0:
      return CRGB::Black;
    case 1:
      return CRGB(255, 255, 255);
    case 2:
      return CRGB(0, 0, 255);
    case 3:
      return CRGB(0, 255, 0);
    case 4:
      return CRGB(255, 20, 147);
    case 5:
      return CRGB(255, 140, 0);
    case 6:
      return CRGB(255, 255, 0);
    default:
      return CRGB(255, 255, 255);
  }
}

/** OTA strip: always blue; “off” segments use LED-dim % of blue. */
CRGB otaBlueOn() {
  return CRGB(0, 0, 255);
}

CRGB otaBlueDim() {
  if (barLedDimPercent == 0) {
    return CRGB::Black;
  }
  const uint8_t b = static_cast<uint8_t>((255U * static_cast<uint16_t>(barLedDimPercent)) / 100U);
  return CRGB(0, 0, b);
}

uint8_t percentFromSoc(int8_t socPercent) {
  if (socPercent < 0) {
    return 0;
  }
  if (socPercent > 100) {
    return 100;
  }
  return static_cast<uint8_t>(socPercent);
}

uint8_t ledsOnFromPercent(uint8_t percent) {
  if (percent == 0) {
    return 0;
  }
  if (percent <= 25) {
    return 1;
  }
  if (percent <= 50) {
    return 2;
  }
  if (percent <= 75) {
    return 3;
  }
  if (percent < 98) {
    return 4;
  }
  return 5;
}

CRGB barInactiveColor() {
  if (barLedDimPercent == 0) {
    return CRGB::Black;
  }
  const uint8_t scale = static_cast<uint8_t>((255U * static_cast<uint16_t>(barLedDimPercent)) / 100U);
  if (barLedTheme == 0) {
    return CRGB(scale, scale, scale);
  }
  const CRGB base = barThemeForeground(barLedTheme);
  return CRGB(
      static_cast<uint8_t>((static_cast<uint16_t>(base.r) * static_cast<uint16_t>(scale)) / 255U),
      static_cast<uint8_t>((static_cast<uint16_t>(base.g) * static_cast<uint16_t>(scale)) / 255U),
      static_cast<uint8_t>((static_cast<uint16_t>(base.b) * static_cast<uint16_t>(scale)) / 255U));
}

void renderBootGlow(uint32_t elapsedMs) {
  const uint32_t cap = elapsedMs >= kBootLedGlowDurationMs ? kBootLedGlowDurationMs : elapsedMs;
  const float t = kBootLedGlowDurationMs == 0 ? 1.0f : static_cast<float>(cap) / static_cast<float>(kBootLedGlowDurationMs);
  const float u = t * t * (3.0f - 2.0f * t);
  const uint8_t scale = static_cast<uint8_t>(lroundf(u * 255.0f));

  CRGB base = barThemeForeground(bootGlowTheme);
  if (bootGlowTheme == 0) {
    base = CRGB(255, 255, 255);
  }
  const CRGB c = CRGB(
      static_cast<uint8_t>((static_cast<uint16_t>(base.r) * static_cast<uint16_t>(scale)) / 255U),
      static_cast<uint8_t>((static_cast<uint16_t>(base.g) * static_cast<uint16_t>(scale)) / 255U),
      static_cast<uint8_t>((static_cast<uint16_t>(base.b) * static_cast<uint16_t>(scale)) / 255U));
  for (int i = 0; i < NUM_LEDS; ++i) {
    leds[i] = c;
  }
  FastLED.show();
}

void renderThemeBar(uint8_t percent) {
  const uint8_t n = ledsOnFromPercent(percent);
  const CRGB off = barInactiveColor();
  const CRGB on = barThemeForeground(barLedTheme);
  for (int i = 0; i < NUM_LEDS; ++i) {
    const int idx = NUM_LEDS - 1 - i;
    leds[idx] = (i < static_cast<int>(n)) ? on : off;
  }
  FastLED.show();
}

void renderOtaBar(unsigned long nowMs) {
  const unsigned p = static_cast<unsigned>(barOtaProgressPercent > 100 ? 100 : barOtaProgressPercent);
  // 20% steps along the bar (matches display L→R). Strip order is opposite renderThemeBar
  // (idx 4 lights first there), so slot 0 = first from left maps to phy = NUM_LEDS - 1 - slot.
  const unsigned step = (p >= 100U) ? 5U : (p / 20U);
  const CRGB on = otaBlueOn();
  const CRGB dim = otaBlueDim();
  constexpr uint32_t kOtaLeadBlinkPhaseMs = 500U;
  const bool blinkOn = ((nowMs / kOtaLeadBlinkPhaseMs) & 1U) != 0U;

  for (int slot = 0; slot < NUM_LEDS; ++slot) {
    const int phy = NUM_LEDS - 1 - slot;
    if (step >= 5U) {
      leds[phy] = on;
      continue;
    }
    if (static_cast<unsigned>(slot) < step) {
      leds[phy] = on;
    } else if (static_cast<unsigned>(slot) == step) {
      leds[phy] = blinkOn ? on : dim;
    } else {
      leds[phy] = dim;
    }
  }
  FastLED.show();
}

uint8_t mapRpmToPercent(float rpm) {
  float ceilingRpm = 45000.0f;
  if (barHasMaxRecordedRpm && barMaxRecordedRpm > 0) {
    ceilingRpm = static_cast<float>(barMaxRecordedRpm) * 0.98f;
    if (ceilingRpm < 1.0f) {
      ceilingRpm = 1.0f;
    }
  }
  if (rpm < 0.0f) {
    rpm = 0.0f;
  }
  if (rpm >= ceilingRpm) {
    return 100;
  }
  return static_cast<uint8_t>((rpm * 100.0f) / ceilingRpm);
}

uint8_t mapTempToPercent(float tempC, uint8_t tempLimitC) {
  const float tMin = 20.0f;
  float tMax = 70.0f;
  if (tempLimitC > 0) {
    tMax = static_cast<float>(tempLimitC);
  }
  if (tMax <= tMin) {
    return 0;
  }
  if (tempC <= tMin) {
    return 0;
  }
  if (tempC >= tMax) {
    return 100;
  }
  const float p = (tempC - tMin) / (tMax - tMin);
  return static_cast<uint8_t>(lroundf(p * 100.0f));
}

uint8_t idleBarPercent() {
  switch (barLedIdleMode) {
    case 1:  // Speed
      return barSpeedPercent > 100 ? 100 : barSpeedPercent;
    case 2:  // RPM
      return barRpmReady ? mapRpmToPercent(barRpm) : 0;
    case 0:  // SOC
    default:
      return percentFromSoc(barSocPercent);
  }
}

uint8_t motorBarPercent() {
  switch (barLedDisplayMode) {
    case 0:  // SOC
      return percentFromSoc(barSocPercent);
    case 1:  // RPM
      return barRpmReady ? mapRpmToPercent(barRpm) : 0;
    case 2:  // Speed
      return barSpeedPercent > 100 ? 100 : barSpeedPercent;
    case 3:  // Temp
    default:
      return barTempReady ? mapTempToPercent(barTemperatureC, barTempLimitC) : 0;
  }
}

void runLegacyPattern(unsigned long currentTime) {
  uint16_t updateInterval = patternSpeed;

  if (currentPattern == LED_PULSE) {
    updateInterval = 10;
  }

  if (currentTime - lastUpdate < updateInterval) {
    return;
  }

  lastUpdate = currentTime;

  switch (currentPattern) {
    case LED_OFF:
      for (int i = 0; i < NUM_LEDS; i++) {
        leds[i] = CRGB::Black;
      }
      FastLED.show();
      break;

    case LED_STATIC:
      for (int i = 0; i < NUM_LEDS; i++) {
        leds[i] = CRGB(currentR, currentG, currentB);
      }
      FastLED.show();
      break;

    case LED_BLINK:
      blinkState = !blinkState;
      if (blinkState) {
        for (int i = 0; i < NUM_LEDS; i++) {
          leds[i] = CRGB(currentR, currentG, currentB);
        }
      } else {
        for (int i = 0; i < NUM_LEDS; i++) {
          leds[i] = CRGB::Black;
        }
      }
      FastLED.show();
      break;

    case LED_PULSE: {
      unsigned long cycleTime = currentTime % patternSpeed;
      float phase = (float)cycleTime / (float)patternSpeed * 2.0 * 3.14159265f;
      float brightness = (sin(phase - 3.14159265f / 2.0f) + 1.0f) / 2.0f;
      pulseBrightness = (uint8_t)(brightness * 255);

      CRGB color = CRGB(
          (currentR * pulseBrightness) / 255,
          (currentG * pulseBrightness) / 255,
          (currentB * pulseBrightness) / 255);
      for (int i = 0; i < NUM_LEDS; i++) {
        leds[i] = color;
      }
      FastLED.show();
      break;
    }
  }
}

void runBarDisplay(unsigned long currentTime) {
  if (barSuspendedBySleep) {
    return;
  }

  if (thermalBlinkActive) {
    if (currentTime - thermalBlinkStartMs >= THERMAL_BLINK_TOTAL_MS) {
      thermalBlinkActive = false;
    } else if (currentTime - lastUpdate >= THERMAL_BLINK_INTERVAL_MS) {
      lastUpdate = currentTime;
      blinkState = !blinkState;
      const CRGB c = blinkState ? kRedFull : CRGB::Black;
      for (int i = 0; i < NUM_LEDS; ++i) {
        leds[i] = c;
      }
      FastLED.show();
    }
    return;
  }

  if (barOtaActive) {
    renderOtaBar(currentTime);
    return;
  }

  if (bootGlowActive) {
    const uint32_t elapsed = static_cast<uint32_t>(currentTime - bootGlowStartMs);
    if (elapsed >= kBootLedGlowDurationMs) {
      bootGlowActive = false;
      lastUpdate = 0;
    } else {
      renderBootGlow(elapsed);
      return;
    }
  }

  if (currentTime - lastUpdate < 50) {
    return;
  }
  lastUpdate = currentTime;

  if (barMotorActive) {
    renderThemeBar(motorBarPercent());
  } else {
    renderThemeBar(idleBarPercent());
  }
}

}  // namespace

void ledNotifyOtaProgressFromCallback(bool active, uint8_t progressPercent) {
  if (!barDisplayEnabled) {
    return;
  }
  barSuspendedBySleep = false;
  if (active) {
    bootGlowActive = false;
    barOtaActive = true;
    barOtaProgressPercent = progressPercent > 100U ? 100U : progressPercent;
    renderOtaBar(millis());
  } else {
    barOtaActive = false;
  }
}

void initLED() {
  FastLED.addLeds<LED_TYPE, LED_PIN, COLOR_ORDER>(leds, NUM_LEDS);
  FastLED.setBrightness(255);
  FastLED.clear();
  FastLED.show();
}

void enableLEDBarDisplay(uint8_t ledThemeForBootGlow) {
  barDisplayEnabled = true;
  barSuspendedBySleep = false;
  lastUpdate = 0;
  bootGlowTheme = ledThemeForBootGlow > 6U ? 1U : ledThemeForBootGlow;
  bootGlowActive = true;
  bootGlowStartMs = millis();
}

void updateLEDBarGraph(int8_t socPercent, float rpm, bool rpmReady, uint32_t maxRecordedRpm, bool hasMaxRecordedRpm,
                       uint8_t speedPercent, float temperatureC, bool tempReady, uint8_t tempLimitC, bool motorActive,
                       uint8_t ledIdleDisplayMode, uint8_t ledMotorDisplayMode, uint8_t ledDimPercent, uint8_t ledTheme,
                       bool otaActive, uint8_t otaProgressPercent) {
  barSuspendedBySleep = false;
  barSocPercent = socPercent;
  barRpm = rpm;
  barRpmReady = rpmReady;
  barMaxRecordedRpm = maxRecordedRpm;
  barHasMaxRecordedRpm = hasMaxRecordedRpm;
  barSpeedPercent = speedPercent;
  barTemperatureC = temperatureC;
  barTempReady = tempReady;
  barTempLimitC = tempLimitC;
  barMotorActive = motorActive;
  barLedIdleMode = (ledIdleDisplayMode > 2) ? 0 : ledIdleDisplayMode;
  barLedDisplayMode = ledMotorDisplayMode;
  barLedTheme = ledTheme > 6U ? 1U : ledTheme;
  barOtaActive = otaActive;
  barOtaProgressPercent = otaProgressPercent > 100U ? 100U : otaProgressPercent;
  if (otaActive) {
    bootGlowActive = false;
  }
  uint8_t d = ledDimPercent;
  if (d > 50) {
    d = 50;
  }
  if (d <= 10) {
    barLedDimPercent = d;
  } else if (d >= 15 && (d - 15) % 5 == 0) {
    barLedDimPercent = d;
  } else {
    barLedDimPercent = 0;
  }
}

void triggerThermalOffBlink() {
  thermalBlinkActive = true;
  bootGlowActive = false;
  thermalBlinkStartMs = millis();
  lastUpdate = 0;
}

void updateLED() {
  const unsigned long currentTime = millis();

  if (!barDisplayEnabled) {
    runLegacyPattern(currentTime);
    return;
  }

  runBarDisplay(currentTime);
}

void setLEDPattern(LedPattern pattern) {
  currentPattern = pattern;
  lastUpdate = 0;
  pulseBrightness = 0;
  blinkState = false;
}

void setLEDColor(uint8_t r, uint8_t g, uint8_t b) {
  currentR = r;
  currentG = g;
  currentB = b;
}

void setLEDSpeed(uint16_t speed) {
  patternSpeed = speed;
}

void turnOffLEDsNow() {
  barSuspendedBySleep = true;
  thermalBlinkActive = false;
  bootGlowActive = false;
  for (int i = 0; i < NUM_LEDS; ++i) {
    leds[i] = CRGB::Black;
  }
  FastLED.show();
}
