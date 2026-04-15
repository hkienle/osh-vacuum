# OSH Vacuum — Usage Guide

Step-by-step guide for operating the device, reading status info, and changing settings. For build and flash instructions → [Setup.md](Setup.md).

---

## Powering on

After power-on, the device attempts to connect to the configured WiFi network:

- **Connection successful** → LEDs turn **solid blue**, display shows the main screen.
- **Connection failed** → Device starts its own **hotspot** (LEDs turn **solid orange**).

The serial log (115200 baud) prints a `[BOOT]` line with mode and IP — useful without a display:

```
[BOOT] Mode=STA IP=192.168.1.42 Hostname=osh-vac
```

---

## Buttons

| Button | Function |
|--------|----------|
| **TRIGGER** | Start / stop motor (behaviour depends on trigger mode) |
| **UP** | Increase speed |
| **DOWN** | Decrease speed |
| **UP + DOWN** held ≥ 1.5 s | Open / close the dev menu |

---

## Running the motor

The device supports two trigger modes. The active mode is shown on page 12 of the dev menu.

### Mode 1: Hold (default)

| Action | Result |
|--------|--------|
| Hold TRIGGER ≥ 1.25 s | Motor starts |
| Press TRIGGER briefly (motor running) | Motor stops |

### Mode 2: Double-Press

| Action | Result |
|--------|--------|
| Press and hold TRIGGER | Motor runs while held — stops on release (momentary) |
| Tap TRIGGER twice quickly (< 300 ms apart) | Motor latches ON |
| Press TRIGGER (while latched) | Motor stops |

---

## Setting the speed

- **UP** / **DOWN** adjust the speed in configurable steps (default: 20%).
- With 20% steps the levels are: 0% → 20% → 40% → 60% → 80% → 100%.
- The speed setpoint is preserved after a motor stop and after waking from sleep.
- The **web interface** allows continuous speed control (0–100%).

---

## LEDs

| State | LEDs |
|-------|------|
| Booting / connecting to WiFi | Pulsing white |
| WiFi connected (router) | Solid blue |
| Hotspot mode | Solid orange |
| Motor off, speed = 0% | 1 LED pulsing slowly (blue) |
| Motor off, speed > 0% | Speed bar — blue (1 LED ≈ 20%) |
| Motor active | Speed bar — red |

---

## Display — main screen

| Element | Description |
|---------|-------------|
| **Speed bar** | Current speed setpoint (0–100%) as a horizontal bar |
| **Top line** | Configurable: Speed %, pack voltage (V), RPM, or motor temperature (°C) — set on page 10 of the dev menu |
| **Battery icon** | State of charge in % — shows `--` while the motor is running |

**Battery icon fill:**

| SOC | Display |
|-----|---------|
| 80–100% | All bars filled |
| 30–80% | Two bars |
| 15–30% | One bar |
| 0–15% | One bar blinking |
| Motor running | `--` |

---

## Dev menu — status & settings

**Open:** hold UP + DOWN simultaneously for ≥ 1.5 seconds.  
**Navigate:** UP / DOWN cycle through 13 pages.  
**Change a setting (pages 5–12):** press TRIGGER to step through the allowed values — saved to NVS immediately.  
**Close:** hold UP + DOWN again for ≥ 1.5 seconds (release both buttons first, then hold again).

> The motor does not run while the dev menu is open.

### Status pages (read-only)

| Page | Shows |
|------|-------|
| 0 | Battery: series cell count, SOC %, pack voltage |
| 1 | WiFi: mode (STA/AP), IP address, SSID |
| 2 | WiFi: hostname, signal strength (RSSI) |
| 3 | System: uptime, free heap |
| 4 | Additional system info |

### Settings pages (press TRIGGER to change)

| Page | Setting | Allowed values |
|------|---------|----------------|
| 5 | **Motor auto-off** — stops the motor after X minutes of continuous run | 0 (off), 1, 2, 5, 10, 30 min |
| 6 | **Temperature limit** — motor stops if NTC exceeds this value | 0 (off), 30–70 °C (step 5 °C) |
| 7 | **Speed step** — how many % each UP/DOWN press changes | 1, 5, 10, 20, 25% |
| 8 | **Minimum PWM duty** — PWM floor when motor is running | 1–30% |
| 9 | **Battery series cells** — cell count for SOC calculation | 1–14 |
| 10 | **Top-line display value** — what the main screen shows while motor runs | Speed%, Voltage (V), RPM, Motor Temp (°C) |
| 11 | **Sleep timer** — inactivity timeout before entering light sleep | 1, 2, 5, 10, 30 min |
| 12 | **Trigger mode** | Hold, Double-Press |

---

## WiFi & web interface

### Finding the device IP

- **Display:** dev menu → page 1 shows IP address and SSID.
- **Serial:** `[BOOT]` line after startup (USB-serial, 115200 baud).

### Opening the web interface

- **By IP:** `http://192.168.1.42` (port 80; use the IP from above).
- **By hostname:** `http://osh-vac.local` (if mDNS works on your network; hostname visible on page 2 of the dev menu).
- **In hotspot mode:** connect to the `OSH_VAC` network first, then typically `http://192.168.4.1`.

The web interface shows live sensor data (temperature, voltage, RPM, speed) and allows motor control and speed adjustment.

---

## Auto-sleep

The device enters **light sleep** automatically when all of the following are true for the configured sleep timer duration (default: 2 minutes):
- No button activity
- Motor not running
- No OTA update in progress

Before sleeping: motor stopped, LEDs off, display off.  
**Wake:** press any button. The speed setpoint is preserved.

Setting the sleep timer to 0 (page 11) disables auto-sleep entirely.

---

## Safety features

| Feature | Setting | Behaviour |
|---------|---------|-----------|
| **Auto-off** | Page 5 — Motor auto-off | Motor stops after X minutes of continuous run |
| **Temperature limit** | Page 6 — Temperature limit | Motor stops when NTC temperature ≥ limit |
| **Minimum PWM** | Page 8 — Minimum PWM duty | Prevents motor stall at low speed settings |

---

## Safety notes

- High RPM and moving parts: only operate the device with proper guarding and per the manufacturer's specifications.
- Battery: avoid short circuits and reverse polarity; use appropriate cell chemistry and protection circuits.
- OTA and credentials: replace the default passwords in any network accessible to others.
