import { useEffect, useMemo, useRef, useState } from 'react';
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
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '../components/ui/sheet';
import { Separator } from '../components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
import { toast } from 'sonner';
import {
  Plus, Search, ClipboardList, FileText, Wrench, Package, Link as LinkIcon,
  Clock, Eye, Pencil, Send, History, Wand2, Trash2, Layers, Calculator,
  AlertCircle, AlertTriangle, X, Download, ArrowUpDown, CalendarDays, User, ChevronDown, Loader2,
} from 'lucide-react';
import { CHAMADOS_EXEMPLO } from '../lib/seed-data';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/use-permissions';
import { listTechnicians } from '../lib/technician-firestore';
import { listCatalogoServicos } from '../lib/catalogo-firestore';
import { listEstoqueItens } from '../lib/estoque-firestore';
import {
  listChamados, createChamado, updateChamado,
  submeterChamado, resubmeterChamado, checkDuplicateChamado,
} from '../lib/chamado-firestore';
import { fetchFsaDetails } from '../lib/fsa';
import type { Chamado, ChamadoStatus, LoteItem } from '../types/chamado';
import type { TechnicianProfile } from '../types/technician';
import type { CatalogoServico } from '../types/catalogo';
import type { EstoqueItem } from '../types/estoque';
import { cn } from '../lib/utils';
import { EmptyState } from '../components/EmptyState';
import { CHAMADO_STATUS_CONFIG } from '../lib/statusConfig';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const LAST_TECNICO_KEY = 'chamado_last_tecnico_id';

const JIRA_BASE = 'https://delfia.atlassian.net/browse/';

function resolveLink(val: string): string {
  const v = val.trim();
  if (!v) return '';
  if (v.startsWith('http://') || v.startsWith('https://')) return v;
  return JIRA_BASE + v.toUpperCase();
}

function extractTicketId(url: string): string {
  if (url.startsWith(JIRA_BASE)) return url.slice(JIRA_BASE.length);
  return url;
}

const fmtDateBR = (iso: string) =>
  iso ? iso.split('-').reverse().join('/') : '';

const todayStr = () => new Date().toISOString().slice(0, 10);
const yesterdayStr = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
};

