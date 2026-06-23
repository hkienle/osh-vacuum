# Deploy caznic connect on GitHub Pages

Static hosting for the **hosted** web UI (`Firmware/ui`) at **https://connect.caznic.xyz**.

| Component | Where it runs |
|-----------|----------------|
| Web UI (HTTPS) | GitHub Pages |
| Vacuum firmware | ESP32 (WiFi + BLE) |
| BLE link | Browser → vacuum directly |
| WiFi link | **Not available** on GitHub Pages (no server-side WebSocket proxy) |

GitHub Pages serves static files only. The hosted UI shows **Bluetooth only** — WiFi transport is hidden. For WiFi + BLE, run the Node server locally — see [server README](../server/README.md).

## One-time setup

### 1. Enable GitHub Pages

In the repo on GitHub:

1. **Settings** → **Pages**
2. **Build and deployment** → **Source**: **GitHub Actions**
3. **Custom domain**: `connect.caznic.xyz` → Save
4. Wait for DNS check, then enable **Enforce HTTPS**

The workflow [`.github/workflows/pages.yml`](../../.github/workflows/pages.yml) builds `Firmware/ui` and deploys on every push to `main` that touches the UI (or via **Actions** → **Deploy GitHub Pages** → **Run workflow**).

### 2. DNS (caznic.xyz)

At your DNS provider, add:

| Type | Name | Value |
|------|------|--------|
| CNAME | `connect` | `hkienle.github.io` |

If you use Cloudflare, set the record to **DNS only** (grey cloud) until GitHub has issued the TLS certificate.

`Firmware/ui/public/CNAME` is copied into the build output so the custom domain survives each deploy.

### 3. Flash firmware

Flash BLE-capable firmware (`esp32-s3` or `esp32-s3-ble`), then pair from **https://connect.caznic.xyz** in Chrome or Edge.

## Local build (optional)

```bash
cd Firmware/ui
npm install
npm run build:pages
# output in dist/ — same bundle GitHub Pages publishes
```

## Updating

| What changed | Action |
|--------------|--------|
| Web UI only | Merge/push to `main` → workflow redeploys |
| ESP firmware | `pio run -e esp32-s3-ota -t upload` (OTA) or USB flash |

## Troubleshooting

### Custom domain not verified

- Confirm CNAME `connect` → `hkienle.github.io`
- Allow up to 24h for DNS propagation
- In **Settings → Pages**, remove and re-add the custom domain if stuck

### Bluetooth unavailable

- Open `https://connect.caznic.xyz` (not `http://`)
- Use Chrome or Edge (Safari has no Web Bluetooth)
- Grant Bluetooth permission when prompted

### WiFi option missing on connect.caznic.xyz

Expected on GitHub Pages. WiFi transport is only shown when self-hosting (e.g. `http://localhost:8080` with `Firmware/server`). Use BLE on the public site, or run the server locally for WiFi.

## Related docs

- [Hosted UI + BLE architecture](./HOSTED_UI_BLE.md)
- [Hosted server README](../server/README.md) (local dev + optional self-hosted WiFi proxy)
