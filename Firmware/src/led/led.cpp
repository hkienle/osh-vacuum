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
uint8_t speedDisplayPercent = 0;
bool speedDisplayModeActive = false;
bool speedDisplayIsActive = false;

}  // namespace

void initLED() {
  FastLED.addLeds<LED_TYPE, LED_PIN, COLOR_ORDER>(leds, NUM_LEDS);
  FastLED.setBrightness(128);
  FastLED.clear();
  FastLED.show();
}

void updateLED() {
  unsigned long currentTime = millis();
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

    case LED_SPEED_DISPLAY: {
      uint8_t displaySpeed = ((speedDisplayPercent + 10) / 20) * 20;
      if (displaySpeed > 100) {
        displaySpeed = 100;
      }

      int ledsToLight = 0;
      if (displaySpeed == 0) {
        ledsToLight = 0;
      } else {
        ledsToLight = displaySpeed / 20;
      }
      if (ledsToLight > NUM_LEDS) {
        ledsToLight = NUM_LEDS;
      }

      CRGB activeColor = speedDisplayIsActive ? CRGB(255, 0, 0) : CRGB(0, 0, 255);

      if (speedDisplayPercent == 0) {
        unsigned long pulseCycle = 2000;
        unsigned long cycleTime = currentTime % pulseCycle;
        float phase = (float)cycleTime / (float)pulseCycle * 2.0 * 3.14159265f;
        float brightness = (sin(phase - 3.14159265f / 2.0f) + 1.0f) / 2.0f;
        uint8_t pulseBright = (uint8_t)(brightness * 255);

        for (int i = 0; i < NUM_LEDS; i++) {
          if (i == NUM_LEDS - 1) {
            leds[i] = CRGB(
                (activeColor.r * pulseBright) / 255,
                (activeColor.g * pulseBright) / 255,
                (activeColor.b * pulseBright) / 255);
          } else {
            leds[i] = CRGB::Black;
          }
        }
      } else {
        for (int i = 0; i < NUM_LEDS; i++) {
          if (i >= (NUM_LEDS - ledsToLight)) {
            leds[i] = activeColor;
          } else {
            leds[i] = CRGB::Black;
          }
        }
      }
      FastLED.show();
      break;
    }
  }
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

void setLEDSpeedDisplay(uint8_t speedPercent, bool isActive) {
  speedDisplayPercent = speedPercent;
  speedDisplayIsActive = isActive;
  if (speedDisplayModeActive) {
    currentPattern = LED_SPEED_DISPLAY;
    lastUpdate = 0;
  }
}

void checkSpeedDisplayMode(unsigned long bootTime) {
  if (!speedDisplayModeActive && (millis() - bootTime) >= 2000) {
    speedDisplayModeActive = true;
    currentPattern = LED_SPEED_DISPLAY;
    lastUpdate = 0;
    Serial.println("[LED] Switching to speed display mode");
  }
}

void turnOffLEDsNow() {
  currentPattern = LED_OFF;
  for (int i = 0; i < NUM_LEDS; ++i) {
    leds[i] = CRGB::Black;
  }
  FastLED.show();
}
