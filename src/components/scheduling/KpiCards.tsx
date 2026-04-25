import type { KpiData } from '../../types/scheduling';

interface Props { kpi: KpiData }

type Card = {
  label: string;
  sublabel: string;
  value: number;
  /** cor da barra superior (HSL string ou tailwind bg) */
  topBar: string;
  /** se true, inverte: fundo escuro, número claro */
  critical?: boolean;
};

const buildCards = (kpi: KpiData): Card[] => [
  {
    label: 'AGUARDANDO AGENDAMENTO',
    sublabel: 'aguardando ação',
    value: kpi.agendamento,
    topBar: 'bg-amber-500',
  },
  {
    label: 'AGENDADOS',
    sublabel: 'com data marcada',
    value: kpi.agendado,
    topBar: 'bg-blue-500',
  },
  {
    label: 'TEC-CAMPO',
    sublabel: 'técnico em campo',
    value: kpi.tecCampo,
    topBar: 'bg-primary',
  },
  {
    label: 'LOJAS CRÍTICAS',
    sublabel: '2+ chamados · SLA',
    value: kpi.lojasMultiplas,
    topBar: 'bg-rose-500',
    critical: true,
  },
];

export function KpiCards({ kpi }: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {buildCards(kpi).map(c => {
        const isCritical = c.critical;
        return (
          <div
            key={c.label}
            className={`relative overflow-hidden rounded-xl border ${
              isCritical
                ? 'border-rose-500/60 bg-foreground text-background dark:bg-zinc-950 dark:border-rose-500/50'
                : 'border-border/60 bg-card'
            } shadow-sm`}
          >
            {/* Top bar de 3px na cor do estado */}
            <div className={`h-[3px] w-full ${c.topBar}`} />
            <div className="p-4 space-y-2">
              <p className={`text-[10px] font-semibold uppercase tracking-[0.08em] ${
                isCritical ? 'text-rose-300' : 'text-muted-foreground'
              }`}>
                {c.label}
              </p>
              <p className={`text-4xl font-bold tabular-nums leading-none ${
                isCritical ? 'text-background dark:text-rose-50' : 'text-foreground'
              }`}>
                {c.value}
              </p>
              <p className={`text-[11px] ${
                isCritical ? 'text-rose-200/80' : 'text-muted-foreground'
              }`}>
                {c.sublabel}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
