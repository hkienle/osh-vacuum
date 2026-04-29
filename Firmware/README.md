# OSH Vacuum — Firmware

ESP32-S3 firmware for open-source high-RPM impeller vacuum machines.

→ **[Setup Guide](Setup.md)** — install, configure, build and flash  
→ **[Usage Guide](usage.md)** — operate the device, change settings

---

## What this firmware does

- **Motor control** — PWM-based speed control (0–100%) with ProFet high-side switching, configurable speed steps and minimum duty floor.
- **Two trigger modes** — Hold (hold-to-start, tap-to-stop) or Double-Press (momentary + latch).
- **Safety** — Automatic motor cutoff after a configurable runtime limit and on NTC over-temperature.
- **Sensors** — Real-time RPM (tachometer), motor NTC temperature, pack voltage, battery SOC, and ESP32 internal die temperature.
- **Battery SOC** — Rolling OCV-curve estimation from pack voltage ÷ series cell count. Paused while motor runs.
- **OLED display** — Supports 0.91" (SSD1306, 128×32) and 1.5" (SSD1327, 128×128) Waveshare I2C modules. Shows speed bar, live sensor value, battery icon, and OTA progress overlay.
- **LED strip** — 5 × WS2812B indicate WiFi status on boot, then display speed tier (blue = idle, red = motor active).
- **Dev / Settings menu** — 13-page on-device menu (hold UP+DOWN) with status pages and all configurable parameters. Settings persist in NVS.
- **WiFi** — STA mode with soft-AP fallback. mDNS via configurable hostname.
- **Web interface** — React SPA served from LittleFS on port 80. Real-time control and monitoring.
- **WebSocket telemetry** — JSON broadcast on port 81 at ~4 Hz (temp, battery, RPM, speed, motor state, SOC).
- **OTA updates** — ArduinoOTA (espota) for wireless firmware flashing via PlatformIO.
- **Light sleep** — Automatic power-saving after configurable inactivity timeout; wake on any button.

---

## Hardware at a glance

| GPIO | Function |
|------|----------|
| 4 | Motor NTC thermistor (ADC) |
| 5 | Motor PWM output (LEDC, 1 kHz, 8-bit) |
| 6 | Battery voltage ADC (330 kΩ / 22 kΩ divider) |
| 7 | MOSFET / ProFet enable |
| 8 | I2C SCL (OLED) |
| 9 | I2C SDA (OLED) |
| 16 | Tachometer FG input (interrupt) |
| 39 | WS2812B LED data (5 LEDs) |
| 40 | Button DOWN |
| 41 | Button UP |
| 42 | Button TRIGGER |

---

## Project structure

```
Firmware/
├── platformio.ini                    # Build environments
├── data/                             # LittleFS contents (built web UI)
├── ui/                               # React frontend source
└── src/
    ├── main.cpp                      # Setup, loop, telemetry, safety
    ├── settings/                     # NVS runtime settings + compile-time config
    ├── motor/                      # Dispatcher + MOTOR_DRIVERS.md
    ├── motor_generic_pwm/          # LEDC PWM (default backend)
    ├── motor_xiaomi_g/             # Xiaomi G ESC: xiaomi_g_protocol, xiaomi_g_uart, driver
    ├── button/                       # Debounced inputs, trigger modes, dev menu
    ├── led/                          # WS2812B FastLED patterns
    ├── display/                      # Display facade + telemetry struct
    ├── display_oled/                 # SSD1306 128×32 rendering
    ├── display_waveshare_091_i2c/    # Adapter → display_oled
    ├── display_waveshare_15_i2c/     # SSD1327 128×128 rendering
    ├── battery/                      # ADC voltage + calibration
    ├── battery_soc/                  # OCV-based SOC estimation
    ├── temperature/                  # NTC thermistor (beta equation)
    ├── tachometer/                   # FG pulse counting → RPM
    ├── mcu_temp/                     # ESP32 internal die temperature
    ├── wifi/                         # STA/AP, mDNS
    ├── webserver/                    # AsyncWebServer, LittleFS
    ├── websocket/                    # WebSocket server, JSON telemetry
    ├── ota/                          # ArduinoOTA + display overlay
    └── power/                        # Light sleep, GPIO wakeup
```

---

## Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| FastLED | ^3.6.0 | WS2812B control |
| ArduinoJson | ^6.21.3 | JSON |
| WebSockets | ^2.4.1 | WebSocket server |
| ESPAsyncWebServer | ^3.8.1 | HTTP server |
| AsyncTCP | ^3.4.9 | Async TCP |
| ArduinoOTA | built-in | Wireless upload |
| Adafruit SSD1306 | latest | 0.91" OLED driver |
| Adafruit SSD1327 | latest | 1.5" OLED driver |
| Adafruit GFX Library | ^1.12.1 | OLED graphics primitives |

---

## License

Part of the Open Source Vacuum Cleaner project.
