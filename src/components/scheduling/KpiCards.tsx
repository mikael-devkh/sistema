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
  topBar: string;
  callout: React.ReactNode;
  critical?: boolean;
};

const buildCards = (p: Props): Card[] => [
  {
    label: 'AGUARDANDO AGENDAMENTO',
    value: p.kpi.agendamento,
    topBar: 'bg-amber-500',
    callout: (
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {p.novosHoje !== undefined ? <>↑ <span className="text-foreground font-medium">{p.novosHoje}</span> hoje</> : 'aguardando'}
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-300 bg-amber-500/15 px-1.5 py-0.5 rounded-full">
          <span className="w-1 h-1 rounded-full bg-amber-500" /> ação
        </span>
      </div>
    ),
  },
  {
    label: 'AGENDADOS',
    value: p.kpi.agendado,
    topBar: 'bg-blue-500',
    callout: (
      <span className="text-[11px] text-muted-foreground tabular-nums">
        {p.proxAgenda ? <>próx. <span className="text-foreground font-medium">{p.proxAgenda}</span></> : 'com data marcada'}
      </span>
    ),
  },
  {
    label: 'TEC-CAMPO',
    value: p.kpi.tecCampo,
    topBar: 'bg-primary',
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
    topBar: 'bg-rose-500',
    critical: true,
    callout: (
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-rose-200/70">2+ chamados · SLA</span>
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-rose-200 bg-rose-500/25 px-1.5 py-0.5 rounded-full">
          <span className="w-1 h-1 rounded-full bg-rose-400" /> foco
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
                ? 'border-rose-500/40 bg-zinc-900 dark:bg-zinc-950'
                : 'border-border/60 bg-card'
            }`}
          >
            <div className={`h-[3px] w-full ${c.topBar}`} />
            <div className="px-4 pt-3 pb-3 flex flex-col gap-2.5">
              <p className={`text-[10px] font-semibold uppercase tracking-[0.12em] leading-tight ${
                isCritical ? 'text-zinc-400' : 'text-muted-foreground'
              }`}>
                {c.label}
              </p>
              <p className={`text-[2.75rem] font-bold tabular-nums leading-[0.95] tracking-tight ${
                isCritical ? 'text-zinc-50' : 'text-foreground'
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
