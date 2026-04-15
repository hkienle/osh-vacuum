# Firmware for Open Source Vacuum Cleaner

Firmware for the ESP32-S3 based control board for high RPM impeller vacuum machines. This firmware provides motor control, monitoring, WiFi connectivity, and a web-based user interface.

## Overview

The firmware runs on an ESP32-S3 microcontroller and provides:

- **Motor Control**: PWM-based speed control (0-100%) with high-side switching via Infineon ProFet
- **Monitoring**: Real-time RPM, temperature, and battery voltage monitoring
- **User Interface**: 5 RGB LEDs (WS2812B), 3 customizable buttons, and selectable Waveshare OLED displays
- **Connectivity**: WiFi (STA or fallback AP), HTTP server, WebSocket telemetry, and ArduinoOTA (PlatformIO/espota) once WiFi is ready
- **Web Interface**: React-based frontend for remote control and monitoring

## Pin Assignments

### Motor Control
| Function | GPIO | Description |
|----------|------|-------------|
| PWM Output | GPIO 5 | Motor PWM control signal (1 kHz, 8-bit resolution) |
| ProFet Enable | GPIO 7 | High-side switch enable (controls Infineon ProFet) |

### User Interface
| Function | GPIO | Description |
|----------|------|-------------|
| RGB LEDs | GPIO 39 | WS2812B data line (5 LEDs in series) |
| Trigger Button | GPIO 42 | Motor start/stop trigger (pull-up, active low) |
| Up Button | GPIO 41 | Speed increase button (pull-up, active low) |
| Down Button | GPIO 40 | Speed decrease button (pull-up, active low) |

### Monitoring
| Function | GPIO | Description |
|----------|------|-------------|
| Tachometer | GPIO 16 | Frequency generator input (5V tach signal, voltage divided) |
| Battery Voltage | GPIO 6 | Battery voltage monitoring (voltage divided: 330kΩ/22kΩ) |
| Thermistor | GPIO 4 | 10kΩ NTC thermistor reading (10kΩ series resistor) |

### Communication Interfaces (Available for Expansion)
- **I2C**: GPIO 9 (SDA), GPIO 8 (SCL) used for supported OLED displays
- **SPI**: Available on breakout pins
- **UART**: Available on breakout pins
- **Additional GPIOs**: All unused and safe GPIOs are broken out

## Building the Firmware

### Prerequisites

