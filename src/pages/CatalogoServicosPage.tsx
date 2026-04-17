import { useEffect, useState } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { Switch } from '../components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  Plus,
  Pencil,
  Trash2,
  BookMarked,
  Building2,
  Search,
  ChevronRight,
  DollarSign,
  Wrench,
  Info,
  Wand2,
} from 'lucide-react';
import {
  listClientes,
  createCliente,
  updateCliente,
  deleteCliente,
  listCatalogoServicos,
  createCatalogoServico,
  updateCatalogoServico,
  deleteCatalogoServico,
} from '../lib/catalogo-firestore';
import type { Cliente, CatalogoServico } from '../types/catalogo';
import { cn } from '../lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';

// ─── Formatação ──────────────────────────────────────────────────────────────

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ─── Formulário de Cliente ────────────────────────────────────────────────────

interface ClienteFormState {
  nome: string;
  ativo: boolean;
}

const CLIENTE_EMPTY: ClienteFormState = { nome: '', ativo: true };

const CLIENTES_EXEMPLO = [
  'Banco do Brasil',
  'Bradesco',
  'Itaú Unibanco',
  'Caixa Econômica Federal',
  'Santander',
  'Nubank',
  'Claro',
  'Vivo',
  'TIM',
  'Magazine Luiza',
  'Americanas',
  'Casas Bahia',
];

function ClienteDialog({
  open,
  onOpenChange,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Cliente | null;
  onSave: (data: ClienteFormState) => Promise<void>;
}) {
  const [form, setForm] = useState<ClienteFormState>(CLIENTE_EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(initial ? { nome: initial.nome, ativo: initial.ativo } : CLIENTE_EMPTY);
  }, [initial, open]);

  const handleSave = async () => {
    if (!form.nome.trim()) { toast.error('Informe o nome do cliente.'); return; }
    setSaving(true);
    try {
      await onSave(form);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const preencherExemplo = () => {
    const nome = CLIENTES_EXEMPLO[Math.floor(Math.random() * CLIENTES_EXEMPLO.length)];
    setForm({ nome, ativo: true });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
          <DialogDescription>Clientes representam contratos/empresas contratantes.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="cliente-nome">Nome *</Label>
            <Input
              id="cliente-nome"
              placeholder="Ex: Banco XYZ"
              value={form.nome}
              onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="cliente-ativo">Ativo</Label>
            <Switch
              id="cliente-ativo"
              checked={form.ativo}
              onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))}
            />
          </div>
        </div>
        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={preencherExemplo} type="button">
            <Wand2 className="w-3.5 h-3.5" /> Preencher exemplo
          </Button>
          <div className="flex gap-2 sm:ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Formulário de Serviço ────────────────────────────────────────────────────

interface ServicoFormState {
  clienteId: string;
  nome: string;
  valorReceita: string;
  valorAdicionalReceita: string;
  valorHoraAdicionalReceita: string;
  valorCustoTecnico: string;
  valorAdicionalCusto: string;
  valorHoraAdicionalCusto: string;
  exigePeca: boolean;
  pagaTecnico: boolean;
  pagamentoIntegral: boolean;
  isRetorno: boolean;
  horasFranquia: string;
}

interface ExemploServico {
  nome: string;
  valorReceita: string;
  valorAdicionalReceita: string;
  valorHoraAdicionalReceita: string;
  valorCustoTecnico: string;
  valorAdicionalCusto: string;
  valorHoraAdicionalCusto: string;
  exigePeca: boolean;
  pagaTecnico: boolean;
  pagamentoIntegral: boolean;
  isRetorno: boolean;
  horasFranquia: string;
}

