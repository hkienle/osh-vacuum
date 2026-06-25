import { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useWebSocketContext } from '@/contexts/WebSocketContext';
import { getRampSteps, useMotorRampTest, type MotorRampConfig } from '@/hooks/useMotorRampTest';
import { formatRampSequence, isMotorRampOffStep, isXiaomiGMotor, rampStepLabel } from '@/lib/motorProfiles';
import { useDeviceSettings } from '@/hooks/useDeviceSettings';
import {
  downloadMotorRampJson,
  downloadMotorRampPng,
  downloadMotorRampSvg,
  exportMotorRampTestResults,
  type MotorRampTestLog,
} from '@/lib/motorRampTestExport';
import { chartColors } from '@/lib/themeColors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';

const DEFAULT_CONFIG: MotorRampConfig = {
  startPercent: 0,
  endPercent: 100,
  stepPercent: 10,
  holdSec: 2,
};

interface MotorRampTestPanelProps {
  onBusyChange?: (busy: boolean) => void;
}

export function MotorRampTestPanel({ onBusyChange }: MotorRampTestPanelProps) {
  const { connected, sendMessage, lastMessage } = useWebSocketContext();
  const { resolvedTheme } = useTheme();
  const colors = useMemo(() => chartColors(), [resolvedTheme]);
  const exportColors = useMemo(
    () => ({ speed: '#6366f1', rpm: colors.rpm, voltage: colors.voltage }),
    [colors],
  );

  const [config, setConfig] = useState<MotorRampConfig>(DEFAULT_CONFIG);
  const [draft, setDraft] = useState({
    startPercent: String(DEFAULT_CONFIG.startPercent),
    endPercent: String(DEFAULT_CONFIG.endPercent),
    stepPercent: String(DEFAULT_CONFIG.stepPercent),
    holdSec: String(DEFAULT_CONFIG.holdSec),
  });
  const [exportNote, setExportNote] = useState<string | null>(null);
  const autoExportedLogRef = useRef<string | null>(null);

  const { motorType: settingsMotorType, values: settingsValues } = useDeviceSettings({ enabled: connected });
  const motorType =
    typeof lastMessage?.motor_type === 'number'
      ? lastMessage.motor_type
      : typeof settingsValues.mtr_type === 'number'
        ? settingsValues.mtr_type
        : settingsMotorType;
  const xiaomiMotor = isXiaomiGMotor(motorType);

  const {
    phase,
    isRunning,
    stepIndex,
    totalSteps,
    currentSpeed,
    elapsedSec,
    holdRemainingSec,
    liveRpm,
    liveVoltage,
    samples,
    log,
    startTest,
    stopTest,
    resetTest,
  } = useMotorRampTest({ connected, lastMessage, sendMessage, motorType });

  useEffect(() => {
    onBusyChange?.(isRunning);
  }, [isRunning, onBusyChange]);

  useEffect(() => {
    if (!log || log.samples.length === 0) return;
    const key = `${log.startedAt}:${log.endedAt}`;
    if (autoExportedLogRef.current === key) return;
    autoExportedLogRef.current = key;

    void exportMotorRampTestResults(log, exportColors)
      .then(() => {
        setExportNote('JSON, SVG, and PNG exported automatically.');
      })
      .catch(() => {
        setExportNote('Auto-export failed — use the download buttons below.');
      });
  }, [exportColors, log]);

  const parseField = (value: string, min: number, max: number): number | null => {
    if (value.trim() === '') return null;
    const n = Number.parseInt(value, 10);
    if (!Number.isFinite(n) || n < min || n > max) return null;
    return Math.round(n);
  };

  const parsedConfig = useMemo(() => {
    const holdSec = parseField(draft.holdSec, 1, 60);
    if (holdSec === null) return null;
    if (xiaomiMotor) {
      return { ...DEFAULT_CONFIG, holdSec };
    }
    const startPercent = parseField(draft.startPercent, 0, 100);
    const endPercent = parseField(draft.endPercent, 0, 100);
    const stepPercent = parseField(draft.stepPercent, 1, 100);
    if (startPercent === null || endPercent === null || stepPercent === null) {
      return null;
    }
    return { startPercent, endPercent, stepPercent, holdSec };
  }, [draft, xiaomiMotor]);

  const previewSteps = useMemo(() => {
    if (!parsedConfig) return [];
    return getRampSteps(motorType, parsedConfig);
  }, [motorType, parsedConfig]);

  const chartData = useMemo(
    () =>
      samples.map((s) => ({
        t: s.elapsedSec,
        speed:
          s.targetSpeedPercent !== null && !isMotorRampOffStep(s.targetSpeedPercent)
            ? s.targetSpeedPercent
            : undefined,
        rpm: s.rpm ?? undefined,
        voltage: s.voltage ?? undefined,
      })),
    [samples],
  );

  const isFinished = phase === 'completed' || phase === 'stopped';
  const canStart = connected && !isRunning && parsedConfig !== null && previewSteps.length > 0;
  const hasResults = samples.length > 0 && log !== null;

  const setFromSlider = (key: keyof MotorRampConfig, value: number) => {
    const rounded = Math.round(value);
    setConfig((prev) => ({ ...prev, [key]: rounded }));
    setDraft((prev) => ({ ...prev, [key]: String(rounded) }));
  };

  const setDraftOnly = (key: keyof MotorRampConfig, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    resetTest();
    autoExportedLogRef.current = null;
    setExportNote(null);
    setConfig(DEFAULT_CONFIG);
    setDraft({
      startPercent: String(DEFAULT_CONFIG.startPercent),
      endPercent: String(DEFAULT_CONFIG.endPercent),
      stepPercent: String(DEFAULT_CONFIG.stepPercent),
      holdSec: String(DEFAULT_CONFIG.holdSec),
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-lg border p-4">
        <h3 className="font-medium">Ramp settings</h3>
        {xiaomiMotor ? (
          <p className="text-sm text-muted-foreground">
            Xiaomi G uses three ESC speeds plus off. The ramp steps through Off → Eco (33%) → Mid (67%) → Boost (100%), holding each for {config.holdSec}s.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Steps through motor speed in {config.stepPercent}% increments, holding each level for {config.holdSec}s.
          </p>
        )}

        <div className="space-y-4">
          {!xiaomiMotor && (
            <>
              <SliderField label="Start (%)" min={0} max={100} step={1} value={config.startPercent} draft={draft.startPercent} disabled={isRunning} onSlider={(v) => setFromSlider('startPercent', v)} onDraft={(v) => setDraftOnly('startPercent', v)} />
              <SliderField label="End (%)" min={0} max={100} step={1} value={config.endPercent} draft={draft.endPercent} disabled={isRunning} onSlider={(v) => setFromSlider('endPercent', v)} onDraft={(v) => setDraftOnly('endPercent', v)} />
              <SliderField label="Step (%)" min={1} max={50} step={1} value={config.stepPercent} draft={draft.stepPercent} disabled={isRunning} onSlider={(v) => setFromSlider('stepPercent', v)} onDraft={(v) => setDraftOnly('stepPercent', v)} />
            </>
          )}
          <SliderField label="Hold per step (s)" min={1} max={30} step={1} value={config.holdSec} draft={draft.holdSec} disabled={isRunning} onSlider={(v) => setFromSlider('holdSec', v)} onDraft={(v) => setDraftOnly('holdSec', v)} />
        </div>

        {previewSteps.length > 0 && (
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p className="mb-2 font-medium">Sequence ({previewSteps.length} steps)</p>
            <p className="font-mono text-xs leading-relaxed text-muted-foreground">
              {formatRampSequence(motorType, previewSteps)}
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button className="rounded-full" disabled={!canStart} onClick={() => parsedConfig && startTest(parsedConfig)}>
            Start ramp
          </Button>
          <Button variant="destructive" className="rounded-full" disabled={!isRunning} onClick={stopTest}>
            Stop
          </Button>
          <Button variant="outline" className="rounded-full" disabled={isRunning} onClick={handleReset}>
            Reset
          </Button>
        </div>

        {!connected && <p className="text-sm text-amber-600 dark:text-amber-400">ESP32 not connected.</p>}
        {!isRunning && parsedConfig === null && (
          <p className="text-sm text-amber-600 dark:text-amber-400">Please fill all values with valid ranges.</p>
        )}
      </div>

      <div className="space-y-4 rounded-lg border p-4">
        <h3 className="font-medium">{isRunning ? 'Live ramp' : 'Status'}</h3>

        {isFinished && (
          <div className="rounded-lg border border-dashed p-3 text-sm">
            <p className="font-medium">{phase === 'completed' ? 'Ramp completed' : 'Ramp stopped'}</p>
            {currentSpeed !== null && (
              <p>
                Last target:{' '}
                {isMotorRampOffStep(currentSpeed)
                  ? 'Off'
                  : rampStepLabel(motorType, currentSpeed)
                    ? `${currentSpeed}% (${rampStepLabel(motorType, currentSpeed)})`
                    : `${currentSpeed}%`}
              </p>
            )}
            {exportNote && <p className="text-muted-foreground">{exportNote}</p>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
          <Stat label="Phase" value={phase} />
          <Stat label="Step" value={totalSteps > 0 ? `${stepIndex + 1} / ${totalSteps}` : '—'} />
          <Stat
            label="Target"
            value={
              currentSpeed !== null
                ? isMotorRampOffStep(currentSpeed)
                  ? 'Off'
                  : rampStepLabel(motorType, currentSpeed)
                    ? `${currentSpeed}% (${rampStepLabel(motorType, currentSpeed)})`
                    : `${currentSpeed}%`
                : '—'
            }
          />
          <Stat label="Elapsed" value={`${elapsedSec}s`} />
          <Stat label="Hold left" value={isRunning ? `${holdRemainingSec}s` : '—'} />
          <Stat label="RPM" value={Number.isFinite(liveRpm) ? String(Math.round(Number(liveRpm))) : '—'} />
          <Stat label="Voltage" value={Number.isFinite(liveVoltage) ? `${Number(liveVoltage).toFixed(2)}V` : '—'} />
        </div>

        {totalSteps > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>{totalSteps > 0 ? Math.round(((stepIndex + (isRunning ? 0 : 1)) / totalSteps) * 100) : 0}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{
                  width: `${totalSteps > 0 ? Math.min(100, Math.round(((stepIndex + (phase === 'completed' ? 1 : 0)) / totalSteps) * 100)) : 0}%`,
                }}
              />
            </div>
          </div>
        )}

        {chartData.length > 0 && (
          <>
            <Separator />
            <RampCharts data={chartData} colors={exportColors} />
          </>
        )}

        {hasResults && log && (
          <>
            <Separator />
            <ExportSection log={log} colors={exportColors} motorType={motorType} />
          </>
        )}
      </div>
    </div>
  );
}

function RampCharts({
  data,
  colors,
}: {
  data: { t: number; speed?: number; rpm?: number; voltage?: number }[];
  colors: { speed: string; rpm: string; voltage: string };
}) {
  return (
    <div className="space-y-4">
      <MetricChart title="Target speed" unit="%" color={colors.speed} data={data} dataKey="speed" />
      <MetricChart title="RPM" unit="RPM" color={colors.rpm} data={data} dataKey="rpm" />
      <MetricChart title="Voltage" unit="V" color={colors.voltage} data={data} dataKey="voltage" decimals={2} />
    </div>
  );
}

function MetricChart({
  title,
  unit,
  color,
  data,
  dataKey,
  decimals = 0,
}: {
  title: string;
  unit: string;
  color: string;
  data: { t: number; speed?: number; rpm?: number; voltage?: number }[];
  dataKey: 'speed' | 'rpm' | 'voltage';
  decimals?: number;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</p>
      <div className="h-36 w-full rounded-lg border bg-muted/20 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <XAxis dataKey="t" tickFormatter={(v) => `${v}s`} stroke="currentColor" className="text-muted-foreground" fontSize={10} />
            <YAxis stroke={color} width={40} fontSize={10} tickFormatter={(v) => (decimals > 0 ? Number(v).toFixed(decimals) : String(Math.round(Number(v))))} />
            <Tooltip
              labelFormatter={(label) => `Time: ${label}s`}
              formatter={(value) => {
                const n = Number(value);
                return decimals > 0 ? `${n.toFixed(decimals)} ${unit}` : `${Math.round(n)} ${unit}`;
              }}
            />
            <Line type="monotone" dataKey={dataKey} stroke={color} dot={false} strokeWidth={2} isAnimationActive={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ExportSection({
  log,
  colors,
  motorType,
}: {
  log: MotorRampTestLog;
  colors: { speed: string; rpm: string; voltage: string };
  motorType?: number;
}) {
  const jsonPreview = useMemo(() => JSON.stringify(log, null, 2), [log]);
  const durationSec = useMemo(() => {
    const start = new Date(log.startedAt).getTime();
    const end = new Date(log.endedAt).getTime();
    return Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, Math.round((end - start) / 1000)) : 0;
  }, [log.endedAt, log.startedAt]);

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">Testprotokoll &amp; exports</h4>

      <div className="rounded-lg border bg-muted/30 p-3 text-sm">
        <p className="font-medium">Motor ramp test</p>
        <dl className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
          <div><dt className="inline">Started: </dt><dd className="inline font-mono text-foreground">{new Date(log.startedAt).toLocaleString()}</dd></div>
          <div><dt className="inline">Ended: </dt><dd className="inline font-mono text-foreground">{new Date(log.endedAt).toLocaleString()}</dd></div>
          <div><dt className="inline">Duration: </dt><dd className="inline font-mono text-foreground">{durationSec}s</dd></div>
          <div><dt className="inline">Result: </dt><dd className="inline font-mono text-foreground">{log.phase === 'completed' ? 'Completed' : 'Stopped early'}</dd></div>
          <div><dt className="inline">Ramp: </dt><dd className="inline font-mono text-foreground">{isXiaomiGMotor(motorType) ? `Xiaomi G · ${log.config.holdSec}s hold` : `${log.config.startPercent}% → ${log.config.endPercent}% / ${log.config.stepPercent}% / ${log.config.holdSec}s`}</dd></div>
          <div><dt className="inline">Samples: </dt><dd className="inline font-mono text-foreground">{log.samples.length}</dd></div>
        </dl>
        <p className="mt-2 font-mono text-[11px] leading-relaxed text-foreground">{formatRampSequence(motorType ?? log.motorType, log.steps)}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => downloadMotorRampJson(log)}>
          Download JSON
        </Button>
        <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => downloadMotorRampSvg(log, colors)}>
          Download SVG
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => void downloadMotorRampPng(log, colors)}
        >
          Download PNG
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => void exportMotorRampTestResults(log, colors)}
        >
          Download all
        </Button>
      </div>
      <details>
        <summary className="cursor-pointer text-sm font-medium">JSON log preview</summary>
        <textarea className="mt-2 h-40 w-full rounded-md border bg-muted/30 p-2 font-mono text-xs" readOnly value={jsonPreview} />
      </details>
    </div>
  );
}

function SliderField({ label, min, max, step, value, draft, disabled, onSlider, onDraft }: {
  label: string; min: number; max: number; step: number; value: number; draft: string; disabled: boolean;
  onSlider: (v: number) => void; onDraft: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Slider min={min} max={max} step={step} value={[value]} disabled={disabled} onValueChange={(v) => onSlider(v[0] ?? value)} />
      <Input type="text" inputMode="numeric" value={draft} disabled={disabled} onChange={(e) => onDraft(e.target.value)} className="font-mono" />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
