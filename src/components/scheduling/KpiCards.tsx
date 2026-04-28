import type { KpiData } from '../../types/scheduling';

interface Props {
  kpi: KpiData;
  novosHoje?: number;
  proxAgenda?: string;
  tecnicosCampo?: number;
}

type Card = {
  label: string;
  value: number;
  dot: string;
  callout: React.ReactNode;
  critical?: boolean;
};

const buildCards = (p: Props): Card[] => [
  {
    label: 'AGUARDANDO AGENDAMENTO',
    value: p.kpi.agendamento,
    dot: 'bg-warning',
    callout: (
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {p.novosHoje !== undefined ? <>↑ <span className="text-foreground font-medium">{p.novosHoje}</span> hoje</> : 'aguardando'}
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-foreground bg-warning/15 px-1.5 py-0.5 rounded-full">
          <span className="w-1 h-1 rounded-full bg-warning" /> ação
        </span>
      </div>
    ),
  },
  {
    label: 'AGENDADOS',
    value: p.kpi.agendado,
    dot: 'bg-info',
    callout: (
      <span className="text-[11px] text-muted-foreground tabular-nums">
        {p.proxAgenda ? <>próx. <span className="text-foreground font-medium">{p.proxAgenda}</span></> : 'com data marcada'}
      </span>
    ),
  },
  {
    label: 'TEC-CAMPO',
    value: p.kpi.tecCampo,
    dot: 'bg-primary',
    callout: (
      <span className="text-[11px] text-muted-foreground tabular-nums">
        {p.tecnicosCampo !== undefined
          ? <><span className="text-foreground font-medium">{p.tecnicosCampo}</span> técnicos em campo</>
          : 'técnico em andamento'}
      </span>
    ),
  },
  {
    label: 'LOJAS CRÍTICAS',
    value: p.kpi.lojasMultiplas,
    dot: 'bg-critical',
    critical: true,
    callout: (
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-primary-foreground/65">2+ chamados · SLA</span>
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary-foreground bg-critical/35 px-1.5 py-0.5 rounded-full">
          <span className="w-1 h-1 rounded-full bg-critical" /> foco
        </span>
      </div>
    ),
  },
];

export function KpiCards(props: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {buildCards(props).map(c => {
        const isCritical = c.critical;
        return (
          <div
            key={c.label}
            className={`relative overflow-hidden rounded-[10px] border p-5 shadow-card ${
              isCritical
                ? 'border-[hsl(var(--ink-inverted))] bg-[hsl(var(--ink-inverted))]'
                : 'border-border/60 bg-card'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className={`t-eyebrow leading-tight ${isCritical ? 'text-primary-foreground/65' : 'text-muted-foreground'}`}>
                {c.label}
              </p>
              <span className={`status-dot ${c.dot}`} />
            </div>
            <div className="mt-4 flex flex-col gap-3">
              <p className={`text-[2.75rem] font-bold tabular-nums leading-[0.95] tracking-tight ${
                isCritical ? 'text-primary-foreground' : 'text-foreground'
              }`}>
                {c.value}
              </p>
              <div className={`pt-2 border-t ${isCritical ? 'border-white/10' : 'border-border/40'}`}>
                {c.callout}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
