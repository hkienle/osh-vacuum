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

> **Requires repo admin.** If deploy fails with `Failed to create deployment (status: 404)`, Pages is not enabled yet — complete step 1 below as `hkienle` or another administrator.

### 1. Enable GitHub Pages

In the repo on GitHub ([Settings → Pages](https://github.com/hkienle/osh-vacuum/settings/pages)):

1. **Build and deployment** → **Source**: **GitHub Actions** (not “Deploy from a branch”)
2. Save — no branch/path needed when using Actions
3. **Custom domain**: `connect.caznic.xyz` → Save
4. Wait for DNS check, then enable **Enforce HTTPS**

The first successful enable creates the `github-pages` deployment environment. Until this is done, the workflow build succeeds but **deploy** fails with HTTP 404.

Two workflows handle deployment:

| Workflow | Trigger | Role |
|----------|---------|------|
| [`.github/workflows/sync-main-to-master.yml`](../../.github/workflows/sync-main-to-master.yml) | Push to `main` (UI paths) | Fast-forwards `master` to match `main` |
| [`.github/workflows/pages.yml`](../../.github/workflows/pages.yml) | Push to `master` (UI paths) | Builds `Firmware/ui` and deploys to Pages |

The `github-pages` environment only allows deploys from **`master`**, so you keep developing on **`main`** — UI merges to `main` sync `master` automatically, then Pages deploys. You can also run **Actions** → **Deploy GitHub Pages** manually (use branch **`master`**).

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
| Web UI only | Merge/push to `main` → syncs `master` → Pages redeploys |
| ESP firmware | `pio run -e esp32-s3-ota -t upload` (OTA) or USB flash |

## Troubleshooting

### Deploy job: `Branch "main" is not allowed to deploy to github-pages`

The `github-pages` environment only permits **`master`**. Pushes to `main` should run **Sync main to master** first, then **Deploy GitHub Pages** on `master`. If sync did not run, merge `main` into `master` manually or re-run **Sync main to master**.

Repo admins can alternatively add `main` under **Settings → Environments → github-pages → Deployment branches** and switch `pages.yml` back to `branches: [main]`.

### Deploy job: `Failed to create deployment (status: 404)`

GitHub Pages is **not enabled** on the repository.

1. Open [github.com/hkienle/osh-vacuum/settings/pages](https://github.com/hkienle/osh-vacuum/settings/pages) as a **repo admin**
2. Set **Source** to **GitHub Actions**
3. Re-run the workflow: **Actions** → **Deploy GitHub Pages** → **Run workflow**

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