- [PlatformIO](https://platformio.org/) installed (CLI or IDE extension)
- USB-C cable for programming

### Build Steps

1. **Install PlatformIO** (if not already installed):
   ```bash
   pip install platformio
   ```

2. **Navigate to the Firmware directory**:
   ```bash
   cd Firmware
   ```

3. **Build the firmware**:
   ```bash
   pio run
   ```

   Or using PlatformIO CLI directly:
   ```bash
   platformio run
   ```

### Build Configuration

The project uses the following configuration (see `platformio.ini`):
- **Platform**: ESP32-S3
- **Board**: esp32-s3-devkitc-1
- **Framework**: Arduino
- **Filesystem**: LittleFS

## Building the Frontend

The web interface is a React + TypeScript application built with Vite.

### Prerequisites

- Node.js (v18 or later recommended)
- npm or yarn

### Build Steps

1. **Navigate to the UI directory**:
   ```bash
   cd ui
   ```

2. **Install dependencies** (first time only):
   ```bash
   npm install
   ```

3. **Build for ESP32**:
   ```bash
   npm run build:esp32
   ```

   This command:
   - Builds the React application
   - Outputs the production build to `../data/` directory
   - Prepares files for upload to ESP32 filesystem

### Development Mode

For frontend development with hot-reload:

```bash
cd ui
npm run dev
```

This starts a development server (typically at `http://localhost:5173`) for testing the web interface locally.

## Uploading Code and Frontend

### Upload Firmware

1. **Connect the board** via USB-C cable

2. **Upload firmware**:
   ```bash
   pio run --target upload
   ```

   Or using PlatformIO CLI:
   ```bash
   platformio run --target upload
   ```

### Upload Filesystem (Frontend)

After building the frontend, upload the filesystem to the ESP32:

```bash
pio run --target uploadfs
```

Or using PlatformIO CLI:
```bash
platformio run --target uploadfs
```

### Complete Upload (Firmware + Filesystem)

To upload both firmware and filesystem in one command:

```bash
pio run --target upload && pio run --target uploadfs
```

### Monitor Serial Output

To view serial output from the ESP32:

```bash
pio device monitor
```

Or with specific baud rate:
```bash
pio device monitor --baud 115200
```

## Project Structure

```
Firmware/
├── src/                    # Source code
│   ├── main.cpp           # Main application entry point
│   ├── battery/           # Battery voltage monitoring
│   ├── battery_soc/       # Rough SOC % from idle voltage (rolling average + curve)
│   ├── button/            # Button handling (trigger, up, down)
│   ├── led/               # RGB LED control (WS2812B)
│   ├── display/           # Display facade/dispatcher
│   ├── display_oled/      # I2C OLED status display (power %, RPM in k)
│   ├── display_waveshare_091_i2c/ # 0.91" Waveshare backend adapter
│   ├── display_waveshare_15_i2c/  # 1.5" Waveshare SSD1327 I2C backend
│   ├── motor_pwm/         # Motor PWM control
│   ├── settings/          # Runtime settings (NVS-backed)
│   ├── tachometer/        # RPM measurement
│   ├── temperature/       # Thermistor temperature reading
│   ├── webserver/         # HTTP web server
│   ├── websocket/         # WebSocket communication
│   └── wifi/              # WiFi configuration
├── include/               # Header files
├── lib/                   # External libraries
├── data/                  # Frontend build output (uploaded to ESP32)
├── ui/                    # React frontend source code
│   ├── src/               # React components and logic
│   └── package.json       # Frontend dependencies
└── platformio.ini         # PlatformIO configuration
```

## Features

### Motor Control
- Speed control: 0-100% in 20% steps (0%, 20%, 40%, 60%, 80%, 100%)
- High-side switching via Infineon ProFet for ESC control
- PWM frequency: 1 kHz, 8-bit resolution (0-255)
- Automatic motor stop when trigger is released

### Monitoring
- **RPM**: Real-time RPM measurement via tachometer input
- **Temperature**: NTC thermistor reading (10kΩ @ 25°C, Beta = 3950)
- **Battery Voltage**: Voltage monitoring with hardware divider (330kΩ/22kΩ)
- **Battery SOC (display)**: Pack voltage is read every **100 ms** (`battery` module). While the motor is off, that value is pushed every **100 ms** into a **50-sample** rolling average (values are **not** added while the motor runs; averaging resumes **2 s** after stop). SOC uses a **single-cell** voltage curve in `battery_soc`; pack voltage is divided by the configured **series cell count** (default **5**, NVS key `bat_cells`, range 1–32). Interpolation is piecewise-linear between points; result is clamped to **0–100%**. The OLED shows **%** in small text left of the battery icon (`--%` and dashed fill while the motor is on). The battery icon has **3 vertical bars**: all solid from **80–100%**, two from **30–80%**, one from **15–30%**; **0–15%** the **rightmost** bar blinks at **500 ms**

### User Interface
- **LEDs**: 5 WS2812B RGB LEDs with multiple patterns:
  - Static color
  - Blink
  - Pulse
  - Speed display mode (shows current speed setting)
- **OLED Displays** (runtime selectable):
  - `0.91-I2C-Waveshare` (SSD1306, 128x32)
  - `1.5-I2C-Waveshare` (SSD1327, 128x128, I2C mode)
  - Startup diagnostics in serial output for I2C scan and init mode
- **Buttons**: 
  - Trigger: Start/stop motor
  - Up/Down: Adjust speed in 20% increments
  - **Display info mode**: Hold **Up + Down** together for about **3 seconds** to open three status pages (battery, Wi‑Fi mode/IP/SSID, uptime and free heap). **Up** / **Down** cycle pages; **Trigger** exits to the main screen (no motor toggle from the trigger while in this mode).

### Web Interface
- Real-time data visualization
- Motor control via web interface
- WebSocket communication for live updates
- Responsive React-based UI

**WebSocket telemetry (port 81):** The device sends **one JSON object** per broadcast interval (default 250 ms), for example:

`{"temp":23.50,"battery":20.40,"rpm":0,"speed":60,"motor_active":false}`

Field names match the UI: `temp` (°C), `battery` (V), `rpm`, `speed` (0–100), `motor_active`.

### OTA (ArduinoOTA / wireless upload)

After Wi‑Fi is up, the device runs **ArduinoOTA** (ESP-IDF / Arduino). PlatformIO uploads with the **`esp32-s3-ota`** environment (`upload_protocol = espota`).

**Keep these in sync** (same machine / same checkout):

| Source | What to align |
|--------|----------------|
| `src/settings/settings_config.h` | `DEVICE_HOSTNAME` — used as ArduinoOTA hostname and mDNS name (`<name>.local`). |
| `src/settings/settings_config.h` | `OTA_HTTP_PASSWORD` — single password passed to `ArduinoOTA.setPassword()` (no username). |
| `platformio.ini` → `[env:esp32-s3-ota]` | `upload_port` — use `<DEVICE_HOSTNAME>.local` if mDNS works, or the device **IP**. |
| `platformio.ini` → `[env:esp32-s3-ota]` | `upload_flags` — `--auth=<same string as OTA_HTTP_PASSWORD>`. |

**Upload command** (from the `Firmware/` directory, device reachable on the LAN):

```bash
pio run -e esp32-s3-ota -t upload --upload-port <hostname>.local
```

Use `--upload-port` with an IP if mDNS is unreliable. The committed `platformio.ini` defaults match [`settings_config.example.h`](src/settings/settings_config.example.h) (`osh-vac` / `OpenSource`); change **both** the header and `platformio.ini` if you use other values.

**USB upload** (no network): use environment **`esp32-s3`** instead (`pio run -e esp32-s3 -t upload`).

## Libraries Used

- **FastLED** (v3.6.0): RGB LED control
- **ArduinoJson** (v6.21.3): JSON parsing
- **WebSockets** (v2.4.1): WebSocket server
- **ESPAsyncWebServer** (v3.8.1): Async HTTP server
- **AsyncTCP** (v3.4.9): Async TCP library
- **ArduinoOTA** (framework built-in): OTA upload via PlatformIO `espota` protocol
- **Adafruit SSD1306**: 0.91" OLED display driver
- **Adafruit GFX Library**: graphics/text primitives for OLED rendering
- **Adafruit SSD1327**: 1.5" OLED display driver

## Configuration

### Runtime Settings
Runtime configuration is stored in ESP32 NVS (Preferences). A generic settings module is used so additional settings can be added later.

Default values live in:
- `src/settings/settings_config.h` — **start here**: copy from [`settings_config.example.h`](src/settings/settings_config.example.h) on first setup (`cp src/settings/settings_config.example.h src/settings/settings_config.h`), edit constants, reflash. That file is gitignored; the example is heavily commented (German) with allowed values and formats.

Current NVS keys (device may override compile-time defaults after first save):
- `display_type` (string): `0.91-I2C-Waveshare`, `1.5-I2C-Waveshare`, `none`
- `bat_cells` (uint8): number of series cells for SOC mapping (1–32)

Fallback/default when not configured:
- Display: `0.91-I2C-Waveshare` (see `DEFAULT_DISPLAY_TYPE` in `settings_config.example.h`)
- Cells: `5` (`DEFAULT_BATTERY_SERIES_CELLS` in `settings_config.example.h`)

### 1.5" Waveshare I2C Mode Requirement
The 1.5" Waveshare module (SSD1327) is factory-configured for SPI. To use `1.5-I2C-Waveshare`, configure the module hardware for I2C mode (BS1/BS2 strapping) as documented by Waveshare.

### WiFi
The firmware tries **STA** first, then falls back to a **soft-AP** if association fails. **SSID, passwords, device hostname and mDNS name** are configured in `src/settings/settings_config.h` (`WIFI_STA_*`, `WIFI_AP_*`, `DEVICE_HOSTNAME`; template [`settings_config.example.h`](src/settings/settings_config.example.h)). After `setup()`, the serial log includes a **`[BOOT]`** line with **Mode=STA** or **Mode=AP** and the **IP** to use for the web UI and OTA.

The HTTP server and WebSocket server start only when the Wi‑Fi stack is ready (**connected STA** or **AP with a valid soft-AP address**).

### Calibration
- **Battery Voltage**: Calibration points can be adjusted in `battery.cpp`
- **Battery SOC**: Per-cell voltage breakpoints and series-cell handling are in `battery_soc/battery_soc.cpp`; default cell count in `settings_config.h` / [`settings_config.example.h`](src/settings/settings_config.example.h)
- **Temperature**: Thermistor parameters (R0, Beta) can be adjusted in `temperature.cpp`
- **Tachometer**: Pulses per revolution can be configured in `tachometer.cpp`

## Troubleshooting

### Upload Issues
- Ensure USB-C cable supports data transfer (not just charging)
- Check that the correct COM port is selected
- Try holding the BOOT button during upload

### OTA upload fails
- Confirm the device and PC are on the same LAN and Wi‑Fi is up (see `[BOOT]` / serial log for IP).
- Align `DEVICE_HOSTNAME`, `OTA_HTTP_PASSWORD`, `upload_port`, and `--auth` as in the **OTA (ArduinoOTA / wireless upload)** table above; try `--upload-port <device-ip>` if mDNS (`*.local`) does not resolve.
- Rebuild and flash over **USB** (`pio run -e esp32-s3 -t upload`) if OTA auth or network is misconfigured.

### Frontend Not Loading
- Verify filesystem was uploaded: `pio run --target uploadfs`
- Check serial monitor for filesystem mount errors
- Ensure `data/` folder contains built frontend files

### Serial Monitor
- Default baud rate: 115200
- Use `pio device monitor` to view debug output

### OLED Bring-up Diagnostics
Backends log initialization details to serial. Example prefixes:
- `OLED:` for `0.91-I2C-Waveshare`
- `1.5OLED:` for `1.5-I2C-Waveshare`

If no device ACK is detected, firmware continues normal operation without OLED updates.

## License

This firmware is part of the Open Source Vacuum Cleaner project.

