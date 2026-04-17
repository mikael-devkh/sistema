import { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Separator } from '../components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../components/ui/accordion';
import { toast } from 'sonner';
import {
  DollarSign,
  Plus,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronRight,
  CalendarRange,
  Users,
  Loader2,
  FileText,
  Package,
  Wrench,
  Link as LinkIcon,
  Timer,
  BarChart3,
  TrendingUp,
  Layers,
  RefreshCcw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { listTechnicians } from '../lib/technician-firestore';
import { listCatalogoServicos } from '../lib/catalogo-firestore';
import {
  listPagamentos,
  gerarPreviewPagamentos,
  confirmarPagamentos,
  marcarComoPago,
  cancelarPagamento,
} from '../lib/pagamento-firestore';
import type { Pagamento, PagamentoPreview, PagamentoChamadoDetalhe } from '../types/pagamento';
import type { CatalogoServico } from '../types/catalogo';
import { cn } from '../lib/utils';
import { usePermissions } from '../hooks/use-permissions';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtH = (h: number) => h < 1 ? `${Math.round(h * 60)}min` : `${h.toFixed(1)}h`;

const today = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

function statusConfig(status: string) {
  switch (status) {
    case 'pago':      return { label: 'Pago',      icon: CheckCircle2, color: 'text-green-600 dark:text-green-400',  badge: 'bg-green-500/10 text-green-700 border-green-500/25 dark:text-green-400' };
    case 'cancelado': return { label: 'Cancelado', icon: XCircle,      color: 'text-red-600 dark:text-red-400',     badge: 'bg-red-500/10 text-red-700 border-red-500/25 dark:text-red-400' };
    default:          return { label: 'Pendente',  icon: Clock,        color: 'text-amber-600 dark:text-amber-400', badge: 'bg-amber-500/10 text-amber-700 border-amber-500/25 dark:text-amber-400' };
  }
}

// ─── Breakdown financeiro de uma lista de detalhes ────────────────────────────

interface FinBreakdown {
  totalBase: number;
  totalAdicionais: number;
  totalHorasExtras: number;
  totalReembolso: number;
  qtdBase: number;
  qtdAdicionais: number;
  qtdComHorasExtras: number;
  horasExtrasTotal: number;
  total: number;
}

function calcBreakdown(detalhes: PagamentoChamadoDetalhe[]): FinBreakdown {
  let totalBase = 0, totalAdicionais = 0, totalHorasExtras = 0, totalReembolso = 0;
  let qtdBase = 0, qtdAdicionais = 0, qtdComHorasExtras = 0, horasExtrasTotal = 0;

  for (const d of detalhes) {
    const valorSemHora = d.isAdicional
      ? d.valorChamado - (d.valorHorasExtras ?? 0)
      : d.valorChamado - (d.valorHorasExtras ?? 0);

    if (d.isAdicional) {
      totalAdicionais += valorSemHora;
      qtdAdicionais++;
    } else {
      totalBase += valorSemHora;
      qtdBase++;
    }

    if (d.horasExtras && d.horasExtras > 0) {
      totalHorasExtras += d.valorHorasExtras ?? 0;
      qtdComHorasExtras++;
      horasExtrasTotal += d.horasExtras;
    }

    totalReembolso += d.reembolsoPeca;
  }

  return {
    totalBase,
    totalAdicionais,
    totalHorasExtras,
    totalReembolso,
    qtdBase,
    qtdAdicionais,
    qtdComHorasExtras,
    horasExtrasTotal,
    total: totalBase + totalAdicionais + totalHorasExtras + totalReembolso,
  };
}

// ─── BreakdownPanel ───────────────────────────────────────────────────────────

function BreakdownPanel({ detalhes, compact = false }: { detalhes: PagamentoChamadoDetalhe[]; compact?: boolean }) {
  const b = calcBreakdown(detalhes);
  if (detalhes.length === 0) return null;

  return (
    <div className={cn('rounded-lg border border-border bg-muted/30 p-3 space-y-2 text-xs', compact && 'p-2 space-y-1.5')}>
      <p className="font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
        <BarChart3 className="w-3.5 h-3.5" /> Detalhamento de Custos
      </p>
      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Chamados base ({b.qtdBase})</span>
          <span className="font-medium">{brl(b.totalBase)}</span>
        </div>
        {b.qtdAdicionais > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground flex items-center gap-1">
              <Layers className="w-3 h-3" /> Adicionais ({b.qtdAdicionais})
            </span>
            <span className="font-medium text-amber-700 dark:text-amber-400">{brl(b.totalAdicionais)}</span>
          </div>
        )}
        {b.qtdComHorasExtras > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground flex items-center gap-1">
              <Timer className="w-3 h-3" /> Horas extras ({b.qtdComHorasExtras} cham. · {fmtH(b.horasExtrasTotal)})
            </span>
            <span className="font-medium text-orange-700 dark:text-orange-400">{brl(b.totalHorasExtras)}</span>
          </div>
        )}
        {b.totalReembolso > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground flex items-center gap-1">
              <Package className="w-3 h-3" /> Reembolso peças
            </span>
            <span className="font-medium text-blue-700 dark:text-blue-400">{brl(b.totalReembolso)}</span>
          </div>
        )}
      </div>
      <div className="flex justify-between border-t border-border/50 pt-1.5 font-semibold">
        <span>Total</span>
        <span className="text-primary">{brl(b.total)}</span>
      </div>
    </div>
  );
}

