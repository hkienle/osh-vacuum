#ifndef WIFI_H
#define WIFI_H

#include <WiFi.h>

// WiFi credentials
extern const char* wifi_ssid;
extern const char* wifi_password;

// Access Point credentials
extern const char* ap_ssid;
extern const char* ap_password;

// Setup WiFi - tries to connect first, falls back to AP mode
void setupWiFi();

#endif // WIFI_H

