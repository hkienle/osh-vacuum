#ifndef LED_H
#define LED_H

#include <FastLED.h>

// LED patterns
enum LedPattern {
  LED_OFF,
  LED_STATIC,
  LED_BLINK,
  LED_PULSE,
  LED_SPEED_DISPLAY
};

// Initialize LED module
void initLED();

// Update LED (call this in loop())
void updateLED();

// Set pattern
void setLEDPattern(LedPattern pattern);

// Set color (R, G, B values 0-255)
void setLEDColor(uint8_t r, uint8_t g, uint8_t b);

// Set speed (milliseconds, lower = faster)
void setLEDSpeed(uint16_t speed);

// Set speed display mode (0-100%, isActive = true when trigger pressed)
void setLEDSpeedDisplay(uint8_t speedPercent, bool isActive);

// Check if we should switch to speed display mode (after 2 seconds)
void checkSpeedDisplayMode(unsigned long bootTime);

#endif // LED_H

