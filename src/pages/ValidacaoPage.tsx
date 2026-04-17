import { useEffect, useState } from 'react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '../components/ui/dialog';
import { Separator } from '../components/ui/separator';
import { toast } from 'sonner';
import {
  CheckCircle2, XCircle, Eye, ClipboardList, Wrench, Package,
  Link as LinkIcon, Clock, History, AlertTriangle, Layers, RefreshCcw,
  ChevronsRight, Copy, User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/use-permissions';
import {
  listChamados, validarOperador, validarFinanceiro, rejeitarChamado,
} from '../lib/chamado-firestore';
import type { Chamado, HistoricoEntry } from '../types/chamado';
import { cn } from '../lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  rascunho:            'bg-muted text-muted-foreground border-border',
  submetido:           'bg-blue-500/10 text-blue-700 border-blue-500/25 dark:text-blue-400',
  validado_operador:   'bg-purple-500/10 text-purple-700 border-purple-500/25 dark:text-purple-400',
  rejeitado:           'bg-red-500/10 text-red-700 border-red-500/25 dark:text-red-400',
  validado_financeiro: 'bg-green-500/10 text-green-700 border-green-500/25 dark:text-green-400',
  pago:                'bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-400',
};

const STATUS_LABEL: Record<string, string> = {
  rascunho:            'Rascunho',
  submetido:           'Ag. Validação Op.',
  validado_operador:   'Ag. Validação Fin.',
  rejeitado:           'Rejeitado',
  validado_financeiro: 'Aprovado',
  pago:                'Pago',
};

const MOTIVOS_PRESET = [
  'Informações incompletas',
  'Código FSA inválido ou duplicado',
  'Loja incorreta',
  'Horário inconsistente',
  'Peça não autorizada',
  'Documentação faltando',
];

