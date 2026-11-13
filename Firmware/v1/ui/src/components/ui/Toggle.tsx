interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, disabled = false }: ToggleProps) {
  return <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />;
}
