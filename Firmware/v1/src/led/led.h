#ifndef LED_H
#define LED_H

#include <FastLED.h>
#include <stdint.h>

// LED patterns (WiFi setup / legacy)
enum LedPattern {
  LED_OFF,
  LED_STATIC,
  LED_BLINK,
  LED_PULSE,
};

// Initialize LED module
void initLED();

// Update LED (call this in loop())
void updateLED();

// Set pattern
void setLEDPattern(LedPattern pattern);

// Set color (R, G, B values 0-255)
void setLEDColor(uint8_t r, uint8_t g, uint8_t b);

// Set speed (milliseconds, lower = faster) — used by LED_PULSE
void setLEDSpeed(uint16_t speed);

// After WiFi setup, enable the normal bar-graph LED behaviour (SOC / motor mode).
// ledThemeForBootGlow: 0–6 same as LedTheme; ramps all five LEDs 0→100% then shows the bar.
void enableLEDBarDisplay(uint8_t ledThemeForBootGlow);

// Feed live values for bar graph (call each loop before updateLED()).
void updateLEDBarGraph(int8_t socPercent, float rpm, bool rpmReady, uint32_t maxRecordedRpm, bool hasMaxRecordedRpm,
                       uint8_t speedPercent, float temperatureC, bool tempReady, uint8_t tempLimitC, bool motorActive,
                       uint8_t ledIdleDisplayMode, uint8_t ledMotorDisplayMode, uint8_t ledDimPercent, uint8_t ledTheme,
                       bool otaActive, uint8_t otaProgressPercent);

// Motor stopped due to thermal limit: blink all LEDs red for 5 s @ 200 ms, then resume bar.
void triggerThermalOffBlink();

// Immediately turn all LEDs off and push to strip.
void turnOffLEDsNow();

// Call from ArduinoOTA callbacks so the strip updates even when loop() is not running.
void ledNotifyOtaProgressFromCallback(bool active, uint8_t progressPercent);

#endif  // LED_H
