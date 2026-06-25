import type { ComponentProps, ReactNode } from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InfoBoxProps extends ComponentProps<'div'> {
  children: ReactNode;
}

export function InfoBox({ children, className, role = 'note', ...props }: InfoBoxProps) {
  return (
    <div
      role={role}
      className={cn(
        'flex gap-3 rounded-lg border border-border bg-muted/40 p-3 text-sm leading-relaxed text-muted-foreground',
        className,
      )}
      {...props}
    >
      <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
