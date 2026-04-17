import { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '../components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Separator } from '../components/ui/separator';
import { toast } from 'sonner';
import {
  Plus, Search, Package, TrendingUp, TrendingDown, AlertTriangle,
  Pencil, Trash2, History, ArrowDownToLine, ArrowUpFromLine, RefreshCcw, Wand2,
} from 'lucide-react';
import { ESTOQUE_EXEMPLO } from '../lib/seed-data';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/use-permissions';
import {
  listEstoqueItens, createEstoqueItem, updateEstoqueItem, deleteEstoqueItem,
  registrarMovimento, listMovimentos,
} from '../lib/estoque-firestore';
import type { EstoqueItem, MovimentoEstoque } from '../types/estoque';
import { cn } from '../lib/utils';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTs(ms: number) {
  return new Date(ms).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const UNIDADES = ['un', 'par', 'cx', 'kg', 'g', 'metro', 'cm', 'litro', 'ml'];

// ─── ItemFormDialog ───────────────────────────────────────────────────────────

interface ItemFormState {
  nome: string;
  descricao: string;
  unidade: string;
  quantidadeMinima: string;
}

const ITEM_EMPTY: ItemFormState = { nome: '', descricao: '', unidade: 'un', quantidadeMinima: '0' };

function ItemFormDialog({
  open, onOpenChange, editing, onSaved, userId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: EstoqueItem | null;
  onSaved: () => void;
  userId: string;
}) {
  const [form, setForm] = useState<ItemFormState>(ITEM_EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setForm({
        nome: editing.nome,
        descricao: editing.descricao ?? '',
        unidade: editing.unidade,
        quantidadeMinima: String(editing.quantidadeMinima),
      });
    } else {
      setForm(ITEM_EMPTY);
    }
  }, [editing, open]);

  const set = <K extends keyof ItemFormState>(k: K, v: string) =>
    setForm(f => ({ ...f, [k]: v }));

  const preencherExemplo = () => {
    const ex = ESTOQUE_EXEMPLO[Math.floor(Math.random() * ESTOQUE_EXEMPLO.length)];
    setForm({ nome: ex.nome, descricao: ex.descricao, unidade: ex.unidade, quantidadeMinima: ex.quantidadeMinima });
  };

  const handleSave = async () => {
    if (!form.nome.trim()) { toast.error('Informe o nome do item.'); return; }
    const quantMin = parseFloat(form.quantidadeMinima) || 0;
    setSaving(true);
    try {
      if (editing) {
        await updateEstoqueItem(editing.id, {
          nome: form.nome.trim(),
          descricao: form.descricao.trim() || undefined,
          unidade: form.unidade,
          quantidadeMinima: quantMin,
        });
        toast.success('Item atualizado.');
      } else {
        await createEstoqueItem({
          nome: form.nome.trim(),
          descricao: form.descricao.trim() || undefined,
          unidade: form.unidade,
          quantidadeMinima: quantMin,
          criadoPor: userId,
        });
        toast.success('Item criado.');
      }
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao salvar item.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            {editing ? 'Editar Item' : 'Novo Item de Estoque'}
          </DialogTitle>
          <DialogDescription>
            {editing ? `Editando: ${editing.nome}` : 'Cadastre um novo item para controle de estoque.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="est-nome">Nome <span className="text-destructive">*</span></Label>
            <Input
              id="est-nome"
              placeholder="ex: Fonte ATX 200W"
              value={form.nome}
              onChange={e => set('nome', e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="est-desc">Descrição <span className="text-muted-foreground text-xs">(opcional)</span></Label>
            <Textarea
              id="est-desc"
              placeholder="Detalhes adicionais sobre o item..."
              value={form.descricao}
              onChange={e => set('descricao', e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="est-unidade">Unidade</Label>
              <Select value={form.unidade} onValueChange={v => set('unidade', v)}>
                <SelectTrigger id="est-unidade" aria-label="Unidade">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIDADES.map(u => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="est-qtd-min">Quantidade mínima</Label>
              <Input
                id="est-qtd-min"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={form.quantidadeMinima}
                onChange={e => set('quantidadeMinima', e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          {!editing && (
            <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-muted-foreground sm:mr-auto" onClick={preencherExemplo}>
              <Wand2 className="w-3.5 h-3.5" /> Preencher exemplo
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : editing ? 'Salvar' : 'Criar Item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── MovimentoDialog ──────────────────────────────────────────────────────────

function MovimentoDialog({
  open, onOpenChange, item, tipo, onSaved, userId, userName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item: EstoqueItem | null;
  tipo: 'entrada' | 'saida';
  onSaved: () => void;
  userId: string;
  userName: string;
}) {
  const [quantidade, setQuantidade] = useState('1');
  const [observacao, setObservacao] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setQuantidade('1'); setObservacao(''); }
  }, [open]);

  const handleConfirm = async () => {
    if (!item) return;
    const qtd = parseFloat(quantidade);
    if (!qtd || qtd <= 0) { toast.error('Informe uma quantidade válida.'); return; }

    setSaving(true);
    try {
      await registrarMovimento({
        itemId: item.id,
        tipo,
        quantidade: qtd,
        observacao: observacao.trim() || undefined,
        registradoPor: userId,
        registradoPorNome: userName,
      });
      toast.success(tipo === 'entrada' ? 'Entrada registrada.' : 'Saída registrada.');
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao registrar movimento.');
    } finally {
      setSaving(false);
    }
  };

  if (!item) return null;

  const isEntrada = tipo === 'entrada';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEntrada
              ? <ArrowDownToLine className="w-5 h-5 text-green-600" />
              : <ArrowUpFromLine className="w-5 h-5 text-red-500" />
            }
            {isEntrada ? 'Registrar Entrada' : 'Registrar Saída'}
          </DialogTitle>
          <DialogDescription>
            {item.nome} — Saldo atual: <strong>{item.quantidadeAtual} {item.unidade}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="mov-qtd">Quantidade <span className="text-destructive">*</span></Label>
            <Input
              id="mov-qtd"
              type="number"
              min="0.01"
              step="1"
              value={quantidade}
              onChange={e => setQuantidade(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mov-obs">Observação <span className="text-muted-foreground text-xs">(opcional)</span></Label>
            <Textarea
              id="mov-obs"
              placeholder="ex: Recebimento NF 1234, ou Usado no FSA-0001..."
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
              rows={2}
            />
          </div>

          {!isEntrada && (
            <div className={cn(
              'rounded-lg p-3 text-sm',
              parseFloat(quantidade) > item.quantidadeAtual
                ? 'bg-red-500/10 text-red-700 dark:text-red-400 border border-red-300'
                : 'bg-muted text-muted-foreground',
            )}>
              Saldo após: <strong>
                {Math.max(0, item.quantidadeAtual - (parseFloat(quantidade) || 0)).toFixed(0)} {item.unidade}
              </strong>
              {parseFloat(quantidade) > item.quantidadeAtual && (
                <span className="ml-2 font-semibold">⚠ Estoque insuficiente</span>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={saving}
            className={isEntrada ? 'bg-green-600 hover:bg-green-700 text-white' : ''}
            variant={isEntrada ? 'default' : 'destructive'}
          >
            {saving ? 'Registrando...' : isEntrada ? 'Confirmar Entrada' : 'Confirmar Saída'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── HistoricoDialog ──────────────────────────────────────────────────────────

function HistoricoDialog({
  open, onOpenChange, item,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item: EstoqueItem | null;
}) {
  const [movimentos, setMovimentos] = useState<MovimentoEstoque[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !item) return;
    setLoading(true);
    listMovimentos({ itemId: item.id, limitCount: 50 })
      .then(setMovimentos)
      .catch(() => toast.error('Erro ao carregar histórico.'))
      .finally(() => setLoading(false));
  }, [open, item]);

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Histórico — {item.nome}
          </DialogTitle>
          <DialogDescription>
            Últimos 50 movimentos
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}
          </div>
        ) : movimentos.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum movimento registrado.</p>
        ) : (
          <div className="space-y-2">
            {movimentos.map(m => (
              <div
                key={m.id}
                className={cn(
                  'flex items-start gap-3 rounded-lg border p-3 text-sm',
                  m.tipo === 'entrada'
                    ? 'border-green-200 bg-green-500/5 dark:border-green-800'
                    : 'border-red-200 bg-red-500/5 dark:border-red-800',
                )}
              >
                <div className="mt-0.5 shrink-0">
                  {m.tipo === 'entrada'
                    ? <ArrowDownToLine className="w-4 h-4 text-green-600" />
                    : <ArrowUpFromLine className="w-4 h-4 text-red-500" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn(
                      'font-semibold',
                      m.tipo === 'entrada' ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400',
                    )}>
                      {m.tipo === 'entrada' ? '+' : '-'}{m.quantidade} {item.unidade}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      Saldo: {m.saldoApos}
                    </span>
                  </div>
                  {m.observacao && (
                    <p className="text-muted-foreground truncate">{m.observacao}</p>
                  )}
                  {m.chamadoFsa && (
                    <p className="text-xs text-muted-foreground">FSA: {m.chamadoFsa}</p>
                  )}
                  <p className="text-xs text-muted-foreground/70 mt-0.5">
                    {m.registradoPorNome} · {fmtTs(m.registradoEm)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── ItemCard ─────────────────────────────────────────────────────────────────

function ItemCard({
  item, canManage, onEntrada, onSaida, onEditar, onHistorico, onExcluir,
}: {
  item: EstoqueItem;
  canManage: boolean;
  onEntrada: () => void;
  onSaida: () => void;
  onEditar: () => void;
  onHistorico: () => void;
  onExcluir: () => void;
}) {
  const isCritico  = item.quantidadeAtual === 0;
  const isBaixo    = !isCritico && item.quantidadeMinima > 0 && item.quantidadeAtual <= item.quantidadeMinima;
  const pct        = item.quantidadeMinima > 0
    ? Math.min(100, Math.round((item.quantidadeAtual / (item.quantidadeMinima * 3)) * 100))
    : null;

  return (
    <div className={cn(
      'rounded-xl border bg-card p-4 space-y-3 transition-colors',
      isCritico ? 'border-red-300 dark:border-red-800' : isBaixo ? 'border-amber-300 dark:border-amber-800' : 'border-border hover:border-primary/30',
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm truncate">{item.nome}</span>
            {isCritico && (
              <Badge variant="outline" className="text-[10px] border-red-300 text-red-600 dark:text-red-400 gap-1">
                <AlertTriangle className="w-3 h-3" /> Sem estoque
              </Badge>
            )}
            {isBaixo && (
              <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-600 dark:text-amber-400 gap-1">
                <AlertTriangle className="w-3 h-3" /> Estoque baixo
              </Badge>
            )}
          </div>
          {item.descricao && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{item.descricao}</p>
          )}
        </div>

        <div className="text-right shrink-0">
          <p className={cn(
            'text-xl font-bold leading-none',
            isCritico ? 'text-red-600 dark:text-red-400' : isBaixo ? 'text-amber-600 dark:text-amber-400' : 'text-foreground',
          )}>
            {item.quantidadeAtual}
          </p>
          <p className="text-[10px] text-muted-foreground">{item.unidade}</p>
        </div>
      </div>

      {/* Barra de progresso */}
      {pct !== null && (
        <div className="space-y-1">
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                isCritico ? 'bg-red-500' : isBaixo ? 'bg-amber-500' : 'bg-green-500',
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            Mínimo: {item.quantidadeMinima} {item.unidade}
          </p>
        </div>
      )}

      {/* Ações */}
      <div className="flex gap-1.5 pt-0.5">
        {canManage && (
          <>
            <Button
              size="sm"
              className="flex-1 gap-1 bg-green-600 hover:bg-green-700 text-white h-8 text-xs"
              onClick={onEntrada}
            >
              <ArrowDownToLine className="w-3.5 h-3.5" /> Entrada
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 gap-1 border-red-300 text-red-600 hover:bg-red-500/10 h-8 text-xs"
              onClick={onSaida}
              disabled={isCritico}
            >
              <ArrowUpFromLine className="w-3.5 h-3.5" /> Saída
            </Button>
          </>
        )}
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onHistorico} title="Histórico">
          <History className="w-3.5 h-3.5" />
        </Button>
        {canManage && (
          <>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onEditar} title="Editar">
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={onExcluir}
              title="Excluir"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── EstoquePage ──────────────────────────────────────────────────────────────

export default function EstoquePage() {
  const { user, profile } = useAuth();
  const { permissions } = usePermissions();

  const [itens, setItens] = useState<EstoqueItem[]>([]);
  const [movimentos, setMovimentos] = useState<MovimentoEstoque[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Dialogs
  const [itemFormOpen, setItemFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EstoqueItem | null>(null);

  const [movOpen, setMovOpen] = useState(false);
  const [movItem, setMovItem] = useState<EstoqueItem | null>(null);
  const [movTipo, setMovTipo] = useState<'entrada' | 'saida'>('entrada');

  const [historicoOpen, setHistoricoOpen] = useState(false);
  const [historicoItem, setHistoricoItem] = useState<EstoqueItem | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<EstoqueItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canManage = permissions.canManageEstoque;
  const userName  = profile?.nome || user?.email || 'Usuário';

  async function loadData() {
    setLoading(true);
    try {
      const [its, movs] = await Promise.all([
        listEstoqueItens(),
        listMovimentos({ limitCount: 50 }),
      ]);
      setItens(its);
      setMovimentos(movs);
    } catch {
      toast.error('Erro ao carregar estoque.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const itensFiltrados = useMemo(() => {
    if (!search.trim()) return itens;
    const q = search.toLowerCase();
    return itens.filter(i =>
      i.nome.toLowerCase().includes(q) ||
      i.descricao?.toLowerCase().includes(q),
    );
  }, [itens, search]);

  const stats = useMemo(() => ({
    total:      itens.length,
    semEstoque: itens.filter(i => i.quantidadeAtual === 0).length,
    baixo:      itens.filter(i => i.quantidadeAtual > 0 && i.quantidadeMinima > 0 && i.quantidadeAtual <= i.quantidadeMinima).length,
  }), [itens]);

  function openEntrada(item: EstoqueItem) { setMovItem(item); setMovTipo('entrada'); setMovOpen(true); }
  function openSaida(item: EstoqueItem)   { setMovItem(item); setMovTipo('saida');   setMovOpen(true); }
  function openEditar(item: EstoqueItem)  { setEditingItem(item); setItemFormOpen(true); }
  function openHistorico(item: EstoqueItem) { setHistoricoItem(item); setHistoricoOpen(true); }
  function openExcluir(item: EstoqueItem) { setDeletingItem(item); setDeleteOpen(true); }

  async function handleDelete() {
    if (!deletingItem) return;
    setDeleting(true);
    try {
      await deleteEstoqueItem(deletingItem.id);
      toast.success('Item excluído.');
      setDeleteOpen(false);
      await loadData();
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao excluir item.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6 animate-page-in">
      {/* Header */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-primary via-primary/70 to-primary/30" />
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Package className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Controle de Estoque</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Gerencie peças e materiais em estoque</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
              <RefreshCcw className="w-3.5 h-3.5" />
            </Button>
            {canManage && (
              <Button size="sm" onClick={() => { setEditingItem(null); setItemFormOpen(true); }}>
                <Plus className="w-4 h-4 mr-1.5" /> Novo Item
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Total de itens</p>
          <p className="text-2xl font-bold">{loading ? '—' : stats.total}</p>
        </div>
        <div className={cn(
          'rounded-xl border p-4 space-y-1',
          stats.baixo > 0 ? 'bg-amber-500/10 border-amber-200 dark:border-amber-800' : 'bg-card border-border',
        )}>
          <p className="text-xs text-muted-foreground">Estoque baixo</p>
          <p className={cn('text-2xl font-bold', stats.baixo > 0 && 'text-amber-600 dark:text-amber-400')}>
            {loading ? '—' : stats.baixo}
          </p>
        </div>
        <div className={cn(
          'rounded-xl border p-4 space-y-1',
          stats.semEstoque > 0 ? 'bg-red-500/10 border-red-200 dark:border-red-800' : 'bg-card border-border',
        )}>
          <p className="text-xs text-muted-foreground">Sem estoque</p>
          <p className={cn('text-2xl font-bold', stats.semEstoque > 0 && 'text-red-600 dark:text-red-400')}>
            {loading ? '—' : stats.semEstoque}
          </p>
        </div>
      </div>

      {/* Tabs: Itens / Movimentos */}
      <Tabs defaultValue="itens">
        <TabsList>
          <TabsTrigger value="itens">Itens</TabsTrigger>
          <TabsTrigger value="movimentos">Movimentos recentes</TabsTrigger>
        </TabsList>

        {/* ── Tab Itens ── */}
        <TabsContent value="itens" className="mt-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar item..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
            </div>
          ) : itensFiltrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Package className="w-10 h-10 opacity-30" />
              <p className="text-sm">
                {search ? 'Nenhum item encontrado.' : 'Nenhum item cadastrado ainda.'}
              </p>
              {!search && canManage && (
                <Button size="sm" variant="outline" onClick={() => setItemFormOpen(true)}>
                  <Plus className="w-4 h-4 mr-1.5" /> Criar primeiro item
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {itensFiltrados.map(item => (
                <ItemCard
                  key={item.id}
                  item={item}
                  canManage={canManage}
                  onEntrada={() => openEntrada(item)}
                  onSaida={() => openSaida(item)}
                  onEditar={() => openEditar(item)}
                  onHistorico={() => openHistorico(item)}
                  onExcluir={() => openExcluir(item)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Tab Movimentos ── */}
        <TabsContent value="movimentos" className="mt-4">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
            </div>
          ) : movimentos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <History className="w-10 h-10 opacity-30" />
              <p className="text-sm">Nenhum movimento registrado ainda.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {movimentos.map(m => (
                <div
                  key={m.id}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border p-3',
                    m.tipo === 'entrada'
                      ? 'border-green-200 bg-green-500/5 dark:border-green-800'
                      : 'border-red-200 bg-red-500/5 dark:border-red-800',
                  )}
                >
                  <div className="shrink-0">
                    {m.tipo === 'entrada'
                      ? <TrendingUp className="w-4 h-4 text-green-600" />
                      : <TrendingDown className="w-4 h-4 text-red-500" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.itemNome}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {m.observacao || m.chamadoFsa ? (m.observacao ?? `FSA: ${m.chamadoFsa}`) : m.registradoPorNome}
                      {' · '}{fmtTs(m.registradoEm)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={cn(
                      'text-sm font-bold',
                      m.tipo === 'entrada' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
                    )}>
                      {m.tipo === 'entrada' ? '+' : '-'}{m.quantidade}
                    </p>
                    <p className="text-xs text-muted-foreground">saldo: {m.saldoApos}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <ItemFormDialog
        open={itemFormOpen}
        onOpenChange={setItemFormOpen}
        editing={editingItem}
        onSaved={loadData}
        userId={user?.uid ?? ''}
      />

      <MovimentoDialog
        open={movOpen}
        onOpenChange={setMovOpen}
        item={movItem}
        tipo={movTipo}
        onSaved={loadData}
        userId={user?.uid ?? ''}
        userName={userName}
      />

      <HistoricoDialog
        open={historicoOpen}
        onOpenChange={setHistoricoOpen}
        item={historicoItem}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir item</AlertDialogTitle>
            <AlertDialogDescription>
              Excluir <strong>{deletingItem?.nome}</strong>? Esta ação não pode ser desfeita.
              Itens com movimentos registrados não podem ser excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
