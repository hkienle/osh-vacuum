import type { MotorRampConfig } from '@/hooks/useMotorRampTest';
import { formatRampSequence, isXiaomiGMotor, rampStepLabel } from '@/lib/motorProfiles';

export interface MotorRampSample {
  elapsedSec: number;
  timestampMs: number;
  targetSpeedPercent: number | null;
  stepIndex: number;
  rpm: number | null;
  voltage: number | null;
  temperatureC: number | null;
}

export interface MotorRampTestLog {
  version: 1;
  type: 'motor_ramp_test';
  startedAt: string;
  endedAt: string;
  phase: 'completed' | 'stopped';
  config: MotorRampConfig;
  steps: number[];
  motorType?: number;
  motorProfile?: 'generic-pwm' | 'xiaomi-g';
  stepLabels?: string[];
  samples: MotorRampSample[];
}

export function buildMotorRampTestLog(params: {
  phase: 'completed' | 'stopped';
  config: MotorRampConfig;
  steps: number[];
  samples: MotorRampSample[];
  startedAtMs: number;
  endedAtMs: number;
  motorType?: number;
}): MotorRampTestLog {
  const xiaomi = isXiaomiGMotor(params.motorType);
  return {
    version: 1,
    type: 'motor_ramp_test',
    startedAt: new Date(params.startedAtMs).toISOString(),
    endedAt: new Date(params.endedAtMs).toISOString(),
    phase: params.phase,
    config: params.config,
    steps: params.steps,
    ...(params.motorType !== undefined ? { motorType: params.motorType } : {}),
    ...(xiaomi
      ? {
          motorProfile: 'xiaomi-g' as const,
          stepLabels: params.steps.map((p) => rampStepLabel(params.motorType, p) ?? `${p}%`),
        }
      : {}),
    samples: params.samples,
  };
}

function rampTestFilename(ext: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `motor-ramp-test-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.${ext}`;
}

export function downloadTextFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  downloadBlob(blob, filename);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadMotorRampJson(log: MotorRampTestLog) {
  downloadTextFile(JSON.stringify(log, null, 2), rampTestFilename('json'), 'application/json;charset=utf-8');
}

interface SeriesDef {
  label: string;
  color: string;
  unit: string;
  values: (number | null)[];
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function finiteValues(values: (number | null)[]): number[] {
  return values.filter((v): v is number => v !== null && Number.isFinite(v));
}

function buildLinePath(xs: number[], ys: number[]): string {
  if (xs.length === 0) return '';
  let d = `M ${xs[0]} ${ys[0]}`;
  for (let i = 1; i < xs.length; i++) {
    d += ` L ${xs[i]} ${ys[i]}`;
  }
  return d;
}

function formatProtocolDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' });
}

function formatRange(values: (number | null)[], decimals: number, unit: string): string {
  const finite = finiteValues(values);
  if (finite.length === 0) return '—';
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  if (decimals > 0) {
    return `${min.toFixed(decimals)}–${max.toFixed(decimals)} ${unit}`;
  }
  return `${Math.round(min)}–${Math.round(max)} ${unit}`;
}

function yDomainForSeries(unit: string, values: (number | null)[]): [number, number] {
  const finite = finiteValues(values);
  if (finite.length === 0) {
    if (unit === '%') return [0, 100];
    if (unit === 'RPM') return [0, 100];
    return [0, 1];
  }

  let yMin = Math.min(...finite);
  let yMax = Math.max(...finite);

  if (unit === '%') {
    yMin = Math.max(0, yMin);
    yMax = Math.min(100, yMax);
    if (yMin === yMax) {
      yMin = Math.max(0, yMin - 10);
      yMax = Math.min(100, yMax + 10);
    }
  } else if (unit === 'RPM' && yMax <= 0) {
    yMin = 0;
    yMax = 100;
  } else if (yMin === yMax) {
    yMin -= 1;
    yMax += 1;
  }

  const pad = (yMax - yMin) * 0.08 || 0.5;
  return [yMin - pad, yMax + pad];
}

