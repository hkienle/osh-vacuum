import type { DevSettingPreview, Display15Scenario, DisplayTelemetry } from './types';
import { DISPLAY_HEIGHT, DISPLAY_WIDTH, OTA_GRAY } from './types';
import { defaultDevSetting } from './scenarios';

const WHITE = '#ffffff';
const BLACK = '#000000';

/** Adafruit GFX classic font: 6×8 px per text-size unit. */
function setTextSize(ctx: CanvasRenderingContext2D, size: number): void {
  const px = 6 * size;
  ctx.font = `${px}px "Courier New", Courier, monospace`;
  ctx.textBaseline = 'top';
}

function textWidth(ctx: CanvasRenderingContext2D, text: string): number {
  return ctx.measureText(text).width;
}

function clearDisplay(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = BLACK;
  ctx.fillRect(0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT);
  ctx.fillStyle = WHITE;
}

function printAt(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  ctx.fillText(text, x, y);
}

function drawBoldText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  printAt(ctx, text, x, y);
  printAt(ctx, text, x + 1, y);
}

function printRight(ctx: CanvasRenderingContext2D, text: string, y: number, textSize: number): void {
  setTextSize(ctx, textSize);
  ctx.fillStyle = WHITE;
  const w = textWidth(ctx, text);
  printAt(ctx, text, DISPLAY_WIDTH - w, y);
}

function formatRpmFull(rpm: number, rpmReady: boolean): string {
  if (!rpmReady) return '----';
  const rounded = Math.max(0, Math.round(rpm));
  return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function drawBatterySocLabel(
  ctx: CanvasRenderingContext2D,
  batteryIconRightX: number,
  y: number,
  socPercent: number,
  motorActive: boolean,
): void {
  if (motorActive) return;
  setTextSize(ctx, 1);
  const label = socPercent < 0 ? '--%' : `${socPercent}%`;
  const w = textWidth(ctx, label);
  printAt(ctx, label, batteryIconRightX - 2 - w, y);
}

function drawBatteryIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  socPercent: number,
  motorActive: boolean,
  nowMs: number,
): void {
  const bodyW = 18;
  const bodyH = 10;
  const capW = 3;
  const capH = 5;
  const innerX = x + 2;
  const innerY = y + 2;
  const innerW = bodyW - 4;
  const innerH = bodyH - 4;
  const segW = 4;
  const gap = 1;
  const seg0X = innerX;
  const seg1X = innerX + segW + gap;
  const seg2X = innerX + (segW + gap) * 2;

  ctx.strokeStyle = WHITE;
  ctx.strokeRect(x, y, bodyW, bodyH);
  ctx.fillRect(x + bodyW, y + 2, capW, capH);

  if (motorActive) {
    for (let dy = 0; dy < innerH; dy++) {
      for (let dx = 0; dx < innerW; dx++) {
        if (((dx + dy) & 1) === 0) {
          ctx.fillRect(innerX + dx, innerY + dy, 1, 1);
        }
      }
    }
    return;
  }

  if (socPercent < 0) return;

  const fillSeg = (sx: number) => ctx.fillRect(sx, innerY, segW, innerH);

  if (socPercent >= 80) {
    fillSeg(seg0X);
    fillSeg(seg1X);
    fillSeg(seg2X);
  } else if (socPercent >= 30) {
    fillSeg(seg0X);
    fillSeg(seg1X);
  } else if (socPercent >= 15) {
    fillSeg(seg0X);
  } else if (Math.floor(nowMs / 500) % 2 === 0) {
    fillSeg(seg0X);
  }
}

function drawInterfaceFrame(
  ctx: CanvasRenderingContext2D,
  suctionLabel: string,
  topLine: string,
  tempLine: string,
  fillW: number,
  socPercent: number,
  motorActive: boolean,
  nowMs: number,
): void {
  const barX = 4;
  const barY = 108;
  const barW = 120;
  const barH = 10;
  const innerX = barX + 3;
  const innerY = barY + 2;
  const innerH = barH - 4;
  const batteryIconX = 102;

  clearDisplay(ctx);
  ctx.fillStyle = WHITE;

  if (motorActive) {
    setTextSize(ctx, 1);
    printAt(ctx, suctionLabel, 6, 10);
    setTextSize(ctx, 3);
    printAt(ctx, topLine, 28, 26);
  } else {
    setTextSize(ctx, 3);
    printAt(ctx, topLine, 6, 26);
  }

  setTextSize(ctx, 2);
  printAt(ctx, tempLine, 6, 64);

  drawBatterySocLabel(ctx, batteryIconX, 10, socPercent, motorActive);
  drawBatteryIcon(ctx, batteryIconX, 10, socPercent, motorActive, nowMs);

  ctx.strokeRect(barX, barY, barW, barH);
  if (fillW > 0) {
    ctx.fillRect(innerX, innerY, fillW, innerH);
  }
}

