# Mac Build Setup — Changes & Fixes Log

This document records everything done to get the OSH Vacuum firmware building and uploading on **Janos's Mac** (Apple Silicon, macOS 26.5, PlatformIO 6.1.19). It covers repository changes, local-only files, machine-level PlatformIO fixes, and known remaining issues.

**Date:** 2026-06-19  
**Branch at time of writing:** `main`  
**Machine:** `arm64` (Apple Silicon)

---

## Summary

| Category              | What changed                                        | In git?                         |
| --------------------- | --------------------------------------------------- | ------------------------------- |
| License in READMEs    | Added CERN OHL-S v2 sections                        | Yes (committed)                 |
| Git branch merges     | `hardware-v1` ↔ `master`                            | Yes (pushed)                    |
| Local config file     | Created `settings_config.h`                         | No (gitignored)                 |
| PlatformIO platform   | Installed pioarduino `espressif32@55.3.39` globally | No (local `~/.platformio`)      |
| Python native modules | Reinstalled arm64 wheels in PIO venv                | No (local `~/.platformio/penv`) |
| `platformio.ini`      | **Should stay** `espressif32@~55.3.0`               | Yes (repo default)              |

**Build status after fixes:** `pio run -e esp32-s3` → **SUCCESS** (~1.3 MB firmware)  
**OTA upload status:** Failed — device not reachable at `osh-vac-01.local` / `osh-vac.local` (network, not build)

---

## 1. Repository changes (committed & pushed)

### 1.1 License sections

Added **CERN Open Hardware Licence - Strongly Reciprocal (CERN OHL-S v2)** to:

- `Hardware/PCB_Bench_Prototype/README.md`
- `README.md` (root)

License text link:  
https://gitlab.com/ohwr/project/cernohl/-/wikis/uploads/819d71bea3458f71fba6cf4fb0f2de6b/cern_ohl_s_v2.txt

### 1.2 Git merges

| Action                                     | Result                                               |
| ------------------------------------------ | ---------------------------------------------------- |
| Merged `hardware-v1` → `master`            | Hardware printed parts + license on `master`         |
| Accidentally merged `main` → `hardware-v1` | Reverted; re-merged `master` → `hardware-v1` instead |
| Pushed `hardware-v1` and `master`          | Both at commit `2844070` at one point                |
| Root README license                        | Commit `2844070` on `master`                         |

Note: `origin/main` exists on GitHub as a separate branch; default branch for the project is **`master`**.

---

## 2. Local file — `settings_config.h` (required, gitignored)

### Problem

```
fatal error: settings/settings_config.h: No such file or directory
```

`settings_config.h` holds WiFi credentials, OTA password, hostname, and compile-time defaults. It is **gitignored** (see `.gitignore`) and must be created on every developer machine.

### Fix

```bash
cp Firmware/src/settings/settings_config.example.h \
   Firmware/src/settings/settings_config.h
```

Then edit WiFi/OTA values in `settings_config.h`.

### Second problem — outdated local copy

After copying from an older example, build failed with missing `SettingsConfig` members:

- `DEFAULT_LED_DISPLAY_MODE`
- `DEFAULT_LED_IDLE_DISPLAY_MODE`
- `DEFAULT_LED_DIM_PERCENT`
- `DEFAULT_LED_THEME`
- `DEFAULT_MAX_DUTY_PERCENT`

**Cause:** `settings.cpp` on `main` was updated; local `settings_config.h` was from an older template.

**Fix:** Re-copy from current `settings_config.example.h` (now includes all constants), or add the missing lines manually. The current example on `main` is up to date.

### Third problem — `WIFI_AP_SSID` (resolved on current `main`)

Older `wifi.cpp` referenced `SettingsConfig::WIFI_AP_SSID`. Newer config uses `DEVICE_HOSTNAME` as the Soft-AP SSID instead:

```cpp
// wifi.cpp (current main)
const char* ap_ssid = SettingsConfig::DEVICE_HOSTNAME;
```

No separate `WIFI_AP_SSID` needed in `settings_config.h` on current `main`.

---

## 3. PlatformIO platform — `espressif32@~55.3.0`

