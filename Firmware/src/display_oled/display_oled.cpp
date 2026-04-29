#include "display_oled.h"
#include "../button/button.h"
#include "../settings/dev_menu.h"

#include <Arduino.h>
#include "../wifi/wifi.h"
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Wire.h>
#include <math.h>
#include <stdio.h>
#include <string.h>

namespace {
#ifndef OLED_I2C_SDA_PIN
#define OLED_I2C_SDA_PIN 9
#endif

#ifndef OLED_I2C_SCL_PIN
#define OLED_I2C_SCL_PIN 8
#endif

constexpr uint8_t OLED_SDA_PIN = OLED_I2C_SDA_PIN;
constexpr uint8_t OLED_SCL_PIN = OLED_I2C_SCL_PIN;
constexpr uint8_t OLED_I2C_ADDRESS_PRIMARY = 0x3C;
constexpr uint8_t OLED_I2C_ADDRESS_SECONDARY = 0x3D;
constexpr uint16_t OLED_WIDTH = 128;
constexpr uint16_t OLED_HEIGHT = 32;
constexpr int8_t OLED_RESET_PIN = -1;
constexpr uint32_t OLED_I2C_CLOCK_HZ = 100000;
constexpr uint16_t OLED_I2C_TIMEOUT_MS = 20;
constexpr uint16_t OLED_BUFFER_SIZE = (OLED_WIDTH * OLED_HEIGHT) / 8;
constexpr uint32_t BOOT_APPEAR_MS = 1000;
constexpr uint32_t BOOT_HOLD_MS = 1000;
constexpr uint32_t BOOT_MOVE_OUT_MS = 250;
constexpr uint32_t UI_MOVE_IN_MS = 250;
constexpr uint32_t BAR_ANIM_MS = 350;
constexpr char BOOT_TEXT[] = "OSH VAC";

Adafruit_SSD1306 oled(OLED_WIDTH, OLED_HEIGHT, &Wire, OLED_RESET_PIN);

enum class BootAnimState : uint8_t {
  Reveal,
  Hold,
  MoveOut,
  InterfaceIn,
  Done
};

bool oledInitialized = false;
bool oledAvailable = false;
uint8_t oledAddress = OLED_I2C_ADDRESS_PRIMARY;
uint8_t lastSpeed = 255;
int16_t lastBatteryTenth = INT16_MIN;
bool lastTriggerHeld = false;
bool lastRpmReady = false;
int32_t lastRpmRounded = INT32_MIN;
int16_t lastBarFillPx = INT16_MIN;
uint8_t bootTargetBuffer[OLED_BUFFER_SIZE];
uint8_t bootWorkingBuffer[OLED_BUFFER_SIZE];
uint16_t bootLitPixelOrder[OLED_WIDTH * OLED_HEIGHT];
uint16_t bootLitPixelCount = 0;
uint16_t bootRevealedPixels = 0;
int16_t lastMoveOffset = -1;
BootAnimState bootAnimState = BootAnimState::Reveal;
uint32_t bootAnimStateStartMs = 0;
bool bootAnimPrepared = false;
bool barAnimInitialized = false;
bool barAnimActive = false;
float barAnimStartFillPx = 0.0f;
float barAnimTargetFillPx = 0.0f;
uint32_t barAnimStartMs = 0;

void drawMainInterfaceFrame(const char* suctionLabel, const char* topLine, int16_t fillW, int16_t yOffset, int8_t socPercent, bool motorActive, uint32_t nowMs);

void truncateToFit091(const char* src, char* dst, size_t dstLen, size_t maxVisibleChars) {
  if (!dst || dstLen == 0) {
    return;
  }
  dst[0] = '\0';
  if (!src) {
    return;
  }
  const size_t slen = strlen(src);
  if (slen <= maxVisibleChars) {
    snprintf(dst, dstLen, "%s", src);
    return;
  }
  if (maxVisibleChars <= 3) {
    snprintf(dst, dstLen, "...");
    return;
  }
  const size_t keep = maxVisibleChars - 3;
  snprintf(dst, dstLen, "%.*s...", static_cast<int>(keep), src);
}

void drawBoldText091(const char* text, int16_t x, int16_t y) {
  oled.setCursor(x, y);
  oled.print(text);
  oled.setCursor(x + 1, y);
  oled.print(text);
}

void formatAutoOffShort091(char* buf, size_t len, uint8_t minutes) {
  if (minutes == 0) {
    snprintf(buf, len, "OFF");
  } else {
    snprintf(buf, len, "%um", static_cast<unsigned>(minutes));
  }
}

void printRight091(const char* s, int16_t y, uint8_t textSize) {
  oled.setTextSize(textSize);
  oled.setTextColor(SSD1306_WHITE);
  int16_t x1 = 0;
  int16_t y1 = 0;
  uint16_t w = 0;
  uint16_t h = 0;
  oled.getTextBounds(s, 0, 0, &x1, &y1, &w, &h);
  oled.setCursor(static_cast<int16_t>(OLED_WIDTH) - static_cast<int16_t>(w), y);
  oled.print(s);
}

void drawDevSettingPage091(const DevSettingDescriptor& d) {
  char val[20];
  char subLine[28];
  oled.clearDisplay();
  oled.setTextColor(SSD1306_WHITE);
  drawBoldText091(d.title, 0, 0);
  if (d.formatValue) {
    d.formatValue(val, sizeof(val));
  } else {
    val[0] = '\0';
  }
  printRight091(val, 0, 2);
  oled.setTextSize(1);
  oled.setCursor(0, 16);
  if (d.formatSubline) {
    d.formatSubline(subLine, sizeof(subLine));
    oled.print(subLine);
  } else if (d.subline) {
    oled.print(d.subline);
  }
  oled.display();
}

void drawInfoPage091(uint8_t page, uint32_t uptimeSec, uint32_t freeHeap, uint8_t seriesCells, float batteryVoltage, int8_t socPercent, bool motorActive, float motorTempC, bool motorTemperatureReady, float mcuTempC, uint8_t autoOff, uint8_t sleepTimer, uint8_t tempLim, uint8_t spdStep, uint8_t minDuty, uint8_t maxDuty, uint8_t motorDisp, uint8_t triggerMode, uint8_t ledIdleDisplayMode, uint8_t ledDisplayMode, uint8_t ledDimPercent, uint8_t ledTheme, uint32_t maxStatsRpm, bool maxStatsHasRpm, float maxStatsVoltageV, bool maxStatsHasVoltage, float maxStatsMotorTempC, bool maxStatsHasMotorTemp) {
  (void)autoOff;
  (void)sleepTimer;
  (void)tempLim;
  (void)spdStep;
  (void)minDuty;
  (void)maxDuty;
  (void)motorDisp;
  (void)triggerMode;
  (void)ledIdleDisplayMode;
  (void)ledDisplayMode;
  (void)ledDimPercent;
  (void)ledTheme;
  oled.clearDisplay();
  oled.setTextColor(SSD1306_WHITE);
  oled.setTextSize(1);

  char line[24];
  char ip[20];
  char hn[40];
  char ssid[48];
  char ssidCut[22];

  switch (page) {
    case 0:
      drawBoldText091("Maximum Stats", 0, 0);
      oled.setCursor(0, 8);
      if (maxStatsHasRpm) {
        snprintf(line, sizeof(line), "RPM:%lu", static_cast<unsigned long>(maxStatsRpm));
      } else {
        snprintf(line, sizeof(line), "RPM:--");
      }
      oled.print(line);
      oled.setCursor(0, 16);
      if (maxStatsHasVoltage) {
        snprintf(line, sizeof(line), "Volt:%.2fV", static_cast<double>(maxStatsVoltageV));
      } else {
        snprintf(line, sizeof(line), "Volt:--");
      }
      oled.print(line);
      oled.setCursor(0, 24);
      if (maxStatsHasMotorTemp) {
        snprintf(line, sizeof(line), "Temp:%.1fC", static_cast<double>(maxStatsMotorTempC));
      } else {
        snprintf(line, sizeof(line), "Temp:--");
      }
      oled.print(line);
      break;

    case 1:
      drawBoldText091("Battery Info", 0, 0);
      oled.setCursor(0, 8);
      snprintf(line, sizeof(line), "Cells: %uS", static_cast<unsigned>(seriesCells));
      oled.print(line);
      oled.setCursor(0, 16);
      {
        const float cellV = seriesCells > 0 ? (batteryVoltage / static_cast<float>(seriesCells)) : 0.0f;
        snprintf(line, sizeof(line), "Volt: %.1fV / %.2fV", batteryVoltage, cellV);
      }
      oled.print(line);
      oled.setCursor(0, 24);
      if (motorActive || socPercent < 0) {
        snprintf(line, sizeof(line), "SOC: --%%");
      } else {
        snprintf(line, sizeof(line), "SOC: %d%%", static_cast<int>(socPercent));
      }
      oled.print(line);
      break;

    case 2: {
      const WiFiLinkRole role = getWiFiLinkRole();
      const bool apMode = role == WiFiLinkRole::AccessPoint;
      drawBoldText091("WiFi Info", 0, 0);
      getWiFiActiveIpString(ip, sizeof(ip));
      getWiFiNetworkNameForDisplay(ssid, sizeof(ssid));
      if (apMode) {
        snprintf(ssidCut, sizeof(ssidCut), "SSID: Access-Point");
      } else {
        char ssidWithPrefix[48];
        snprintf(ssidWithPrefix, sizeof(ssidWithPrefix), "SSID: %s", ssid);
        truncateToFit091(ssidWithPrefix, ssidCut, sizeof(ssidCut), 18);
      }
      oled.setCursor(0, 8);
      oled.print(ssidCut);
      oled.setCursor(0, 16);
      snprintf(line, sizeof(line), "IP %s", ip);
      oled.print(line);
      oled.setCursor(0, 24);
      {
        int8_t rssi = 0;
        if (getWiFiStaRssiDbm(&rssi)) {
          snprintf(line, sizeof(line), "RSSI %d dBm", static_cast<int>(rssi));
        } else if (apMode) {
          snprintf(line, sizeof(line), "RSSI AP mode");
        } else {
          snprintf(line, sizeof(line), "RSSI --");
        }
      }
      oled.print(line);
      break;
    }

    case 3:
      drawBoldText091("BLE-Info", 0, 0);
      oled.setCursor(0, 8);
      oled.print("State: OFF");
      oled.setCursor(0, 16);
      oled.print("Name: n/a");
      oled.setCursor(0, 24);
      oled.print("Visible: No");
      break;

    case 4:
      drawBoldText091("Sensor Info", 0, 0);
      oled.setCursor(0, 8);
      if (motorTemperatureReady) {
        snprintf(line, sizeof(line), "MOT Temp: %.1fC", motorTempC);
      } else {
        snprintf(line, sizeof(line), "MOT Temp: --.-C");
      }
      oled.print(line);
      oled.setCursor(0, 16);
      if (isfinite(mcuTempC)) {
        snprintf(line, sizeof(line), "MCU Temp: %.1fC", mcuTempC);
      } else {
        snprintf(line, sizeof(line), "MCU Temp: --.-C");
      }
      oled.print(line);
      break;

    case 5: {
      const uint32_t uptimeHours = uptimeSec / 3600U;
      const uint32_t uptimeMin = (uptimeSec % 3600U) / 60U;
      drawBoldText091("System Info", 0, 0);
      getWiFiHostnameString(hn, sizeof(hn));
      truncateToFit091(hn, ssidCut, sizeof(ssidCut), 14);
      oled.setCursor(0, 8);
      snprintf(line, sizeof(line), "Name: %s", ssidCut);
      oled.print(line);
      oled.setCursor(0, 16);
      snprintf(line, sizeof(line), "Up %luh %lum", static_cast<unsigned long>(uptimeHours), static_cast<unsigned long>(uptimeMin));
      oled.print(line);
      oled.setCursor(0, 24);
      {
        const unsigned heapK = (freeHeap + 512U) / 1024U;
        snprintf(line, sizeof(line), "Heap: %uk", heapK);
      }
      oled.print(line);
      break;
    }

    default:
      if (page >= kDevMenuInfoPageCount) {
        const DevSettingDescriptor* d =
            devMenuVisibleAt(static_cast<size_t>(page - kDevMenuInfoPageCount));
        if (d) {
          drawDevSettingPage091(*d);
        }
      }
      return;
  }
  oled.display();
}

// Short busy-wait for I2C bit timing (no delay(); not used from loop()).
inline void busyWaitUs(uint32_t us) {
  const uint32_t start = micros();
  while (static_cast<uint32_t>(micros() - start) < us) {
  }
}

// ~1 ms with yield so other tasks run; used only from display init (not loop()).
inline void cooperativeWaitMs(uint32_t ms) {
  const uint32_t start = millis();
  while (static_cast<uint32_t>(millis() - start) < ms) {
    yield();
  }
}

void recoverI2CBus(uint8_t sdaPin, uint8_t sclPin) {
  pinMode(sdaPin, INPUT_PULLUP);
  pinMode(sclPin, INPUT_PULLUP);
  cooperativeWaitMs(1);

  // If SDA is held low, clock SCL to release a stuck I2C slave.
  if (digitalRead(sdaPin) == LOW) {
    pinMode(sclPin, OUTPUT_OPEN_DRAIN);
    digitalWrite(sclPin, HIGH);

    for (uint8_t i = 0; i < 16; ++i) {
      digitalWrite(sclPin, LOW);
      busyWaitUs(10);
      digitalWrite(sclPin, HIGH);
      busyWaitUs(10);
    }

    // Try to generate a STOP condition.
    pinMode(sdaPin, OUTPUT_OPEN_DRAIN);
    digitalWrite(sdaPin, LOW);
    busyWaitUs(10);
    digitalWrite(sclPin, HIGH);
    busyWaitUs(10);
    digitalWrite(sdaPin, HIGH);
  }

  pinMode(sdaPin, INPUT_PULLUP);
  pinMode(sclPin, INPUT_PULLUP);
}

bool probeAddress(uint8_t address) {
  Wire.beginTransmission(address);
  return Wire.endTransmission() == 0;
}

bool detectOledAddress() {
  if (probeAddress(OLED_I2C_ADDRESS_PRIMARY)) {
    oledAddress = OLED_I2C_ADDRESS_PRIMARY;
    return true;
  }

  if (probeAddress(OLED_I2C_ADDRESS_SECONDARY)) {
    oledAddress = OLED_I2C_ADDRESS_SECONDARY;
    return true;
  }

  return false;
}

void scanI2CBus() {
  bool foundAny = false;
  char addresses[220];
  addresses[0] = '\0';

  for (uint8_t address = 0x03; address <= 0x77; ++address) {
    if (probeAddress(address)) {
      const size_t len = strlen(addresses);
      snprintf(addresses + len, sizeof(addresses) - len, "0x%02X ", address);
      foundAny = true;
    }
  }

  if (foundAny) {
    Serial.printf("OLED: I2C scan found: %s\n", addresses);
  } else {
    Serial.println("OLED: I2C scan found no devices");
  }
}

inline uint16_t pixelIndex(uint8_t x, uint8_t y) {
  return static_cast<uint16_t>(y) * OLED_WIDTH + x;
}

inline uint16_t packPixel(uint8_t x, uint8_t y) {
  return static_cast<uint16_t>((static_cast<uint16_t>(x) << 8) | y);
}

inline uint8_t unpackPixelX(uint16_t packed) {
  return static_cast<uint8_t>((packed >> 8) & 0xFF);
}

inline uint8_t unpackPixelY(uint16_t packed) {
  return static_cast<uint8_t>(packed & 0xFF);
}

inline bool readPixel(const uint8_t* buffer, uint8_t x, uint8_t y) {
  const uint16_t byteIndex = static_cast<uint16_t>(x) + (static_cast<uint16_t>(y / 8) * OLED_WIDTH);
  const uint8_t bitMask = static_cast<uint8_t>(1U << (y & 7));
  return (buffer[byteIndex] & bitMask) != 0;
}

inline void writePixel(uint8_t* buffer, uint8_t x, uint8_t y, bool on) {
  const uint16_t byteIndex = static_cast<uint16_t>(x) + (static_cast<uint16_t>(y / 8) * OLED_WIDTH);
  const uint8_t bitMask = static_cast<uint8_t>(1U << (y & 7));
  if (on) {
    buffer[byteIndex] |= bitMask;
  } else {
    buffer[byteIndex] &= static_cast<uint8_t>(~bitMask);
  }
}

void pushBufferToDisplay(const uint8_t* buffer) {
  memcpy(oled.getBuffer(), buffer, OLED_BUFFER_SIZE);
  oled.display();
}

void renderTargetShiftedUp(int16_t offset) {
  memset(bootWorkingBuffer, 0, sizeof(bootWorkingBuffer));
  for (uint8_t y = 0; y < OLED_HEIGHT; ++y) {
    const int16_t sourceY = static_cast<int16_t>(y) + offset;
    if (sourceY < 0 || sourceY >= static_cast<int16_t>(OLED_HEIGHT)) {
      continue;
    }
    for (uint8_t x = 0; x < OLED_WIDTH; ++x) {
      if (readPixel(bootTargetBuffer, x, static_cast<uint8_t>(sourceY))) {
        writePixel(bootWorkingBuffer, x, y, true);
      }
    }
  }
  pushBufferToDisplay(bootWorkingBuffer);
}

void prepareBootAnimation() {
  oled.clearDisplay();
  oled.setTextColor(SSD1306_WHITE);
  oled.setTextSize(3);

  int16_t x1 = 0;
  int16_t y1 = 0;
  uint16_t w = 0;
  uint16_t h = 0;
  oled.getTextBounds(BOOT_TEXT, 0, 0, &x1, &y1, &w, &h);

  const int16_t drawX = static_cast<int16_t>((OLED_WIDTH - w) / 2) - x1;
  const int16_t drawY = static_cast<int16_t>((OLED_HEIGHT - h) / 2) - y1;
  oled.setCursor(drawX, drawY);
  oled.print(BOOT_TEXT);

  memcpy(bootTargetBuffer, oled.getBuffer(), OLED_BUFFER_SIZE);
  memset(bootWorkingBuffer, 0, OLED_BUFFER_SIZE);

  bootLitPixelCount = 0;
  for (uint8_t y = 0; y < OLED_HEIGHT; ++y) {
    for (uint8_t x = 0; x < OLED_WIDTH; ++x) {
      if (readPixel(bootTargetBuffer, x, y)) {
        bootLitPixelOrder[bootLitPixelCount++] = packPixel(x, y);
      }
    }
  }

  randomSeed(micros());
  if (bootLitPixelCount > 1) {
    for (int32_t i = static_cast<int32_t>(bootLitPixelCount) - 1; i > 0; --i) {
      const int32_t j = random(i + 1);
      const uint16_t tmp = bootLitPixelOrder[i];
      bootLitPixelOrder[i] = bootLitPixelOrder[j];
      bootLitPixelOrder[j] = tmp;
    }
  }

  oled.clearDisplay();
  oled.display();

  bootRevealedPixels = 0;
  lastMoveOffset = -1;
  bootAnimState = BootAnimState::Reveal;
  bootAnimStateStartMs = millis();
  bootAnimPrepared = true;
  Serial.printf("OLED: boot animation prepared (%u lit pixels)\n", bootLitPixelCount);
}

bool renderBootAnimationFrame(const char* suctionLabel, const char* topLine, int16_t fillW, int8_t socPercent, bool motorActive, uint32_t frameNowMs) {
  if (!bootAnimPrepared || bootAnimState == BootAnimState::Done) {
    return false;
  }

  const uint32_t now = frameNowMs;
  const uint32_t elapsed = now - bootAnimStateStartMs;

  if (bootAnimState == BootAnimState::Reveal) {
    uint16_t targetPixels = bootLitPixelCount;
    if (BOOT_APPEAR_MS > 0) {
      targetPixels = static_cast<uint16_t>(
          (static_cast<uint32_t>(bootLitPixelCount) * min(elapsed, BOOT_APPEAR_MS)) / BOOT_APPEAR_MS);
    }
    if (targetPixels > bootLitPixelCount) {
      targetPixels = bootLitPixelCount;
    }

    while (bootRevealedPixels < targetPixels) {
      const uint16_t packed = bootLitPixelOrder[bootRevealedPixels++];
      const uint8_t x = unpackPixelX(packed);
      const uint8_t y = unpackPixelY(packed);
      writePixel(bootWorkingBuffer, x, y, true);
    }

    pushBufferToDisplay(bootWorkingBuffer);

    if (elapsed >= BOOT_APPEAR_MS) {
      bootAnimState = BootAnimState::Hold;
      bootAnimStateStartMs = now;
      pushBufferToDisplay(bootTargetBuffer);
    }
    return true;
  }

  if (bootAnimState == BootAnimState::Hold) {
    if (elapsed >= BOOT_HOLD_MS) {
      bootAnimState = BootAnimState::MoveOut;
      bootAnimStateStartMs = now;
    }
    return true;
  }

  if (bootAnimState == BootAnimState::MoveOut) {
    int16_t offset = OLED_HEIGHT;
    if (BOOT_MOVE_OUT_MS > 0) {
      const float t = static_cast<float>(min(elapsed, BOOT_MOVE_OUT_MS)) / static_cast<float>(BOOT_MOVE_OUT_MS);
      const float easeIn = t * t;
      offset = static_cast<int16_t>(lroundf(static_cast<float>(OLED_HEIGHT) * easeIn));
    }
    if (offset != lastMoveOffset) {
      lastMoveOffset = offset;
      renderTargetShiftedUp(offset);
    }

    if (elapsed >= BOOT_MOVE_OUT_MS) {
      bootAnimState = BootAnimState::InterfaceIn;
      bootAnimStateStartMs = now;
      lastMoveOffset = -1;
    }
    return true;
  }

  if (bootAnimState == BootAnimState::InterfaceIn) {
    int16_t yOffset = 0;
    if (UI_MOVE_IN_MS > 0) {
      const float t = static_cast<float>(min(elapsed, UI_MOVE_IN_MS)) / static_cast<float>(UI_MOVE_IN_MS);
      const float easeIn = t * t;
      yOffset = static_cast<int16_t>(lroundf(static_cast<float>(OLED_HEIGHT) * (1.0f - easeIn)));
    }

    drawMainInterfaceFrame(suctionLabel, topLine, fillW, yOffset, socPercent, motorActive, now);

    if (elapsed >= UI_MOVE_IN_MS) {
      bootAnimState = BootAnimState::Done;
      bootAnimStateStartMs = now;
      Serial.println("OLED: boot animation complete");
    }
    return true;
  }

  return false;
}

void formatNumberWithDots(int32_t value, char* buffer, size_t length) {
  char temp[20];
  snprintf(temp, sizeof(temp), "%ld", static_cast<long>(value));

  const size_t len = strlen(temp);
  size_t digitStart = 0;
  if (len > 0 && temp[0] == '-') {
    digitStart = 1;
  }
  const size_t digitLen = len - digitStart;
  if (digitLen <= 3) {
    snprintf(buffer, length, "%s", temp);
    return;
  }

  // First group has 1–3 digits so remaining groups are all triplets (e.g. 16.434, 1.234.567).
  const size_t first = ((digitLen - 1U) % 3U) + 1U;

  char formatted[24];
  size_t out = 0;
  for (size_t i = 0; i < digitStart; ++i) {
    formatted[out++] = temp[i];
  }
  for (size_t i = 0; i < first; ++i) {
    formatted[out++] = temp[digitStart + i];
  }
  for (size_t i = first; i < digitLen; ++i) {
    if ((i - first) % 3U == 0) {
      formatted[out++] = '.';
    }
    formatted[out++] = temp[digitStart + i];
  }
  formatted[out] = '\0';
  snprintf(buffer, length, "%s", formatted);
}

void formatRpmFull(float rpm, bool rpmReady, char* buffer, size_t length) {
  if (!rpmReady) {
    snprintf(buffer, length, "----");
    return;
  }

  if (rpm < 0.0f) {
    rpm = 0.0f;
  }

  const int32_t rpmRounded = static_cast<int32_t>(lroundf(rpm));
  formatNumberWithDots(rpmRounded, buffer, length);
}

void drawBatterySocLabel(int16_t batteryIconRightX, int16_t y, int8_t socPercent, bool motorActive) {
  if (motorActive) {
    return;
  }
  char buf[8];
  if (socPercent < 0) {
    snprintf(buf, sizeof(buf), "--%%");
  } else {
    snprintf(buf, sizeof(buf), "%d%%", static_cast<int>(socPercent));
  }
  oled.setTextSize(1);
  oled.setTextColor(SSD1306_WHITE);
  int16_t x1 = 0;
  int16_t y1 = 0;
  uint16_t w = 0;
  uint16_t h = 0;
  oled.getTextBounds(buf, 0, 0, &x1, &y1, &w, &h);
  const int16_t cx = batteryIconRightX - 2 - static_cast<int16_t>(w);
  oled.setCursor(cx, y);
  oled.print(buf);
}

void drawBatteryIcon(int16_t x, int16_t y, int8_t socPercent, bool motorActive, uint32_t nowMs) {
  constexpr int16_t bodyW = 16;
  constexpr int16_t bodyH = 8;
  constexpr int16_t capW = 2;
  constexpr int16_t capH = 4;

  oled.drawRect(x, y, bodyW, bodyH, SSD1306_WHITE);
  oled.fillRect(x + bodyW, y + 2, capW, capH, SSD1306_WHITE);

  const int16_t innerX = x + 2;
  const int16_t innerY = y + 2;
  const int16_t innerW = bodyW - 4;
  const int16_t innerH = bodyH - 4;
  constexpr int16_t kSegW = 4;

  if (motorActive) {
    // 1px checkerboard while running to make "live load" state obvious.
    for (int16_t dy = 0; dy < innerH; ++dy) {
      for (int16_t dx = 0; dx < innerW; ++dx) {
        if (((dx + dy) & 1) == 0) {
          oled.drawPixel(innerX + dx, innerY + dy, SSD1306_WHITE);
        }
      }
    }
    return;
  }

  if (socPercent < 0) {
    return;
  }

  auto fillSeg = [&](int16_t segIndex) {
    const int16_t sx = innerX + segIndex * kSegW;
    oled.fillRect(sx, innerY, kSegW, innerH, SSD1306_WHITE);
  };

  if (socPercent >= 80) {
    fillSeg(0);
    fillSeg(1);
    fillSeg(2);
  } else if (socPercent >= 30) {
    fillSeg(0);
    fillSeg(1);
  } else if (socPercent >= 15) {
    fillSeg(0);
  } else {
    if (((nowMs / 500U) % 2U) == 0U) {
      fillSeg(0);
    }
  }
}

float getBarFillNow(uint32_t nowMs) {
  if (!barAnimInitialized) {
    return 0.0f;
  }

  if (!barAnimActive) {
    return barAnimTargetFillPx;
  }

  const uint32_t elapsed = nowMs - barAnimStartMs;
  if (elapsed >= BAR_ANIM_MS || BAR_ANIM_MS == 0) {
    barAnimActive = false;
    return barAnimTargetFillPx;
  }

  const float t = static_cast<float>(elapsed) / static_cast<float>(BAR_ANIM_MS);
  const float ease = t * t * (3.0f - 2.0f * t);  // smoothstep
  return barAnimStartFillPx + (barAnimTargetFillPx - barAnimStartFillPx) * ease;
}

void drawMainInterfaceFrame(const char* suctionLabel, const char* topLine, int16_t fillW, int16_t yOffset, int8_t socPercent, bool motorActive, uint32_t nowMs) {
  const int16_t barX = 2;
  const int16_t barY = 21 + yOffset;
  const int16_t barW = 124;
  const int16_t barH = 7;
  const int16_t innerX = barX + 2;
  const int16_t innerY = barY + 2;
  const int16_t innerH = barH - 4;
  constexpr int16_t kBatteryIconX = 108;

  oled.clearDisplay();
  oled.setTextColor(SSD1306_WHITE);
  if (motorActive) {
    oled.setTextSize(1);
    oled.setCursor(2, yOffset + 1);
    oled.print(suctionLabel != nullptr ? suctionLabel : "RPM");
    oled.setTextSize(2);
    oled.setCursor(26, yOffset);
    oled.print(topLine);
  } else {
    oled.setTextSize(2);
    oled.setCursor(2, yOffset);
    oled.print(topLine);
  }
  drawBatterySocLabel(kBatteryIconX, 4 + yOffset, socPercent, motorActive);
  drawBatteryIcon(kBatteryIconX, 4 + yOffset, socPercent, motorActive, nowMs);

  oled.drawRect(barX, barY, barW, barH, SSD1306_WHITE);
  if (fillW > 0) {
    oled.fillRect(innerX, innerY, fillW, innerH, SSD1306_WHITE);
  }
  oled.display();
}

void drawOtaScreen091(uint8_t percent) {
  // OTA UI: blue on blue-filter 0.91" modules = lit pixels (SSD1306 is 1-bit).
  constexpr uint16_t kOtaUiColor = SSD1306_WHITE;
  const uint8_t pct = percent > 100 ? 100 : percent;

  oled.clearDisplay();
  oled.setTextColor(kOtaUiColor);
  oled.setTextSize(2);
  oled.setCursor(2, 0);
  oled.print("Update");
  oled.setTextSize(2);
  char buf[8];
  snprintf(buf, sizeof(buf), "%u%%", static_cast<unsigned>(pct));
  int16_t x1 = 0;
  int16_t y1 = 0;
  uint16_t w = 0;
  uint16_t h = 0;
  oled.getTextBounds(buf, 0, 0, &x1, &y1, &w, &h);
  oled.setCursor(126 - static_cast<int16_t>(w), 0);
  oled.print(buf);
  constexpr int16_t barX = 2;
  constexpr int16_t barY = 24;
  constexpr int16_t barW = 124;
  constexpr int16_t barH = 6;
  constexpr int16_t innerX = barX + 2;
  constexpr int16_t innerY = barY + 2;
  constexpr int16_t innerW = barW - 4;
  constexpr int16_t innerH = barH - 4;
  oled.drawRect(barX, barY, barW, barH, kOtaUiColor);
  const int16_t fillW = (innerW * static_cast<int16_t>(pct)) / 100;
  if (fillW > 0) {
    oled.fillRect(innerX, innerY, fillW, innerH, kOtaUiColor);
  }
  oled.display();
}
}  // namespace

