# 1.5" OLED UI Preview

Local **128×128 layout simulator** for the embedded display in
`Firmware/src/display_waveshare_15_i2c/display_waveshare_15_i2c.cpp`.

This is an **approximate** preview: it mirrors layout constants, screen modes, and
text placement from the firmware, but uses browser canvas + monospace font instead
of Adafruit GFX on the SSD1327. Use it to iterate on layout and copy before
flashing hardware.

## Quick start

```bash
cd Firmware/tools/display15-preview
npm install
npm run dev
```

Opens **http://localhost:5174** with the canvas at **real 1.5″ physical size** by default
(~27 mm per side). Sizing uses a HiDPI correction so CSS `mm` matches a ruler on Retina Macs.
Use **2×** / **4×** to magnify.

## Features

- **Main screen** — idle, trigger hold, motor on (RPM / speed %), low-battery blink
- **Info pages** — Maximum Stats, Battery, WiFi, BLE, Sensor, System
- **Dev menu** — example setting pages (title / value / subline layout)
- **OTA** — progress bar screen
- **Download PNG** — current scenario at native 128×128
- **Export all PNGs** — batch download every scenario
- **Interactive buttons** — UP, DOWN, TRIGGER matching firmware (`button.cpp`)

## Scenarios

Edit mock telemetry in `src/scenarios.ts`. Each scenario matches the firmware's
`DisplayTelemetry` shape (`src/types.ts`).

When you add a new screen or dev-menu page in firmware, add a matching scenario and
draw branch in `src/renderer.ts`.

## Limitations

| Topic | Notes |
|-------|--------|
| Font metrics | Browser monospace ≈ Adafruit 6×8; long strings may wrap differently |
| Grayscale | Preview is white/gray on black; panel uses SSD1327 4-bit grayscale |
| Animations | Speed-bar smoothstep and frame limiter are not simulated (static fill %) |
| Shared code | Renderer is TypeScript duplicate, not compiled from C++ yet |

Long term, extract a `DisplayCanvas15` layer in firmware (see
`Firmware/docs/DISPLAY_15_UI_ARCHITECTURE.md`) and optionally drive this preview
from the same layout data.

## Production build

```bash
npm run build
npm run preview
```

Static files land in `dist/`.

## Related

- Embedded UI: `Firmware/src/display_waveshare_15_i2c/`
- Architecture notes: `Firmware/docs/DISPLAY_15_UI_ARCHITECTURE.md`
- Web dashboard (separate UI): `Firmware/ui/`