const SERVICOS_EXEMPLO: ExemploServico[] = [
  {
    nome: 'Manutenção Preventiva PDV',
    valorReceita: '350.00', valorAdicionalReceita: '180.00', valorHoraAdicionalReceita: '45.00',
    valorCustoTecnico: '150.00', valorAdicionalCusto: '80.00', valorHoraAdicionalCusto: '25.00',
    exigePeca: false, pagaTecnico: true, pagamentoIntegral: false, isRetorno: false, horasFranquia: '2',
  },
  {
    nome: 'Troca de Impressora Fiscal',
    valorReceita: '420.00', valorAdicionalReceita: '210.00', valorHoraAdicionalReceita: '55.00',
    valorCustoTecnico: '180.00', valorAdicionalCusto: '90.00', valorHoraAdicionalCusto: '30.00',
    exigePeca: true, pagaTecnico: true, pagamentoIntegral: false, isRetorno: false, horasFranquia: '2',
  },
  {
    nome: 'Instalação de Terminal POS',
    valorReceita: '280.00', valorAdicionalReceita: '140.00', valorHoraAdicionalReceita: '40.00',
    valorCustoTecnico: '120.00', valorAdicionalCusto: '60.00', valorHoraAdicionalCusto: '20.00',
    exigePeca: false, pagaTecnico: true, pagamentoIntegral: false, isRetorno: false, horasFranquia: '2',
  },
  {
    nome: 'Substituição de Fonte PDV',
    valorReceita: '390.00', valorAdicionalReceita: '195.00', valorHoraAdicionalReceita: '50.00',
    valorCustoTecnico: '160.00', valorAdicionalCusto: '80.00', valorHoraAdicionalCusto: '28.00',
    exigePeca: true, pagaTecnico: true, pagamentoIntegral: false, isRetorno: false, horasFranquia: '2',
  },
  {
    nome: 'Retorno / Revisão (SPARE)',
    valorReceita: '200.00', valorAdicionalReceita: '0.00', valorHoraAdicionalReceita: '0.00',
    valorCustoTecnico: '80.00', valorAdicionalCusto: '0.00', valorHoraAdicionalCusto: '0.00',
    exigePeca: false, pagaTecnico: true, pagamentoIntegral: true, isRetorno: true, horasFranquia: '1',
  },
  {
    nome: 'Visita de Falha (Sem Repasse)',
    valorReceita: '150.00', valorAdicionalReceita: '0.00', valorHoraAdicionalReceita: '0.00',
    valorCustoTecnico: '0.00', valorAdicionalCusto: '0.00', valorHoraAdicionalCusto: '0.00',
    exigePeca: false, pagaTecnico: false, pagamentoIntegral: false, isRetorno: false, horasFranquia: '2',
  },
  {
    nome: 'Configuração de Rede / Switch',
    valorReceita: '310.00', valorAdicionalReceita: '155.00', valorHoraAdicionalReceita: '42.00',
    valorCustoTecnico: '130.00', valorAdicionalCusto: '65.00', valorHoraAdicionalCusto: '22.00',
    exigePeca: false, pagaTecnico: true, pagamentoIntegral: false, isRetorno: false, horasFranquia: '3',
  },
  {
    nome: 'Troca de HD / SSD',
    valorReceita: '450.00', valorAdicionalReceita: '225.00', valorHoraAdicionalReceita: '60.00',
    valorCustoTecnico: '190.00', valorAdicionalCusto: '95.00', valorHoraAdicionalCusto: '32.00',
    exigePeca: true, pagaTecnico: true, pagamentoIntegral: false, isRetorno: false, horasFranquia: '2',
  },
];

const SERVICO_EMPTY: ServicoFormState = {
  clienteId: '',
  nome: '',
  valorReceita: '',
  valorAdicionalReceita: '',
  valorHoraAdicionalReceita: '',
  valorCustoTecnico: '',
  valorAdicionalCusto: '',
  valorHoraAdicionalCusto: '',
  exigePeca: false,
  pagaTecnico: true,
  pagamentoIntegral: false,
  isRetorno: false,
  horasFranquia: '2',
};

function servicoToForm(s: CatalogoServico): ServicoFormState {
  return {
    clienteId: s.clienteId,
    nome: s.nome,
    valorReceita: String(s.valorReceita),
    valorAdicionalReceita: String(s.valorAdicionalReceita),
    valorHoraAdicionalReceita: String(s.valorHoraAdicionalReceita),
    valorCustoTecnico: String(s.valorCustoTecnico),
    valorAdicionalCusto: String(s.valorAdicionalCusto),
    valorHoraAdicionalCusto: String(s.valorHoraAdicionalCusto),
    exigePeca: s.exigePeca,
    pagaTecnico: s.pagaTecnico,
    pagamentoIntegral: s.pagamentoIntegral,
    isRetorno: s.isRetorno,
    horasFranquia: String(s.horasFranquia),
  };
}

