import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex items-end justify-between pb-1">
      <div>
        <h2 className="text-lg font-bold tracking-wide uppercase">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {action && (
        <Button onClick={action.onClick} size="sm" className="gap-1.5 text-sm">
          <Plus className="h-3.5 w-3.5" />
          {action.label}
        </Button>
      )}
    </div>
  );
}
