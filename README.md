# Open Source Vacuum Cleaner

> **📝 Note:** This repository is currently being populated with information. Content and documentation are being added progressively.

---

## About

This repository contains the Open Source Vacuum Cleaner project, an open-source hardware and software solution for building custom vacuum cleaners. The project includes complete PCB designs, ESP32-S3 based firmware, and a web-based control interface.

The system is designed to control high RPM impellers for vacuum machines, featuring motor control, real-time monitoring (RPM, temperature, battery voltage), WiFi connectivity, and a modern web interface.

## Project Structure

```
osh-vacuum/
├── Hardware/              # PCB designs and hardware documentation
│   └── PCB_Bench_Prototype/  # Benchtop prototype board design
│       ├── README.md         # Hardware documentation and BOM
│       └── Production/       # Manufacturing files
├── Firmware/              # ESP32-S3 firmware and web interface
│   ├── README.md          # Firmware documentation, pin assignments, build instructions
│   ├── src/               # Firmware source code
│   └── ui/                # React-based web interface
└── README.md              # This file
```

### Hardware

The hardware design includes:
- ESP32-S3 microcontroller with WiFi and BLE
- Motor control with Infineon ProFet for high-side switching
- 5 RGB LEDs (WS2812B) and 3 customizable buttons
- Battery voltage monitoring (15-32V input)
- Temperature monitoring via thermistor
- Tachometer input for RPM measurement
- Break-off sections for flexible form factors

📖 **[Hardware Documentation →](Hardware/PCB_Bench_Prototype/README.md)**

### Firmware

The firmware provides:
- Motor speed control (0-100% PWM)
- Real-time monitoring (RPM, temperature, battery voltage)
- WiFi access point with web server
- WebSocket communication for live updates
- React-based web interface

📖 **[Firmware Documentation →](Firmware/README.md)**

## Quick Start

1. **Hardware**: Review the [PCB documentation](Hardware/PCB_Bench_Prototype/README.md) for board assembly
2. **Firmware**: Follow the [firmware build and upload instructions](Firmware/README.md)
3. **Frontend**: Build and upload the web interface as described in the firmware README

## Checklist Website

The printable parts checklist is located in `Website/` and uses Vite + TypeScript.

Start the checklist website:

```bash
cd Website
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`).

Build for production:

```bash
cd Website
npm run build
npm run preview
```

## Status

**Current Phase**: Benchtop Prototype

The current board design is untested and represents the benchtop prototype phase. All designs and firmware are provided as-is for development and testing purposes.

---

*More information at [HackMD - Team Intuity](https://hackmd.io/@team-intuity) and [HackMD - hkienle](https://hackmd.io/@hkienle)*

