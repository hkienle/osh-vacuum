import type { ButtonHTMLAttributes } from 'react';
import { Button } from './Button';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
}

export function IconButton({ label, children, ...props }: IconButtonProps) {
  return (
    <Button aria-label={label} {...props}>
      {children}
    </Button>
  );
}
