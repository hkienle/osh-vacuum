import { useState, useEffect, useMemo } from 'react';
import { useTheme } from 'next-themes';
import { Link2 } from 'lucide-react';
import { DataGraph } from '@/components/DataGraph';
import { useWebSocketContext } from '@/contexts/WebSocketContext';
import { useDataHistory } from '@/hooks/useDataHistory';
import { chartColors } from '@/lib/themeColors';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface ControlPanelProps {
  onConnect?: () => void;
}

export function ControlPanel({ onConnect }: ControlPanelProps) {
  const [speed, setSpeed] = useState(0);
  const [isStarted, setIsStarted] = useState(false);
  const { connected, sendMessage, lastMessage } = useWebSocketContext();
  const { addDataPoint, getRpmData, getTemperatureData, getVoltageData } = useDataHistory();
  const { resolvedTheme } = useTheme();
  const colors = useMemo(() => chartColors(), [resolvedTheme]);

  useEffect(() => {
    if (lastMessage) {
      addDataPoint(lastMessage.rpm, lastMessage.temperature, lastMessage.voltage);
    }
  }, [lastMessage, addDataPoint]);

  useEffect(() => {
    if (lastMessage?.speed !== undefined) {
      const roundedSpeed = Math.round(lastMessage.speed / 20) * 20;
      setSpeed(roundedSpeed);
    }
  }, [lastMessage?.speed]);

  useEffect(() => {
    if (lastMessage?.motor_active !== undefined) {
      setIsStarted((prev) => (prev !== lastMessage.motor_active ? lastMessage.motor_active! : prev));
    }
  }, [lastMessage?.motor_active]);

  useEffect(() => {
    if (!connected) setIsStarted(false);
  }, [connected]);

  const sendSpeedCommand = (speedValue: number) => {
    if (connected) {
      const clampedSpeed = Math.max(0, Math.min(100, Math.round(speedValue)));
      sendMessage({ speed: clampedSpeed });
    }
  };

  const handleSpeedChange = (values: number[]) => {
    const newSpeed = values[0] ?? 0;
    const clampedSpeed = Math.max(0, Math.min(100, Math.round(newSpeed)));
    setSpeed(clampedSpeed);
    sendSpeedCommand(clampedSpeed);
  };

  const handlePreset = (presetSpeed: number) => {
    const clampedSpeed = Math.max(0, Math.min(100, Math.round(presetSpeed)));
    setSpeed(clampedSpeed);
    sendSpeedCommand(clampedSpeed);
  };

  const handleStart = () => {
    if (connected && !isStarted) {
      setIsStarted(true);
      sendMessage({ command: 'motor_start' });
      sendMessage({ speed: Math.max(0, Math.min(100, Math.round(speed))) });
    }
  };

  const handleStop = () => {
    if (connected && isStarted) {
      setIsStarted(false);
      sendMessage({ command: 'motor_stop' });
    }
  };

  const currentRpm = lastMessage?.rpm ?? 0;
  const currentTemperature = lastMessage?.temperature ?? 0;
  const currentVoltage = lastMessage?.voltage ?? 0;

  const rpmData = getRpmData();
  const tempData = getTemperatureData();
  const voltageData = getVoltageData();

  const rpmActualMin = rpmData.length > 0 ? Math.min(...rpmData.map((d) => d.value)) : undefined;
  const rpmActualMax = rpmData.length > 0 ? Math.max(...rpmData.map((d) => d.value)) : undefined;
  const tempActualMin = tempData.length > 0 ? Math.min(...tempData.map((d) => d.value)) : undefined;
  const tempActualMax = tempData.length > 0 ? Math.max(...tempData.map((d) => d.value)) : undefined;
  const voltageActualMin =
    voltageData.length > 0 ? Math.min(...voltageData.map((d) => d.value)) : undefined;
  const voltageActualMax =
    voltageData.length > 0 ? Math.max(...voltageData.map((d) => d.value)) : undefined;

  const calculateSoftMax = (
    actualMax: number | undefined,
    minValue = 0,
    baseMax = 30,
    padding = 5,
  ) => {
    if (actualMax === undefined) return { min: minValue, max: baseMax };
    return { min: minValue, max: actualMax > baseMax ? actualMax + padding : baseMax };
  };

  const calculateRpmRange = (actualMax: number | undefined) => {
    const minValue = -5;
    const baseMax = 10;
    if (actualMax === undefined) return { min: minValue, max: baseMax };
    return { min: minValue, max: actualMax > baseMax ? actualMax + 5 : baseMax };
  };

  const rpmRange = calculateRpmRange(rpmActualMax);
  const tempRange = calculateSoftMax(tempActualMax);
  const voltageRange = calculateSoftMax(voltageActualMax);

  if (!connected) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-6 px-6 py-16 text-center">
          <Link2 className="size-10 text-muted-foreground" strokeWidth={1.5} aria-hidden />
          <div className="max-w-md space-y-4">
            <h2 className="text-lg font-semibold leading-snug">
              Connect caznic ξ to make it your own and get more insights about the vacuum.
            </h2>
            <ul className="list-disc space-y-2 pl-5 text-left text-sm text-muted-foreground">
              <li>Control motor speed and run cycles</li>
              <li>Live RPM, temperature, and battery voltage</li>
              <li>Adjust settings and run battery tests!</li>
            </ul>
          </div>
          {onConnect && (
            <Button onClick={onConnect} className="mt-8 rounded-full lowercase">
              connect
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium text-muted-foreground">Motor speed</CardTitle>
          <p className="font-mono text-4xl font-bold tabular-nums">{speed}%</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label htmlFor="speed-slider" className="sr-only">
              Motor speed
            </Label>
            <Slider
              id="speed-slider"
              min={0}
              max={100}
              step={1}
              value={[speed]}
              onValueChange={handleSpeedChange}
              disabled={!connected}
            />
          </div>

          <ToggleGroup
            type="single"
            value={String(speed)}
            onValueChange={(v) => v && handlePreset(Number(v))}
            className="flex w-full flex-wrap justify-between gap-1"
          >
            {[0, 20, 40, 60, 80, 100].map((preset) => (
              <ToggleGroupItem
                key={preset}
                value={String(preset)}
                disabled={!connected}
                className="min-w-0 flex-1 rounded-full px-2 text-xs sm:text-sm"
              >
                {preset}%
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <div className="flex gap-3">
            <Button
              className="flex-1 rounded-full bg-success text-success-foreground hover:bg-success/90"
              onClick={handleStart}
              disabled={!connected || isStarted}
            >
              Start
            </Button>
            <Button
              variant="destructive"
              className="flex-1 rounded-full"
              onClick={handleStop}
              disabled={!connected || !isStarted}
            >
              Stop
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Impeller RPM"
          value={currentRpm.toFixed(0)}
          unit="RPM"
          color={colors.rpm}
          data={rpmData}
          min={rpmRange.min}
          max={rpmRange.max}
          actualMin={rpmActualMin}
          actualMax={rpmActualMax}
        />
        <MetricCard
          label="Exhaust temperature"
          value={currentTemperature.toFixed(1)}
          unit="°C"
          color={colors.temp}
          data={tempData}
          min={tempRange.min}
          max={tempRange.max}
          actualMin={tempActualMin}
          actualMax={tempActualMax}
        />
        <MetricCard
          label="Battery voltage"
          value={currentVoltage.toFixed(2)}
          unit="V"
          color={colors.voltage}
          data={voltageData}
          min={voltageRange.min}
          max={voltageRange.max}
          actualMin={voltageActualMin}
          actualMax={voltageActualMax}
        />
      </div>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  unit: string;
  color: string;
  data: { time: string; value: number; timestamp: number }[];
  min?: number;
  max?: number;
  actualMin?: number;
  actualMax?: number;
}

function MetricCard({ label, value, unit, color, data, min, max, actualMin, actualMax }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </CardTitle>
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-3xl font-bold tabular-nums" style={{ color }}>
            {value}
          </span>
          <span className="text-sm text-muted-foreground">{unit}</span>
        </div>
      </CardHeader>
      <CardContent>
        <DataGraph
          data={data}
          unit={unit}
          color={color}
          color2={color}
          min={min}
          max={max}
          actualMin={actualMin}
          actualMax={actualMax}
        />
      </CardContent>
    </Card>
  );
}
