import { useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { GripVertical, X } from 'lucide-react';

interface Widget {
  id: string;
  title: string;
  component: React.ComponentType;
  defaultPosition: { x: number; y: number };
  size: { w: number; h: number };
}

export function DashboardWidget({ widget, onRemove }: { widget: Widget; onRemove: (id: string) => void }) {
  const [isDragging, setIsDragging] = useState(false);

  return (
    <Card className="relative p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 cursor-move">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold">{widget.title}</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemove(widget.id)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <widget.component />
    </Card>
  );
}
