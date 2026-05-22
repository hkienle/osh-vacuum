import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormRow } from './FormRow';

describe('FormRow', () => {
  it('renders label and subline', () => {
    render(
      <FormRow label="Auto-Off" subline="Motor Shutdown">
        <span>child</span>
      </FormRow>
    );
    expect(screen.getByText('Auto-Off')).toBeInTheDocument();
    expect(screen.getByText('Motor Shutdown')).toBeInTheDocument();
  });
});
