import { useMemo, useState } from 'react';
import { useDiarioBordo } from '../hooks/use-diario-bordo';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Skeleton } from '../components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '../components/ui/sheet';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../components/ui/select';
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  Filter,
  Plus,
  RefreshCw,
  Store,
  Trash2,
  TrendingUp,
  User,
  X,
} from 'lucide-react';
import { cn } from '../lib/utils';
import type { DiarioEntry, Gravidade } from '../types/diarioBordo';

// ── Helpers ───────────────────────────────────────────────────────────────────

const GRAVIDADE_LABEL: Record<Gravidade, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta:  'Alta',
};

const GRAVIDADE_CLASS: Record<Gravidade, string> = {
  baixa: 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30',
  media: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  alta:  'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
};

function GravBadge({ g }: { g: Gravidade }) {
  return (
    <Badge className={cn('text-[10px] font-semibold border', GRAVIDADE_CLASS[g])}>
      {GRAVIDADE_LABEL[g]}
    </Badge>
  );
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// ── Entry form (inside Sheet) ─────────────────────────────────────────────────

interface EntryFormProps {
  onSave: (fields: {
    data: string;
    tecnico: string;
    loja: string;
    descricaoProblema: string;
    gravidade: Gravidade;
  }) => Promise<void>;
  onClose: () => void;
}

function EntryForm({ onSave, onClose }: EntryFormProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [data,    setData]    = useState(today);
  const [tecnico, setTecnico] = useState('');
  const [loja,    setLoja]    = useState('');
  const [desc,    setDesc]    = useState('');
  const [grav,    setGrav]    = useState<Gravidade>('media');
  const [saving,  setSaving]  = useState(false);

  const valid = tecnico.trim() && loja.trim() && desc.trim();

  const handleSubmit = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      await onSave({ data, tecnico: tecnico.trim(), loja: loja.trim(), descricaoProblema: desc.trim(), gravidade: grav });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-6 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Data</Label>
          <Input type="date" value={data} max={today} onChange={e => setData(e.target.value)} className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Gravidade</Label>
          <Select value={grav} onValueChange={v => setGrav(v as Gravidade)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="baixa">🟢 Baixa</SelectItem>
              <SelectItem value="media">🟡 Média</SelectItem>
              <SelectItem value="alta">🔴 Alta</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Técnico</Label>
        <Input
          placeholder="Nome do técnico…"
          value={tecnico}
          onChange={e => setTecnico(e.target.value)}
          className="h-9"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Loja</Label>
        <Input
          placeholder="Nome ou código da loja…"
          value={loja}
          onChange={e => setLoja(e.target.value)}
          className="h-9"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Descrição do Problema</Label>
        <Textarea
          placeholder="Descreva o que ocorreu no atendimento…"
          value={desc}
          onChange={e => setDesc(e.target.value)}
          rows={5}
          className="resize-none"
        />
      </div>

      <Button
        className="w-full"
        disabled={!valid || saving}
        onClick={handleSubmit}
      >
        {saving ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Salvando…</> : 'Salvar Registro'}
      </Button>
    </div>
  );
}

// ── Recurrence panel ──────────────────────────────────────────────────────────

function RecurrencePanel({
  entries,
  onFilterLoja,
}: {
  entries: DiarioEntry[];
  onFilterLoja: (loja: string) => void;
}) {
  const byLoja = useMemo(() => {
    const m = new Map<string, { count: number; alta: number; last: string }>();
    for (const e of entries) {
      const prev = m.get(e.loja) ?? { count: 0, alta: 0, last: '' };
      m.set(e.loja, {
        count: prev.count + 1,
        alta:  prev.alta + (e.gravidade === 'alta' ? 1 : 0),
        last:  prev.last < e.data ? e.data : prev.last,
      });
    }
    return [...m.entries()]
      .filter(([, v]) => v.count >= 2)
      .sort(([, a], [, b]) => b.count - a.count);
  }, [entries]);

  if (byLoja.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-amber-500 shrink-0" />
        <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
          Lojas com ocorrências recorrentes
        </p>
      </div>
      <div className="space-y-2">
        {byLoja.map(([loja, data]) => (
          <button
            key={loja}
            onClick={() => onFilterLoja(loja)}
            className="w-full flex items-center gap-3 rounded-lg bg-card border border-border px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors text-left"
          >
            <Store className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="flex-1 font-medium truncate">{loja}</span>
            {data.alta > 0 && (
              <Badge className="text-[10px] bg-red-500/15 text-red-500 border-red-500/30 border">
                🔴 {data.alta} alta{data.alta !== 1 ? 's' : ''}
              </Badge>
            )}
            <Badge variant="secondary" className="text-[10px] tabular-nums">
              {data.count}× ocorrências
            </Badge>
            <span className="text-[10px] text-muted-foreground shrink-0">
              Última: {formatDate(data.last)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Entry card ────────────────────────────────────────────────────────────────

function EntryCard({
  entry,
  onDelete,
  currentUid,
}: {
  entry: DiarioEntry;
  onDelete: (id: string) => void;
  currentUid?: string;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <Card className="p-4 bg-card border-border space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <GravBadge g={entry.gravidade} />
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarDays className="w-3 h-3" />
            {formatDate(entry.data)}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <User className="w-3 h-3" />
            {entry.tecnico}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Store className="w-3 h-3" />
            {entry.loja}
          </span>
        </div>
        {currentUid === entry.criadoPor && (
          confirming ? (
            <div className="flex items-center gap-1 shrink-0">
              <Button
                size="sm"
                variant="destructive"
                className="h-7 text-xs px-2"
                onClick={() => onDelete(entry.id)}
              >
                Confirmar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs px-2"
                onClick={() => setConfirming(false)}
              >
                Cancelar
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )
        )}
      </div>

      <p className="text-sm text-foreground leading-relaxed">{entry.descricaoProblema}</p>

      <p className="text-[11px] text-muted-foreground">
        Registrado por {entry.criadoPorEmail}
      </p>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DiarioBordoPage() {
  const { entries, loading, addEntry, removeEntry } = useDiarioBordo();
  const { user } = useAuth();

  const [sheetOpen,    setSheetOpen]    = useState(false);
  const [filterTec,    setFilterTec]    = useState('');
  const [filterLoja,   setFilterLoja]   = useState('');
  const [filterGrav,   setFilterGrav]   = useState<Gravidade | 'todas'>('todas');
  const [filterDataDe, setFilterDataDe] = useState('');
  const [filterDataAte, setFilterDataAte] = useState('');
  const [showFilters,  setShowFilters]  = useState(false);

  // Unique options for selects
  const tecnicos = useMemo(() => [...new Set(entries.map(e => e.tecnico))].sort(), [entries]);
  const lojas    = useMemo(() => [...new Set(entries.map(e => e.loja))].sort(), [entries]);

  // Filtered list
  const filtered = useMemo(() => {
    return entries.filter(e => {
      if (filterTec  && e.tecnico !== filterTec) return false;
      if (filterLoja && !e.loja.toLowerCase().includes(filterLoja.toLowerCase())) return false;
      if (filterGrav !== 'todas' && e.gravidade !== filterGrav) return false;
      if (filterDataDe  && e.data < filterDataDe)  return false;
      if (filterDataAte && e.data > filterDataAte) return false;
      return true;
    });
  }, [entries, filterTec, filterLoja, filterGrav, filterDataDe, filterDataAte]);

  const hasFilters = filterTec || filterLoja || filterGrav !== 'todas' || filterDataDe || filterDataAte;

  const clearFilters = () => {
    setFilterTec('');
    setFilterLoja('');
    setFilterGrav('todas');
    setFilterDataDe('');
    setFilterDataAte('');
  };

  const handleSave = async (fields: Parameters<typeof addEntry>[0] extends infer T ? Omit<T, 'timestamp' | 'criadoPor' | 'criadoPorEmail'> : never) => {
    await addEntry({
      ...fields,
      timestamp:      Date.now(),
      criadoPor:      user?.uid ?? '',
      criadoPorEmail: user?.email ?? 'desconhecido',
    } as Parameters<typeof addEntry>[0]);
  };

  return (
    <div className="space-y-5 pb-10 animate-page-in">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Diário de Bordo</h1>
            <p className="text-sm text-muted-foreground">
              Registro de ocorrências nos atendimentos
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setShowFilters(v => !v)}
          >
            <Filter className="w-3.5 h-3.5" />
            Filtros
            {hasFilters && (
              <Badge className="ml-0.5 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-primary text-primary-foreground">
                !
              </Badge>
            )}
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setSheetOpen(true)}>
            <Plus className="w-4 h-4" />
            Nova Entrada
          </Button>
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <Card className="p-4 space-y-3 border-border">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Técnico</Label>
              <Select value={filterTec || '__all__'} onValueChange={v => setFilterTec(v === '__all__' ? '' : v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {tecnicos.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Loja</Label>
              <Input
                placeholder="Buscar loja…"
                value={filterLoja}
                onChange={e => setFilterLoja(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Gravidade</Label>
              <Select value={filterGrav} onValueChange={v => setFilterGrav(v as Gravidade | 'todas')}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="baixa">🟢 Baixa</SelectItem>
                  <SelectItem value="media">🟡 Média</SelectItem>
                  <SelectItem value="alta">🔴 Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Período</Label>
              <div className="flex items-center gap-1">
                <Input type="date" value={filterDataDe}  onChange={e => setFilterDataDe(e.target.value)}  className="h-8 text-xs" />
                <span className="text-muted-foreground text-xs shrink-0">até</span>
                <Input type="date" value={filterDataAte} onChange={e => setFilterDataAte(e.target.value)} className="h-8 text-xs" />
              </div>
            </div>
          </div>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3 h-3" /> Limpar filtros
            </button>
          )}
        </Card>
      )}

      {/* Stats row */}
      {!loading && entries.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <div className="rounded-lg border border-border bg-card px-4 py-2 flex flex-col">
            <span className="text-2xl font-bold text-primary">{entries.length}</span>
            <span className="text-xs text-muted-foreground">Total de registros</span>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-2 flex flex-col">
            <span className="text-2xl font-bold">{lojas.length}</span>
            <span className="text-xs text-muted-foreground">Lojas envolvidas</span>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-2 flex flex-col">
            <span className="text-2xl font-bold text-red-500">
              {entries.filter(e => e.gravidade === 'alta').length}
            </span>
            <span className="text-xs text-muted-foreground">Gravidade alta</span>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-2 flex flex-col">
            <span className="text-2xl font-bold">{tecnicos.length}</span>
            <span className="text-xs text-muted-foreground">Técnicos</span>
          </div>
        </div>
      )}

      {/* Recurrence panel */}
      {!loading && (
        <RecurrencePanel
          entries={entries}
          onFilterLoja={loja => { setFilterLoja(loja); setShowFilters(true); }}
        />
      )}

      {/* Entry list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          {entries.length === 0 ? (
            <>
              <BookOpen className="w-12 h-12 opacity-25" />
              <p className="text-sm">Nenhuma ocorrência registrada ainda.</p>
              <Button size="sm" variant="outline" onClick={() => setSheetOpen(true)} className="gap-1.5 mt-1">
                <Plus className="w-4 h-4" /> Criar primeiro registro
              </Button>
            </>
          ) : (
            <>
              <AlertTriangle className="w-10 h-10 opacity-25" />
              <p className="text-sm">Nenhum registro encontrado com os filtros aplicados.</p>
              <button onClick={clearFilters} className="text-xs text-primary underline underline-offset-2">
                Limpar filtros
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {hasFilters && (
            <p className="text-xs text-muted-foreground px-1">
              Exibindo {filtered.length} de {entries.length} registro{entries.length !== 1 ? 's' : ''}
            </p>
          )}
          {filtered.map(entry => (
            <EntryCard
              key={entry.id}
              entry={entry}
              onDelete={removeEntry}
              currentUid={user?.uid}
            />
          ))}
        </div>
      )}

      {/* New entry sheet */}
      <Sheet open={sheetOpen} onOpenChange={v => { if (!v) setSheetOpen(false); }}>
        <SheetContent side="right" className="w-full sm:w-[460px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              Nova Entrada
            </SheetTitle>
            <SheetDescription>
              Registre uma ocorrência do atendimento com técnico.
            </SheetDescription>
          </SheetHeader>
          <EntryForm onSave={handleSave} onClose={() => setSheetOpen(false)} />
        </SheetContent>
      </Sheet>

    </div>
  );
}