function buildProtocolHeaderSvg(log: MotorRampTestLog, width: number): { markup: string; height: number } {
  const pad = 20;
  const startMs = new Date(log.startedAt).getTime();
  const endMs = new Date(log.endedAt).getTime();
  const durationSec = Number.isFinite(startMs) && Number.isFinite(endMs)
    ? Math.max(0, Math.round((endMs - startMs) / 1000))
    : 0;
  const resultLabel = log.phase === 'completed' ? 'Completed' : 'Stopped early';
  const sequence = formatRampSequence(log.motorType, log.steps);
  const { config } = log;
  const xiaomi = isXiaomiGMotor(log.motorType);

  const leftCol = [
    `Started: ${formatProtocolDate(log.startedAt)}`,
    `Ended: ${formatProtocolDate(log.endedAt)}`,
    `Duration: ${durationSec}s`,
    `Result: ${resultLabel}`,
    ...(xiaomi ? ['Motor: Xiaomi G (Eco / Mid / Boost)'] : []),
  ];
  const rightCol = xiaomi
    ? [
        `Hold: ${config.holdSec}s per step`,
        `Samples: ${log.samples.length}`,
        `RPM: ${formatRange(log.samples.map((s) => s.rpm), 0, 'RPM')}`,
        `Voltage: ${formatRange(log.samples.map((s) => s.voltage), 1, 'V')}`,
      ]
    : [
        `Start: ${config.startPercent}%`,
        `End: ${config.endPercent}%`,
        `Step: ${config.stepPercent}%`,
        `Hold: ${config.holdSec}s per step`,
        `Samples: ${log.samples.length}`,
        `RPM: ${formatRange(log.samples.map((s) => s.rpm), 0, 'RPM')}`,
        `Voltage: ${formatRange(log.samples.map((s) => s.voltage), 1, 'V')}`,
      ];

  const lineHeight = 16;
  const titleY = pad + 18;
  const subtitleY = titleY + 20;
  const colsTop = subtitleY + 14;
  const leftLines = leftCol
    .map((line, i) => `<text x="${pad}" y="${colsTop + i * lineHeight}" font-family="system-ui,sans-serif" font-size="11" fill="#374151">${escapeXml(line)}</text>`)
    .join('');
  const rightLines = rightCol
    .map((line, i) => `<text x="${width / 2 + 8}" y="${colsTop + i * lineHeight}" font-family="system-ui,sans-serif" font-size="11" fill="#374151">${escapeXml(line)}</text>`)
    .join('');
  const sequenceY = colsTop + Math.max(leftCol.length, rightCol.length) * lineHeight + 10;
  const headerHeight = sequenceY + 28;

  return {
    height: headerHeight,
    markup: `
      <rect x="0" y="0" width="${width}" height="${headerHeight}" fill="#f9fafb"/>
      <line x1="${pad}" y1="${headerHeight - 1}" x2="${width - pad}" y2="${headerHeight - 1}" stroke="#e5e7eb" stroke-width="1"/>
      <text x="${pad}" y="${titleY}" font-family="system-ui,sans-serif" font-size="16" font-weight="700" fill="#111827">Motor Ramp Test — Testprotokoll</text>
      <text x="${pad}" y="${subtitleY}" font-family="system-ui,sans-serif" font-size="11" fill="#6b7280">caznic connect · speed ramp characterization</text>
      ${leftLines}
      ${rightLines}
      <text x="${pad}" y="${sequenceY}" font-family="system-ui,sans-serif" font-size="10" font-weight="600" fill="#6b7280">Sequence</text>
      <text x="${pad}" y="${sequenceY + 14}" font-family="ui-monospace,monospace" font-size="10" fill="#111827">${escapeXml(sequence)}</text>
    `,
  };
}

