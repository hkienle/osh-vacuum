import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { UPlotChart } from '@/components/UPlotChart';
import type { UPlotChartHandle } from '@/components/UPlotChart';

interface DataPoint {
  time: string;
  value: number;
  timestamp: number;
}

interface DataGraphProps {
  data: DataPoint[];
  title?: string;
  unit?: string;
  color?: string;
  color2?: string;
  min?: number;
  max?: number;
  actualMin?: number;
  actualMax?: number;
}

export interface DataGraphHandle {
  push: (value: number) => void;
}

export const DataGraph = forwardRef<DataGraphHandle, DataGraphProps>(
  ({ data, unit = '', color = '#818cf8', color2 = '#a5b4fc', min, max, actualMin, actualMax }, ref) => {
    const chartRef = useRef<UPlotChartHandle>(null);
    const lastPushedTimestampRef = useRef<number>(-1);

    useImperativeHandle(ref, () => ({
      push: (value: number) => chartRef.current?.push(value),
    }));

    useEffect(() => {
      if (data.length === 0) {
        lastPushedTimestampRef.current = -1;
        chartRef.current?.reset();
        return;
      }

      const firstTimestamp = data[0]?.timestamp ?? 0;
      // Sliding window dropped points we already charted — resync from scratch.
      if (lastPushedTimestampRef.current >= 0 && firstTimestamp > lastPushedTimestampRef.current) {
        chartRef.current?.reset();
        lastPushedTimestampRef.current = -1;
      }

      for (const point of data) {
        if (point.timestamp <= lastPushedTimestampRef.current) {
          continue;
        }
        if (point.value !== undefined && Number.isFinite(point.value)) {
          chartRef.current?.push(point.value, point.timestamp);
          lastPushedTimestampRef.current = point.timestamp;
        }
      }
    }, [data]);

    useEffect(() => {
      if (min !== undefined && max !== undefined && Number.isFinite(min) && Number.isFinite(max)) {
        chartRef.current?.setRange(min, max);
      } else {
        chartRef.current?.setRange(NaN, NaN);
      }
    }, [min, max]);

    const decimals = unit === 'RPM' ? 0 : unit === '°C' ? 1 : 2;

    return (
      <div className="min-w-0 w-full space-y-2">
        {actualMin !== undefined && actualMax !== undefined && (
          <div className="flex justify-end gap-2 text-[11px] text-muted-foreground">
            <span>
              Min: <span className="font-mono font-medium text-foreground">{actualMin.toFixed(decimals)}</span>
            </span>
            <span>|</span>
            <span>
              Max: <span className="font-mono font-medium text-foreground">{actualMax.toFixed(decimals)}</span>
            </span>
          </div>
        )}
        <div className="min-w-0 w-full overflow-hidden rounded-lg border bg-muted/20 p-2">
          <UPlotChart
            ref={chartRef}
            maxPoints={300}
            lineWidth={2}
            yMin={min ?? null}
            yMax={max ?? null}
            color={color}
            color2={color2}
            height={160}
          />
        </div>
      </div>
    );
  },
);

DataGraph.displayName = 'DataGraph';