void initDisplayOled() {
  if (oledInitialized) {
    return;
  }

  Serial.printf("OLED: init start (SDA=%u SCL=%u)\n", OLED_SDA_PIN, OLED_SCL_PIN);
  recoverI2CBus(OLED_SDA_PIN, OLED_SCL_PIN);
  Wire.begin(OLED_SDA_PIN, OLED_SCL_PIN, OLED_I2C_CLOCK_HZ);
  Wire.setTimeOut(OLED_I2C_TIMEOUT_MS);
  Serial.printf("OLED: I2C bus initialized @ %luHz timeout=%ums\n", OLED_I2C_CLOCK_HZ, OLED_I2C_TIMEOUT_MS);

  scanI2CBus();

  if (!detectOledAddress()) {
    Serial.printf("OLED not detected on I2C (SDA=%u,SCL=%u), skipping display\n", OLED_SDA_PIN, OLED_SCL_PIN);
    oledInitialized = true;
    oledAvailable = false;
    return;
  }
  Serial.printf("OLED: detected address 0x%02X\n", oledAddress);

  oledAvailable = oled.begin(SSD1306_SWITCHCAPVCC, oledAddress, false, false);
  if (oledAvailable) {
    Serial.println("OLED: init mode SSD1306_SWITCHCAPVCC");
  }

  if (!oledAvailable) {
    // Some boards behave better when initialized as externally powered.
    oledAvailable = oled.begin(SSD1306_EXTERNALVCC, oledAddress, false, false);
    if (oledAvailable) {
      Serial.println("OLED: init mode SSD1306_EXTERNALVCC");
    }
  }

  if (!oledAvailable) {
    Serial.println("OLED: init failed");
    oledInitialized = true;
    return;
  }

  prepareBootAnimation();
  oledInitialized = true;
}