function fmtDate(d: string) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function fmtTs(ms: number) {
  return new Date(ms).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── DetalheDialog ────────────────────────────────────────────────────────────

function DetalheDialog({ chamado, open, onClose }: {
  chamado: Chamado | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!chamado) return null;
  const historicoRev = [...chamado.historico].reverse();

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            Cód. {chamado.fsa}
            {(chamado.itensAdicionais?.length ?? 0) > 0 && (
              <Badge variant="outline" className="text-[10px] gap-1 border-primary/30 text-primary">
                <Layers className="w-2.5 h-2.5" /> Lote: {(chamado.itensAdicionais?.length ?? 0) + 1}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>Detalhes e histórico do chamado</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div><p className="text-muted-foreground text-xs">Loja</p><p className="font-medium">{chamado.codigoLoja}</p></div>
            <div><p className="text-muted-foreground text-xs">Data</p><p className="font-medium">{fmtDate(chamado.dataAtendimento)}</p></div>
            <div>
              <p className="text-muted-foreground text-xs">Técnico</p>
              <p className="font-medium">
                {chamado.tecnicoCodigo && <span className="font-mono text-primary mr-1">{chamado.tecnicoCodigo}</span>}
                {chamado.tecnicoCodigo ? '— ' : ''}{chamado.tecnicoNome}
              </p>
              {chamado.tecnicoPaiCodigo && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                  Subcontratado de <span className="font-mono font-semibold">{chamado.tecnicoPaiCodigo}</span>
                  {chamado.pagamentoDestino === 'parent' && ' · pagamento ao pai'}
                </p>
              )}
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Status</p>
              <Badge variant="outline" className={cn('text-[11px]', STATUS_BADGE[chamado.status])}>
                {STATUS_LABEL[chamado.status]}
              </Badge>
            </div>
            {chamado.catalogoServicoNome && (
              <div className="col-span-2"><p className="text-muted-foreground text-xs">Serviço</p><p className="font-medium">{chamado.catalogoServicoNome}</p></div>
            )}
            {(chamado.horaInicio || chamado.horaFim) && (
              <div className="col-span-2 flex items-center gap-2 text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                <span>{chamado.horaInicio ?? '—'} → {chamado.horaFim ?? '—'}</span>
                {chamado.durationMinutes != null && <span className="text-xs">({chamado.durationMinutes} min)</span>}
              </div>
            )}
            {chamado.pecaUsada && (
              <div className="col-span-2 flex items-start gap-2">
                <Package className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                <div>
                  <span className="font-medium">{chamado.pecaUsada}</span>
                  {chamado.custoPeca != null && (
                    <span className="text-muted-foreground ml-2">R$ {chamado.custoPeca.toFixed(2)} — {chamado.fornecedorPeca}</span>
                  )}
                </div>
              </div>
            )}
            {chamado.linkPlataforma && (
              <div className="col-span-2 flex items-center gap-2">
                <LinkIcon className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                <a href={chamado.linkPlataforma} target="_blank" rel="noopener noreferrer"
                  className="text-primary underline-offset-2 hover:underline truncate">
                  {chamado.linkPlataforma}
                </a>
              </div>
            )}
            {chamado.registradoPorNome && (
              <div className="col-span-2 flex items-center gap-2 text-muted-foreground">
                <User className="w-3.5 h-3.5" />
                <span className="text-xs">Registrado por <span className="font-medium text-foreground">{chamado.registradoPorNome}</span></span>
              </div>
            )}
            {chamado.observacoes && (
              <div className="col-span-2"><p className="text-muted-foreground text-xs">Observações</p><p>{chamado.observacoes}</p></div>
            )}
            {chamado.motivoRejeicao && (
              <div className="col-span-2 rounded-md border border-red-300 bg-red-500/10 p-2 text-red-700 dark:text-red-400 text-xs">
                <p className="font-semibold mb-0.5">Motivo de rejeição</p>
                <p>{chamado.motivoRejeicao}</p>
              </div>
            )}
          </div>

          {(chamado.itensAdicionais?.length ?? 0) > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" /> Itens do Lote ({(chamado.itensAdicionais?.length ?? 0) + 1})
                </p>
                <div className="rounded-lg border border-border overflow-hidden text-xs">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-2 py-1.5 text-muted-foreground font-medium">#</th>
                        <th className="text-left px-2 py-1.5 text-muted-foreground font-medium">Código</th>
                        <th className="text-left px-2 py-1.5 text-muted-foreground font-medium">Loja</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      <tr className="bg-primary/5">
                        <td className="px-2 py-1.5 text-muted-foreground">1</td>
                        <td className="px-2 py-1.5 font-mono font-semibold">{chamado.fsa}</td>
                        <td className="px-2 py-1.5">{chamado.codigoLoja}</td>
                      </tr>
                      {chamado.itensAdicionais!.map((item, i) => (
                        <tr key={i}>
                          <td className="px-2 py-1.5 text-muted-foreground">{i + 2}</td>
                          <td className="px-2 py-1.5 font-mono">{item.codigoChamado}</td>
                          <td className="px-2 py-1.5">{item.codigoLoja}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          <Separator />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" /> Histórico
            </p>
            <div className="space-y-2">
              {historicoRev.map((h: HistoricoEntry, i: number) => (
                <div key={i} className="flex gap-2.5 text-xs">
                  <div className="mt-0.5 shrink-0 w-2 h-2 rounded-full bg-primary/50 ring-2 ring-primary/20 self-start translate-y-1" />
                  <div>
                    <p className="font-medium">
                      <Badge variant="outline" className={cn('text-[10px] mr-1', STATUS_BADGE[h.status])}>
                        {STATUS_LABEL[h.status]}
                      </Badge>
                      {h.porNome}
                    </p>
                    {h.observacao && <p className="text-muted-foreground">{h.observacao}</p>}
                    <p className="text-muted-foreground/70">{fmtTs(h.em)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 sm:mr-auto"
            onClick={() => {
              const url = `${window.location.origin}/validacao?chamado=${chamado.id}`;
              navigator.clipboard.writeText(url).then(
                () => toast.success('Link de validação copiado!'),
                () => toast.error('Não foi possível copiar o link.'),
              );
            }}
          >
            <Copy className="w-3.5 h-3.5" /> Copiar Link de Validação
          </Button>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── RejeitarDialog ───────────────────────────────────────────────────────────

function RejeitarDialog({ chamado, open, onClose, onConfirm, loading }: {
  chamado: Chamado | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (motivo: string) => void;
  loading: boolean;
}) {
  const [motivo, setMotivo] = useState('');

  useEffect(() => { if (open) setMotivo(''); }, [open]);

  if (!chamado) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-destructive" /> Rejeitar Chamado
          </DialogTitle>
          <DialogDescription>
            Cód. <strong>{chamado.fsa}</strong> — Loja {chamado.codigoLoja}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Motivos rápidos */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Motivos frequentes:</p>
            <div className="flex flex-wrap gap-1.5">
              {MOTIVOS_PRESET.map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMotivo(m)}
                  className={cn(
                    'text-[11px] px-2 py-1 rounded-full border transition-all',
                    motivo === m
                      ? 'bg-destructive/10 border-destructive/40 text-destructive font-semibold'
                      : 'border-border text-muted-foreground hover:border-destructive/30 hover:text-foreground',
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Motivo <span className="text-destructive">*</span></Label>
            <Textarea
              placeholder="Descreva o problema encontrado..."
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(motivo)}
            disabled={loading || !motivo.trim()}
          >
            {loading ? 'Processando...' : 'Rejeitar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── ChamadoValidacaoCard ─────────────────────────────────────────────────────

function ChamadoValidacaoCard({ chamado, onVer, onAprovar, onRejeitar, canAprovar, aprovando }: {
  chamado: Chamado;
  onVer: () => void;
  onAprovar: () => void;
  onRejeitar: () => void;
  canAprovar: boolean;
  aprovando: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3 hover:border-primary/30 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">Cód. {chamado.fsa}</span>
            {(chamado.itensAdicionais?.length ?? 0) > 0 && (
              <Badge variant="outline" className="text-[10px] gap-1 border-primary/30 text-primary">
                <Layers className="w-2.5 h-2.5" /> Lote: {(chamado.itensAdicionais?.length ?? 0) + 1}
              </Badge>
            )}
            <Badge variant="outline" className={cn('text-[11px]', STATUS_BADGE[chamado.status])}>
              {STATUS_LABEL[chamado.status]}
            </Badge>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1"><ClipboardList className="w-3 h-3" /> Loja {chamado.codigoLoja}</span>
            <span>{fmtDate(chamado.dataAtendimento)}</span>
            <span className="flex items-center gap-1">
              <Wrench className="w-3 h-3" />
              {chamado.tecnicoCodigo && <span className="font-mono text-primary font-semibold">{chamado.tecnicoCodigo}</span>}
              {chamado.tecnicoCodigo ? ' — ' : ''}{chamado.tecnicoNome}
            </span>
            {chamado.tecnicoPaiCodigo && (
              <span className="text-[10px] text-amber-600 dark:text-amber-400">
                ↳ sub de <span className="font-mono">{chamado.tecnicoPaiCodigo}</span>
              </span>
            )}
            {chamado.registradoPorNome && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" /> {chamado.registradoPorNome}
              </span>
            )}
          </div>
        </div>
        <Button variant="ghost" size="sm" className="shrink-0 h-8 w-8 p-0" onClick={onVer} title="Ver detalhes">
          <Eye className="w-4 h-4" />
        </Button>
      </div>

      {/* Badges de serviço / peça */}
      <div className="flex flex-wrap gap-1.5">
        {chamado.catalogoServicoNome && (
          <Badge variant="secondary" className="text-[11px] gap-1">
            <ClipboardList className="w-3 h-3" />{chamado.catalogoServicoNome}
          </Badge>
        )}
        {chamado.pecaUsada && (
          <Badge variant="outline" className="text-[11px] gap-1 border-orange-300 text-orange-700 dark:text-orange-400">
            <Package className="w-3 h-3" />{chamado.pecaUsada}
            {chamado.custoPeca != null && ` — R$${chamado.custoPeca.toFixed(2)}`}
          </Badge>
        )}
        {chamado.linkPlataforma && (
          <Badge variant="outline" className="text-[11px] gap-1">
            <LinkIcon className="w-3 h-3" />Link
          </Badge>
        )}
      </div>

      {/* Ações — aprovação direta (1 clique), rejeição abre dialog */}
      {canAprovar && (
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
            onClick={onRejeitar}
            disabled={aprovando}
          >
            <XCircle className="w-3.5 h-3.5" /> Rejeitar
          </Button>
          <Button
            size="sm"
            className="flex-1 gap-1.5 bg-green-600 hover:bg-green-700 text-white"
            onClick={onAprovar}
            disabled={aprovando}
          >
            {aprovando
              ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Aprovando…</>
              : <><CheckCircle2 className="w-3.5 h-3.5" /> Aprovar</>
            }
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
      <CheckCircle2 className="w-10 h-10 opacity-30" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

// ─── KpiCard ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, color }: { label: string; value: number | string; color: 'blue' | 'purple' }) {
  const colors = {
    blue:   { bg: 'bg-blue-500/10',   text: 'text-blue-700 dark:text-blue-400',     border: 'border-blue-200 dark:border-blue-800' },
    purple: { bg: 'bg-purple-500/10', text: 'text-purple-700 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-800' },
  };
  const c = colors[color];
  return (
    <div className={cn('rounded-xl border p-4 space-y-1', c.bg, c.border)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('text-2xl font-bold', c.text)}>{value}</p>
    </div>
  );
}

// ─── ValidacaoPage ────────────────────────────────────────────────────────────

export default function ValidacaoPage() {
  const { user, profile } = useAuth();
  const { permissions } = usePermissions();

  const [submetidos, setSubmetidos] = useState<Chamado[]>([]);
  const [validadosOp, setValidadosOp] = useState<Chamado[]>([]);
  const [loading, setLoading] = useState(true);

  // IDs sendo aprovados individualmente (spinner no botão)
  const [aprovandoIds, setAprovandoIds] = useState<Set<string>>(new Set());
  // IDs sendo aprovados em lote
  const [aprovandoTodos, setAprovandoTodos] = useState(false);

  // Dialog de detalhe
  const [detalheOpen, setDetalheOpen] = useState(false);
  const [chamadoVisto, setChamadoVisto] = useState<Chamado | null>(null);

  // Dialog de rejeição
  const [rejeitarOpen, setRejeitarOpen] = useState(false);
  const [chamadoRejeitar, setChamadoRejeitar] = useState<Chamado | null>(null);
  const [etapaRejeitar, setEtapaRejeitar] = useState<'operador' | 'financeiro'>('operador');
  const [rejeitando, setRejeitando] = useState(false);

  const canValidateOp  = permissions.canValidateOperador;
  const canValidateFin = permissions.canValidateFinanceiro;

  async function loadData() {
    setLoading(true);
    try {
      const [s, v] = await Promise.all([
        canValidateOp  ? listChamados({ status: 'submetido' }) : Promise.resolve([]),
        canValidateFin ? listChamados({ status: 'validado_operador' }) : Promise.resolve([]),
      ]);
      setSubmetidos(s);
      setValidadosOp(v);
    } catch {
      toast.error('Erro ao carregar chamados.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const por     = user?.uid ?? '';
  const porNome = profile?.nome || user?.email || 'Usuário';

  // Aprovação direta — sem dialog
  async function aprovar(c: Chamado, etapa: 'operador' | 'financeiro') {
    setAprovandoIds(prev => new Set(prev).add(c.id));
    try {
      if (etapa === 'operador') {
        await validarOperador(c.id, por, porNome, undefined);
      } else {
        await validarFinanceiro(c.id, por, porNome, undefined);
      }
      toast.success(`Chamado ${c.fsa} aprovado.`);
      await loadData();
    } catch {
      toast.error('Erro ao aprovar chamado.');
    } finally {
      setAprovandoIds(prev => { const n = new Set(prev); n.delete(c.id); return n; });
    }
  }

  // Aprovar todos da fila de uma vez
  async function aprovarTodos(lista: Chamado[], etapa: 'operador' | 'financeiro') {
    setAprovandoTodos(true);
    let ok = 0;
    let err = 0;
    for (const c of lista) {
      try {
        if (etapa === 'operador') await validarOperador(c.id, por, porNome, undefined);
        else await validarFinanceiro(c.id, por, porNome, undefined);
        ok++;
      } catch {
        err++;
      }
    }
    if (ok > 0) toast.success(`${ok} chamado(s) aprovado(s).`);
    if (err > 0) toast.error(`${err} falha(s) ao aprovar.`);
    setAprovandoTodos(false);
    await loadData();
  }

  // Rejeição — abre dialog com presets
  function abrirRejeitar(c: Chamado, etapa: 'operador' | 'financeiro') {
    setChamadoRejeitar(c);
    setEtapaRejeitar(etapa);
    setRejeitarOpen(true);
  }

  async function confirmarRejeicao(motivo: string) {
    if (!chamadoRejeitar) return;
    setRejeitando(true);
    try {
      await rejeitarChamado(chamadoRejeitar.id, por, porNome, motivo);
      toast.success(`Chamado ${chamadoRejeitar.fsa} rejeitado.`);
      setRejeitarOpen(false);
      await loadData();
    } catch {
      toast.error('Erro ao rejeitar chamado.');
    } finally {
      setRejeitando(false);
    }
  }

  const defaultTab = canValidateOp ? 'operador' : 'financeiro';

  return (
    <div className="space-y-6 animate-page-in">
      {/* Header */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-primary via-primary/70 to-primary/30" />
        <div className="flex items-center gap-4 px-6 py-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Fila de Validação</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Revise e aprove chamados antes de liberar para pagamento
            </p>
          </div>
          <Button variant="outline" size="sm" className="ml-auto gap-1.5" onClick={loadData} disabled={loading}>
            <RefreshCcw className="w-3.5 h-3.5" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Ag. validação operador"  value={loading ? '—' : submetidos.length}  color="blue"   />
        <KpiCard label="Ag. validação financeiro" value={loading ? '—' : validadosOp.length} color="purple" />
      </div>

      {!canValidateOp && !canValidateFin && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-500/10 p-4 text-amber-700 dark:text-amber-400">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <p className="text-sm">Você não tem permissão para validar chamados.</p>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue={defaultTab}>
        <TabsList>
          {canValidateOp && (
            <TabsTrigger value="operador" className="gap-1.5">
              Validação Operador
              {!loading && submetidos.length > 0 && (
                <span className="ml-1 rounded-full bg-blue-500 text-white text-[10px] px-1.5 py-0.5 leading-none font-bold">
                  {submetidos.length}
                </span>
              )}
            </TabsTrigger>
          )}
          {canValidateFin && (
            <TabsTrigger value="financeiro" className="gap-1.5">
              Validação Financeiro
              {!loading && validadosOp.length > 0 && (
                <span className="ml-1 rounded-full bg-purple-500 text-white text-[10px] px-1.5 py-0.5 leading-none font-bold">
                  {validadosOp.length}
                </span>
              )}
            </TabsTrigger>
          )}
        </TabsList>

        {/* ── Tab Operador ── */}
        {canValidateOp && (
          <TabsContent value="operador" className="mt-4 space-y-3">
            {loading ? (
              <div className="grid gap-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
              </div>
            ) : submetidos.length === 0 ? (
              <EmptyState label="Nenhum chamado aguardando validação de operador." />
            ) : (
              <>
                {/* Aprovar todos */}
                {submetidos.length > 1 && (
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-green-700 border-green-500/40 hover:bg-green-500/10"
                      onClick={() => aprovarTodos(submetidos, 'operador')}
                      disabled={aprovandoTodos}
                    >
                      <ChevronsRight className="w-3.5 h-3.5" />
                      {aprovandoTodos ? 'Aprovando…' : `Aprovar todos (${submetidos.length})`}
                    </Button>
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  {submetidos.map(c => (
                    <ChamadoValidacaoCard
                      key={c.id}
                      chamado={c}
                      canAprovar={canValidateOp}
                      aprovando={aprovandoIds.has(c.id) || aprovandoTodos}
                      onVer={() => { setChamadoVisto(c); setDetalheOpen(true); }}
                      onAprovar={() => aprovar(c, 'operador')}
                      onRejeitar={() => abrirRejeitar(c, 'operador')}
                    />
                  ))}
                </div>
              </>
            )}
          </TabsContent>
        )}

        {/* ── Tab Financeiro ── */}
        {canValidateFin && (
          <TabsContent value="financeiro" className="mt-4 space-y-3">
            {loading ? (
              <div className="grid gap-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
              </div>
            ) : validadosOp.length === 0 ? (
              <EmptyState label="Nenhum chamado aguardando validação financeira." />
            ) : (
              <>
                {validadosOp.length > 1 && (
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-green-700 border-green-500/40 hover:bg-green-500/10"
                      onClick={() => aprovarTodos(validadosOp, 'financeiro')}
                      disabled={aprovandoTodos}
                    >
                      <ChevronsRight className="w-3.5 h-3.5" />
                      {aprovandoTodos ? 'Aprovando…' : `Aprovar todos (${validadosOp.length})`}
                    </Button>
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  {validadosOp.map(c => (
                    <ChamadoValidacaoCard
                      key={c.id}
                      chamado={c}
                      canAprovar={canValidateFin}
                      aprovando={aprovandoIds.has(c.id) || aprovandoTodos}
                      onVer={() => { setChamadoVisto(c); setDetalheOpen(true); }}
                      onAprovar={() => aprovar(c, 'financeiro')}
                      onRejeitar={() => abrirRejeitar(c, 'financeiro')}
                    />
                  ))}
                </div>
              </>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* Dialogs */}
      <DetalheDialog
        chamado={chamadoVisto}
        open={detalheOpen}
        onClose={() => setDetalheOpen(false)}
      />
      <RejeitarDialog
        chamado={chamadoRejeitar}
        open={rejeitarOpen}
        onClose={() => setRejeitarOpen(false)}
        onConfirm={confirmarRejeicao}
        loading={rejeitando}
      />
    </div>
  );
}
