import type { ReactNode } from 'react';
import { Button } from './Button';
import './Modal.css';

interface ModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  closeDisabled?: boolean;
}

export function Modal({ isOpen, title, onClose, children, closeDisabled = false }: ModalProps) {
  if (!isOpen) return null;
  return (
    <div className="ui-modal-overlay">
      <div className="ui-modal">
        <div className="ui-modal-header">
          <h2>{title}</h2>
          <Button onClick={onClose} disabled={closeDisabled} aria-label="Close modal">
            x
          </Button>
        </div>
        <div className="ui-modal-body">{children}</div>
      </div>
    </div>
  );
}