function formToServico(
  form: ServicoFormState,
  clientes: Cliente[],
): Omit<CatalogoServico, 'id' | 'criadoEm' | 'atualizadoEm'> {
  const clienteNome = clientes.find(c => c.id === form.clienteId)?.nome ?? '';
  return {
    clienteId: form.clienteId,
    clienteNome,
    nome: form.nome.trim(),
    valorReceita: parseFloat(form.valorReceita) || 0,
    valorAdicionalReceita: parseFloat(form.valorAdicionalReceita) || 0,
    valorHoraAdicionalReceita: parseFloat(form.valorHoraAdicionalReceita) || 0,
    valorCustoTecnico: parseFloat(form.valorCustoTecnico) || 0,
    valorAdicionalCusto: parseFloat(form.valorAdicionalCusto) || 0,
    valorHoraAdicionalCusto: parseFloat(form.valorHoraAdicionalCusto) || 0,
    exigePeca: form.exigePeca,
    pagaTecnico: form.pagaTecnico,
    pagamentoIntegral: form.pagamentoIntegral,
    isRetorno: form.isRetorno,
    horasFranquia: parseInt(form.horasFranquia) || 2,
  };
}

function MoneyInput({
  id, label, value, onChange, hint,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void; hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id}>{label}</Label>
        {hint && (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <span className="inline-flex cursor-help text-muted-foreground">
                <Info className="w-3.5 h-3.5" />
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">{hint}</TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
        <Input
          id={id}
          type="number"
          min="0"
          step="0.01"
          placeholder="0,00"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="pl-8"
        />
      </div>
    </div>
  );
}

function ServicoDialog({
  open,
  onOpenChange,
  initial,
  clientes,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: CatalogoServico | null;
  clientes: Cliente[];
  onSave: (data: Omit<CatalogoServico, 'id' | 'criadoEm' | 'atualizadoEm'>) => Promise<void>;
}) {
  const [form, setForm] = useState<ServicoFormState>(SERVICO_EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(initial ? servicoToForm(initial) : SERVICO_EMPTY);
  }, [initial, open]);

  const set = <K extends keyof ServicoFormState>(k: K, v: ServicoFormState[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.clienteId) { toast.error('Selecione um cliente.'); return; }
    if (!form.nome.trim()) { toast.error('Informe o nome do serviço.'); return; }
    setSaving(true);
    try {
      await onSave(formToServico(form, clientes));
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const preencherExemplo = () => {
    const ex = SERVICOS_EXEMPLO[Math.floor(Math.random() * SERVICOS_EXEMPLO.length)];
    // mantém o cliente já selecionado (ou usa o primeiro ativo disponível)
    const clienteId = form.clienteId || clientes.find(c => c.ativo)?.id || '';
    setForm(f => ({ ...f, ...ex, clienteId }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? 'Editar Tipo de Serviço' : 'Novo Tipo de Serviço'}</DialogTitle>
          <DialogDescription>
            Configure os valores de receita, custo e as regras de negócio para este serviço.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Identificação */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Cliente *</Label>
              <Select value={form.clienteId} onValueChange={v => set('clienteId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.filter(c => c.ativo).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="servico-nome">Nome do Serviço *</Label>
              <Input
                id="servico-nome"
                placeholder="Ex: Manutenção Preventiva"
                value={form.nome}
                onChange={e => set('nome', e.target.value)}
              />
            </div>
          </div>

          {/* Receita */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <p className="text-sm font-semibold flex items-center gap-2 text-green-600 dark:text-green-400">
              <DollarSign className="w-4 h-4" /> Receita (empresa)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <MoneyInput
                id="rec-base" label="Valor Base"
                value={form.valorReceita} onChange={v => set('valorReceita', v)}
                hint="Valor cobrado pelo 1º chamado no lote"
              />
              <MoneyInput
                id="rec-adicional" label="Valor Adicional"
                value={form.valorAdicionalReceita} onChange={v => set('valorAdicionalReceita', v)}
                hint="Valor cobrado por chamados subsequentes no mesmo lote"
              />
              <MoneyInput
                id="rec-hora" label="Hora Adicional"
                value={form.valorHoraAdicionalReceita} onChange={v => set('valorHoraAdicionalReceita', v)}
                hint="Valor por hora excedente à franquia"
              />
            </div>
          </div>

          {/* Custo técnico */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <p className="text-sm font-semibold flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <Wrench className="w-4 h-4" /> Custo do Técnico
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <MoneyInput
                id="cus-base" label="Valor Base"
                value={form.valorCustoTecnico} onChange={v => set('valorCustoTecnico', v)}
                hint="Repasse ao técnico pelo 1º chamado"
              />
              <MoneyInput
                id="cus-adicional" label="Valor Adicional"
                value={form.valorAdicionalCusto} onChange={v => set('valorAdicionalCusto', v)}
                hint="Repasse por chamados subsequentes no lote"
              />
              <MoneyInput
                id="cus-hora" label="Hora Adicional"
                value={form.valorHoraAdicionalCusto} onChange={v => set('valorHoraAdicionalCusto', v)}
                hint="Repasse por hora excedente à franquia"
              />
            </div>
          </div>

          {/* Regras */}
          <div className="rounded-lg border border-border p-4 space-y-4">
            <p className="text-sm font-semibold">Regras de Negócio</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="franquia">Horas Franquia</Label>
                <Input
                  id="franquia"
                  type="number"
                  min="0"
                  value={form.horasFranquia}
                  onChange={e => set('horasFranquia', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Horas incluídas no valor base antes de cobrar hora extra</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'exigePeca' as const,        label: 'Exige Peça',          hint: 'Obrigatório informar peça usada' },
                { key: 'pagaTecnico' as const,       label: 'Paga Técnico',        hint: 'Falso p/ chamados de "Falha" (sem repasse)' },
                { key: 'pagamentoIntegral' as const, label: 'Pagamento Integral',  hint: 'Sempre valor cheio, ignora lógica de lote (ex: retorno SPARE)' },
                { key: 'isRetorno' as const,         label: 'É Retorno',           hint: 'Chamado de retorno ao mesmo local' },
              ].map(({ key, label, hint }) => (
                <div
                  key={key}
                  className={cn(
                    'flex items-center justify-between rounded-lg border p-3',
                    form[key] ? 'border-primary/30 bg-primary/5' : 'border-border',
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium">{label}</span>
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <span className="inline-flex cursor-help text-muted-foreground">
                          <Info className="w-3.5 h-3.5" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[200px]">{hint}</TooltipContent>
                    </Tooltip>
                  </div>
                  <Switch
                    checked={form[key] as boolean}
                    onCheckedChange={v => set(key, v)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={preencherExemplo} type="button">
            <Wand2 className="w-3.5 h-3.5" /> Preencher exemplo
          </Button>
          <div className="flex gap-2 sm:ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function CatalogoServicosPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [servicos, setServicos] = useState<CatalogoServico[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(true);
  const [loadingServicos, setLoadingServicos] = useState(true);

  // Filtros
  const [searchCliente, setSearchCliente] = useState('');
  const [searchServico, setSearchServico] = useState('');
  const [filterClienteId, setFilterClienteId] = useState<string>('todos');

  // Dialogs clientes
  const [clienteDialogOpen, setClienteDialogOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [deletingCliente, setDeletingCliente] = useState<Cliente | null>(null);

  // Dialogs serviços
  const [servicoDialogOpen, setServicoDialogOpen] = useState(false);
  const [editingServico, setEditingServico] = useState<CatalogoServico | null>(null);
  const [deletingServico, setDeletingServico] = useState<CatalogoServico | null>(null);

  const fetchClientes = async () => {
    setLoadingClientes(true);
    try {
      const data = await listClientes();
      setClientes(data);
    } catch {
      toast.error('Erro ao carregar clientes.');
    } finally {
      setLoadingClientes(false);
    }
  };

  const fetchServicos = async () => {
    setLoadingServicos(true);
    try {
      const data = await listCatalogoServicos();
      setServicos(data);
    } catch {
      toast.error('Erro ao carregar serviços.');
    } finally {
      setLoadingServicos(false);
    }
  };

  useEffect(() => {
    fetchClientes();
    fetchServicos();
  }, []);

  // ── Clientes CRUD ────────────────────────────────────────────────────────────

  const handleSaveCliente = async (data: { nome: string; ativo: boolean }) => {
    if (editingCliente) {
      await updateCliente(editingCliente.id, data);
      toast.success('Cliente atualizado.');
    } else {
      await createCliente(data);
      toast.success('Cliente criado.');
    }
    setEditingCliente(null);
    await fetchClientes();
    await fetchServicos(); // atualiza clienteNome desnormalizado
  };

  const confirmDeleteCliente = async () => {
    if (!deletingCliente) return;
    const vinculados = servicos.filter(s => s.clienteId === deletingCliente.id).length;
    if (vinculados > 0) {
      toast.error(`Este cliente possui ${vinculados} serviço(s) vinculado(s). Remova-os primeiro.`);
      setDeletingCliente(null);
      return;
    }
    try {
      await deleteCliente(deletingCliente.id);
      toast.success('Cliente removido.');
      setDeletingCliente(null);
      fetchClientes();
    } catch {
      toast.error('Erro ao remover cliente.');
    }
  };

  // ── Serviços CRUD ────────────────────────────────────────────────────────────

  const handleSaveServico = async (data: Omit<CatalogoServico, 'id' | 'criadoEm' | 'atualizadoEm'>) => {
    if (editingServico) {
      await updateCatalogoServico(editingServico.id, data);
      toast.success('Serviço atualizado.');
    } else {
      await createCatalogoServico(data);
      toast.success('Serviço criado.');
    }
    setEditingServico(null);
    fetchServicos();
  };

  const confirmDeleteServico = async () => {
    if (!deletingServico) return;
    try {
      await deleteCatalogoServico(deletingServico.id);
      toast.success('Serviço removido.');
      setDeletingServico(null);
      fetchServicos();
    } catch {
      toast.error('Erro ao remover serviço.');
    }
  };

  // ── Filtros ──────────────────────────────────────────────────────────────────

  const filteredClientes = clientes.filter(c =>
    !searchCliente || c.nome.toLowerCase().includes(searchCliente.toLowerCase())
  );

  const filteredServicos = servicos.filter(s => {
    const matchesCliente = filterClienteId === 'todos' || s.clienteId === filterClienteId;
    const matchesSearch = !searchServico ||
      s.nome.toLowerCase().includes(searchServico.toLowerCase()) ||
      (s.clienteNome ?? '').toLowerCase().includes(searchServico.toLowerCase());
    return matchesCliente && matchesSearch;
  });

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-page-in">
      {/* Header */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-primary via-primary/70 to-primary/30" />
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <BookMarked className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Catálogo de Serviços</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Gerencie clientes e tipos de serviço com suas regras de precificação
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
            <span className="font-semibold text-foreground">{clientes.length}</span> clientes ·{' '}
            <span className="font-semibold text-foreground">{servicos.length}</span> serviços
          </div>
        </div>
      </div>

      <Tabs defaultValue="clientes">
        <TabsList>
          <TabsTrigger value="clientes" className="gap-2">
            <Building2 className="w-4 h-4" /> Clientes
          </TabsTrigger>
          <TabsTrigger value="servicos" className="gap-2">
            <Wrench className="w-4 h-4" /> Tipos de Serviço
          </TabsTrigger>
        </TabsList>

        {/* ─── Aba Clientes ─────────────────────────────────────────────────── */}
        <TabsContent value="clientes" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente…"
                value={searchCliente}
                onChange={e => setSearchCliente(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              onClick={() => { setEditingCliente(null); setClienteDialogOpen(true); }}
              size="sm"
              className="shrink-0"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Novo Cliente
            </Button>
          </div>

          {loadingClientes ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
            </div>
          ) : filteredClientes.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhum cliente encontrado</p>
              <p className="text-sm mt-1">Crie um cliente para começar a configurar serviços.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredClientes.map(c => {
                const qtdServicos = servicos.filter(s => s.clienteId === c.id).length;
                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3 hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Building2 className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{c.nome}</p>
                        <p className="text-xs text-muted-foreground">{qtdServicos} tipo(s) de serviço</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={c.ativo ? 'default' : 'secondary'} className="text-xs">
                        {c.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8"
                        onClick={() => { setEditingCliente(c); setClienteDialogOpen(true); }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeletingCliente(c)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ─── Aba Serviços ─────────────────────────────────────────────────── */}
        <TabsContent value="servicos" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar serviço…"
                value={searchServico}
                onChange={e => setSearchServico(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterClienteId} onValueChange={setFilterClienteId}>
              <SelectTrigger className="w-48 shrink-0">
                <SelectValue placeholder="Todos os clientes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os clientes</SelectItem>
                {clientes.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => { setEditingServico(null); setServicoDialogOpen(true); }}
              size="sm"
              className="shrink-0"
              disabled={clientes.filter(c => c.ativo).length === 0}
            >
              <Plus className="w-4 h-4 mr-1.5" /> Novo Serviço
            </Button>
          </div>

          {clientes.filter(c => c.ativo).length === 0 && !loadingClientes && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0" />
              Crie ao menos um cliente ativo na aba "Clientes" antes de adicionar serviços.
            </div>
          )}

          {loadingServicos ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
            </div>
          ) : filteredServicos.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Wrench className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhum serviço encontrado</p>
              <p className="text-sm mt-1">Adicione tipos de serviço para configurar o faturamento.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredServicos.map(s => (
                <div
                  key={s.id}
                  className="rounded-xl border border-border bg-card hover:border-primary/30 transition-colors overflow-hidden"
                >
                  <div className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Wrench className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm">{s.nome}</p>
                          <Badge variant="outline" className="text-[10px] font-medium shrink-0">
                            {s.clienteNome || clientes.find(c => c.id === s.clienteId)?.nome || s.clienteId}
                          </Badge>
                          {s.isRetorno && <Badge variant="secondary" className="text-[10px]">Retorno</Badge>}
                          {!s.pagaTecnico && <Badge variant="destructive" className="text-[10px]">Sem repasse</Badge>}
                          {s.exigePeca && <Badge className="text-[10px] bg-amber-500 hover:bg-amber-600">Exige peça</Badge>}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
                            <DollarSign className="w-3 h-3" />
                            Rec: {brl(s.valorReceita)}
                            {s.valorAdicionalReceita > 0 && ` + ${brl(s.valorAdicionalReceita)}`}
                          </span>
                          <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                            <ChevronRight className="w-3 h-3" />
                            Custo: {brl(s.valorCustoTecnico)}
                            {s.valorAdicionalCusto > 0 && ` + ${brl(s.valorAdicionalCusto)}`}
                          </span>
                          <span className="text-muted-foreground">
                            Franquia: {s.horasFranquia}h
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => { setEditingServico(s); setServicoDialogOpen(true); }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeletingServico(s)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── Dialogs ─────────────────────────────────────────────────────────── */}

      <ClienteDialog
        open={clienteDialogOpen}
        onOpenChange={open => { setClienteDialogOpen(open); if (!open) setEditingCliente(null); }}
        initial={editingCliente}
        onSave={handleSaveCliente}
      />

      <ServicoDialog
        open={servicoDialogOpen}
        onOpenChange={open => { setServicoDialogOpen(open); if (!open) setEditingServico(null); }}
        initial={editingServico}
        clientes={clientes}
        onSave={handleSaveServico}
      />

      <AlertDialog open={!!deletingCliente} onOpenChange={open => !open && setDeletingCliente(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o cliente <strong>{deletingCliente?.nome}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteCliente}
              className="bg-destructive hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingServico} onOpenChange={open => !open && setDeletingServico(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Serviço</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o serviço <strong>{deletingServico?.nome}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteServico}
              className="bg-destructive hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
