/**
 * Hosted OSH Vacuum UI — serves Firmware/ui/dist and proxies WebSocket to the device.
 *
 * Why: browsers block wss/ws from an HTTPS page to ws://192.168.x.x:81 (mixed content).
 * The React app connects to /device-ws?target=osh-vac.local:81 on this server instead.
 *
 * Usage:
 *   cd Firmware/ui && npm run build:server
 *   cd ../server && npm install && npm start
 *   Open http://localhost:8080 → Sidebar → WiFi → enter osh-vac.local → Connect
 */
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UI_DIR = process.env.UI_DIR ?? path.join(__dirname, '../ui/dist');
const PORT = Number(process.env.PORT ?? 8080);
const WS_PROXY_PATH = '/device-ws';

const app = express();
app.use(express.static(UI_DIR));

const wsProxy = createProxyMiddleware({
  pathFilter: WS_PROXY_PATH,
  ws: true,
  changeOrigin: true,
  router: (req) => {
    const url = new URL(req.url ?? '', 'http://localhost');
    const target = url.searchParams.get('target') ?? 'osh-vac.local:81';
    console.log(`[proxy] WebSocket → ws://${target}`);
    return `http://${target}`;
  },
  pathRewrite: () => '/',
});

app.use(wsProxy);

app.get('*', (_req, res) => {
  res.sendFile(path.join(UI_DIR, 'index.html'));
});

const server = app.listen(PORT, () => {
  console.log(`Hosted UI:     http://localhost:${PORT}`);
  console.log(`Static files:  ${UI_DIR}`);
  console.log(`WS proxy path: ${WS_PROXY_PATH}?target=<host>:81`);
  console.log('Example: connect to osh-vac.local in the sidebar WiFi field.');
});

server.on('upgrade', (req, socket, head) => {
  if (req.url?.startsWith(WS_PROXY_PATH)) {
    wsProxy.upgrade(req, socket, head);
  }
});
