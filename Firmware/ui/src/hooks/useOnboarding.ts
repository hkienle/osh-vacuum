import { useCallback, useEffect, useState } from 'react';
import {
  getOnboardingStatus,
  hasFinishedOnboarding,
  setOnboardingStatus,
} from './onboardingStorage';

export function useOnboarding() {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [isReplay, setIsReplay] = useState(false);

  useEffect(() => {
    setReady(true);
    if (!hasFinishedOnboarding()) {
      setOpen(true);
    }
  }, []);

  const complete = useCallback(() => {
    setOnboardingStatus('completed');
    setIsReplay(false);
    setOpen(false);
  }, []);

  const skip = useCallback(() => {
    if (!isReplay) {
      setOnboardingStatus('skipped');
    }
    setIsReplay(false);
    setOpen(false);
  }, [isReplay]);

  const reopen = useCallback(() => {
    setIsReplay(true);
    setOpen(true);
  }, []);

  const dismiss = useCallback(
    (finished: boolean) => {
      if (finished) {
        complete();
      } else {
        skip();
      }
    },
    [complete, skip],
  );

  return {
    open: ready && open,
    setOpen,
    complete,
    skip,
    reopen,
    dismiss,
    status: ready ? getOnboardingStatus() : 'pending',
  };
}