// ─── Diálogo: Gerar Pagamento ─────────────────────────────────────────────────

function GerarPagamentoDialog({
  open,
  onOpenChange,
  catalogoServicos,
  nomesTecnicos,
  criadoPor,
  onConfirmed,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  catalogoServicos: CatalogoServico[];
  nomesTecnicos: Map<string, string>;
  criadoPor: string;
  onConfirmed: () => void;
}) {
  const [de, setDe] = useState(firstOfMonth);
  const [ate, setAte] = useState(today);
  const [previews, setPreviews] = useState<PagamentoPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleCalcular = async () => {
    if (!de || !ate) { toast.error('Selecione o período.'); return; }
    if (de > ate) { toast.error('Data inicial não pode ser maior que a final.'); return; }
    setLoading(true);
    try {
      const result = await gerarPreviewPagamentos(de, ate, catalogoServicos, nomesTecnicos);
      setPreviews(result);
      setSelectedIds(new Set(result.map(p => p.tecnicoId)));
      if (result.length === 0) toast.info('Nenhum relatório pendente encontrado no período.');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao calcular pagamentos.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmar = async () => {
    const selecionados = previews.filter(p => selectedIds.has(p.tecnicoId));
    if (selecionados.length === 0) { toast.error('Selecione ao menos um técnico.'); return; }
    setConfirming(true);
    try {
      await confirmarPagamentos(selecionados, { de, ate }, criadoPor);
      toast.success(`${selecionados.length} pagamento(s) gerado(s) com sucesso.`);
      onConfirmed();
      onOpenChange(false);
      setPreviews([]);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao confirmar pagamentos.');
    } finally {
      setConfirming(false);
    }
  };

  const totalSelecionado = useMemo(
    () => previews.filter(p => selectedIds.has(p.tecnicoId)).reduce((s, p) => s + p.valorTotal, 0),
    [previews, selectedIds]
  );

  const allDetalhes = useMemo(
    () => previews.filter(p => selectedIds.has(p.tecnicoId)).flatMap(p => p.detalhesChamados),
    [previews, selectedIds]
  );

  const toggleTecnico = (id: string) =>
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <Dialog open={open} onOpenChange={v => { onOpenChange(v); if (!v) setPreviews([]); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" /> Gerar Pagamentos
          </DialogTitle>
          <DialogDescription>
            Selecione o período para calcular os pagamentos com base nos relatórios arquivados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Período */}
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="space-y-1.5 flex-1">
              <Label className="flex items-center gap-1.5">
                <CalendarRange className="w-3.5 h-3.5" /> De
              </Label>
              <Input type="date" value={de} onChange={e => setDe(e.target.value)} />
            </div>
            <div className="space-y-1.5 flex-1">
              <Label>Até</Label>
              <Input type="date" value={ate} onChange={e => setAte(e.target.value)} />
            </div>
            <Button onClick={handleCalcular} disabled={loading} className="shrink-0">
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Calculando…</> : 'Calcular'}
            </Button>
          </div>

          {/* Prévia por técnico */}
          {previews.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">{previews.length} técnico(s) com saldo</span>
                <div className="flex items-center gap-3">
                  <button type="button" className="text-xs text-primary hover:underline"
                    onClick={() => setSelectedIds(new Set(previews.map(p => p.tecnicoId)))}>
                    Selecionar todos
                  </button>
                  <span className="text-border">|</span>
                  <button type="button" className="text-xs text-muted-foreground hover:underline"
                    onClick={() => setSelectedIds(new Set())}>
                    Nenhum
                  </button>
                  <span className="text-muted-foreground">
                    Total: <span className="font-bold text-foreground">{brl(totalSelecionado)}</span>
                  </span>
                </div>
              </div>

              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {previews.map(p => (
                  <div
                    key={p.tecnicoId}
                    className={cn(
                      'rounded-lg border px-4 py-3 cursor-pointer transition-colors',
                      selectedIds.has(p.tecnicoId)
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-border hover:border-border/80',
                    )}
                    onClick={() => toggleTecnico(p.tecnicoId)}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        className="accent-primary w-4 h-4 shrink-0"
                        checked={selectedIds.has(p.tecnicoId)}
                        onChange={() => toggleTecnico(p.tecnicoId)}
                        onClick={e => e.stopPropagation()}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{p.tecnicoNome}</p>
                        <p className="text-xs text-muted-foreground">{p.qtdChamados} chamado(s)</p>
                      </div>
                      <p className="font-bold text-sm shrink-0">{brl(p.valorTotal)}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Breakdown do total selecionado */}
              {allDetalhes.length > 0 && (
                <BreakdownPanel detalhes={allDetalhes} />
              )}

              <Separator />
              <div className="flex items-center justify-between text-sm font-bold">
                <span>Total a confirmar</span>
                <span className="text-primary">{brl(totalSelecionado)}</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {previews.length > 0 && (
            <Button onClick={handleConfirmar} disabled={confirming || selectedIds.size === 0}>
              {confirming
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Confirmando…</>
                : `Confirmar ${selectedIds.size} pagamento(s)`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Linha de chamado no card ─────────────────────────────────────────────────

function ChamadoDetalheRow({ d }: { d: PagamentoChamadoDetalhe }) {
  return (
    <div className="flex items-start justify-between gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs">
      <div className="min-w-0 flex-1">
        <p className="font-medium flex items-center gap-1.5 flex-wrap">
          <FileText className="w-3 h-3 text-muted-foreground shrink-0" />
          FSA #{d.fsa} · Loja {d.codigoLoja}
          {d.isAdicional && (
            <Badge variant="secondary" className="text-[10px] gap-1">
              <Layers className="w-2.5 h-2.5" /> adicional
            </Badge>
          )}
          {d.horasExtras && d.horasExtras > 0 && (
            <Badge variant="outline" className="text-[10px] gap-1 border-orange-300 text-orange-700 dark:text-orange-400">
              <Timer className="w-2.5 h-2.5" /> +{fmtH(d.horasExtras)} extra
            </Badge>
          )}
        </p>
        <div className="flex flex-wrap gap-x-3 mt-0.5 text-muted-foreground">
          {d.catalogoServicoNome && (
            <span className="flex items-center gap-1">
              <Wrench className="w-2.5 h-2.5" />{d.catalogoServicoNome}
            </span>
          )}
          {d.pecaUsada && (
            <span className="flex items-center gap-1">
              <Package className="w-2.5 h-2.5" />{d.pecaUsada}
              {d.fornecedorPeca === 'Tecnico' && ' (reimb.)'}
            </span>
          )}
          <span>{d.durationMinutes} min</span>
          {/* Link de referência */}
          {d.linkPlataforma && (
            <a
              href={d.linkPlataforma}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-primary hover:underline"
              onClick={e => e.stopPropagation()}
            >
              <LinkIcon className="w-2.5 h-2.5" /> Referência
            </a>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="font-semibold">{brl(d.valorChamado)}</p>
        {d.reembolsoPeca > 0 && (
          <p className="text-[10px] text-amber-600">+{brl(d.reembolsoPeca)} peça</p>
        )}
        {d.valorHorasExtras && d.valorHorasExtras > 0 && (
          <p className="text-[10px] text-orange-600">(incl. {brl(d.valorHorasExtras)} h.extra)</p>
        )}
      </div>
    </div>
  );
}

// ─── Card de pagamento ────────────────────────────────────────────────────────

function PagamentoCard({
  pagamento,
  onPago,
  onCancelado,
  isAdmin,
}: {
  pagamento: Pagamento;
  onPago: (p: Pagamento) => void;
  onCancelado: (p: Pagamento) => void;
  isAdmin: boolean;
}) {
  const cfg = statusConfig(pagamento.status);
  const StatusIcon = cfg.icon;
  const isPendente = pagamento.status === 'pendente';
  const b = calcBreakdown(pagamento.detalhesChamados);

  return (
    <Accordion type="single" collapsible>
      <AccordionItem
        value={pagamento.id}
        className="rounded-xl border border-border bg-card overflow-hidden"
      >
        <div className="flex items-center gap-2 px-4 py-3 hover:bg-muted/20 transition-colors">
          <AccordionTrigger className="flex-1 hover:no-underline p-0 [&>svg]:shrink-0 [&>svg]:ml-1">
            <div className="flex items-center gap-3 flex-1 min-w-0 text-left">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <DollarSign className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm">{pagamento.tecnicoNome}</p>
                  <Badge className={cn('text-[10px] border', cfg.badge)}>
                    <StatusIcon className="w-3 h-3 mr-1" />
                    {cfg.label}
                  </Badge>
                  {b.qtdAdicionais > 0 && (
                    <Badge variant="outline" className="text-[10px] gap-1 border-amber-300 text-amber-700 dark:text-amber-400">
                      <Layers className="w-2.5 h-2.5" /> {b.qtdAdicionais} adicional(is)
                    </Badge>
                  )}
                  {b.qtdComHorasExtras > 0 && (
                    <Badge variant="outline" className="text-[10px] gap-1 border-orange-300 text-orange-700 dark:text-orange-400">
                      <Timer className="w-2.5 h-2.5" /> {fmtH(b.horasExtrasTotal)} extra
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                  <span>{pagamento.chamadoIds.length} chamado(s)</span>
                  <span>{pagamento.periodo.de} → {pagamento.periodo.ate}</span>
                  {pagamento.pagoEm && (
                    <span>Pago em {new Date(pagamento.pagoEm).toLocaleDateString('pt-BR')}</span>
                  )}
                </div>
              </div>
              <p className="font-bold text-sm shrink-0">{brl(pagamento.valor)}</p>
            </div>
          </AccordionTrigger>

          {isAdmin && isPendente && (
            <Button
              size="sm"
              className="shrink-0 gap-1.5 h-8"
              onClick={e => { e.stopPropagation(); onPago(pagamento); }}
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Pagar
            </Button>
          )}
        </div>

        <AccordionContent>
          <div className="px-4 pb-4 space-y-3">
            <Separator />

            {/* Breakdown de custos */}
            <BreakdownPanel detalhes={pagamento.detalhesChamados} />

            {/* Chamados com links de referência */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Chamados incluídos
              </p>
              {pagamento.detalhesChamados.map(d => (
                <ChamadoDetalheRow key={d.serviceReportId} d={d} />
              ))}
            </div>

            {/* Total */}
            <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-bold">
              <span>Total</span>
              <span className="text-primary">{brl(pagamento.valor)}</span>
            </div>

            {isAdmin && isPendente && (
              <Button
                size="sm"
                variant="ghost"
                className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => onCancelado(pagamento)}
              >
                <XCircle className="w-4 h-4" /> Cancelar pagamento
              </Button>
            )}

            {pagamento.observacoes && (
              <p className="text-xs text-muted-foreground italic">{pagamento.observacoes}</p>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

// ─── Export PDF ───────────────────────────────────────────────────────────────

function exportDashboardPDF(
  pagamentos: Pagamento[],
  filtros: { de: string; ate: string; tecnico: string; status: string },
) {
  const bTotal = calcBreakdown(pagamentos.flatMap(p => p.detalhesChamados));

  const porTecnico = (() => {
    const map = new Map<string, { nome: string; valor: number; breakdown: FinBreakdown }>();
    for (const p of pagamentos) {
      if (!map.has(p.tecnicoId)) {
        map.set(p.tecnicoId, { nome: p.tecnicoNome, valor: 0, breakdown: calcBreakdown([]) });
      }
      const entry = map.get(p.tecnicoId)!;
      entry.valor += p.valor;
      const allD = pagamentos.filter(x => x.tecnicoId === p.tecnicoId).flatMap(x => x.detalhesChamados);
      entry.breakdown = calcBreakdown(allD);
    }
    return [...map.values()].sort((a, b) => b.valor - a.valor);
  })();

  const periodoLabel = filtros.de && filtros.ate
    ? `${filtros.de.split('-').reverse().join('/')} a ${filtros.ate.split('-').reverse().join('/')}`
    : 'Todo o período';

  const rows = porTecnico.map(t => `
    <tr>
      <td>${t.nome}</td>
      <td>${brl(t.breakdown.totalBase)}</td>
      <td>${t.breakdown.qtdAdicionais > 0 ? brl(t.breakdown.totalAdicionais) : '—'}</td>
      <td>${t.breakdown.qtdComHorasExtras > 0 ? `${brl(t.breakdown.totalHorasExtras)} (${fmtH(t.breakdown.horasExtrasTotal)})` : '—'}</td>
      <td>${t.breakdown.totalReembolso > 0 ? brl(t.breakdown.totalReembolso) : '—'}</td>
      <td class="total">${brl(t.valor)}</td>
    </tr>`).join('');

  const chamadoRows = pagamentos.flatMap(p =>
    p.detalhesChamados.map(d => `
      <tr>
        <td>${p.tecnicoNome}</td>
        <td><a href="${d.linkPlataforma ?? '#'}">${d.fsa}</a></td>
        <td>${d.codigoLoja}</td>
        <td>${d.catalogoServicoNome ?? '—'}</td>
        <td>${d.durationMinutes} min${d.horasExtras ? ` (+${fmtH(d.horasExtras)})` : ''}</td>
        <td>${d.isAdicional ? 'Sim' : '—'}</td>
        <td>${d.reembolsoPeca > 0 ? brl(d.reembolsoPeca) : '—'}</td>
        <td class="total">${brl(d.valorChamado + d.reembolsoPeca)}</td>
      </tr>`)
  ).join('');

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
  <title>Relatório Financeiro — ${periodoLabel}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #1a1a1a; padding: 24px; }
    h1 { font-size: 18px; color: #0f172a; }
    h2 { font-size: 13px; color: #334155; margin: 20px 0 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
    .meta { color: #64748b; font-size: 10px; margin-top: 4px; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0; }
    .kpi { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; }
    .kpi-label { font-size: 9px; text-transform: uppercase; color: #64748b; letter-spacing: .05em; }
    .kpi-value { font-size: 16px; font-weight: 700; margin-top: 2px; }
    .kpi-sub { font-size: 9px; color: #94a3b8; margin-top: 1px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #f8fafc; text-align: left; padding: 6px 8px; font-size: 10px; color: #64748b; border-bottom: 2px solid #e2e8f0; }
    td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    td.total { font-weight: 700; color: #0f172a; }
    tfoot td { font-weight: 700; background: #f8fafc; border-top: 2px solid #e2e8f0; }
    tfoot td.total { color: #2563eb; }
    a { color: #2563eb; text-decoration: none; }
    tr:hover { background: #f8fafc; }
    .footer { margin-top: 24px; font-size: 9px; color: #94a3b8; text-align: center; }
    @media print { body { padding: 12px; } }
  </style></head><body>
  <h1>Relatório Financeiro</h1>
  <p class="meta">Período: ${periodoLabel} · Gerado em: ${new Date().toLocaleString('pt-BR')}</p>

  <div class="kpis">
    <div class="kpi"><div class="kpi-label">Total Geral</div><div class="kpi-value">${brl(bTotal.total)}</div><div class="kpi-sub">${bTotal.qtdBase + bTotal.qtdAdicionais} chamados</div></div>
    <div class="kpi"><div class="kpi-label">Adicionais</div><div class="kpi-value">${bTotal.qtdAdicionais}</div><div class="kpi-sub">${brl(bTotal.totalAdicionais)}</div></div>
    <div class="kpi"><div class="kpi-label">Horas Extras</div><div class="kpi-value">${fmtH(bTotal.horasExtrasTotal)}</div><div class="kpi-sub">${bTotal.qtdComHorasExtras} chamados · ${brl(bTotal.totalHorasExtras)}</div></div>
    <div class="kpi"><div class="kpi-label">Reembolso Peças</div><div class="kpi-value">${brl(bTotal.totalReembolso)}</div><div class="kpi-sub">&nbsp;</div></div>
  </div>

  <h2>Resumo por Técnico</h2>
  <table>
    <thead><tr><th>Técnico</th><th>Base</th><th>Adicionais</th><th>H. Extras</th><th>Reembolso</th><th>Total</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr>
      <td>Total</td>
      <td>${brl(bTotal.totalBase)}</td>
      <td>${brl(bTotal.totalAdicionais)}</td>
      <td>${brl(bTotal.totalHorasExtras)}</td>
      <td>${brl(bTotal.totalReembolso)}</td>
      <td class="total">${brl(bTotal.total)}</td>
    </tr></tfoot>
  </table>

  <h2>Chamados — Links de Referência</h2>
  <table>
    <thead><tr><th>Técnico</th><th>FSA</th><th>Loja</th><th>Serviço</th><th>Duração</th><th>Adicional</th><th>Reembolso</th><th>Total</th></tr></thead>
    <tbody>${chamadoRows}</tbody>
  </table>

  <div class="footer">WT Serviços em Campo · Relatório gerado automaticamente</div>
  <script>window.onload = () => { window.print(); }</script>
  </body></html>`;

  const win = window.open('', '_blank', 'width=1000,height=700');
  if (!win) { toast.error('Pop-up bloqueado. Libere pop-ups para este site.'); return; }
  win.document.write(html);
  win.document.close();
}

// ─── Dashboard financeiro agregado ────────────────────────────────────────────

function DashboardTab({ pagamentosTodos, tecnicosList }: {
  pagamentosTodos: Pagamento[];
  tecnicosList: { id: string; nome: string }[];
}) {
  // Filtros internos
  const [filterDe, setFilterDe] = useState('');
  const [filterAte, setFilterAte] = useState('');
  const [filterTecnico, setFilterTecnico] = useState('todos');
  const [filterStatus, setFilterStatus] = useState<'todos' | 'pendente' | 'pago'>('todos');

  const pagamentos = useMemo(() => pagamentosTodos.filter(p => {
    // status
    if (filterStatus !== 'todos' && p.status !== filterStatus) return false;
    // técnico
    if (filterTecnico !== 'todos' && p.tecnicoId !== filterTecnico) return false;
    // período (por criadoEm)
    if (filterDe) {
      const dataP = new Date(p.criadoEm).toISOString().slice(0, 10);
      if (dataP < filterDe) return false;
    }
    if (filterAte) {
      const dataP = new Date(p.criadoEm).toISOString().slice(0, 10);
      if (dataP > filterAte) return false;
    }
    return true;
  }), [pagamentosTodos, filterDe, filterAte, filterTecnico, filterStatus]);

  const pagos     = useMemo(() => pagamentos.filter(p => p.status === 'pago'), [pagamentos]);
  const pendentes = useMemo(() => pagamentos.filter(p => p.status === 'pendente'), [pagamentos]);

  const allDetalhes = useMemo(() => pagamentos.flatMap(p => p.detalhesChamados), [pagamentos]);
  const bTotal      = useMemo(() => calcBreakdown(allDetalhes), [allDetalhes]);

  const porTecnico = useMemo(() => {
    const map = new Map<string, { nome: string; detalhes: PagamentoChamadoDetalhe[]; valor: number }>();
    for (const p of pagamentos) {
      if (!map.has(p.tecnicoId)) map.set(p.tecnicoId, { nome: p.tecnicoNome, detalhes: [], valor: 0 });
      const entry = map.get(p.tecnicoId)!;
      entry.detalhes.push(...p.detalhesChamados);
      entry.valor += p.valor;
    }
    return [...map.entries()]
      .map(([id, v]) => ({ id, ...v, breakdown: calcBreakdown(v.detalhes) }))
      .sort((a, b) => b.valor - a.valor);
  }, [pagamentos]);

  const hasFilters = filterDe || filterAte || filterTecnico !== 'todos' || filterStatus !== 'todos';

  if (pagamentosTodos.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium">Nenhum dado para exibir</p>
        <p className="text-sm mt-1">Gere pagamentos para ver o dashboard financeiro.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <CalendarRange className="w-3.5 h-3.5" /> Filtros
          </p>
          <div className="flex items-center gap-2">
            {hasFilters && (
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground"
                onClick={() => { setFilterDe(''); setFilterAte(''); setFilterTecnico('todos'); setFilterStatus('todos'); }}>
                Limpar filtros
              </Button>
            )}
            <Button size="sm" className="h-7 gap-1.5 text-xs"
              onClick={() => exportDashboardPDF(pagamentos, { de: filterDe, ate: filterAte, tecnico: filterTecnico, status: filterStatus })}>
              <FileText className="w-3.5 h-3.5" /> Exportar PDF
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">De</Label>
            <Input type="date" value={filterDe} onChange={e => setFilterDe(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Até</Label>
            <Input type="date" value={filterAte} onChange={e => setFilterAte(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Técnico</Label>
            <select
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              value={filterTecnico}
              onChange={e => setFilterTecnico(e.target.value)}
            >
              <option value="todos">Todos</option>
              {tecnicosList.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <select
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}
            >
              <option value="todos">Todos</option>
              <option value="pendente">Pendente</option>
              <option value="pago">Pago</option>
            </select>
          </div>
        </div>

        {pagamentos.length === 0 && (
          <p className="text-xs text-center text-muted-foreground py-2">Nenhum pagamento encontrado com os filtros selecionados.</p>
        )}
      </div>

      {pagamentos.length > 0 && (
        <>
          {/* KPIs globais */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total filtrado', value: brl(bTotal.total), sub: `${allDetalhes.length} chamados`, color: 'border-primary/20 text-primary' },
              { label: 'Chamados adicionais', value: bTotal.qtdAdicionais.toString(), sub: brl(bTotal.totalAdicionais), color: 'border-amber-500/20 text-amber-700 dark:text-amber-400' },
              { label: 'Horas extras', value: fmtH(bTotal.horasExtrasTotal), sub: `${bTotal.qtdComHorasExtras} cham. · ${brl(bTotal.totalHorasExtras)}`, color: 'border-orange-500/20 text-orange-700 dark:text-orange-400' },
              { label: 'Reembolso peças', value: brl(bTotal.totalReembolso), sub: '', color: 'border-blue-500/20 text-blue-700 dark:text-blue-400' },
            ].map(k => (
              <div key={k.label} className={cn('p-4 rounded-xl border-2 bg-background shadow-sm', k.color.split(' ')[0])}>
                <p className="text-xs font-medium text-muted-foreground mb-1">{k.label}</p>
                <p className={cn('text-xl font-bold', k.color.split(' ').slice(1).join(' '))}>{k.value}</p>
                {k.sub && <p className="text-xs text-muted-foreground mt-0.5">{k.sub}</p>}
              </div>
            ))}
          </div>

          {/* Pendente vs Pago */}
          {filterStatus === 'todos' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-500/5 p-4 space-y-3">
                <p className="text-sm font-semibold flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <Clock className="w-4 h-4" /> Pendente de pagamento
                </p>
                <BreakdownPanel detalhes={pendentes.flatMap(p => p.detalhesChamados)} compact />
              </div>
              <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-500/5 p-4 space-y-3">
                <p className="text-sm font-semibold flex items-center gap-2 text-green-700 dark:text-green-400">
                  <CheckCircle2 className="w-4 h-4" /> Já pago
                </p>
                <BreakdownPanel detalhes={pagos.flatMap(p => p.detalhesChamados)} compact />
              </div>
            </div>
          )}

          {/* Tabela por técnico */}
          {porTecnico.length > 0 && (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-3 bg-muted/40 border-b border-border flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" /> Resumo por Técnico
                </p>
                <span className="text-xs text-muted-foreground">{porTecnico.length} técnico(s)</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/30 border-b border-border">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Técnico</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">Base</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">Adicionais</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">H. Extras</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">Reembolso</th>
                      <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {porTecnico.map(t => (
                      <tr key={t.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2.5 font-medium">{t.nome}</td>
                        <td className="px-3 py-2.5 text-right text-muted-foreground">{brl(t.breakdown.totalBase)}</td>
                        <td className="px-3 py-2.5 text-right">
                          {t.breakdown.qtdAdicionais > 0
                            ? <span className="text-amber-700 dark:text-amber-400">{brl(t.breakdown.totalAdicionais)}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {t.breakdown.qtdComHorasExtras > 0
                            ? <span className="text-orange-700 dark:text-orange-400">{brl(t.breakdown.totalHorasExtras)}<br /><span className="text-[10px] text-muted-foreground">{fmtH(t.breakdown.horasExtrasTotal)}</span></span>
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {t.breakdown.totalReembolso > 0
                            ? <span className="text-blue-700 dark:text-blue-400">{brl(t.breakdown.totalReembolso)}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-primary">{brl(t.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-border bg-muted/30">
                    <tr>
                      <td className="px-4 py-2.5 font-bold">Total</td>
                      <td className="px-3 py-2.5 text-right font-semibold">{brl(bTotal.totalBase)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-amber-700 dark:text-amber-400">{brl(bTotal.totalAdicionais)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-orange-700 dark:text-orange-400">{brl(bTotal.totalHorasExtras)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-blue-700 dark:text-blue-400">{brl(bTotal.totalReembolso)}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-primary">{brl(bTotal.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function PagamentosPage() {
  const { user } = useAuth();
  const { permissions } = usePermissions();
  const isAdmin = permissions.canGeneratePayment;

  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogoServicos, setCatalogoServicos] = useState<CatalogoServico[]>([]);
  const [nomesTecnicos, setNomesTecnicos] = useState<Map<string, string>>(new Map());

  const [gerarDialogOpen, setGerarDialogOpen] = useState(false);
  const [pagandoPagamento, setPagandoPagamento] = useState<Pagamento | null>(null);
  const [cancelandoPagamento, setCancelandoPagamento] = useState<Pagamento | null>(null);
  const [obsPagamento, setObsPagamento] = useState('');

  const fetchPagamentos = async () => {
    setLoading(true);
    try {
      const data = isAdmin ? await listPagamentos() : await listPagamentos(user?.uid);
      setPagamentos(data);
    } catch {
      toast.error('Erro ao carregar pagamentos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPagamentos();
    listCatalogoServicos().then(setCatalogoServicos).catch(() => {});
    listTechnicians().then(techs => {
      const map = new Map<string, string>();
      techs.forEach(t => map.set(t.uid, t.nome));
      setNomesTecnicos(map);
    }).catch(() => {});
  }, [user?.uid, isAdmin]);

  const pendentes = useMemo(() => pagamentos.filter(p => p.status === 'pendente'), [pagamentos]);
  const historico  = useMemo(() => pagamentos.filter(p => p.status !== 'pendente'), [pagamentos]);

  const totalPendente = useMemo(() => pendentes.reduce((s, p) => s + p.valor, 0), [pendentes]);
  const totalPago     = useMemo(
    () => pagamentos.filter(p => p.status === 'pago').reduce((s, p) => s + p.valor, 0),
    [pagamentos]
  );

  const handleMarcarPago = async () => {
    if (!pagandoPagamento) return;
    try {
      await marcarComoPago(pagandoPagamento.id, obsPagamento || undefined);
      toast.success('Pagamento registrado.');
      setPagandoPagamento(null);
      setObsPagamento('');
      fetchPagamentos();
    } catch {
      toast.error('Erro ao marcar pagamento.');
    }
  };

  const handleCancelar = async () => {
    if (!cancelandoPagamento) return;
    try {
      await cancelarPagamento(cancelandoPagamento.id, cancelandoPagamento);
      toast.success('Pagamento cancelado. Chamados liberados para novo fechamento.');
      setCancelandoPagamento(null);
      fetchPagamentos();
    } catch {
      toast.error('Erro ao cancelar pagamento.');
    }
  };

  return (
    <div className="space-y-6 animate-page-in">
      {/* Header */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-primary via-primary/70 to-primary/30" />
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <DollarSign className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Pagamentos</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Fechamento e repasse aos técnicos de campo
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={fetchPagamentos} disabled={loading}>
              <RefreshCcw className="w-3.5 h-3.5" />
            </Button>
            {isAdmin && (
              <Button onClick={() => setGerarDialogOpen(true)} size="sm">
                <Plus className="w-4 h-4 mr-1.5" /> Gerar Pagamento
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl border-2 border-amber-500/20 bg-background shadow-sm">
          <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
            <Clock className="w-4 h-4" /> A pagar
          </p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{brl(totalPendente)}</p>
          <p className="text-xs text-muted-foreground mt-1">{pendentes.length} pendente(s)</p>
        </div>
        <div className="p-5 rounded-xl border-2 border-green-500/20 bg-background shadow-sm">
          <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> Pago
          </p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{brl(totalPago)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {pagamentos.filter(p => p.status === 'pago').length} pagamento(s)
          </p>
        </div>
        <div className="p-5 rounded-xl border-2 border-border bg-background shadow-sm col-span-2 md:col-span-1">
          <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
            <Users className="w-4 h-4" /> Técnicos
          </p>
          <p className="text-2xl font-bold">
            {new Set(pendentes.map(p => p.tecnicoId)).size}
          </p>
          <p className="text-xs text-muted-foreground mt-1">com saldo pendente</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pendentes">
        <TabsList>
          <TabsTrigger value="pendentes" className="gap-2">
            <Clock className="w-4 h-4" /> Pendentes
            {pendentes.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">{pendentes.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-2">
            <ChevronRight className="w-4 h-4" /> Histórico
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="gap-2">
            <BarChart3 className="w-4 h-4" /> Dashboard
          </TabsTrigger>
        </TabsList>

        {loading ? (
          <div className="mt-4 space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : (
          <>
            <TabsContent value="pendentes" className="mt-4 space-y-3">
              {pendentes.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Nenhum pagamento pendente</p>
                  {isAdmin && (
                    <p className="text-sm mt-1">
                      Use "Gerar Pagamento" para criar pagamentos a partir dos relatórios arquivados.
                    </p>
                  )}
                </div>
              ) : (
                pendentes.map(p => (
                  <PagamentoCard
                    key={p.id}
                    pagamento={p}
                    isAdmin={isAdmin}
                    onPago={pag => { setPagandoPagamento(pag); setObsPagamento(''); }}
                    onCancelado={setCancelandoPagamento}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="historico" className="mt-4 space-y-3">
              {historico.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Nenhum pagamento no histórico</p>
                </div>
              ) : (
                historico.map(p => (
                  <PagamentoCard
                    key={p.id}
                    pagamento={p}
                    isAdmin={isAdmin}
                    onPago={() => {}}
                    onCancelado={() => {}}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="dashboard" className="mt-4">
              <DashboardTab
                pagamentosTodos={pagamentos}
                tecnicosList={[...nomesTecnicos.entries()].map(([id, nome]) => ({ id, nome }))}
              />
            </TabsContent>
          </>
        )}
      </Tabs>

      {/* Dialog: Gerar Pagamento */}
      <GerarPagamentoDialog
        open={gerarDialogOpen}
        onOpenChange={setGerarDialogOpen}
        catalogoServicos={catalogoServicos}
        nomesTecnicos={nomesTecnicos}
        criadoPor={user?.uid ?? ''}
        onConfirmed={fetchPagamentos}
      />

      {/* Dialog: Confirmar pagamento */}
      <AlertDialog open={!!pagandoPagamento} onOpenChange={open => !open && setPagandoPagamento(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar como Pago</AlertDialogTitle>
            <AlertDialogDescription>
              Confirmar pagamento de{' '}
              <strong>{pagandoPagamento ? brl(pagandoPagamento.valor) : ''}</strong>{' '}
              para <strong>{pagandoPagamento?.tecnicoNome}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2 space-y-1.5">
            <Label htmlFor="obs-pag">Observações (opcional)</Label>
            <Input
              id="obs-pag"
              placeholder="Ex: PIX enviado em 15/04"
              value={obsPagamento}
              onChange={e => setObsPagamento(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleMarcarPago}>
              Confirmar Pagamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Cancelar pagamento */}
      <AlertDialog open={!!cancelandoPagamento} onOpenChange={open => !open && setCancelandoPagamento(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Pagamento</AlertDialogTitle>
            <AlertDialogDescription>
              Cancelar o pagamento de{' '}
              <strong>{cancelandoPagamento ? brl(cancelandoPagamento.valor) : ''}</strong>{' '}
              para <strong>{cancelandoPagamento?.tecnicoNome}</strong>?
              <br /><br />
              Os chamados incluídos voltarão a ficar disponíveis para novo fechamento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelar}
              className="bg-destructive hover:bg-destructive/90"
            >
              Cancelar Pagamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
