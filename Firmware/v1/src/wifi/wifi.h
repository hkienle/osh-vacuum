#ifndef WIFI_H
#define WIFI_H

#include <WiFi.h>
#include <stddef.h>

// WiFi credentials (pointers into strings from settings_config.h)
extern const char* wifi_ssid;
extern const char* wifi_password;

// Access Point credentials
extern const char* ap_ssid;
extern const char* ap_password;

/// STA connected to an AP, or running as soft-AP (including AP_STA while AP is up).
enum class WiFiLinkRole : uint8_t { None, Sta, AccessPoint };

// Setup WiFi - tries to connect first, falls back to AP mode
void setupWiFi();

// True when the network stack can bind sockets (STA linked or AP started).
bool isWiFiStackReady();

// STA if connected; else AP if soft-AP is active; else None.
WiFiLinkRole getWiFiLinkRole();

// IPv4 of STA or soft-AP, whichever is active for the current role (dot-decimal).
void getWiFiActiveIpString(char* out, size_t outLen);

// Device hostname (e.g. osh-vac), or empty if unavailable.
void getWiFiHostnameString(char* out, size_t outLen);

// STA connected: writes RSSI in dBm. Returns false in AP mode or when not associated.
bool getWiFiStaRssiDbm(int8_t* outDbm);

// STA: associated SSID; AP: AP SSID. Truncated to outLen-1.
void getWiFiNetworkNameForDisplay(char* out, size_t outLen);

// One-line summary for Serial after setup (tag defaults to "[BOOT]").
void printNetworkSummaryToSerial(const char* tag = "[BOOT]");

#endif  // WIFI_H
