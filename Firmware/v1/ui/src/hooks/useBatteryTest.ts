import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { WebSocketMessage } from './useWebSocket';

export interface BatteryTestConfig {
  speed: number;
  onCycleSec: number;
  stabilizationSec: number;
  readingCount: number;
  stopVoltage: number;
  stopOnVoltage: boolean;
  stopOnDisconnect: boolean;
  stopOnRpm: boolean;
}

export interface BatteryTestDataPoint {
  totalUptimeSec: number;
  totalActiveRuntimeSec: number;
  voltage: number;
  batteryPercentage: number;
  /** Mean RPM during on-cycle: first sample 2s after motor on, then every 3s until cycle end. */
  avgRpm: number | null;
  /** Exhaust temp (°C) sampled from first telemetry after motor stop in this cycle. */
  temperatureC: number | null;
}

export type EndCondition = 'voltage' | 'disconnect' | 'rpm' | 'manual' | 'unknown';

type TestPhase = 'idle' | 'on_cycle' | 'stabilization' | 'reading' | 'cooldown' | 'paused' | 'completed' | 'error';
type ResumePhase = 'on_cycle' | 'stabilization' | 'reading' | 'cooldown' | null;

interface UseBatteryTestArgs {
  connected: boolean;
  lastMessage: WebSocketMessage | null;
  sendMessage: (message: object) => void;
  /** When true, CSV (live + download + auto) includes Temperature(C) column. */
  includeTemperatureInExport: boolean;
}

const TICK_MS = 100;
const DISCONNECT_TIMEOUT_MS = 10000;
/** Fixed wait after measurements before next motor-on (no configurable off-cycle). */
const POST_READING_COOLDOWN_MS = 2000;
/** RPM samples during on-cycle: first at motor-on + 2s, then every 3s until cycle end. */
const RPM_SAMPLE_FIRST_DELAY_MS = 2000;
const RPM_SAMPLE_INTERVAL_MS = 3000;
/** Fail test if RPM still too low after this time from motor on (existing safety check). */
const RPM_STARTUP_CHECK_MS = 3000;

