import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
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
  ChevronsRight, Copy, User, Lock, Plus, Trash2, Settings2, Loader2,
} from 'lucide-react';
import { Input } from '../components/ui/input';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/use-permissions';
import {
  listChamados, validarOperador, validarFinanceiro, rejeitarChamado,
  iniciarRevisao, liberarRevisao,
} from '../lib/chamado-firestore';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Chamado, HistoricoEntry } from '../types/chamado';
import { cn } from '../lib/utils';
import { CHAMADO_STATUS_CONFIG } from '../lib/statusConfig';
import { EmptyState as SharedEmptyState } from '../components/EmptyState';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = Object.fromEntries(
  Object.entries(CHAMADO_STATUS_CONFIG).map(([k, v]) => [k, v.badge])
);

const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(CHAMADO_STATUS_CONFIG).map(([k, v]) => [k, v.label])
);

const MOTIVOS_PRESET_DEFAULT = [
  'Informações incompletas',
  'Código FSA inválido ou duplicado',
  'Loja incorreta',
  'Horário inconsistente',
  'Peça não autorizada',
  'Documentação faltando',
];

const MOTIVOS_DOC = 'configuracoes/motivosRejeicao';

/** Horas desde o registro do chamado */
function horasDesde(registradoEm: number): number {
  return (Date.now() - registradoEm) / 3_600_000;
}

/** Urgência: submetido >24h ou validado_operador >48h */
function urgenciaSla(c: Chamado): 'critical' | 'warning' | null {
  const h = horasDesde(c.registradoEm);
  if (c.status === 'submetido') {
    if (h >= 48) return 'critical';
    if (h >= 24) return 'warning';
  }
  if (c.status === 'validado_operador') {
    if (h >= 96) return 'critical';
    if (h >= 48) return 'warning';
  }
  return null;
}

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
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
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

