import { useCallback, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';

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
  push: (value: number, timestamp?: number) => void;
  setRange: (yMin: number, yMax: number) => void;
  getRange: () => [number, number];
  reset: () => void;
}

export const UPlotChart = forwardRef<UPlotChartHandle, UPlotChartProps>(
  (
    {
      maxPoints = 300,
      lineWidth = 2,
      yMin = null,
      yMax = null,
      color = '#5dd0ff',
      color2: _color2 = '#7bffb9',
      height = 200,
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const plotRef = useRef<uPlot | null>(null);
    const dataRef = useRef<[number[], number[]]>([[], []]);
    const yMinRef = useRef<number | null>(yMin);
    const yMaxRef = useRef<number | null>(yMax);
    const pendingUpdateRef = useRef<number | null>(null);
    const flushToPlotRef = useRef<() => void>(() => {});

    const buildOptions = useCallback(
      (width: number): uPlot.Options => ({
        width: Math.max(width, 1),
        height,
        class: 'uplot-chart',
        cursor: { show: false },
        legend: { show: false },
        axes: [{ show: false }, { show: false }],
        scales: {
          x: {
            time: false,
            auto: false,
            range: (u) => {
              const timeData = u.data[0];
              if (timeData && timeData.length > 0) {
                const now = timeData[timeData.length - 1];
                const windowMs = 30000;
                return [now - windowMs, now];
              }
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
              const pad = (dataMax - dataMin) * 0.1 || 0.1;
              return [dataMin - pad, dataMax + pad];
            },
          },
        },
        series: [
          { label: 'Time', value: (_u, v) => v },
          {
            label: 'Value',
            stroke: color,
            width: lineWidth,
            fill: (u) => {
              const gradient = u.ctx.createLinearGradient(0, 0, 0, u.bbox.height);
              gradient.addColorStop(0, `${color}30`);
              gradient.addColorStop(1, `${color}05`);
              return gradient;
            },
            points: { show: false },
            spanGaps: false,
          },
        ],
      }),
      [color, height, lineWidth],
    );

    const flushToPlot = useCallback(() => {
      if (!plotRef.current) return;

      const [currentTimeData, currentValueData] = dataRef.current;
      if (currentTimeData.length === 0 || currentTimeData.length !== currentValueData.length) {
        return;
      }

      const hasInvalidTime = currentTimeData.some((t) => !Number.isFinite(t));
      const hasInvalidValue = currentValueData.some((v) => !Number.isFinite(v));
      if (hasInvalidTime || hasInvalidValue) {
        return;
      }

      const newTimeData = Array.from(currentTimeData);
      const newValueData = Array.from(currentValueData);
      const latestTime = newTimeData[newTimeData.length - 1];
      if (!Number.isFinite(latestTime)) {
        return;
      }

      const windowMs = 30000;
      try {
        plotRef.current.setData([newTimeData, newValueData], false);
        plotRef.current.setScale('x', { min: latestTime - windowMs, max: latestTime });
      } catch (error) {
        console.error('Error updating uPlot:', error);
        try {
          plotRef.current.redraw();
        } catch (redrawError) {
          console.error('Error redrawing uPlot:', redrawError);
        }
      }
    }, []);

    flushToPlotRef.current = flushToPlot;

    const scheduleFlush = useCallback(() => {
      if (pendingUpdateRef.current !== null) {
        cancelAnimationFrame(pendingUpdateRef.current);
      }
      pendingUpdateRef.current = requestAnimationFrame(() => {
        pendingUpdateRef.current = null;
        flushToPlot();
      });
    }, [flushToPlot]);

    // Initialize uPlot once the container has a real width (grid/flex layouts often start at 0).
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      let plot: uPlot | null = null;

      const ensurePlot = () => {
        const width = container.clientWidth;
        if (width <= 0) return;

        if (!plot) {
          plot = new uPlot(buildOptions(width), [[], []], container);
          plotRef.current = plot;
          flushToPlotRef.current();
          return;
        }

        plot.setSize({ width, height });
      };

      ensurePlot();
      const rafId = requestAnimationFrame(ensurePlot);

      const resizeObserver = new ResizeObserver(() => {
        ensurePlot();
      });
      resizeObserver.observe(container);

      return () => {
        cancelAnimationFrame(rafId);
        if (pendingUpdateRef.current !== null) {
          cancelAnimationFrame(pendingUpdateRef.current);
          pendingUpdateRef.current = null;
        }
        resizeObserver.disconnect();
        plot?.destroy();
        plotRef.current = null;
      };
    }, [buildOptions, height]);

    useEffect(() => {
      yMinRef.current = yMin;
      yMaxRef.current = yMax;
      if (plotRef.current && yMin != null && yMax != null && Number.isFinite(yMin) && Number.isFinite(yMax)) {
        plotRef.current.setScale('y', { min: yMin, max: yMax });
      } else if (plotRef.current) {
        plotRef.current.redraw();
      }
    }, [yMin, yMax]);

    useImperativeHandle(
      ref,
      () => ({
        push: (value: number, timestamp?: number) => {
          if (!Number.isFinite(value)) {
            console.warn('Invalid value pushed to chart:', value);
            return;
          }

          const now = timestamp ?? Date.now();
          let [timeData, valueData] = dataRef.current;

          if (!Array.isArray(timeData) || !Array.isArray(valueData)) {
            timeData = [];
            valueData = [];
          }

          const newTimeData = [...timeData, now];
          const newValueData = [...valueData, value];

          const finalTimeData = newTimeData.length > maxPoints ? newTimeData.slice(-maxPoints) : newTimeData;
          const finalValueData = newValueData.length > maxPoints ? newValueData.slice(-maxPoints) : newValueData;

          if (finalTimeData.length !== finalValueData.length) {
            console.error('Data arrays out of sync after update');
            return;
          }

          dataRef.current = [finalTimeData, finalValueData];
          scheduleFlush();
        },
        setRange: (min: number, max: number) => {
          yMinRef.current = Number.isFinite(min) ? min : null;
          yMaxRef.current = Number.isFinite(max) ? max : null;
          if (plotRef.current && yMinRef.current != null && yMaxRef.current != null) {
            plotRef.current.setScale('y', { min: yMinRef.current, max: yMaxRef.current });
          } else if (plotRef.current) {
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
        reset: () => {
          dataRef.current = [[], []];
          if (pendingUpdateRef.current !== null) {
            cancelAnimationFrame(pendingUpdateRef.current);
            pendingUpdateRef.current = null;
          }
          if (!plotRef.current) return;
          const now = Date.now();
          plotRef.current.setData([[], []], false);
          plotRef.current.setScale('x', { min: now - 30000, max: now });
          if (yMinRef.current != null && yMaxRef.current != null) {
            plotRef.current.setScale('y', { min: yMinRef.current, max: yMaxRef.current });
          } else {
            plotRef.current.redraw();
          }
        },
      }),
      [maxPoints, scheduleFlush],
    );

    return (
      <div
        ref={containerRef}
        className="uplot-chart-container min-w-0 w-full max-w-full"
        style={{ width: '100%', height: `${height}px` }}
      />
    );
  },
);

UPlotChart.displayName = 'UPlotChart';
