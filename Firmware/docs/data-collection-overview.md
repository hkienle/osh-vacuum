# Data Collection Overview — Open Source Vacuum Cleaner

Comprehensive overview of all data the current build can collect — what's measured, what's computed, what's exposed, and what's hidden. Based on firmware source analysis (`Firmware/src/`) and PCB schematic (`Hardware/PCB_Bench_Prototype/`).

---

## 1. Directly Measured Sensor Data

Physical sensors connected to the ESP32-S3 via GPIO or internal peripherals.

| Data Point | Source / Sensor | GPIO | Update Rate | Resolution / Notes | Code Location |
|------------|----------------|------|-------------|---------------------|---------------|
| **Motor RPM** | FG tachometer pulse (ISR) | 16 | 5 Hz (200 ms) | 1 pulse/rev (`PULSES_PER_REV = 1`), ISR counting → Hz → RPM | `tachometer/tachometer.cpp` |
| **Motor temperature** | NTC thermistor 10k, Beta=3950 | 4 | 4 Hz (250 ms) | 8x oversampling, Beta equation, 12-bit ADC (0–4095), `SERIES_R = 10k` | `temperature/temperature.cpp` |
| **Pack voltage** | ADC voltage divider 330k/22k (ratio 16:1) | 6 | 10 Hz (100 ms) | 8x oversampling via `analogReadMilliVolts()`, 2-point calibrated (12V/36V), range 0–60V | `battery/battery.cpp` |
| **Pack voltage (raw)** | Same ADC, pre-calibration | 6 | 10 Hz | Uncalibrated divider output, available via `getBatteryVoltageRaw()` | `battery/battery.cpp:80-82` |
| **MCU die temperature** | ESP32-S3 internal sensor | internal | 2 Hz (500 ms) | `temperatureRead()` (Arduino core), returns °C or `NAN` before first read | `mcu_temp/mcu_temp.cpp` |
| **Battery SOC** | Derived from pack voltage | — | 2 Hz (100 ms sampling) | 21-point Li-ion OCV curve, rolling avg of 50 samples, **paused while motor runs + 2s cooldown** | `battery_soc/battery_soc.cpp` |

### Sensor Calibration Parameters

| Parameter | Value | Location |
|-----------|-------|----------|
| Voltage divider ratio | 330kΩ / 22kΩ = 16.0 | `battery/battery.cpp:7-9` |
| Voltage calibration points | 12.000V → 11.640V, 36.000V → 35.280V | `battery/battery.cpp:12-16` |
| NTC R0 | 10kΩ at 25°C | `temperature/temperature.cpp:15` |
| NTC Beta | 3950 | `temperature/temperature.cpp:17` |
| NTC series resistor | 10kΩ | `temperature/temperature.cpp:9` |
| Tachometer pulses/rev | 1 (configurable) | `tachometer/tachometer.cpp:7` |
| SOC OCV curve | 21 breakpoints, 3.520V (0%) → 4.080V (100%) | `battery_soc/battery_soc.cpp:21-28` |

---

## 2. Computed & Derived Data

Values calculated from sensor inputs, not directly measured.

| Data Point | Derivation | Update Rate | Persisted | Code Location |
|------------|-----------|-------------|-----------|---------------|
| **Battery SOC %** | Pack voltage ÷ series cells → per-cell voltage → OCV curve interpolation → rounded 0–100 | 2 Hz (when motor off) | No (RAM only) | `battery_soc/battery_soc.cpp:128-143` |
| **Max RPM (session)** | Peak RPM while motor active | On motor on/off edge | Yes — NVS key `mstat_rpm` | `maximum_stats/maximum_stats.cpp:106-112` |
| **Max pack voltage (session)** | Peak voltage while motor active | On motor on/off edge | Yes — NVS key `mstat_vf` | `maximum_stats/maximum_stats.cpp:113-117` |
| **Max motor temp (session)** | Peak NTC temp while motor active | On motor on/off edge | Yes — NVS key `mstat_tf` | `maximum_stats/maximum_stats.cpp:118-124` |
| **Calibrated voltage** | Raw ADC → divider scale → 2-point linear correction | 10 Hz | No | `battery/battery.cpp:62-72` |
| **Cell voltage** | Pack voltage ÷ `batterySeriesCells` (1–32) | On SOC sample | No | `battery_soc/battery_soc.cpp:133` |
| **Auto-off elapsed** | `millis() - motorRunStartMs` compared to `autoOffMinutes` | Every loop | No | `main.cpp:128-137` |

