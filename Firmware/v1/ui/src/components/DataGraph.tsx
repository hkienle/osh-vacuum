import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { UPlotChart } from './UPlotChart';
import type { UPlotChartHandle } from './UPlotChart';
import './DataGraph.css';

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
  min?: number; // Visual min (for Y-axis scale)
  max?: number; // Visual max (for Y-axis scale)
  actualMin?: number; // Actual min value in data (for display)
  actualMax?: number; // Actual max value in data (for display)
}

export interface DataGraphHandle {
  push: (value: number) => void;
}

export const DataGraph = forwardRef<DataGraphHandle, DataGraphProps>(
  ({ data, title, unit = '', color = '#818cf8', color2 = '#a5b4fc', min, max, actualMin, actualMax }, ref) => {
    const chartRef = useRef<UPlotChartHandle>(null);
    const lastPushedIndexRef = useRef(-1);

    useImperativeHandle(ref, () => ({
      push: (value: number) => {
        chartRef.current?.push(value);
      },
    }));

    // Push new data points when data changes (only new ones)
    useEffect(() => {
      if (data.length === 0) {
        lastPushedIndexRef.current = -1;
        return;
      }
      
      // If array shrunk (old data filtered), reset tracking
      if (lastPushedIndexRef.current >= data.length) {
        lastPushedIndexRef.current = -1;
      }
      
      // Push all new points since last push
      if (lastPushedIndexRef.current < data.length - 1) {
        for (let i = lastPushedIndexRef.current + 1; i < data.length; i++) {
          const point = data[i];
          if (point.value !== undefined && Number.isFinite(point.value)) {
            chartRef.current?.push(point.value);
          }
        }
        lastPushedIndexRef.current = data.length - 1;
      }
    }, [data]);

    // Update range when min/max changes (only if both are provided)
    useEffect(() => {
      if (min !== undefined && max !== undefined && Number.isFinite(min) && Number.isFinite(max)) {
        chartRef.current?.setRange(min, max);
      } else {
        // Reset to autoscale
        chartRef.current?.setRange(NaN, NaN);
      }
    }, [min, max]);

    return (
      <div className="data-graph-container">
        {title && (
          <div className="graph-header">
            <h3 className="graph-title">{title}</h3>
            {actualMin !== undefined && actualMax !== undefined && (
              <div className="graph-minmax">
                <span className="minmax-label">
                  Min: <span className="minmax-value">{actualMin.toFixed(unit === 'RPM' ? 0 : unit === '°C' ? 1 : 2)}</span>
                </span>
                <span className="minmax-separator">|</span>
                <span className="minmax-label">
                  Max: <span className="minmax-value">{actualMax.toFixed(unit === 'RPM' ? 0 : unit === '°C' ? 1 : 2)}</span>
                </span>
              </div>
            )}
          </div>
        )}
        <div className="live-chart-wrapper">
          <UPlotChart
            ref={chartRef}
            maxPoints={300}
            lineWidth={2}
            yMin={min ?? null}
            yMax={max ?? null}
            color={color}
            color2={color2}
            height={200}
          />
        </div>
      </div>
    );
  }
);

DataGraph.displayName = 'DataGraph';
