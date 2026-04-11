import { Card, CardContent } from '../ui/card';
import type { KpiData } from '../../types/scheduling';

interface Props { kpi: KpiData }

export function KpiCards({ kpi }: Props) {
  const cards = [
    { label: 'AGENDAMENTO', value: kpi.agendamento, icon: '⏳', color: 'border-yellow-500' },
    { label: 'Agendado',     value: kpi.agendado,    icon: '📋', color: 'border-blue-500'   },
    { label: 'TEC-CAMPO',    value: kpi.tecCampo,    icon: '🧰', color: 'border-green-500'  },
    { label: 'Lojas com 2+', value: kpi.lojasMultiplas, icon: '🏷️', color: 'border-red-400' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {cards.map(c => (
        <Card key={c.label} className={`border-l-4 ${c.color}`}>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground font-medium mb-1">{c.icon} {c.label}</div>
            <div className="text-3xl font-bold">{c.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