---

## 3. Motor & Control State

State of the motor control subsystem (dispatcher with two backends).

| Data Point | Type | Values | Exposed | Code Location |
|------------|------|--------|---------|---------------|
| **Motor active** | bool | true/false | WebSocket JSON, display, serial | `button/button.h:33-34` |
| **Speed setting** | uint8_t | 0–100% (in speed-step increments) | WebSocket JSON, display, serial | `button/button.h:24` |
| **PWM duty** | int | 0–255 | Display telemetry (not WebSocket) | `motor_generic_pwm/motor_generic_pwm.cpp:127-178` |
| **Motor running** | bool | true/false (internal LEDC/ESC state) | Display telemetry | `motor/motor.cpp:82-90` |
| **Motor type** | enum | `GenericPwm` (0) / `XiaomiG` (1) | Display telemetry, settings API | `settings/settings.h:52-55` |
| **Motor capabilities** | struct | `hasRpm`, `isDiscreteSpeed`, `overridesSpeedStep` | Internal only | `motor/motor_driver.h:22-26` |
| **Active driver name** | const char* | "Generic (PWM)" / "Xiaomi G" | Internal only | `motor/motor.cpp:161-166` |
| **RPM available** | bool | true (PWM) / false (Xiaomi-G) | Display telemetry | `motor/motor.cpp:104-120` |
| **Xiaomi-G ESC mode** | enum | Eco (0x01) / Medium (0x02) / High (0x03) | Internal only | `motor_xiaomi_g/xiaomi_g_protocol.h:12-16` |
| **Xiaomi-G cycle phase** | enum | IdleBeforeCtrl / WaitBeforeSetp | Internal only | `motor_xiaomi_g/motor_xiaomi_g.cpp:21-24` |
| **Motor run start time** | uint32_t | `millis()` at motor start | Internal only | `main.cpp:71,80-82` |
| **Speed levels list** | MotorSpeedLevels | 0/20/40/60/80/100% (PWM) or Off/Eco/Mid/Boost (Xiaomi) | Internal only | `motor/motor.cpp:122-128` |

### Per-Backend Differences

| Feature | Generic PWM | Xiaomi G |
|---------|-------------|----------|
| Speed control | Continuous PWM (LEDC, 1kHz, 8-bit) | Discrete ESC modes via UART (9600 8E1) |
| RPM available | Yes (from tachometer) | No (`getRpm()` returns 0.0) |
| Current draw | Not measured | Not parsed (RX frames unimplemented) |
| UART telemetry | N/A | TX only (CTRL + SETP frames sent, RX not read) |

---

## 4. Button & UI State

| Data Point | Type | Values | Exposed | Code Location |
|------------|------|--------|---------|---------------|
| **Trigger pressed** | bool | true/false | Display telemetry | `button/button.h:30` |
| **Speed setting** | uint8_t | 0–100% | WebSocket, display | `button/button.h:24` |
| **Button activity flag** | bool | Set on any edge, cleared by power mgmt | Internal only | `button/button.h:21` |
| **Display info mode** | bool | Menu open/closed | Internal only | `button/button.h:38` |
| **Display info page** | uint8_t | 0–5 info, 6+ settings | Internal only | `button/button.h:39` |
| **Trigger mode** | enum | Hold (0) / DoublePress (1) | Settings API, display | `settings/settings.h:20-23` |

---

## 5. System & Diagnostic Data

| Data Point | Source | Update Rate | Exposed | Code Location |
|------------|--------|-------------|---------|---------------|
| **Free heap** | `ESP.getFreeHeap()` | 4 Hz (250 ms) | Display telemetry only | `main.cpp:168` |
| **Uptime** | `millis() / 1000` | 4 Hz | Display telemetry | `main.cpp:167` |
| **WiFi link role** | `WiFiLinkRole` enum | On change | Internal only | `wifi/wifi.h:16,25` |
| **WiFi IP address** | `WiFi.localIP()` or `WiFi.softAPIP()` | On connect | Serial on boot | `wifi/wifi.cpp` |
| **WiFi RSSI** | `WiFi.RSSI()` | On demand | **Not exposed** (function exists: `getWiFiStaRssiDbm()`) | `wifi/wifi.cpp:85` |
| **WiFi hostname** | `DEVICE_HOSTNAME` | Static | Serial on boot | `wifi/wifi.h:31` |
| **WiFi network name** | SSID (STA) or AP SSID | On connect | Internal only | `wifi/wifi.h:37` |
| **OTA active** | bool | During OTA | Display telemetry | `main.cpp:170` |
| **OTA progress** | uint8_t % | During OTA | Display telemetry, LED bar | `main.cpp:171` |
| **Power/sleep state** | bool (return from `updatePowerManagement`) | Every loop | Internal only | `power/power.cpp:46-83` |
| **Thermal cutoff triggered** | bool | On event | LED blink pattern | `main.cpp:140-145` |
| **Auto-off triggered** | bool | On event | Serial log | `main.cpp:132-136` |

