import { useState, useMemo, lazy, Suspense, startTransition, useCallback } from 'react';
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
  Search, ExternalLink, Package, X,
} from 'lucide-react';
import { searchChamadosByFsa, listChamadosByLoja } from '../lib/chamado-firestore';
import type { Chamado } from '../types/chamado';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';

import { useAgendamentoData, useRouteGroups } from '../hooks/use-agendamento';
import { KpiCards } from '../components/scheduling/KpiCards';
const TrendChart = lazy(() =>
  import('../components/scheduling/TrendChart').then(m => ({ default: m.TrendChart }))
);
import { StoreHighlights } from '../components/scheduling/StoreHighlights';
import { LojaExpander, type RelatedGroup } from '../components/scheduling/LojaExpander';
import { TransitionPanel } from '../components/scheduling/TransitionPanel';
import { ReqTracker } from '../components/scheduling/ReqTracker';
import { GerenteTab } from '../components/scheduling/GerenteTab';
import { PlanilhaInterna } from '../components/scheduling/PlanilhaInterna';
import { TecCampoSheet } from '../components/scheduling/TecCampoSheet';
const MapaAgendamento = lazy(() =>
  import('../components/scheduling/MapaAgendamento').then(m => ({ default: m.MapaAgendamento }))
);

import type { LojaGroup, SchedulingIssue } from '../types/scheduling';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

// ─── Sort ─────────────────────────────────────────────────────────────────────

type SortOption =
  | 'cidade-asc' | 'cidade-desc'
  | 'loja-asc'   | 'loja-desc'
  | 'qtd-desc'   | 'qtd-asc'
  | 'sla-worst'  | 'sla-best'
  | 'updated-oldest' | 'updated-newest'
  | 'agenda-asc' | 'agenda-desc';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'cidade-asc',      label: 'Cidade A → Z' },
  { value: 'cidade-desc',     label: 'Cidade Z → A' },
  { value: 'loja-asc',        label: 'Loja A → Z' },
  { value: 'loja-desc',       label: 'Loja Z → A' },
  { value: 'qtd-desc',        label: 'Mais chamados' },
  { value: 'qtd-asc',         label: 'Menos chamados' },
  { value: 'sla-worst',       label: 'SLA mais crítico' },
  { value: 'sla-best',        label: 'SLA ok primeiro' },
  { value: 'updated-oldest',  label: 'Sem update há mais tempo' },
  { value: 'updated-newest',  label: 'Atualizado recentemente' },
];

const SORT_OPTIONS_AGENDA: { value: SortOption; label: string }[] = [
  { value: 'agenda-asc',  label: 'Data agendada ↑ (mais próxima)' },
  { value: 'agenda-desc', label: 'Data agendada ↓ (mais distante)' },
  ...SORT_OPTIONS,
];

/** Lê lastUpdated tolerante (Date | string | Timestamp). */
function lastUpdatedMs(g: LojaGroup): number | null {
  const v = g.lastUpdated as unknown;
  if (!v) return null;
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'string' || typeof v === 'number') {
    const t = new Date(v).getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (typeof v === 'object' && 'toDate' in (v as Record<string, unknown>)) {
    try { return (v as { toDate: () => Date }).toDate().getTime(); } catch { return null; }
  }
  return null;
}

function slaRank(g: LojaGroup): number {
  const issueRank = Math.max(0, ...g.issues.map(i => {
    if (i.slaBadge?.startsWith('🔴')) return 3;
    if (i.slaBadge?.startsWith('🟡')) return 2;
    if (i.slaBadge?.startsWith('🟢')) return 1;
    return 0;
  }));
  const groupRank = g.slaGroupStatus === 'critical' ? 3 : g.slaGroupStatus === 'warning' ? 2 : 1;
  return Math.max(issueRank, groupRank);
}

function earliestAgenda(g: LojaGroup): number {
  const dates = g.issues.map(i => i.dataAgenda ? new Date(i.dataAgenda).getTime() : Infinity);
  return Math.min(...dates);
}

