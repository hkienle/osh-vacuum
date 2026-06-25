import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildMotorRampTestLog,
  type MotorRampSample,
  type MotorRampTestLog,
} from '@/lib/motorRampTestExport';
import { isMotorRampOffStep, isXiaomiGMotor, MOTOR_RAMP_OFF_STEP, XIAOMI_G_RAMP_STEPS } from '@/lib/motorProfiles';
import { markUserMotorStart, markUserMotorStop } from '../services/deviceNotifications';
import type { DeviceMessage } from '../types/deviceTransport';

export interface MotorRampConfig {
  startPercent: number;
  endPercent: number;
  stepPercent: number;
  holdSec: number;
}

export { MOTOR_RAMP_OFF_STEP, MOTOR_TYPE_XIAOMI_G, XIAOMI_G_RAMP_STEPS, XIAOMI_G_STEP_LABELS, isXiaomiGMotor, rampStepLabel } from '@/lib/motorProfiles';

export function getRampSteps(motorType: number | undefined, config: MotorRampConfig): number[] {
  if (isXiaomiGMotor(motorType)) {
    return [...XIAOMI_G_RAMP_STEPS];
  }
  return buildRampSteps(config.startPercent, config.endPercent, config.stepPercent);
}

type RampPhase = 'idle' | 'running' | 'completed' | 'stopped';

interface UseMotorRampTestArgs {
  connected: boolean;
  lastMessage: DeviceMessage | null;
  sendMessage: (message: object) => void;
  motorType?: number;
}

const TICK_MS = 100;
const SAMPLE_INTERVAL_MS = 200;

export function buildRampSteps(startPercent: number, endPercent: number, stepPercent: number): number[] {
  const start = Math.max(0, Math.min(100, Math.round(startPercent)));
  const end = Math.max(0, Math.min(100, Math.round(endPercent)));
  const step = Math.max(1, Math.min(100, Math.round(stepPercent)));
  const steps: number[] = [];

  if (start <= end) {
    for (let speed = start; speed < end; speed += step) {
      steps.push(speed);
    }
    steps.push(end);
  } else {
    for (let speed = start; speed > end; speed -= step) {
      steps.push(speed);
    }
    steps.push(end);
  }

  return [...new Set(steps)];
}

function messageToSample(
  msg: DeviceMessage,
  nowMs: number,
  startedAtMs: number,
  stepIndex: number,
  targetSpeed: number | null,
): MotorRampSample {
  const rpm = msg.rpm;
  const voltage = msg.voltage ?? msg.battery;
  const temp = msg.temperature ?? msg.temp;
  return {
    elapsedSec: Number(((nowMs - startedAtMs) / 1000).toFixed(2)),
    timestampMs: nowMs,
    targetSpeedPercent: targetSpeed,
    stepIndex,
    rpm: Number.isFinite(rpm) ? Math.round(Number(rpm)) : null,
    voltage: Number.isFinite(voltage) ? Number(Number(voltage).toFixed(2)) : null,
    temperatureC: Number.isFinite(temp) ? Number(Number(temp).toFixed(1)) : null,
  };
}