---

## 6. User Settings (NVS-Persisted)

All settings stored in NVS namespace `"oshvac"`. Persisted across reboots, editable via dev menu or WebSocket settings API.

| Key | Type | Range / Values | Default | Code Location |
|-----|------|----------------|---------|---------------|
| `display_type` | String | "0.91-I2C-Waveshare" / "1.5-I2C-Waveshare" / "none" | Compile-time | `settings.cpp:9,24-26` |
| `bat_cells` | UChar | 1–32 (series cell count) | 5 | `settings.cpp:10` |
| `auto_off` | UChar | 0, 1, 2, 5, 10, 30 minutes | 2 | `settings.cpp:11` |
| `sleep_tmr` | UChar | 1, 2, 5, 10, 30 minutes | 2 | `settings.cpp:12` |
| `temp_lim` | UChar | 0 (off) or 30–70°C in 5° steps | 40 | `settings.cpp:13` |
| `spd_step` | UChar | 1, 5, 10, 20, 25 % | 20 | `settings.cpp:14` |
| `min_duty` | UChar | 0–30 % | 0 | `settings.cpp:15` |
| `max_duty` | UChar | 50–100 % (must be > min_duty) | 100 | `settings.cpp:16` |
| `mtr_disp` | UChar | 0=Speed, 1=Volt, 2=RPM, 3=MOT-Temp | 0 | `settings.cpp:17` |
| `trig_mode` | UChar | 0=Hold, 1=DoublePress | 1 | `settings.cpp:18` |
| `led_disp` | UChar | 0=SOC, 1=RPM, 2=Speed, 3=Temp | 2 | `settings.cpp:19` |
| `led_idle` | UChar | 0=SOC, 1=Speed, 2=RPM | 1 | `settings.cpp:20` |
| `led_dim` | UChar | 0–10% (1% steps), 15–50% (5% steps) | 5 | `settings.cpp:21` |
| `led_theme` | UChar | 0=Off, 1=White, 2=Blue, 3=Green, 4=Pink, 5=Orange, 6=Yellow | 1 | `settings.cpp:22` |
| `mtr_type` | UChar | 0=Generic (PWM), 1=Xiaomi G | 0 | `settings.cpp:23` |

**Additional NVS keys (max stats, same namespace):**

| Key | Type | Meaning |
|-----|------|---------|
| `mstat_fl` | UChar | Flags: which max-stats are valid |
| `mstat_rpm` | UInt | Max RPM observed |
| `mstat_vf` | Float | Max pack voltage observed |
| `mstat_tf` | Float | Max motor temp observed |

---

## 7. Data Currently Exposed (Output Channels)

### 7.1 WebSocket Telemetry (4 Hz, port 81, JSON text)

Broadcast every 250 ms to all connected clients:

```json
{
  "temp": 25.50,
  "battery": 18.40,
  "rpm": 30000,
  "speed": 80,
  "motor_active": true,
  "battery_soc": 75
}
```

| Field | Unit | Source |
|-------|------|--------|
| `temp` | °C | Motor NTC thermistor |
| `battery` | V | Calibrated pack voltage |
| `rpm` | RPM | Tachometer (0 if Xiaomi-G) |
| `speed` | % | Speed setting (0–100) |
| `motor_active` | bool | Motor state |
| `battery_soc` | % | 0–100, or -1 if unavailable |

**Code:** `main.cpp:197-225`

### 7.2 Serial Output (4 Hz, 115200 baud)

Same subset as WebSocket, formatted as plain text:
```
Temperature: 25.50 / Battery: 18.40 / RPM: 30000 / Speed: 80%
```

