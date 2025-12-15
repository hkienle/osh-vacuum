#include <Arduino.h>
#include "led.h"
#include <math.h>

#define LED_PIN 39
#define NUM_LEDS 5
#define LED_TYPE WS2812B
#define COLOR_ORDER GRB

CRGB leds[NUM_LEDS];

LedPattern currentPattern = LED_OFF;
uint8_t currentR = 0;
uint8_t currentG = 0;
uint8_t currentB = 0;
uint16_t patternSpeed = 500; // milliseconds

unsigned long lastUpdate = 0;
bool blinkState = false;
uint8_t pulseBrightness = 0;
bool pulseDirection = true; // true = increasing, false = decreasing
static uint8_t speedDisplayPercent = 0;
static bool speedDisplayModeActive = false;
static bool speedDisplayIsActive = false; // true when trigger is pressed

void initLED() {
  FastLED.addLeds<LED_TYPE, LED_PIN, COLOR_ORDER>(leds, NUM_LEDS);
  FastLED.setBrightness(128); // 50% brightness (128/255)
  FastLED.clear();
  FastLED.show();
}

void updateLED() {
  unsigned long currentTime = millis();
  uint16_t updateInterval = patternSpeed;
  
  // For pulse pattern, use very fast update interval for smooth animation
  if (currentPattern == LED_PULSE) {
    updateInterval = 10; // Very fast updates for smooth pulse (10ms)
  }
  
  if (currentTime - lastUpdate < updateInterval) {
    return; // Not time to update yet
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
      // Smooth pulse using sine wave
      // patternSpeed is the time for one full pulse cycle (up + down)
      // Use millis() to create smooth sine-like animation
      unsigned long cycleTime = currentTime % patternSpeed;
      float phase = (float)cycleTime / (float)patternSpeed * 2.0 * 3.14159265f;
      // Use sine wave for smooth pulse (0 to 1), shift by -PI/2 to start at 0
      float brightness = (sin(phase - 3.14159265f/2.0f) + 1.0f) / 2.0f;
      pulseBrightness = (uint8_t)(brightness * 255);
      
      // Scale color by brightness and apply to all LEDs
      CRGB color = CRGB(
        (currentR * pulseBrightness) / 255,
        (currentG * pulseBrightness) / 255,
        (currentB * pulseBrightness) / 255
      );
      for (int i = 0; i < NUM_LEDS; i++) {
        leds[i] = color;
      }
      FastLED.show();
      break;
    }
    
    case LED_SPEED_DISPLAY: {
      // Display speed as percentage on 5 LEDs
      // Round speed to nearest 20% step for display purposes only (PWM uses exact value)
      uint8_t displaySpeed = ((speedDisplayPercent + 10) / 20) * 20; // Round to nearest 20%
      if (displaySpeed > 100) displaySpeed = 100;
      
      // Calculate how many LEDs should be lit (from right to left)
      // 0% = 0 LEDs, 1-20% = 1 LED, 21-40% = 2 LEDs, 41-60% = 3 LEDs, 61-80% = 4 LEDs, 81-100% = 5 LEDs
      int ledsToLight = 0;
      if (displaySpeed == 0) {
        ledsToLight = 0; // Special case: 0% = no LEDs (except pulse)
      } else {
        // Each 20% step = 1 LED: 20%=1, 40%=2, 60%=3, 80%=4, 100%=5
        ledsToLight = displaySpeed / 20;
      }
      if (ledsToLight > NUM_LEDS) ledsToLight = NUM_LEDS;
      
      // Color: Blue when idle (trigger not pressed), Red when active (trigger pressed)
      CRGB activeColor = speedDisplayIsActive ? CRGB(255, 0, 0) : CRGB(0, 0, 255); // Red or Blue
      
      // Special case: when speed is 0%, pulse the rightmost LED slowly
      if (speedDisplayPercent == 0) {
        // Slow pulse: 2 second cycle
        unsigned long pulseCycle = 2000; // 2 seconds
        unsigned long cycleTime = currentTime % pulseCycle;
        float phase = (float)cycleTime / (float)pulseCycle * 2.0 * 3.14159265f;
        // Use sine wave for smooth pulse (0 to 1), shift by -PI/2 to start at 0
        float brightness = (sin(phase - 3.14159265f/2.0f) + 1.0f) / 2.0f;
        uint8_t pulseBright = (uint8_t)(brightness * 255);
        
        // Pulse only the rightmost LED (index NUM_LEDS-1)
        for (int i = 0; i < NUM_LEDS; i++) {
          if (i == NUM_LEDS - 1) {
            leds[i] = CRGB(
              (activeColor.r * pulseBright) / 255,
              (activeColor.g * pulseBright) / 255,
              (activeColor.b * pulseBright) / 255
            );
          } else {
            leds[i] = CRGB::Black;
          }
        }
      } else {
        // Normal display: Light LEDs from right to left (flipped direction)
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
  lastUpdate = 0; // Reset timing
  pulseBrightness = 0;
  pulseDirection = true;
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
    lastUpdate = 0; // Force immediate update
  }
}

void checkSpeedDisplayMode(unsigned long bootTime) {
  // Switch to speed display mode after 2 seconds
  if (!speedDisplayModeActive && (millis() - bootTime) >= 2000) {
    speedDisplayModeActive = true;
    currentPattern = LED_SPEED_DISPLAY;
    lastUpdate = 0; // Force immediate update
    Serial.println("[LED] Switching to speed display mode");
  }
}