function exportToCSV(chamados: Chamado[]) {
  const headers = ['Código', 'Loja', 'Técnico', 'Data', 'Status', 'Serviço', 'Peça', 'Observações'];
  const rows = chamados.map(c => [
    c.fsa, c.codigoLoja, c.tecnicoNome, c.dataAtendimento,
    STATUS_CONFIG[c.status].label, c.catalogoServicoNome ?? '',
    c.pecaUsada ?? c.estoqueItemNome ?? '', c.observacoes ?? '',
  ]);
  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chamados_${todayStr()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const STATUS_CONFIG = CHAMADO_STATUS_CONFIG;

// #1 fix: em_validacao covers both submetido + validado_operador
const STATUS_TABS: { value: string; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'rascunho', label: 'Rascunho' },
  { value: 'em_validacao', label: 'Ag. Validação' },
  { value: 'rejeitado', label: 'Rejeitados' },
  { value: 'validado_financeiro', label: 'Aprovados' },
  { value: 'pagamento_pendente', label: 'Ag. Pagamento' },
  { value: 'pago', label: 'Pagos' },
];

const REJECTION_STATUSES: ChamadoStatus[] = ['rejeitado', 'rejeitado_operacional', 'rejeitado_financeiro'];

function isRejectedStatus(status: ChamadoStatus) {
  return REJECTION_STATUSES.includes(status);
}

type OperationalFilter =
  | 'todos'
  | 'com_lote'
  | 'com_peca'
  | 'com_reembolso'
  | 'sem_servico'
  | 'sem_link'
  | 'sem_duracao'
  | 'pagamento_ao_pai'
  | 'pronto_pagamento'
  | 'vinculado_pagamento';

const OPERATIONAL_FILTERS: { value: OperationalFilter; label: string }[] = [
  { value: 'todos', label: 'Todos os sinais' },
  { value: 'com_lote', label: 'Com lote' },
  { value: 'com_peca', label: 'Com peça/spare' },
  { value: 'com_reembolso', label: 'Com reembolso' },
  { value: 'sem_servico', label: 'Sem serviço' },
  { value: 'sem_link', label: 'Sem link Jira/FSA' },
  { value: 'sem_duracao', label: 'Sem duração' },
  { value: 'pagamento_ao_pai', label: 'Pagamento ao pai' },
  { value: 'pronto_pagamento', label: 'Pronto p/ pagamento' },
  { value: 'vinculado_pagamento', label: 'Vinculado a pagamento' },
];

function matchesOperationalFilter(c: Chamado, filter: OperationalFilter) {
  switch (filter) {
    case 'com_lote':
      return (c.itensAdicionais?.length ?? 0) > 0;
    case 'com_peca':
      return Boolean(c.pecaUsada?.trim() || c.estoqueItemId);
    case 'com_reembolso':
      return c.fornecedorPeca === 'Tecnico' && (c.custoPeca ?? 0) > 0;
    case 'sem_servico':
      return !c.catalogoServicoId;
    case 'sem_link':
      return !c.linkPlataforma?.trim();
    case 'sem_duracao':
      return !c.durationMinutes || c.durationMinutes <= 0;
    case 'pagamento_ao_pai':
      return c.pagamentoDestino === 'parent';
    case 'pronto_pagamento':
      return c.status === 'validado_financeiro' && !c.pagamentoId;
    case 'vinculado_pagamento':
      return Boolean(c.pagamentoId) || c.status === 'pagamento_pendente' || c.status === 'pago';
    default:
      return true;
  }
}

function nextActionLabel(c: Chamado): string {
  if (c.status === 'rascunho') return 'Submeter';
  if (c.status === 'submetido') return 'Validar operação';
  if (c.status === 'validado_operador') return 'Validar financeiro';
  if (isRejectedStatus(c.status)) return 'Corrigir dados';
  if (c.status === 'validado_financeiro') return c.pagamentoId ? 'Revisar pagamento' : 'Gerar pagamento';
  if (c.status === 'pagamento_pendente') return 'Confirmar pagamento';
  if (c.status === 'pago') return 'Consultar histórico';
  if (c.status === 'cancelado') return 'Cancelado';
  return 'Revisar';
}

function getChamadoSignals(c: Chamado): string[] {
  const signals: string[] = [];
  if (!c.catalogoServicoId) signals.push('sem serviço');
  if (!c.linkPlataforma?.trim()) signals.push('sem link');
  if (!c.durationMinutes || c.durationMinutes <= 0) signals.push('sem duração');
  if (c.estoqueItemId) signals.push('estoque');
  if (c.fornecedorPeca === 'Tecnico' && (c.custoPeca ?? 0) > 0) signals.push('reembolso');
  if (c.pagamentoDestino === 'parent') signals.push('pag. ao pai');
  if (c.pagamentoId) signals.push('em lote');
  return signals;
}

function calcDuration(hi?: string, hf?: string): number | undefined {
  if (!hi || !hf) return undefined;
  const [hh, mm] = hi.split(':').map(Number);
  const [hh2, mm2] = hf.split(':').map(Number);
  const mins = (hh2 * 60 + mm2) - (hh * 60 + mm);
  return mins > 0 ? mins : undefined;
}

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// #8: Section label component for form grouping
function SectionLabel({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-px flex-1 bg-border/60" />
      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1">
        <Icon className="w-3 h-3" /> {label}
      </span>
      <div className="h-px flex-1 bg-border/60" />
    </div>
  );
}

// ─── Cálculo de valores do lote ───────────────────────────────────────────────

interface ValoresLote {
  receita: number;
  custo: number;
  horasExtras: number;
  numAdicionais: number;
}

function calcValoresLote(
  servico: CatalogoServico | null,
  numAdicionais: number,
  durationMinutes: number | undefined,
): ValoresLote | null {
  if (!servico) return null;

  const horasFranquia = servico.horasFranquia ?? 2;
  const horasAtendimento = (durationMinutes ?? 0) / 60;
  const horasExtras = Math.max(0, horasAtendimento - horasFranquia);

  const receita = servico.valorReceita
    + numAdicionais * (servico.valorAdicionalReceita ?? 0)
    + horasExtras * (servico.valorHoraAdicionalReceita ?? 0);

  const custo = servico.pagaTecnico
    ? (servico.pagamentoIntegral
        ? servico.valorCustoTecnico
        : servico.valorCustoTecnico
            + numAdicionais * (servico.valorAdicionalCusto ?? 0)
            + horasExtras * (servico.valorHoraAdicionalCusto ?? 0))
    : 0;

  return { receita, custo, horasExtras, numAdicionais };
}

// ─── Tipos do formulário ──────────────────────────────────────────────────────

interface LoteItemForm {
  codigoChamado: string;
  codigoLoja: string;
  catalogoServicoId: string;
}

interface ChamadoFormState {
  tecnicoId: string;
  fsa: string;
  codigoLoja: string;
  catalogoServicoId: string;
  itensAdicionais: LoteItemForm[];
  dataAtendimento: string;
  horaInicio: string;
  horaFim: string;
  pecaUsada: string;
  custoPecaStr: string;
  fornecedorPeca: 'Tecnico' | 'Empresa';
  estoqueItemId: string;
  estoqueQuantidadeStr: string;
  linkPlataforma: string;
  observacoes: string;
}

const FORM_EMPTY: ChamadoFormState = {
  tecnicoId: '', fsa: '', codigoLoja: '', catalogoServicoId: '',
  itensAdicionais: [],
  dataAtendimento: todayStr(),
  horaInicio: '', horaFim: '', pecaUsada: '', custoPecaStr: '',
  fornecedorPeca: 'Empresa', estoqueItemId: '', estoqueQuantidadeStr: '',
  linkPlataforma: '', observacoes: '',
};

function chamadoToForm(c: Chamado): ChamadoFormState {
  return {
    tecnicoId: c.tecnicoId,
    fsa: c.fsa,
    codigoLoja: c.codigoLoja,
    catalogoServicoId: c.catalogoServicoId ?? '',
    itensAdicionais: c.itensAdicionais?.map(i => ({
      codigoChamado: i.codigoChamado,
      codigoLoja: i.codigoLoja,
      catalogoServicoId: i.catalogoServicoId ?? '',
    })) ?? [],
    dataAtendimento: c.dataAtendimento,
    horaInicio: c.horaInicio ?? '',
    horaFim: c.horaFim ?? '',
    pecaUsada: c.pecaUsada ?? '',
    custoPecaStr: c.custoPeca ? String(c.custoPeca) : '',
    fornecedorPeca: c.fornecedorPeca ?? 'Empresa',
    estoqueItemId: c.estoqueItemId ?? '',
    estoqueQuantidadeStr: c.estoqueQuantidade ? String(c.estoqueQuantidade) : '',
    linkPlataforma: c.linkPlataforma ? extractTicketId(c.linkPlataforma) : '',
    observacoes: c.observacoes ?? '',
  };
}

// ─── Componente de item do lote ───────────────────────────────────────────────

function LoteItemRow({
  index, item, catalogoServicos, onChange, onRemove, isPrimary, fsaLoading,
}: {
  index: number;
  item: LoteItemForm;
  catalogoServicos: CatalogoServico[];
  onChange: (item: LoteItemForm) => void;
  onRemove?: () => void;
  isPrimary: boolean;
  fsaLoading?: boolean;
}) {
  return (
    <div className={cn(
      'rounded-lg border p-3 space-y-2.5',
      isPrimary ? 'border-primary/30 bg-primary/3' : 'border-border bg-muted/20',
    )}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {isPrimary ? '① Item principal' : `⊕ Item ${index + 1}`}
        </p>
        {!isPrimary && onRemove && (
          <Button type="button" variant="ghost" size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={onRemove}>
            <Trash2 className="w-3 h-3" />
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Código de Chamado {isPrimary && <span className="text-destructive">*</span>}</Label>
          <div className="relative">
          <Input placeholder="Ex: 2025-001" value={item.codigoChamado}
            className={fsaLoading ? 'pr-8' : ''}
            onChange={e => onChange({ ...item, codigoChamado: e.target.value })} />
          {fsaLoading && (
            <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground pointer-events-none" />
          )}
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Cód. Loja {isPrimary && <span className="text-destructive">*</span>}</Label>
          <Input placeholder="Ex: 1234" value={item.codigoLoja}
            onChange={e => onChange({ ...item, codigoLoja: e.target.value })} />
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs text-muted-foreground">Tipo de Serviço</Label>
          <Select value={item.catalogoServicoId || '__none__'}
            onValueChange={v => onChange({ ...item, catalogoServicoId: v === '__none__' ? '' : v })}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Selecionar (opcional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Mesmo do item principal</SelectItem>
              {catalogoServicos.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  {s.nome}{s.clienteNome ? ` · ${s.clienteNome}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

// ─── Preview de valores do lote ───────────────────────────────────────────────

function ValorEstimadoCard({
  servico, numAdicionais, durationMinutes, custoPeca, fornecedorPeca,
}: {
  servico: CatalogoServico;
  numAdicionais: number;
  durationMinutes?: number;
  custoPeca?: number;
  fornecedorPeca?: 'Tecnico' | 'Empresa';
}) {
  const vals = calcValoresLote(servico, numAdicionais, durationMinutes);
  if (!vals) return null;
  const custoPecaCalculado = custoPeca && custoPeca > 0 ? custoPeca : 0;
  const margemEstimada = vals.receita - vals.custo - custoPecaCalculado;

  return (
    <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-2">
      <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
        <Calculator className="w-3.5 h-3.5" /> Estimativa de Valores
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Receita empresa</p>
          <p className="text-base font-bold text-green-700 dark:text-green-400">R$ {fmtBRL(vals.receita)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Custo técnico</p>
          <p className="text-base font-bold text-blue-700 dark:text-blue-400">
            {servico.pagaTecnico ? `R$ ${fmtBRL(vals.custo)}` : '—'}
          </p>
        </div>
        {custoPecaCalculado > 0 && (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              {fornecedorPeca === 'Tecnico' ? 'Reembolso peça' : 'Custo peça'}
            </p>
            <p className="text-base font-bold text-amber-700 dark:text-amber-400">R$ {fmtBRL(custoPecaCalculado)}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Margem estimada</p>
          <p className={cn(
            'text-base font-bold',
            margemEstimada >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400',
          )}>
            R$ {fmtBRL(margemEstimada)}
          </p>
        </div>
      </div>
      <div className="text-xs text-muted-foreground space-y-0.5 border-t border-border/50 pt-2 mt-1">
        <p>Base: R$ {fmtBRL(servico.valorReceita)}</p>
        {numAdicionais > 0 && (
          <p>+ {numAdicionais} ativo(s) adicional(is) × R$ {fmtBRL(servico.valorAdicionalReceita)}</p>
        )}
        {vals.horasExtras > 0 && (
          <p>+ {vals.horasExtras.toFixed(1)}h extra(s) × R$ {fmtBRL(servico.valorHoraAdicionalReceita)}</p>
        )}
        {vals.horasExtras === 0 && durationMinutes && durationMinutes > 0 && (
          <p className="text-muted-foreground/70">
            {(durationMinutes / 60).toFixed(1)}h dentro da franquia de {servico.horasFranquia}h
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Form de Chamado ──────────────────────────────────────────────────────────

function ChamadoFormDialog({
  open, onOpenChange, editing, tecnicos, catalogoServicos, estoqueItens, onSaved, userName, userId, canViewFinancialValues,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Chamado | null;
  tecnicos: TechnicianProfile[];
  catalogoServicos: CatalogoServico[];
  estoqueItens: EstoqueItem[];
  onSaved: () => void;
  userName: string;
  userId: string;
  canViewFinancialValues: boolean;
}) {
  const [form, setForm] = useState<ChamadoFormState>(FORM_EMPTY);
  const [saving, setSaving] = useState(false);
  const [submitAfterSave, setSubmitAfterSave] = useState(false);
  const [showPeca, setShowPeca] = useState(false);
  const [fsaLookupStatus, setFsaLookupStatus] = useState<'idle' | 'loading' | 'found' | 'not_found'>('idle');
  const fsaDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (editing) {
      setForm(chamadoToForm(editing));
      setShowPeca(!!editing.pecaUsada);
    } else {
      // #4: restore last technician from localStorage
      const lastTecId = localStorage.getItem(LAST_TECNICO_KEY) ?? '';
      setForm({ ...FORM_EMPTY, tecnicoId: lastTecId });
      setShowPeca(false);
    }
    setSubmitAfterSave(false);
  }, [editing, open]);

  // Auto-fill codigoLoja via Jira ao digitar o FSA principal (debounce 700ms)
  useEffect(() => {
    const fsa = form.fsa.trim();
    if (!fsa || editing) { setFsaLookupStatus('idle'); return; }
    setFsaLookupStatus('loading');
    if (fsaDebounceRef.current) clearTimeout(fsaDebounceRef.current);
    fsaDebounceRef.current = setTimeout(async () => {
      try {
        const details = await fetchFsaDetails({ fsa });
        if (details?.storeCode) {
          setForm(f => ({ ...f, codigoLoja: f.codigoLoja || details.storeCode! }));
          setFsaLookupStatus('found');
        } else {
          setFsaLookupStatus('not_found');
        }
      } catch {
        setFsaLookupStatus('not_found');
      }
    }, 700);
    return () => { if (fsaDebounceRef.current) clearTimeout(fsaDebounceRef.current); };
  }, [form.fsa, editing]);

  const set = <K extends keyof ChamadoFormState>(k: K, v: ChamadoFormState[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const primaryServico = catalogoServicos.find(s => s.id === form.catalogoServicoId) ?? null;
  const tecnico = tecnicos.find(t => t.uid === form.tecnicoId) ?? null;
  const estoqueItem = estoqueItens.find(i => i.id === form.estoqueItemId) ?? null;

  const indisponivel = useMemo(() => {
    if (!tecnico?.periodosIndisponibilidade?.length || !form.dataAtendimento) return null;
    return tecnico.periodosIndisponibilidade.find(
      p => form.dataAtendimento >= p.de && form.dataAtendimento <= p.ate,
    ) ?? null;
  }, [tecnico, form.dataAtendimento]);
  const duration = calcDuration(form.horaInicio, form.horaFim);
  // #9: detect invalid hour range
  const horaInvalida = !!(form.horaInicio && form.horaFim && !duration &&
    form.horaFim !== '' && form.horaInicio !== '');
  const showPecaSection = primaryServico?.exigePeca || showPeca || !!form.pecaUsada || !!form.estoqueItemId;

  const handleEstoqueItemChange = (itemId: string) => {
    if (itemId === '__none__') {
      setForm(f => ({ ...f, estoqueItemId: '', estoqueQuantidadeStr: '' }));
      return;
    }
    const item = estoqueItens.find(i => i.id === itemId);
    setForm(f => ({
      ...f,
      estoqueItemId: itemId,
      estoqueQuantidadeStr: f.estoqueQuantidadeStr || '1',
      pecaUsada: f.pecaUsada || item?.nome || '',
      fornecedorPeca: 'Empresa',
    }));
  };

  const addItemAoLote = () => {
    setForm(f => ({
      ...f,
      itensAdicionais: [
        ...f.itensAdicionais,
        { codigoChamado: '', codigoLoja: f.codigoLoja, catalogoServicoId: '' },
      ],
    }));
  };

  const updateItem = (idx: number, item: LoteItemForm) => {
    setForm(f => {
      const itens = [...f.itensAdicionais];
      itens[idx] = item;
      return { ...f, itensAdicionais: itens };
    });
  };

  const removeItem = (idx: number) => {
    setForm(f => ({ ...f, itensAdicionais: f.itensAdicionais.filter((_, i) => i !== idx) }));
  };

  const handleSave = async (submit: boolean) => {
    if (!form.tecnicoId) { toast.error('Selecione o técnico.'); return; }
    if (!form.fsa.trim()) { toast.error('Informe o Código de Chamado principal.'); return; }
    if (!form.codigoLoja.trim()) { toast.error('Informe o código da loja principal.'); return; }
    if (!form.dataAtendimento) { toast.error('Informe a data do atendimento.'); return; }
    if (horaInvalida) { toast.error('Hora de fim deve ser posterior ao início.'); return; }
    if (primaryServico?.exigePeca && !form.pecaUsada.trim() && !form.estoqueItemId) {
      toast.error('Este serviço exige informar a peça utilizada.'); return;
    }
    if (form.estoqueItemId) {
      const qtd = Number(form.estoqueQuantidadeStr || 0);
      if (!Number.isFinite(qtd) || qtd <= 0) {
        toast.error('Informe a quantidade da peça vinculada ao estoque.'); return;
      }
    }
    for (let i = 0; i < form.itensAdicionais.length; i++) {
      const item = form.itensAdicionais[i];
      if (!item.codigoChamado.trim() || !item.codigoLoja.trim()) {
        toast.error(`Preencha o código e a loja do item ${i + 2} do lote.`);
        return;
      }
    }

    // Verificação de duplicata — apenas ao criar (não ao editar)
    if (!editing) {
      try {
        const dup = await checkDuplicateChamado(form.fsa.trim(), form.tecnicoId, form.dataAtendimento);
        if (dup) {
          toast.warning(
            `Já existe um chamado com FSA "${form.fsa.trim()}" para este técnico nesta data (status: ${STATUS_CONFIG[dup.status].label}). Verifique antes de continuar.`,
            { duration: 6000 },
          );
        }
      } catch { /* non-blocking */ }
    }

    setSaving(true);
    try {
      const itensAdicionais: LoteItem[] = form.itensAdicionais.map(i => ({
        codigoChamado: i.codigoChamado.trim(),
        codigoLoja: i.codigoLoja.trim(),
        catalogoServicoId: i.catalogoServicoId || undefined,
        catalogoServicoNome: catalogoServicos.find(s => s.id === i.catalogoServicoId)?.nome,
      }));

      const payload = {
        tecnicoId: form.tecnicoId,
        tecnicoNome: tecnico?.nome ?? form.tecnicoId,
        tecnicoCodigo: tecnico?.codigoTecnico,
        tecnicoPaiId: tecnico?.tecnicoPaiId,
        tecnicoPaiCodigo: tecnico?.tecnicoPaiCodigo,
        pagamentoDestino: tecnico?.pagamentoPara ?? 'self',
        fsa: form.fsa.trim(),
        codigoLoja: form.codigoLoja.trim(),
        itensAdicionais: itensAdicionais.length > 0 ? itensAdicionais : undefined,
        catalogoServicoId: form.catalogoServicoId || undefined,
        catalogoServicoNome: primaryServico?.nome,
        dataAtendimento: form.dataAtendimento,
        horaInicio: form.horaInicio || undefined,
        horaFim: form.horaFim || undefined,
        durationMinutes: duration,
        pecaUsada: form.pecaUsada.trim() || undefined,
        custoPeca: form.custoPecaStr ? parseFloat(form.custoPecaStr) : undefined,
        fornecedorPeca: form.pecaUsada.trim() || form.estoqueItemId ? form.fornecedorPeca : undefined,
        estoqueItemId: form.estoqueItemId || undefined,
        estoqueItemNome: estoqueItem?.nome,
        estoqueQuantidade: form.estoqueItemId ? Number(form.estoqueQuantidadeStr || 1) : undefined,
        linkPlataforma: resolveLink(form.linkPlataforma) || undefined,
        observacoes: form.observacoes.trim() || undefined,
        registradoPor: userId,
        registradoPorNome: userName,
      };

      // #4: persist last technician
      try { localStorage.setItem(LAST_TECNICO_KEY, form.tecnicoId); } catch {}

      if (editing) {
        if (isRejectedStatus(editing.status)) {
          await resubmeterChamado(editing.id, userId, userName, payload);
          toast.success('Chamado corrigido e resubmetido.');
        } else {
          await updateChamado(editing.id, payload);
          if (submit) await submeterChamado(editing.id, userId, userName);
          toast.success('Chamado atualizado.');
        }
      } else {
        await createChamado(payload, submit);
        const n = itensAdicionais.length;
        toast.success(
          submit
            ? `Lote com ${n + 1} chamado(s) registrado e submetido.`
            : `Rascunho salvo (${n + 1} chamado(s)).`,
        );
      }

      onSaved();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar chamado.');
    } finally {
      setSaving(false);
    }
  };

  const isRejeitado = editing ? isRejectedStatus(editing.status) : false;
  const title = editing
    ? (isRejeitado ? 'Ajustar Chamado Rejeitado' : 'Editar Chamado')
    : 'Registrar Chamado';

  const preencherExemplo = () => {
    const ex = CHAMADOS_EXEMPLO[Math.floor(Math.random() * CHAMADOS_EXEMPLO.length)];
    const firstTecnico = tecnicos.find(t => t.status === 'ativo');
    const firstServico = catalogoServicos[0];
    setForm(f => ({
      ...f,
      fsa: ex.fsa,
      codigoLoja: ex.codigoLoja,
      dataAtendimento: ex.dataAtendimento,
      horaInicio: ex.horaInicio,
      horaFim: ex.horaFim,
      observacoes: ex.observacoes,
      tecnicoId: firstTecnico?.uid ?? f.tecnicoId,
      catalogoServicoId: firstServico?.id ?? f.catalogoServicoId,
    }));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" /> {title}
          </SheetTitle>
          {isRejeitado && editing?.motivoRejeicao && (
            <SheetDescription className="text-destructive font-medium">
              Motivo da rejeição: {editing.motivoRejeicao}
            </SheetDescription>
          )}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="space-y-5">

          {/* #8 Section: Identificação */}
          <SectionLabel icon={User} label="Identificação" />

          {/* Técnico */}
          <div className="space-y-1.5">
            <Label htmlFor="ch-tecnico">Técnico *</Label>
            <Select value={form.tecnicoId} onValueChange={v => set('tecnicoId', v)}>
              <SelectTrigger id="ch-tecnico" aria-label="Técnico">
                <SelectValue placeholder="Selecione o técnico…" />
              </SelectTrigger>
              <SelectContent>
                {tecnicos.filter(t => t.status === 'ativo').map(t => (
                  <SelectItem key={t.uid} value={t.uid}>
                    {t.nome} — {t.codigoTecnico}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {indisponivel && (
              <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2 border border-amber-500/25 mt-1">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>
                  Técnico indisponível de {fmtDateBR(indisponivel.de)} a {fmtDateBR(indisponivel.ate)}
                  {indisponivel.motivo ? ` — ${indisponivel.motivo}` : ''}.
                </span>
              </p>
            )}
          </div>

          {/* Itens do lote */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-muted-foreground" /> Itens do Lote
                {form.itensAdicionais.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] ml-1">
                    {form.itensAdicionais.length + 1} chamado(s)
                  </Badge>
                )}
              </Label>
            </div>

            <LoteItemRow
              index={0}
              item={{ codigoChamado: form.fsa, codigoLoja: form.codigoLoja, catalogoServicoId: form.catalogoServicoId }}
              catalogoServicos={catalogoServicos}
              isPrimary
              fsaLoading={fsaLookupStatus === 'loading'}
              onChange={item => setForm(f => ({
                ...f,
                fsa: item.codigoChamado,
                codigoLoja: item.codigoLoja,
                catalogoServicoId: item.catalogoServicoId,
              }))}
            />
            {fsaLookupStatus === 'found' && (
              <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1 -mt-1">
                <Wand2 className="w-3 h-3" /> Loja preenchida automaticamente via Jira.
              </p>
            )}

            {form.itensAdicionais.map((item, idx) => (
              <LoteItemRow
                key={idx}
                index={idx + 1}
                item={item}
                catalogoServicos={catalogoServicos}
                isPrimary={false}
                onChange={updated => updateItem(idx, updated)}
                onRemove={() => removeItem(idx)}
              />
            ))}

            <Button type="button" variant="outline" size="sm"
              className="w-full gap-1.5 border-dashed text-muted-foreground hover:text-foreground"
              onClick={addItemAoLote}>
              <Plus className="w-3.5 h-3.5" /> Adicionar chamado ao lote
            </Button>
          </div>

          {/* #8 Section: Agendamento */}
          <SectionLabel icon={CalendarDays} label="Agendamento" />

          {/* Data + Horas */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ch-data">Data do Atendimento *</Label>
              <Input id="ch-data" type="date" value={form.dataAtendimento}
                onChange={e => set('dataAtendimento', e.target.value)} />
              {/* #5: date shortcuts */}
              <div className="flex gap-1.5">
                <Button type="button" variant="outline" size="sm"
                  className="h-7 text-xs px-2.5 flex-1"
                  onClick={() => set('dataAtendimento', todayStr())}>
                  Hoje
                </Button>
                <Button type="button" variant="outline" size="sm"
                  className="h-7 text-xs px-2.5 flex-1"
                  onClick={() => set('dataAtendimento', yesterdayStr())}>
                  Ontem
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ch-hora-inicio">Hora Início</Label>
              <Input id="ch-hora-inicio" type="time" value={form.horaInicio}
                onChange={e => set('horaInicio', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ch-hora-fim">Hora Fim</Label>
              <Input id="ch-hora-fim" type="time"
                value={form.horaFim}
                onChange={e => set('horaFim', e.target.value)}
                className={cn(horaInvalida && 'border-destructive focus-visible:ring-destructive/30')}
              />
            </div>
          </div>

          {/* #9: hora validation feedback */}
          {horaInvalida ? (
            <p className="text-xs text-destructive flex items-center gap-1.5 -mt-3">
              <AlertCircle className="w-3 h-3 shrink-0" /> Hora de fim deve ser posterior ao início.
            </p>
          ) : duration ? (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 -mt-3">
              <Clock className="w-3 h-3" /> Duração: {duration} minutos
            </p>
          ) : null}

          {/* Preview de valores — visível apenas para ADM e Financeiro */}
          {primaryServico && canViewFinancialValues && (
            <ValorEstimadoCard
              servico={primaryServico}
              numAdicionais={form.itensAdicionais.length}
              durationMinutes={duration}
              custoPeca={form.custoPecaStr ? parseFloat(form.custoPecaStr) : undefined}
              fornecedorPeca={form.fornecedorPeca}
            />
          )}

          {/* #8 Section: Serviço */}
          <SectionLabel icon={Wrench} label="Serviço" />

          {/* #2: Peça — toggle quando opcional */}
          {showPecaSection ? (
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
                  <Package className="w-3.5 h-3.5" /> Peça utilizada
                  {primaryServico?.exigePeca && <span className="text-destructive">*</span>}
                </p>
                {!primaryServico?.exigePeca && (
                  <Button type="button" variant="ghost" size="sm"
                    className="h-6 text-xs text-muted-foreground hover:text-destructive px-2"
                    onClick={() => {
                      setShowPeca(false);
                      setForm(f => ({
                        ...f,
                        pecaUsada: '',
                        custoPecaStr: '',
                        estoqueItemId: '',
                        estoqueQuantidadeStr: '',
                      }));
                    }}>
                    <X className="w-3 h-3 mr-1" /> Remover
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Item do estoque</Label>
                  <Select value={form.estoqueItemId || '__none__'} onValueChange={handleEstoqueItemChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Vincular item cadastrado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sem vínculo de estoque</SelectItem>
                      {estoqueItens.map(item => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.nome} · saldo {item.quantidadeAtual} {item.unidade}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Qtd.</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={form.estoqueQuantidadeStr}
                    disabled={!form.estoqueItemId}
                    onChange={e => set('estoqueQuantidadeStr', e.target.value)}
                  />
                </div>
              </div>
              {estoqueItem && (
                <p className="text-xs text-muted-foreground">
                  Saldo atual: {estoqueItem.quantidadeAtual} {estoqueItem.unidade}. A baixa do estoque deve ser registrada no módulo Estoque.
                </p>
              )}
              <Input placeholder="Descrição da peça" value={form.pecaUsada}
                onChange={e => set('pecaUsada', e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Custo (R$)</Label>
                  <Input type="number" min="0" step="0.01" placeholder="0,00"
                    value={form.custoPecaStr} onChange={e => set('custoPecaStr', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Fornecedor</Label>
                  <Select value={form.fornecedorPeca} onValueChange={v => set('fornecedorPeca', v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Empresa">Empresa</SelectItem>
                      <SelectItem value="Tecnico">Técnico (reembolso)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ) : (
            <Button type="button" variant="outline" size="sm"
              className="gap-1.5 text-muted-foreground hover:text-foreground border-dashed"
              onClick={() => setShowPeca(true)}>
              <Package className="w-3.5 h-3.5" /> Adicionar peça utilizada
            </Button>
          )}

          {/* #8 Section: Extras */}
          <SectionLabel icon={LinkIcon} label="Extras" />

          {/* Link Jira/Delfia — smart input */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <LinkIcon className="w-3.5 h-3.5 text-muted-foreground" /> Ticket Delfia / Link
            </Label>
            <Input
              placeholder="Ex: TEC-1234 ou URL completa"
              value={form.linkPlataforma}
              onChange={e => set('linkPlataforma', e.target.value)}
            />
            {form.linkPlataforma.trim() && (
              <a
                href={resolveLink(form.linkPlataforma)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-primary hover:underline truncate"
              >
                <LinkIcon className="w-3 h-3 shrink-0" />
                {resolveLink(form.linkPlataforma)}
              </a>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea placeholder="Informações adicionais…" rows={3}
              value={form.observacoes} onChange={e => set('observacoes', e.target.value)} />
          </div>
        </div>

        </div>

        <SheetFooter className="px-6 py-4 border-t shrink-0 flex-col sm:flex-row gap-2">
          {!editing && (
            <Button type="button" variant="ghost" size="sm"
              className="gap-1.5 text-muted-foreground sm:mr-auto" onClick={preencherExemplo}>
              <Wand2 className="w-3.5 h-3.5" /> Preencher exemplo
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {!isRejeitado && (
            <Button variant="secondary" onClick={() => handleSave(false)} disabled={saving}>
              {saving && !submitAfterSave ? 'Salvando…' : 'Salvar Rascunho'}
            </Button>
          )}
          <Button onClick={() => { setSubmitAfterSave(true); handleSave(true); }} disabled={saving}>
            {saving && submitAfterSave ? 'Enviando…' :
              isRejeitado ? 'Ajustar e Enviar Novamente' : 'Salvar e Submeter'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─── Card de Chamado ──────────────────────────────────────────────────────────

function ChamadoCard({
  chamado, canEdit, canSubmit, onEdit, onSubmit, onDetail, onResubmit,
}: {
  chamado: Chamado;
  canEdit: boolean;
  canSubmit: boolean;
  onEdit: (c: Chamado) => void;
  onSubmit: (c: Chamado) => void;
  onDetail: (c: Chamado) => void;
  onResubmit?: (c: Chamado) => void;
}) {
  const cfg = STATUS_CONFIG[chamado.status];
  const totalItens = 1 + (chamado.itensAdicionais?.length ?? 0);
  const signals = getChamadoSignals(chamado);

  return (
    <div className="rounded-xl border border-border bg-card hover:border-primary/30 transition-colors overflow-hidden">
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm">Cód. {chamado.fsa}</span>
              {totalItens > 1 && (
                <Badge variant="outline" className="text-[10px] gap-1 border-primary/30 text-primary">
                  <Layers className="w-2.5 h-2.5" /> Lote: {totalItens}
                </Badge>
              )}
              <Badge className={cn('text-[10px] border', cfg.badge)}>{cfg.label}</Badge>
              <Badge variant="outline" className="text-[10px] border-primary/25 text-primary">
                Próx.: {nextActionLabel(chamado)}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground mt-0.5">
              <span>Loja {chamado.codigoLoja}</span>
              <span>{new Date(chamado.dataAtendimento + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
              <span className="font-medium text-foreground">
                {chamado.tecnicoCodigo ? (
                  <>
                    <span className="font-mono text-primary">{chamado.tecnicoCodigo}</span>
                    <span className="text-muted-foreground mx-1">—</span>
                    {chamado.tecnicoNome}
                  </>
                ) : chamado.tecnicoNome}
              </span>
              {chamado.tecnicoPaiCodigo && (
                <span className="text-amber-600 dark:text-amber-400 text-[11px]">
                  ↳ Subcontratado de <span className="font-mono">{chamado.tecnicoPaiCodigo}</span>
                </span>
              )}
              {chamado.registradoPorNome && (
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3 shrink-0" />
                  {chamado.registradoPorNome}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDetail(chamado)}>
                  <Eye className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Ver detalhes</TooltipContent>
            </Tooltip>
            {canEdit && (chamado.status === 'rascunho' || isRejectedStatus(chamado.status)) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(chamado)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Editar chamado</TooltipContent>
              </Tooltip>
            )}
            {/* #7: tooltip on submit button */}
            {canSubmit && chamado.status === 'rascunho' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon"
                    className="h-7 w-7 text-primary hover:text-primary"
                    onClick={() => onSubmit(chamado)}>
                    <Send className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Submeter para validação</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {chamado.catalogoServicoNome && (
            <Badge variant="outline" className="text-[10px]">
              <Wrench className="w-2.5 h-2.5 mr-1" />{chamado.catalogoServicoNome}
            </Badge>
          )}
          {(chamado.pecaUsada || chamado.estoqueItemId) && (
            <Badge variant="secondary" className="text-[10px]">
              <Package className="w-2.5 h-2.5 mr-1" />{chamado.pecaUsada ?? chamado.estoqueItemNome ?? 'Peça'}
            </Badge>
          )}
          {chamado.estoqueItemId && (
            <Badge variant="outline" className="text-[10px] border-sky-300 text-sky-700 dark:text-sky-400">
              <Package className="w-2.5 h-2.5 mr-1" />Estoque
              {chamado.estoqueQuantidade ? `: ${chamado.estoqueQuantidade}` : ''}
            </Badge>
          )}
          {chamado.linkPlataforma && (
            <a href={chamado.linkPlataforma} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline">
              <LinkIcon className="w-2.5 h-2.5" /> Link
            </a>
          )}
          {isRejectedStatus(chamado.status) && chamado.motivoRejeicao && (
            <Badge variant="destructive" className="text-[10px] max-w-[200px] truncate">
              {chamado.motivoRejeicao}
            </Badge>
          )}
          {signals.slice(0, 4).map(signal => (
            <Badge
              key={signal}
              variant="outline"
              className={cn(
                'text-[10px]',
                signal.startsWith('sem ')
                  ? 'border-red-300 text-red-600 dark:text-red-400'
                  : 'border-amber-300 text-amber-700 dark:text-amber-400',
              )}
            >
              {signal}
            </Badge>
          ))}
        </div>

        {/* Quick actions for rejected chamados */}
        {isRejectedStatus(chamado.status) && canEdit && (
          <div className="flex gap-2 pt-1 border-t border-border/50 mt-1">
            <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-xs"
              onClick={() => onEdit(chamado)}>
              <Pencil className="w-3 h-3" /> Ajustar e Enviar Novamente
            </Button>
            {onResubmit && (
              <Button size="sm"
                className="gap-1.5 text-xs bg-primary/90 hover:bg-primary shrink-0"
                onClick={() => onResubmit(chamado)}
                title="Enviar novamente sem alterações">
                <Send className="w-3 h-3" /> Enviar Novamente
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Dialog de Detalhes / Histórico ──────────────────────────────────────────

function DetalheDialog({ chamado, open, onOpenChange, catalogoServicos, canViewFinancialValues }: {
  chamado: Chamado | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  catalogoServicos: CatalogoServico[];
  canViewFinancialValues: boolean;
}) {
  if (!chamado) return null;
  const cfg = STATUS_CONFIG[chamado.status];
  const primaryServico = catalogoServicos.find(s => s.id === chamado.catalogoServicoId) ?? null;
  const totalItens = 1 + (chamado.itensAdicionais?.length ?? 0);
  const duration = chamado.durationMinutes;
  const valores = calcValoresLote(primaryServico, chamado.itensAdicionais?.length ?? 0, duration);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" /> Cód. {chamado.fsa}
            {totalItens > 1 && (
              <Badge variant="outline" className="text-[10px] gap-1 border-primary/30 text-primary ml-1">
                <Layers className="w-2.5 h-2.5" /> Lote: {totalItens}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Loja {chamado.codigoLoja} · {new Date(chamado.dataAtendimento + 'T12:00:00').toLocaleDateString('pt-BR')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs uppercase text-muted-foreground font-semibold">Status</p>
              <Badge className={cn('text-xs border mt-1', cfg.badge)}>{cfg.label}</Badge>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground font-semibold">Técnico</p>
              <p className="font-medium mt-1">
                {chamado.tecnicoCodigo && (
                  <span className="font-mono text-primary mr-1">{chamado.tecnicoCodigo}</span>
                )}
                {chamado.tecnicoCodigo ? '— ' : ''}{chamado.tecnicoNome}
              </p>
              {chamado.tecnicoPaiCodigo && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                  Subcontratado de <span className="font-mono font-semibold">{chamado.tecnicoPaiCodigo}</span>
                  {chamado.pagamentoDestino === 'parent' && ' · pagamento ao pai'}
                </p>
              )}
            </div>
            {chamado.catalogoServicoNome && (
              <div>
                <p className="text-xs uppercase text-muted-foreground font-semibold">Serviço</p>
                <p className="font-medium mt-1">{chamado.catalogoServicoNome}</p>
              </div>
            )}
            {chamado.durationMinutes && (
              <div>
                <p className="text-xs uppercase text-muted-foreground font-semibold">Duração</p>
                <p className="font-medium mt-1">{chamado.durationMinutes} min</p>
              </div>
            )}
          </div>

          {totalItens > 1 && (
            <div>
              <p className="text-xs uppercase text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" /> Itens do Lote ({totalItens})
              </p>
              <div className="rounded-lg border border-border overflow-hidden text-xs">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-2 py-1.5 text-muted-foreground font-medium">#</th>
                      <th className="text-left px-2 py-1.5 text-muted-foreground font-medium">Código</th>
                      <th className="text-left px-2 py-1.5 text-muted-foreground font-medium">Loja</th>
                      <th className="text-left px-2 py-1.5 text-muted-foreground font-medium">Serviço</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr className="bg-primary/3">
                      <td className="px-2 py-1.5 text-muted-foreground">1</td>
                      <td className="px-2 py-1.5 font-mono font-semibold">{chamado.fsa}</td>
                      <td className="px-2 py-1.5">{chamado.codigoLoja}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{chamado.catalogoServicoNome ?? '—'}</td>
                    </tr>
                    {chamado.itensAdicionais!.map((item, i) => (
                      <tr key={i}>
                        <td className="px-2 py-1.5 text-muted-foreground">{i + 2}</td>
                        <td className="px-2 py-1.5 font-mono">{item.codigoChamado}</td>
                        <td className="px-2 py-1.5">{item.codigoLoja}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">
                          {item.catalogoServicoNome ?? chamado.catalogoServicoNome ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {valores && canViewFinancialValues && (
            <div className="rounded-lg bg-muted/40 border border-border p-3 grid grid-cols-2 gap-3 text-sm">
              {(() => {
                const custoPeca = chamado.custoPeca && chamado.custoPeca > 0 ? chamado.custoPeca : 0;
                const margem = valores.receita - valores.custo - custoPeca;
                return (
                  <>
              <div>
                <p className="text-xs uppercase text-muted-foreground font-semibold">Receita</p>
                <p className="font-bold text-green-700 dark:text-green-400 mt-0.5">R$ {fmtBRL(valores.receita)}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground font-semibold">Custo Técnico</p>
                <p className="font-bold text-blue-700 dark:text-blue-400 mt-0.5">
                  {primaryServico?.pagaTecnico ? `R$ ${fmtBRL(valores.custo)}` : '—'}
                </p>
              </div>
              {custoPeca > 0 && (
                <div>
                  <p className="text-xs uppercase text-muted-foreground font-semibold">
                    {chamado.fornecedorPeca === 'Tecnico' ? 'Reembolso peça' : 'Custo peça'}
                  </p>
                  <p className="font-bold text-amber-700 dark:text-amber-400 mt-0.5">R$ {fmtBRL(custoPeca)}</p>
                </div>
              )}
              <div>
                <p className="text-xs uppercase text-muted-foreground font-semibold">Margem estimada</p>
                <p className={cn(
                  'font-bold mt-0.5',
                  margem >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400',
                )}>
                  R$ {fmtBRL(margem)}
                </p>
              </div>
                  </>
                );
              })()}
            </div>
          )}

          {(chamado.pecaUsada || chamado.estoqueItemId) && (
            <div>
              <p className="text-xs uppercase text-muted-foreground font-semibold">Peça</p>
              <p className="font-medium mt-1 text-sm">{chamado.pecaUsada ?? chamado.estoqueItemNome ?? 'Peça vinculada'}
                {chamado.custoPeca ? ` · R$ ${chamado.custoPeca.toFixed(2)}` : ''}
                {chamado.fornecedorPeca === 'Tecnico' ? ' (reembolso)' : ''}
              </p>
              {chamado.estoqueItemId && (
                <p className="text-xs text-muted-foreground mt-1">
                  Vinculada ao estoque: {chamado.estoqueItemNome ?? chamado.pecaUsada}
                  {chamado.estoqueQuantidade ? ` · qtd. ${chamado.estoqueQuantidade}` : ''}
                </p>
              )}
            </div>
          )}
          {chamado.linkPlataforma && (
            <div>
              <p className="text-xs uppercase text-muted-foreground font-semibold">Link</p>
              <a href={chamado.linkPlataforma} target="_blank" rel="noreferrer"
                className="text-primary hover:underline text-sm mt-1 block truncate">
                {chamado.linkPlataforma}
              </a>
            </div>
          )}
          {chamado.observacoes && (
            <div>
              <p className="text-xs uppercase text-muted-foreground font-semibold">Observações</p>
              <p className="text-sm mt-1 whitespace-pre-wrap">{chamado.observacoes}</p>
            </div>
          )}

          {chamado.motivoRejeicao && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <strong>Motivo da rejeição:</strong> {chamado.motivoRejeicao}
            </div>
          )}

          <Separator />

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" /> Histórico
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {[...chamado.historico].reverse().map((h, i) => {
                const hCfg = STATUS_CONFIG[h.status];
                return (
                  <div key={i} className="flex gap-3 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge className={cn('text-[10px] border', hCfg.badge)}>{hCfg.label}</Badge>
                        <span className="text-muted-foreground">{h.porNome}</span>
                        <span className="text-muted-foreground">{new Date(h.em).toLocaleString('pt-BR')}</span>
                      </div>
                      {h.observacao && <p className="text-muted-foreground mt-0.5 italic">{h.observacao}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ChamadosPage() {
  const { user, profile } = useAuth();
  const { permissions } = usePermissions();

  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [loading, setLoading] = useState(true);
  const [tecnicos, setTecnicos] = useState<TechnicianProfile[]>([]);
  const [catalogoServicos, setCatalogoServicos] = useState<CatalogoServico[]>([]);
  const [estoqueItens, setEstoqueItens] = useState<EstoqueItem[]>([]);

  const [tabStatus, setTabStatus] = useState(() => sessionStorage.getItem('ch_tab') ?? 'todos');
  const [search, setSearch] = useState('');
  const [filterTecnico, setFilterTecnico] = useState(() => sessionStorage.getItem('ch_tec') ?? 'todos');
  const [filterLoja, setFilterLoja] = useState(() => sessionStorage.getItem('ch_loja') ?? '');
  const [filterServico, setFilterServico] = useState(() => sessionStorage.getItem('ch_servico') ?? 'todos');
  const [filterOperacional, setFilterOperacional] = useState<OperationalFilter>(
    () => (sessionStorage.getItem('ch_sinal') as OperationalFilter | null) ?? 'todos',
  );
  const [filterDe, setFilterDe] = useState(() => sessionStorage.getItem('ch_de') ?? '');
  const [filterAte, setFilterAte] = useState(() => sessionStorage.getItem('ch_ate') ?? '');
  // #12: sort control
  const [sortKey, setSortKey] = useState<'data_desc' | 'data_asc' | 'status'>('data_desc');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Chamado | null>(null);
  const [detalheOpen, setDetalheOpen] = useState(false);
  const [detalhe, setDetalhe] = useState<Chamado | null>(null);
  const [submetendoId, setSubmetendoId] = useState<string | null>(null);

  useEffect(() => { sessionStorage.setItem('ch_tab', tabStatus); }, [tabStatus]);
  useEffect(() => { sessionStorage.setItem('ch_tec', filterTecnico); }, [filterTecnico]);
  useEffect(() => { sessionStorage.setItem('ch_loja', filterLoja); }, [filterLoja]);
  useEffect(() => { sessionStorage.setItem('ch_servico', filterServico); }, [filterServico]);
  useEffect(() => { sessionStorage.setItem('ch_sinal', filterOperacional); }, [filterOperacional]);
  useEffect(() => { sessionStorage.setItem('ch_de', filterDe); }, [filterDe]);
  useEffect(() => { sessionStorage.setItem('ch_ate', filterAte); }, [filterAte]);

  const userName = profile?.nome ?? user?.email ?? 'Usuário';
  const userId = user?.uid ?? '';

  const fetchChamados = async () => {
    setLoading(true);
    try {
      const data = await listChamados({ limitCount: 200 });
      setChamados(data);
    } catch { toast.error('Erro ao carregar chamados.'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchChamados();
    listTechnicians().then(setTecnicos).catch(() => {});
    listCatalogoServicos().then(setCatalogoServicos).catch(() => {});
    listEstoqueItens().then(setEstoqueItens).catch(() => {});
  }, []);

  // #3: count per tab for badges
  const tabCounts = useMemo(() => ({
    todos: chamados.length,
    rascunho: chamados.filter(c => c.status === 'rascunho').length,
    em_validacao: chamados.filter(c => c.status === 'submetido' || c.status === 'validado_operador').length,
    rejeitado: chamados.filter(c => isRejectedStatus(c.status)).length,
    validado_financeiro: chamados.filter(c => c.status === 'validado_financeiro').length,
    pagamento_pendente: chamados.filter(c => c.status === 'pagamento_pendente').length,
    pago: chamados.filter(c => c.status === 'pago').length,
  }), [chamados]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = chamados.filter(c => {
      // #1 fix: em_validacao covers submetido + validado_operador
      if (tabStatus === 'em_validacao') {
        if (c.status !== 'submetido' && c.status !== 'validado_operador') return false;
      } else if (tabStatus === 'rejeitado') {
        if (!isRejectedStatus(c.status)) return false;
      } else if (tabStatus !== 'todos') {
        if (c.status !== tabStatus) return false;
      }
      if (filterTecnico !== 'todos' && c.tecnicoId !== filterTecnico) return false;
      if (filterLoja && !c.codigoLoja.toLowerCase().includes(filterLoja.toLowerCase())) return false;
      if (filterServico !== 'todos' && c.catalogoServicoId !== filterServico) return false;
      if (!matchesOperationalFilter(c, filterOperacional)) return false;
      // #11: date range filter
      if (filterDe && c.dataAtendimento < filterDe) return false;
      if (filterAte && c.dataAtendimento > filterAte) return false;
      if (q) {
        const matchMain =
          c.fsa.toLowerCase().includes(q) ||
          c.codigoLoja.toLowerCase().includes(q) ||
          c.tecnicoNome.toLowerCase().includes(q) ||
          (c.tecnicoCodigo?.toLowerCase().includes(q) ?? false) ||
          (c.catalogoServicoNome?.toLowerCase().includes(q) ?? false) ||
          (c.pecaUsada?.toLowerCase().includes(q) ?? false) ||
          (c.estoqueItemNome?.toLowerCase().includes(q) ?? false);
        const matchItens = c.itensAdicionais?.some(
          i => i.codigoChamado.toLowerCase().includes(q) || i.codigoLoja.toLowerCase().includes(q),
        ) ?? false;
        if (!matchMain && !matchItens) return false;
      }
      return true;
    });

    // #12: sort
    return [...list].sort((a, b) => {
      if (sortKey === 'data_asc') return a.dataAtendimento.localeCompare(b.dataAtendimento);
      if (sortKey === 'status') return a.status.localeCompare(b.status);
      return b.dataAtendimento.localeCompare(a.dataAtendimento); // data_desc default
    });
  }, [chamados, tabStatus, search, filterTecnico, filterLoja, filterServico, filterOperacional, filterDe, filterAte, sortKey]);

  const stats = useMemo(() => ({
    total: chamados.length,
    rascunho: chamados.filter(c => c.status === 'rascunho').length,
    submetido: chamados.filter(c => c.status === 'submetido' || c.status === 'validado_operador').length,
    rejeitado: chamados.filter(c => isRejectedStatus(c.status)).length,
    aprovado: chamados.filter(c => c.status === 'validado_financeiro').length,
  }), [chamados]);

  const handleSubmit = async (chamado: Chamado) => {
    setSubmetendoId(chamado.id);
    try {
      await submeterChamado(chamado.id, userId, userName);
      toast.success('Chamado submetido para validação.');
      fetchChamados();
    } catch { toast.error('Erro ao submeter chamado.'); }
    finally { setSubmetendoId(null); }
  };

  const handleResubmit = async (chamado: Chamado) => {
    setSubmetendoId(chamado.id);
    try {
      await resubmeterChamado(chamado.id, userId, userName, {});
      toast.success(`Chamado ${chamado.fsa} resubmetido para validação.`);
      fetchChamados();
    } catch { toast.error('Erro ao resubmeter chamado.'); }
    finally { setSubmetendoId(null); }
  };

  const hasDateFilter = filterDe || filterAte;
  const hasAnyFilter = Boolean(search || filterTecnico !== 'todos' || filterLoja || filterServico !== 'todos' || filterOperacional !== 'todos' || hasDateFilter);
  const clearAllFilters = () => {
    setSearch('');
    setFilterTecnico('todos');
    setFilterLoja('');
    setFilterServico('todos');
    setFilterOperacional('todos');
    setFilterDe('');
    setFilterAte('');
  };

  return (
    <div className="space-y-6 animate-page-in">
      {/* Header */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-primary via-primary/70 to-primary/30" />
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <ClipboardList className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Registro de Chamados</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Backoffice — controle de chamados subidos na plataforma do cliente
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* #13: Export CSV */}
            {filtered.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5"
                    onClick={() => exportToCSV(filtered)}>
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Exportar</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Exportar {filtered.length} chamado(s) para CSV</TooltipContent>
              </Tooltip>
            )}
            {permissions.canRegisterChamado && (
              <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
                <Plus className="w-4 h-4 mr-1.5" /> Registrar Chamado
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total, color: '' },
          { label: 'Em Validação', value: stats.submetido, color: 'border-blue-500/20 text-blue-600 dark:text-blue-400' },
          { label: 'Rejeitados', value: stats.rejeitado, color: 'border-red-500/20 text-red-600 dark:text-red-400' },
          { label: 'Aprovados', value: stats.aprovado, color: 'border-green-500/20 text-green-600 dark:text-green-400' },
        ].map(kpi => (
          <div key={kpi.label} className={cn('p-4 rounded-xl border-2 bg-background shadow-sm', kpi.color || 'border-border')}>
            <p className="text-xs font-medium text-muted-foreground mb-1">{kpi.label}</p>
            <p className={cn('text-2xl font-bold', kpi.color.split(' ').find(c => c.startsWith('text-')) || 'text-foreground')}>
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar código, loja ou técnico…" value={search}
              onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterTecnico} onValueChange={setFilterTecnico}>
            <SelectTrigger className="sm:w-48 shrink-0">
              <SelectValue placeholder="Todos os técnicos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os técnicos</SelectItem>
              {tecnicos.map(t => <SelectItem key={t.uid} value={t.uid}>{t.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          {/* #12: sort control */}
          <Select value={sortKey} onValueChange={v => setSortKey(v as typeof sortKey)}>
            <SelectTrigger className="sm:w-44 shrink-0 gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="data_desc">Data (mais recente)</SelectItem>
              <SelectItem value="data_asc">Data (mais antigo)</SelectItem>
              <SelectItem value="status">Status</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="Filtrar loja"
            value={filterLoja}
            onChange={e => setFilterLoja(e.target.value)}
            className="sm:w-36 shrink-0"
          />
          <Select value={filterServico} onValueChange={setFilterServico}>
            <SelectTrigger className="sm:w-64 shrink-0">
              <SelectValue placeholder="Todos os serviços" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os serviços</SelectItem>
              {catalogoServicos.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterOperacional} onValueChange={v => setFilterOperacional(v as OperationalFilter)}>
            <SelectTrigger className="sm:w-56 shrink-0">
              <SelectValue placeholder="Sinais internos" />
            </SelectTrigger>
            <SelectContent>
              {OPERATIONAL_FILTERS.map(f => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasAnyFilter && (
            <Button
              variant="ghost"
              size="sm"
              className="h-10 px-3 text-muted-foreground hover:text-foreground gap-1 shrink-0"
              onClick={clearAllFilters}
            >
              <X className="w-3.5 h-3.5" /> Limpar filtros
            </Button>
          )}
        </div>

        {/* #11: date range filter */}
        <div className="flex flex-wrap items-center gap-2">
          <CalendarDays className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <Label className="text-xs text-muted-foreground shrink-0">De</Label>
          <Input type="date" value={filterDe} onChange={e => setFilterDe(e.target.value)}
            className="h-8 w-36 text-xs" />
          <Label className="text-xs text-muted-foreground shrink-0">Até</Label>
          <Input type="date" value={filterAte} onChange={e => setFilterAte(e.target.value)}
            className="h-8 w-36 text-xs" />
          {hasDateFilter && (
            <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground hover:text-foreground gap-1"
              onClick={() => { setFilterDe(''); setFilterAte(''); }}>
              <X className="w-3.5 h-3.5" /> Limpar
            </Button>
          )}
        </div>
      </div>

      {/* Tabs + Lista */}
      <Tabs value={tabStatus} onValueChange={v => {
        setTabStatus(v);
        // #6: clear search when switching tabs
        setSearch('');
      }}>
        <TabsList className="flex-wrap h-auto gap-1">
          {STATUS_TABS.map(tab => {
            const count = tabCounts[tab.value as keyof typeof tabCounts] ?? 0;
            return (
              <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5">
                {tab.label}
                {/* #3: count badge */}
                {count > 0 && (
                  <span className={cn(
                    'inline-flex items-center justify-center rounded-full text-[10px] font-semibold min-w-[18px] h-[18px] px-1',
                    tabStatus === tab.value
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground',
                  )}>
                    {count}
                  </span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value={tabStatus} className="mt-4">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="Nenhum chamado encontrado"
              description={tabStatus !== 'todos' ? 'Tente ajustar os filtros ou mudar a aba.' : undefined}
              action={permissions.canRegisterChamado && tabStatus === 'todos' ? (
                <Button size="sm" variant="outline"
                  onClick={() => { setEditing(null); setFormOpen(true); }}>
                  <Plus className="w-4 h-4 mr-1.5" /> Registrar primeiro chamado
                </Button>
              ) : undefined}
            />
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground text-right pr-1">
                {filtered.length} chamado(s) exibido(s)
              </p>
              {filtered.map(c => (
                <ChamadoCard
                  key={c.id}
                  chamado={c}
                  canEdit={permissions.canRegisterChamado}
                  canSubmit={permissions.canRegisterChamado && submetendoId !== c.id}
                  onEdit={ch => { setEditing(ch); setFormOpen(true); }}
                  onSubmit={handleSubmit}
                  onResubmit={permissions.canRegisterChamado ? handleResubmit : undefined}
                  onDetail={ch => { setDetalhe(ch); setDetalheOpen(true); }}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <ChamadoFormDialog
        open={formOpen}
        onOpenChange={open => { setFormOpen(open); if (!open) setEditing(null); }}
        editing={editing}
        tecnicos={tecnicos}
        catalogoServicos={catalogoServicos}
        estoqueItens={estoqueItens}
        onSaved={fetchChamados}
        userName={userName}
        userId={userId}
        canViewFinancialValues={permissions.canViewFinancialValues}
      />

      <DetalheDialog
        chamado={detalhe}
        open={detalheOpen}
        onOpenChange={open => { setDetalheOpen(open); if (!open) setDetalhe(null); }}
        catalogoServicos={catalogoServicos}
        canViewFinancialValues={permissions.canViewFinancialValues}
      />
    </div>
  );
}