**Code:** `main.cpp:203-207`

### 7.3 Display Telemetry (internal struct, richer than WebSocket)

The `DisplayTelemetry` struct (`display/display.h:6-47`) carries 30+ fields to the OLED rendering layer. **Not broadcast externally.** Includes everything in WebSocket plus:

- MCU temperature, free heap, uptime
- Battery series cells, all settings values, motor type
- Max stats (RPM, voltage, motor temp)
- OTA state, trigger held, display mode/page
- Speed step, min/max duty, trigger mode, LED config

### 7.4 Settings API (WebSocket, on-demand)

Full settings schema + values sent on `get_settings` command or after changes. ~8 KB JSON capacity.

**Code:** `websocket/websocket.cpp:80-101`, `settings_api.cpp`

### 7.5 OLED Display

Renders a subset of `DisplayTelemetry` depending on display mode:
- Speed bar, live sensor value (selectable: Speed/Volt/RPM/MOT-Temp), battery icon, OTA progress

---

## 8. Theoretically Collectible With Current Hardware (No New Components)

Data the ESP32-S3 and existing PCB can provide but that is **not currently exposed or logged**.

### 8.1 System Internals (ESP32 API, no wiring needed)

| Data Point | API Call | Available | Use Case |
|------------|----------|------------|----------|
| **Min free heap since boot** | `ESP.getMinFreeHeap()` | Yes, not used | Detect heap erosion / leaks |
| **Largest free block** | `ESP.getLargestFreeBlock()` | Yes, not used | Detect heap fragmentation |
| **CPU frequency** | `ESP.getCpuFreqMHz()` | Yes, not used | Diagnostic (typically 240 MHz) |
| **Chip revision** | `ESP.getChipRevision()` | Yes, not used | Hardware variant tracking |
| **Flash chip size** | `ESP.getFlashChipSize()` | Yes, not used | Build verification |
| **Flash chip speed** | `ESP.getFlashChipSpeed()` | Yes, not used | Diagnostic |
| **SDK version** | `ESP.getSdkVersion()` | Yes, not used | Build/firmware tracking |
| **Task stack high water mark** | `uxTaskGetStackHighWaterMark(NULL)` | Yes, not used | Detect stack overflow risk |
| **Free PSRAM** | `ESP.getFreePsram()` | Yes (N16R2 has 8MB), not used | Available for larger buffers |

### 8.2 WiFi / Network (functions exist, unused in telemetry)

| Data Point | API Call | Available | Use Case |
|------------|----------|------------|----------|
| **WiFi RSSI** | `getWiFiStaRssiDbm()` — already implemented | Yes, not broadcast | Link quality, range diagnostics |
| **WiFi BSSID** | `WiFi.BSSID()` | Yes, not used | Identify connected AP |
| **WiFi channel** | `WiFi.channel()` | Yes, not used | RF environment |
| **WebSocket client count** | `webSocket.connectedClients()` | Yes, not used | Connection monitoring |

### 8.3 Sensor Enhancements (existing hardware, firmware changes only)

| Data Point | How | Current State | Effort |
|------------|-----|---------------|--------|
| **RPM at higher rate** | Reduce `UPDATE_INTERVAL` from 200ms to 20ms, or switch to ISR timestamp method | 5 Hz, count-over-window | Low — firmware change |
| **Pulse-to-pulse RPM intervals** | Capture `micros()` in ISR, compute RPM from delta | Not implemented | Low — new ISR mode |
| **ADC raw values (pre-averaging)** | Expose individual `analogRead()` samples | Averaged internally | Low — expose in API |
| **ADC noise characterization** | Log raw samples for variance analysis | Not exposed | Low — debug mode |
| **Battery voltage raw** | `getBatteryVoltageRaw()` already exists | Function exists, not broadcast | Trivial — add to JSON |
| **Temperature raw ADC** | Expose `tempAcc / N` before Beta conversion | Not exposed | Low — add getter |

### 8.4 Xiaomi-G RX Telemetry (requires reverse engineering)

| Data Point | Status | Effort |
|------------|--------|--------|
| **ESC status frames** | `0xAC 0x02 ...` frames received on GPIO18 but **not read or parsed** | Medium — RX parser + RE |
| **Motor current / torque** | Unknown if ESC reports this — needs logic analyzer capture | Unknown until RE |
| **ESC RPM** | Unknown if ESC reports this | Unknown until RE |
| **ESC temperature** | Unknown if ESC reports this | Unknown until RE |
| **ESC error flags** | Unknown if ESC reports this | Unknown until RE |
| **RX update rate** | Unknown — needed for watchdog timeout (3× rule) | Measure during RE |