function sortGroups(groups: LojaGroup[], sort: SortOption): LojaGroup[] {
  return [...groups].sort((a, b) => {
    switch (sort) {
      case 'cidade-asc':     return a.cidade.localeCompare(b.cidade);
      case 'cidade-desc':    return b.cidade.localeCompare(a.cidade);
      case 'loja-asc':       return a.loja.localeCompare(b.loja);
      case 'loja-desc':      return b.loja.localeCompare(a.loja);
      case 'qtd-desc':       return b.qtd - a.qtd;
      case 'qtd-asc':        return a.qtd - b.qtd;
      case 'sla-worst':      return slaRank(b) - slaRank(a);
      case 'sla-best':       return slaRank(a) - slaRank(b);
      case 'updated-oldest': return (lastUpdatedMs(a) ?? 0) - (lastUpdatedMs(b) ?? 0);
      case 'updated-newest': return (lastUpdatedMs(b) ?? 0) - (lastUpdatedMs(a) ?? 0);
      case 'agenda-asc':     return earliestAgenda(a) - earliestAgenda(b);
      case 'agenda-desc':    return earliestAgenda(b) - earliestAgenda(a);
      default:               return 0;
    }
  });
}

function SortBar({
  value,
  onChange,
  options = SORT_OPTIONS,
}: {
  value: SortOption;
  onChange: (v: SortOption) => void;
  options?: { value: SortOption; label: string }[];
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground shrink-0">Ordenar:</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value as SortOption)}
        className="text-xs bg-secondary border border-border/50 rounded-md px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

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

// ─── Helper: issues de outro tipo da mesma loja (cross-status) ────────────────

function buildRelatedGroups(
  g: LojaGroup,
  isTerminal: boolean,
  allIssuesByLoja: Map<string, SchedulingIssue[]>,
): RelatedGroup[] | undefined {
  const allForLoja = allIssuesByLoja.get(g.loja) ?? [];
  const currentKeys = new Set(g.issues.map(i => i.key));
  const others = allForLoja.filter(i => !currentKeys.has(i.key));
  const result: RelatedGroup[] = [];
  if (!isTerminal) {
    const t = others.filter(isTerminalIssue);
    if (t.length) result.push({ label: 'Projeto Terminal', issues: t, isTerminal: true });
  } else {
    const n = others.filter(i => !isTerminalIssue(i));
    if (n.length) result.push({ label: 'Manutenção Regular', issues: n, isTerminal: false });
  }
  return result.length > 0 ? result : undefined;
}

// ─── FSA Search Panel ─────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  rascunho:           'Rascunho',
  submetido:          'Submetido',
  validado_operador:  'Validado (Op)',
  validado_financeiro:'Validado (Fin)',
  rejeitado:          'Rejeitado',
  pago:               'Pago',
};

const STATUS_COLOR: Record<string, string> = {
  rascunho:           'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  submetido:          'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  validado_operador:  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  validado_financeiro:'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  rejeitado:          'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  pago:               'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
};

function ChamadoRow({ c }: { c: Chamado }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary/40 transition-colors text-xs">
      <code className="font-mono bg-secondary px-1.5 py-0.5 rounded text-[10px] shrink-0 text-muted-foreground select-all">
        {c.fsa}
      </code>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-medium">Loja {c.codigoLoja}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{c.dataAtendimento}</span>
          {c.tecnicoNome && (
            <>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground truncate max-w-[120px]">{c.tecnicoNome}</span>
            </>
          )}
        </div>
        {c.catalogoServicoNome && (
          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{c.catalogoServicoNome}</p>
        )}
      </div>
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLOR[c.status] ?? 'bg-muted text-muted-foreground'}`}>
        {STATUS_LABEL[c.status] ?? c.status}
      </span>
      {c.linkPlataforma && (
        <a href={c.linkPlataforma} target="_blank" rel="noreferrer" className="text-primary hover:text-primary/70 shrink-0" onClick={e => e.stopPropagation()}>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      )}
    </div>
  );
}

function FsaSearchPanel({ allIssues }: { allIssues: SchedulingIssue[] }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [chamados, setChamados] = useState<Chamado[] | null>(null);
  const [lojaChamados, setLojaChamados] = useState<Chamado[] | null>(null);
  const [loadingLoja, setLoadingLoja] = useState(false);
  const [open, setOpen] = useState(false);

  const jiraMatches = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toUpperCase();
    return allIssues.filter(i => i.key.toUpperCase().includes(q));
  }, [query, allIssues]);

  const hasResults = jiraMatches.length > 0 || (chamados !== null && chamados.length > 0);

  const handleSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setOpen(true);
    setLoading(true);
    setLojaChamados(null);
    try {
      const found = await searchChamadosByFsa(q);
      setChamados(found);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleLoadLoja = async (codigoLoja: string) => {
    setLoadingLoja(true);
    try {
      const found = await listChamadosByLoja(codigoLoja);
      setLojaChamados(found);
    } finally {
      setLoadingLoja(false);
    }
  };

  // Loja code derived from Firestore results or Jira match
  const lojaCodeFromChamados = chamados && chamados.length > 0 ? chamados[0].codigoLoja : null;

  const handleClear = () => {
    setQuery('');
    setChamados(null);
    setLojaChamados(null);
    setOpen(false);
  };

  return (
    <div className="space-y-2">
      {/* Search bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por FSA (ex: FSA-1234)…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            className="pl-9 pr-8"
          />
          {query && (
            <button
              onClick={handleClear}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={handleSearch} disabled={!query.trim() || loading} className="gap-1.5 shrink-0">
          {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
          Buscar
        </Button>
      </div>

      {/* Results */}
      {open && (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-muted/30">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Resultados para "{query.trim()}"
            </span>
            <button onClick={handleClear} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="divide-y divide-border/50">
            {/* Jira Issues */}
            {jiraMatches.length > 0 && (
              <div className="px-4 py-3 space-y-1">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Fila de Agendamento · {jiraMatches.length} chamado(s)
                </p>
                {jiraMatches.map(i => (
                  <div key={i.key} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary/40 transition-colors text-xs">
                    <code className="font-mono bg-secondary px-1.5 py-0.5 rounded text-[10px] shrink-0 select-all text-muted-foreground">
                      {i.key}
                    </code>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium">Loja {i.loja}</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">PDV {i.pdv}</span>
                        {i.cidade && (
                          <>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-muted-foreground">{i.cidade}{i.uf ? `/${i.uf}` : ''}</span>
                          </>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{i.problema}</p>
                    </div>
                    {i.slaBadge && <span className="text-[10px] shrink-0">{i.slaBadge}</span>}
                    <span className="text-[10px] text-muted-foreground shrink-0 bg-secondary px-1.5 py-0.5 rounded">{i.status}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Firestore chamados */}
            {loading ? (
              <div className="px-4 py-4 flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="w-4 h-4 animate-spin" /> Buscando chamados registrados…
              </div>
            ) : chamados !== null && (
              <div className="px-4 py-3 space-y-1">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Chamados Registrados · {chamados.length > 0 ? chamados.length : 'nenhum'}
                </p>
                {chamados.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-3 py-2">Nenhum chamado registrado no sistema com essa FSA.</p>
                ) : (
                  <>
                    {chamados.map(c => <ChamadoRow key={c.id} c={c} />)}

                    {/* Load other chamados from same store */}
                    {lojaCodeFromChamados && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        {lojaChamados === null ? (
                          <button
                            onClick={() => handleLoadLoja(lojaCodeFromChamados)}
                            disabled={loadingLoja}
                            className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                          >
                            {loadingLoja
                              ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              : <Package className="w-3.5 h-3.5" />}
                            Ver todos os chamados da loja {lojaCodeFromChamados}
                          </button>
                        ) : (
                          <>
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                              Outros chamados da loja {lojaCodeFromChamados} · {lojaChamados.filter(c => !chamados.find(fc => fc.id === c.id)).length} chamado(s)
                            </p>
                            {lojaChamados
                              .filter(c => !chamados.find(fc => fc.id === c.id))
                              .map(c => <ChamadoRow key={c.id} c={c} />)}
                            {lojaChamados.filter(c => !chamados.find(fc => fc.id === c.id)).length === 0 && (
                              <p className="text-xs text-muted-foreground px-3 py-2">Não há outros chamados registrados para esta loja.</p>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {!loading && chamados !== null && !hasResults && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                Nenhum resultado encontrado para "{query.trim()}".
              </div>
            )}
          </div>
        </div>
      )}
    </div>
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
  allIssuesByLoja,
  onMapFocus,
}: {
  groups: LojaGroup[];
  agendadoLojas: Set<string>;
  tecCampoLojas: Set<string>;
  onTransition: (loja: string) => void;
  onScheduled: () => void;
  filterMode: FilterMode;
  terminalLojas: Set<string>;
  ufFilter: string;
  allIssuesByLoja: Map<string, SchedulingIssue[]>;
  onMapFocus: (loja: string) => void;
}) {
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState<SortOption>('sla-worst');
  const byUf = ufFilter ? groups.filter(g => g.uf === ufFilter) : groups;
  const filtered = sortGroups(
    filter
      ? byUf.filter(g =>
          g.loja.toLowerCase().includes(filter.toLowerCase()) ||
          g.cidade.toLowerCase().includes(filter.toLowerCase()),
        )
      : byUf,
    sort,
  );

  const { normal, terminal } = splitByTerminal(filtered);

  const renderGroup = (g: LojaGroup, isTerminal: boolean) => {
    const outras: string[] = [];
    if (agendadoLojas.has(g.loja)) outras.push('Agendado');
    if (tecCampoLojas.has(g.loja)) outras.push('TEC-CAMPO');
    const warning = outras.length
      ? `Esta loja já possui chamado(s) na fila ${outras.join(' e ')}. Verifique se há técnico designado.`
      : undefined;
    const hasTerminal = !isTerminal && terminalLojas.has(g.loja);
    const relatedGroups = buildRelatedGroups(g, isTerminal, allIssuesByLoja);
    return (
      <LojaExpander
        key={`${g.loja}-${g.issues[0]?.key}`}
        group={g}
        showForm
        warningText={warning}
        onScheduled={onScheduled}
        relatedGroups={relatedGroups}
        crossTerminal={hasTerminal}
        actions={
          <>
            <button
              className="w-7 h-7 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground border border-border/50 transition-colors flex items-center justify-center shrink-0"
              title="Ver no mapa"
              onClick={e => { e.stopPropagation(); onMapFocus(g.loja); }}
            >
              <MapPin className="w-3.5 h-3.5" />
            </button>
            <button
              className="h-8 px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold transition-colors shrink-0 flex items-center gap-1"
              onClick={e => { e.stopPropagation(); onTransition(g.loja); }}
            >
              Transição <span aria-hidden="true">→</span>
            </button>
          </>
        }
      />
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Filtrar por loja ou cidade…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="max-w-sm"
        />
        <SortBar value={sort} onChange={setSort} />
      </div>
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
  onSuccess,
  allIssuesByLoja,
  onMapFocus,
}: {
  agendados: Map<string, LojaGroup[]>;
  filterMode: FilterMode;
  terminalLojas: Set<string>;
  ufFilter: string;
  onSuccess?: () => void;
  allIssuesByLoja: Map<string, SchedulingIssue[]>;
  onMapFocus: (loja: string) => void;
}) {
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState<SortOption>('agenda-asc');
  const [tecCampoGroup, setTecCampoGroup] = useState<LojaGroup | null>(null);
  const [tecCampoOpen, setTecCampoOpen] = useState(false);
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
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Filtrar por loja ou cidade…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="max-w-sm"
        />
        <SortBar value={sort} onChange={setSort} options={SORT_OPTIONS_AGENDA} />
      </div>

      {entries.map(([date, lojas]) => {
        const filtered = sortGroups(lojas.filter(filterFn), sort);
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
          const relatedGroups = buildRelatedGroups(g, isTerminal, allIssuesByLoja);
          const actions = (
            <>
              {dupKeys.length > 0 && (
                <Badge
                  title={`Duplicado: ${dupKeys.join(', ')}`}
                  className="text-[10px] bg-orange-500/15 text-orange-400 border border-orange-500/30 shrink-0"
                >
                  Dup
                </Badge>
              )}
              <button
                className="w-7 h-7 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground border border-border/50 transition-colors flex items-center justify-center shrink-0"
                title="Ver no mapa"
                onClick={e => { e.stopPropagation(); onMapFocus(g.loja); }}
              >
                <MapPin className="w-3.5 h-3.5" />
              </button>
              <button
                className="h-8 px-3 rounded-md bg-orange-600 hover:bg-orange-600/90 text-white text-xs font-semibold transition-colors shrink-0 flex items-center gap-1"
                onClick={e => { e.stopPropagation(); setTecCampoGroup(g); setTecCampoOpen(true); }}
              >
                TEC-CAMPO <span aria-hidden="true">→</span>
              </button>
            </>
          );
          return (
            <LojaExpander
              key={`${date}-${g.loja}-${g.issues[0]?.key}`}
              group={g}
              crossTerminal={hasTerminal}
              actions={actions}
              relatedGroups={relatedGroups}
            />
          );
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

      <TecCampoSheet
        group={tecCampoGroup}
        open={tecCampoOpen}
        onClose={() => setTecCampoOpen(false)}
        onSuccess={() => { onSuccess?.(); setTecCampoOpen(false); }}
      />
    </div>
  );
}

// ─── TEC-CAMPO tab ────────────────────────────────────────────────────────────

function TecCampoTab({
  groups,
  filterMode,
  terminalLojas,
  ufFilter,
  allIssuesByLoja,
  onMapFocus,
}: {
  groups: LojaGroup[];
  filterMode: FilterMode;
  terminalLojas: Set<string>;
  ufFilter: string;
  allIssuesByLoja: Map<string, SchedulingIssue[]>;
  onMapFocus: (loja: string) => void;
}) {
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState<SortOption>('sla-worst');
  const byUf = ufFilter ? groups.filter(g => g.uf === ufFilter) : groups;
  const filtered = sortGroups(
    filter
      ? byUf.filter(g =>
          g.loja.toLowerCase().includes(filter.toLowerCase()) ||
          g.cidade.toLowerCase().includes(filter.toLowerCase()),
        )
      : byUf,
    sort,
  );

  const { normal, terminal } = splitByTerminal(filtered);

  const renderGroup = (g: LojaGroup, isTerminal: boolean) => {
    const hasTerminal = !isTerminal && terminalLojas.has(g.loja);
    const relatedGroups = buildRelatedGroups(g, isTerminal, allIssuesByLoja);
    return (
      <LojaExpander
        key={`${g.loja}-${g.issues[0]?.key}`}
        group={g}
        relatedGroups={relatedGroups}
        crossTerminal={hasTerminal}
        actions={
          <button
            className="w-7 h-7 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground border border-border/50 transition-colors flex items-center justify-center shrink-0"
            title="Ver no mapa"
            onClick={e => { e.stopPropagation(); onMapFocus(g.loja); }}
          >
            <MapPin className="w-3.5 h-3.5" />
          </button>
        }
      />
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Filtrar por loja ou cidade…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="max-w-sm"
        />
        <SortBar value={sort} onChange={setSort} />
      </div>
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
          {(() => {
            const ms = lastUpdatedMs(g);
            if (ms === null) return null;
            try {
              return (
                <p className="text-[10px] text-muted-foreground">
                  {format(new Date(ms), 'dd/MM HH:mm')}
                </p>
              );
            } catch { return null; }
          })()}
        </div>
      ))}
    </div>
  );
}

// ─── Chamados tab wrapper ─────────────────────────────────────────────────────

const FILTER_OPTIONS: { mode: FilterMode; label: string; dot: string }[] = [
  { mode: 'both',     label: 'Todos',      dot: 'bg-muted-foreground/60' },
  { mode: 'normal',   label: 'Manutenção', dot: 'bg-primary' },
  { mode: 'terminal', label: 'Terminal',   dot: 'bg-[hsl(var(--terminal))]' },
];

function ChamadosTab({
  kpi,
  pendentes,
  agendados,
  tecCampo,
  allLojaGroups,
  allIssues,
  agendadoLojas,
  tecCampoLojas,
  onTransition,
  onScheduled,
  onMapFocus,
}: {
  kpi: { agendamento: number; agendado: number; tecCampo: number };
  pendentes: LojaGroup[];
  agendados: Map<string, LojaGroup[]>;
  tecCampo: LojaGroup[];
  allLojaGroups: LojaGroup[];
  allIssues: SchedulingIssue[];
  agendadoLojas: Set<string>;
  tecCampoLojas: Set<string>;
  onTransition: (loja: string) => void;
  onScheduled: () => void;
  onMapFocus: (loja: string) => void;
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

  // Map loja → todos os seus issues (todos os status) — para exibir chamados cruzados
  const allIssuesByLoja = useMemo(() => {
    const map = new Map<string, SchedulingIssue[]>();
    for (const g of allLojaGroups) {
      const existing = map.get(g.loja) ?? [];
      map.set(g.loja, [...existing, ...g.issues]);
    }
    return map;
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
      {/* ── Barra de filtros consolidada (segment status · UF · highlights) ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-secondary/50 border border-border/50 rounded-lg">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2">Tipo</span>
          {FILTER_OPTIONS.map(({ mode, label, dot }) => (
            <button
              key={mode}
              onClick={() => setFilterMode(mode)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all',
                filterMode === mode
                  ? 'bg-card text-foreground shadow-sm border border-border/50'
                  : 'text-muted-foreground hover:text-foreground hover:bg-card/50 border border-transparent',
              )}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {allUfs.length > 0 && (
            <select
              value={ufFilter}
              onChange={e => setUfFilter(e.target.value)}
              className="text-xs bg-secondary border border-border/50 rounded-md px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer"
              title="Filtrar por estado"
            >
              <option value="">UF: Todas</option>
              {allUfs.map(uf => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          )}

          <button
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-secondary/50 hover:bg-secondary border border-border/50 rounded-lg transition-colors"
            onClick={() => setHighlightsOpen(o => !o)}
          >
            <Hash className="w-3.5 h-3.5 text-primary" />
            Lojas com N+ chamados
            {highlightsOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Banner foco — lojas críticas */}
      {kpi.lojasMultiplas > 0 && !highlightsOpen && (
        <div className="flex items-center gap-3 rounded-lg border border-rose-500/30 bg-rose-500/5 px-4 py-2.5 text-xs">
          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
          <span className="text-foreground/90">
            <span className="font-semibold tabular-nums">{kpi.lojasMultiplas}</span> lojas com 2+ chamados.{' '}
            <button
              onClick={() => setHighlightsOpen(true)}
              className="text-rose-600 dark:text-rose-400 font-medium hover:underline"
            >
              Ver ranking →
            </button>
          </span>
          <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
            atualizado há poucos segundos
          </span>
        </div>
      )}

      <Collapsible open={highlightsOpen} onOpenChange={setHighlightsOpen}>
        <CollapsibleContent>
          <div className="border border-border/50 rounded-lg p-4 bg-card">
            <StoreHighlights lojaGroups={allLojaGroups} />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Sub-tabs — segment com dot colorido por status */}
      <Tabs value={subTab} onValueChange={v => startTransition(() => setSubTab(v))}>
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur pt-1 pb-2 -mx-4 px-4 sm:-mx-6 sm:px-6">
        <TabsList className="h-auto p-1 gap-1 bg-secondary/50 border border-border/50 rounded-lg">
          {[
            { value: 'pendentes',  label: 'Pendentes',  count: filteredCounts.pendentes, dot: 'bg-amber-500' },
            { value: 'agendados',  label: 'Agendados',  count: filteredCounts.agendados, dot: 'bg-blue-500' },
            { value: 'tec-campo',  label: 'TEC-CAMPO',  count: filteredCounts.tecCampo,  dot: 'bg-primary' },
          ].map(t => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className={cn(
                'gap-2 px-3 py-1.5 rounded-md text-xs font-medium',
                'data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border/50',
              )}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />
              {t.label}
              <span className="text-[10px] text-muted-foreground tabular-nums">{t.count}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        </div>

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
            allIssuesByLoja={allIssuesByLoja}
            onMapFocus={onMapFocus}
          />
        </TabsContent>

        <TabsContent value="agendados" className="mt-4">
          <AgendadosTab agendados={agendados} filterMode={filterMode} terminalLojas={terminalLojas} ufFilter={ufFilter} onSuccess={onScheduled} allIssuesByLoja={allIssuesByLoja} onMapFocus={onMapFocus} />
        </TabsContent>

        <TabsContent value="tec-campo" className="mt-4">
          <TecCampoTab groups={tecCampo} filterMode={filterMode} terminalLojas={terminalLojas} ufFilter={ufFilter} allIssuesByLoja={allIssuesByLoja} onMapFocus={onMapFocus} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AgendamentoPage() {
  const { data, isLoading, isError, error, refresh, isFromCache, cacheAgeMinutes, isFetching } = useAgendamentoData();
  const [transitionLoja, setTransitionLoja] = useState<string | null>(null);
  const [transitionOpen, setTransitionOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('chamados');
  const [mapUfFilter, setMapUfFilter] = useState<string | null>(null);
  const [mapFocusLoja, setMapFocusLoja] = useState<string | null>(null);

  const openTransition = (loja: string) => {
    setTransitionLoja(loja);
    setTransitionOpen(true);
  };

  const onMapFocus = useCallback((loja: string) => {
    startTransition(() => setActiveTab('mapa'));
    setMapFocusLoja(loja);
  }, []);

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

  // ── Métricas auxiliares dos KPIs ───────────────────────────────────────────
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');

  /** Converte Date | string | Timestamp(Firestore-like) | null para timestamp em ms (NaN se inválido). */
  const toMs = (v: unknown): number => {
    if (!v) return NaN;
    if (v instanceof Date) return v.getTime();
    if (typeof v === 'string' || typeof v === 'number') return new Date(v).getTime();
    if (typeof v === 'object' && 'toDate' in (v as Record<string, unknown>)) {
      try { return (v as { toDate: () => Date }).toDate().getTime(); } catch { return NaN; }
    }
    return NaN;
  };

  const novosHoje = allIssues.filter(i => {
    const ms = toMs(i.lastUpdated);
    if (!Number.isFinite(ms)) return false;
    try { return format(new Date(ms), 'yyyy-MM-dd') === todayStr; } catch { return false; }
  }).length;

  const proxAgendaDate = (() => {
    const dates = [...agendados.values()].flat()
      .flatMap(g => g.issues.map(i => toMs(i.dataAgenda)))
      .filter(t => Number.isFinite(t) && t >= now.getTime() - 86400000);
    if (!dates.length) return undefined;
    const min = Math.min(...dates);
    try { return format(new Date(min), 'dd/MM HH') + 'h'; } catch { return undefined; }
  })();

  const tecnicosCampo = new Set(
    tecCampo.flatMap(g => g.issues.map(i => i.tecnico).filter(Boolean) as string[]),
  ).size || kpi.tecCampo;

  const sincronizado = format(now, 'HH:mm');

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
            disabled={isFetching}
            className="ml-auto shrink-0 flex items-center gap-1 font-medium underline underline-offset-2 hover:no-underline disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            {isFetching ? 'Atualizando…' : 'Tentar novamente'}
          </button>
        </div>
      )}

      {/* ── Hero header ── */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm">
        <div className="h-[3px] w-full bg-primary" />
        <div className="p-6">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Operação
              </p>
              <h1 className="text-3xl font-bold tracking-tight mt-1 leading-none">Agendamentos</h1>
              <p className="text-xs text-muted-foreground mt-2 tabular-nums">
                <span className="font-semibold text-foreground">{totalAtivos}</span> ativos
                <span className="mx-2 text-border">·</span>
                sincronizado <span className="text-foreground tabular-nums">{sincronizado}</span>
                <span className="mx-2 text-border">·</span>
                Jira FSA
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={refresh} disabled={isFetching} className="gap-1.5">
                <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                {isFetching ? 'Atualizando…' : 'Atualizar'}
              </Button>
              <Button size="sm" onClick={() => openTransition('')} className="gap-1.5">
                <Zap className="w-3.5 h-3.5" /> Transição em massa <span aria-hidden>→</span>
              </Button>
            </div>
          </div>

          <KpiCards
            kpi={kpi}
            novosHoje={novosHoje}
            proxAgenda={proxAgendaDate}
            tecnicosCampo={tecnicosCampo}
          />
        </div>
      </div>

      {/* ── Main tabs ── */}
      <Tabs
        value={activeTab}
        onValueChange={v => startTransition(() => setActiveTab(v))}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border/60 -mx-4 px-4 sm:-mx-6 sm:px-6">
        <TabsList className="flex-wrap h-auto gap-0 p-0 bg-transparent rounded-none">
          {[
            { value: 'chamados', label: 'Chamados', count: totalAtivos },
            { value: 'overview', label: 'Visão geral' },
            { value: 'reqs',     label: 'REQs' },
            { value: 'gerente',  label: 'Gerente' },
            { value: 'planilha', label: 'Planilha' },
            { value: 'mapa',     label: 'Mapa' },
          ].map(t => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className={cn(
                'relative h-10 px-3 rounded-none bg-transparent shadow-none',
                'text-sm font-medium text-muted-foreground hover:text-foreground',
                'data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground',
                'data-[state=active]:after:absolute data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:-bottom-px data-[state=active]:after:h-0.5 data-[state=active]:after:bg-primary',
              )}
            >
              {t.label}
              {t.count !== undefined && (
                <span className="ml-1.5 text-[11px] text-muted-foreground tabular-nums">{t.count}</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* FSA Search no header global — libera 60px verticais */}
        <div className="hidden md:block pb-1.5 max-w-sm w-full">
          <FsaSearchPanel allIssues={allIssues} />
        </div>
        </div>

        {/* FSA Search mobile (abaixo das tabs) */}
        <div className="md:hidden mt-3">
          <FsaSearchPanel allIssues={allIssues} />
        </div>

        {/* ── Chamados (default) ── */}
        <TabsContent value="chamados" className="mt-4">
          <ChamadosTab
            kpi={kpi}
            pendentes={pendentes}
            agendados={agendados}
            tecCampo={tecCampo}
            allLojaGroups={allLojaGroups}
            allIssues={allIssues}
            agendadoLojas={agendadoLojas}
            tecCampoLojas={tecCampoLojas}
            onTransition={openTransition}
            onScheduled={refresh}
            onMapFocus={onMapFocus}
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

        {/* ── Mapa ── */}
        <TabsContent value="mapa" className="mt-4">
          <Suspense fallback={
            <div className="flex items-center justify-center h-80 gap-2 text-sm text-muted-foreground">
              <RefreshCw className="w-4 h-4 animate-spin" /> Carregando mapa…
            </div>
          }>
            <MapaAgendamento
              groups={allLojaGroups}
              selectedUf={mapUfFilter}
              onUfClick={uf => setMapUfFilter(uf)}
              focusLoja={mapFocusLoja}
              onFocusConsumed={() => setMapFocusLoja(null)}
            />
          </Suspense>
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
