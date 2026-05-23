import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageShellProps {
  children: ReactNode;
  className?: string;
  centered?: boolean;
}

export function PageShell({ children, className, centered = false }: PageShellProps) {
  return (
    <div
      className={cn(
        'min-h-screen w-full bg-background',
        centered && 'flex items-center justify-center px-4 py-12',
        className
      )}
    >
      {children}
    </div>
  );
}