function buildMainLines(t: DisplayTelemetry, nowMs: number): {
  suctionLabel: string;
  topLine: string;
  tempLine: string;
} {
  let suctionLabel = 'RPM';
  let topLine = 'Start';
  const tempLine = `T ${t.temperatureC.toFixed(1)}C`;

  if (t.motorActive) {
    switch (t.motorDisplayMode) {
      case 0:
        suctionLabel = '%';
        topLine = String(t.speedPercent);
        break;
      case 1:
        suctionLabel = 'V';
        topLine = t.batteryVoltage.toFixed(2);
        break;
      case 2:
        suctionLabel = 'RPM';
        topLine = formatRpmFull(t.rpm, t.rpmReady);
        break;
      case 3:
      default:
        suctionLabel = 'C';
        topLine = t.motorTemperatureReady ? t.temperatureC.toFixed(1) : '----';
        break;
    }
  } else if (t.triggerHeld) {
    const phase = Math.floor((nowMs % 1500) / 500);
    topLine = phase === 0 ? 'Hold.' : phase === 1 ? 'Hold..' : 'Hold...';
  }

  return { suctionLabel, topLine, tempLine };
}

function drawDevSettingPage(ctx: CanvasRenderingContext2D, d: DevSettingPreview): void {
  const titleY = 4;
  const subY = 36;
  clearDisplay(ctx);
  ctx.fillStyle = WHITE;
  setTextSize(ctx, 2);
  drawBoldText(ctx, d.title, 6, titleY);
  printRight(ctx, d.value, titleY, 3);
  setTextSize(ctx, 2);
  printAt(ctx, d.subline ?? '', 6, subY);
}

function drawInfoPage(ctx: CanvasRenderingContext2D, scenario: Display15Scenario): void {
  const t = scenario.telemetry;
  const page = t.displayInfoPage;
  clearDisplay(ctx);
  ctx.fillStyle = WHITE;

  switch (page) {
    case 0: {
      setTextSize(ctx, 2);
      drawBoldText(ctx, 'Maximum Stats', 10, 8);
      setTextSize(ctx, 1);
      printAt(
        ctx,
        t.maxStatsHasRpm ? `RPM: ${t.maxStatsRpm}` : 'RPM: --',
        8,
        34,
      );
      printAt(
        ctx,
        t.maxStatsHasVoltage ? `Volt.: ${t.maxStatsVoltageV.toFixed(2)}V` : 'Volt.: --',
        8,
        48,
      );
      printAt(
        ctx,
        t.maxStatsHasMotorTemp ? `Temp.: ${t.maxStatsMotorTempC.toFixed(1)}C` : 'Temp.: --',
        8,
        62,
      );
      printAt(ctx, 'Hold trig 2s: clear', 8, 76);
      break;
    }
    case 1: {
      setTextSize(ctx, 2);
      drawBoldText(ctx, 'Battery Info', 14, 8);
      setTextSize(ctx, 1);
      printAt(ctx, `Series: ${t.batterySeriesCells} cells`, 8, 34);
      const cellV = t.batterySeriesCells > 0 ? t.batteryVoltage / t.batterySeriesCells : 0;
      printAt(ctx, `Volt: ${t.batteryVoltage.toFixed(2)}V / ${cellV.toFixed(3)}V`, 8, 48);
      printAt(
        ctx,
        t.motorActive || t.batterySocPercent < 0
          ? 'SOC: --%'
          : `SOC: ${t.batterySocPercent}%`,
        8,
        62,
      );
      break;
    }
    case 2: {
      const wifi = scenario.wifi ?? { ssid: 'osh-vac', ip: '192.168.4.1', rssi: -62, apMode: false };
      setTextSize(ctx, 2);
      drawBoldText(ctx, 'WiFi Info', 26, 8);
      setTextSize(ctx, 1);
      printAt(ctx, wifi.apMode ? 'SSID: Access-Point' : `SSID: ${wifi.ssid}`, 8, 36);
      printAt(ctx, `IP: ${wifi.ip}`, 8, 52);
      const rssiLine =
        wifi.rssi != null ? `RSSI: ${wifi.rssi} dBm` : wifi.apMode ? 'RSSI: AP mode' : 'RSSI: --';
      printAt(ctx, rssiLine, 8, 66);
      break;
    }
    case 3: {
      setTextSize(ctx, 2);
      drawBoldText(ctx, 'BLE-Info', 28, 8);
      setTextSize(ctx, 1);
      printAt(ctx, 'BLE: OFF', 8, 40);
      printAt(ctx, 'Name: n/a', 8, 56);
      printAt(ctx, 'Visible: No', 8, 72);
      break;
    }
    case 4: {
      setTextSize(ctx, 2);
      drawBoldText(ctx, 'Sensor Info', 18, 8);
      setTextSize(ctx, 1);
      printAt(
        ctx,
        t.motorTemperatureReady
          ? `MOT Temp: ${t.temperatureC.toFixed(1)}C`
          : 'MOT Temp: --.-C',
        8,
        36,
      );
      printAt(
        ctx,
        Number.isFinite(t.mcuTempC) ? `MCU Temp: ${t.mcuTempC.toFixed(1)}C` : 'MCU Temp: --.-C',
        8,
        52,
      );
      break;
    }
    case 5: {
      const hostname = scenario.hostname ?? 'osh-vac';
      const uptimeHours = Math.floor(t.uptimeSeconds / 3600);
      const uptimeMin = Math.floor((t.uptimeSeconds % 3600) / 60);
      setTextSize(ctx, 2);
      drawBoldText(ctx, 'System Info', 20, 8);
      setTextSize(ctx, 1);
      printAt(ctx, `Name: ${hostname}`, 8, 40);
      printAt(ctx, `Up since ${uptimeHours}h ${uptimeMin}m`, 8, 56);
      printAt(ctx, `Heap: ${Math.round((t.freeHeapBytes + 512) / 1024)} k`, 8, 72);
      break;
    }
    default:
      drawDevSettingPage(ctx, scenario.devSetting ?? defaultDevSetting());
      return;
  }
}

