import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StepperProps {
  value: number;
  values: number[];
  onChange: (value: number) => void;
}

export function Stepper({ value, values, onChange }: StepperProps) {
  const index = values.indexOf(value);
  const canDec = index > 0;
  const canInc = index >= 0 && index < values.length - 1;

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-8 rounded-full"
        disabled={!canDec}
        onClick={() => canDec && onChange(values[index - 1])}
        aria-label="Decrease"
      >
        <ChevronLeft className="size-4" />
      </Button>
      <span className="min-w-12 text-center font-mono text-sm tabular-nums">{value}</span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-8 rounded-full"
        disabled={!canInc}
        onClick={() => canInc && onChange(values[index + 1])}
        aria-label="Increase"
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
