import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, CalendarClock, Clock, Copy, Download, Loader2, Search, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { useSeasonalHours } from '../../hooks/use-seasonal-hours';
import {
  formatSeasonalDate,
  normalizeStoreCode,
  parseSeasonalHoursFile,
  seasonalHoursLabel,
} from '../../lib/seasonal-hours';
import { cn } from '../../lib/utils';
import type { SchedulingIssue, SeasonalStoreHours } from '../../types/scheduling';

interface Props {
  issues: SchedulingIssue[];
}

type FilterMode = 'all' | 'closed' | 'open' | 'openMultiCalls' | 'closedMultiCalls' | 'multiCalls' | 'criticalSla';
type SortMode = 'risk' | 'calls' | 'oldest' | 'loja';

interface StoreImpactRow {
  item: SeasonalStoreHours;
  issues: SchedulingIssue[];
  criticalSla: number;
  warningSla: number;
  oldestMs: number;
  cityUf: string;
  riskScore: number;
}

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  try { return format(date, 'dd/MM/yyyy HH:mm'); } catch { return '-'; }
}

function buildIssueIndex(issues: SchedulingIssue[]) {
  const map = new Map<string, SchedulingIssue[]>();
  for (const issue of issues) {
    const key = normalizeStoreCode(issue.loja);
    const list = map.get(key) ?? [];
    list.push(issue);
    map.set(key, list);
  }
  return map;
}

function pct(part: number, total: number) {
  if (!total) return '0%';
  return `${Math.round((part / total) * 100)}%`;
}

function statusLabel(item: SeasonalStoreHours) {
  if (item.closed) return 'Fechada';
  if (item.opensAt && item.closesAt) return `${item.opensAt}-${item.closesAt}`;
  return 'Aberta';
}

function issueCreatedMs(issue: SchedulingIssue) {
  if (!issue.created) return Number.POSITIVE_INFINITY;
  const date = issue.created instanceof Date ? issue.created : new Date(issue.created);
  const ms = date.getTime();
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
}

function buildStoreRow(item: SeasonalStoreHours, issues: SchedulingIssue[]): StoreImpactRow {
  const criticalSla = issues.filter(issue => issue.slaBadge?.includes('ESTOURADO') || issue.slaBadge?.includes('🔴')).length;
  const warningSla = issues.filter(issue => issue.slaBadge?.includes('ALERTA') || issue.slaBadge?.includes('🟡')).length;
  const oldestMs = Math.min(...issues.map(issueCreatedMs));
  const firstIssue = issues[0];
  const cityUf = firstIssue ? `${firstIssue.cidade || '-'}${firstIssue.uf ? `/${firstIssue.uf}` : ''}` : '-';
  const riskScore =
    (item.closed ? 100 : 0) +
    Math.max(0, issues.length - 1) * 25 +
    criticalSla * 20 +
    warningSla * 8;

  return { item, issues, criticalSla, warningSla, oldestMs, cityUf, riskScore };
}

