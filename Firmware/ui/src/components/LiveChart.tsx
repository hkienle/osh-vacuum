import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import './LiveChart.css';

interface LiveChartProps {
  maxPoints?: number;
  lineWidth?: number;
  yMin?: number | null;
  yMax?: number | null;
  grid?: boolean;
  color?: string;
  color2?: string;
  height?: number;
}

export interface LiveChartHandle {
  push: (value: number) => void;
  setRange: (yMin: number, yMax: number) => void;
  getRange: () => [number, number];
}

export const LiveChart = forwardRef<LiveChartHandle, LiveChartProps>(
  (
    {
      maxPoints = 300,
      lineWidth = 2,
      yMin = null,
      yMax = null,
      grid = true,
      color = '#5dd0ff',
      color2 = '#7bffb9',
      height = 64,
    },
    ref
  ) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const dataRef = useRef<Float32Array>(new Float32Array(maxPoints).fill(NaN));
    const headRef = useRef(0);
    const countRef = useRef(0);
    const yMinRef = useRef<number | null>(yMin);
    const yMaxRef = useRef<number | null>(yMax);
    const pendingRef = useRef(false);
    const lastScaleRef = useRef<[number, number]>([0, 1]);
    const drawRef = useRef<(() => void) | undefined>(undefined);

    const drawGrid = useCallback((xStep = 50, yLines = 2) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.save();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      // verticals
      for (let x = w - 0.5; x >= 0; x -= xStep) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      // horizontals
      for (let i = 1; i <= yLines; i++) {
        const y = Math.round((h * i) / (yLines + 1)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.restore();
    }, []);

    const getRange = useCallback((): [number, number] => {
      if (yMinRef.current != null && yMaxRef.current != null) {
        return [yMinRef.current, yMaxRef.current];
      }
      // autoscale on last N points ignoring NaNs
      let min = Infinity,
        max = -Infinity;
      for (let i = 0; i < countRef.current; i++) {
        const idx = (headRef.current - 1 - i + maxPoints) % maxPoints;
        const v = dataRef.current[idx];
        if (!Number.isFinite(v)) continue;
        if (v < min) min = v;
        if (v > max) max = v;
      }
      if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
      if (min === max) {
        min -= 0.5;
        max += 0.5;
      }
      // 10% padding
      const pad = (max - min) * 0.1;
      return [min - pad, max + pad];
    }, [maxPoints]);

    const draw = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d', { 
        alpha: false, // Opaque background for better performance
        desynchronized: true // Allow async rendering for smoother animation
      });
      if (!ctx) return;
      
      // Enable high-quality image smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      // Clear the entire canvas (use actual canvas dimensions, but clear in transformed coordinates)
      ctx.clearRect(0, 0, w, h);
      if (grid) drawGrid();

      // gradient stroke
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, color);
      grad.addColorStop(1, color2);
      ctx.strokeStyle = grad;
      ctx.lineWidth = lineWidth;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      // Enable better line rendering
      ctx.miterLimit = 2;

      const [minY, maxY] = getRange();
      lastScaleRef.current = [minY, maxY];
      const scaleY = (v: number) => h - ((v - minY) / (maxY - minY)) * h;

      // draw polyline from oldest -> newest
      // Use sub-pixel positioning (no rounding) for smoother rendering
      let first = true;
      ctx.beginPath();
      for (let i = countRef.current - 1; i >= 0; i--) {
        const idx = (headRef.current - 1 - i + maxPoints) % maxPoints;
        const v = dataRef.current[idx];
        if (!Number.isFinite(v)) continue;
        // Sub-pixel positioning for smoother lines (no rounding)
        const x = (w * (countRef.current - 1 - i)) / (maxPoints - 1);
        const y = scaleY(v);
        if (first) {
          ctx.moveTo(x, y);
          first = false;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }, [grid, color, color2, lineWidth, maxPoints, getRange, drawGrid]);

    // Store draw function in ref so it's always the latest version
    drawRef.current = draw;

    useImperativeHandle(ref, () => ({
      push: (value: number) => {
        dataRef.current[headRef.current] = value;
        headRef.current = (headRef.current + 1) % maxPoints;
        if (countRef.current < maxPoints) countRef.current++;
        if (!pendingRef.current) {
          pendingRef.current = true;
          requestAnimationFrame(() => {
            pendingRef.current = false;
            drawRef.current?.();
          });
        }
      },
      setRange: (min: number, max: number) => {
        yMinRef.current = Number.isFinite(min) ? min : null;
        yMaxRef.current = Number.isFinite(max) ? max : null;
        // Schedule draw instead of calling directly to avoid multiple draws
        if (!pendingRef.current) {
          pendingRef.current = true;
          requestAnimationFrame(() => {
            pendingRef.current = false;
            drawRef.current?.();
          });
        }
      },
      getRange,
    }), [maxPoints, getRange]);

    const resize = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const { clientWidth: w, clientHeight: h } = canvas;
      canvas.width = Math.max(10, Math.floor(w * dpr));
      canvas.height = Math.max(10, Math.floor(h * dpr));
      const ctx = canvas.getContext('2d', { 
        alpha: false,
        desynchronized: true
      });
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        // Enable high-quality smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
      }
      draw();
    }, [draw]);

    useEffect(() => {
      resize();
      const observer = new ResizeObserver(() => resize());
      const canvas = canvasRef.current;
      if (canvas) {
        observer.observe(canvas);
      }
      return () => observer.disconnect();
    }, [resize]);

    useEffect(() => {
      yMinRef.current = yMin;
      yMaxRef.current = yMax;
      // Schedule draw to avoid multiple simultaneous draws
      if (!pendingRef.current) {
        pendingRef.current = true;
        requestAnimationFrame(() => {
          pendingRef.current = false;
          drawRef.current?.();
        });
      }
    }, [yMin, yMax]);

    return (
      <canvas
        ref={canvasRef}
        className="live-chart-canvas"
        style={{ width: '100%', height: `${height}px`, display: 'block' }}
      />
    );
  }
);

LiveChart.displayName = 'LiveChart';
