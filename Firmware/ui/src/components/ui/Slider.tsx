import './Slider.css';

interface SliderProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function Slider({ value, min, max, onChange, disabled = false }: SliderProps) {
  return (
    <div className="ui-slider-wrap">
      <input
        className="ui-slider"
        type="range"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span>{value}</span>
    </div>
  );
}