export function buildMotorRampChartsSvg(
  log: MotorRampTestLog,
  colors: { speed: string; rpm: string; voltage: string } = {
    speed: '#6366f1',
    rpm: '#818cf8',
    voltage: '#34d399',
  },
): string {
  const samples = log.samples;
  if (samples.length === 0) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="120"><text x="20" y="60" font-family="system-ui,sans-serif" font-size="14" fill="#666">No samples recorded</text></svg>';
  }

  const width = 720;
  const chartHeight = 118;
  const chartGap = 18;
  const margin = { top: 24, right: 20, bottom: 22, left: 52 };
  const plotW = width - margin.left - margin.right;
  const header = buildProtocolHeaderSvg(log, width);
  const chartsTop = header.height + 12;

  const times = samples.map((s) => s.elapsedSec);
  const tMin = times[0] ?? 0;
  const tMax = times[times.length - 1] ?? tMin + 1;
  const tSpan = Math.max(tMax - tMin, 1);

  const seriesList: SeriesDef[] = [
    {
      label: 'Target speed',
      color: colors.speed,
      unit: '%',
      values: samples.map((s) => s.targetSpeedPercent),
    },
    {
      label: 'RPM',
      color: colors.rpm,
      unit: 'RPM',
      values: samples.map((s) => s.rpm),
    },
    {
      label: 'Voltage',
      color: colors.voltage,
      unit: 'V',
      values: samples.map((s) => s.voltage),
    },
  ];

  const charts = seriesList
    .map((series, chartIndex) => {
      const panelTop = chartsTop + chartIndex * (chartHeight + chartGap);
      const plotTop = panelTop + margin.top;
      const plotH = chartHeight - margin.top - margin.bottom;
      const [yMin, yMax] = yDomainForSeries(series.unit, series.values);
      const ySpan = yMax - yMin;

      const xs: number[] = [];
      const ys: number[] = [];
      samples.forEach((_sample, i) => {
        const v = series.values[i];
        if (v === null || !Number.isFinite(v)) return;
        xs.push(margin.left + ((times[i] - tMin) / tSpan) * plotW);
        ys.push(plotTop + plotH - ((v - yMin) / ySpan) * plotH);
      });

      const yTicks = [yMin, yMin + ySpan * 0.5, yMax];
      const yTickLines = yTicks
        .map((tick) => {
          const y = plotTop + plotH - ((tick - yMin) / ySpan) * plotH;
          return `<line x1="${margin.left}" y1="${y}" x2="${margin.left + plotW}" y2="${y}" stroke="#e5e7eb" stroke-width="1"/>`;
        })
        .join('');

      const yLabels = yTicks
        .map((tick) => {
          const y = plotTop + plotH - ((tick - yMin) / ySpan) * plotH;
          const text = series.unit === 'V' ? tick.toFixed(1) : String(Math.round(tick));
          return `<text x="${margin.left - 8}" y="${y + 4}" text-anchor="end" font-family="ui-monospace,monospace" font-size="10" fill="#6b7280">${text}</text>`;
        })
        .join('');

      const xLabels =
        chartIndex === seriesList.length - 1
          ? [tMin, tMin + tSpan * 0.5, tMax]
              .map((tick) => {
                const x = margin.left + ((tick - tMin) / tSpan) * plotW;
                return `<text x="${x}" y="${panelTop + chartHeight - 4}" text-anchor="middle" font-family="ui-monospace,monospace" font-size="10" fill="#6b7280">${tick.toFixed(0)}s</text>`;
              })
              .join('')
          : '';

      return `
        <rect x="12" y="${panelTop}" width="${width - 24}" height="${chartHeight}" rx="6" fill="#ffffff" stroke="#e5e7eb" stroke-width="1"/>
        <text x="${margin.left}" y="${panelTop + 16}" font-family="system-ui,sans-serif" font-size="12" font-weight="600" fill="#111827">${escapeXml(series.label)} (${series.unit})</text>
        ${yTickLines}
        ${yLabels}
        ${xLabels}
        <path d="${buildLinePath(xs, ys)}" fill="none" stroke="${series.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      `;
    })
    .join('');

  const totalHeight = chartsTop + seriesList.length * chartHeight + (seriesList.length - 1) * chartGap + 16;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}" viewBox="0 0 ${width} ${totalHeight}">
  <rect width="100%" height="100%" fill="#ffffff"/>
  ${header.markup}
  ${charts}
</svg>`;
}

export function downloadMotorRampSvg(log: MotorRampTestLog, colors?: { speed: string; rpm: string; voltage: string }) {
  const svg = buildMotorRampChartsSvg(log, colors);
  downloadTextFile(svg, rampTestFilename('svg'), 'image/svg+xml;charset=utf-8');
}

export async function svgToPngBlob(svg: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas not available'));
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((png) => {
        URL.revokeObjectURL(url);
        if (png) resolve(png);
        else reject(new Error('PNG export failed'));
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('SVG render failed'));
    };
    img.src = url;
  });
}

export async function downloadMotorRampPng(log: MotorRampTestLog, colors?: { speed: string; rpm: string; voltage: string }) {
  const svg = buildMotorRampChartsSvg(log, colors);
  const png = await svgToPngBlob(svg);
  downloadBlob(png, rampTestFilename('png'));
}

export async function exportMotorRampTestResults(
  log: MotorRampTestLog,
  colors?: { speed: string; rpm: string; voltage: string },
) {
  downloadMotorRampJson(log);
  downloadMotorRampSvg(log, colors);
  await downloadMotorRampPng(log, colors);
}