void updateDisplayOled(uint8_t speedPercent, float batteryVoltage, float rpm, bool triggerHeld, bool rpmReady, int8_t batterySocPercent, bool motorActive, bool displayInfoMode, uint8_t displayInfoPage, uint32_t uptimeSeconds, uint32_t freeHeapBytes, uint8_t batterySeriesCells, uint8_t autoOffMinutes, uint8_t sleepTimerMinutes, uint8_t tempLimitC, uint8_t speedStepPct, uint8_t minDutyPct, uint8_t maxDutyPct, uint8_t motorDisplayMode, uint8_t triggerMode, uint8_t ledIdleDisplayMode, uint8_t ledDisplayMode, uint8_t ledDimPercent, uint8_t ledTheme, uint32_t maxStatsRpm, bool maxStatsHasRpm, float maxStatsVoltageV, bool maxStatsHasVoltage, float maxStatsMotorTempC, bool maxStatsHasMotorTemp, float motorTempC, bool motorTemperatureReady, float mcuTempC, bool otaActive, uint8_t otaProgressPercent) {
  if (!oledInitialized || !oledAvailable) {
    return;
  }

  static int8_t lastSocPercent = -127;
  static bool lastMotorActive = false;
  static bool wasInfoMode091 = false;
  static bool wasOta091 = false;
  static uint32_t holdStartMs = 0;

  if (otaActive) {
    bootAnimState = BootAnimState::Done;
    drawOtaScreen091(otaProgressPercent);
    wasOta091 = true;
    return;
  }

  if (wasOta091) {
    wasOta091 = false;
    lastSpeed = 255;
    lastBatteryTenth = INT16_MIN;
    lastTriggerHeld = false;
    lastRpmReady = false;
    lastRpmRounded = INT32_MIN;
    lastBarFillPx = INT16_MIN;
    lastSocPercent = -127;
    lastMotorActive = false;
  }

  if (displayInfoMode) {
    bootAnimState = BootAnimState::Done;
    drawInfoPage091(displayInfoPage, uptimeSeconds, freeHeapBytes, batterySeriesCells, batteryVoltage, batterySocPercent, motorActive, motorTempC, motorTemperatureReady, mcuTempC, autoOffMinutes, sleepTimerMinutes, tempLimitC, speedStepPct, minDutyPct, maxDutyPct, motorDisplayMode, triggerMode, ledIdleDisplayMode, ledDisplayMode, ledDimPercent, ledTheme, maxStatsRpm, maxStatsHasRpm, maxStatsVoltageV, maxStatsHasVoltage, maxStatsMotorTempC, maxStatsHasMotorTemp);
    wasInfoMode091 = true;
    return;
  }

  if (wasInfoMode091) {
    wasInfoMode091 = false;
    lastSpeed = 255;
    lastBatteryTenth = INT16_MIN;
    lastTriggerHeld = false;
    lastRpmReady = false;
    lastRpmRounded = INT32_MIN;
    lastBarFillPx = INT16_MIN;
    lastSocPercent = -127;
    lastMotorActive = false;
  }

  const float normalizedRpm = rpm < 0.0f ? 0.0f : rpm;
  const int32_t rpmRounded = rpmReady ? static_cast<int32_t>(lroundf(normalizedRpm)) : INT32_MIN;
  const int16_t batteryTenth = static_cast<int16_t>(lroundf(batteryVoltage * 10.0f));
  const int16_t motTempTenth = motorTemperatureReady ? static_cast<int16_t>(lroundf(motorTempC * 10.0f)) : INT16_MIN;

  const uint32_t now = millis();

  static uint32_t lastSocBlinkSlot091 = UINT32_MAX;
  static uint8_t lastMotorDisplayMode = 255;
  static int16_t lastMotTempTenth = INT16_MIN;
  const uint32_t blinkSlot091 = now / 500U;
  const bool lowSocBlink091 = !motorActive && batterySocPercent >= 0 && batterySocPercent < 15;
  const bool socBlinkTick091 = lowSocBlink091 && blinkSlot091 != lastSocBlinkSlot091;

  const bool textChanged = speedPercent != lastSpeed ||
      batteryTenth != lastBatteryTenth ||
      triggerHeld != lastTriggerHeld ||
      rpmReady != lastRpmReady ||
      rpmRounded != lastRpmRounded ||
      batterySocPercent != lastSocPercent ||
      motorActive != lastMotorActive ||
      socBlinkTick091 ||
      motorDisplayMode != lastMotorDisplayMode ||
      (motorActive && motTempTenth != lastMotTempTenth);

  char line1[20];
  char rpmBuffer[16];
  formatRpmFull(normalizedRpm, rpmReady, rpmBuffer, sizeof(rpmBuffer));

  const char* suctionLabel = "RPM";
  if (motorActive) {
    holdStartMs = 0;
    switch (motorDisplayMode) {
      case 0:
        suctionLabel = "%";
        snprintf(line1, sizeof(line1), "%u", static_cast<unsigned>(speedPercent));
        break;
      case 1:
        suctionLabel = "V";
        snprintf(line1, sizeof(line1), "%.1f", batteryVoltage);
        break;
      case 2:
        suctionLabel = "RPM";
        if (rpmReady) {
          snprintf(line1, sizeof(line1), "%s", rpmBuffer);
        } else {
          snprintf(line1, sizeof(line1), "----");
        }
        break;
      case 3:
      default:
        suctionLabel = "C";
        if (motorTemperatureReady) {
          snprintf(line1, sizeof(line1), "%.1f", motorTempC);
        } else {
          snprintf(line1, sizeof(line1), "----");
        }
        break;
    }
  } else if (triggerHeld) {
    const uint32_t nowMs = millis();
    if (holdStartMs == 0) {
      holdStartMs = nowMs;
    }
    const uint32_t holdElapsedMs = nowMs - holdStartMs;
    const uint32_t holdThird = TRIGGER_START_HOLD_MS / 3U;
    const uint32_t holdTwoThirds = (2U * TRIGGER_START_HOLD_MS) / 3U;
    if (holdElapsedMs < holdThird) {
      snprintf(line1, sizeof(line1), "Hold.");
    } else if (holdElapsedMs < holdTwoThirds) {
      snprintf(line1, sizeof(line1), "Hold..");
    } else {
      snprintf(line1, sizeof(line1), "Hold...");
    }
  } else {
    holdStartMs = 0;
    snprintf(line1, sizeof(line1), "Start");
  }

  const int16_t barW = 124;
  const int16_t innerW = barW - 4;
  const float targetFillPx = (static_cast<float>(innerW) * static_cast<float>(speedPercent)) / 100.0f;
  if (!barAnimInitialized) {
    barAnimInitialized = true;
    barAnimStartFillPx = targetFillPx;
    barAnimTargetFillPx = targetFillPx;
    barAnimActive = false;
    barAnimStartMs = now;
  } else if (fabsf(targetFillPx - barAnimTargetFillPx) > 0.01f) {
    const float currentFillPx = getBarFillNow(now);
    barAnimStartFillPx = currentFillPx;
    barAnimTargetFillPx = targetFillPx;
    barAnimStartMs = now;
    barAnimActive = true;
  }

  const int16_t fillW = static_cast<int16_t>(lroundf(getBarFillNow(now)));
  const bool barNeedsRedraw = fillW != lastBarFillPx;
  if (renderBootAnimationFrame(suctionLabel, line1, fillW, batterySocPercent, motorActive, now)) {
    lastSpeed = speedPercent;
    lastBatteryTenth = batteryTenth;
    lastTriggerHeld = triggerHeld;
    lastRpmReady = rpmReady;
    lastRpmRounded = rpmRounded;
    lastSocPercent = batterySocPercent;
    lastMotorActive = motorActive;
    lastMotorDisplayMode = motorDisplayMode;
    lastMotTempTenth = motTempTenth;
    lastBarFillPx = fillW;
    if (lowSocBlink091) {
      lastSocBlinkSlot091 = blinkSlot091;
    } else {
      lastSocBlinkSlot091 = UINT32_MAX;
    }
    return;
  }

  if (!textChanged && !barNeedsRedraw) {
    return;
  }

  lastSpeed = speedPercent;
  lastBatteryTenth = batteryTenth;
  lastTriggerHeld = triggerHeld;
  lastRpmReady = rpmReady;
  lastRpmRounded = rpmRounded;
  lastSocPercent = batterySocPercent;
  lastMotorActive = motorActive;
  lastMotorDisplayMode = motorDisplayMode;
  lastMotTempTenth = motTempTenth;
  if (lowSocBlink091) {
    lastSocBlinkSlot091 = blinkSlot091;
  } else {
    lastSocBlinkSlot091 = UINT32_MAX;
  }

  drawMainInterfaceFrame(suctionLabel, line1, fillW, 0, batterySocPercent, motorActive, now);
  lastBarFillPx = fillW;
}

void drawOtaScreenOled(uint8_t percent) {
  if (!oledInitialized || !oledAvailable) {
    return;
  }
  // OTA rendering takes priority; skip boot animation while updating.
  bootAnimState = BootAnimState::Done;
  drawOtaScreen091(percent);
}

void prepareDisplayOledSleep() {
  if (!oledInitialized || !oledAvailable) {
    return;
  }
  oled.clearDisplay();
  oled.display();
  oled.ssd1306_command(SSD1306_DISPLAYOFF);
}

void resumeDisplayOled() {
  if (!oledInitialized || !oledAvailable) {
    return;
  }
  oled.ssd1306_command(SSD1306_DISPLAYON);
  lastSpeed = 255;
  lastBatteryTenth = INT16_MIN;
  lastTriggerHeld = false;
  lastRpmReady = false;
  lastRpmRounded = INT32_MIN;
  lastBarFillPx = INT16_MIN;
  barAnimInitialized = false;
  barAnimActive = false;
  prepareBootAnimation();
}
