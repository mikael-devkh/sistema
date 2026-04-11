import { Clock, CalendarCheck, Wrench, AlertTriangle } from 'lucide-react';
import type { KpiData } from '../../types/scheduling';

interface Props { kpi: KpiData }

const cards = (kpi: KpiData) => [
  {
    label: 'AGENDAMENTO',
    sublabel: 'Aguardando agendamento',
    value: kpi.agendamento,
    icon: Clock,
    gradient: 'from-amber-500/20 to-amber-600/5',
    border: 'border-amber-500/40',
    iconColor: 'text-amber-400',
    valueColor: 'text-amber-300',
    glow: 'shadow-amber-500/10',
  },
  {
    label: 'Agendados',
    sublabel: 'Com data marcada',
    value: kpi.agendado,
    icon: CalendarCheck,
    gradient: 'from-blue-500/20 to-blue-600/5',
    border: 'border-blue-500/40',
    iconColor: 'text-blue-400',
    valueColor: 'text-blue-300',
    glow: 'shadow-blue-500/10',
  },
  {
    label: 'TEC-CAMPO',
    sublabel: 'Técnico em andamento',
    value: kpi.tecCampo,
    icon: Wrench,
    gradient: 'from-primary/20 to-primary/5',
    border: 'border-primary/40',
    iconColor: 'text-primary',
    valueColor: 'text-primary',
    glow: 'shadow-primary/10',
  },
  {
    label: 'Lojas c/ 2+ chamados',
    sublabel: 'Atenção redobrada',
    value: kpi.lojasMultiplas,
    icon: AlertTriangle,
    gradient: 'from-rose-500/20 to-rose-600/5',
    border: 'border-rose-500/40',
    iconColor: 'text-rose-400',
    valueColor: 'text-rose-300',
    glow: 'shadow-rose-500/10',
  },
];

export function KpiCards({ kpi }: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards(kpi).map(c => {
        const Icon = c.icon;
        return (
          <div
            key={c.label}
            className={`relative overflow-hidden rounded-xl border ${c.border} bg-gradient-to-br ${c.gradient} p-4 shadow-lg ${c.glow}`}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{c.label}</p>
                <p className={`text-4xl font-bold tabular-nums ${c.valueColor}`}>{c.value}</p>
                <p className="text-[11px] text-muted-foreground">{c.sublabel}</p>
              </div>
              <div className={`rounded-lg bg-card/60 p-2 ${c.iconColor}`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