export function SazonalidadeTab({ issues }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [importing, setImporting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [sortMode, setSortMode] = useState<SortMode>('risk');
  const [query, setQuery] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [localItems, setLocalItems] = useState<SeasonalStoreHours[]>([]);
  const [localWarning, setLocalWarning] = useState<string | null>(null);
  const { items, dates, saveMany, removeDate, isLoading } = useSeasonalHours();

  const allItems = useMemo(() => {
    const byId = new Map<string, SeasonalStoreHours>();
    for (const item of items) byId.set(item.id, item);
    for (const item of localItems) byId.set(item.id, item);
    return [...byId.values()].sort((a, b) => a.date.localeCompare(b.date) || a.loja.localeCompare(b.loja, 'pt-BR', { numeric: true }));
  }, [items, localItems]);

  const allDates = useMemo(
    () => [...new Set(allItems.map(item => item.date))].sort(),
    [allItems],
  );

  const issueIndex = useMemo(() => buildIssueIndex(issues), [issues]);
  const dayItems = useMemo(
    () => allItems.filter(item => item.date === selectedDate),
    [allItems, selectedDate],
  );

  const allRows = useMemo(() => {
    return dayItems
      .map(item => buildStoreRow(item, issueIndex.get(normalizeStoreCode(item.loja)) ?? []))
      .filter(row => row.issues.length > 0);
  }, [dayItems, issueIndex]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allRows
      .filter(row => {
        if (filterMode === 'closed' && !row.item.closed) return false;
        if (filterMode === 'open' && row.item.closed) return false;
        if (filterMode === 'openMultiCalls' && (row.item.closed || row.issues.length < 2)) return false;
        if (filterMode === 'closedMultiCalls' && (!row.item.closed || row.issues.length < 2)) return false;
        if (filterMode === 'multiCalls' && row.issues.length < 2) return false;
        if (filterMode === 'criticalSla' && row.criticalSla === 0) return false;
        if (!q) return true;
        return (
          row.item.loja.toLowerCase().includes(q) ||
          row.issues.some(issue =>
            issue.key.toLowerCase().includes(q) ||
            issue.cidade.toLowerCase().includes(q) ||
            issue.uf.toLowerCase().includes(q) ||
            issue.problema.toLowerCase().includes(q)
          )
        );
      })
      .sort((a, b) => {
        if (sortMode === 'calls') return b.issues.length - a.issues.length || b.riskScore - a.riskScore;
        if (sortMode === 'oldest') return a.oldestMs - b.oldestMs;
        if (sortMode === 'loja') return a.item.loja.localeCompare(b.item.loja, 'pt-BR', { numeric: true });
        return b.riskScore - a.riskScore || b.issues.length - a.issues.length;
      });
  }, [allRows, filterMode, query, sortMode]);

  const activeRow = useMemo(
    () => rows.find(row => row.item.id === selectedStoreId) ?? rows[0] ?? null,
    [rows, selectedStoreId],
  );

  const stats = useMemo(() => {
    const closedStores = allRows.filter(row => row.item.closed).length;
    const openStores = allRows.length - closedStores;
    const multiCallStores = allRows.filter(row => row.issues.length >= 2).length;
    const openMultiCallStores = allRows.filter(row => !row.item.closed && row.issues.length >= 2).length;
    const closedMultiCallStores = allRows.filter(row => row.item.closed && row.issues.length >= 2).length;
    const criticalSlaStores = allRows.filter(row => row.criticalSla > 0).length;
    const callsOnOpenMultiCallStores = allRows
      .filter(row => !row.item.closed && row.issues.length >= 2)
      .reduce((sum, row) => sum + row.issues.length, 0);
    const callsOnClosed = allRows
      .filter(row => row.item.closed)
      .reduce((sum, row) => sum + row.issues.length, 0);
    const totalCalls = allRows.reduce((sum, row) => sum + row.issues.length, 0);
    const storesInSheet = dayItems.length;
    return {
      closedStores,
      openStores,
      multiCallStores,
      openMultiCallStores,
      closedMultiCallStores,
      criticalSlaStores,
      callsOnOpenMultiCallStores,
      callsOnClosed,
      totalCalls,
      storesInSheet,
      matchedStores: allRows.length,
    };
  }, [allRows, dayItems.length]);

  const handleFile = async (file?: File) => {
    if (!file) return;
    setImporting(true);
    setLocalWarning(null);
    try {
      const result = await parseSeasonalHoursFile(file, selectedDate);
      if (!result.entries.length) {
        toast.error('Nenhum horário válido encontrado na planilha.');
        return;
      }
      const entries = result.entries.map(entry => ({ ...entry, sourceFile: file.name }));
      const firstDate = result.entries[0]?.date;
      if (firstDate) setSelectedDate(firstDate);
      setLocalItems(prev => {
        const byId = new Map(prev.map(item => [item.id, item] as const));
        for (const entry of entries) byId.set(entry.id, entry);
        return [...byId.values()];
      });

      try {
        await saveMany(entries, file.name);
        setLocalItems(prev => prev.filter(item => !entries.some(entry => entry.id === item.id)));
        toast.success(`${entries.length} registro(s) de sazonalidade importado(s).`);
      } catch (saveError: unknown) {
        const message = (saveError as Error)?.message ?? 'falha desconhecida';
        setLocalWarning('A planilha foi carregada para análise nesta sessão, mas ainda não foi salva no Firestore. Publique as regras atualizadas para persistir.');
        toast.warning(`Planilha analisada, mas não salva: ${message}`);
      }

      if (result.skipped > 0) toast.warning(`${result.skipped} linha(s) ignorada(s).`);
    } catch (e: unknown) {
      toast.error('Erro ao importar planilha: ' + ((e as Error)?.message ?? 'falha desconhecida'));
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleRemoveDate = async () => {
    if (!selectedDate || !dayItems.length) return;
    setRemoving(true);
    try {
      const localRemoved = localItems.filter(item => item.date === selectedDate).length;
      setLocalItems(prev => prev.filter(item => item.date !== selectedDate));
      let removed = 0;
      try {
        removed = await removeDate(selectedDate);
      } catch {
        setLocalWarning('Registros locais removidos. O Firestore ainda bloqueia alterações persistentes nesta coleção.');
      }
      toast.success(`${removed + localRemoved} registro(s) removido(s) de ${formatSeasonalDate(selectedDate)}.`);
    } catch (e: unknown) {
      toast.error('Erro ao remover data: ' + ((e as Error)?.message ?? 'falha desconhecida'));
    } finally {
      setRemoving(false);
    }
  };

  const handleExportCsv = () => {
    const header = 'Loja,Funcionamento,Chamados,FSAs,Data Abertura,Status,Cidade,UF,Problema\n';
    const body = rows.flatMap(row => {
      if (!row.issues.length) {
        return [[row.item.loja, statusLabel(row.item), 0, '', '', '', '', '', '']];
      }
      return row.issues.map(issue => [
        row.item.loja,
        statusLabel(row.item),
        row.issues.length,
        issue.key,
        formatDateTime(issue.created),
        issue.status,
        issue.cidade,
        issue.uf,
        issue.problema,
      ]);
    }).map(cols => cols.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');

    const blob = new Blob(['\ufeff' + header + body], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sazonalidade_${selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleCopySummary = async (row: StoreImpactRow) => {
    const lines = [
      `Loja ${row.item.loja} - ${statusLabel(row.item)} em ${formatSeasonalDate(row.item.date)}`,
      `${row.issues.length} chamado(s) ativo(s)${row.criticalSla ? `, ${row.criticalSla} com SLA crítico` : ''}`,
      ...row.issues.map(issue => `${issue.key} | aberto ${formatDateTime(issue.created)} | ${issue.status} | ${issue.problema}`),
    ];

    await navigator.clipboard.writeText(lines.join('\n'));
    toast.success(`Resumo da loja ${row.item.loja} copiado.`);
  };

  const filters: { value: FilterMode; label: string; count: number }[] = [
    { value: 'all', label: 'Com chamados', count: stats.matchedStores },
    { value: 'open', label: 'Abertas', count: stats.openStores },
    { value: 'openMultiCalls', label: 'Abertas 2+', count: stats.openMultiCallStores },
    { value: 'closed', label: 'Fechadas', count: stats.closedStores },
    { value: 'closedMultiCalls', label: 'Fechadas 2+', count: stats.closedMultiCallStores },
    { value: 'multiCalls', label: '2+ chamados', count: stats.multiCallStores },
    { value: 'criticalSla', label: 'SLA crítico', count: stats.criticalSlaStores },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-card/70 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 min-w-0 mr-auto">
            <CalendarClock className="w-4 h-4 text-primary shrink-0" />
            <div>
              <h2 className="text-sm font-semibold leading-none">Sazonalidade</h2>
              <p className="text-[11px] text-muted-foreground mt-1">
                {isLoading ? 'Carregando registros...' : `${allItems.length} registro(s) em ${allDates.length} data(s)`}
                {localItems.length > 0 && <span className="text-amber-500"> · {localItems.length} local(is)</span>}
              </p>
            </div>
          </div>

          <Input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="h-9 w-[155px] text-xs bg-background"
          />

          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv,.ods"
            className="hidden"
            onChange={e => handleFile(e.target.files?.[0])}
          />

          <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={() => fileRef.current?.click()} disabled={importing}>
            {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Importar
          </Button>

          <Button size="sm" variant="ghost" className="h-9 gap-1.5" onClick={handleExportCsv} disabled={!rows.length}>
            <Download className="w-3.5 h-3.5" />
            CSV
          </Button>

          {dayItems.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-9 gap-1.5 text-destructive hover:text-destructive"
              onClick={handleRemoveDate}
              disabled={removing}
            >
              {removing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Remover data
            </Button>
          )}
        </div>
      </div>

      {localWarning && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{localWarning}</span>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { label: 'Lojas com chamados', value: stats.matchedStores, hint: `${stats.storesInSheet} na planilha`, tone: 'text-sky-500' },
          { label: 'Abertas com chamados', value: stats.openStores, hint: pct(stats.openStores, stats.matchedStores), tone: 'text-emerald-500' },
          { label: 'Abertas com 2+ chamados', value: stats.openMultiCallStores, hint: `${stats.callsOnOpenMultiCallStores} chamado(s)`, tone: 'text-violet-400' },
          { label: 'Fechadas com chamados', value: stats.closedStores, hint: pct(stats.closedStores, stats.matchedStores), tone: 'text-red-500' },
          { label: 'Fechadas com 2+ chamados', value: stats.closedMultiCallStores, hint: pct(stats.closedMultiCallStores, stats.matchedStores), tone: 'text-red-400' },
          { label: 'Chamados em fechadas', value: stats.callsOnClosed, hint: `${stats.totalCalls} chamado(s) cruzados`, tone: 'text-amber-500' },
        ].map(card => (
          <div key={card.label} className="rounded-xl border border-border/60 bg-card p-4">
            <p className="text-[11px] text-muted-foreground">{card.label}</p>
            <p className={cn('text-2xl font-bold mt-1 tabular-nums', card.tone)}>{card.value}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{card.hint}</p>
          </div>
        ))}
      </div>

      {stats.callsOnClosed > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {stats.callsOnClosed} chamado(s) ativo(s) estão em lojas marcadas como fechadas para {formatSeasonalDate(selectedDate)}.
        </div>
      )}

      {stats.openMultiCallStores > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {stats.openMultiCallStores} loja(s) que estarão abertas concentram 2+ chamados, somando {stats.callsOnOpenMultiCallStores} chamado(s).
        </div>
      )}

      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border/60 bg-muted/20">
          <div className="flex items-center gap-1 overflow-x-auto">
            {filters.map(filter => (
              <button
                key={filter.value}
                onClick={() => setFilterMode(filter.value)}
                className={cn(
                  'h-8 shrink-0 rounded-md px-2.5 text-[11px] font-medium transition-colors',
                  filterMode === filter.value
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60',
                )}
              >
                {filter.label} <span className="tabular-nums opacity-70">{filter.count}</span>
              </button>
            ))}
          </div>

          <select
            value={sortMode}
            onChange={e => setSortMode(e.target.value as SortMode)}
            className="h-8 rounded-md border border-border/60 bg-background px-2 text-xs text-foreground"
            title="Ordenação"
          >
            <option value="risk">Risco primeiro</option>
            <option value="calls">Mais chamados</option>
            <option value="oldest">Abertura mais antiga</option>
            <option value="loja">Loja</option>
          </select>

          <div className="relative ml-auto">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar loja, FSA, cidade..."
              className="h-8 w-64 pl-7 text-xs bg-background"
            />
          </div>
        </div>

        <div className="grid min-h-[520px] lg:grid-cols-[430px_minmax(0,1fr)]">
          <div className="border-r border-border/60 bg-background/30">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/60">
              <span className="text-xs font-semibold text-muted-foreground">
                {rows.length} loja(s) no filtro
              </span>
              <span className="text-[10px] text-muted-foreground">
                {stats.totalCalls} chamado(s) cruzados
              </span>
            </div>

            <div className="max-h-[66vh] overflow-auto p-2 space-y-2">
              {rows.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                  Nenhuma loja da planilha possui chamado ativo nos filtros atuais.
                </div>
              ) : rows.map(row => {
                const selected = activeRow?.item.id === row.item.id;
                const oldestLabel = Number.isFinite(row.oldestMs)
                  ? formatDateTime(new Date(row.oldestMs))
                  : '-';

                return (
                  <button
                    key={row.item.id}
                    type="button"
                    onClick={() => setSelectedStoreId(row.item.id)}
                    className={cn(
                      'w-full rounded-lg border p-3 text-left transition-colors',
                      selected
                        ? 'border-primary/50 bg-primary/10'
                        : 'border-border/60 bg-card hover:bg-secondary/50',
                      row.item.closed && 'border-l-4 border-l-red-500',
                      !row.item.closed && 'border-l-4 border-l-emerald-500',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold tabular-nums">Loja {row.item.loja}</span>
                          <Badge
                            className={cn(
                              'text-[10px]',
                              row.item.closed
                                ? 'bg-red-500/15 text-red-400 border-red-500/30'
                                : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
                            )}
                          >
                            {statusLabel(row.item)}
                          </Badge>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground truncate">{row.cityUf}</p>
                      </div>

                      <div className="text-right">
                        <div
                          className={cn(
                            'inline-flex min-w-9 justify-center rounded-full px-2 py-1 text-sm font-bold tabular-nums',
                            row.issues.length >= 2
                              ? 'bg-violet-500/15 text-violet-300'
                              : 'bg-secondary text-foreground',
                          )}
                        >
                          {row.issues.length}
                        </div>
                        <p className="mt-1 text-[9px] uppercase tracking-wide text-muted-foreground">chamados</p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      {row.item.closed && (
                        <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">
                          Loja fechada
                        </span>
                      )}
                      {row.issues.length >= 2 && (
                        <span className="rounded bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-violet-300">
                          2+ chamados
                        </span>
                      )}
                      {row.criticalSla > 0 && (
                        <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">
                          {row.criticalSla} SLA crítico
                        </span>
                      )}
                      {row.warningSla > 0 && row.criticalSla === 0 && (
                        <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">
                          {row.warningSla} alerta SLA
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      abertura mais antiga: <span className="text-foreground tabular-nums">{oldestLabel}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-w-0">
            {!activeRow ? (
              <div className="flex min-h-[520px] items-center justify-center px-4 text-sm text-muted-foreground">
                Importe uma planilha ou ajuste os filtros para ver os chamados.
              </div>
            ) : (
              <div className="flex min-h-[520px] flex-col">
                <div className="border-b border-border/60 p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-bold tabular-nums">Loja {activeRow.item.loja}</h3>
                        <Badge
                          className={cn(
                            activeRow.item.closed
                              ? 'bg-red-500/15 text-red-400 border-red-500/30'
                              : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
                          )}
                        >
                          {seasonalHoursLabel(activeRow.item)}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{activeRow.cityUf}</p>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => handleCopySummary(activeRow)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copiar resumo
                    </Button>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
                    {[
                      { label: 'Chamados', value: activeRow.issues.length, tone: 'text-foreground' },
                      { label: 'SLA crítico', value: activeRow.criticalSla, tone: activeRow.criticalSla ? 'text-red-400' : 'text-muted-foreground' },
                      { label: 'Alerta SLA', value: activeRow.warningSla, tone: activeRow.warningSla ? 'text-amber-400' : 'text-muted-foreground' },
                      { label: 'Risco', value: activeRow.riskScore, tone: activeRow.riskScore >= 120 ? 'text-red-400' : 'text-amber-400' },
                    ].map(stat => (
                      <div key={stat.label} className="rounded-lg border border-border/60 bg-background/40 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{stat.label}</p>
                        <p className={cn('mt-1 text-lg font-bold tabular-nums', stat.tone)}>{stat.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="max-h-[66vh] flex-1 overflow-auto p-4 space-y-3">
                  {activeRow.issues
                    .slice()
                    .sort((a, b) => issueCreatedMs(a) - issueCreatedMs(b))
                    .map(issue => (
                      <div key={issue.key} className="rounded-lg border border-border/60 bg-background/40 p-3">
                        <div className="flex flex-wrap items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <code className="rounded bg-primary/10 px-2 py-1 font-mono text-xs font-semibold text-primary">
                                {issue.key}
                              </code>
                              <Badge variant="secondary" className="text-[10px]">{issue.status}</Badge>
                              {issue.slaBadge && (
                                <span
                                  className={cn(
                                    'text-[10px] font-semibold',
                                    issue.slaBadge.includes('🔴') ? 'text-red-400'
                                      : issue.slaBadge.includes('🟡') ? 'text-amber-400'
                                      : 'text-emerald-400',
                                  )}
                                >
                                  {issue.slaBadge}
                                </span>
                              )}
                            </div>
                            <p className="mt-2 text-sm text-foreground/90">{issue.problema}</p>
                          </div>

                          <div className="text-right text-[11px] text-muted-foreground">
                            <p className="tabular-nums">{formatDateTime(issue.created)}</p>
                            <p className="mt-1">PDV {issue.pdv} · {issue.ativo || '-'}</p>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                          <span>Técnico: <span className="text-foreground">{issue.tecnico || '-'}</span></span>
                          <span>REQ: <span className="text-foreground">{issue.req || '-'}</span></span>
                          <span>Cidade: <span className="text-foreground">{issue.cidade || '-'}{issue.uf ? `/${issue.uf}` : ''}</span></span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
