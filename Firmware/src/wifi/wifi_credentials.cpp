#include "wifi_credentials.h"

#include "../settings/settings_config.h"

#include <Preferences.h>
#include <string.h>

namespace {
constexpr char kNamespace[] = "oshvac";
constexpr char kKeySsid[] = "wifi_ssid";
constexpr char kKeyPass[] = "wifi_pass";
constexpr char kKeyProbe[] = "wifi_probe";
}  // namespace

void wifiCredentialsLoad(char* ssidOut, size_t ssidLen, char* passOut, size_t passLen) {
  if (!ssidOut || ssidLen == 0 || !passOut || passLen == 0) {
    return;
  }
  ssidOut[0] = '\0';
  passOut[0] = '\0';

  Preferences prefs;
  if (!prefs.begin(kNamespace, true)) {
    strncpy(ssidOut, SettingsConfig::WIFI_STA_SSID, ssidLen - 1);
    strncpy(passOut, SettingsConfig::WIFI_STA_PASSWORD, passLen - 1);
    ssidOut[ssidLen - 1] = '\0';
    passOut[passLen - 1] = '\0';
    return;
  }

  const String ssid = prefs.getString(kKeySsid, "");
  const String pass = prefs.getString(kKeyPass, "");
  prefs.end();

  if (ssid.length() > 0) {
    strncpy(ssidOut, ssid.c_str(), ssidLen - 1);
    strncpy(passOut, pass.c_str(), passLen - 1);
  } else {
    strncpy(ssidOut, SettingsConfig::WIFI_STA_SSID, ssidLen - 1);
    strncpy(passOut, SettingsConfig::WIFI_STA_PASSWORD, passLen - 1);
  }
  ssidOut[ssidLen - 1] = '\0';
  passOut[passLen - 1] = '\0';
}

bool wifiCredentialsSave(const char* ssid, const char* password) {
  if (ssid == nullptr || ssid[0] == '\0') {
    return false;
  }
  if (password == nullptr) {
    password = "";
  }

  Preferences prefs;
  if (!prefs.begin(kNamespace, false)) {
    return false;
  }
  const bool ok = prefs.putString(kKeySsid, ssid) > 0 && prefs.putString(kKeyPass, password) >= 0;
  prefs.end();
  return ok;
}

bool wifiCredentialsIsProbePending() {
  Preferences prefs;
  if (!prefs.begin(kNamespace, true)) {
    return false;
  }
  const bool pending = prefs.getUChar(kKeyProbe, 0) != 0;
  prefs.end();
  return pending;
}

void wifiCredentialsSetProbePending() {
  Preferences prefs;
  if (!prefs.begin(kNamespace, false)) {
    return;
  }
  prefs.putUChar(kKeyProbe, 1);
  prefs.end();
}

void wifiCredentialsClearProbePending() {
  Preferences prefs;
  if (!prefs.begin(kNamespace, false)) {
    return;
  }
  prefs.putUChar(kKeyProbe, 0);
  prefs.end();
}