**Note:** GPIO17/18 are both routed on the PCB and accessible on the J5 header. No hardware blocker. But the RX frame format, payload fields, and update rate are completely unknown. This is a standalone reverse-engineering workstream (~2–5 days with logic analyzer).

### 8.5 Internally Available But Not Broadcast

| Data Point | Where | Currently Used |
|------------|-------|----------------|
| PWM duty value (0–255) | `motorGenericPwmGetDuty()` | Internal only, not in WebSocket |
| Motor run duration | `millis() - motorRunStartMs` | Used for auto-off, not exposed |
| Motor capabilities flags | `MotorCapabilities` struct | Used internally for UI gating |
| Speed levels list | `motorGetSpeedLevels()` | Used for button up/down, not exposed |
| Active motor driver name | `motorActiveDriverName()` | Display only |
| Xiaomi-G current ESC mode | `s_currentMode` | Internal only |
| Power management state | `updatePowerManagement()` return | Internal only |

---

## 9. Data Requiring Hardware Expansion

Sensors not present on the current PCB. Listed by ML/bodenerkennung relevance.

### 9.1 High Priority (Roadmap Phase 0–1)

| Sensor | Interface | PCB Status | GPIO Needed | ML Value |
|--------|-----------|------------|-------------|----------|
| **Motor current (INA226)** | I2C (shared with OLED on GPIO 8/9) | Not on PCB; I2C bus on J5 | ALERT pin → GPIO38 (wire solder) | Core feature for floor detection & anomaly detection |
| **IMU / vibration (MPU6050)** | I2C (shared) | Not on PCB; I2C bus on J5 | INT pin → free GPIO (wire solder) | Fallback if current+RPM insufficient for floor classification |

### 9.2 Medium Priority (Future Versions)

| Sensor | Interface | Use Case |
|--------|-----------|----------|
| **Differential pressure sensor** | I2C or analog | Airflow measurement, filter clog detection, suction power estimation |
| **Dust / particle counter** | I2C / UART | Dust concentration, air quality, filter load |
| **Bin fill level** | IR / ultrasonic / capacitive | "Bin full" detection, auto-stop |
| **Ambient temperature** | I2C (e.g., SHTC3) | Separate from motor NTC; contextual data |
| **Humidity sensor** | I2C (e.g., SHTC3, BME280) | Environmental context, condensation risk |

### 9.3 Lower Priority (Specialized)

| Sensor | Interface | Use Case |
|--------|-----------|----------|
| **Brush motor current** | ADC / INA226 | Brush blockage detection (only if brushed head) |
| **Microphone / acoustic** | I2S (ESP32-S3 supports) | Anomaly detection via sound signature (motor whine, blockage rattle) |
| **Load cell (weight)** | HX711 (GPIO) | Dust bin weight, fill estimation |
| **ToF / lidar distance** | I2C (VL53L0X) | Obstacle detection, surface profiling |

### 9.4 PCB Constraints for Expansion

| Constraint | Detail | Impact |
|------------|--------|--------|
| **No free GPIOs on headers** | 16 unused GPIOs exist but none are broken out to J5 | Any new sensor needing an interrupt/ALERT pin requires wire soldering to an ESP32 module pad |
| **I2C bus available** | J5 exposes SDA (GPIO8) + SCL (GPIO9) + 3.3V + GND | INA226, MPU6050, and other I2C sensors can connect via J5 without board mods |
| **SPI bus available** | J5 exposes CS/MOSI/SCK/MISO (GPIO10–13) | Currently unused by firmware, available for SPI sensors |
| **PSRAM available** | ESP32-S3-WROOM-1 N16R2 has 8MB octal PSRAM | Usable for larger ring buffers or data caching (currently unused) |
| **No current sensing** | BOM has no INA226 or shunt | Motor current entirely unavailable on Generic-PWM builds without hardware addition |

---

## 10. Data Quality Assessment

Evaluation of each current data source against general and ML-specific requirements.

