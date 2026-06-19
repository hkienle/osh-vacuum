can # 1.5" Display UI — Architecture & Modular Redesign Guide

This document describes how the **1.5" Waveshare OLED** (SSD1327, 128×128, I2C) UI is structured today, and suggests a modular approach for redesigning it.

---

## Important distinction

There are **two UIs** in this project:

| UI                | Location                                 | Technology                   |
| ----------------- | ---------------------------------------- | ---------------------------- |
| **Web interface** | `Firmware/ui/`                           | React / TypeScript           |
| **1.5" OLED**     | `Firmware/src/display_waveshare_15_i2c/` | C++ / Adafruit_GFX / SSD1327 |

This document covers the **embedded 1.5" display**, not the React web app.

---

## Current architecture (layers)

```
main.cpp
  └─ builds DisplayTelemetry { speed, rpm, battery, ... }
       └─ updateDisplay(telemetry)          [display/display.cpp]
            └─ switch on DisplayType
                 └─ updateDisplayWaveshare15I2C(...)   [~800 lines, one file]
```

`display.cpp` is a thin **facade** — it picks 0.91" vs 1.5" vs none.

**Good news:** `DisplayTelemetry` in `display.h` is already a clean data contract between application logic and rendering. Keep it.

---

## Inside `display_waveshare_15_i2c.cpp`

Everything lives in **one file** (~800 lines), mostly in an anonymous `namespace`:

| Piece                              | Role                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------- |
| `Adafruit_SSD1327 display`         | Global driver object (128×128)                                            |
| `initDisplayWaveshare15I2C()`      | I2C init, address detect                                                  |
| `updateDisplayWaveshare15I2C(...)` | **Router + dirty-check + animation state**                                |
| `drawInterfaceFrame()`             | Main screen layout                                                        |
| `drawInfoPage15()`                 | Info / dev-menu pages (`switch (page)`)                                   |
| `drawDevSettingPage15()`           | Settings page (uses `DevSettingDescriptor`)                               |
| `drawOtaScreen15()`                | OTA progress overlay                                                      |
| Helpers                            | `drawBatteryIcon`, `drawBoldText15`, `formatRpmFull`, bar animation, etc. |

Hardware: I2C on **GPIO9 (SDA)** / **GPIO8 (SCL)**, addresses **0x3D** or **0x3C**.

---

## Screen modes (state machine)

`updateDisplayWaveshare15I2C()` routes to one of three modes:

```
1. otaActive          → drawOtaScreen15()
2. displayInfoMode    → drawInfoPage15()   (pages 0–5 = info, 6+ = dev menu)
3. else (main)        → build text lines + animated speed bar → drawInterfaceFrame()
```

It also performs:

- **Dirty checking** — only redraws when values change
- **Frame limiting** — `DISPLAY_MIN_FRAME_MS = 170` (max ~6 fps)
- **Bar animation** — smoothstep over `BAR_ANIM_MS = 220`

---

## What is already modular

The **dev menu settings** use a data-driven pattern (similar to what you want for screens):

```cpp
// settings/dev_menu.h
struct DevSettingDescriptor {
  bool isGlobal;
  DevSettingId globalId;
  const char* driverKey;
  const char* title;
  void (*formatValue)(char* out, size_t n);
  const char* subline;
  void (*formatSubline)(char* out, size_t n);
  void (*cycleAndSave)();
};
```

`drawDevSettingPage15()` renders any `DevSettingDescriptor` — title, value, subline. This is the best existing pattern in the codebase.

Info pages (0–5):

| Page | Title                                   |
| ---- | --------------------------------------- |
| 0    | Maximum Stats                           |
| 1    | Battery Info                            |
| 2    | WiFi Info                               |
| 3    | BLE Info                                |
| 4    | Sensor Info                             |
| 5    | System Info                             |
| 6+   | Dev settings (via `devMenuVisibleAt()`) |

---

## What is duplicated

- **0.91"** display logic lives in `display_oled/display_oled.cpp` and shares almost the same screens (main, info, dev menu, OTA) with different layout/size.
- **1.5"** reimplements much of it instead of sharing a common screen model.
- The 0.91" Waveshare wrapper (`display_waveshare_091_i2c.cpp`) is thin and delegates to `display_oled.cpp` — a pattern the 1.5" driver could move toward.

---

## Can you use classes?

**Yes.** The ESP32-S3 has enough RAM/flash for modest C++ UI classes. The project already uses C++ features (`enum class`, structs, lambdas in OTA).

Guidelines for embedded UI classes:

- Prefer **composition** over deep inheritance
- Avoid virtual dispatch on every pixel — one `virtual void draw()` per screen is fine
- Wrap the global `Adafruit_SSD1327` in a single `DisplayCanvas` passed by reference
- Do not allocate screens with `new` every frame — create once at `init`

---

## Suggested modular structure

```
display/
  display.h              ← keep DisplayTelemetry (already good)
  display.cpp            ← facade unchanged

display_waveshare_15_i2c/
  display_waveshare_15_i2c.cpp/h   ← thin public API (init / update / ota / sleep)
  driver_15.h/cpp                  ← I2C, SSD1327 init, flush
  canvas_15.h/cpp                  ← wrappers: clear, bold text, right-align, colors
  widgets/
    battery_icon_15.h/cpp
    speed_bar_15.h/cpp
    label_15.h/cpp
  screens/
    main_screen_15.h/cpp           ← drawInterfaceFrame logic
    info_screen_15.h/cpp           ← pages 0–5
    dev_setting_screen_15.h/cpp
    ota_screen_15.h/cpp
  controller_15.h/cpp              ← mode routing, dirty-check, bar animation
```

