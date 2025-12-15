import { useState, useEffect } from 'react';
import { DataGraph } from './DataGraph';
import { useWebSocketContext } from '../contexts/WebSocketContext';
import { useDataHistory } from '../hooks/useDataHistory';
import './ControlPanel.css';

export function ControlPanel() {
  const [speed, setSpeed] = useState(0);
  const [isStarted, setIsStarted] = useState(false);
  const { connected, sendMessage, lastMessage } = useWebSocketContext();
  const { addDataPoint, getRpmData, getTemperatureData, getVoltageData } = useDataHistory();

  // Update data history when new messages arrive
  useEffect(() => {
    if (lastMessage) {
      addDataPoint(lastMessage.rpm, lastMessage.temperature, lastMessage.voltage);
    }
  }, [lastMessage, addDataPoint]);

  // Sync speed from ESP32 (round to nearest 20% step)
  useEffect(() => {
    if (lastMessage?.speed !== undefined) {
      const esp32Speed = lastMessage.speed;
      // Round to nearest 20% step to match ESP32 behavior
      const roundedSpeed = Math.round(esp32Speed / 20) * 20;
      setSpeed(roundedSpeed);
    }
  }, [lastMessage?.speed]);

  // Sync motor state from ESP32 - always update when we receive a motor_active message
  useEffect(() => {
    if (lastMessage?.motor_active !== undefined) {
      const motorActive = lastMessage.motor_active;
      console.log('[ControlPanel] Received motor_active from ESP32:', motorActive);
      setIsStarted((prev) => {
        // Only update if the value actually changed to avoid unnecessary re-renders
        if (prev !== motorActive) {
          console.log('[ControlPanel] Updating isStarted from', prev, 'to', motorActive);
          return motorActive;
        }
        return prev;
      });
    }
  }, [lastMessage?.motor_active]);

  // Reset started state when disconnected
  useEffect(() => {
    if (!connected) {
      setIsStarted(false);
    }
  }, [connected]);

  // Send speed command (ESP32 accepts 0-100% as exact value)
  const sendSpeedCommand = (speedValue: number) => {
    if (connected) {
      // Clamp to valid range
      const clampedSpeed = Math.max(0, Math.min(100, Math.round(speedValue)));
      // ESP32 accepts 0-100% directly (exact value, not rounded to 20%)
      sendMessage({ speed: clampedSpeed });
    }
  };

  const handleSpeedChange = (newSpeed: number) => {
    // Clamp to valid range (0-100)
    const clampedSpeed = Math.max(0, Math.min(100, Math.round(newSpeed)));
    setSpeed(clampedSpeed);
    // Send speed command immediately (ESP32 handles motor state internally)
    sendSpeedCommand(clampedSpeed);
  };

  const handlePreset = (presetSpeed: number) => {
    // Clamp to valid range
    const clampedSpeed = Math.max(0, Math.min(100, Math.round(presetSpeed)));
    setSpeed(clampedSpeed);
    // Send speed command immediately
    sendSpeedCommand(clampedSpeed);
  };

  const handleStart = () => {
    if (connected && !isStarted) {
      // Optimistically update UI immediately
      setIsStarted(true);
      // Send motor_start command
      sendMessage({ command: 'motor_start' });
      // Send current speed setting (exact value, not rounded)
      const clampedSpeed = Math.max(0, Math.min(100, Math.round(speed)));
      sendMessage({ speed: clampedSpeed });
    }
  };

  const handleStop = () => {
    if (connected && isStarted) {
      // Optimistically update UI immediately
      setIsStarted(false);
      // Send motor_stop command
      sendMessage({ command: 'motor_stop' });
      // Don't reset the slider value - keep speed setting
    }
  };

  const currentRpm = lastMessage?.rpm ?? 0;
  const currentTemperature = lastMessage?.temperature ?? 0;
  const currentVoltage = lastMessage?.voltage ?? 0;

  // Get graph data (functions are already memoized in useDataHistory)
  const rpmData = getRpmData();
  const tempData = getTemperatureData();
  const voltageData = getVoltageData();

  // Calculate actual min/max from data (for display)
  const rpmActualMin = rpmData.length > 0 ? Math.min(...rpmData.map(d => d.value)) : undefined;
  const rpmActualMax = rpmData.length > 0 ? Math.max(...rpmData.map(d => d.value)) : undefined;
  const tempActualMin = tempData.length > 0 ? Math.min(...tempData.map(d => d.value)) : undefined;
  const tempActualMax = tempData.length > 0 ? Math.max(...tempData.map(d => d.value)) : undefined;
  const voltageActualMin = voltageData.length > 0 ? Math.min(...voltageData.map(d => d.value)) : undefined;
  const voltageActualMax = voltageData.length > 0 ? Math.max(...voltageData.map(d => d.value)) : undefined;

  // Soft max logic: always show at least 0-30, but expand 5 units above if values exceed 30
  const calculateSoftMax = (actualMax: number | undefined, minValue: number = 0, baseMax: number = 30, padding: number = 5) => {
    if (actualMax === undefined) return { min: minValue, max: baseMax };
    const max = actualMax > baseMax ? actualMax + padding : baseMax;
    return { min: minValue, max };
  };

  // RPM specific: always show from -5 to at least +10, extending more if values go higher
  const calculateRpmRange = (actualMax: number | undefined) => {
    const minValue = -5;
    const baseMax = 10;
    const padding = 5;
    if (actualMax === undefined) return { min: minValue, max: baseMax };
    const max = actualMax > baseMax ? actualMax + padding : baseMax;
    return { min: minValue, max };
  };

  const rpmRange = calculateRpmRange(rpmActualMax);
  const tempRange = calculateSoftMax(tempActualMax, 0, 30, 5);
  const voltageRange = calculateSoftMax(voltageActualMax, 0, 30, 5);

  const rpmMin = rpmRange.min;
  const rpmMax = rpmRange.max;
  const tempMin = tempRange.min;
  const tempMax = tempRange.max;
  const voltageMin = voltageRange.min;
  const voltageMax = voltageRange.max;

  return (
    <div className="control-panel">
      {/* Controls Section */}
      <div className="controls-section">
        <div className="speed-control-section">
          <div className="speed-header">
            <label htmlFor="speed-slider" className="input-label">
              Motor Speed: {speed}%
            </label>
          </div>
          <div className="speed-slider-wrapper">
            <div 
              className="speed-slider-progress" 
              style={{ width: `${speed}%` }}
            />
            <input
              key={speed}
              id="speed-slider"
              type="range"
              min="0"
              max="100"
              step="1"
              value={speed}
              onChange={(e) => handleSpeedChange(Number(e.target.value))}
              className="speed-slider"
              disabled={!connected}
            />
          </div>
          
          <div className="preset-buttons">
            <button
              onClick={() => handlePreset(0)}
              className="preset-button"
              disabled={!connected}
            >
              0%
            </button>
            <button
              onClick={() => handlePreset(20)}
              className="preset-button"
              disabled={!connected}
            >
              20%
            </button>
            <button
              onClick={() => handlePreset(40)}
              className="preset-button"
              disabled={!connected}
            >
              40%
            </button>
            <button
              onClick={() => handlePreset(60)}
              className="preset-button"
              disabled={!connected}
            >
              60%
            </button>
            <button
              onClick={() => handlePreset(80)}
              className="preset-button"
              disabled={!connected}
            >
              80%
            </button>
            <button
              onClick={() => handlePreset(100)}
              className="preset-button"
              disabled={!connected}
            >
              100%
            </button>
          </div>
        </div>

        <div className="control-buttons">
          <button
            onClick={handleStart}
            className="control-button start-button"
            disabled={!connected || isStarted}
          >
            Start
          </button>
          <button
            onClick={handleStop}
            className={`control-button stop-button ${isStarted ? 'active' : ''}`}
            disabled={!connected || !isStarted}
          >
            Stop
          </button>
        </div>
      </div>

      {/* Graphs Section */}
      <div className="graphs-section">
        <div className="graph-card graph-card-rpm">
          <div className="graph-value">
            <span className="value-number value-rpm">{currentRpm.toFixed(0)}</span>
            <span className="value-unit">RPM</span>
          </div>
          <DataGraph
            data={rpmData}
            title="Impeller RPM"
            unit="RPM"
            color="#818cf8"
            color2="#a5b4fc"
            min={rpmMin}
            max={rpmMax}
            actualMin={rpmActualMin}
            actualMax={rpmActualMax}
          />
        </div>
        
        <div className="graph-card graph-card-temp">
          <div className="graph-value">
            <span className="value-number value-temp">{currentTemperature.toFixed(1)}</span>
            <span className="value-unit">°C</span>
          </div>
          <DataGraph
            data={tempData}
            title="Exhaust Temperature"
            unit="°C"
            color="#f472b6"
            color2="#f9a8d4"
            min={tempMin}
            max={tempMax}
            actualMin={tempActualMin}
            actualMax={tempActualMax}
          />
        </div>
        
        <div className="graph-card graph-card-voltage">
          <div className="graph-value">
            <span className="value-number value-voltage">{currentVoltage.toFixed(2)}</span>
            <span className="value-unit">V</span>
          </div>
          <DataGraph
            data={voltageData}
            title="Battery Voltage"
            unit="V"
            color="#34d399"
            color2="#6ee7b7"
            min={voltageMin}
            max={voltageMax}
            actualMin={voltageActualMin}
            actualMax={voltageActualMax}
          />
        </div>
      </div>
    </div>
  );
}
