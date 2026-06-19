import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';

interface FormRowProps {
  label: string;
  subline?: string;
  children: ReactNode;
}

export function FormRow({ label, subline, children }: FormRowProps) {
  return (
    <div className="flex flex-col gap-2 border-b py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <Label className="text-sm font-medium">{label}</Label>
        {subline && <p className="text-xs text-muted-foreground">{subline}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