---

## Option A — Classes (recommended for a full redesign)

```cpp
class DisplayCanvas15 {
 public:
  explicit DisplayCanvas15(Adafruit_SSD1327& gfx);
  void clear();
  void flush();
  void drawBold(const char* text, int16_t x, int16_t y);
  void printRight(const char* s, int16_t y, uint8_t textSize);
  Adafruit_SSD1327& gfx();
};

class Screen15 {
 public:
  virtual ~Screen15() = default;
  virtual void draw(DisplayCanvas15& canvas, const DisplayTelemetry& t) = 0;
  virtual bool needsRedraw(const DisplayTelemetry& t) const { return true; }
};

class MainScreen15 : public Screen15 { /* ... */ };
class InfoScreen15 : public Screen15 { /* ... */ };
class OtaScreen15 : public Screen15 { /* ... */ };

class DisplayController15 {
 public:
  void update(const DisplayTelemetry& t);
 private:
  Screen15* currentScreen_;
  MainScreen15 main_;
  InfoScreen15 info_;
  OtaScreen15 ota_;
  // dirty-check state lives here (moved out of updateDisplayWaveshare15I2C)
};
```

---

## Option B — Data-driven (lighter, no vtables)

Matches the existing `DevSettingDescriptor` pattern:

```cpp
struct Screen15Descriptor {
  void (*draw)(DisplayCanvas15&, const DisplayTelemetry&, uint8_t page);
};

const Screen15Descriptor kInfoScreens[] = {
  { drawInfoMaximumStats },
  { drawInfoBattery },
  { drawInfoWiFi },
  // ...
};
```

Very ESP-friendly — no virtual tables, easy to inspect in flash.

---

## What to keep vs change

| Keep                                            | Refactor                                                               |
| ----------------------------------------------- | ---------------------------------------------------------------------- |
| `DisplayTelemetry` + `display.cpp` facade       | Split the ~800-line monolith                                           |
| `DevSettingDescriptor` data model               | Extract reusable widgets (battery, bar)                                |
| Dirty-check / frame limit logic                 | Move into `DisplayController15`                                        |
| Public API: `init` / `update` / `ota` / `sleep` | Share screen _logic_ with 0.91" where layouts differ only by constants |

---

## Practical migration path

1. **Extract `DisplayCanvas15`** — move `drawBoldText15`, `printRight15`, `wrapTextToTwoLines` there. No behavior change.
2. **Extract widgets** — `BatteryIcon`, `SpeedBar` (with animation state).
3. **Extract screens one at a time** — start with `OtaScreen15` (smallest), then `MainScreen15`, then `InfoScreen15`.
4. **Introduce `DisplayController15`** — move routing from `updateDisplayWaveshare15I2C` into the controller.
5. **Optional:** extract shared view-model helpers used by both 0.91" and 1.5" (format RPM, build main-line text from `motorDisplayMode`, etc.) into `display/common/`.

---

## Design tips for 128×128

- Define **layout constants** per screen (positions, text sizes) in one header — easy to tweak during a redesign.
- Consider a **theme struct** (margins, bar height, title Y) instead of magic numbers scattered in draw functions.
- For the main screen, `drawInterfaceFrame()` is the layout template — split into regions: header / value / temp line / footer bar.

### Main screen regions (current layout)

```
┌──────────────────────── 128px ────────────────────────┐
│  [label]              [battery icon + SOC %]     y≈10 │
│                                                         │
│         LARGE VALUE (size 3)                     y≈26  │
│         e.g. RPM / Start / Hold...                      │
│                                                         │
│         TEMP LINE (size 2)                       y≈64  │
│         "T 42.3C"                                       │
│                                                         │
│  ┌──────────────── speed bar ────────────────┐  y≈108 │
│  └───────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────┘
```

---

## Data flow (unchanged after refactor)

```
button / motor / wifi / settings
        ↓
   main.cpp builds DisplayTelemetry
        ↓
   updateDisplay(telemetry)        ← display.cpp facade
        ↓
   DisplayController15::update()   ← new internal layer
        ↓
   active Screen15::draw()         ← main / info / ota
        ↓
   DisplayCanvas15 → Adafruit_SSD1327 → I2C → panel
```

The public API (`initDisplay`, `updateDisplay`, `updateDisplayOtaScreen`, `prepareDisplayForSleep`) should stay stable so `main.cpp` and `ota.cpp` do not need changes.

---

## Related files

| File                                                        | Purpose                                             |
| ----------------------------------------------------------- | --------------------------------------------------- |
| `src/display/display.h`                                     | `DisplayTelemetry`, public display API              |
| `src/display/display.cpp`                                   | Display type switch (facade)                        |
| `src/display_waveshare_15_i2c/display_waveshare_15_i2c.cpp` | Current 1.5" implementation                         |
| `src/display_oled/display_oled.cpp`                         | Shared 0.91" logic (reference / future shared code) |
| `src/settings/dev_menu.h`                                   | Data-driven settings descriptors                    |
| `src/main.cpp`                                              | Builds `DisplayTelemetry`, calls `updateDisplay()`  |

---

## Summary

Today the 1.5" UI is a **single procedural file** with a mode switch and some data-driven dev-menu rendering. **Classes work well** for a redesign; the most natural fit is:

- **`DisplayController15`** — routing, dirty-check, animation
- **`Screen15` implementations** — main, info, OTA, dev setting
- **Reusable widgets** — battery icon, speed bar, labels
- **`DisplayTelemetry`** — unchanged input to all screens

Start small: extract canvas + OTA screen first, then main screen, then info pages.
