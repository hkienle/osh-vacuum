export const ONBOARDING_STORAGE_KEY = 'oshvac_onboarding';

export type OnboardingStatus = 'pending' | 'completed' | 'skipped';

export function getOnboardingStatus(): OnboardingStatus {
  if (typeof window === 'undefined') {
    return 'pending';
  }
  const stored = localStorage.getItem(ONBOARDING_STORAGE_KEY);
  if (stored === 'completed' || stored === 'skipped') {
    return stored;
  }
  return 'pending';
}

export function setOnboardingStatus(status: 'completed' | 'skipped'): void {
  localStorage.setItem(ONBOARDING_STORAGE_KEY, status);
}

export function hasFinishedOnboarding(): boolean {
  const status = getOnboardingStatus();
  return status === 'completed' || status === 'skipped';
}
