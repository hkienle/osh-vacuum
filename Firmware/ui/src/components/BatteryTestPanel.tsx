import { useEffect, useMemo, useState } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useWebSocketContext } from '@/contexts/WebSocketContext';
import { useBatteryTest, type BatteryTestConfig } from '@/hooks/useBatteryTest';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';

const DEFAULT_CONFIG: BatteryTestConfig = {
  speed: 60,
  onCycleSec: 20,
  stabilizationSec: 5,
  readingCount: 10,
  stopVoltage: 20.0,
  stopOnVoltage: true,
  stopOnDisconnect: true,
  stopOnRpm: true,
};

interface BatteryTestPanelProps {
  onBusyChange?: (busy: boolean) => void;
}

export function BatteryTestPanel({ onBusyChange }: BatteryTestPanelProps) {
  const { connected, lastMessage, sendMessage } = useWebSocketContext();
  const [includeTemperature, setIncludeTemperature] = useState(true);
  const [config, setConfig] = useState<BatteryTestConfig>(DEFAULT_CONFIG);
  const [draft, setDraft] = useState({
    speed: String(DEFAULT_CONFIG.speed),
    onCycleSec: String(DEFAULT_CONFIG.onCycleSec),
    stabilizationSec: String(DEFAULT_CONFIG.stabilizationSec),
    readingCount: String(DEFAULT_CONFIG.readingCount),
    stopVoltage: String(DEFAULT_CONFIG.stopVoltage),
  });
  const {
    phase,
    isRunning,
    isPaused,
    cycleIndex,
    data,
    errorMessage,
    totalUptimeSec,
    totalActiveRuntimeSec,
    lastMeasuredVoltage,
    lastMeasuredSoc,
    endCondition,
    csvFileName,
    csvContent,
    startTest,
    pauseTest,
    resumeTest,
    stopTest,
    resetTest,
    downloadCSV,
  } = useBatteryTest({ connected, lastMessage, sendMessage, includeTemperatureInExport: includeTemperature });

  useEffect(() => {
    onBusyChange?.(isRunning || isPaused);
  }, [isRunning, isPaused, onBusyChange]);

  const parseField = (value: string, min: number, max: number, isFloat = false): number | null => {
    if (value.trim() === '') return null;
    const n = isFloat ? Number(value) : Number.parseInt(value, 10);
    if (!Number.isFinite(n) || n < min || n > max) return null;
    return isFloat ? Math.round(n * 10) / 10 : Math.round(n);
  };

  const parsedConfig = useMemo(() => {
    const speed = parseField(draft.speed, 0, 100);
    const onCycleSec = parseField(draft.onCycleSec, 5, 120);
    const stabilizationSec = parseField(draft.stabilizationSec, 1, 120);
    const readingCount = parseField(draft.readingCount, 1, 50);
    const stopVoltage = parseField(draft.stopVoltage, 0, 36, true);
    if (speed === null || onCycleSec === null || stabilizationSec === null || readingCount === null || stopVoltage === null) {
      return null;
    }
    return { speed, onCycleSec, stabilizationSec, readingCount, stopVoltage };
  }, [draft]);

  const hasAnyEndCondition = config.stopOnVoltage || config.stopOnDisconnect || config.stopOnRpm;
  const canStart = connected && !isRunning && parsedConfig !== null && hasAnyEndCondition;
  const canDownload = data.length > 0;
  const isFinished = phase === 'completed' || phase === 'error';
  const showSetupPanel = !isRunning && !isFinished;

  const chartData = useMemo(
    () =>
      data.map((point) => ({
        t: point.totalUptimeSec,
        voltage: point.voltage,
        batteryPercent: point.batteryPercentage,
        temperatureC: point.temperatureC ?? undefined,
        avgRpm: point.avgRpm ?? undefined,
      })),
    [data],
  );

  const liveRpm = lastMessage?.rpm;
  const liveVoltage = lastMessage?.voltage ?? lastMessage?.battery;
  const liveTemp = lastMessage?.temperature ?? lastMessage?.temp;

  const setFromSlider = (key: keyof BatteryTestConfig, value: number) => {
    const rounded = key === 'stopVoltage' ? Math.round(value * 10) / 10 : Math.round(value);
    setConfig((prev) => ({ ...prev, [key]: rounded }));
    setDraft((prev) => ({ ...prev, [key]: String(rounded) }));
  };

  const setDraftOnly = (key: keyof BatteryTestConfig, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      {showSetupPanel && (
        <div className="space-y-4 rounded-lg border p-4">
          <h3 className="font-medium">Pre-Settings</h3>
          <div className="space-y-4">
            <SliderField label="Speed (%)" min={0} max={100} step={1} value={config.speed} draft={draft.speed} disabled={isRunning} onSlider={(v) => setFromSlider('speed', v)} onDraft={(v) => setDraftOnly('speed', v)} />
            <SliderField label="On-Cycle (s)" min={5} max={120} step={1} value={config.onCycleSec} draft={draft.onCycleSec} disabled={isRunning} onSlider={(v) => setFromSlider('onCycleSec', v)} onDraft={(v) => setDraftOnly('onCycleSec', v)} />
            <SliderField label="Stabilization (s)" min={1} max={120} step={1} value={config.stabilizationSec} draft={draft.stabilizationSec} disabled={isRunning} onSlider={(v) => setFromSlider('stabilizationSec', v)} onDraft={(v) => setDraftOnly('stabilizationSec', v)} hint="After motor off, then readings; then 2s pause before next run." />
            <SliderField label="Reading Count" min={1} max={50} step={1} value={config.readingCount} draft={draft.readingCount} disabled={isRunning} onSlider={(v) => setFromSlider('readingCount', v)} onDraft={(v) => setDraftOnly('readingCount', v)} />
            <SliderField label="Stop Voltage (V)" min={0} max={36} step={0.1} value={config.stopVoltage} draft={draft.stopVoltage} disabled={isRunning} onSlider={(v) => setFromSlider('stopVoltage', v)} onDraft={(v) => setDraftOnly('stopVoltage', v)} isFloat />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button className="rounded-full" disabled={!canStart} onClick={() => parsedConfig && startTest({ ...parsedConfig, stopOnVoltage: config.stopOnVoltage, stopOnDisconnect: config.stopOnDisconnect, stopOnRpm: config.stopOnRpm })}>
              Start Test
            </Button>
            <Button variant="destructive" className="rounded-full" disabled={!isRunning} onClick={stopTest}>Stop Test</Button>
            <Button variant="outline" className="rounded-full" disabled={!canDownload} onClick={downloadCSV}>Download CSV</Button>
            <Button variant="outline" className="rounded-full" disabled={isRunning} onClick={() => { resetTest(); setConfig(DEFAULT_CONFIG); setDraft({ speed: String(DEFAULT_CONFIG.speed), onCycleSec: String(DEFAULT_CONFIG.onCycleSec), stabilizationSec: String(DEFAULT_CONFIG.stabilizationSec), readingCount: String(DEFAULT_CONFIG.readingCount), stopVoltage: String(DEFAULT_CONFIG.stopVoltage) }); }}>
              New Test
            </Button>
          </div>

          {!connected && <p className="text-sm text-amber-600 dark:text-amber-400">ESP32 not connected.</p>}
          {!isRunning && parsedConfig === null && <p className="text-sm text-amber-600 dark:text-amber-400">Please fill all setup values with valid ranges.</p>}
          {!isRunning && !hasAnyEndCondition && <p className="text-sm text-amber-600 dark:text-amber-400">Please enable at least one end condition.</p>}
          {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

          <div className="space-y-2">
            <EndCondition label="Stop on Voltage" checked={config.stopOnVoltage} disabled={isRunning} onChange={(v) => setConfig((p) => ({ ...p, stopOnVoltage: v }))} />
            <EndCondition label="Stop on Disconnect" checked={config.stopOnDisconnect} disabled={isRunning} onChange={(v) => setConfig((p) => ({ ...p, stopOnDisconnect: v }))} />
            <EndCondition label="Stop on RPM" checked={config.stopOnRpm} disabled={isRunning} onChange={(v) => setConfig((p) => ({ ...p, stopOnRpm: v }))} />
          </div>
        </div>
      )}

      <div className="space-y-4 rounded-lg border p-4">
        <h3 className="font-medium">{showSetupPanel ? 'Preview' : 'Live Test'}</h3>

        {(isRunning || isPaused) && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-full" disabled={!isRunning} onClick={pauseTest}>Pause</Button>
            <Button variant="outline" className="rounded-full" disabled={!isPaused} onClick={resumeTest}>Resume</Button>
            <Button variant="destructive" className="rounded-full" onClick={stopTest}>Stop</Button>
          </div>
        )}

        {isFinished && (
          <div className="rounded-lg border border-dashed p-3 text-sm">
            <p className="font-medium">Test Finished</p>
            <p>End condition: {(endCondition ?? 'unknown').toUpperCase()}</p>
            <p>CSV auto-downloaded{csvFileName ? `: ${csvFileName}` : '.'}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
          <Stat label="Phase" value={phase} />
          <Stat label="Cycle" value={String(cycleIndex || 0)} />
          <Stat label="Total Uptime" value={`${totalUptimeSec}s`} />
          <Stat label="Active Runtime" value={`${totalActiveRuntimeSec}s`} />
          <Stat label="Voltage" value={lastMeasuredVoltage !== null ? `${lastMeasuredVoltage.toFixed(2)}V` : '-'} />
          <Stat label="SOC" value={lastMeasuredSoc !== null ? `${lastMeasuredSoc.toFixed(1)}%` : '-'} />
        </div>

        <div className="flex items-center gap-2">
          <Switch id="include-temp" checked={includeTemperature} onCheckedChange={setIncludeTemperature} />
          <Label htmlFor="include-temp">Show temperature (graph + CSV)</Label>
        </div>

        <div className="grid grid-cols-3 gap-2 font-mono text-sm">
          <div><span className="text-muted-foreground">RPM </span>{Number.isFinite(liveRpm) ? Math.round(Number(liveRpm)) : '—'}</div>
          <div><span className="text-muted-foreground">V </span>{Number.isFinite(liveVoltage) ? `${Number(liveVoltage).toFixed(2)}` : '—'}</div>
          <div><span className="text-muted-foreground">°C </span>{Number.isFinite(liveTemp) ? `${Number(liveTemp).toFixed(1)}` : '—'}</div>
        </div>

        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: includeTemperature ? 52 : 44, bottom: 8, left: 8 }}>
              <XAxis dataKey="t" tickFormatter={(v) => `${v}s`} stroke="currentColor" className="text-muted-foreground" />
              <YAxis yAxisId="left" stroke="var(--chart-3)" />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} stroke="var(--chart-1)" width={44} />
              <YAxis yAxisId="rpmAvg" orientation="right" stroke="var(--primary)" width={48} domain={['auto', 'auto']} />
              {includeTemperature && <YAxis yAxisId="temp" orientation="right" stroke="var(--chart-2)" width={44} domain={['auto', 'auto']} />}
              <Tooltip labelFormatter={(label) => `Uptime: ${label}s`} />
              <Line yAxisId="left" type="monotone" dataKey="voltage" stroke="var(--chart-3)" dot={false} strokeWidth={2} isAnimationActive={false} />
              <Line yAxisId="right" type="monotone" dataKey="batteryPercent" stroke="var(--chart-1)" dot={false} strokeWidth={2} isAnimationActive={false} />
              <Line yAxisId="rpmAvg" type="monotone" dataKey="avgRpm" stroke="var(--primary)" dot={false} strokeWidth={2} isAnimationActive={false} connectNulls />
              {includeTemperature && <Line yAxisId="temp" type="monotone" dataKey="temperatureC" stroke="var(--chart-2)" dot={false} strokeWidth={2} isAnimationActive={false} connectNulls />}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <Separator />

        <details>
          <summary className="cursor-pointer text-sm font-medium">Live CSV</summary>
          <textarea className="mt-2 h-32 w-full rounded-md border bg-muted/30 p-2 font-mono text-xs" readOnly value={csvContent} />
        </details>
      </div>
    </div>
  );
}

function SliderField({ label, min, max, step, value, draft, disabled, onSlider, onDraft, hint, isFloat }: {
  label: string; min: number; max: number; step: number; value: number; draft: string; disabled: boolean;
  onSlider: (v: number) => void; onDraft: (v: string) => void; hint?: string; isFloat?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Slider min={min} max={max} step={step} value={[value]} disabled={disabled} onValueChange={(v) => onSlider(v[0] ?? value)} />
      <Input type="text" inputMode={isFloat ? 'decimal' : 'numeric'} value={draft} disabled={disabled} onChange={(e) => onDraft(e.target.value)} className="font-mono" />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function EndCondition({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
      <Label>{label}</Label>
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
