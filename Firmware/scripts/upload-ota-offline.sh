#!/usr/bin/env bash
# OTA upload while connected to the ESP hotspot (no internet).
# Skips pioarduino's slow internet connectivity probe (3×, up to ~15 s each).
#
# Usage:
#   ./scripts/upload-ota-offline.sh              # AP mode: 192.168.4.1
#   ./scripts/upload-ota-offline.sh 192.168.1.42  # STA mode: device LAN IP
#
set -euo pipefail
cd "$(dirname "$0")/.."

UPLOAD_PORT="${1:-192.168.4.1}"
export PLATFORMIO_OFFLINE=1

exec pio run -e esp32-s3-ota -t upload --upload-port "$UPLOAD_PORT" "${@:2}"
