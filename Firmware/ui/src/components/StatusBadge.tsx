import type { KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  connected: boolean;
  transport?: string;
  onClick?: () => void;
  className?: string;
  /** header = green dot when connected only. detail = full status label (panel). */
  variant?: 'header' | 'detail';
}

export function StatusBadge({
  connected,
  transport,
  onClick,
  className,
  variant = 'detail',
}: StatusBadgeProps) {
  if (variant === 'header') {
    if (!connected) return null;

    return (
        <button
          type="button"
          aria-label={`Connected${transport ? ` via ${transport}` : ''}`}
          className={cn('inline-flex items-center justify-center rounded-full p-1.5 hover:bg-accent', className)}
          onClick={onClick}
        >
          <span className="size-2.5 shrink-0 rounded-full bg-success" aria-hidden />
        </button>
      );
  }

  const label = connected
    ? `Connected${transport ? ` · ${transport.toUpperCase()}` : ''}`
    : 'Disconnected';

  const interactiveProps = onClick
    ? {
        onClick,
        role: 'button' as const,
        tabIndex: 0,
        onKeyDown: (e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        },
      }
    : {};

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm tracking-wide uppercase',
        className,
      )}
      {...interactiveProps}
    >
      <span
        className={cn(
          'inline-block size-2 shrink-0 rounded-full',
          connected ? 'bg-success' : 'bg-muted-foreground',
        )}
        aria-hidden
      />
      <span>{label}</span>
    </div>
  );
}