export function useBatteryTest({
  connected,
  lastMessage,
  sendMessage,
  includeTemperatureInExport,
}: UseBatteryTestArgs) {
  const [phase, setPhase] = useState<TestPhase>('idle');
  const [config, setConfig] = useState<BatteryTestConfig | null>(null);
  const [cycleIndex, setCycleIndex] = useState(0);
  const [data, setData] = useState<BatteryTestDataPoint[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [runtimeNowMs, setRuntimeNowMs] = useState(0);
  const [lastMeasuredVoltage, setLastMeasuredVoltage] = useState<number | null>(null);
  const [lastMeasuredSoc, setLastMeasuredSoc] = useState<number | null>(null);
  const [endCondition, setEndCondition] = useState<EndCondition | null>(null);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);

  const startedAtRef = useRef<number | null>(null);
  const phaseEndsAtRef = useRef<number | null>(null);
  const disconnectSinceRef = useRef<number | null>(null);
  const readingsRef = useRef<Array<{ voltage: number; soc: number }>>([]);
  const activeRuntimeAccMsRef = useRef(0);
  const activePhaseStartedAtRef = useRef<number | null>(null);
  /** Start of current on_cycle (motor on); kept until stabilization for RPM schedule + startup check. */
  const onCycleStartedAtRef = useRef<number | null>(null);
  const rpmStartupCheckedRef = useRef(false);
  const rpmSamplesThisCycleRef = useRef<number[]>([]);
  const nextRpmSampleDueMsRef = useRef<number | null>(null);
  /** Set when leaving on_cycle; consumed when building the reading-phase row. */
  const pendingAvgRpmForCycleRef = useRef<number | null>(null);
  const latestRpmRef = useRef<number | null>(null);
  const csvAutoDownloadedRef = useRef(false);
  const pausedFromPhaseRef = useRef<ResumePhase>(null);
  const pausedRemainingMsRef = useRef<number | null>(null);
  /** First temp (°C) after motor off in current stabilization window; cleared when entering stabilization. */
  const temperatureAfterStopRef = useRef<number | null>(null);
  const lastMessageRef = useRef<WebSocketMessage | null>(null);
  lastMessageRef.current = lastMessage;

  const isRunning = phase !== 'idle' && phase !== 'completed' && phase !== 'error' && phase !== 'paused';
  const isPaused = phase === 'paused';

  const stopMotor = useCallback(() => {
    sendMessage({ command: 'motor_stop' });
  }, [sendMessage]);

  const startMotorWithSpeed = useCallback(
    (speed: number) => {
      sendMessage({ speed });
      sendMessage({ command: 'motor_start' });
    },
    [sendMessage]
  );

  const finalizeActivePhase = useCallback((now: number) => {
    if (activePhaseStartedAtRef.current !== null) {
      activeRuntimeAccMsRef.current += Math.max(0, now - activePhaseStartedAtRef.current);
      activePhaseStartedAtRef.current = null;
    }
  }, []);

  const complete = useCallback(
    (nextPhase: 'completed' | 'error', reason: EndCondition = 'unknown', message?: string) => {
      const now = Date.now();
      finalizeActivePhase(now);
      stopMotor();
      setPhase(nextPhase);
      setErrorMessage(message ?? null);
      setEndCondition(reason);
      phaseEndsAtRef.current = null;
      readingsRef.current = [];
      onCycleStartedAtRef.current = null;
      rpmStartupCheckedRef.current = false;
      rpmSamplesThisCycleRef.current = [];
      nextRpmSampleDueMsRef.current = null;
      pendingAvgRpmForCycleRef.current = null;
      pausedFromPhaseRef.current = null;
      pausedRemainingMsRef.current = null;
      temperatureAfterStopRef.current = null;
    },
    [finalizeActivePhase, stopMotor]
  );

  const startTest = useCallback(
    (nextConfig: BatteryTestConfig) => {
      const now = Date.now();
      const normalized: BatteryTestConfig = {
        speed: Math.max(0, Math.min(100, Math.round(nextConfig.speed))),
        onCycleSec: Math.max(5, Math.min(120, Math.round(nextConfig.onCycleSec))),
        stabilizationSec: Math.max(1, Math.min(120, Math.round(nextConfig.stabilizationSec))),
        readingCount: Math.max(1, Math.min(50, Math.round(nextConfig.readingCount))),
        stopVoltage: Math.max(0, Math.min(36, Math.round(nextConfig.stopVoltage * 10) / 10)),
        stopOnVoltage: nextConfig.stopOnVoltage,
        stopOnDisconnect: nextConfig.stopOnDisconnect,
        stopOnRpm: nextConfig.stopOnRpm,
      };

      setConfig(normalized);
      setCycleIndex(1);
      setErrorMessage(null);
      setEndCondition(null);
      setCsvFileName(null);
      setRuntimeNowMs(0);

      startedAtRef.current = now;
      disconnectSinceRef.current = null;
      readingsRef.current = [];
      activeRuntimeAccMsRef.current = 0;
      latestRpmRef.current = null;
      csvAutoDownloadedRef.current = false;
      pausedFromPhaseRef.current = null;
      pausedRemainingMsRef.current = null;
      temperatureAfterStopRef.current = null;

      const msg = lastMessageRef.current;
      const packV = msg?.voltage ?? msg?.battery;
      let baselineRows: BatteryTestDataPoint[] = [];
      if (Number.isFinite(packV)) {
        const v = Number(packV);
        const socRaw = msg?.battery_soc;
        const socPct = Number.isFinite(socRaw) ? Number(socRaw) : 0;
        baselineRows = [
          {
            totalUptimeSec: 0,
            totalActiveRuntimeSec: 0,
            voltage: Number(v.toFixed(2)),
            batteryPercentage: Number(socPct.toFixed(1)),
            avgRpm: null,
            temperatureC: null,
          },
        ];
        setLastMeasuredVoltage(Number(v.toFixed(2)));
        setLastMeasuredSoc(Number(socPct.toFixed(1)));
      } else {
        setLastMeasuredVoltage(null);
        setLastMeasuredSoc(null);
      }
      setData(baselineRows);

      if (
        baselineRows.length > 0 &&
        normalized.stopOnVoltage &&
        baselineRows[0].voltage < normalized.stopVoltage
      ) {
        phaseEndsAtRef.current = null;
        activePhaseStartedAtRef.current = null;
        onCycleStartedAtRef.current = null;
        rpmStartupCheckedRef.current = false;
        rpmSamplesThisCycleRef.current = [];
        nextRpmSampleDueMsRef.current = null;
        pendingAvgRpmForCycleRef.current = null;
        complete('completed', 'voltage');
        return;
      }

      phaseEndsAtRef.current = now + normalized.onCycleSec * 1000;
      activePhaseStartedAtRef.current = now;
      onCycleStartedAtRef.current = now;
      rpmStartupCheckedRef.current = false;
      rpmSamplesThisCycleRef.current = [];
      nextRpmSampleDueMsRef.current = now + RPM_SAMPLE_FIRST_DELAY_MS;

      startMotorWithSpeed(normalized.speed);
      setPhase('on_cycle');
    },
    [complete, startMotorWithSpeed]
  );

  const stopTest = useCallback(() => {
    complete('completed', 'manual');
  }, [complete]);

  const pauseTest = useCallback(() => {
    if (!config || !isRunning) {
      return;
    }
    const now = Date.now();
    const currentPhase = phase;
    if (currentPhase !== 'on_cycle' && currentPhase !== 'stabilization' && currentPhase !== 'reading' && currentPhase !== 'cooldown') {
      return;
    }

    pausedFromPhaseRef.current = currentPhase;
    if (phaseEndsAtRef.current !== null) {
      pausedRemainingMsRef.current = Math.max(0, phaseEndsAtRef.current - now);
    } else {
      pausedRemainingMsRef.current = null;
    }

    if (currentPhase === 'on_cycle') {
      finalizeActivePhase(now);
      stopMotor();
      onCycleStartedAtRef.current = null;
      rpmStartupCheckedRef.current = false;
      rpmSamplesThisCycleRef.current = [];
      nextRpmSampleDueMsRef.current = null;
    }

    phaseEndsAtRef.current = null;
    setPhase('paused');
  }, [config, finalizeActivePhase, isRunning, phase, stopMotor]);

  const resumeTest = useCallback(() => {
    if (!config || !isPaused) {
      return;
    }
    const now = Date.now();
    const resumePhase = pausedFromPhaseRef.current;
    if (!resumePhase) {
      return;
    }

    if (resumePhase === 'on_cycle') {
      const remaining = pausedRemainingMsRef.current ?? config.onCycleSec * 1000;
      activePhaseStartedAtRef.current = now;
      onCycleStartedAtRef.current = now;
      rpmStartupCheckedRef.current = false;
      rpmSamplesThisCycleRef.current = [];
      nextRpmSampleDueMsRef.current = now + RPM_SAMPLE_FIRST_DELAY_MS;
      latestRpmRef.current = null;
      phaseEndsAtRef.current = now + remaining;
      startMotorWithSpeed(config.speed);
      setPhase('on_cycle');
    } else if (resumePhase === 'stabilization') {
      const remaining = pausedRemainingMsRef.current ?? config.stabilizationSec * 1000;
      phaseEndsAtRef.current = now + remaining;
      setPhase('stabilization');
    } else if (resumePhase === 'cooldown') {
      const remaining = pausedRemainingMsRef.current ?? POST_READING_COOLDOWN_MS;
      phaseEndsAtRef.current = now + remaining;
      setPhase('cooldown');
    } else {
      phaseEndsAtRef.current = null;
      setPhase('reading');
    }

    pausedFromPhaseRef.current = null;
    pausedRemainingMsRef.current = null;
    disconnectSinceRef.current = connected ? null : now;
  }, [config, connected, isPaused, startMotorWithSpeed]);

  const resetTest = useCallback(() => {
    setPhase('idle');
    setConfig(null);
    setCycleIndex(0);
    setData([]);
    setErrorMessage(null);
    setRuntimeNowMs(0);
    setLastMeasuredVoltage(null);
    setLastMeasuredSoc(null);
    setEndCondition(null);
    setCsvFileName(null);
    startedAtRef.current = null;
    phaseEndsAtRef.current = null;
    disconnectSinceRef.current = null;
    readingsRef.current = [];
    activeRuntimeAccMsRef.current = 0;
    activePhaseStartedAtRef.current = null;
    onCycleStartedAtRef.current = null;
    rpmStartupCheckedRef.current = false;
    rpmSamplesThisCycleRef.current = [];
    nextRpmSampleDueMsRef.current = null;
    pendingAvgRpmForCycleRef.current = null;
    latestRpmRef.current = null;
    csvAutoDownloadedRef.current = false;
    pausedFromPhaseRef.current = null;
    pausedRemainingMsRef.current = null;
    temperatureAfterStopRef.current = null;
  }, []);

  useEffect(() => {
    if (!isRunning || !config) {
      return;
    }

    const interval = window.setInterval(() => {
      const now = Date.now();
      setRuntimeNowMs(now);

      if (!connected) {
        if (disconnectSinceRef.current === null) {
          disconnectSinceRef.current = now;
        } else if (config.stopOnDisconnect && now - disconnectSinceRef.current > DISCONNECT_TIMEOUT_MS) {
          complete('error', 'disconnect', 'ESP32 disconnected for more than 10 seconds.');
          return;
        }
      } else {
        disconnectSinceRef.current = null;
      }

      const phaseEndsAt = phaseEndsAtRef.current;
      if (
        phase === 'on_cycle' &&
        onCycleStartedAtRef.current !== null &&
        phaseEndsAt !== null &&
        nextRpmSampleDueMsRef.current !== null
      ) {
        while (
          nextRpmSampleDueMsRef.current !== null &&
          now >= nextRpmSampleDueMsRef.current &&
          nextRpmSampleDueMsRef.current <= phaseEndsAt
        ) {
          const rpm = latestRpmRef.current;
          if (Number.isFinite(rpm)) {
            rpmSamplesThisCycleRef.current.push(Number(rpm));
          }
          const currentDue = nextRpmSampleDueMsRef.current;
          if (currentDue === null) {
            break;
          }
          const nextDue: number = currentDue + RPM_SAMPLE_INTERVAL_MS;
          if (nextDue > phaseEndsAt) {
            nextRpmSampleDueMsRef.current = null;
          } else {
            nextRpmSampleDueMsRef.current = nextDue;
          }
        }
      }

      if (
        config.stopOnRpm &&
        phase === 'on_cycle' &&
        onCycleStartedAtRef.current !== null &&
        !rpmStartupCheckedRef.current &&
        now - onCycleStartedAtRef.current >= RPM_STARTUP_CHECK_MS
      ) {
        rpmStartupCheckedRef.current = true;
        const rpm = latestRpmRef.current;
        if (!Number.isFinite(rpm) || (rpm ?? 0) <= 1000) {
          complete('error', 'rpm', 'Motor start failed: RPM <= 1000 after 3 seconds.');
          return;
        }
      }

      if (phase === 'on_cycle' && phaseEndsAt !== null && now >= phaseEndsAt) {
        const samples = rpmSamplesThisCycleRef.current;
        let avgRpm: number | null = null;
        if (samples.length > 0) {
          avgRpm = Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
        }
        pendingAvgRpmForCycleRef.current = avgRpm;
        rpmSamplesThisCycleRef.current = [];
        nextRpmSampleDueMsRef.current = null;
        onCycleStartedAtRef.current = null;
        rpmStartupCheckedRef.current = false;
        finalizeActivePhase(now);
        stopMotor();
        temperatureAfterStopRef.current = null;
        setPhase('stabilization');
        phaseEndsAtRef.current = now + config.stabilizationSec * 1000;
        return;
      }

      if (phase === 'stabilization' && phaseEndsAt !== null && now >= phaseEndsAt) {
        readingsRef.current = [];
        setPhase('reading');
        phaseEndsAtRef.current = null;
        return;
      }

      if (phase === 'cooldown' && phaseEndsAt !== null && now >= phaseEndsAt) {
        const nextCycle = cycleIndex + 1;
        setCycleIndex(nextCycle);
        setPhase('on_cycle');
        phaseEndsAtRef.current = now + config.onCycleSec * 1000;
        activePhaseStartedAtRef.current = now;
        onCycleStartedAtRef.current = now;
        rpmStartupCheckedRef.current = false;
        rpmSamplesThisCycleRef.current = [];
        nextRpmSampleDueMsRef.current = now + RPM_SAMPLE_FIRST_DELAY_MS;
        latestRpmRef.current = null;
        startMotorWithSpeed(config.speed);
      }
    }, TICK_MS);

    return () => {
      clearInterval(interval);
    };
  }, [complete, config, connected, cycleIndex, finalizeActivePhase, isRunning, phase, startMotorWithSpeed, stopMotor]);

  useEffect(() => {
    if (lastMessage?.rpm !== undefined && Number.isFinite(lastMessage.rpm)) {
      latestRpmRef.current = Number(lastMessage.rpm);
    }
  }, [lastMessage?.rpm]);

  // Capture exhaust temperature once per cycle: first telemetry after motor stop (motor_active false).
  useEffect(() => {
    if (phase !== 'stabilization' || !lastMessage) {
      return;
    }
    if (temperatureAfterStopRef.current !== null) {
      return;
    }
    if (lastMessage.motor_active === true) {
      return;
    }
    const t = lastMessage.temperature ?? lastMessage.temp;
    if (!Number.isFinite(t)) {
      return;
    }
    temperatureAfterStopRef.current = Number(t);
  }, [lastMessage, phase]);

  useEffect(() => {
    if (phase !== 'reading' || !config || !lastMessage) {
      return;
    }

    const voltage = lastMessage.voltage ?? lastMessage.battery;
    const soc = lastMessage.battery_soc;
    if (!Number.isFinite(voltage) || !Number.isFinite(soc)) {
      return;
    }

    const sample = { voltage: Number(voltage), soc: Number(soc) };
    readingsRef.current = [...readingsRef.current, sample].slice(-config.readingCount);

    if (readingsRef.current.length < config.readingCount) {
      return;
    }

    const avgVoltage =
      readingsRef.current.reduce((sum, item) => sum + item.voltage, 0) / readingsRef.current.length;
    const avgSoc = readingsRef.current.reduce((sum, item) => sum + item.soc, 0) / readingsRef.current.length;
    const now = Date.now();
    const startedAt = startedAtRef.current ?? now;

    const tempC = temperatureAfterStopRef.current;
    const avgRpmVal = pendingAvgRpmForCycleRef.current;
    pendingAvgRpmForCycleRef.current = null;
    const newPoint: BatteryTestDataPoint = {
      totalUptimeSec: Math.round((now - startedAt) / 1000),
      totalActiveRuntimeSec: Math.round(activeRuntimeAccMsRef.current / 1000),
      voltage: Number(avgVoltage.toFixed(2)),
      batteryPercentage: Number(avgSoc.toFixed(1)),
      avgRpm: avgRpmVal !== null && Number.isFinite(avgRpmVal) ? Math.round(avgRpmVal) : null,
      temperatureC: tempC !== null && Number.isFinite(tempC) ? Number(tempC.toFixed(1)) : null,
    };
    temperatureAfterStopRef.current = null;

    setData((prev) => [...prev, newPoint]);
    setLastMeasuredVoltage(newPoint.voltage);
    setLastMeasuredSoc(newPoint.batteryPercentage);
    readingsRef.current = [];

    if (config.stopOnVoltage && avgVoltage < config.stopVoltage) {
      complete('completed', 'voltage');
      return;
    }

    setPhase('cooldown');
    phaseEndsAtRef.current = now + POST_READING_COOLDOWN_MS;
  }, [complete, config, lastMessage, phase]);

  const totalUptimeSec = useMemo(() => {
    if (!startedAtRef.current) {
      return 0;
    }
    const endMs = runtimeNowMs || Date.now();
    return Math.max(0, Math.round((endMs - startedAtRef.current) / 1000));
  }, [runtimeNowMs]);

  const totalActiveRuntimeSec = useMemo(() => {
    const now = runtimeNowMs || Date.now();
    let total = activeRuntimeAccMsRef.current;
    if (activePhaseStartedAtRef.current !== null) {
      total += Math.max(0, now - activePhaseStartedAtRef.current);
    }
    return Math.max(0, Math.round(total / 1000));
  }, [runtimeNowMs]);

  const buildCsvRows = useCallback(
    (includeTemperature: boolean) => {
      const endConditionText = (endCondition ?? 'running').toUpperCase();
      const rpmCol = (row: BatteryTestDataPoint) =>
        row.avgRpm !== null && Number.isFinite(row.avgRpm) ? String(Math.round(row.avgRpm)) : '';
      const header = includeTemperature
        ? 'Total-Uptime(s),Total-Active-Runtime(s),Voltage(V),Battery-Percentage(%),Avg-RPM(RPM),Temperature(C),End-Condition'
        : 'Total-Uptime(s),Total-Active-Runtime(s),Voltage(V),Battery-Percentage(%),Avg-RPM(RPM),End-Condition';
      const body = data.map((row) => {
        const tempCol = includeTemperature
          ? row.temperatureC !== null && Number.isFinite(row.temperatureC)
            ? row.temperatureC.toFixed(1)
            : ''
          : '';
        return includeTemperature
          ? `${row.totalUptimeSec},${row.totalActiveRuntimeSec},${row.voltage.toFixed(2)},${row.batteryPercentage.toFixed(1)},${rpmCol(row)},${tempCol},${endConditionText}`
          : `${row.totalUptimeSec},${row.totalActiveRuntimeSec},${row.voltage.toFixed(2)},${row.batteryPercentage.toFixed(1)},${rpmCol(row)},${endConditionText}`;
      });
      return [header, ...body].join('\n');
    },
    [data, endCondition]
  );

  const csvContent = useMemo(
    () => buildCsvRows(includeTemperatureInExport),
    [buildCsvRows, includeTemperatureInExport]
  );

  const downloadCSV = useCallback(() => {
    if (data.length === 0) {
      return null;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const filename = `battery-test-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.csv`;
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setCsvFileName(filename);
    return filename;
  }, [csvContent, data.length]);

  useEffect(() => {
    const done = phase === 'completed' || phase === 'error';
    if (!done || csvAutoDownloadedRef.current || data.length === 0) {
      return;
    }
    const name = downloadCSV();
    if (name) {
      csvAutoDownloadedRef.current = true;
    }
  }, [data.length, downloadCSV, phase]);

  return {
    phase,
    isRunning,
    isPaused,
    config,
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
  };
}
