#include <Arduino.h>
#include <stdio.h>
#include "wifi.h"
#include "led/led.h"
#include "settings/settings_config.h"
#include <ESPmDNS.h>

const char* wifi_ssid = SettingsConfig::WIFI_STA_SSID;
const char* wifi_password = SettingsConfig::WIFI_STA_PASSWORD;

const char* ap_ssid = SettingsConfig::WIFI_AP_SSID;
const char* ap_password = SettingsConfig::WIFI_AP_PASSWORD;

namespace {

bool softApIsUp() {
  const wifi_mode_t mode = WiFi.getMode();
  if (mode != WIFI_AP && mode != WIFI_AP_STA) {
    return false;
  }
  const IPAddress apIp = WiFi.softAPIP();
  return apIp != IPAddress(0, 0, 0, 0);
}

}  // namespace

bool isWiFiStackReady() {
  if (WiFi.status() == WL_CONNECTED) {
    return true;
  }
  const wifi_mode_t mode = WiFi.getMode();
  if (mode == WIFI_AP_STA) {
    return softApIsUp();
  }
  if (mode == WIFI_AP) {
    return softApIsUp();
  }
  return false;
}

WiFiLinkRole getWiFiLinkRole() {
  if (WiFi.status() == WL_CONNECTED) {
    return WiFiLinkRole::Sta;
  }
  if (softApIsUp()) {
    return WiFiLinkRole::AccessPoint;
  }
  return WiFiLinkRole::None;
}

void getWiFiActiveIpString(char* out, size_t outLen) {
  if (!out || outLen == 0) {
    return;
  }
  out[0] = '\0';
  const WiFiLinkRole role = getWiFiLinkRole();
  IPAddress ip(0, 0, 0, 0);
  if (role == WiFiLinkRole::Sta) {
    ip = WiFi.localIP();
  } else if (role == WiFiLinkRole::AccessPoint) {
    ip = WiFi.softAPIP();
  }
  snprintf(out, outLen, "%d.%d.%d.%d", ip[0], ip[1], ip[2], ip[3]);
}

void getWiFiHostnameString(char* out, size_t outLen) {
  if (!out || outLen == 0) {
    return;
  }
  const char* hn = WiFi.getHostname();
  if (hn != nullptr && hn[0] != '\0') {
    snprintf(out, outLen, "%s", hn);
  } else {
    snprintf(out, outLen, "%s", SettingsConfig::DEVICE_HOSTNAME);
  }
}

bool getWiFiStaRssiDbm(int8_t* outDbm) {
  if (!outDbm) {
    return false;
  }
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }
  *outDbm = static_cast<int8_t>(WiFi.RSSI());
  return true;
}

void getWiFiNetworkNameForDisplay(char* out, size_t outLen) {
  if (!out || outLen == 0) {
    return;
  }
  out[0] = '\0';
  const WiFiLinkRole role = getWiFiLinkRole();
  if (role == WiFiLinkRole::Sta) {
    const String s = WiFi.SSID();
    snprintf(out, outLen, "%s", s.c_str());
    return;
  }
  if (role == WiFiLinkRole::AccessPoint) {
    snprintf(out, outLen, "%s", ap_ssid);
  }
}

void printNetworkSummaryToSerial(const char* tag) {
  const char* t = (tag != nullptr && tag[0] != '\0') ? tag : "[BOOT]";
  char ip[20];
  getWiFiActiveIpString(ip, sizeof(ip));

  switch (getWiFiLinkRole()) {
    case WiFiLinkRole::Sta:
      Serial.printf("%s Mode=STA IP=%s\n", t, ip);
      break;
    case WiFiLinkRole::AccessPoint:
      Serial.printf("%s Mode=AP IP=%s SSID=%s\n", t, ip, ap_ssid);
      break;
    default:
      Serial.printf("%s Mode=NONE (no IP)\n", t);
      break;
  }
}

void setupWiFi() {
  // Set LED to pulse white at half brightness during WiFi setup
  setLEDColor(128, 128, 128); // White at half brightness
  setLEDPattern(LED_PULSE);
  setLEDSpeed(2000); // 2 second pulse cycle for smooth animation
  
  Serial.println("Attempting to connect to WiFi...");
  Serial.print("SSID: ");
  Serial.println(wifi_ssid);
  
  // Try to connect to WiFi
  WiFi.mode(WIFI_STA);
  WiFi.begin(wifi_ssid, wifi_password);
  
  // Wait for connection for up to 10 seconds (non-blocking)
  unsigned long startTime = millis();
  unsigned long lastDotTime = 0;
  bool connected = false;
  
  while (millis() - startTime < 10000) { // 10 second timeout
    updateLED(); // Update LED continuously for smooth pulse
    
    if (WiFi.status() == WL_CONNECTED) {
      connected = true;
      break;
    }
    
    // Print dot every 500ms
    if (millis() - lastDotTime >= 500) {
      Serial.print(".");
      lastDotTime = millis();
    }
    
    // No delay needed - updateLED() handles timing, and WiFi.status() is non-blocking
  }
  Serial.println();
  
  if (connected || WiFi.status() == WL_CONNECTED) {
    Serial.println("WiFi connected successfully!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
    
    WiFi.setHostname(SettingsConfig::DEVICE_HOSTNAME);
    if (MDNS.begin(SettingsConfig::DEVICE_HOSTNAME)) {
      Serial.printf("mDNS started: %s.local\n", SettingsConfig::DEVICE_HOSTNAME);
    } else {
      Serial.println("Error starting mDNS");
    }
    
    // Set LED to solid blue when connected to WiFi
    setLEDColor(0, 0, 255); // Blue
    setLEDPattern(LED_STATIC);
  } else {
    Serial.println("WiFi connection failed. Starting Access Point...");
    
    // Create WiFi access point
    WiFi.mode(WIFI_AP);
    bool result = WiFi.softAP(ap_ssid, ap_password);
    
    if (result) {
      Serial.println("WiFi AP started successfully!");
      Serial.print("SSID: ");
      Serial.println(ap_ssid);
      Serial.print("IP address: ");
      Serial.println(WiFi.softAPIP());
      
      // Set LED to solid orange when in AP mode
      setLEDColor(255, 140, 0); // Orange
      setLEDPattern(LED_STATIC);
    } else {
      Serial.println("Failed to start WiFi AP!");
      // Keep LED as is if AP failed
    }
  }
}

