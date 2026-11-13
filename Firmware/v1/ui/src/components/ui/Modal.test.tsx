import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';

describe('Modal', () => {
  it('renders open state and close button', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} title="Test Modal" onClose={onClose}>
        body
      </Modal>
    );
    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    screen.getByLabelText('Close modal').click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
