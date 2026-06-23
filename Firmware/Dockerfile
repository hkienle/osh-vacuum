# caznic connect — hosted UI (static SPA + WebSocket proxy to vacuum)
# Build: docker build -f Firmware/Dockerfile Firmware
# Run:   docker run -p 8080:8080 osh-vacuum-ui

FROM node:22-alpine AS ui-build
WORKDIR /build/ui
COPY ui/package.json ui/package-lock.json ./
RUN npm ci
COPY ui/ ./
RUN npm run build:server

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV UI_DIR=/app/ui/dist
ENV PORT=8080
ENV HOST=0.0.0.0

COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev
COPY server/hosted.mjs ./
COPY --from=ui-build /build/ui/dist ./ui/dist

RUN chown -R node:node /app
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/health || exit 1

USER node
CMD ["node", "hosted.mjs"]
