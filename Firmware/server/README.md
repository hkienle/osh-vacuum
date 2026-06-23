# Hosted UI (separate from ESP web server)

The **hosted** React app is **not** the same as the UI baked into the ESP32 (LittleFS).

| | Embedded (ESP) | Hosted (this server) |
|---|---|---|
| **URL** | `http://osh-vac.local` | `http://your-server:8080` |
| **Static files** | LittleFS on ESP | `Firmware/ui/dist/` |
| **Device link** | Direct `ws://osh-vac.local:81` | Same-origin `/device-ws` proxy → vacuum |
| **Deploy** | `npm run build:esp32` + `uploadfs` | `npm run build:server` + run server below |

Browsers block an **HTTPS** hosted page from opening `ws://192.168.x.x:81` directly. The hosted server proxies WebSocket so the app stays same-origin.

## Quick start (local)

```bash
# 1. Build the hosted UI bundle
cd Firmware/ui
npm install
npm run build:server

# 2. Run the hosted server (static files + WebSocket proxy)
cd ../server
npm install
npm start
```

Open **http://localhost:8080** (not the ESP address).

1. Sidebar → **WiFi** (Bluetooth is not used yet)
2. Enter **`osh-vac.local`** or the vacuum's IP
3. **Connect via WiFi**

## Dev mode (Vite)

```bash
cd Firmware/ui
npm run dev
```

Open **http://localhost:5173** — the dev server includes the same `/device-ws` proxy.

## Production deploy

1. `npm run build:server` in `Firmware/ui`
2. Deploy `Firmware/ui/dist/` **and** run `Firmware/server/hosted.mjs` on your host (Node.js)
3. Put nginx/Caddy in front for HTTPS; ensure WebSocket upgrade works on `/device-ws`

**Coolify (Nixpacks):** see [docs/COOLIFY.md](../docs/COOLIFY.md) — base directory `Firmware`, build pack **Nixpacks**, port `8080`.

**Coolify (Docker):** same base directory, build pack **Dockerfile**.

Environment:

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `8080` | HTTP port |
| `UI_DIR` | `../ui/dist` | Path to built React app |

## ESP firmware

The vacuum still needs WiFi + WebSocket on port **81** (standard `esp32-s3` / `esp32-s3-ota` build). OTA only updates firmware; it does **not** update this hosted UI.

```bash
cd Firmware
pio run -e esp32-s3-ota -t upload
```
