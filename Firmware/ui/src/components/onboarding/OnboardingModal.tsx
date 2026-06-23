import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { OnboardingScreenshot } from '@/components/onboarding/OnboardingScreenshot';
import { ONBOARDING_STEPS } from '@/components/onboarding/onboardingSteps';
import { cn } from '@/lib/utils';

interface OnboardingModalProps {
  open: boolean;
  onComplete: () => void;
  onSkip: () => void;
  onConnect?: () => void;
}

export function OnboardingModal({ open, onComplete, onSkip, onConnect }: OnboardingModalProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = ONBOARDING_STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === ONBOARDING_STEPS.length - 1;
  const stepCount = ONBOARDING_STEPS.length;

  useEffect(() => {
    if (open) {
      setStepIndex(0);
    }
  }, [open]);

  const goNext = () => {
    if (isLast) {
      onComplete();
      return;
    }
    setStepIndex((i) => Math.min(i + 1, stepCount - 1));
  };

  const goBack = () => {
    setStepIndex((i) => Math.max(i - 1, 0));
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      onSkip();
    }
  };

  const handleConnectNow = () => {
    onComplete();
    onConnect?.();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="flex max-h-[92vh] max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl lg:max-w-4xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex flex-1 flex-col overflow-y-auto px-8 pt-6 pb-4 sm:px-10">
          <DialogHeader className="space-y-1 text-left">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Step {stepIndex + 1} of {stepCount}
            </p>
            <DialogTitle>{step.title}</DialogTitle>
            <DialogDescription className="text-left text-sm leading-relaxed">
              {step.description}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4">
            <OnboardingScreenshot src={step.screenshotSrc} alt={step.screenshotAlt} />
          </div>

          <div
            className="mt-4 flex justify-center gap-1.5"
            role="tablist"
            aria-label="Onboarding progress"
          >
            {ONBOARDING_STEPS.map((s, i) => (
              <span
                key={s.id}
                role="tab"
                aria-selected={i === stepIndex}
                aria-label={`Step ${i + 1}: ${s.title}`}
                className={cn(
                  'size-2 rounded-full transition-colors',
                  i === stepIndex ? 'bg-primary' : 'bg-muted-foreground/30',
                )}
              />
            ))}
          </div>
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-2 border-t bg-muted/20 px-8 py-4 sm:px-10 sm:justify-between">
          <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={onSkip}>
            Skip tour
          </Button>

          <div className="flex gap-2">
            {!isFirst && (
              <Button type="button" variant="outline" onClick={goBack}>
                Back
              </Button>
            )}
            {isLast ? (
              <Button type="button" onClick={onConnect ? handleConnectNow : onComplete}>
                Connect now
              </Button>
            ) : (
              <Button type="button" onClick={goNext}>
                Next
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
