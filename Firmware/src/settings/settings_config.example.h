#ifndef SETTINGS_CONFIG_H
#define SETTINGS_CONFIG_H

// =============================================================================
// Firmware-Konfiguration (Compile-Time-Defaults)
// =============================================================================
//
// Setup: Diese Datei nach settings_config.h kopieren und Werte anpassen:
//   cp src/settings/settings_config.example.h src/settings/settings_config.h
//
// settings_config.h ist in .gitignore und wird nicht committed.
//
// Hier nur Werte anpassen und neu flashen. Display-/Akkuzellen-Defaults wirken
// beim ersten Start bzw. wenn der NVS-Eintrag fehlt. WLAN, Hostname und OTA
// sind immer Compile-Zeit (jede Änderung = neu bauen und flashen).
//
// Dauerhaft auf dem Gerät gespeicherte Werte (NVS, Namespace "oshvac") überschreiben
// diese Defaults beim Laden – außer der NVS-Eintrag fehlt, dann gilt der Wert von hier.
//
// NVS-Keys (Referenz, normalerweise nicht manuell setzen):
//   display_type  … String, exakt einer der erlaubten DISPLAY_TYPE-Werte unten
//   bat_cells     … Ganzzahl 1–32 (Serien-Zellen des Akkus)
//   auto_off      … 0=Aus, sonst Minuten bis Light-Sleep (1,2,5,10,30)
//   temp_lim      … 0=Aus, sonst °C (50,60,70,80)
//   spd_step      … Speed-Taster-Schritt: 5, 10, 20, 25
//   min_duty      … Mindest-PWM % bei laufendem Motor (0,5,…,30)
//   mtr_disp      … Hauptanzeige bei Motor an: 0=Speed 1=Volt 2=RPM 3=MOT-Temp
//
// Netzwerk & OTA (unten) sind reine Compile-Zeit-Werte — nicht im NVS.
//
// =============================================================================

namespace SettingsConfig {

// -----------------------------------------------------------------------------
// DISPLAY_TYPE  —  OLED-Typ beim ersten Boot / ohne NVS-Eintrag
// -----------------------------------------------------------------------------
// Format: C-String, exakt einer der folgenden Zeichenketten (Groß/Klein beachten).
//
//   "0.91-I2C-Waveshare"   →  0,91" SSD1306, 128×32, I2C (GPIO9 SDA, GPIO8 SCL)
//   "1.5-I2C-Waveshare"    →  1,5" SSD1327, 128×128, I2C (gleiche Pins)
//   "none"                 →  kein Display
//
// -----------------------------------------------------------------------------
constexpr char DEFAULT_DISPLAY_TYPE[] = "0.91-I2C-Waveshare";

// -----------------------------------------------------------------------------
// DEFAULT_BATTERY_SERIES_CELLS  —  Serien-Zellenzahl für SOC-Berechnung
// -----------------------------------------------------------------------------
// Format: Ganzzahl (uint8_t), sinnvoll 1 … 32.
// Bedeutung: Anzahl in Reihe geschalteter Zellen (z. B. 5 für „5S“-Pack).
// Die Ruhespannung des Packs wird durch diese Zahl geteilt und mit der
// Einzell-Kennlinie in battery_soc.cpp auf 0–100 % gemappt.
//
// -----------------------------------------------------------------------------
constexpr uint8_t DEFAULT_BATTERY_SERIES_CELLS = 5;

// -----------------------------------------------------------------------------
// Runtime defaults (NVS overrides when present)
// -----------------------------------------------------------------------------
constexpr uint8_t DEFAULT_AUTO_OFF_MINUTES = 2;       // 0 = sleep off
constexpr uint8_t DEFAULT_SLEEP_TIMER_MINUTES = 2;   // 1, 2, 5, 10, 30
constexpr uint8_t DEFAULT_TEMP_LIMIT_C = 0;         // 0 = off
constexpr uint8_t DEFAULT_SPEED_STEP_PERCENT = 20;    // 5, 10, 20, or 25
constexpr uint8_t DEFAULT_MIN_DUTY_PERCENT = 0;     // 0–30, step 5
constexpr uint8_t DEFAULT_MOTOR_DISPLAY_MODE = 2;   // 0=Speed 1=Volt 2=RPM 3=MOT-Temp
constexpr uint8_t DEFAULT_TRIGGER_MODE = 0;         // 0=Hold 1=Double-Press

// -----------------------------------------------------------------------------
// STANDBY_TIMEOUT_MS  —  Inaktivitätszeit bis Light-Sleep
// -----------------------------------------------------------------------------
// Format: Millisekunden (uint32_t). 120000 = 120s.
// Bedingung für Sleep bleibt: keine Tasteraktivität, Motor aus, kein OTA-Update.
constexpr uint32_t STANDBY_TIMEOUT_MS = 120000UL;

// -----------------------------------------------------------------------------
// Netzwerk (WLAN) & Gerätename  —  nur Build-Zeit, kein NVS
// -----------------------------------------------------------------------------
// STA: Zugangsdaten für den Heim-/Lab-Router. Bei Fehlschlag startet die
// Firmware den Soft-AP mit WIFI_AP_SSID / WIFI_AP_PASSWORD.
//
// DEVICE_HOSTNAME: WiFi-Hostname (ESP32) und mDNS-Name ohne „.local“
// (Erreichbarkeit im Browser: http://<DEVICE_HOSTNAME>.local).
// Nur gültige DNS-Hostnamen-Zeichen (a–z, 0–9, Bindestrich), max. sinnvoll ≤ 32.
//
// -----------------------------------------------------------------------------
constexpr char WIFI_STA_SSID[] = "YOUR WIFI SSID";
constexpr char WIFI_STA_PASSWORD[] = "YOUR WIFI PASSWORD";
constexpr char WIFI_AP_SSID[] = "OSH_VAC";
constexpr char WIFI_AP_PASSWORD[] = "OpenSource";
constexpr char DEVICE_HOSTNAME[] = "osh-vac";

// -----------------------------------------------------------------------------
// ArduinoOTA (Wireless-Upload über PlatformIO espota)  —  nur Build-Zeit
// -----------------------------------------------------------------------------
// Nur ein Passwort (kein Benutzername). Muss exakt zu platformio.ini
// [env:esp32-s3-ota] upload_flags --auth=... passen (siehe README → OTA).
// Name OTA_HTTP_PASSWORD ist historisch; es ist das ArduinoOTA-Passwort.
constexpr char OTA_HTTP_PASSWORD[] = "OpenSource";

}  // namespace SettingsConfig

#endif  // SETTINGS_CONFIG_H
