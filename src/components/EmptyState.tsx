import type { LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center text-muted-foreground', className)}>
      <Icon className="w-10 h-10 mb-3 opacity-30" />
      <p className="font-medium text-foreground">{title}</p>
      {description && <p className="text-sm mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
