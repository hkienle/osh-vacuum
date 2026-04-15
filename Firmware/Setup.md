# OSH Vacuum — Setup Guide

Everything you need to configure, build, and flash the firmware. For an overview of what the firmware does, see [README.md](README.md).

---

## Prerequisites

- [PlatformIO](https://platformio.org/) — CLI (`pip install platformio`) or the PlatformIO IDE extension for VS Code / Cursor.
- USB-C cable with data support (not charge-only).
- Node.js ≥ 18 + npm (for the frontend build, first time only).

---

## Step 1 — Create your local config file

`settings_config.h` holds your WiFi credentials, device hostname, and OTA password. It is gitignored and must be created locally from the example:

```bash
cp Firmware/src/settings/settings_config.example.h \
   Firmware/src/settings/settings_config.h
```

Open `settings_config.h` and set your values:

```cpp
// Your home/lab network
constexpr char WIFI_STA_SSID[]     = "YourNetworkName";
constexpr char WIFI_STA_PASSWORD[] = "YourNetworkPassword";

// Fallback hotspot (used when STA fails)
constexpr char WIFI_AP_SSID[]      = "OSH_VAC";
constexpr char WIFI_AP_PASSWORD[]  = "YourAPPassword";

// Device identity — used for mDNS and OTA
constexpr char DEVICE_HOSTNAME[]   = "osh-vac";
constexpr char OTA_HTTP_PASSWORD[] = "YourOTAPassword";
```

All other constants in that file are compile-time defaults for runtime settings (display type, battery cells, speed step, etc.). They take effect on first boot or when the NVS entry is missing. See [Usage Guide](usage.md) for a full description of each setting.

---

## Step 2 — Align platformio.ini with your config

For wireless OTA uploads to work, `platformio.ini` must match your `settings_config.h`:

```ini
[env:esp32-s3-ota]
upload_port  = osh-vac.local    ; must match DEVICE_HOSTNAME
upload_flags =
    --auth=YourOTAPassword      ; must match OTA_HTTP_PASSWORD
```

The USB environment (`esp32-s3`) needs no changes.

---

## Step 3 — Build the frontend

The web interface is a React + TypeScript app. Build it once before the first flash, and again whenever you change the UI.

```bash
cd Firmware/ui
npm install           # first time only
npm run build:esp32   # outputs to Firmware/data/
```

For local UI development with hot-reload (connects to a live device):

```bash
npm run dev           # typically http://localhost:5173
```

---

## Step 4 — First-time flash via USB

Connect the board via USB-C, then from the `Firmware/` directory:

```bash
# 1. Upload the firmware binary
pio run -e esp32-s3 -t upload

# 2. Upload the web UI (LittleFS filesystem)
pio run -e esp32-s3 -t uploadfs
```

> If the device doesn't enter flash mode automatically: hold **BOOT**, press **RESET**, release **BOOT**, then retry.

After flashing, open the serial monitor to verify the boot:

```bash
pio device monitor    # 115200 baud
```

Look for a `[BOOT]` line — it shows the WiFi mode and IP address:

```
[BOOT] Mode=STA IP=192.168.1.42 Hostname=osh-vac
```

---

## Wireless updates (OTA)

Once the device is on the network, you can update the firmware without USB:

```bash
cd Firmware
pio run -e esp32-s3-ota -t upload
```

If mDNS resolution of `<hostname>.local` is unreliable, pass the IP directly:

```bash
pio run -e esp32-s3-ota -t upload --upload-port 192.168.1.42
```

The device shows an OTA progress bar on the OLED and reboots automatically on success.

> **Three values must always be in sync:**
> 
> | File | Key |
> |------|-----|
> | `settings_config.h` | `DEVICE_HOSTNAME` → ArduinoOTA hostname + mDNS name |
> | `settings_config.h` | `OTA_HTTP_PASSWORD` → ArduinoOTA password |
> | `platformio.ini` `[env:esp32-s3-ota]` | `upload_port` = `<DEVICE_HOSTNAME>.local` (or IP) |
> | `platformio.ini` `[env:esp32-s3-ota]` | `upload_flags` = `--auth=<OTA_HTTP_PASSWORD>` |

---

## Configuration reference

### Compile-time defaults (`settings_config.h`)

These apply on first boot or whenever the corresponding NVS entry is absent. All of them can be overridden at runtime via the on-device settings menu.

| Constant | Default | Description |
|----------|---------|-------------|
| `DEFAULT_DISPLAY_TYPE` | `"0.91-I2C-Waveshare"` | Display backend (`"0.91-I2C-Waveshare"`, `"1.5-I2C-Waveshare"`, `"none"`) |
| `DEFAULT_BATTERY_SERIES_CELLS` | `5` | Series cell count for SOC calculation |
| `DEFAULT_AUTO_OFF_MINUTES` | `2` | Motor auto-off timeout in minutes (0 = disabled) |
| `DEFAULT_SLEEP_TIMER_MINUTES` | `2` | Inactivity sleep timeout in minutes (0 = disabled) |
| `DEFAULT_TEMP_LIMIT_C` | `0` | NTC motor cutoff in °C (0 = disabled) |
| `DEFAULT_SPEED_STEP_PERCENT` | `20` | UP/DOWN button speed step |
| `DEFAULT_MIN_DUTY_PERCENT` | `0` | Minimum PWM duty floor when motor runs |
| `DEFAULT_MOTOR_DISPLAY_MODE` | `2` (RPM) | Main display value: 0=Speed%, 1=Voltage, 2=RPM, 3=Motor Temp |
| `DEFAULT_TRIGGER_MODE` | `0` (Hold) | Trigger behaviour: 0=Hold, 1=Double-Press |

### Runtime NVS keys (`oshvac` namespace)

All values can be changed via the on-device settings menu (pages 5–12) and persist across reboots.

| NVS Key | Allowed Values | Description |
|---------|----------------|-------------|
| `display_type` | `0.91-I2C-Waveshare`, `1.5-I2C-Waveshare`, `none` | Active display backend |
| `bat_cells` | 1–14 (UI) / 1–32 (NVS) | Battery series cell count |
| `auto_off` | 0, 1, 2, 5, 10, 30 | Motor auto-off in minutes |
| `temp_lim` | 0, 30–70 (step 5 °C) | NTC cutoff temperature |
| `spd_step` | 1, 5, 10, 20, 25 | Speed step % |
| `min_duty` | 1–30 | Minimum PWM duty % |
| `mtr_disp` | 0–3 | Motor-on display value |
| `sleep_tmr` | 1, 2, 5, 10, 30 | Inactivity sleep timer in minutes |
| `trig_mode` | 0=Hold, 1=Double-Press | Trigger behaviour |

---

## Calibration

| What | Where |
|------|-------|
| Battery voltage (two-point linear) | `battery/battery.cpp` — `CAL_VTRUE1/2`, `CAL_VMEAS1/2` |
| Battery SOC OCV curve | `battery_soc/battery_soc.cpp` — per-cell voltage breakpoints |
| NTC R0 / Beta / series resistor | `temperature/temperature.cpp` |
| Pulses per revolution | `tachometer/tachometer.cpp` — `PULSES_PER_REV` |

---

## Troubleshooting

**USB upload fails**
- Use a USB-C cable that supports data.
- Hold **BOOT**, press **RESET**, release **BOOT**, then retry upload.
- Run `pio device list` to confirm PlatformIO sees the port.

**OTA upload fails**
- Verify the device is online: check the `[BOOT]` IP in the serial log or the display.
- Confirm `DEVICE_HOSTNAME` / `OTA_HTTP_PASSWORD` in `settings_config.h` match `upload_port` / `--auth` in `platformio.ini`.
- Try `--upload-port <ip>` if mDNS (`*.local`) doesn't resolve.
- If credentials are wrong, recover via USB: `pio run -e esp32-s3 -t upload`.

**Web UI not loading**
- Check that the filesystem was uploaded: `pio run -e esp32-s3 -t uploadfs`.
- Check serial output for LittleFS mount errors at boot.
- Ensure `Firmware/data/` has the built assets (`npm run build:esp32`).

**Display not initialising**
- Serial prefixes: `OLED:` (0.91"), `1.5OLED:` (1.5"). Look for I2C ACK errors.
- For the 1.5" Waveshare module: it ships in SPI mode and requires hardware I2C configuration via BS1/BS2 strapping (see Waveshare documentation).
