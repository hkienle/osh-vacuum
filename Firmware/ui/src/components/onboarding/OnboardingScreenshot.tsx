import { ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OnboardingScreenshotProps {
  src?: string;
  alt: string;
  className?: string;
}

export function OnboardingScreenshot({ src, alt, className }: OnboardingScreenshotProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={cn('block h-auto w-full', className)}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={alt}
      className={cn(
        'flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-muted-foreground/40 bg-muted/20 px-4 text-center',
        className,
      )}
    >
      <ImageIcon className="size-8 text-muted-foreground/60" aria-hidden />
      <span className="text-xs font-medium text-muted-foreground">Screenshot coming soon</span>
    </div>
  );
}
