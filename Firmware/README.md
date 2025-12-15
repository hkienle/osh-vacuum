# Firmware for Open Source Vacuum Cleaner

Firmware for the ESP32-S3 based control board for high RPM impeller vacuum machines. This firmware provides motor control, monitoring, WiFi connectivity, and a web-based user interface.

## Overview

The firmware runs on an ESP32-S3 microcontroller and provides:

- **Motor Control**: PWM-based speed control (0-100%) with high-side switching via Infineon ProFet
- **Monitoring**: Real-time RPM, temperature, and battery voltage monitoring
- **User Interface**: 5 RGB LEDs (WS2812B) and 3 customizable buttons
- **Connectivity**: WiFi access point and web server with WebSocket support
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
- **I2C**: Available on breakout pins
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
│   ├── button/            # Button handling (trigger, up, down)
│   ├── led/               # RGB LED control (WS2812B)
│   ├── motor_pwm/         # Motor PWM control
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

### User Interface
- **LEDs**: 5 WS2812B RGB LEDs with multiple patterns:
  - Static color
  - Blink
  - Pulse
  - Speed display mode (shows current speed setting)
- **Buttons**: 
  - Trigger: Start/stop motor
  - Up/Down: Adjust speed in 20% increments

### Web Interface
- Real-time data visualization
- Motor control via web interface
- WebSocket communication for live updates
- Responsive React-based UI

## Libraries Used

- **FastLED** (v3.6.0): RGB LED control
- **ArduinoJson** (v6.21.3): JSON parsing
- **WebSockets** (v2.4.1): WebSocket server
- **ESPAsyncWebServer** (v3.8.1): Async HTTP server
- **AsyncTCP** (v3.4.9): Async TCP library

## Configuration

### WiFi
The board creates a WiFi access point. Default credentials can be configured in the WiFi module.

### Calibration
- **Battery Voltage**: Calibration points can be adjusted in `battery.cpp`
- **Temperature**: Thermistor parameters (R0, Beta) can be adjusted in `temperature.cpp`
- **Tachometer**: Pulses per revolution can be configured in `tachometer.cpp`

## Troubleshooting

### Upload Issues
- Ensure USB-C cable supports data transfer (not just charging)
- Check that the correct COM port is selected
- Try holding the BOOT button during upload

### Frontend Not Loading
- Verify filesystem was uploaded: `pio run --target uploadfs`
- Check serial monitor for filesystem mount errors
- Ensure `data/` folder contains built frontend files

### Serial Monitor
- Default baud rate: 115200
- Use `pio device monitor` to view debug output

## License

This firmware is part of the Open Source Vacuum Cleaner project.

