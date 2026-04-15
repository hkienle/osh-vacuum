import { useMemo, useState } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useWebSocketContext } from '../contexts/WebSocketContext';
import { useBatteryTest, type BatteryTestConfig } from '../hooks/useBatteryTest';
import './BatteryTestModal.css';

interface BatteryTestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

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

export function BatteryTestModal({ isOpen, onClose }: BatteryTestModalProps) {
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

  const parseField = (value: string, min: number, max: number, isFloat = false): number | null => {
    if (value.trim() === '') {
      return null;
    }
    const n = isFloat ? Number(value) : Number.parseInt(value, 10);
    if (!Number.isFinite(n)) {
      return null;
    }
    if (n < min || n > max) {
      return null;
    }
    return isFloat ? Math.round(n * 10) / 10 : Math.round(n);
  };

  const parsedConfig = useMemo(() => {
    const speed = parseField(draft.speed, 0, 100);
    const onCycleSec = parseField(draft.onCycleSec, 5, 120);
    const stabilizationSec = parseField(draft.stabilizationSec, 1, 120);
    const readingCount = parseField(draft.readingCount, 1, 50);
    const stopVoltage = parseField(draft.stopVoltage, 0, 36, true);
    if (
      speed === null ||
      onCycleSec === null ||
      stabilizationSec === null ||
      readingCount === null ||
      stopVoltage === null
    ) {
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
    [data]
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

  if (!isOpen) {
    return null;
  }

  return (
    <div className="battery-test-modal-overlay">
      <div className="battery-test-modal">
        <div className="battery-test-header">
          <h2>Battery Test Mode</h2>
          <button className="battery-test-close" onClick={onClose} disabled={isRunning || isPaused}>
            ×
          </button>
        </div>

        <div className={`battery-test-body ${showSetupPanel ? 'setup-mode' : 'run-mode'}`}>
          {showSetupPanel && (
            <div className="battery-test-config-card">
            <h3>Pre-Settings</h3>
            <div className="battery-test-grid">
              <label className="battery-test-slider-field">
                <span>Speed (%)</span>
                <input type="range" min={0} max={100} step={1} value={config.speed} disabled={isRunning} onChange={(e) => setFromSlider('speed', Number(e.target.value))} />
                <input
                  type="text"
                  inputMode="numeric"
                  value={draft.speed}
                  disabled={isRunning}
                  onChange={(e) => setDraftOnly('speed', e.target.value)}
                />
              </label>
              <label className="battery-test-slider-field">
                <span>On-Cycle (s)</span>
                <input type="range" min={5} max={120} step={1} value={config.onCycleSec} disabled={isRunning} onChange={(e) => setFromSlider('onCycleSec', Number(e.target.value))} />
                <input
                  type="text"
                  inputMode="numeric"
                  value={draft.onCycleSec}
                  disabled={isRunning}
                  onChange={(e) => setDraftOnly('onCycleSec', e.target.value)}
                />
              </label>
              <label className="battery-test-slider-field">
                <span>Stabilization (s)</span>
                <input type="range" min={1} max={120} step={1} value={config.stabilizationSec} disabled={isRunning} onChange={(e) => setFromSlider('stabilizationSec', Number(e.target.value))} />
                <input
                  type="text"
                  inputMode="numeric"
                  value={draft.stabilizationSec}
                  disabled={isRunning}
                  onChange={(e) => setDraftOnly('stabilizationSec', e.target.value)}
                />
                <small>After motor off, then readings; then 2s pause before next run.</small>
              </label>
              <label className="battery-test-slider-field">
                <span>Reading Count</span>
                <input type="range" min={1} max={50} step={1} value={config.readingCount} disabled={isRunning} onChange={(e) => setFromSlider('readingCount', Number(e.target.value))} />
                <input
                  type="text"
                  inputMode="numeric"
                  value={draft.readingCount}
                  disabled={isRunning}
                  onChange={(e) => setDraftOnly('readingCount', e.target.value)}
                />
              </label>
              <label className="battery-test-slider-field">
                <span>Stop Voltage (V)</span>
                <input type="range" min={0} max={36} step={0.1} value={config.stopVoltage} disabled={isRunning} onChange={(e) => setFromSlider('stopVoltage', Number(e.target.value))} />
                <input
                  type="text"
                  inputMode="decimal"
                  value={draft.stopVoltage}
                  disabled={isRunning}
                  onChange={(e) => setDraftOnly('stopVoltage', e.target.value)}
                />
              </label>
            </div>

            <div className="battery-test-actions">
              <button
                className="battery-test-start"
                disabled={!canStart}
                onClick={() => {
                  if (parsedConfig) {
                    setConfig({
                      ...parsedConfig,
                      stopOnVoltage: config.stopOnVoltage,
                      stopOnDisconnect: config.stopOnDisconnect,
                      stopOnRpm: config.stopOnRpm,
                    });
                    setDraft({
                      speed: String(parsedConfig.speed),
                      onCycleSec: String(parsedConfig.onCycleSec),
                      stabilizationSec: String(parsedConfig.stabilizationSec),
                      readingCount: String(parsedConfig.readingCount),
                      stopVoltage: String(parsedConfig.stopVoltage),
                    });
                    startTest({
                      ...parsedConfig,
                      stopOnVoltage: config.stopOnVoltage,
                      stopOnDisconnect: config.stopOnDisconnect,
                      stopOnRpm: config.stopOnRpm,
                    });
                  }
                }}
              >
                Start Test
              </button>
              <button className="battery-test-stop" disabled={!isRunning} onClick={stopTest}>
                Stop Test
              </button>
              <button className="battery-test-export" disabled={!canDownload} onClick={downloadCSV}>
                Download CSV
              </button>
              <button
                className="battery-test-reset"
                disabled={isRunning}
                onClick={() => {
                  resetTest();
                  setConfig(DEFAULT_CONFIG);
                  setDraft({
                    speed: String(DEFAULT_CONFIG.speed),
                    onCycleSec: String(DEFAULT_CONFIG.onCycleSec),
                    stabilizationSec: String(DEFAULT_CONFIG.stabilizationSec),
                    readingCount: String(DEFAULT_CONFIG.readingCount),
                    stopVoltage: String(DEFAULT_CONFIG.stopVoltage),
                  });
                }}
              >
                New Test
              </button>
            </div>

            {!connected && <p className="battery-test-warning">ESP32 not connected.</p>}
            {!isRunning && parsedConfig === null && <p className="battery-test-warning">Please fill all setup values with valid ranges.</p>}
            {!isRunning && !hasAnyEndCondition && <p className="battery-test-warning">Please enable at least one end condition.</p>}
            {errorMessage && <p className="battery-test-warning">{errorMessage}</p>}

            <div className="battery-test-end-conditions">
              <label>
                <input
                  type="checkbox"
                  checked={config.stopOnVoltage}
                  disabled={isRunning}
                  onChange={(e) => setConfig((prev) => ({ ...prev, stopOnVoltage: e.target.checked }))}
                />
                Stop on Voltage
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={config.stopOnDisconnect}
                  disabled={isRunning}
                  onChange={(e) => setConfig((prev) => ({ ...prev, stopOnDisconnect: e.target.checked }))}
                />
                Stop on Disconnect
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={config.stopOnRpm}
                  disabled={isRunning}
                  onChange={(e) => setConfig((prev) => ({ ...prev, stopOnRpm: e.target.checked }))}
                />
                Stop on RPM
              </label>
            </div>
            </div>
          )}

          <div className="battery-test-live-card">
            <h3>{showSetupPanel ? 'Preview' : 'Live Test'}</h3>
            {(isRunning || isPaused) && (
              <div className="battery-test-live-actions">
                <button className="battery-test-pause" disabled={!isRunning} onClick={pauseTest}>
                  Pause
                </button>
                <button className="battery-test-resume" disabled={!isPaused} onClick={resumeTest}>
                  Resume
                </button>
                <button className="battery-test-stop" onClick={stopTest}>
                  Stop
                </button>
              </div>
            )}
            {isFinished && (
              <div className="battery-test-final-screen">
                <h4>Test Finished</h4>
                <p>End condition: {(endCondition ?? 'unknown').toUpperCase()}</p>
                <p>
                  CSV auto-downloaded
                  {csvFileName ? `: ${csvFileName}` : '.'}
                </p>
              </div>
            )}
            <div className="battery-test-stats">
              <div>Phase: {phase}</div>
              <div>Cycle: {cycleIndex || 0}</div>
              <div>Total Uptime: {totalUptimeSec}s</div>
              <div>Active Runtime: {totalActiveRuntimeSec}s</div>
              <div>Voltage: {lastMeasuredVoltage !== null ? `${lastMeasuredVoltage.toFixed(2)}V` : '-'}</div>
              <div>SOC: {lastMeasuredSoc !== null ? `${lastMeasuredSoc.toFixed(1)}%` : '-'}</div>
            </div>

            <label className="battery-test-temp-toggle">
              <input
                type="checkbox"
                checked={includeTemperature}
                onChange={(e) => setIncludeTemperature(e.target.checked)}
              />
              Show temperature (graph + CSV)
            </label>

            <div className="battery-test-live-telemetry" aria-live="polite">
              <div className="battery-test-live-telemetry-item">
                <span className="battery-test-live-label">RPM</span>
                <span className="battery-test-live-value">
                  {Number.isFinite(liveRpm) ? Math.round(Number(liveRpm)) : '—'}
                </span>
              </div>
              <div className="battery-test-live-telemetry-item">
                <span className="battery-test-live-label">Voltage</span>
                <span className="battery-test-live-value">
                  {Number.isFinite(liveVoltage) ? `${Number(liveVoltage).toFixed(2)} V` : '—'}
                </span>
              </div>
              <div className="battery-test-live-telemetry-item">
                <span className="battery-test-live-label">Temp</span>
                <span className="battery-test-live-value">
                  {Number.isFinite(liveTemp) ? `${Number(liveTemp).toFixed(1)} °C` : '—'}
                </span>
              </div>
            </div>

            <div className="battery-test-chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 8, right: includeTemperature ? 52 : 44, bottom: 8, left: 8 }}
                >
                  <XAxis dataKey="t" tickFormatter={(v) => `${v}s`} stroke="rgba(255,255,255,0.65)" />
                  <YAxis yAxisId="left" stroke="#34d399" />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 100]} stroke="#60a5fa" width={44} />
                  <YAxis yAxisId="rpmAvg" orientation="right" stroke="#a78bfa" width={48} domain={['auto', 'auto']} />
                  {includeTemperature && (
                    <YAxis yAxisId="temp" orientation="right" stroke="#f472b6" width={44} domain={['auto', 'auto']} />
                  )}
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      if (name === 'voltage') {
                        return [`${value.toFixed(2)} V`, 'Voltage'];
                      }
                      if (name === 'temperatureC') {
                        return [`${value.toFixed(1)} °C`, 'Temp (after stop)'];
                      }
                      if (name === 'avgRpm') {
                        return [`${Math.round(value)} RPM`, 'Ø RPM (on-cycle)'];
                      }
                      return [`${value.toFixed(1)} %`, 'Battery %'];
                    }}
                    labelFormatter={(label) => `Uptime: ${label}s`}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="voltage"
                    stroke="#34d399"
                    dot={false}
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="batteryPercent"
                    stroke="#60a5fa"
                    dot={false}
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                  <Line
                    yAxisId="rpmAvg"
                    type="monotone"
                    dataKey="avgRpm"
                    stroke="#a78bfa"
                    dot={false}
                    strokeWidth={2}
                    isAnimationActive={false}
                    connectNulls
                  />
                  {includeTemperature && (
                    <Line
                      yAxisId="temp"
                      type="monotone"
                      dataKey="temperatureC"
                      stroke="#f472b6"
                      dot={false}
                      strokeWidth={2}
                      isAnimationActive={false}
                      connectNulls
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>

            <details className="battery-test-csv-details">
              <summary>Live CSV</summary>
              <textarea className="battery-test-csv-textarea" readOnly value={csvContent} />
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}
