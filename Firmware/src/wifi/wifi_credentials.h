#ifndef WIFI_CREDENTIALS_H
#define WIFI_CREDENTIALS_H

#include <stddef.h>
#include <stdint.h>

constexpr size_t WIFI_STA_SSID_MAX = 32;
constexpr size_t WIFI_STA_PASSWORD_MAX = 63;

/** Load STA credentials: NVS when saved, else compile-time defaults from settings_config.h. */
void wifiCredentialsLoad(char* ssidOut, size_t ssidLen, char* passOut, size_t passLen);

/** Persist STA credentials to NVS (overrides compile-time defaults on next boot). */
bool wifiCredentialsSave(const char* ssid, const char* password);

/** True after set_wifi until a successful STA connect clears the flag. */
bool wifiCredentialsIsProbePending();

/** Mark that the next boot should use a longer STA connect timeout. */
void wifiCredentialsSetProbePending();

/** Clear probe flag after successful STA association. */
void wifiCredentialsClearProbePending();

#endif  // WIFI_CREDENTIALS_H
