import { useMemo } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { cn } from '../../lib/utils';
import type { LojaGroup } from '../../types/scheduling';

// ── Geographic cartogram grid (col = W→E, row = N→S) ─────────────────────────
const GRID = [
  { uf: 'RR', row: 0, col: 4 },
  { uf: 'AP', row: 0, col: 8 },

  { uf: 'AM', row: 1, col: 2 },
  { uf: 'PA', row: 1, col: 5 },
  { uf: 'MA', row: 1, col: 7 },
  { uf: 'CE', row: 1, col: 8 },
  { uf: 'RN', row: 1, col: 9 },

  { uf: 'AC', row: 2, col: 0 },
  { uf: 'RO', row: 2, col: 2 },
  { uf: 'TO', row: 2, col: 5 },
  { uf: 'PI', row: 2, col: 7 },
  { uf: 'PB', row: 2, col: 8 },
  { uf: 'PE', row: 2, col: 9 },

  { uf: 'MT', row: 3, col: 3 },
  { uf: 'BA', row: 3, col: 7 },
  { uf: 'AL', row: 3, col: 9 },
  { uf: 'SE', row: 3, col: 10 },

  { uf: 'MS', row: 4, col: 3 },
  { uf: 'GO', row: 4, col: 4 },
  { uf: 'MG', row: 4, col: 6 },
  { uf: 'ES', row: 4, col: 8 },

  { uf: 'DF', row: 5, col: 5 },
  { uf: 'SP', row: 5, col: 5 },   // SP shares col with DF (offset by row)
  { uf: 'RJ', row: 5, col: 7 },

  { uf: 'PR', row: 6, col: 5 },
  { uf: 'SC', row: 7, col: 5 },
  { uf: 'RS', row: 8, col: 4 },
] as const;

// Fix: SP and DF can't share the same cell — nudge SP east
const GRID_FIXED = GRID.map(g =>
  g.uf === 'SP' ? { ...g, col: 6 } : g,
);

// ── Color scale ───────────────────────────────────────────────────────────────
function cellColor(count: number, max: number, critical: number) {
  if (count === 0) return undefined; // use CSS class
  const ratio = count / max;
  if (critical > 0) {
    const alpha = 0.45 + ratio * 0.45;
    return `rgba(239,68,68,${alpha.toFixed(2)})`;
  }
  if (ratio >= 0.65) return 'rgba(245,158,11,0.88)';
  if (ratio >= 0.3)  return 'rgba(59,130,246,0.80)';
  return 'rgba(59,130,246,0.45)';
}

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
  groups: LojaGroup[];
  onUfClick?: (uf: string | null) => void;
  selectedUf?: string | null;
}

