import { describe, expect, it, beforeEach } from 'vitest';
import {
  getOnboardingStatus,
  hasFinishedOnboarding,
  ONBOARDING_STORAGE_KEY,
  setOnboardingStatus,
} from './onboardingStorage';

describe('onboardingStorage', () => {
  beforeEach(() => {
    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
  });

  it('starts as pending', () => {
    expect(getOnboardingStatus()).toBe('pending');
    expect(hasFinishedOnboarding()).toBe(false);
  });

  it('persists completed and skipped', () => {
    setOnboardingStatus('completed');
    expect(getOnboardingStatus()).toBe('completed');
    expect(hasFinishedOnboarding()).toBe(true);

    setOnboardingStatus('skipped');
    expect(getOnboardingStatus()).toBe('skipped');
    expect(hasFinishedOnboarding()).toBe(true);
  });
});
