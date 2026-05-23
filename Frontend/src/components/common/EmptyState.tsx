import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center space-y-4 p-8 border border-dashed border-border rounded-lg bg-card',
        className
      )}
    >
      {icon && (
        <div className="h-12 w-12 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground">
          {icon}
        </div>
      )}
      <div className="space-y-1 max-w-sm">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="text-xs text-muted-foreground leading-normal">{description}</p>}
      </div>
      {action}
    </div>
  );
}
