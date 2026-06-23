import type { Plugin } from 'vite';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { DEFAULT_VACUUM_HOST } from '../types/deviceTransport';

const WS_PROXY_PATH = '/device-ws';

/** Dev-server proxy: hosted UI → vacuum WebSocket (same as production server). */
export function deviceWsProxyPlugin(): Plugin {
  return {
    name: 'device-ws-proxy',
    configureServer(server) {
      const proxy = createProxyMiddleware({
        pathFilter: WS_PROXY_PATH,
        ws: true,
        changeOrigin: true,
        router: (req) => {
          const url = new URL(req.url ?? '', 'http://localhost');
          const target = url.searchParams.get('target') ?? `${DEFAULT_VACUUM_HOST}:81`;
          return `http://${target}`;
        },
        pathRewrite: () => '/',
      });

      server.middlewares.use(proxy);

      server.httpServer?.on('upgrade', (req, socket, head) => {
        if (req.url?.startsWith(WS_PROXY_PATH)) {
          proxy.upgrade(req, socket, head);
        }
      });
    },
  };
}