### Problem

```
UnknownPackageError: Could not find the package with 'espressif32 @ ~55.3.0' requirements
```

### Explanation

`platform = espressif32@~55.3.0` in `platformio.ini` refers to the **[pioarduino](https://github.com/pioarduino/platform-espressif32)** community fork, **not** the official PlatformIO registry package (latest official: `7.0.1`).

pioarduino supports **Arduino ESP32 core v3.x**. Colleague's Mac already had it installed locally; this Mac did not.

| Platform source                   | Version | Arduino core |
| --------------------------------- | ------- | ------------ |
| Official `platformio/espressif32` | 7.0.1   | 2.x          |
| pioarduino fork                   | 55.3.x  | 3.x          |

The repo intentionally uses pioarduino (`~55.3.0`). **Do not change `platformio.ini` to `espressif32` alone** unless the team agrees to downgrade the Arduino core.

### Fix (machine-only, no repo change)

Install pioarduino platform globally:

```bash
pio pkg install -g -p "https://github.com/pioarduino/platform-espressif32/releases/download/55.03.39/platform-espressif32.zip"
```

Verify:

```bash
pio platform list
# Should show: espressif32 @ 55.3.39
```

Installed location: `~/.platformio/platforms/espressif32`

Also pulls in pioarduino-specific tools:

- `tool-esp_install@5.3.4`
- `toolchain-xtensa-esp-elf@14.2.0`
- `tool-esptoolpy@5.3.0`
- etc.

---

## 4. Apple Silicon — x86_64 Python modules in PIO venv

### Problem

After platform install, build failed with architecture errors:

```
ImportError: dlopen(.../littlefs/lfs.cpython-313-darwin.so)
mach-o file, but is an incompatible architecture (have 'x86_64', need 'arm64')
```

Same for `fatfs`, `cryptography`, `cffi`, `tibs`, `PyYAML`, `bitarray`.

### Cause

PlatformIO's virtualenv (`~/.platformio/penv`) was seeded with **x86_64** native wheels (likely created under Rosetta or from an Intel Python install at some point). Mac is **arm64**.

### Fix

Bootstrap pip in the PIO venv, then reinstall affected packages as arm64:

```bash
arch -arm64 ~/.platformio/penv/bin/python3 -m ensurepip

arch -arm64 ~/.platformio/penv/bin/python3 -m pip install --force-reinstall --no-cache-dir \
  littlefs-python

arch -arm64 ~/.platformio/penv/bin/python3 -m pip install --force-reinstall --no-cache-dir --no-deps \
  "fatfs-ng==0.1.15" \
  "cryptography==49.0.0" \
  "cffi==2.0.0" \
  "tibs==0.5.7" \
  "PyYAML==6.0.3" \
  "bitarray==3.8.2"
```

Verify no x86_64-only `.so` files remain:

```bash
cd ~/.platformio/penv/lib/python3.13/site-packages
find . -name "*.so" | while read f; do
  file "$f" | grep -q x86_64 && ! file "$f" | grep -q arm64 && echo "BAD: $f"
done
# (should print nothing)
```

### If it happens again

After a PlatformIO major update or `penv` recreation, rerun the arm64 reinstall commands above.

---

## 5. Build verification

```bash
cd Firmware
pio run                    # builds esp32-s3 + esp32-s3-ota
pio run -e esp32-s3        # USB env only
```

**Successful output (esp32-s3):**

```
RAM:   [==        ]  20.8% (used 68180 bytes from 327680 bytes)
Flash: [====      ]  39.3% (used 1312608 bytes from 3342336 bytes)
========================= [SUCCESS] =========================
```

Build artifacts: `Firmware/.pio/build/esp32-s3/firmware.bin` (~1.31 MB)

---

## 6. Upload — separate from build

### USB upload (first flash, fastest)

```bash
pio run -e esp32-s3 -t upload --upload-port /dev/cu.Maker-E7B5
pio device monitor -p /dev/cu.Maker-E7B5 -b 115200
```

Detected USB port on this Mac: `/dev/cu.Maker-E7B5`

Optional speed boost in `platformio.ini` (not yet applied):

```ini
upload_speed = 921600
```

### OTA upload (wireless, after first USB flash)

```bash
pio run -e esp32-s3-ota -t upload
```

**Failed on this Mac:**

```
Sending invitation to osh-vac-01.local failed
[ERROR]: Host osh-vac-01.local Not Found
```

**Causes (not build-related):**

1. Device not yet flashed with OTA-capable firmware → use USB first
2. Device not on same WiFi as the Mac
3. mDNS (`.local`) not resolving
4. `DEVICE_HOSTNAME` in `settings_config.h` must match upload target

**Align these values:**

| File                                  | Setting               | Example                        |
| ------------------------------------- | --------------------- | ------------------------------ |
| `settings_config.h`                   | `DEVICE_HOSTNAME`     | `"osh-vac"`                    |
| `platformio.ini` `[env:esp32-s3-ota]` | `upload_port`         | `osh-vac.local`                |
| `platformio.ini`                      | `upload_flags --auth` | must match `OTA_HTTP_PASSWORD` |

If mDNS fails, use IP:

```bash
pio run -e esp32-s3-ota -t upload --upload-port 192.168.x.y
```

---

## 7. Complete setup checklist (new Mac, Apple Silicon)

```bash
# 1. Clone repo
git clone <repo-url> && cd osh-vacuum

# 2. Create local config
cp Firmware/src/settings/settings_config.example.h \
   Firmware/src/settings/settings_config.h
# → edit WiFi / hostname / OTA password

# 3. Install pioarduino platform (for espressif32@~55.3.0)
pio pkg install -g -p "https://github.com/pioarduino/platform-espressif32/releases/download/55.03.39/platform-espressif32.zip"

# 4. Fix arm64 native modules (Apple Silicon only, if arch errors occur)
arch -arm64 ~/.platformio/penv/bin/python3 -m ensurepip
arch -arm64 ~/.platformio/penv/bin/python3 -m pip install --force-reinstall --no-cache-dir littlefs-python
arch -arm64 ~/.platformio/penv/bin/python3 -m pip install --force-reinstall --no-cache-dir --no-deps \
  "fatfs-ng==0.1.15" "cryptography==49.0.0" "cffi==2.0.0" \
  "tibs==0.5.7" "PyYAML==6.0.3" "bitarray==3.8.2"

# 5. Build
cd Firmware && pio run

# 6. First flash over USB
pio run -e esp32-s3 -t upload --upload-port /dev/cu.usbmodem*

# 7. Later: OTA
pio run -e esp32-s3-ota -t upload
```

---

## 8. What was NOT changed in the repo

These were considered but either reverted or applied only locally:

| Item                                                         | Status                          |
| ------------------------------------------------------------ | ------------------------------- |
| `platformio.ini` → `platform = espressif32` (official 7.0.1) | Reverted; repo keeps `@~55.3.0` |
| `settings_config.h`                                          | Local only (gitignored)         |
| pioarduino platform install                                  | Local `~/.platformio` only      |
| arm64 pip reinstall                                          | Local `~/.platformio/penv` only |
| `upload_speed` tuning                                        | Not applied                     |

---

## 9. Known repo gaps (for the team)

1. **`settings_config.example.h` must stay in sync with `settings.cpp`** — if new `DEFAULT_*` constants are added to code, update the example file too.
2. **`platformio.ini` uses pioarduino** — document this in `Setup.md` so new developers install the platform before first build.
3. **`origin/main` vs `master`** — two branches exist; team should agree on which is canonical.
4. **OTA hostname mismatch** — `upload_port = osh-vac.local` in `platformio.ini` but developers may set `DEVICE_HOSTNAME = osh-vac-01` locally; OTA will fail unless aligned.

---

## 10. PlatformIO environments

| Environment    | Purpose                        | Upload              |
| -------------- | ------------------------------ | ------------------- |
| `esp32-s3`     | Standard build + USB flash     | `esptool` (USB CDC) |
| `esp32-s3-ota` | Same firmware, wireless upload | `espota` over WiFi  |

Both share the same `[env:esp32-s3]` build config; `esp32-s3-ota` only overrides upload settings.
