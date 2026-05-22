import './Select.css';

interface SelectOption {
  value: number;
  label: string;
}

interface SelectProps {
  value: number;
  options: SelectOption[];
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function Select({ value, options, onChange, disabled = false }: SelectProps) {
  return (
    <select
      className="ui-select"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      disabled={disabled}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
