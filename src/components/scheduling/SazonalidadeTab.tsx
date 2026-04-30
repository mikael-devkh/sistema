import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, CalendarClock, Download, Loader2, Search, Trash2, Upload } from 'lucide-react';
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

type FilterMode = 'all' | 'closed' | 'open' | 'multiCalls';

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

export function SazonalidadeTab({ issues }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [importing, setImporting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [query, setQuery] = useState('');
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

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return dayItems
      .map(item => ({
        item,
        issues: issueIndex.get(normalizeStoreCode(item.loja)) ?? [],
      }))
      .filter(row => row.issues.length > 0)
      .filter(row => {
        if (filterMode === 'closed' && !row.item.closed) return false;
        if (filterMode === 'open' && row.item.closed) return false;
        if (filterMode === 'multiCalls' && row.issues.length < 2) return false;
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
        if (a.issues.length !== b.issues.length) return b.issues.length - a.issues.length;
        if (a.item.closed !== b.item.closed) return a.item.closed ? -1 : 1;
        return a.item.loja.localeCompare(b.item.loja, 'pt-BR', { numeric: true });
      });
  }, [dayItems, filterMode, issueIndex, query]);

  const stats = useMemo(() => {
    const matchedItems = dayItems
      .map(item => ({ item, issues: issueIndex.get(normalizeStoreCode(item.loja)) ?? [] }))
      .filter(row => row.issues.length > 0);
    const closedStores = matchedItems.filter(row => row.item.closed).length;
    const openStores = matchedItems.length - closedStores;
    const multiCallStores = matchedItems.filter(row => row.issues.length >= 2).length;
    const callsOnClosed = matchedItems
      .filter(row => row.item.closed)
      .reduce((sum, row) => sum + row.issues.length, 0);
    const totalCalls = matchedItems.reduce((sum, row) => sum + row.issues.length, 0);
    const storesInSheet = dayItems.length;
    return { closedStores, openStores, multiCallStores, callsOnClosed, totalCalls, storesInSheet, matchedStores: matchedItems.length };
  }, [dayItems, issueIndex]);

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

  const filters: { value: FilterMode; label: string; count: number }[] = [
    { value: 'all', label: 'Com chamados', count: stats.matchedStores },
    { value: 'closed', label: 'Fechadas', count: stats.closedStores },
    { value: 'open', label: 'Abertas', count: stats.openStores },
    { value: 'multiCalls', label: '2+ chamados', count: stats.multiCallStores },
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

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Lojas com chamados', value: stats.matchedStores, hint: `${stats.storesInSheet} na planilha`, tone: 'text-sky-500' },
          { label: 'Fechadas com chamados', value: stats.closedStores, hint: pct(stats.closedStores, stats.matchedStores), tone: 'text-red-500' },
          { label: 'Abertas com chamados', value: stats.openStores, hint: pct(stats.openStores, stats.matchedStores), tone: 'text-emerald-500' },
          { label: 'Lojas com 2+ chamados', value: stats.multiCallStores, hint: pct(stats.multiCallStores, stats.matchedStores), tone: 'text-violet-400' },
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
          Existem chamados ativos em lojas marcadas como fechadas para {formatSeasonalDate(selectedDate)}.
        </div>
      )}

      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border/60 bg-muted/20">
          <div className="flex items-center gap-1">
            {filters.map(filter => (
              <button
                key={filter.value}
                onClick={() => setFilterMode(filter.value)}
                className={cn(
                  'h-7 rounded-md px-2.5 text-[11px] font-medium transition-colors',
                  filterMode === filter.value
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60',
                )}
              >
                {filter.label} <span className="tabular-nums opacity-70">{filter.count}</span>
              </button>
            ))}
          </div>

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

        <div className="overflow-auto max-h-[62vh]">
          <table className="w-full min-w-[980px] text-xs">
            <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
              <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 border-b border-border/60">Loja</th>
                <th className="px-3 py-2 border-b border-border/60">Funcionamento</th>
                <th className="px-3 py-2 border-b border-border/60 text-center">Chamados</th>
                <th className="px-3 py-2 border-b border-border/60">FSA</th>
                <th className="px-3 py-2 border-b border-border/60">Data abertura</th>
                <th className="px-3 py-2 border-b border-border/60">Status</th>
                <th className="px-3 py-2 border-b border-border/60">Cidade/UF</th>
                <th className="px-3 py-2 border-b border-border/60">Problema</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-12 text-center text-sm text-muted-foreground">
                    Nenhuma loja da planilha possui chamado ativo nos filtros atuais.
                  </td>
                </tr>
              ) : rows.flatMap(row => {
                const issueRows = row.issues.length ? row.issues : [null];
                return issueRows.map((issue, index) => (
                  <tr
                    key={`${row.item.id}-${issue?.key ?? 'sem-chamado'}-${index}`}
                    className={cn(
                      'hover:bg-secondary/30',
                      row.issues.length >= 2 && index === 0 && 'bg-violet-500/5',
                    )}
                  >
                    <td className="px-3 py-2 font-semibold tabular-nums">{index === 0 ? row.item.loja : ''}</td>
                    <td className="px-3 py-2">
                      {index === 0 && (
                        <Badge
                          className={cn(
                            'text-[10px]',
                            row.item.closed
                              ? 'bg-red-500/15 text-red-400 border-red-500/30'
                              : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
                          )}
                        >
                          {seasonalHoursLabel(row.item)}
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center tabular-nums">
                      {index === 0 && (
                        <span
                          className={cn(
                            'inline-flex min-w-6 justify-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
                            row.issues.length >= 2
                              ? 'bg-violet-500/15 text-violet-300'
                              : 'bg-secondary text-muted-foreground',
                          )}
                        >
                          {row.issues.length}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-primary">{issue?.key ?? '-'}</td>
                    <td className="px-3 py-2 tabular-nums">{issue ? formatDateTime(issue.created) : '-'}</td>
                    <td className="px-3 py-2">{issue?.status ?? '-'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{issue ? `${issue.cidade || '-'}${issue.uf ? `/${issue.uf}` : ''}` : '-'}</td>
                    <td className="px-3 py-2 max-w-[360px] truncate" title={issue?.problema ?? ''}>{issue?.problema ?? 'Sem chamado ativo cruzado'}</td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
