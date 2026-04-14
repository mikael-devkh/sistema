import { useState, useMemo, lazy, Suspense, startTransition } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import {
  RefreshCw, Zap, MapPin, Hash,
  Clock, CalendarCheck, Wrench, AlertTriangle,
  ChevronDown, ChevronRight, Monitor, WifiOff,
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';

import { useAgendamentoData, useRouteGroups } from '../hooks/use-agendamento';
import { KpiCards } from '../components/scheduling/KpiCards';
const TrendChart = lazy(() =>
  import('../components/scheduling/TrendChart').then(m => ({ default: m.TrendChart }))
);
import { StoreHighlights } from '../components/scheduling/StoreHighlights';
import { LojaExpander } from '../components/scheduling/LojaExpander';
import { TransitionPanel } from '../components/scheduling/TransitionPanel';
import { ReqTracker } from '../components/scheduling/ReqTracker';
import { GerenteTab } from '../components/scheduling/GerenteTab';
import { PlanilhaInterna } from '../components/scheduling/PlanilhaInterna';

import type { LojaGroup, SchedulingIssue } from '../types/scheduling';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

// ─── Terminal detection ────────────────────────────────────────────────────────

function isTerminalIssue(issue: SchedulingIssue): boolean {
  return (
    issue.problema.includes('Projeto Terminal de Consulta') ||
    issue.ativo === '--'
  );
}

/**
 * Splits a LojaGroup[] into normal vs terminal sub-groups.
 * A loja with both types appears in both lists (with filtered issues).
 */
function splitByTerminal(groups: LojaGroup[]): { normal: LojaGroup[]; terminal: LojaGroup[] } {
  const normal: LojaGroup[] = [];
  const terminal: LojaGroup[] = [];
  for (const g of groups) {
    const n = g.issues.filter(i => !isTerminalIssue(i));
    const t = g.issues.filter(i => isTerminalIssue(i));
    if (n.length) normal.push({ ...g, issues: n, qtd: n.length });
    if (t.length) terminal.push({ ...g, issues: t, qtd: t.length });
  }
  return { normal, terminal };
}

function SectionDivider({ label, count, terminal = false }: { label: string; count: number; terminal?: boolean }) {
  return (
    <div className="flex items-center gap-2 py-1">
      {terminal
        ? <Monitor className="w-3.5 h-3.5 text-violet-400 shrink-0" />
        : <Hash className="w-3.5 h-3.5 text-primary shrink-0" />}
      <span className={`text-xs font-semibold uppercase tracking-wider ${terminal ? 'text-violet-400' : 'text-primary'}`}>
        {label}
      </span>
      <Badge
        variant="secondary"
        className={`text-[10px] tabular-nums ${terminal ? 'bg-violet-500/15 text-violet-300 border-violet-500/30' : ''}`}
      >
        {count}
      </Badge>
      <div className={`flex-1 h-px ${terminal ? 'bg-violet-500/20' : 'bg-primary/20'}`} />
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-primary/10 to-card p-6">
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-40 mb-6" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </div>
      {/* Tabs skeleton */}
      <Skeleton className="h-10 w-full rounded-lg" />
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
      </div>
    </div>
  );
}

// ─── Filter mode type ─────────────────────────────────────────────────────────

type FilterMode = 'both' | 'normal' | 'terminal';

// ─── Shared render helpers ────────────────────────────────────────────────────

/** Badge shown on a normal group when the same loja also has terminal issues */
function TerminalAlertBadge() {
  return (
    <Badge className="text-[10px] bg-violet-500/15 text-violet-300 border border-violet-500/30 gap-1 shrink-0">
      <Monitor className="w-3 h-3" /> Terminal nesta loja
    </Badge>
  );
}

function renderSections(
  normal: LojaGroup[],
  terminal: LojaGroup[],
  filterMode: FilterMode,
  renderGroup: (g: LojaGroup, isTerminal: boolean) => React.ReactNode,
  emptyIcon: React.ReactNode,
  emptyText: string,
) {
  const showNormal = filterMode !== 'terminal';
  const showTerminal = filterMode !== 'normal';
  const visibleNormal = showNormal ? normal : [];
  const visibleTerminal = showTerminal ? terminal : [];

  if (visibleNormal.length === 0 && visibleTerminal.length === 0) {
    return <EmptyState icon={emptyIcon} text={emptyText} />;
  }

  return (
    <>
      {visibleNormal.length > 0 && (
        <div className="space-y-2">
          {filterMode === 'both' && (
            <SectionDivider label="Manutenção Regular" count={visibleNormal.reduce((s, g) => s + g.qtd, 0)} />
          )}
          {visibleNormal.map(g => renderGroup(g, false))}
        </div>
      )}
      {visibleTerminal.length > 0 && (
        <div className="space-y-2">
          {filterMode === 'both' && (
            <SectionDivider label="Projeto Terminal" count={visibleTerminal.reduce((s, g) => s + g.qtd, 0)} terminal />
          )}
          {visibleTerminal.map(g => renderGroup(g, true))}
        </div>
      )}
    </>
  );
}

// ─── Pending tab ──────────────────────────────────────────────────────────────

function PendentesTab({
  groups,
  agendadoLojas,
  tecCampoLojas,
  onTransition,
  onScheduled,
  filterMode,
  terminalLojas,
  ufFilter,
}: {
  groups: LojaGroup[];
  agendadoLojas: Set<string>;
  tecCampoLojas: Set<string>;
  onTransition: (loja: string) => void;
  onScheduled: () => void;
  filterMode: FilterMode;
  terminalLojas: Set<string>;
  ufFilter: string;
}) {
  const [filter, setFilter] = useState('');
  const byUf = ufFilter ? groups.filter(g => g.uf === ufFilter) : groups;
  const filtered = filter
    ? byUf.filter(g =>
        g.loja.toLowerCase().includes(filter.toLowerCase()) ||
        g.cidade.toLowerCase().includes(filter.toLowerCase()),
      )
    : byUf;

  const { normal, terminal } = splitByTerminal(filtered);

  const renderGroup = (g: LojaGroup, isTerminal: boolean) => {
    const outras: string[] = [];
    if (agendadoLojas.has(g.loja)) outras.push('Agendado');
    if (tecCampoLojas.has(g.loja)) outras.push('TEC-CAMPO');
    const warning = outras.length
      ? `Esta loja já possui chamado(s) na fila ${outras.join(' e ')}. Verifique se há técnico designado.`
      : undefined;
    const hasTerminal = !isTerminal && terminalLojas.has(g.loja);
    return (
      <LojaExpander
        key={`${g.loja}-${g.issues[0]?.key}`}
        group={g}
        showForm
        warningText={warning}
        onScheduled={onScheduled}
        extra={
          <>
            {hasTerminal && <TerminalAlertBadge />}
            <button
              className="text-[10px] px-2 py-0.5 rounded-md bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 transition-colors font-medium shrink-0"
              onClick={e => { e.stopPropagation(); onTransition(g.loja); }}
            >
              Transição em massa
            </button>
          </>
        }
      />
    );
  };

  return (
    <div className="space-y-3">
      <Input
        placeholder="Filtrar por loja ou cidade…"
        value={filter}
        onChange={e => setFilter(e.target.value)}
        className="max-w-sm"
      />
      {filtered.length === 0 && filter
        ? <EmptyState icon={<Clock className="w-8 h-8 text-muted-foreground" />} text="Nenhuma loja encontrada." />
        : renderSections(normal, terminal, filterMode, renderGroup,
            <Clock className="w-8 h-8 text-muted-foreground" />, 'Nenhum chamado em AGENDAMENTO.')
      }
    </div>
  );
}

// ─── Agendados tab ────────────────────────────────────────────────────────────

function AgendadosTab({
  agendados,
  filterMode,
  terminalLojas,
  ufFilter,
}: {
  agendados: Map<string, LojaGroup[]>;
  filterMode: FilterMode;
  terminalLojas: Set<string>;
  ufFilter: string;
}) {
  const [filter, setFilter] = useState('');
  const entries = [...agendados.entries()].sort(([a], [b]) => a.localeCompare(b));

  const filterFn = (g: LojaGroup) => {
    if (ufFilter && g.uf !== ufFilter) return false;
    if (!filter) return true;
    const q = filter.toLowerCase();
    return g.loja.toLowerCase().includes(q) || g.cidade.toLowerCase().includes(q);
  };

  if (entries.length === 0) {
    return <EmptyState icon={<CalendarCheck className="w-8 h-8 text-muted-foreground" />} text="Nenhum chamado Agendado." />;
  }

  return (
    <div className="space-y-5">
      <Input
        placeholder="Filtrar por loja ou cidade…"
        value={filter}
        onChange={e => setFilter(e.target.value)}
        className="max-w-sm"
      />

      {entries.map(([date, lojas]) => {
        const filtered = lojas.filter(filterFn);
        if (!filtered.length) return null;
        const { normal, terminal } = splitByTerminal(filtered);

        const showNormal = filterMode !== 'terminal' ? normal : [];
        const showTerminal = filterMode !== 'normal' ? terminal : [];
        const total = [...showNormal, ...showTerminal].reduce((s, g) => s + g.qtd, 0);
        if (total === 0) return null;

        const renderGroup = (g: LojaGroup, isTerminal: boolean) => {
          const pdvAtivos = g.issues.map(i => `${i.pdv}||${i.ativo}`);
          const dupes = pdvAtivos.filter((v, i, a) => a.indexOf(v) !== i);
          const dupKeys = g.issues
            .filter(i => dupes.includes(`${i.pdv}||${i.ativo}`))
            .map(i => i.key);
          const hasTerminal = !isTerminal && terminalLojas.has(g.loja);
          const extra = (
            <>
              {hasTerminal && <TerminalAlertBadge />}
              {dupKeys.length > 0 && (
                <Badge className="text-[10px] bg-orange-500/15 text-orange-400 border border-orange-500/30">
                  Dup: {dupKeys.join(', ')}
                </Badge>
              )}
            </>
          );
          return <LojaExpander key={`${date}-${g.loja}-${g.issues[0]?.key}`} group={g} extra={extra} />;
        };

        return (
          <div key={date}>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px flex-1 bg-border/50" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">
                {date} · {total} chamado(s)
              </span>
              <div className="h-px flex-1 bg-border/50" />
            </div>
            <div className="space-y-4">
              {showNormal.length > 0 && (
                <div className="space-y-2">
                  {filterMode === 'both' && <SectionDivider label="Manutenção Regular" count={showNormal.reduce((s, g) => s + g.qtd, 0)} />}
                  {showNormal.map(g => renderGroup(g, false))}
                </div>
              )}
              {showTerminal.length > 0 && (
                <div className="space-y-2">
                  {filterMode === 'both' && <SectionDivider label="Projeto Terminal" count={showTerminal.reduce((s, g) => s + g.qtd, 0)} terminal />}
                  {showTerminal.map(g => renderGroup(g, true))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── TEC-CAMPO tab ────────────────────────────────────────────────────────────

function TecCampoTab({
  groups,
  filterMode,
  terminalLojas,
  ufFilter,
}: {
  groups: LojaGroup[];
  filterMode: FilterMode;
  terminalLojas: Set<string>;
  ufFilter: string;
}) {
  const [filter, setFilter] = useState('');
  const byUf = ufFilter ? groups.filter(g => g.uf === ufFilter) : groups;
  const filtered = filter
    ? byUf.filter(g =>
        g.loja.toLowerCase().includes(filter.toLowerCase()) ||
        g.cidade.toLowerCase().includes(filter.toLowerCase()),
      )
    : byUf;

  const { normal, terminal } = splitByTerminal(filtered);

  const renderGroup = (g: LojaGroup, isTerminal: boolean) => {
    const hasTerminal = !isTerminal && terminalLojas.has(g.loja);
    return (
      <LojaExpander
        key={`${g.loja}-${g.issues[0]?.key}`}
        group={g}
        extra={hasTerminal ? <TerminalAlertBadge /> : undefined}
      />
    );
  };

  return (
    <div className="space-y-3">
      <Input
        placeholder="Filtrar por loja ou cidade…"
        value={filter}
        onChange={e => setFilter(e.target.value)}
        className="max-w-sm"
      />
      {filtered.length === 0 && filter
        ? <EmptyState icon={<Wrench className="w-8 h-8 text-muted-foreground" />} text="Nenhuma loja encontrada." />
        : renderSections(normal, terminal, filterMode, renderGroup,
            <Wrench className="w-8 h-8 text-muted-foreground" />, 'Nenhum chamado em TEC-CAMPO.')
      }
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
      {icon}
      <p className="text-sm">{text}</p>
    </div>
  );
}

// ─── Route Optimization ───────────────────────────────────────────────────────

function RouteOptimization({ allLojaGroups }: { allLojaGroups: LojaGroup[] }) {
  const routes = useRouteGroups(allLojaGroups);
  if (!routes.length) {
    return (
      <p className="text-xs text-muted-foreground text-center py-4">
        Nenhuma loja muito próxima identificada no momento.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {routes.map(r => (
        <div
          key={r.cepPrefix}
          className="flex items-start gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs"
        >
          <MapPin className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <span className="text-foreground/80">
            <span className="font-semibold text-blue-300">{r.cidade} (CEP {r.cepPrefix}-xxx):</span>{' '}
            As lojas <span className="font-semibold">{r.lojas.join(', ')}</span> estão na mesma zona. Considere enviar o mesmo técnico!
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Top 5 cards ──────────────────────────────────────────────────────────────

function Top5Lojas({ top5 }: { top5: LojaGroup[] }) {
  if (!top5.length) {
    return <p className="text-sm text-muted-foreground text-center py-4">Sem dados para o ranking.</p>;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {top5.map((g, idx) => (
        <div
          key={g.loja}
          className={`relative rounded-xl border p-3 space-y-2 ${
            g.isCritical
              ? 'border-rose-500/40 bg-rose-500/5'
              : 'border-border/50 bg-card'
          }`}
        >
          <div className="flex items-start justify-between">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${g.isCritical ? 'text-rose-400' : 'text-muted-foreground'}`}>
              #{idx + 1}
            </span>
            {g.isCritical && <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />}
          </div>
          <div>
            <p className="text-xs font-semibold truncate leading-tight">{g.loja}</p>
            <p className="text-[10px] text-muted-foreground">{g.cidade}{g.uf ? ` – ${g.uf}` : ''}</p>
          </div>
          <p className={`text-3xl font-bold tabular-nums ${g.isCritical ? 'text-rose-300' : 'text-foreground'}`}>
            {g.qtd}
          </p>
          {g.lastUpdated && (
            <p className="text-[10px] text-muted-foreground">
              {format(g.lastUpdated, 'dd/MM HH:mm')}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Chamados tab wrapper ─────────────────────────────────────────────────────

const FILTER_OPTIONS: { mode: FilterMode; label: string; icon: React.ReactNode }[] = [
  { mode: 'both',     label: 'Todos',      icon: <Hash className="w-3.5 h-3.5" /> },
  { mode: 'normal',   label: 'Manutenção', icon: <Wrench className="w-3.5 h-3.5" /> },
  { mode: 'terminal', label: 'Terminal',   icon: <Monitor className="w-3.5 h-3.5" /> },
];

function ChamadosTab({
  kpi,
  pendentes,
  agendados,
  tecCampo,
  allLojaGroups,
  agendadoLojas,
  tecCampoLojas,
  onTransition,
  onScheduled,
}: {
  kpi: { agendamento: number; agendado: number; tecCampo: number };
  pendentes: LojaGroup[];
  agendados: Map<string, LojaGroup[]>;
  tecCampo: LojaGroup[];
  allLojaGroups: LojaGroup[];
  agendadoLojas: Set<string>;
  tecCampoLojas: Set<string>;
  onTransition: (loja: string) => void;
  onScheduled: () => void;
}) {
  const [highlightsOpen, setHighlightsOpen] = useState(false);
  const [subTab, setSubTab] = useState('pendentes');
  const [filterMode, setFilterMode] = useState<FilterMode>('both');
  const [ufFilter, setUfFilter] = useState('');

  const allUfs = useMemo(() => {
    const ufs = new Set<string>();
    for (const g of [...pendentes, ...tecCampo, ...[...agendados.values()].flat()])
      if (g.uf) ufs.add(g.uf);
    return [...ufs].sort();
  }, [pendentes, tecCampo, agendados]);

  // Lojas with at least one terminal issue (across ALL statuses) — for cross-reference badge
  const terminalLojas = useMemo(() => {
    const s = new Set<string>();
    for (const g of allLojaGroups) {
      if (g.issues.some(isTerminalIssue)) s.add(g.loja);
    }
    return s;
  }, [allLojaGroups]);

  // Badge counts filtered by current mode
  const filteredCounts = useMemo(() => {
    const pred: (i: SchedulingIssue) => boolean =
      filterMode === 'terminal' ? isTerminalIssue
      : filterMode === 'normal'  ? i => !isTerminalIssue(i)
      : () => true;
    const countGroups = (groups: LojaGroup[]) =>
      groups.reduce((s, g) => s + g.issues.filter(pred).length, 0);
    return {
      pendentes: countGroups(pendentes),
      agendados: countGroups([...agendados.values()].flat()),
      tecCampo:  countGroups(tecCampo),
    };
  }, [filterMode, pendentes, agendados, tecCampo]);

  return (
    <div className="space-y-4">
      {/* ── Filter control ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-secondary/50 border border-border/50 rounded-lg">
          {FILTER_OPTIONS.map(({ mode, label, icon }) => (
            <button
              key={mode}
              onClick={() => setFilterMode(mode)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                filterMode === mode
                  ? mode === 'terminal'
                    ? 'bg-violet-500/20 text-violet-300 shadow-sm border border-violet-500/30'
                    : 'bg-card text-foreground shadow-sm border border-border/50'
                  : 'text-muted-foreground hover:text-foreground hover:bg-card/50',
              )}
            >
              {icon}{label}
            </button>
          ))}
        </div>

        {/* Store highlights collapsible trigger */}
        <button
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-secondary/50 hover:bg-secondary border border-border/50 rounded-lg transition-colors"
          onClick={() => setHighlightsOpen(o => !o)}
        >
          <Hash className="w-3.5 h-3.5 text-primary" />
          Lojas com N+ chamados
          {highlightsOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      </div>

      <Collapsible open={highlightsOpen} onOpenChange={setHighlightsOpen}>
        <CollapsibleContent>
          <div className="border border-border/50 rounded-lg p-4 bg-card">
            <StoreHighlights lojaGroups={allLojaGroups} />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* ── UF filter ───────────────────────────────────────────────────────── */}
      {allUfs.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground font-medium mr-1">Estado:</span>
          <button
            onClick={() => setUfFilter('')}
            className={cn(
              'px-2.5 py-1 rounded-md text-xs font-medium transition-all border',
              ufFilter === ''
                ? 'bg-primary/15 text-primary border-primary/30'
                : 'text-muted-foreground border-transparent hover:border-border/50 hover:text-foreground',
            )}
          >
            Todos
          </button>
          {allUfs.map(uf => (
            <button
              key={uf}
              onClick={() => setUfFilter(uf === ufFilter ? '' : uf)}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium transition-all border',
                ufFilter === uf
                  ? 'bg-primary/15 text-primary border-primary/30'
                  : 'text-muted-foreground border-transparent hover:border-border/50 hover:text-foreground',
              )}
            >
              {uf}
            </button>
          ))}
        </div>
      )}

      {/* Sub-tabs */}
      <Tabs value={subTab} onValueChange={v => startTransition(() => setSubTab(v))}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="pendentes" className="gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Pendentes
            <Badge variant="secondary" className="text-[10px] tabular-nums">{filteredCounts.pendentes}</Badge>
          </TabsTrigger>
          <TabsTrigger value="agendados" className="gap-1.5">
            <CalendarCheck className="w-3.5 h-3.5" />
            Agendados
            <Badge variant="secondary" className="text-[10px] tabular-nums">{filteredCounts.agendados}</Badge>
          </TabsTrigger>
          <TabsTrigger value="tec-campo" className="gap-1.5">
            <Wrench className="w-3.5 h-3.5" />
            TEC-CAMPO
            <Badge variant="secondary" className="text-[10px] tabular-nums">{filteredCounts.tecCampo}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pendentes" className="mt-4">
          <PendentesTab
            groups={pendentes}
            agendadoLojas={agendadoLojas}
            tecCampoLojas={tecCampoLojas}
            onTransition={onTransition}
            onScheduled={onScheduled}
            filterMode={filterMode}
            terminalLojas={terminalLojas}
            ufFilter={ufFilter}
          />
        </TabsContent>

        <TabsContent value="agendados" className="mt-4">
          <AgendadosTab agendados={agendados} filterMode={filterMode} terminalLojas={terminalLojas} ufFilter={ufFilter} />
        </TabsContent>

        <TabsContent value="tec-campo" className="mt-4">
          <TecCampoTab groups={tecCampo} filterMode={filterMode} terminalLojas={terminalLojas} ufFilter={ufFilter} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AgendamentoPage() {
  const { data, isLoading, isError, error, refresh, isFromCache, cacheAgeMinutes } = useAgendamentoData();
  const [transitionLoja, setTransitionLoja] = useState<string | null>(null);
  const [transitionOpen, setTransitionOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('chamados');

  const openTransition = (loja: string) => {
    setTransitionLoja(loja);
    setTransitionOpen(true);
  };

  if (isLoading) return <PageSkeleton />;

  if (isError) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold">Erro ao carregar dados do Jira</h2>
          <p className="text-sm text-muted-foreground">{(error as Error)?.message}</p>
          <Button onClick={refresh} className="gap-2">
            <RefreshCw className="w-4 h-4" /> Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { pendentes, agendados, tecCampo, kpi, top5, trendPoints, allIssues, allLojaGroups } = data;
  const agendadoLojas = new Set([...agendados.values()].flatMap(gs => gs.map(g => g.loja)));
  const tecCampoLojas = new Set(tecCampo.map(g => g.loja));
  const totalAtivos = kpi.agendamento + kpi.agendado + kpi.tecCampo;

  return (
    <div className="space-y-5 pb-10 animate-page-in">

      {/* ── Banner offline / cache ── */}
      {isFromCache && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>
            Sem conexão com o Jira — exibindo dados salvos{' '}
            <strong>
              {cacheAgeMinutes === 0
                ? 'agora há pouco'
                : `há ${cacheAgeMinutes} minuto${cacheAgeMinutes !== 1 ? 's' : ''}`}
            </strong>.{' '}
          </span>
          <button
            onClick={refresh}
            className="ml-auto shrink-0 flex items-center gap-1 font-medium underline underline-offset-2 hover:no-underline"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Tentar novamente
          </button>
        </div>
      )}

      {/* ── Hero header ── */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-6 shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Painel de Agendamentos</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Field Service · Jira FSA ·{' '}
              <span className="text-primary font-medium">{totalAtivos} chamados ativos</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={refresh} className="gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> Atualizar
            </Button>
            <Button size="sm" onClick={() => openTransition('')} className="gap-1.5">
              <Zap className="w-3.5 h-3.5" /> Transição em massa
            </Button>
          </div>
        </div>

        <KpiCards kpi={kpi} />
      </div>

      {/* ── Main tabs ── */}
      <Tabs
        value={activeTab}
        onValueChange={v => startTransition(() => setActiveTab(v))}
      >
        <TabsList className="flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="chamados" className="gap-1.5">
            <CalendarCheck className="w-3.5 h-3.5" />
            Chamados
            <Badge variant="secondary" className="text-[10px] tabular-nums ml-0.5">{totalAtivos}</Badge>
          </TabsTrigger>
          <TabsTrigger value="overview" className="gap-1.5">
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="reqs" className="gap-1.5">
            Rastreador REQs
          </TabsTrigger>
          <TabsTrigger value="gerente" className="gap-1.5">
            Gerente
          </TabsTrigger>
          <TabsTrigger value="planilha" className="gap-1.5">
            Planilha
          </TabsTrigger>
        </TabsList>

        {/* ── Chamados (default) ── */}
        <TabsContent value="chamados" className="mt-4">
          <ChamadosTab
            kpi={kpi}
            pendentes={pendentes}
            agendados={agendados}
            tecCampo={tecCampo}
            allLojaGroups={allLojaGroups}
            agendadoLojas={agendadoLojas}
            tecCampoLojas={tecCampoLojas}
            onTransition={openTransition}
            onScheduled={refresh}
          />
        </TabsContent>

        {/* ── Visão Geral ── */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Top 5 Lojas Críticas</CardTitle>
            </CardHeader>
            <CardContent>
              <Top5Lojas top5={top5} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Tendência (14 dias)</CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">Carregando gráfico…</div>}>
                <TrendChart data={trendPoints} />
              </Suspense>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                Otimização de Rotas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RouteOptimization allLojaGroups={allLojaGroups} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Rastreador REQs ── */}
        <TabsContent value="reqs" className="mt-4">
          <ReqTracker allIssues={allIssues} />
        </TabsContent>

        {/* ── Gerente ── */}
        <TabsContent value="gerente" className="mt-4">
          <GerenteTab allLojaGroups={allLojaGroups} />
        </TabsContent>

        {/* ── Planilha ── */}
        <TabsContent value="planilha" className="mt-4">
          <PlanilhaInterna issues={allIssues} />
        </TabsContent>
      </Tabs>

      {/* Transition slide-over panel */}
      <TransitionPanel
        open={transitionOpen}
        onClose={() => setTransitionOpen(false)}
        loja={transitionLoja}
        allLojaGroups={allLojaGroups}
        pendentes={pendentes}
        agendados={agendados}
        tecCampo={tecCampo}
        onSuccess={refresh}
      />
    </div>
  );
}