export function useMotorRampTest({ connected, lastMessage, sendMessage, motorType }: UseMotorRampTestArgs) {
  const [phase, setPhase] = useState<RampPhase>('idle');
  const [config, setConfig] = useState<MotorRampConfig | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState<number | null>(null);
  const [runtimeNowMs, setRuntimeNowMs] = useState(0);
  const [samples, setSamples] = useState<MotorRampSample[]>([]);
  const [log, setLog] = useState<MotorRampTestLog | null>(null);

  const stepsRef = useRef<number[]>([]);
  const stepIndexRef = useRef(0);
  const phaseEndsAtRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const endedAtRef = useRef<number | null>(null);
  const samplesRef = useRef<MotorRampSample[]>([]);
  const lastSampleMsRef = useRef(0);
  const configRef = useRef<MotorRampConfig | null>(null);

  const motorTypeRef = useRef(motorType);
  motorTypeRef.current = motorType;

  const isRunning = phase === 'running';
  const steps = stepsRef.current;
  const totalSteps = steps.length;

  const appendSample = useCallback((sample: MotorRampSample) => {
    samplesRef.current = [...samplesRef.current, sample];
    setSamples(samplesRef.current);
  }, []);

  const recordSample = useCallback(
    (msg: DeviceMessage | null, targetSpeed: number | null, force = false) => {
      const startedAt = startedAtRef.current;
      if (!startedAt || !msg) return;

      const now = Date.now();
      if (!force && now - lastSampleMsRef.current < SAMPLE_INTERVAL_MS) {
        return;
      }
      lastSampleMsRef.current = now;
      appendSample(
        messageToSample(msg, now, startedAt, stepIndexRef.current, targetSpeed),
      );
    },
    [appendSample],
  );

  const stopMotor = useCallback(() => {
    markUserMotorStop();
    sendMessage({ command: 'motor_stop' });
  }, [sendMessage]);

  const applyStep = useCallback(
    (step: number) => {
      if (isMotorRampOffStep(step)) {
        markUserMotorStop();
        sendMessage({ command: 'motor_stop' });
        setCurrentSpeed(MOTOR_RAMP_OFF_STEP);
        return;
      }

      const clamped = Math.max(0, Math.min(100, Math.round(step)));
      markUserMotorStart();
      sendMessage({ speed: clamped });
      sendMessage({ command: 'motor_start' });
      setCurrentSpeed(clamped);
    },
    [sendMessage],
  );

  const finish = useCallback(
    (nextPhase: 'completed' | 'stopped', msg: DeviceMessage | null) => {
      const endedAt = Date.now();
      endedAtRef.current = endedAt;
      const targetSpeed = stepsRef.current[stepIndexRef.current] ?? null;
      recordSample(msg, targetSpeed, true);

      stopMotor();
      setPhase(nextPhase);
      phaseEndsAtRef.current = null;

      const cfg = configRef.current;
      const startedAt = startedAtRef.current;
      if (cfg && startedAt) {
        setLog(
          buildMotorRampTestLog({
            phase: nextPhase,
            config: cfg,
            steps: [...stepsRef.current],
            samples: samplesRef.current,
            startedAtMs: startedAt,
            endedAtMs: endedAt,
            motorType: motorTypeRef.current,
          }),
        );
      }
    },
    [recordSample, stopMotor],
  );

  const startTest = useCallback(
    (nextConfig: MotorRampConfig) => {
      const normalized: MotorRampConfig = {
        startPercent: Math.max(0, Math.min(100, Math.round(nextConfig.startPercent))),
        endPercent: Math.max(0, Math.min(100, Math.round(nextConfig.endPercent))),
        stepPercent: Math.max(1, Math.min(100, Math.round(nextConfig.stepPercent))),
        holdSec: Math.max(1, Math.min(60, Math.round(nextConfig.holdSec))),
      };

      const rampSteps = getRampSteps(motorTypeRef.current, normalized);
      if (rampSteps.length === 0) {
        return;
      }

      const now = Date.now();
      configRef.current = normalized;
      setConfig(normalized);
      setLog(null);
      samplesRef.current = [];
      setSamples([]);
      lastSampleMsRef.current = 0;
      stepsRef.current = rampSteps;
      stepIndexRef.current = 0;
      setStepIndex(0);
      startedAtRef.current = now;
      endedAtRef.current = null;
      setRuntimeNowMs(now);
      phaseEndsAtRef.current = now + normalized.holdSec * 1000;
      setPhase('running');
      applyStep(rampSteps[0]);
    },
    [applyStep],
  );

  const stopTest = useCallback(() => {
    finish('stopped', lastMessage);
  }, [finish, lastMessage]);

  const resetTest = useCallback(() => {
    setPhase('idle');
    setConfig(null);
    configRef.current = null;
    setStepIndex(0);
    setCurrentSpeed(null);
    setRuntimeNowMs(0);
    setSamples([]);
    setLog(null);
    stepsRef.current = [];
    stepIndexRef.current = 0;
    phaseEndsAtRef.current = null;
    startedAtRef.current = null;
    endedAtRef.current = null;
    samplesRef.current = [];
    lastSampleMsRef.current = 0;
  }, []);

  useEffect(() => {
    if (!isRunning || !config) {
      return;
    }

    const interval = window.setInterval(() => {
      const now = Date.now();
      setRuntimeNowMs(now);

      if (!connected) {
        finish('stopped', lastMessage);
        return;
      }

      const phaseEndsAt = phaseEndsAtRef.current;
      if (phaseEndsAt === null || now < phaseEndsAt) {
        return;
      }

      const rampSteps = stepsRef.current;
      const nextIndex = stepIndexRef.current + 1;
      if (nextIndex >= rampSteps.length) {
        finish('completed', lastMessage);
        return;
      }

      stepIndexRef.current = nextIndex;
      setStepIndex(nextIndex);
      phaseEndsAtRef.current = now + config.holdSec * 1000;
      applyStep(rampSteps[nextIndex]);
    }, TICK_MS);

    return () => window.clearInterval(interval);
  }, [applyStep, config, connected, finish, isRunning, lastMessage]);

  useEffect(() => {
    if (!connected && isRunning) {
      finish('stopped', lastMessage);
    }
  }, [connected, finish, isRunning, lastMessage]);

  useEffect(() => {
    if (!isRunning) return;
    const targetSpeed = stepsRef.current[stepIndexRef.current] ?? currentSpeed;
    recordSample(lastMessage, targetSpeed);
  }, [currentSpeed, isRunning, lastMessage, recordSample]);

  const elapsedSec = useMemo(() => {
    if (!startedAtRef.current) {
      return 0;
    }
    const endMs = endedAtRef.current ?? (runtimeNowMs || Date.now());
    return Math.max(0, Math.round((endMs - startedAtRef.current) / 1000));
  }, [runtimeNowMs]);

  const holdRemainingSec = useMemo(() => {
    if (!isRunning || phaseEndsAtRef.current === null) {
      return 0;
    }
    const remaining = Math.max(0, phaseEndsAtRef.current - (runtimeNowMs || Date.now()));
    return Math.ceil(remaining / 1000);
  }, [isRunning, runtimeNowMs]);

  const liveRpm = lastMessage?.rpm;
  const liveVoltage = lastMessage?.voltage ?? lastMessage?.battery;

  return {
    phase,
    isRunning,
    config,
    steps,
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
  };
}
