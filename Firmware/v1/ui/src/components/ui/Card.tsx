import type { ReactNode } from 'react';
import './Card.css';

export function Card({ children }: { children: ReactNode }) {
  return <div className="ui-card">{children}</div>;
}
