# Deploy caznic connect on Coolify

This guide deploys the **hosted** web UI (`Firmware/ui` + `Firmware/server`) — not the ESP32 firmware.

| Component | Where it runs |
|-----------|----------------|
| Web UI (HTTPS) | Coolify |
| Vacuum firmware | ESP32 (WiFi + BLE) |
| WiFi telemetry link | Browser → Coolify → your vacuum `:81` |
| BLE link | Browser → vacuum directly (no Coolify hop) |

## Prerequisites

- A [Coolify](https://coolify.io) instance (self-hosted VPS or home server)
- This repo pushed to GitHub/GitLab/Gitea
- ESP32 flashed with standard `esp32-s3` firmware (WebSocket on port **81**)

### Network note (WiFi mode)

The `/device-ws` proxy runs **on the Coolify server**. The container must reach your vacuum (`osh-vac.local:81` or its LAN IP).

- **Coolify on the same LAN as the vacuum** → WiFi mode works with `osh-vac.local` or `192.168.x.x`
- **Coolify in the cloud** → WiFi proxy will **not** reach a home vacuum unless you add Tailscale/WireGuard or similar
- **BLE mode** (Chrome/Edge) works from any HTTPS URL — the browser pairs with the device directly

## 1. Create the application (Nixpacks)

1. In Coolify: **+ New** → **Application**
2. **Source**: your Git repository + branch (e.g. `feature/hosted-ui-ble` or `main`)
3. **Build pack**: **Nixpacks** (not Dockerfile)
4. **Base directory**: `Firmware`
5. **Port**: `8080` (exposed port; Coolify sets `PORT` at runtime)

Nixpacks reads `Firmware/nixpacks.toml` and:

1. `npm ci` in `ui/` (includes dev deps for the Vite build)
2. `npm ci --omit=dev` in `server/`
3. `npm run build:server` in `ui/` → writes `ui/dist/`
4. Starts `node server/hosted.mjs`

### Coolify UI checklist

| Field | Value |
|-------|--------|
| Build Pack | Nixpacks |
| Base Directory | `Firmware` |
| Install Command | *(leave empty — uses `nixpacks.toml`)* |
| Build Command | *(leave empty — uses `nixpacks.toml`)* |
| Start Command | *(leave empty — uses `nixpacks.toml`)* |
| Ports Exposes | `8080` |

If Coolify overrides commands in the UI, clear them so `nixpacks.toml` is used.

## 2. Domain & HTTPS

1. **Domains** → add e.g. `connect.caznic.xyz`
2. Enable **HTTPS** (Let's Encrypt) — required for Web Bluetooth on BLE transport
3. Save and deploy

WebSocket upgrade on `/device-ws` is handled by the Node server; Coolify's proxy forwards upgrades by default.

## 3. Health check (optional)

| Setting | Value |
|---------|--------|
| Path | `/health` |
| Method | GET |
| Expected | `200` / body `ok` |

## 4. Environment variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `PORT` | Set by Coolify | `8080` | HTTP listen port |
| `HOST` | No | `0.0.0.0` | Bind address (set in `nixpacks.toml`) |
| `UI_DIR` | No | `../ui/dist` from server | Override static files path if needed |

No secrets required for the basic setup.

## 5. Deploy

Push to Git → Coolify rebuilds, or click **Deploy** manually.

### Local Nixpacks smoke test (optional)

```bash
# Install nixpacks CLI: https://nixpacks.com/docs/install
cd Firmware
nixpacks build . -n osh-vacuum-ui
docker run --rm -p 8080:8080 -e PORT=8080 osh-vacuum-ui
# open http://localhost:8080/health
```

### Alternative: Docker

If you prefer Docker instead of Nixpacks, switch build pack to **Dockerfile** (same base directory `Firmware`). See `Firmware/Dockerfile`.

## 6. Use the deployed app

1. Open `https://your-domain`
2. Click **connect** (or the green status dot when connected)
3. Choose transport:
   - **Bluetooth** — works from anywhere with HTTPS (Chrome/Edge)
   - **WiFi** — enter `osh-vac.local` or vacuum IP (only if Coolify can reach that host)
4. Connect and control the vacuum

## Troubleshooting

### Build fails on `npm ci`

Ensure `ui/package-lock.json` and `server/package-lock.json` are committed.

### Nixpacks picks wrong Node version

Set in Coolify env or `nixpacks.toml`: `NIXPACKS_NODE_VERSION=22`

### Build pack detects wrong app

Confirm **Base directory** is `Firmware` (not repo root). The repo root has no `nixpacks.toml`.

### App loads but WiFi connect fails

- Confirm the vacuum is on and WebSocket `:81` is up
- From the Coolify **host** (SSH): test reachability to the vacuum IP
- Use **Bluetooth** instead, or run Coolify on the same network / Tailscale

### WebSocket drops behind Coolify

- Increase proxy WebSocket idle timeout in Coolify if needed
- Heartbeats are sent every 1s from the UI while connected

## Updating

| What changed | Action |
|--------------|--------|
| Web UI only | Push → Coolify redeploy |
| ESP firmware | `pio run -e esp32-s3-ota -t upload` (OTA) or USB flash |

## Related docs

- [Hosted server README](../server/README.md)
- [Hosted UI + BLE architecture](./HOSTED_UI_BLE.md)