function drawOtaScreen(ctx: CanvasRenderingContext2D, percent: number): void {
  const pct = Math.min(100, Math.max(0, percent));
  const barX = 4;
  const barY = 100;
  const barW = 120;
  const barH = 20;
  const innerX = barX + 3;
  const innerY = barY + 3;
  const innerH = barH - 6;
  const innerW = barW - 6;

  clearDisplay(ctx);
  ctx.fillStyle = OTA_GRAY;
  setTextSize(ctx, 2);
  printAt(ctx, 'Update', 6, 4);
  setTextSize(ctx, 3);
  const pctBuf = `${pct}%`;
  const w = textWidth(ctx, pctBuf);
  printAt(ctx, pctBuf, DISPLAY_WIDTH - w, 0);
  ctx.strokeStyle = OTA_GRAY;
  ctx.strokeRect(barX, barY, barW, barH);
  const fillW = Math.round((innerW * pct) / 100);
  if (fillW > 0) {
    ctx.fillRect(innerX, innerY, fillW, innerH);
  }
}

/** Render a scenario onto a 128×128 canvas context. */
export function renderDisplay15(
  ctx: CanvasRenderingContext2D,
  scenario: Display15Scenario,
  nowMs = Date.now(),
): void {
  ctx.imageSmoothingEnabled = false;
  const t = scenario.telemetry;

  if (t.otaActive) {
    drawOtaScreen(ctx, t.otaProgressPercent);
    return;
  }

  if (t.displayInfoMode) {
    drawInfoPage(ctx, scenario);
    return;
  }

  const barW = 120;
  const innerW = barW - 6;
  const fillW = Math.round((innerW * t.speedPercent) / 100);
  const { suctionLabel, topLine, tempLine } = buildMainLines(t, nowMs);
  drawInterfaceFrame(
    ctx,
    suctionLabel,
    topLine,
    tempLine,
    fillW,
    t.batterySocPercent,
    t.motorActive,
    nowMs,
  );
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));
}

export function downloadCanvasPng(canvas: HTMLCanvasElement, filename: string): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

/** Create an off-screen 128×128 canvas (browser or export script). */
export function createDisplayCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = DISPLAY_WIDTH;
  canvas.height = DISPLAY_HEIGHT;
  return canvas;
}

export function renderScenarioToCanvas(
  scenario: Display15Scenario,
  nowMs = Date.now(),
): HTMLCanvasElement {
  const canvas = createDisplayCanvas();
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable');
  renderDisplay15(ctx, scenario, nowMs);
  return canvas;
}