function RejeitarDialog({ chamado, open, onClose, onConfirm, loading, motivos, canEditMotivos, onSaveMotivos }: {
  chamado: Chamado | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (motivo: string) => void;
  loading: boolean;
  motivos: string[];
  canEditMotivos: boolean;
  onSaveMotivos: (lista: string[]) => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [editingMotivos, setEditingMotivos] = useState(false);
  const [motivosDraft, setMotivosDraft] = useState<string[]>([]);
  const [novoMotivo, setNovoMotivo] = useState('');

  useEffect(() => { if (open) { setMotivo(''); setEditingMotivos(false); } }, [open]);

  if (!chamado) return null;

  const handleSaveMotivos = () => {
    onSaveMotivos(motivosDraft.filter(m => m.trim()));
    setEditingMotivos(false);
  };

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
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">Motivos frequentes:</p>
              {canEditMotivos && !editingMotivos && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  onClick={() => { setMotivosDraft([...motivos]); setEditingMotivos(true); }}
                >
                  <Settings2 className="w-3 h-3" /> Editar lista
                </button>
              )}
            </div>

            {editingMotivos ? (
              <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Gerenciar motivos</p>
                {motivosDraft.map((m, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <Input
                      value={m}
                      onChange={e => setMotivosDraft(prev => prev.map((v, idx) => idx === i ? e.target.value : v))}
                      className="h-7 text-xs"
                    />
                    <button type="button" onClick={() => setMotivosDraft(prev => prev.filter((_, idx) => idx !== i))}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive/70 hover:text-destructive" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-1.5">
                  <Input
                    placeholder="Novo motivo…"
                    value={novoMotivo}
                    onChange={e => setNovoMotivo(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && novoMotivo.trim()) { setMotivosDraft(p => [...p, novoMotivo.trim()]); setNovoMotivo(''); } }}
                    className="h-7 text-xs"
                  />
                  <Button type="button" size="sm" variant="outline" className="h-7 px-2"
                    onClick={() => { if (novoMotivo.trim()) { setMotivosDraft(p => [...p, novoMotivo.trim()]); setNovoMotivo(''); } }}>
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button type="button" size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => setEditingMotivos(false)}>Cancelar</Button>
                  <Button type="button" size="sm" className="flex-1 h-7 text-xs" onClick={handleSaveMotivos}>Salvar</Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {motivos.map(m => (
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
            )}
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

function ChamadoValidacaoCard({ chamado, onVer, onAprovar, onRejeitar, canAprovar, aprovando, currentUserUid, selected, onToggleSelect }: {
  chamado: Chamado;
  onVer: () => void;
  onAprovar: () => void;
  onRejeitar: () => void;
  canAprovar: boolean;
  aprovando: boolean;
  currentUserUid: string;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const sla = urgenciaSla(chamado);
  const lockedByOther = chamado.emRevisaoPor && chamado.emRevisaoPor !== currentUserUid;
  const h = Math.floor(horasDesde(chamado.registradoEm));

  return (
    <div className={cn(
      'rounded-xl border bg-card p-4 space-y-3 hover:border-primary/30 transition-colors',
      sla === 'critical' ? 'border-red-400/60' : sla === 'warning' ? 'border-amber-400/60' : 'border-border',
      selected && 'ring-2 ring-primary/40',
    )}>
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
            {sla === 'critical' && (
              <Badge variant="outline" className="text-[10px] gap-1 border-red-400/60 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20">
                <AlertTriangle className="w-2.5 h-2.5" /> {h}h — urgente
              </Badge>
            )}
            {sla === 'warning' && (
              <Badge variant="outline" className="text-[10px] gap-1 border-amber-400/60 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20">
                <Clock className="w-2.5 h-2.5" /> {h}h em fila
              </Badge>
            )}
            {lockedByOther && (
              <Badge variant="outline" className="text-[10px] gap-1 border-slate-400/40 text-slate-500">
                <Lock className="w-2.5 h-2.5" /> Em revisão por {chamado.emRevisaoPorNome}
              </Badge>
            )}
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
        <div className="flex items-center gap-1 shrink-0">
          {onToggleSelect && (
            <Checkbox
              checked={!!selected}
              onCheckedChange={onToggleSelect}
              className="h-4 w-4"
              aria-label="Selecionar"
            />
          )}
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onVer} title="Ver detalhes">
            <Eye className="w-4 h-4" />
          </Button>
        </div>
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
            disabled={aprovando || !!lockedByOther}
            title={lockedByOther ? `Em revisão por ${chamado.emRevisaoPorNome}` : undefined}
          >
            <XCircle className="w-3.5 h-3.5" /> Rejeitar
          </Button>
          <Button
            size="sm"
            className="flex-1 gap-1.5 bg-green-600 hover:bg-green-700 text-white"
            onClick={onAprovar}
            disabled={aprovando || !!lockedByOther}
            title={lockedByOther ? `Em revisão por ${chamado.emRevisaoPorNome}` : undefined}
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

function EmptyState({ label }: { label: string }) {
  return <SharedEmptyState icon={CheckCircle2} title={label} />;
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

// ─── BatchRejeitarDialog ──────────────────────────────────────────────────────

function BatchRejeitarDialog({ chamados, open, onClose, onConfirm, loading, motivos }: {
  chamados: Chamado[];
  open: boolean;
  onClose: () => void;
  onConfirm: (items: { id: string; motivo: string }[]) => void;
  loading: boolean;
  motivos: string[];
}) {
  const [motivoPorId, setMotivoPorId] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      const init: Record<string, string> = {};
      chamados.forEach(c => { init[c.id] = motivos[0] ?? ''; });
      setMotivoPorId(init);
    }
  }, [open, chamados, motivos]);

  const allFilled = chamados.every(c => (motivoPorId[c.id] ?? '').trim());

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Rejeitar {chamados.length} chamado(s)</DialogTitle>
          <DialogDescription>Selecione o motivo de rejeição para cada chamado.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {chamados.map(c => (
            <div key={c.id} className="rounded-lg border border-border p-3 space-y-2">
              <div>
                <p className="text-sm font-medium">FSA {c.fsa} — Loja {c.codigoLoja}</p>
                <p className="text-xs text-muted-foreground">{c.tecnicoNome} · {fmtDate(c.dataAtendimento)}</p>
              </div>
              <select
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                value={motivoPorId[c.id] ?? ''}
                onChange={e => setMotivoPorId(prev => ({ ...prev, [c.id]: e.target.value }))}
              >
                <option value="">Selecione o motivo…</option>
                {motivos.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(chamados.map(c => ({ id: c.id, motivo: motivoPorId[c.id] ?? '' })))}
            disabled={loading || !allFilled}
          >
            {loading
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Rejeitando…</>
              : `Confirmar ${chamados.length} rejeição(ões)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── ValidacaoPage ────────────────────────────────────────────────────────────

export default function ValidacaoPage() {
  const { user, profile } = useAuth();
  const { permissions } = usePermissions();

  const [submetidos, setSubmetidos] = useState<Chamado[]>([]);
  const [validadosOp, setValidadosOp] = useState<Chamado[]>([]);
  const [rejeitados, setRejeitados] = useState<Chamado[]>([]);
  const [loading, setLoading] = useState(true);

  // IDs sendo aprovados individualmente (spinner no botão)
  const [aprovandoIds, setAprovandoIds] = useState<Set<string>>(new Set());
  // IDs sendo aprovados em lote
  const [aprovandoTodos, setAprovandoTodos] = useState(false);

  // Dialog de detalhe
  const [detalheOpen, setDetalheOpen] = useState(false);
  const [chamadoVisto, setChamadoVisto] = useState<Chamado | null>(null);

  // Dialog de rejeição individual
  const [rejeitarOpen, setRejeitarOpen] = useState(false);
  const [chamadoRejeitar, setChamadoRejeitar] = useState<Chamado | null>(null);
  const [etapaRejeitar, setEtapaRejeitar] = useState<'operador' | 'financeiro'>('operador');
  const [rejeitando, setRejeitando] = useState(false);

  // Seleção em lote
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchRejeitarOpen, setBatchRejeitarOpen] = useState(false);
  const [batchRejeitando, setBatchRejeitando] = useState(false);

  const canValidateOp  = permissions.canValidateOperador;
  const canValidateFin = permissions.canValidateFinanceiro;

  // Motivos de rejeição configuráveis — carregados do Firestore com fallback
  const [motivos, setMotivos] = useState<string[]>(MOTIVOS_PRESET_DEFAULT);
  useEffect(() => {
    getDoc(doc(db, MOTIVOS_DOC)).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data.motivos) && data.motivos.length > 0) setMotivos(data.motivos);
      }
    }).catch(() => {});
  }, []);

  const handleSaveMotivos = async (lista: string[]) => {
    try {
      await setDoc(doc(db, MOTIVOS_DOC), { motivos: lista });
      setMotivos(lista);
      toast.success('Lista de motivos atualizada.');
    } catch { toast.error('Erro ao salvar motivos.'); }
  };

  // Lock refs — armazena IDs que este usuário bloqueou para liberar ao sair
  const lockedByMeRef = useRef<Set<string>>(new Set());

  async function acquireLock(c: Chamado) {
    if (c.emRevisaoPor && c.emRevisaoPor !== por) return; // já bloqueado por outro
    try {
      await iniciarRevisao(c.id, por, porNome);
      lockedByMeRef.current.add(c.id);
    } catch { /* non-critical */ }
  }

  async function releaseLock(id: string) {
    if (!lockedByMeRef.current.has(id)) return;
    try {
      await liberarRevisao(id);
      lockedByMeRef.current.delete(id);
    } catch { /* non-critical */ }
  }

  async function loadData() {
    setLoading(true);
    try {
      const [s, v, r] = await Promise.all([
        canValidateOp  ? listChamados({ status: 'submetido' }) : Promise.resolve([]),
        canValidateFin ? listChamados({ status: 'validado_operador' }) : Promise.resolve([]),
        listChamados({ status: 'rejeitado' }),
      ]);
      setSubmetidos(s);
      setValidadosOp(v);
      setRejeitados(r);
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
    await acquireLock(c);
    try {
      if (etapa === 'operador') {
        await validarOperador(c.id, por, porNome, undefined);
      } else {
        await validarFinanceiro(c.id, por, porNome, undefined);
      }
      lockedByMeRef.current.delete(c.id); // lock liberado pela transição de status
      const proximaEtapa = etapa === 'operador' ? 'aguardando validação financeira' : 'aprovado e pronto para pagamento';
      toast.success(`Chamado ${c.fsa} aprovado — ${proximaEtapa}.`);
      await loadData();
    } catch {
      await releaseLock(c.id);
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
  async function abrirRejeitar(c: Chamado, etapa: 'operador' | 'financeiro') {
    await acquireLock(c);
    setChamadoRejeitar(c);
    setEtapaRejeitar(etapa);
    setRejeitarOpen(true);
  }

  async function fecharRejeitar() {
    if (chamadoRejeitar) await releaseLock(chamadoRejeitar.id);
    setRejeitarOpen(false);
  }

  async function confirmarRejeicao(motivo: string) {
    if (!chamadoRejeitar) return;
    setRejeitando(true);
    try {
      await rejeitarChamado(chamadoRejeitar.id, por, porNome, motivo);
      lockedByMeRef.current.delete(chamadoRejeitar.id);
      toast.success(`Chamado ${chamadoRejeitar.fsa} rejeitado — devolvido ao técnico para correção.`);
      setRejeitarOpen(false);
      await loadData();
    } catch {
      await releaseLock(chamadoRejeitar.id);
      toast.error('Erro ao rejeitar chamado.');
    } finally {
      setRejeitando(false);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function aprovarLote(ids: string[], etapa: 'operador' | 'financeiro') {
    setAprovandoTodos(true);
    let ok = 0;
    for (const id of ids) {
      try {
        etapa === 'operador'
          ? await validarOperador(id, por, porNome)
          : await validarFinanceiro(id, por, porNome);
        ok++;
      } catch {}
    }
    setSelectedIds(new Set());
    setAprovandoTodos(false);
    if (ok > 0) toast.success(`${ok} chamado(s) aprovado(s).`);
    await loadData();
  }

  async function confirmarRejeicaoLote(items: { id: string; motivo: string }[]) {
    setBatchRejeitando(true);
    let ok = 0;
    for (const item of items) {
      try {
        await rejeitarChamado(item.id, por, porNome, item.motivo);
        lockedByMeRef.current.delete(item.id);
        ok++;
      } catch {}
    }
    setBatchRejeitarOpen(false);
    setSelectedIds(new Set());
    setBatchRejeitando(false);
    if (ok > 0) toast.success(`${ok} chamado(s) rejeitado(s).`);
    await loadData();
  }

  const defaultTab = canValidateOp ? 'operador' : 'financeiro';

  const motivosBreakdown = useMemo(() => {
    const freq = new Map<string, number>();
    for (const c of rejeitados) {
      const m = c.motivoRejeicao?.trim() || '(sem motivo)';
      freq.set(m, (freq.get(m) ?? 0) + 1);
    }
    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([motivo, count]) => ({ motivo, count, pct: Math.round((count / rejeitados.length) * 100) }));
  }, [rejeitados]);

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
                {/* Barra de ações em lote (operador) */}
                {(() => {
                  const sel = submetidos.filter(c => selectedIds.has(c.id));
                  return sel.length > 0 ? (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5">
                      <span className="text-sm font-medium text-primary">{sel.length} selecionado(s)</span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedIds(new Set())}>
                          Limpar
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs text-destructive border-destructive/40 hover:bg-destructive/10"
                          onClick={() => setBatchRejeitarOpen(true)} disabled={aprovandoTodos}>
                          <XCircle className="w-3.5 h-3.5" /> Rejeitar ({sel.length})
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs text-green-700 border-green-500/40 hover:bg-green-500/10"
                          onClick={() => aprovarLote(sel.map(c => c.id), 'operador')} disabled={aprovandoTodos}>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Aprovar ({sel.length})
                        </Button>
                      </div>
                    </div>
                  ) : null;
                })()}
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
                      currentUserUid={por}
                      onVer={() => { setChamadoVisto(c); setDetalheOpen(true); }}
                      onAprovar={() => aprovar(c, 'operador')}
                      onRejeitar={() => abrirRejeitar(c, 'operador')}
                      selected={selectedIds.has(c.id)}
                      onToggleSelect={() => toggleSelect(c.id)}
                    />
                  ))}
                </div>
                <BatchRejeitarDialog
                  chamados={submetidos.filter(c => selectedIds.has(c.id))}
                  open={batchRejeitarOpen && submetidos.some(c => selectedIds.has(c.id))}
                  onClose={() => setBatchRejeitarOpen(false)}
                  onConfirm={confirmarRejeicaoLote}
                  loading={batchRejeitando}
                  motivos={motivos}
                />
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
                {/* Barra de ações em lote (financeiro) */}
                {(() => {
                  const sel = validadosOp.filter(c => selectedIds.has(c.id));
                  return sel.length > 0 ? (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5">
                      <span className="text-sm font-medium text-primary">{sel.length} selecionado(s)</span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedIds(new Set())}>
                          Limpar
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs text-destructive border-destructive/40 hover:bg-destructive/10"
                          onClick={() => setBatchRejeitarOpen(true)} disabled={aprovandoTodos}>
                          <XCircle className="w-3.5 h-3.5" /> Rejeitar ({sel.length})
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs text-green-700 border-green-500/40 hover:bg-green-500/10"
                          onClick={() => aprovarLote(sel.map(c => c.id), 'financeiro')} disabled={aprovandoTodos}>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Aprovar ({sel.length})
                        </Button>
                      </div>
                    </div>
                  ) : null;
                })()}
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
                      currentUserUid={por}
                      onVer={() => { setChamadoVisto(c); setDetalheOpen(true); }}
                      onAprovar={() => aprovar(c, 'financeiro')}
                      onRejeitar={() => abrirRejeitar(c, 'financeiro')}
                      selected={selectedIds.has(c.id)}
                      onToggleSelect={() => toggleSelect(c.id)}
                    />
                  ))}
                </div>
                <BatchRejeitarDialog
                  chamados={validadosOp.filter(c => selectedIds.has(c.id))}
                  open={batchRejeitarOpen && validadosOp.some(c => selectedIds.has(c.id))}
                  onClose={() => setBatchRejeitarOpen(false)}
                  onConfirm={confirmarRejeicaoLote}
                  loading={batchRejeitando}
                  motivos={motivos}
                />
              </>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* Relatório de rejeições por motivo */}
      {(canValidateOp || canValidateFin) && motivosBreakdown.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <XCircle className="w-3.5 h-3.5" /> Rejeições por motivo
            </p>
            <span className="text-xs text-muted-foreground">{rejeitados.length} chamado(s) rejeitado(s)</span>
          </div>
          <div className="space-y-2">
            {motivosBreakdown.map(({ motivo, count, pct }) => (
              <div key={motivo} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground truncate max-w-[80%]">{motivo}</span>
                  <span className="font-semibold text-foreground shrink-0 ml-2">{count} <span className="font-normal text-muted-foreground">({pct}%)</span></span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-red-400/70"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dialogs */}
      <DetalheDialog
        chamado={chamadoVisto}
        open={detalheOpen}
        onClose={() => setDetalheOpen(false)}
      />
      <RejeitarDialog
        chamado={chamadoRejeitar}
        open={rejeitarOpen}
        onClose={fecharRejeitar}
        onConfirm={confirmarRejeicao}
        loading={rejeitando}
        motivos={motivos}
        canEditMotivos={canValidateOp || canValidateFin}
        onSaveMotivos={handleSaveMotivos}
      />
    </div>
  );
}
