#include <Arduino.h>
#include <stdio.h>
#include "wifi.h"
#include "wifi_credentials.h"
#include "led/led.h"
#include "settings/settings_config.h"
#include <ESPmDNS.h>

namespace {
char g_sta_ssid[WIFI_STA_SSID_MAX + 1];
char g_sta_password[WIFI_STA_PASSWORD_MAX + 1];
}  // namespace

const char* wifi_ssid = g_sta_ssid;
const char* wifi_password = g_sta_password;

const char* ap_ssid = SettingsConfig::DEVICE_HOSTNAME;
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

void loadStaCredentials() {
  wifiCredentialsLoad(g_sta_ssid, sizeof(g_sta_ssid), g_sta_password, sizeof(g_sta_password));
}

bool waitForStaConnection(uint32_t timeoutMs) {
  unsigned long startTime = millis();
  unsigned long lastDotTime = 0;

  while (millis() - startTime < timeoutMs) {
    yield();

    if (WiFi.status() == WL_CONNECTED) {
      return true;
    }

    if (millis() - lastDotTime >= 500) {
      Serial.print(".");
      lastDotTime = millis();
    }
  }
  Serial.println();
  return WiFi.status() == WL_CONNECTED;
}

void configureStaSuccess() {
  Serial.println("WiFi connected successfully!");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());

  WiFi.setHostname(SettingsConfig::DEVICE_HOSTNAME);
  if (MDNS.begin(SettingsConfig::DEVICE_HOSTNAME)) {
    Serial.printf("mDNS started: %s.local\n", SettingsConfig::DEVICE_HOSTNAME);
  } else {
    Serial.println("Error starting mDNS");
  }
}

bool startAccessPoint() {
  Serial.println("Starting Access Point...");

  WiFi.disconnect(true);
  WiFi.mode(WIFI_AP);
  const bool result = WiFi.softAP(ap_ssid, ap_password);

  if (result) {
    Serial.println("WiFi AP started successfully!");
    Serial.print("SSID: ");
    Serial.println(ap_ssid);
    Serial.print("IP address: ");
    Serial.println(WiFi.softAPIP());
  } else {
    Serial.println("Failed to start WiFi AP!");
  }
  return result;
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
  setLEDColor(0, 0, 0);
  setLEDPattern(LED_OFF);
  updateLED();

  loadStaCredentials();

  const bool probePending = wifiCredentialsIsProbePending();
  const uint32_t connectTimeout =
      probePending ? WIFI_PROVISION_CONNECT_TIMEOUT_MS : WIFI_STA_CONNECT_TIMEOUT_MS;

  Serial.println("Attempting to connect to WiFi...");
  Serial.print("SSID: ");
  Serial.println(wifi_ssid);

  WiFi.mode(WIFI_STA);
  WiFi.begin(wifi_ssid, wifi_password);

  const bool connected = waitForStaConnection(connectTimeout);

  if (connected) {
    wifiCredentialsClearProbePending();
    configureStaSuccess();
  } else {
    if (probePending) {
      wifiCredentialsClearProbePending();
      Serial.println("Provisioned WiFi connection failed — returning to Access Point.");
    } else {
      Serial.println("WiFi connection failed.");
    }
    startAccessPoint();
  }

  setLEDColor(0, 0, 0);
  setLEDPattern(LED_OFF);
  updateLED();
}
