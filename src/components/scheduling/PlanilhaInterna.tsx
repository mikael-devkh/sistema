import { useState, useMemo, useCallback } from 'react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { toast } from 'sonner';
import { updateTecnico } from '../../lib/jiraScheduling';
import type { SchedulingIssue, InternalNote } from '../../types/scheduling';
import { cn } from '../../lib/utils';
import {
  Save,
  Upload,
  Download,
  Filter,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  FileSpreadsheet,
  TableProperties,
  X,
} from 'lucide-react';

// ─── Constantes ───────────────────────────────────────────────────────────────

const LS_KEY = 'wt_scheduling_notes_v1';

const CLASSES = [
  { value: '⚪ Não Classificado', short: 'Não Classif.', row: '', badge: 'bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600' },
  { value: '🟢 Confirmado',        short: 'Confirmado',   row: 'bg-green-50  dark:bg-green-950/20', badge: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700' },
  { value: '🟡 Aguardando Confirmação', short: 'Aguardando', row: 'bg-yellow-50 dark:bg-yellow-950/20', badge: 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-700' },
  { value: '🔴 Sem Técnico',       short: 'Sem Técnico',  row: 'bg-red-50    dark:bg-red-950/20',   badge: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700' },
  { value: '🚨 Crítico',           short: 'Crítico',      row: 'bg-red-100   dark:bg-red-950/30',   badge: 'bg-red-200 text-red-800 border-red-400 dark:bg-red-900/60 dark:text-red-200 dark:border-red-600' },
  { value: '⏳ Esperando Peça',    short: 'Esp. Peça',    row: 'bg-blue-50   dark:bg-blue-950/20',  badge: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700' },
];

function getClassMeta(val: string) {
  return CLASSES.find(c => c.value === val) ?? CLASSES[0];
}

/** Estilo da linha baseado na classificação */
function rowBg(cls: string) {
  return getClassMeta(cls).row;
}

/** Estilo do badge de status Jira */
function statusBadgeStyle(status: string) {
  const s = status.toLowerCase();
  if (s.includes('campo') || s.includes('tec-campo')) return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700';
  if (s.includes('agendado') || s.includes('scheduled')) return 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700';
  if (s.includes('aguard') || s.includes('pend')) return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700';
  if (s.includes('resolv') || s.includes('done') || s.includes('closed') || s.includes('conclu')) return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700';
  return 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600';
}

/** Estilo do badge de SLA */
function slaBadgeStyle(sla: string) {
  if (sla.includes('ESTOURADO') || sla.includes('🔴')) return 'text-red-600 dark:text-red-400';
  if (sla.includes('ALERTA') || sla.includes('🟡')) return 'text-amber-500 dark:text-amber-400';
  return 'text-green-600 dark:text-green-400';
}

// ─── LocalStorage helpers ─────────────────────────────────────────────────────

function loadNotes(): Map<string, InternalNote> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return new Map();
    const arr: InternalNote[] = JSON.parse(raw);
    return new Map(arr.map(n => [n.fsa, n]));
  } catch { return new Map(); }
}

function saveNotes(map: Map<string, InternalNote>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify([...map.values()]));
  } catch {}
}

// ─── Tipos internos ───────────────────────────────────────────────────────────

type SortKey = 'key' | 'loja' | 'cidade' | 'uf' | 'status' | 'classificacao' | 'tecnico' | 'data' | 'slaBadge';
type SortDir = 'asc' | 'desc';

const ALL = '__all__';

// ─── Sub-componentes ──────────────────────────────────────────────────────────

/** Célula transparente — parece célula de planilha */
const cellInput = cn(
  'h-[26px] w-full border-0 bg-transparent shadow-none rounded-sm px-1.5 text-[11px]',
  'placeholder:text-gray-400 dark:placeholder:text-gray-600',
  'hover:bg-black/[0.04] dark:hover:bg-white/[0.04]',
  'focus-visible:bg-white dark:focus-visible:bg-gray-900',
  'focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:outline-none',
  'transition-colors',
);

