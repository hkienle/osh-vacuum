#include "display_waveshare_15_i2c.h"
#include "../button/button.h"
#include "../settings/dev_menu.h"

#include <Adafruit_GFX.h>
#include <Adafruit_SSD1327.h>
#include <Arduino.h>
#include <Wire.h>
#include "../wifi/wifi.h"
#include <math.h>
#include <stdio.h>
#include <string.h>

namespace {
constexpr uint8_t DISPLAY_I2C_SDA_PIN = 9;
constexpr uint8_t DISPLAY_I2C_SCL_PIN = 8;
constexpr uint32_t DISPLAY_I2C_CLOCK_HZ = 400000;
constexpr uint16_t DISPLAY_I2C_TIMEOUT_MS = 20;
constexpr uint8_t DISPLAY_ADDR_PRIMARY = 0x3D;
constexpr uint8_t DISPLAY_ADDR_SECONDARY = 0x3C;
constexpr uint32_t BAR_ANIM_MS = 220;
constexpr uint32_t DISPLAY_MIN_FRAME_MS = 170;

Adafruit_SSD1327 display(128, 128, &Wire, -1, 400000, 100000);
bool displayInitialized = false;
bool displayAvailable = false;
uint8_t displayAddress = DISPLAY_ADDR_PRIMARY;

uint8_t lastSpeed = 255;
int16_t lastBatteryTenth = INT16_MIN;
int16_t lastTempTenth = INT16_MIN;
bool lastTriggerHeld = false;
bool lastRpmReady = false;
int32_t lastRpmRounded = INT32_MIN;
int16_t lastBarFillPx = INT16_MIN;

bool barAnimInitialized = false;
bool barAnimActive = false;
float barAnimStartFillPx = 0.0f;
float barAnimTargetFillPx = 0.0f;
uint32_t barAnimStartMs = 0;
uint32_t nextFrameAtMs = 0;
bool forceRedrawAfterWake = false;

bool probeAddress(uint8_t address) {
  Wire.beginTransmission(address);
  return Wire.endTransmission() == 0;
}

bool detectDisplayAddress() {
  if (probeAddress(DISPLAY_ADDR_PRIMARY)) {
    displayAddress = DISPLAY_ADDR_PRIMARY;
    return true;
  }
  if (probeAddress(DISPLAY_ADDR_SECONDARY)) {
    displayAddress = DISPLAY_ADDR_SECONDARY;
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
    Serial.printf("1.5OLED: I2C scan found: %s\n", addresses);
  } else {
    Serial.println("1.5OLED: I2C scan found no devices");
  }
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
  display.setTextSize(1);
  display.setTextColor(SSD1327_WHITE);
  int16_t x1 = 0;
  int16_t y1 = 0;
  uint16_t w = 0;
  uint16_t h = 0;
  display.getTextBounds(buf, 0, 0, &x1, &y1, &w, &h);
  const int16_t cx = batteryIconRightX - 2 - static_cast<int16_t>(w);
  display.setCursor(cx, y);
  display.print(buf);
}

void drawBatteryIcon(int16_t x, int16_t y, int8_t socPercent, bool motorActive, uint32_t nowMs) {
  constexpr int16_t bodyW = 18;
  constexpr int16_t bodyH = 10;
  constexpr int16_t capW = 3;
  constexpr int16_t capH = 5;

  display.drawRect(x, y, bodyW, bodyH, SSD1327_WHITE);
  display.fillRect(x + bodyW, y + 2, capW, capH, SSD1327_WHITE);

  const int16_t innerX = x + 2;
  const int16_t innerY = y + 2;
  const int16_t innerW = bodyW - 4;
  const int16_t innerH = bodyH - 4;
  constexpr int16_t kSegW = 4;
  constexpr int16_t kGap = 1;
  const int16_t seg0X = innerX;
  const int16_t seg1X = innerX + kSegW + kGap;
  const int16_t seg2X = innerX + (kSegW + kGap) * 2;

  if (motorActive) {
    // 1px checkerboard while running to make "live load" state obvious.
    for (int16_t dy = 0; dy < innerH; ++dy) {
      for (int16_t dx = 0; dx < innerW; ++dx) {
        if (((dx + dy) & 1) == 0) {
          display.drawPixel(innerX + dx, innerY + dy, SSD1327_WHITE);
        }
      }
    }
    return;
  }

  if (socPercent < 0) {
    return;
  }

  auto fillSegAt = [&](int16_t sx) {
    display.fillRect(sx, innerY, kSegW, innerH, SSD1327_WHITE);
  };

  if (socPercent >= 80) {
    fillSegAt(seg0X);
    fillSegAt(seg1X);
    fillSegAt(seg2X);
  } else if (socPercent >= 30) {
    fillSegAt(seg0X);
    fillSegAt(seg1X);
  } else if (socPercent >= 15) {
    fillSegAt(seg0X);
  } else {
    if (((nowMs / 500U) % 2U) == 0U) {
      fillSegAt(seg0X);
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

void drawInterfaceFrame(const char* suctionLabel, const char* topLine, const char* tempLine, int16_t fillW, int8_t socPercent, bool motorActive, uint32_t nowMs) {
  constexpr int16_t barX = 4;
  constexpr int16_t barY = 108;
  constexpr int16_t barW = 120;
  constexpr int16_t barH = 10;
  constexpr int16_t innerX = barX + 3;
  constexpr int16_t innerY = barY + 2;
  constexpr int16_t innerH = barH - 4;
  constexpr int16_t kBatteryIconX = 102;

  display.clearDisplay();
  display.setTextColor(SSD1327_WHITE);
  if (motorActive) {
    display.setTextSize(1);
    display.setCursor(6, 10);
    display.print(suctionLabel != nullptr ? suctionLabel : "RPM");
    display.setTextSize(3);
    display.setCursor(28, 26);
    display.print(topLine);
  } else {
    display.setTextSize(3);
    display.setCursor(6, 26);
    display.print(topLine);
  }
  display.setTextSize(2);
  display.setCursor(6, 64);
  display.print(tempLine);
  drawBatterySocLabel(kBatteryIconX, 10, socPercent, motorActive);
  drawBatteryIcon(kBatteryIconX, 10, socPercent, motorActive, nowMs);
  display.drawRect(barX, barY, barW, barH, SSD1327_WHITE);
  if (fillW > 0) {
    display.fillRect(innerX, innerY, fillW, innerH, SSD1327_WHITE);
  }
  display.display();
}

void wrapTextToTwoLines(const char* src, char* lineA, size_t lenA, char* lineB, size_t lenB, size_t breakAfter) {
  lineA[0] = '\0';
  lineB[0] = '\0';
  if (!src) {
    return;
  }
  const size_t n = strlen(src);
  if (n <= breakAfter) {
    snprintf(lineA, lenA, "%s", src);
    return;
  }
  size_t cut = breakAfter;
  while (cut > 0 && src[cut] != ' ') {
    --cut;
  }
  if (cut == 0) {
    cut = breakAfter;
  }
  snprintf(lineA, lenA, "%.*s", static_cast<int>(cut), src);
  const char* rest = src + cut;
  while (*rest == ' ') {
    ++rest;
  }
  snprintf(lineB, lenB, "%s", rest);
}

void drawBoldText15(const char* text, int16_t x, int16_t y) {
  display.setCursor(x, y);
  display.print(text);
  display.setCursor(x + 1, y);
  display.print(text);
}

void printRight15(const char* s, int16_t y, uint8_t textSize) {
  display.setTextSize(textSize);
  display.setTextColor(SSD1327_WHITE);
  int16_t x1 = 0;
  int16_t y1 = 0;
  uint16_t w = 0;
  uint16_t h = 0;
  display.getTextBounds(s, 0, 0, &x1, &y1, &w, &h);
  display.setCursor(128 - static_cast<int16_t>(w), y);
  display.print(s);
}

void drawDevSettingPage15(const DevSettingDescriptor& d) {
  char val[48];
  char sub[48];
  display.clearDisplay();
  display.setTextColor(SSD1327_WHITE);
  constexpr int16_t kTitleY = 4;
  constexpr int16_t kSubY = 36;
  display.setTextSize(2);
  drawBoldText15(d.title, 6, kTitleY);
  if (d.formatValue) {
    d.formatValue(val, sizeof(val));
  } else {
    val[0] = '\0';
  }
  printRight15(val, kTitleY, 3);
  display.setTextSize(2);
  display.setCursor(6, kSubY);
  if (d.formatSubline) {
    d.formatSubline(sub, sizeof(sub));
    display.print(sub);
  } else if (d.subline) {
    display.print(d.subline);
  }
  display.display();
}

void drawInfoPage15(uint8_t page, uint32_t uptimeSec, uint32_t freeHeap, uint8_t seriesCells, float batteryVoltage, int8_t socPercent, bool motorActive, float motorTempC, bool motorTemperatureReady, float mcuTempC, uint8_t autoOff, uint8_t sleepTimer, uint8_t tempLim, uint8_t spdStep, uint8_t minDuty, uint8_t maxDuty, uint8_t motorDisp, uint8_t triggerMode, uint8_t ledIdleDisplayMode, uint8_t ledDisplayMode, uint8_t ledDimPercent, uint8_t ledTheme, uint32_t maxStatsRpm, bool maxStatsHasRpm, float maxStatsVoltageV, bool maxStatsHasVoltage, float maxStatsMotorTempC, bool maxStatsHasMotorTemp) {
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

  display.clearDisplay();
  display.setTextColor(SSD1327_WHITE);

  char buf[48];
  char ip[20];
  char hn[40];
  char ssid[48];

  switch (page) {
    case 0:
      display.setTextSize(2);
      drawBoldText15("Maximum Stats", 10, 8);
      display.setTextSize(1);
      display.setCursor(8, 34);
      if (maxStatsHasRpm) {
        snprintf(buf, sizeof(buf), "RPM: %lu", static_cast<unsigned long>(maxStatsRpm));
      } else {
        snprintf(buf, sizeof(buf), "RPM: --");
      }
      display.print(buf);
      display.setCursor(8, 48);
      if (maxStatsHasVoltage) {
        snprintf(buf, sizeof(buf), "Volt.: %.2fV", static_cast<double>(maxStatsVoltageV));
      } else {
        snprintf(buf, sizeof(buf), "Volt.: --");
      }
      display.print(buf);
      display.setCursor(8, 62);
      if (maxStatsHasMotorTemp) {
        snprintf(buf, sizeof(buf), "Temp.: %.1fC", static_cast<double>(maxStatsMotorTempC));
      } else {
        snprintf(buf, sizeof(buf), "Temp.: --");
      }
      display.print(buf);
      display.setCursor(8, 76);
      display.print("Hold trig 2s: clear");
      break;

    case 1:
      display.setTextSize(2);
      drawBoldText15("Battery Info", 14, 8);
      display.setTextSize(1);
      display.setCursor(8, 34);
      snprintf(buf, sizeof(buf), "Series: %u cells", static_cast<unsigned>(seriesCells));
      display.print(buf);
      display.setCursor(8, 48);
      {
        const float cellV = seriesCells > 0 ? (batteryVoltage / static_cast<float>(seriesCells)) : 0.0f;
        snprintf(buf, sizeof(buf), "Volt: %.2fV / %.3fV", batteryVoltage, cellV);
      }
      display.print(buf);
      display.setCursor(8, 62);
      if (motorActive || socPercent < 0) {
        display.print("SOC: --%");
      } else {
        snprintf(buf, sizeof(buf), "SOC: %d%%", static_cast<int>(socPercent));
        display.print(buf);
      }
      break;

    case 2: {
      const bool apMode = getWiFiLinkRole() == WiFiLinkRole::AccessPoint;
      display.setTextSize(2);
      drawBoldText15("WiFi Info", 26, 8);
      display.setTextSize(1);
      getWiFiActiveIpString(ip, sizeof(ip));
      getWiFiNetworkNameForDisplay(ssid, sizeof(ssid));
      display.setCursor(8, 36);
      if (apMode) {
        display.print("SSID: Access-Point");
      } else {
        snprintf(buf, sizeof(buf), "SSID: %s", ssid);
        display.print(buf);
      }
      display.setCursor(8, 52);
      snprintf(buf, sizeof(buf), "IP: %s", ip);
      display.print(buf);
      display.setCursor(8, 66);
      {
        int8_t rssi = 0;
        if (getWiFiStaRssiDbm(&rssi)) {
          snprintf(buf, sizeof(buf), "RSSI: %d dBm", static_cast<int>(rssi));
        } else if (apMode) {
          snprintf(buf, sizeof(buf), "RSSI: AP mode");
        } else {
          snprintf(buf, sizeof(buf), "RSSI: --");
        }
      }
      display.print(buf);
      break;
    }

    case 3:
      display.setTextSize(2);
      drawBoldText15("BLE-Info", 28, 8);
      display.setTextSize(1);
      display.setCursor(8, 40);
      display.print("BLE: OFF");
      display.setCursor(8, 56);
      display.print("Name: n/a");
      display.setCursor(8, 72);
      display.print("Visible: No");
      break;

    case 4:
      display.setTextSize(2);
      drawBoldText15("Sensor Info", 18, 8);
      display.setTextSize(1);
      display.setCursor(8, 36);
      if (motorTemperatureReady) {
        snprintf(buf, sizeof(buf), "MOT Temp: %.1fC", motorTempC);
      } else {
        snprintf(buf, sizeof(buf), "MOT Temp: --.-C");
      }
      display.print(buf);
      display.setCursor(8, 52);
      if (isfinite(mcuTempC)) {
        snprintf(buf, sizeof(buf), "MCU Temp: %.1fC", mcuTempC);
      } else {
        snprintf(buf, sizeof(buf), "MCU Temp: --.-C");
      }
      display.print(buf);
      break;

    case 5: {
      const uint32_t uptimeHours = uptimeSec / 3600U;
      const uint32_t uptimeMin = (uptimeSec % 3600U) / 60U;
      display.setTextSize(2);
      drawBoldText15("System Info", 20, 8);
      display.setTextSize(1);
      getWiFiHostnameString(hn, sizeof(hn));
      display.setCursor(8, 40);
      snprintf(buf, sizeof(buf), "Name: %s", hn);
      display.print(buf);
      display.setCursor(8, 56);
      snprintf(buf, sizeof(buf), "Up since %luh %lum", static_cast<unsigned long>(uptimeHours), static_cast<unsigned long>(uptimeMin));
      display.print(buf);
      display.setCursor(8, 72);
      snprintf(buf, sizeof(buf), "Heap: %lu k", static_cast<unsigned long>((freeHeap + 512U) / 1024U));
      display.print(buf);
      break;
    }

    default:
      if (page >= kDevMenuInfoPageCount) {
        const DevSettingDescriptor* d =
            devMenuVisibleAt(static_cast<size_t>(page - kDevMenuInfoPageCount));
        if (d) {
          drawDevSettingPage15(*d);
        }
      }
      return;
  }
  display.display();
}

void drawOtaScreen15(uint8_t percent) {
  constexpr uint16_t kOtaUiBlueGray = 0xBU;
  const uint8_t pct = percent > 100 ? 100 : percent;

  constexpr int16_t barX = 4;
  constexpr int16_t barY = 100;
  constexpr int16_t barW = 120;
  constexpr int16_t barH = 20;
  constexpr int16_t innerX = barX + 3;
  constexpr int16_t innerY = barY + 3;
  constexpr int16_t innerH = barH - 6;
  constexpr int16_t innerW = barW - 6;

  display.clearDisplay();
  display.setTextColor(kOtaUiBlueGray);
  display.setTextSize(2);
  display.setCursor(6, 4);
  display.print("Update");
  display.setTextSize(3);
  char pctBuf[16];
  snprintf(pctBuf, sizeof(pctBuf), "%u%%", static_cast<unsigned>(pct));
  int16_t x1 = 0;
  int16_t y1 = 0;
  uint16_t w = 0;
  uint16_t h = 0;
  display.getTextBounds(pctBuf, 0, 0, &x1, &y1, &w, &h);
  display.setCursor(122 - static_cast<int16_t>(w), 0);
  display.print(pctBuf);
  display.drawRect(barX, barY, barW, barH, kOtaUiBlueGray);
  const int16_t fillW = (innerW * static_cast<int16_t>(pct)) / 100;
  if (fillW > 0) {
    display.fillRect(innerX, innerY, fillW, innerH, kOtaUiBlueGray);
  }
  display.display();
}
}  // namespace

void initDisplayWaveshare15I2C() {
  if (displayInitialized) {
    return;
  }

  Serial.printf("1.5OLED: init start (SDA=%u SCL=%u)\n", DISPLAY_I2C_SDA_PIN, DISPLAY_I2C_SCL_PIN);
  Wire.begin(DISPLAY_I2C_SDA_PIN, DISPLAY_I2C_SCL_PIN, DISPLAY_I2C_CLOCK_HZ);
  Wire.setTimeOut(DISPLAY_I2C_TIMEOUT_MS);
  Serial.printf("1.5OLED: I2C bus initialized @ %luHz timeout=%ums\n", DISPLAY_I2C_CLOCK_HZ, DISPLAY_I2C_TIMEOUT_MS);

  scanI2CBus();
  if (!detectDisplayAddress()) {
    Serial.printf("1.5OLED: not detected on I2C (SDA=%u,SCL=%u)\n", DISPLAY_I2C_SDA_PIN, DISPLAY_I2C_SCL_PIN);
    displayInitialized = true;
    displayAvailable = false;
    return;
  }
  Serial.printf("1.5OLED: detected address 0x%02X\n", displayAddress);

  displayAvailable = display.begin(displayAddress, false);
  if (!displayAvailable) {
    Serial.println("1.5OLED: init failed");
    displayInitialized = true;
    return;
  }

  display.clearDisplay();
  display.setTextSize(2);
  display.setTextColor(SSD1327_WHITE);
  display.setCursor(12, 52);
  display.print("1.5 OLED READY");
  display.display();
  Serial.println("1.5OLED: init complete");
  nextFrameAtMs = millis();

  displayInitialized = true;
}

void updateDisplayWaveshare15I2C(uint8_t speedPercent, float batteryVoltage, float temperatureC, bool motorTemperatureReady, float mcuTempC, float rpm, bool triggerHeld, bool rpmReady, int8_t batterySocPercent, bool motorActive, bool displayInfoMode, uint8_t displayInfoPage, uint32_t uptimeSeconds, uint32_t freeHeapBytes, uint8_t batterySeriesCells, uint8_t autoOffMinutes, uint8_t sleepTimerMinutes, uint8_t tempLimitC, uint8_t speedStepPercent, uint8_t minDutyPercent, uint8_t maxDutyPercent, uint8_t motorDisplayMode, uint8_t triggerMode, uint8_t ledIdleDisplayMode, uint8_t ledDisplayMode, uint8_t ledDimPercent, uint8_t ledTheme, uint32_t maxStatsRpm, bool maxStatsHasRpm, float maxStatsVoltageV, bool maxStatsHasVoltage, float maxStatsMotorTempC, bool maxStatsHasMotorTemp, bool otaActive, uint8_t otaProgressPercent) {
  if (!displayInitialized || !displayAvailable) {
    return;
  }

  static int8_t lastSocPercent = -127;
  static bool lastMotorActive = false;
  static bool wasInfoMode15 = false;
  static bool wasOta15 = false;
  static uint32_t holdStartMs = 0;
  static uint8_t lastMotorDisplayMode = 255;
  static int16_t lastMotTempTenth = INT16_MIN;

  if (otaActive) {
    drawOtaScreen15(otaProgressPercent);
    wasOta15 = true;
    return;
  }

  if (wasOta15) {
    wasOta15 = false;
    lastSpeed = 255;
    lastBatteryTenth = INT16_MIN;
    lastTempTenth = INT16_MIN;
    lastTriggerHeld = false;
    lastRpmReady = false;
    lastRpmRounded = INT32_MIN;
    lastBarFillPx = INT16_MIN;
    lastSocPercent = -127;
    lastMotorActive = false;
    lastMotorDisplayMode = 255;
    lastMotTempTenth = INT16_MIN;
  }

  if (displayInfoMode) {
    drawInfoPage15(displayInfoPage, uptimeSeconds, freeHeapBytes, batterySeriesCells, batteryVoltage, batterySocPercent, motorActive, temperatureC, motorTemperatureReady, mcuTempC, autoOffMinutes, sleepTimerMinutes, tempLimitC, speedStepPercent, minDutyPercent, maxDutyPercent, motorDisplayMode, triggerMode, ledIdleDisplayMode, ledDisplayMode, ledDimPercent, ledTheme, maxStatsRpm, maxStatsHasRpm, maxStatsVoltageV, maxStatsHasVoltage, maxStatsMotorTempC, maxStatsHasMotorTemp);
    wasInfoMode15 = true;
    return;
  }

  if (wasInfoMode15) {
    wasInfoMode15 = false;
    lastSpeed = 255;
    lastBatteryTenth = INT16_MIN;
    lastTempTenth = INT16_MIN;
    lastTriggerHeld = false;
    lastRpmReady = false;
    lastRpmRounded = INT32_MIN;
    lastBarFillPx = INT16_MIN;
    lastSocPercent = -127;
    lastMotorActive = false;
    lastMotorDisplayMode = 255;
    lastMotTempTenth = INT16_MIN;
  }

  const float normalizedRpm = rpm < 0.0f ? 0.0f : rpm;
  const int32_t rpmRounded = rpmReady ? static_cast<int32_t>(lroundf(normalizedRpm)) : INT32_MIN;
  const int16_t batteryTenth = static_cast<int16_t>(lroundf(batteryVoltage * 10.0f));
  const int16_t tempTenth = static_cast<int16_t>(lroundf(temperatureC * 10.0f));
  const int16_t motTempTenth = motorTemperatureReady ? static_cast<int16_t>(lroundf(temperatureC * 10.0f)) : INT16_MIN;

  const uint32_t now = millis();

  static uint32_t lastSocBlinkSlot15 = UINT32_MAX;
  const uint32_t blinkSlot15 = now / 500U;
  const bool lowSocBlink15 = !motorActive && batterySocPercent >= 0 && batterySocPercent < 15;
  const bool socBlinkTick15 = lowSocBlink15 && blinkSlot15 != lastSocBlinkSlot15;

  const bool textChanged = speedPercent != lastSpeed ||
      batteryTenth != lastBatteryTenth ||
      tempTenth != lastTempTenth ||
      triggerHeld != lastTriggerHeld ||
      rpmReady != lastRpmReady ||
      rpmRounded != lastRpmRounded ||
      batterySocPercent != lastSocPercent ||
      motorActive != lastMotorActive ||
      socBlinkTick15 ||
      motorDisplayMode != lastMotorDisplayMode ||
      (motorActive && motTempTenth != lastMotTempTenth);

  char line1[20];
  char tempLine[20];
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
        snprintf(line1, sizeof(line1), "%.2f", batteryVoltage);
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
          snprintf(line1, sizeof(line1), "%.1f", temperatureC);
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
  snprintf(tempLine, sizeof(tempLine), "T %.1fC", temperatureC);

  constexpr int16_t barW = 120;
  constexpr int16_t innerW = barW - 6;
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
  const bool needsRedraw = forceRedrawAfterWake || textChanged || barNeedsRedraw;
  if (!needsRedraw) {
    return;
  }

  if (now < nextFrameAtMs && !socBlinkTick15) {
    return;
  }

  forceRedrawAfterWake = false;

  lastSpeed = speedPercent;
  lastBatteryTenth = batteryTenth;
  lastTempTenth = tempTenth;
  lastTriggerHeld = triggerHeld;
  lastRpmReady = rpmReady;
  lastRpmRounded = rpmRounded;
  lastSocPercent = batterySocPercent;
  lastMotorActive = motorActive;
  lastMotorDisplayMode = motorDisplayMode;
  lastMotTempTenth = motTempTenth;
  lastBarFillPx = fillW;
  nextFrameAtMs = now + DISPLAY_MIN_FRAME_MS;
  if (lowSocBlink15) {
    lastSocBlinkSlot15 = blinkSlot15;
  } else {
    lastSocBlinkSlot15 = UINT32_MAX;
  }

  drawInterfaceFrame(suctionLabel, line1, tempLine, fillW, batterySocPercent, motorActive, now);
}

void drawOtaScreenWaveshare15(uint8_t percent) {
  if (!displayInitialized || !displayAvailable) {
    return;
  }
  drawOtaScreen15(percent);
}

void prepareDisplayWaveshare15I2CSleep() {
  if (!displayInitialized || !displayAvailable) {
    return;
  }
  display.clearDisplay();
  display.display();
  display.oled_command(SSD1327_DISPLAYOFF);
}

void resumeDisplayWaveshare15I2C() {
  if (!displayInitialized || !displayAvailable) {
    return;
  }
  display.oled_command(SSD1327_DISPLAYON);
  display.clearDisplay();
  display.setTextSize(2);
  display.setTextColor(SSD1327_WHITE);
  display.setCursor(12, 52);
  display.print("1.5 OLED READY");
  display.display();
  lastSpeed = 255;
  lastBatteryTenth = INT16_MIN;
  lastTempTenth = INT16_MIN;
  lastTriggerHeld = false;
  lastRpmReady = false;
  lastRpmRounded = INT32_MIN;
  lastBarFillPx = INT16_MIN;
  barAnimInitialized = false;
  barAnimActive = false;
  forceRedrawAfterWake = true;
  nextFrameAtMs = millis();
}
