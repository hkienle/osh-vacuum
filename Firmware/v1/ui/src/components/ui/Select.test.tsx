import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Select } from './Select';

describe('Select', () => {
  it('emits selected value', () => {
    const onChange = vi.fn();
    render(<Select value={1} options={[{ value: 1, label: 'One' }, { value: 2, label: 'Two' }]} onChange={onChange} />);
    (screen.getByRole('combobox') as HTMLSelectElement).value = '2';
    screen.getByRole('combobox').dispatchEvent(new Event('change', { bubbles: true }));
    expect(onChange).toHaveBeenCalledWith(2);
  });
});
