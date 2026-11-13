import { FormRow } from '../ui/FormRow';
import { Select } from '../ui/Select';
import { Slider } from '../ui/Slider';
import { Stepper } from '../ui/Stepper';
import type { SettingDescriptor } from '../../types/settings';

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
        <Select value={value} options={descriptor.enum_options} onChange={onChange} />
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
        <Slider value={value} min={descriptor.range_min} max={descriptor.range_max} onChange={onChange} />
      </FormRow>
    );
  }
  return null;
}
