import type { KpiData } from '../../types/scheduling';

interface Props {
  kpi: KpiData;
  /** chamados que entraram hoje (sub-fila) */
  novosHoje?: number;
  /** próximo agendamento marcado (formato "22/04 14h") */
  proxAgenda?: string;
  /** técnicos em campo agora */
  tecnicosCampo?: number;
}

type Card = {
  label: string;
  value: number;
  topBar: string;
  /** linha abaixo do número (callout específico) */
  callout?: React.ReactNode;
  critical?: boolean;
};

const buildCards = (p: Props): Card[] => [
  {
    label: 'AGUARDANDO AGENDAMENTO',
    value: p.kpi.agendamento,
    topBar: 'bg-amber-500',
    callout: (
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        {p.novosHoje !== undefined ? (
          <span className="tabular-nums">↑ {p.novosHoje} hoje</span>
        ) : <span>aguardando</span>}
        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> ação
        </span>
      </div>
    ),
  },
  {
    label: 'AGENDADOS',
    value: p.kpi.agendado,
    topBar: 'bg-blue-500',
    callout: (
      <span className="text-[10px] text-muted-foreground tabular-nums">
        {p.proxAgenda ? `próx. ${p.proxAgenda}` : 'com data marcada'}
      </span>
    ),
  },
  {
    label: 'TEC-CAMPO',
    value: p.kpi.tecCampo,
    topBar: 'bg-primary',
    callout: (
      <span className="text-[10px] text-muted-foreground tabular-nums">
        {p.tecnicosCampo !== undefined
          ? `${p.tecnicosCampo} técnicos em campo`
          : 'técnico em campo'}
      </span>
    ),
  },
  {
    label: 'LOJAS CRÍTICAS',
    value: p.kpi.lojasMultiplas,
    topBar: 'bg-rose-500',
    critical: true,
    callout: (
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-rose-200/80">2+ chamados · SLA</span>
        <span className="inline-flex items-center gap-1 text-rose-300 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> foco
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
            className={`relative overflow-hidden rounded-xl border ${
              isCritical
                ? 'border-rose-500/60 bg-zinc-900 text-zinc-50 dark:bg-zinc-950 dark:border-rose-500/40'
                : 'border-border/60 bg-card'
            } shadow-sm`}
          >
            <div className={`h-[3px] w-full ${c.topBar}`} />
            <div className="p-4 space-y-3">
              <p className={`text-[10px] font-semibold uppercase tracking-[0.1em] ${
                isCritical ? 'text-zinc-400' : 'text-muted-foreground'
              }`}>
                {c.label}
              </p>
              <p className={`text-5xl font-bold tabular-nums leading-none ${
                isCritical ? 'text-zinc-50' : 'text-foreground'
              }`}>
                {c.value}
              </p>
              <div className="pt-1 border-t border-border/40 dark:border-white/10">
                {c.callout}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
