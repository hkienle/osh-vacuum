import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OnboardingModal } from './OnboardingModal';
import { ONBOARDING_STEPS } from './onboardingSteps';

describe('OnboardingModal', () => {
  it('renders first step and advances through the tour', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const onSkip = vi.fn();

    render(
      <OnboardingModal open={true} onComplete={onComplete} onSkip={onSkip} onConnect={vi.fn()} />,
    );

    expect(screen.getByText(ONBOARDING_STEPS[0].title)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: ONBOARDING_STEPS[0].screenshotAlt })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText(ONBOARDING_STEPS[1].title)).toBeInTheDocument();
  });

  it('calls onSkip when skip tour is clicked', async () => {
    const user = userEvent.setup();
    const onSkip = vi.fn();

    render(<OnboardingModal open={true} onComplete={vi.fn()} onSkip={onSkip} />);
    await user.click(screen.getByRole('button', { name: 'Skip tour' }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
