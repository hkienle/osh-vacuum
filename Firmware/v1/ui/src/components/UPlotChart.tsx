import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import './UPlotChart.css';

interface UPlotChartProps {
  maxPoints?: number;
  lineWidth?: number;
  yMin?: number | null;
  yMax?: number | null;
  color?: string;
  color2?: string;
  height?: number;
}

export interface UPlotChartHandle {
  push: (value: number) => void;
  setRange: (yMin: number, yMax: number) => void;
  getRange: () => [number, number];
}

export const UPlotChart = forwardRef<UPlotChartHandle, UPlotChartProps>(
  (
    {
      maxPoints = 300,
      lineWidth = 2,
      yMin = null,
      yMax = null,
      color = '#5dd0ff',
      color2 = '#7bffb9',
      height = 200,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const plotRef = useRef<uPlot | null>(null);
    const dataRef = useRef<[number[], number[]]>([[], []]);
    const yMinRef = useRef<number | null>(yMin);
    const yMaxRef = useRef<number | null>(yMax);
    const pendingUpdateRef = useRef<number | null>(null);

    // Initialize uPlot
    useEffect(() => {
      if (!containerRef.current) return;

      const opts: uPlot.Options = {
        width: containerRef.current.clientWidth,
        height: height,
        class: 'uplot-chart',
        cursor: {
          show: false,
        },
        legend: {
          show: false,
        },
        axes: [
          {
            show: false,
          },
          {
            show: false,
          },
        ],
        scales: {
          x: {
            time: false,
            auto: false,
            // Dynamic range based on actual data - will be updated via setScale in push()
            range: (u, _dataMin, _dataMax) => {
              // Use the actual data to determine range
              const timeData = u.data[0];
              if (timeData && timeData.length > 0) {
                const now = timeData[timeData.length - 1];
                const windowMs = 30000;
                return [now - windowMs, now];
              }
              // Fallback if no data
              const now = Date.now();
              const windowMs = 30000;
              return [now - windowMs, now];
            },
          },
          y: {
            auto: yMinRef.current == null || yMaxRef.current == null,
            range: (_u, dataMin, dataMax) => {
              if (yMinRef.current != null && yMaxRef.current != null) {
                return [yMinRef.current, yMaxRef.current];
              }
              if (!Number.isFinite(dataMin) || !Number.isFinite(dataMax)) {
                return [0, 1];
              }
              // Auto scale with 10% padding
              const pad = (dataMax - dataMin) * 0.1 || 0.1;
              return [dataMin - pad, dataMax + pad];
            },
          },
        },
        series: [
          {
            label: 'Time',
            value: (_u, v) => v,
          },
          {
            label: 'Value',
            stroke: color,
            width: lineWidth,
            fill: (u) => {
              // Create gradient fill
              const gradient = u.ctx.createLinearGradient(0, 0, 0, u.bbox.height);
              gradient.addColorStop(0, `${color}40`);
              gradient.addColorStop(1, `${color2}10`);
              return gradient;
            },
            points: {
              show: false,
            },
            spanGaps: false,
          },
        ],
      };

      // Initial empty data
      const data: uPlot.AlignedData = [[], []];

      const plot = new uPlot(opts, data, containerRef.current);
      plotRef.current = plot;

      // Handle resize
      const resizeObserver = new ResizeObserver(() => {
        if (plot && containerRef.current) {
          plot.setSize({
            width: containerRef.current.clientWidth,
            height: height,
          });
        }
      });

      resizeObserver.observe(containerRef.current);

      return () => {
        // Cancel any pending animation frame
        if (pendingUpdateRef.current !== null) {
          cancelAnimationFrame(pendingUpdateRef.current);
          pendingUpdateRef.current = null;
        }
        resizeObserver.disconnect();
        plot.destroy();
      };
    }, [height, color, color2, lineWidth]);

    // Update y-axis range when min/max changes
    useEffect(() => {
      yMinRef.current = yMin;
      yMaxRef.current = yMax;
      if (plotRef.current && yMin != null && yMax != null && Number.isFinite(yMin) && Number.isFinite(yMax)) {
        plotRef.current.setScale('y', { min: yMin, max: yMax });
      } else if (plotRef.current) {
        // Reset to auto if min/max not set - trigger redraw to recalculate
        plotRef.current.redraw();
      }
    }, [yMin, yMax]);

    useImperativeHandle(ref, () => ({
      push: (value: number) => {
        if (!plotRef.current) return;

        // Validate input
        if (!Number.isFinite(value)) {
          console.warn('Invalid value pushed to chart:', value);
          return;
        }

        const now = Date.now();
        let [timeData, valueData] = dataRef.current;

        // Ensure arrays exist and are valid
        if (!Array.isArray(timeData) || !Array.isArray(valueData)) {
          timeData = [];
          valueData = [];
        }

        // Create new arrays with the new point (immutable approach for reliability)
        const newTimeData = [...timeData, now];
        const newValueData = [...valueData, value];

        // Keep only last maxPoints
        const finalTimeData = newTimeData.length > maxPoints 
          ? newTimeData.slice(-maxPoints) 
          : newTimeData;
        const finalValueData = newValueData.length > maxPoints 
          ? newValueData.slice(-maxPoints) 
          : newValueData;

        // Ensure arrays are still synchronized
        if (finalTimeData.length !== finalValueData.length) {
          console.error('Data arrays out of sync after update');
          return;
        }

        // Update refs with new arrays
        dataRef.current = [finalTimeData, finalValueData];

        // Cancel any pending update
        if (pendingUpdateRef.current !== null) {
          cancelAnimationFrame(pendingUpdateRef.current);
        }

        // Batch update on next frame for smooth rendering
        pendingUpdateRef.current = requestAnimationFrame(() => {
          pendingUpdateRef.current = null;
          
          if (!plotRef.current) return;

          const [currentTimeData, currentValueData] = dataRef.current;

          // Validate data before updating
          if (!Array.isArray(currentTimeData) || !Array.isArray(currentValueData)) {
            console.warn('Data arrays invalid, skipping update');
            return;
          }

          if (currentTimeData.length !== currentValueData.length) {
            console.warn('Data length mismatch, skipping update', {
              timeLength: currentTimeData.length,
              valueLength: currentValueData.length
            });
            return;
          }

          if (currentTimeData.length === 0) {
            return;
          }

          // Validate all timestamps and values are finite
          const hasInvalidTime = currentTimeData.some(t => !Number.isFinite(t));
          const hasInvalidValue = currentValueData.some(v => !Number.isFinite(v));
          if (hasInvalidTime || hasInvalidValue) {
            console.warn('Invalid data points detected, skipping update');
            return;
          }

          // Create new array references for uPlot (it needs new references to detect changes)
          const newTimeData = Array.from(currentTimeData);
          const newValueData = Array.from(currentValueData);

          // Calculate the x-axis range based on latest data
          const latestTime = newTimeData[newTimeData.length - 1];
          if (!Number.isFinite(latestTime)) {
            console.warn('Invalid latest time, skipping update');
            return;
          }

          const windowMs = 30000;
          const xMin = latestTime - windowMs;
          const xMax = latestTime;

          // Update plot data and x-axis range
          try {
            // First update the data
            plotRef.current.setData([newTimeData, newValueData], false);
            
            // Then explicitly update the x-axis scale to ensure smooth scrolling
            plotRef.current.setScale('x', { min: xMin, max: xMax });
          } catch (error) {
            console.error('Error updating uPlot:', error);
            // Try to recover by redrawing
            try {
              plotRef.current.redraw();
            } catch (redrawError) {
              console.error('Error redrawing uPlot:', redrawError);
            }
          }
        });
      },
      setRange: (min: number, max: number) => {
        yMinRef.current = Number.isFinite(min) ? min : null;
        yMaxRef.current = Number.isFinite(max) ? max : null;
        if (plotRef.current && yMinRef.current != null && yMaxRef.current != null) {
          plotRef.current.setScale('y', { min: yMinRef.current, max: yMaxRef.current });
        } else if (plotRef.current) {
          // Reset to auto - trigger redraw
          plotRef.current.redraw();
        }
      },
      getRange: () => {
        if (yMinRef.current != null && yMaxRef.current != null) {
          return [yMinRef.current, yMaxRef.current];
        }
        const [, valueData] = dataRef.current;
        if (valueData.length === 0) return [0, 1];
        const min = Math.min(...valueData);
        const max = Math.max(...valueData);
        const pad = (max - min) * 0.1;
        return [min - pad, max + pad];
      },
    }), [maxPoints]);

    return (
      <div
        ref={containerRef}
        className="uplot-chart-container"
        style={{ width: '100%', height: `${height}px` }}
      />
    );
  }
);

UPlotChart.displayName = 'UPlotChart';

