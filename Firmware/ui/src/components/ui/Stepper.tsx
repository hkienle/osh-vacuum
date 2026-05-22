import { Button } from './Button';
import './Stepper.css';

interface StepperProps {
  value: number;
  values: number[];
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function Stepper({ value, values, onChange, disabled = false }: StepperProps) {
  const idx = Math.max(0, values.indexOf(value));
  const prev = values[(idx - 1 + values.length) % values.length] ?? value;
  const next = values[(idx + 1) % values.length] ?? value;
  return (
    <div className="ui-stepper">
      <Button disabled={disabled} onClick={() => onChange(prev)}>
        -
      </Button>
      <span>{value}</span>
      <Button disabled={disabled} onClick={() => onChange(next)}>
        +
      </Button>
    </div>
  );
}
