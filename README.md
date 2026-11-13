# Open Source Vacuum Cleaner

> **📝 Note:** This repository is currently being populated with information. Content and documentation are being added progressively.

---

## About

This repository contains the Open Source Vacuum Cleaner project, an open-source hardware and software solution for building custom vacuum cleaners. The project includes complete PCB designs, ESP32-S3 based firmware, and a web-based control interface.

The system is designed to control high RPM impellers for vacuum machines, featuring motor control, real-time monitoring (RPM, temperature, battery voltage), WiFi connectivity, and a modern web interface.

## Project Structure

```
osh-vacuum/
├── Hardware/                  # PCB designs and hardware documentation
│   ├── v1/                    # Benchtop prototype board (V1)
│   │   ├── README.md          # Hardware documentation and BOM
│   │   └── Production/        # Manufacturing files
│   └── v2/                    # V2 electronics (KiCad 10)
│       ├── README.md          # Overview, cabling, commit marking
│       ├── Main PCB/          # Control board, JLCPCB data in Production/
│       └── HMI PCB/           # Breakaway LED strips and buttons, JLCPCB data in Production/
├── Firmware/                  # ESP32-S3 firmware
│   ├── v1/                    # Firmware for hardware V1 (with React web interface in ui/)
│   └── v2/                    # Firmware for hardware V2 (not started yet)
└── README.md                  # This file
```

### Hardware

**V1 – benchtop prototype**
- ESP32-S3 microcontroller with WiFi and BLE
- Motor control with Infineon ProFet for high-side switching
- 5 RGB LEDs (WS2812B) and 3 customizable buttons
- Battery voltage monitoring (15-32V input)
- Temperature monitoring via thermistor
- Tachometer input for RPM measurement
- Break-off sections for flexible form factors

📖 **[Hardware V1 Documentation →](Hardware/v1/README.md)**

**V2 – main board and HMI boards** (first batch ordered November 2026, untested)
- Main PCB: XT60 battery input with fuse, TVS and current measurement (INA237), ESP32-S3 with USB-C, switched motor output (XT60) for an ESC, brush output, motor signal connector with selectable 3.3 V / 5 V level, 4 × Qwiic, NTC, expansion header
- HMI PCB: breakaway panel with two WS2812B LED strips and button boards, connected to the main board with JST PH cables

📖 **[Hardware V2 Documentation →](Hardware/v2/README.md)**

### Firmware

The firmware provides:
- Motor speed control (0-100% PWM)
- Real-time monitoring (RPM, temperature, battery voltage)
- WiFi access point with web server
- WebSocket communication for live updates
- React-based web interface

The firmware in [Firmware/v1](Firmware/v1/README.md) is written for hardware V1. Firmware for V2 will go into `Firmware/v2`.

📖 **[Firmware Documentation →](Firmware/v1/README.md)**

## Quick Start

1. **Hardware**: Review the PCB documentation for [V1](Hardware/v1/README.md) or [V2](Hardware/v2/README.md)
2. **Firmware**: Follow the [firmware build and upload instructions](Firmware/v1/Setup.md)
3. **Frontend**: Build and upload the web interface as described in the firmware README

## Status

**Current Phase**: Benchtop Prototype (V1), V2 boards ordered

The V2 boards (main board and HMI boards) are ordered but untested; firmware for V2 has not been started yet. All designs and firmware are provided as-is for development and testing purposes.

---

*More information at [HackMD - Team Intuity](https://hackmd.io/@team-intuity) and [HackMD - hkienle](https://hackmd.io/@hkienle)*

