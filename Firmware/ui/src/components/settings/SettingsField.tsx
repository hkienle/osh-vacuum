import { FormRow } from '@/components/ui/form-row';
import { Stepper } from '@/components/ui/stepper';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SettingDescriptor } from '@/types/settings';

interface SettingsFieldProps {
  descriptor: SettingDescriptor;
  value: number;
  onChange: (value: number) => void;
}

export function SettingsField({ descriptor, value, onChange }: SettingsFieldProps) {
  const subline = descriptor.subline_dynamic ?? descriptor.subline;

  if (descriptor.enum_options && descriptor.enum_options.length > 0) {
    return (
      <FormRow label={descriptor.title} subline={subline}>
        <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent position="popper" className="z-[100]">
            {descriptor.enum_options.map((opt) => (
              <SelectItem key={opt.value} value={String(opt.value)}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormRow>
    );
  }

  if (descriptor.allowed_values && descriptor.allowed_values.length > 0) {
    return (
      <FormRow label={descriptor.title} subline={subline}>
        <Stepper value={value} values={descriptor.allowed_values} onChange={onChange} />
      </FormRow>
    );
  }

  if (typeof descriptor.range_min === 'number' && typeof descriptor.range_max === 'number') {
    return (
      <FormRow label={descriptor.title} subline={subline}>
        <div className="flex w-48 items-center gap-3">
          <Slider
            min={descriptor.range_min}
            max={descriptor.range_max}
            step={1}
            value={[value]}
            onValueChange={(v) => onChange(v[0] ?? value)}
          />
          <span className="w-8 font-mono text-sm tabular-nums">{value}</span>
        </div>
      </FormRow>
    );
  }

  return null;
}
