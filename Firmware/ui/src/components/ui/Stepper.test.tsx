import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Stepper } from './Stepper';

describe('Stepper', () => {
  it('steps forward', () => {
    const onChange = vi.fn();
    render(<Stepper value={10} values={[5, 10, 20]} onChange={onChange} />);
    screen.getByText('+').click();
    expect(onChange).toHaveBeenCalledWith(20);
  });
});
