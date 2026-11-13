import type { ReactNode } from 'react';
import './FormRow.css';

interface FormRowProps {
  label: string;
  subline?: string;
  children: ReactNode;
}

export function FormRow({ label, subline, children }: FormRowProps) {
  return (
    <div className="ui-form-row">
      <div>
        <div className="ui-form-row-label">{label}</div>
        {subline ? <div className="ui-form-row-subline">{subline}</div> : null}
      </div>
      <div>{children}</div>
    </div>
  );
}
