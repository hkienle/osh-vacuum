import { useState, useEffect, useCallback } from 'react';

export interface DataPoint {
  timestamp: number;
  rpm?: number;
  temperature?: number;
  voltage?: number;
}

const HISTORY_WINDOW_MS = 30000; // 30 seconds

export function useDataHistory() {
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([]);

  const addDataPoint = useCallback((rpm?: number, temperature?: number, voltage?: number) => {
    const now = Date.now();
    setDataPoints((prev) => {
      const newPoint: DataPoint = {
        timestamp: now,
        rpm,
        temperature,
        voltage,
      };
      
      // Add new point and filter out old ones
      const updated = [...prev, newPoint].filter(
        (point) => now - point.timestamp <= HISTORY_WINDOW_MS
      );
      
      return updated;
    });
  }, []);

  // Clean up old data points periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setDataPoints((prev) =>
        prev.filter((point) => now - point.timestamp <= HISTORY_WINDOW_MS)
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const getRpmData = useCallback(() => {
    return dataPoints
      .filter((p) => p.rpm !== undefined)
      .map((p) => ({
        time: new Date(p.timestamp).toLocaleTimeString(),
        value: p.rpm!,
        timestamp: p.timestamp,
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [dataPoints]);

  const getTemperatureData = useCallback(() => {
    return dataPoints
      .filter((p) => p.temperature !== undefined)
      .map((p) => ({
        time: new Date(p.timestamp).toLocaleTimeString(),
        value: p.temperature!,
        timestamp: p.timestamp,
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [dataPoints]);

  const getVoltageData = useCallback(() => {
    return dataPoints
      .filter((p) => p.voltage !== undefined)
      .map((p) => ({
        time: new Date(p.timestamp).toLocaleTimeString(),
        value: p.voltage!,
        timestamp: p.timestamp,
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [dataPoints]);

  return {
    addDataPoint,
    getRpmData,
    getTemperatureData,
    getVoltageData,
  };
}