const cellSelectTrigger = cn(
  'h-[26px] w-full border-0 bg-transparent shadow-none rounded-sm px-1.5 text-[11px]',
  'hover:bg-black/[0.04] dark:hover:bg-white/[0.04]',
  'focus:ring-1 focus:ring-primary/40',
  'transition-colors',
);

/** Ícone de ordenação */
function SortIcon({ active, dir }: { active: boolean; dir?: SortDir }) {
  if (!active) return <ChevronsUpDown className="w-3 h-3 shrink-0 opacity-30" />;
  if (dir === 'asc') return <ChevronUp className="w-3 h-3 shrink-0 text-primary" />;
  return <ChevronDown className="w-3 h-3 shrink-0 text-primary" />;
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface Props { issues: SchedulingIssue[] }

export function PlanilhaInterna({ issues }: Props) {
  // ── Estado ──
  const [notes, setNotes] = useState<Map<string, InternalNote>>(loadNotes);
  const [edited, setEdited] = useState<Map<string, Partial<InternalNote>>>(new Map());
  const [savingJira, setSavingJira] = useState(false);

  // Filtros
  const [filterText, setFilterText] = useState('');
  const [filterClass, setFilterClass] = useState(ALL);
  const [filterStatus, setFilterStatus] = useState(ALL);

  // Ordenação
  const [sortKey, setSortKey] = useState<SortKey | null>('loja');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // ── Dados derivados ──
  const statuses = useMemo(
    () => [...new Set(issues.map(i => i.status))].sort(),
    [issues],
  );

  const rows = useMemo(() => {
    let list = issues.map(issue => {
      const note = notes.get(issue.key) ?? {
        fsa: issue.key,
        classificacao: '⚪ Não Classificado',
        tecnico: issue.tecnico || '',
        data: '',
        obs: '',
        escalonado: false,
      };
      return { issue, note: { ...note } };
    });

    // Filtro de texto (FSA, loja, cidade, técnico)
    if (filterText.trim()) {
      const q = filterText.toLowerCase();
      list = list.filter(r =>
        r.issue.key.toLowerCase().includes(q) ||
        r.issue.loja.toLowerCase().includes(q) ||
        r.issue.cidade.toLowerCase().includes(q) ||
        r.note.tecnico.toLowerCase().includes(q),
      );
    }

    // Filtro de classificação
    if (filterClass !== ALL) {
      list = list.filter(r => r.note.classificacao === filterClass);
    }

    // Filtro de status
    if (filterStatus !== ALL) {
      list = list.filter(r => r.issue.status === filterStatus);
    }

    // Ordenação
    if (sortKey) {
      list.sort((a, b) => {
        let av = '', bv = '';
        switch (sortKey) {
          case 'classificacao': av = a.note.classificacao; bv = b.note.classificacao; break;
          case 'tecnico':       av = a.note.tecnico;       bv = b.note.tecnico;       break;
          case 'data':          av = a.note.data;          bv = b.note.data;          break;
          default:
            av = String((a.issue as Record<string, unknown>)[sortKey] ?? '');
            bv = String((b.issue as Record<string, unknown>)[sortKey] ?? '');
        }
        const cmp = av.localeCompare(bv, 'pt-BR', { sensitivity: 'base' });
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return list;
  }, [issues, notes, filterText, filterClass, filterStatus, sortKey, sortDir]);

  // ── Sumário ──
  const summary = useMemo(() => ({
    total:       rows.length,
    confirmados: rows.filter(r => r.note.classificacao.includes('Confirmado')).length,
    semTec:      rows.filter(r => r.note.classificacao.includes('Sem Técnico')).length,
    criticos:    rows.filter(r => r.note.classificacao.includes('Crítico')).length,
    escalonados: rows.filter(r => r.note.escalonado).length,
  }), [rows]);

  // ── Handlers ──
  const updateNote = useCallback(
    (fsa: string, field: keyof InternalNote, value: string | boolean) => {
      setNotes(prev => {
        const cur = prev.get(fsa) ?? { fsa, classificacao: '⚪ Não Classificado', tecnico: '', data: '', obs: '', escalonado: false };
        const next = { ...cur, [field]: value };
        return new Map(prev).set(fsa, next);
      });
      setEdited(prev => {
        const cur = prev.get(fsa) ?? {};
        return new Map(prev).set(fsa, { ...cur, [field]: value });
      });
    },
    [],
  );

  const handleSave = () => {
    saveNotes(notes);
    toast.success('Planilha salva no navegador!');
    setEdited(new Map());
  };

  const handleSendToJira = async () => {
    setSavingJira(true);
    let changed = 0;
    const errors: string[] = [];
    for (const [fsa, changes] of edited.entries()) {
      if (!changes.tecnico) continue;
      const orig = issues.find(i => i.key === fsa);
      if (!orig || changes.tecnico === orig.tecnico) continue;
      try {
        const ok = await updateTecnico(fsa, changes.tecnico);
        if (ok) changed++;
        else errors.push(`${fsa}: falha`);
      } catch (e: unknown) {
        errors.push(`${fsa}: ${(e as Error)?.message ?? 'erro'}`);
      }
    }
    setSavingJira(false);
    saveNotes(notes);
    if (errors.length) toast.error(errors.join('\n'));
    if (changed) toast.success(`${changed} técnico(s) enviado(s) ao Jira!`);
    setEdited(new Map());
  };

  const handleExportCsv = () => {
    const header = 'FSA,Loja,Cidade,UF,Status,SLA,Classificação,Técnico,Data Visita,Observação,Escalonado\n';
    const body = rows
      .map(({ issue, note }) =>
        [
          issue.key, issue.loja, issue.cidade, issue.uf,
          issue.status, issue.slaBadge,
          note.classificacao, note.tecnico, note.data, note.obs, note.escalonado,
        ]
          .map(v => `"${String(v ?? '').replace(/"/g, '""')}"`)
          .join(','),
      )
      .join('\n');

    const blob = new Blob(['\ufeff' + header + body], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `agendamentos_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const hasFilters = filterText.trim() || filterClass !== ALL || filterStatus !== ALL;

  const clearFilters = () => {
    setFilterText('');
    setFilterClass(ALL);
    setFilterStatus(ALL);
  };

  // ── Cabeçalho de coluna ordenável ──
  function ColHeader({
    colKey,
    children,
    className,
    align = 'left',
  }: {
    colKey: SortKey;
    children: React.ReactNode;
    className?: string;
    align?: 'left' | 'center';
  }) {
    const active = sortKey === colKey;
    return (
      <th
        onClick={() => handleSort(colKey)}
        className={cn(
          'relative border-r border-b px-2 py-[7px] whitespace-nowrap',
          'border-[#c6c7c8] dark:border-gray-700',
          'bg-[#e9eaeb] dark:bg-gray-800/90',
          'text-[11px] font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide',
          'select-none cursor-pointer transition-colors',
          'hover:bg-[#d9dadb] dark:hover:bg-gray-700/80',
          active && 'bg-[#cfe0ff] dark:bg-primary/20 text-primary dark:text-primary',
          align === 'center' && 'text-center',
          className,
        )}
      >
        <div className={cn('flex items-center gap-1', align === 'center' && 'justify-center')}>
          {children}
          <SortIcon active={active} dir={active ? sortDir : undefined} />
        </div>
        {/* Resize handle (visual) */}
        <span className="absolute right-0 top-1 bottom-1 w-[3px] cursor-col-resize hover:bg-primary/60 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity" />
      </th>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col rounded-xl overflow-hidden border"
      style={{ border: '1px solid #c6c7c8' }}
    >

      {/* ─── Toolbar (barra de ferramentas estilo Excel) ─────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-[#f0f1f2] dark:bg-gray-900/60 border-b border-[#c6c7c8] dark:border-gray-700">
        {/* Título */}
        <div className="flex items-center gap-1.5 shrink-0">
          <FileSpreadsheet className="w-4 h-4 text-green-600 dark:text-green-500" />
          <span className="text-xs font-bold text-gray-700 dark:text-gray-200">Planilha de Agendamentos</span>
        </div>

        <div className="h-4 w-px bg-gray-300 dark:bg-gray-600 mx-1" />

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="relative">
            <Filter className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
            <Input
              placeholder="Buscar FSA, loja, cidade…"
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
              className="h-7 pl-7 pr-2 w-48 text-xs bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 focus-visible:ring-primary/40"
            />
          </div>

          <Select value={filterClass} onValueChange={setFilterClass}>
            <SelectTrigger className="h-7 w-40 text-xs bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600">
              <SelectValue placeholder="Classificação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL} className="text-xs font-medium">Todas as classes</SelectItem>
              {CLASSES.map(c => (
                <SelectItem key={c.value} value={c.value} className="text-xs">{c.value}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-7 w-36 text-xs bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600">
              <SelectValue placeholder="Status Jira" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL} className="text-xs font-medium">Todos os status</SelectItem>
              {statuses.map(s => (
                <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 font-medium transition-colors"
            >
              <X className="w-3 h-3" /> Limpar
            </button>
          )}
        </div>

        <div className="flex-1" />

        {/* Ações */}
        <div className="flex items-center gap-1.5 shrink-0">
          {edited.size > 0 && (
            <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-md px-2 py-0.5">
              {edited.size} não salvo{edited.size > 1 ? 's' : ''}
            </span>
          )}
          <Button size="sm" className="h-7 gap-1.5 text-xs px-2.5" onClick={handleSave}>
            <Save className="w-3 h-3" />
            Salvar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs px-2.5 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600"
            onClick={handleSendToJira}
            disabled={savingJira || edited.size === 0}
          >
            <Upload className="w-3 h-3" />
            {savingJira ? 'Enviando…' : 'Enviar Jira'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 text-xs px-2.5"
            onClick={handleExportCsv}
          >
            <Download className="w-3 h-3" />
            CSV
          </Button>
        </div>
      </div>

      {/* ─── Tabela ──────────────────────────────────────────────────────────── */}
      <div
        className="overflow-auto bg-white dark:bg-gray-950"
        style={{ maxHeight: '60vh' }}
      >
        <table
          className="border-collapse"
          style={{ minWidth: '1020px', width: '100%' }}
        >
          {/* ── Cabeçalho fixo ── */}
          <thead className="sticky top-0 z-10 group">
            <tr>
              {/* # (número da linha) */}
              <th
                className="border-r border-b px-2 py-[7px] text-center text-[11px] font-bold text-gray-400 dark:text-gray-500 select-none w-8"
                style={{ borderColor: '#c6c7c8', background: '#e9eaeb' }}
              >
                #
              </th>

              <ColHeader colKey="key"            className="w-[90px]">FSA</ColHeader>
              <ColHeader colKey="loja"           className="w-[80px]">Loja</ColHeader>
              <ColHeader colKey="cidade"         className="w-[130px]">Cidade</ColHeader>
              <ColHeader colKey="uf"             className="w-[50px]" align="center">UF</ColHeader>
              <ColHeader colKey="status"         className="w-[130px]">Status Jira</ColHeader>
              <ColHeader colKey="slaBadge"       className="w-[90px]"  align="center">SLA</ColHeader>
              <ColHeader colKey="classificacao"  className="w-[170px]">Classificação</ColHeader>
              <ColHeader colKey="tecnico"        className="w-[130px]">Técnico</ColHeader>
              <ColHeader colKey="data"           className="w-[115px]">Data Visita</ColHeader>

              {/* Obs — não ordenável */}
              <th
                className="border-r border-b px-2 py-[7px] text-left text-[11px] font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide whitespace-nowrap select-none"
                style={{ borderColor: '#c6c7c8', background: '#e9eaeb', minWidth: '150px' }}
              >
                Observação
              </th>

              {/* Escal. — não ordenável */}
              <th
                className="border-b px-2 py-[7px] text-center text-[11px] font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide whitespace-nowrap select-none w-[60px]"
                style={{ borderColor: '#c6c7c8', background: '#e9eaeb' }}
              >
                Escal.
              </th>
            </tr>
          </thead>

          {/* ── Corpo ── */}
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={12}
                  className="py-16 text-center border-b"
                  style={{ borderColor: '#e2e3e4' }}
                >
                  <div className="flex flex-col items-center gap-2 text-gray-400 dark:text-gray-600">
                    <TableProperties className="w-9 h-9 opacity-40" />
                    <p className="text-sm font-medium">Nenhum chamado encontrado</p>
                    {hasFilters && (
                      <button
                        onClick={clearFilters}
                        className="text-xs text-primary hover:underline mt-1"
                      >
                        Remover filtros
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              rows.map(({ issue, note }, idx) => {
                const isEdited = edited.has(issue.key);
                const classMeta = getClassMeta(note.classificacao);
                const CELL = 'border-r border-b px-2 py-0.5 text-[11px] align-middle';
                const CELL_COLOR = 'border-[#e2e3e4] dark:border-gray-700/70';

                return (
                  <tr
                    key={issue.key}
                    className={cn(
                      'group/row transition-colors',
                      classMeta.row || 'hover:bg-gray-50 dark:hover:bg-gray-800/40',
                      isEdited && 'outline outline-1 outline-primary/20 outline-offset-[-1px]',
                    )}
                  >
                    {/* Número da linha */}
                    <td
                      className={cn(CELL, CELL_COLOR, 'text-center text-[10px] text-gray-400 dark:text-gray-600 font-mono select-none w-8')}
                      style={{ background: 'rgba(233,234,235,0.45)' }}
                    >
                      {idx + 1}
                    </td>

                    {/* FSA */}
                    <td className={cn(CELL, CELL_COLOR, 'w-[90px]')}>
                      <div className="flex items-center gap-1">
                        <span className="font-mono font-semibold text-primary dark:text-primary/90 text-[11px]">
                          {issue.key}
                        </span>
                        {isEdited && (
                          <span
                            className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"
                            title="Alterações não salvas"
                          />
                        )}
                      </div>
                    </td>

                    {/* Loja */}
                    <td className={cn(CELL, CELL_COLOR, 'font-semibold whitespace-nowrap w-[80px]')}>
                      {issue.loja}
                    </td>

                    {/* Cidade */}
                    <td className={cn(CELL, CELL_COLOR, 'text-gray-600 dark:text-gray-400 whitespace-nowrap w-[130px]')}>
                      {issue.cidade}
                    </td>

                    {/* UF */}
                    <td className={cn(CELL, CELL_COLOR, 'text-center text-gray-500 dark:text-gray-500 w-[50px]')}>
                      {issue.uf}
                    </td>

                    {/* Status Jira */}
                    <td className={cn(CELL, CELL_COLOR, 'w-[130px]')}>
                      <span
                        className={cn(
                          'inline-flex items-center rounded-sm px-1.5 py-[2px] text-[10px] font-semibold border whitespace-nowrap',
                          statusBadgeStyle(issue.status),
                        )}
                      >
                        {issue.status}
                      </span>
                    </td>

                    {/* SLA */}
                    <td className={cn(CELL, CELL_COLOR, 'text-center w-[90px]')}>
                      <span
                        className={cn(
                          'text-[11px] font-semibold whitespace-nowrap',
                          slaBadgeStyle(issue.slaBadge || ''),
                        )}
                        title={issue.slaBadge || 'OK'}
                      >
                        {issue.slaBadge || '🟢 OK'}
                      </span>
                    </td>

                    {/* Classificação — native select para não montar ~N portais Radix */}
                    <td className={cn(CELL, CELL_COLOR, 'w-[170px] p-0')}>
                      <select
                        value={note.classificacao}
                        onChange={e => updateNote(issue.key, 'classificacao', e.target.value)}
                        className={cn(
                          'h-[26px] w-full border-0 bg-transparent shadow-none rounded-sm px-1.5 text-[11px]',
                          'hover:bg-black/[0.04] dark:hover:bg-white/[0.04]',
                          'focus:ring-1 focus:ring-primary/40 focus:outline-none',
                          'cursor-pointer transition-colors appearance-none',
                          'dark:text-gray-200',
                        )}
                      >
                        {CLASSES.map(c => (
                          <option key={c.value} value={c.value}>{c.short}</option>
                        ))}
                      </select>
                    </td>

                    {/* Técnico */}
                    <td className={cn(CELL, CELL_COLOR, 'w-[130px] p-0')}>
                      <Input
                        className={cellInput}
                        value={note.tecnico}
                        onChange={e => updateNote(issue.key, 'tecnico', e.target.value)}
                        placeholder="—"
                      />
                    </td>

                    {/* Data Visita */}
                    <td className={cn(CELL, CELL_COLOR, 'w-[115px] p-0')}>
                      <Input
                        type="date"
                        className={cellInput}
                        value={note.data}
                        onChange={e => updateNote(issue.key, 'data', e.target.value)}
                      />
                    </td>

                    {/* Observação */}
                    <td className={cn(CELL, CELL_COLOR, 'p-0')} style={{ minWidth: '150px' }}>
                      <Input
                        className={cellInput}
                        value={note.obs}
                        onChange={e => updateNote(issue.key, 'obs', e.target.value)}
                        placeholder="Observação…"
                      />
                    </td>

                    {/* Escalonado */}
                    <td
                      className={cn('border-b px-2 py-0.5 text-center align-middle w-[60px]')}
                      style={{ borderColor: '#e2e3e4' }}
                    >
                      <Checkbox
                        checked={note.escalonado}
                        onCheckedChange={v => updateNote(issue.key, 'escalonado', Boolean(v))}
                        className="w-[14px] h-[14px]"
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ─── Status bar (barra de status estilo Excel) ───────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-3 py-[5px] bg-[#f0f1f2] dark:bg-gray-900/60 border-t border-[#c6c7c8] dark:border-gray-700 text-[10.5px] text-gray-500 dark:text-gray-400 select-none">
        <span>
          Exibindo{' '}
          <span className="font-semibold text-gray-700 dark:text-gray-200">{summary.total}</span>
          {' '}de{' '}
          <span className="font-semibold text-gray-700 dark:text-gray-200">{issues.length}</span>
          {' '}chamados
          {hasFilters && <span className="text-primary font-medium ml-1">(filtrado)</span>}
        </span>

        <span className="h-3 w-px bg-gray-300 dark:bg-gray-600" />

        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
          <span className="font-semibold text-gray-700 dark:text-gray-200">{summary.confirmados}</span> confirmados
        </span>

        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
          <span className="font-semibold text-gray-700 dark:text-gray-200">{summary.semTec}</span> sem técnico
        </span>

        {summary.criticos > 0 && (
          <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-semibold">
            🚨 {summary.criticos} crítico{summary.criticos > 1 ? 's' : ''}
          </span>
        )}

        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-primary inline-block" />
          <span className="font-semibold text-gray-700 dark:text-gray-200">{summary.escalonados}</span> escalonados
        </span>

        <span className="ml-auto text-[10px] text-gray-400 dark:text-gray-500 hidden sm:block">
          Dados salvos no navegador · Técnicos sincronizados via Jira
        </span>
      </div>
    </div>
  );
}