| Data Source | Rate | Resolution | Gaps | Assessment |
|-------------|------|------------|------|------------|
| Motor RPM (tachometer) | 5 Hz | 1 pulse/rev → integer RPM at typical speeds | **Too slow for 50 Hz feature sampling.** No signal at very low RPM (count = 0 in window). Xiaomi-G builds have no RPM at all. | Needs upgrade (ISR timestamp method or shorter window) |
| Motor temperature (NTC) | 4 Hz | ~0.1°C practical (12-bit ADC, 8x oversample) | Adequate for thermal protection. Slow thermal response — 4 Hz is sufficient. | Good for safety, limited ML value (too slow for floor changes) |
| Pack voltage | 10 Hz | ~0.05V (calibrated, 8x oversample) | Voltage sag under load could be informative but SOC sampling is **paused during motor run**. Raw voltage available but not logged. | Good rate. Enable logging during motor run for sag/load analysis. |
| Battery SOC | 2 Hz (motor off only) | 1% steps | **No SOC data during motor operation** — 2s cooldown after stop. Not usable for real-time ML. | By design (OCV requires rest). Acceptable for battery health, not for ML features. |
| MCU die temp | 2 Hz | ~1°C | Adequate for thermal monitoring. Correlates with ambient + CPU load. | Low ML value, useful for system health |
| Motor current | — | — | **Not measured at all** on current PCB | Critical gap for ML. Requires INA226 hardware addition. |
| Motor PWM duty | Loop rate | 8-bit (0–255) | Available internally but not exposed in telemetry | Trivial to expose. Useful as control-side feature. |
| Xiaomi-G telemetry | — | — | **RX not parsed** — no current, RPM, or status from ESC | Requires RE workstream. Potential high value if ESC reports current/torque. |

---

## 11. Recommendations for the ML Roadmap

Prioritized actions to improve data availability for the floor-detection and anomaly-detection prototype.

### Tier 1 — Do First (Firmware Only, No Hardware)

| Action | Effort | Impact |
|--------|--------|--------|
| **Expose PWM duty in WebSocket JSON** | Trivial | Adds control-side feature for ML; shows what the controller is commanding |
| **Add `ESP.getMinFreeHeap()` and `ESP.getLargestFreeBlock()` to telemetry** | Trivial | Enables heap erosion/fragmentation detection over 1h test runs |
| **Add WiFi RSSI to telemetry** | Trivial — function `getWiFiStaRssiDbm()` already exists | Connection quality monitoring during data collection |
| **Upgrade tachometer to ISR-timestamp method** | Low (1–2 days) | Enables 50 Hz RPM sampling; much higher resolution for dRPM/dt features |
| **Implement chunked binary logging stream** | Medium (3–5 days) | 50 Hz feature logging without WiFi saturation (160 bytes/chunk at 5 Hz) |
| **Build Xiaomi-G RX parser** | Medium-High (3–7 days incl. RE) | Unlocks current/RPM/status telemetry for Xiaomi-G builds; eliminates feature-vector gap |

### Tier 2 — Hardware Addition (Breadboard / Wire Solder)

| Action | Effort | Impact |
|--------|--------|--------|
| **Add INA226 current sensor on breadboard** | Low hardware, low firmware | Core ML feature: motor current + dI/dt. I2C via J5, ALERT on GPIO38 (wire). |
| **Add MPU6050 IMU on shared I2C** | Low hardware, medium firmware | Vibration features as fallback if current+RPM insufficient for floor classification |

### Tier 3 — Structural Improvements

| Action | Effort | Impact |
|--------|--------|--------|
| **Introduce pre-sleep callback registry in `power/` module** | Low | Clean NVS persistence hook for cluster state before light sleep |
| **Add `[env:native]` PlatformIO build for ML modules** | Medium | Enables Python↔C++ equivalence testing without hardware |
| **Add per-loop timing instrumentation** | Low | Establishes inference budget baseline before ML integration |
| **Expose `battery_voltage_raw` in telemetry** | Trivial | Enables calibration drift detection over time |

### Key Insight

The single highest-impact gap is **motor current measurement** — it is the core feature for both floor detection (load signature per floor type) and anomaly detection (blockage, filter clog). On Generic-PWM builds this requires an INA226 on a breadboard (I2C via J5, ALERT wire to GPIO38). On Xiaomi-G builds, it requires reverse-engineering the RX protocol first. Until one of these is done, the ML prototype cannot produce meaningful floor classification from RPM and temperature alone.
