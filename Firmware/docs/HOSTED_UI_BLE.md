# Hosted UI + Bluetooth Architecture

This branch (`feature/hosted-ui-ble`) moves the control UI off the ESP32 and connects over **Bluetooth Low Energy** instead of loading the SPA from LittleFS.

## Before vs after

| | Embedded (master) | Hosted + BLE (this branch) |
|---|---|---|
| UI hosting | LittleFS on ESP32 :80 | Static HTTPS server |
| Control link | WebSocket :81 over WiFi | BLE GATT (Nordic UART Service) |
| WiFi role | UI + telemetry + OTA | OTA / lab debugging (optional) |
| Phone use | Same WiFi network required | Direct BLE pairing |

## Firmware layers

```
main.cpp
  └── deviceLinkUpdate()
        ├── websocket/     (WiFi WebSocket :81 — optional fallback)
        └── ble/           (NimBLE NUS — primary for hosted UI)
              └── device_protocol/   (shared JSON command parser)
```

### BLE GATT (Nordic UART Service)

| UUID | Direction | Purpose |
|------|-----------|---------|
| `6E400001-…` | Service | NUS |
| `6E400002-…` | Client → device (Write) | JSON commands, newline-terminated |
| `6E400003-…` | Device → client (Notify) | Telemetry, settings, acks |

Large payloads (settings schema ~6 KB) use `OV` fragment headers; the web client reassembles them.

### Build targets

- `esp32-s3` — BLE + embedded web UI (backward compatible)
- `esp32-s3-ble` — BLE-primary, **no** embedded web server (`OSHVAC_BLE_PRIMARY`)

```bash
pio run -e esp32-s3-ble -t upload
```

## Web UI transport abstraction

```
DeviceConnectionProvider
  ├── BleTransport      (Web Bluetooth API)
  └── WifiTransport     (WebSocket ws://ip:81)
```

Default transport:

- **HTTPS** hosted site → Bluetooth
- Embedded / local dev → WiFi

Override at build time: `VITE_DEFAULT_TRANSPORT=ble|wifi`

## Protocol (unchanged)

Same JSON messages as the original WebSocket implementation:

- Telemetry: `{ temp, battery, rpm, speed, motor_active, battery_soc }`
- Commands: `motor_start`, `motor_stop`, `heartbeat`, `get_settings`, `set_setting`, `{ speed }`

## Deployment checklist

1. Build UI: `cd Firmware/ui && npm run build:pages`
2. Deploy via GitHub Pages — see [GITHUB_PAGES.md](./GITHUB_PAGES.md) (`https://connect.caznic.xyz`)
3. Flash `esp32-s3-ble` (or `esp32-s3`) firmware
4. Pair from browser (Chrome/Edge, secure context)

## Known limits (MVP)

- Web Bluetooth is Chrome/Edge only; Safari support is limited
- BLE range vs WiFi — expect shorter distance, lower throughput
- OTA still uses WiFi (ArduinoOTA), not BLE
- Settings over BLE uses fragmentation; very poor RF may need retries

## Future work

- BLE provisioning (WiFi credentials from hosted UI)
- Optional WSS tunnel for WiFi-only browsers
- Drop LittleFS UI entirely on `esp32-s3-ble` to reclaim flash