export function MapaAgendamento({ groups, onUfClick, selectedUf }: Props) {
  // Per-state aggregation
  const byUf = useMemo(() => {
    const m = new Map<string, { count: number; critical: number; lojas: string[] }>();
    for (const g of groups) {
      const uf = g.uf?.toUpperCase() ?? '';
      if (!uf) continue;
      const prev = m.get(uf) ?? { count: 0, critical: 0, lojas: [] };
      m.set(uf, {
        count: prev.count + g.qtd,
        critical: prev.critical + (g.isCritical ? 1 : 0),
        lojas: [...prev.lojas, g.loja],
      });
    }
    return m;
  }, [groups]);

  const maxCount    = useMemo(() => Math.max(...[...byUf.values()].map(v => v.count), 1), [byUf]);
  const totalIssues = useMemo(() => groups.reduce((s, g) => s + g.qtd, 0), [groups]);
  const criticalCount = useMemo(() => groups.filter(g => g.isCritical).length, [groups]);

  const CELL = 50;
  const GAP  = 5;
  const STEP = CELL + GAP;
  const MAX_COL = Math.max(...GRID_FIXED.map(g => g.col)) + 1;
  const MAX_ROW = Math.max(...GRID_FIXED.map(g => g.row)) + 1;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-4">

        {/* KPIs */}
        <div className="flex flex-wrap gap-3">
          <div className="rounded-lg border border-border bg-card px-4 py-2 flex flex-col">
            <span className="text-2xl font-bold text-primary">{totalIssues}</span>
            <span className="text-xs text-muted-foreground">Chamados abertos</span>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-2 flex flex-col">
            <span className="text-2xl font-bold">{byUf.size}</span>
            <span className="text-xs text-muted-foreground">Estados afetados</span>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-2 flex flex-col">
            <span className="text-2xl font-bold text-red-500">{criticalCount}</span>
            <span className="text-xs text-muted-foreground">Lojas críticas</span>
          </div>
          {selectedUf && (
            <button
              onClick={() => onUfClick?.(null)}
              className="ml-auto self-center text-xs text-primary underline underline-offset-2"
            >
              Limpar filtro ({selectedUf})
            </button>
          )}
        </div>

        {/* Cartogram */}
        <div className="rounded-xl border border-border bg-card p-6 overflow-x-auto">
          <div
            className="relative mx-auto"
            style={{ width: MAX_COL * STEP - GAP, height: MAX_ROW * STEP - GAP }}
          >
            {GRID_FIXED.map(({ uf, row, col }) => {
              const data   = byUf.get(uf);
              const count  = data?.count   ?? 0;
              const crit   = data?.critical ?? 0;
              const color  = cellColor(count, maxCount, crit);
              const active = count > 0;
              const sel    = selectedUf === uf;

              return (
                <Tooltip key={uf}>
                  <TooltipTrigger asChild>
                    <button
                      disabled={!active}
                      onClick={() => active && onUfClick?.(sel ? null : uf)}
                      style={{
                        position: 'absolute',
                        left: col * STEP,
                        top:  row * STEP,
                        width:  CELL,
                        height: CELL,
                        backgroundColor: color,
                        boxShadow: sel
                          ? '0 0 0 2px hsl(var(--primary)), 0 0 12px hsl(var(--primary)/0.4)'
                          : crit > 0 && active
                          ? '0 0 10px rgba(239,68,68,0.45)'
                          : undefined,
                      }}
                      className={cn(
                        'rounded-lg flex flex-col items-center justify-center transition-all duration-150 select-none',
                        active
                          ? 'cursor-pointer hover:scale-110 hover:z-10'
                          : 'bg-secondary/40 opacity-35 cursor-default',
                      )}
                    >
                      <span className={cn(
                        'text-[11px] font-bold leading-none',
                        active ? 'text-white' : 'text-muted-foreground',
                      )}>
                        {uf}
                      </span>
                      {active && (
                        <span className="text-[10px] text-white/75 font-mono tabular-nums mt-0.5">
                          {count}
                        </span>
                      )}
                    </button>
                  </TooltipTrigger>

                  {active && (
                    <TooltipContent side="top" className="max-w-[200px]">
                      <p className="font-semibold">{uf}</p>
                      <p className="text-xs text-muted-foreground">
                        {count} chamado{count !== 1 ? 's' : ''}
                        {crit > 0 ? ` · 🚨 ${crit} crítica${crit !== 1 ? 's' : ''}` : ''}
                      </p>
                      {data && data.lojas.length > 0 && (
                        <p className="text-[11px] text-muted-foreground mt-1 truncate">
                          {data.lojas.slice(0, 3).join(', ')}
                          {data.lojas.length > 3 ? ` +${data.lojas.length - 3}` : ''}
                        </p>
                      )}
                    </TooltipContent>
                  )}
                </Tooltip>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground px-1">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-blue-500/45 border border-blue-500/30 inline-block" />
            Poucos chamados
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-blue-500/80 inline-block" />
            Moderado
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-500/88 inline-block" />
            Alto volume
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-red-500/80 inline-block" />
            Crítico
          </span>
          <span className="ml-auto text-[11px]">Clique num estado para filtrar · Hover para detalhes</span>
        </div>

        {/* State ranking */}
        {byUf.size > 0 && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-2 bg-muted/50 border-b border-border">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Ranking por estado
              </p>
            </div>
            <div className="divide-y divide-border max-h-52 overflow-auto">
              {[...byUf.entries()]
                .sort(([, a], [, b]) => b.count - a.count)
                .map(([uf, data]) => {
                  const ratio = data.count / maxCount;
                  const barColor = data.critical > 0
                    ? '#ef4444'
                    : ratio >= 0.65
                    ? '#f59e0b'
                    : '#3b82f6';
                  return (
                    <button
                      key={uf}
                      onClick={() => onUfClick?.(selectedUf === uf ? null : uf)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/60 transition-colors text-left',
                        selectedUf === uf && 'bg-primary/5',
                      )}
                    >
                      <span className="font-mono font-bold w-8 text-primary shrink-0">{uf}</span>
                      <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${ratio * 100}%`, backgroundColor: barColor }}
                        />
                      </div>
                      {data.critical > 0 && (
                        <span className="text-[10px] font-semibold text-red-500 shrink-0">
                          🚨 {data.critical}
                        </span>
                      )}
                      <span
                        className="shrink-0 font-bold tabular-nums"
                        style={{ color: barColor }}
                      >
                        {data.count}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        )}

      </div>
    </TooltipProvider>
  );
}
