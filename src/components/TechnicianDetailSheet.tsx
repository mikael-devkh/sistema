import { useEffect, useMemo, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { Skeleton } from './ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from './ui/sheet';
import {
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  Layers,
  MapPin,
  Package,
  Phone,
  Printer,
  Timer,
  User,
  Wallet,
  Wrench,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { listChamados } from '../lib/chamado-firestore';
import { listPagamentos } from '../lib/pagamento-firestore';
import { listCatalogoServicos } from '../lib/catalogo-firestore';
import { calcularDetalhesDeChamados } from '../lib/pagamento-calc';
import type { TechnicianProfile } from '../types/technician';
import type { Chamado, ChamadoStatus } from '../types/chamado';
import type { Pagamento, PagamentoChamadoDetalhe } from '../types/pagamento';
import type { CatalogoServico } from '../types/catalogo';
import { cn } from '../lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (s: string) => s ? s.split('-').reverse().join('/') : '—';
const fmtH = (h: number) => h < 1 ? `${Math.round(h * 60)}min` : `${h.toFixed(1)}h`;

const CHAMADO_STATUS: Record<ChamadoStatus, { label: string; badge: string; icon: typeof Clock }> = {
  rascunho:           { label: 'Rascunho',           badge: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400',                icon: FileText },
  submetido:          { label: 'Em validação',        badge: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400',                    icon: Clock },
  validado_operador:  { label: 'Val. Operador',       badge: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400',          icon: CheckCircle2 },
  rejeitado_operacional:{ label: 'Rej. Op.',          badge: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400',                         icon: XCircle },
  rejeitado_financeiro:{ label: 'Rej. Fin.',          badge: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400',                    icon: XCircle },
  rejeitado:          { label: 'Rejeitado',           badge: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400',                         icon: XCircle },
  validado_financeiro:{ label: 'Aguard. Pagamento',   badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400',               icon: DollarSign },
  pagamento_pendente: { label: 'Pag. Pendente',       badge: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400',          icon: DollarSign },
  pago:               { label: 'Pago',                badge: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400',               icon: CheckCircle2 },
  cancelado:          { label: 'Cancelado',           badge: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400',              icon: XCircle },
};

// ─── Geração de comprovante ───────────────────────────────────────────────────

function gerarComprovante(pagamento: Pagamento, tech: TechnicianProfile) {
  const b = calcBreakdownLocal(pagamento.detalhesChamados);
  const periodoLabel = `${fmtDate(pagamento.periodo.de)} a ${fmtDate(pagamento.periodo.ate)}`;

  const rows = pagamento.detalhesChamados.map(d => `
    <tr>
      <td>${d.fsa}</td>
      <td>${d.codigoLoja}</td>
      <td>${d.catalogoServicoNome ?? '—'}</td>
      <td>${d.durationMinutes} min${d.horasExtras ? ` (+${fmtH(d.horasExtras)})` : ''}</td>
      <td>${d.isAdicional ? 'Sim' : '—'}</td>
      <td>${d.reembolsoPeca > 0 ? brl(d.reembolsoPeca) : '—'}</td>
      <td class="total">${brl(d.valorChamado + d.reembolsoPeca)}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
  <title>Comprovante — ${tech.nome}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #1a1a1a; padding: 32px; max-width: 800px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #0f172a; }
    .company { font-size: 18px; font-weight: 700; color: #0f172a; }
    .company-sub { font-size: 10px; color: #64748b; margin-top: 2px; }
    .doc-title { text-align: right; }
    .doc-title h2 { font-size: 14px; color: #0f172a; }
    .doc-title p { font-size: 10px; color: #64748b; margin-top: 2px; }
    .section { margin: 16px 0; }
    .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: .06em; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
    .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 16px; }
    .info-item label { font-size: 9px; text-transform: uppercase; color: #94a3b8; display: block; }
    .info-item span { font-size: 11px; font-weight: 600; color: #0f172a; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 16px 0; }
    .kpi { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; }
    .kpi-label { font-size: 9px; text-transform: uppercase; color: #64748b; }
    .kpi-value { font-size: 15px; font-weight: 700; margin-top: 2px; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10px; }
    th { background: #f8fafc; text-align: left; padding: 6px 8px; color: #64748b; border-bottom: 2px solid #e2e8f0; font-size: 9px; text-transform: uppercase; }
    td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
    td.total { font-weight: 700; }
    tfoot td { font-weight: 700; background: #f8fafc; border-top: 2px solid #e2e8f0; }
    tfoot td.total { color: #2563eb; font-size: 12px; }
    .pix-box { margin-top: 20px; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 12px 16px; }
    .pix-box p { font-size: 10px; color: #64748b; }
    .pix-box strong { font-size: 13px; color: #0f172a; }
    .footer { margin-top: 32px; font-size: 9px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 12px; }
    .status-pago { display: inline-block; background: #dcfce7; color: #16a34a; border-radius: 4px; padding: 2px 8px; font-size: 10px; font-weight: 700; }
    @media print { body { padding: 16px; } }
  </style></head><body>
  <div class="header">
    <div>
      <div class="company">WT Serviços em Campo</div>
      <div class="company-sub">Comprovante de Pagamento a Técnico</div>
    </div>
    <div class="doc-title">
      <h2>COMPROVANTE</h2>
      <p>Emitido em: ${new Date().toLocaleString('pt-BR')}</p>
      ${pagamento.status === 'pago' ? `<p style="margin-top:4px"><span class="status-pago">✓ PAGO</span></p>` : ''}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Dados do Técnico</div>
    <div class="info-grid">
      <div class="info-item"><label>Nome</label><span>${tech.nomeCompleto || tech.nome}</span></div>
      <div class="info-item"><label>Código</label><span>${tech.codigoTecnico}</span></div>
      <div class="info-item"><label>CPF</label><span>${tech.cpf || '—'}</span></div>
      <div class="info-item"><label>Telefone</label><span>${tech.telefone || '—'}</span></div>
      <div class="info-item"><label>Banco</label><span>${tech.pagamento?.banco || '—'}</span></div>
      <div class="info-item"><label>Agência / Conta</label><span>${tech.pagamento?.agencia || '—'} / ${tech.pagamento?.conta || '—'}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Período de Referência</div>
    <div class="info-grid">
      <div class="info-item"><label>Período</label><span>${periodoLabel}</span></div>
      <div class="info-item"><label>Qtd. Chamados</label><span>${pagamento.chamadoIds.length}</span></div>
      ${pagamento.pagoEm ? `<div class="info-item"><label>Data do Pagamento</label><span>${new Date(pagamento.pagoEm).toLocaleDateString('pt-BR')}</span></div>` : ''}
    </div>
  </div>

  <div class="kpis">
    <div class="kpi"><div class="kpi-label">Chamados Base</div><div class="kpi-value">${brl(b.totalBase)}</div></div>
    <div class="kpi"><div class="kpi-label">Adicionais</div><div class="kpi-value">${brl(b.totalAdicionais)}</div></div>
    <div class="kpi"><div class="kpi-label">Horas Extras</div><div class="kpi-value">${brl(b.totalHorasExtras)}</div></div>
    <div class="kpi"><div class="kpi-label">Reembolso Peças</div><div class="kpi-value">${brl(b.totalReembolso)}</div></div>
  </div>

  <div class="section">
    <div class="section-title">Chamados Incluídos</div>
    <table>
      <thead><tr><th>Cód. Chamado</th><th>Loja</th><th>Serviço</th><th>Duração</th><th>Adicional</th><th>Reembolso</th><th>Valor</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr>
        <td colspan="6">Total</td>
        <td class="total">${brl(pagamento.valor)}</td>
      </tr></tfoot>
    </table>
  </div>

  ${tech.pagamento?.pix ? `
  <div class="pix-box">
    <p>Chave PIX para pagamento:</p>
    <strong>${tech.pagamento.pix}</strong>
    ${tech.pagamento.tipoConta ? `<p style="margin-top:4px">Tipo: ${tech.pagamento.tipoConta === 'corrente' ? 'Conta Corrente' : 'Conta Poupança'}</p>` : ''}
  </div>` : ''}

  ${pagamento.observacoes ? `<p style="margin-top:16px;font-size:10px;color:#64748b"><strong>Obs:</strong> ${pagamento.observacoes}</p>` : ''}

  <div class="footer">WT Serviços em Campo · Documento gerado automaticamente · Não requer assinatura</div>
  <script>window.onload = () => { window.print(); }</script>
  </body></html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) { toast.error('Pop-up bloqueado. Libere pop-ups para este site.'); return; }
  win.document.write(html);
  win.document.close();
}

// ─── Breakdown local (sem importar de PagamentosPage) ────────────────────────

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

function calcBreakdownLocal(detalhes: PagamentoChamadoDetalhe[]): FinBreakdown {
  let totalBase = 0, totalAdicionais = 0, totalHorasExtras = 0, totalReembolso = 0;
  let qtdBase = 0, qtdAdicionais = 0, qtdComHorasExtras = 0, horasExtrasTotal = 0;
  for (const d of detalhes) {
    const base = d.valorChamado - (d.valorHorasExtras ?? 0);
    if (d.isAdicional) { totalAdicionais += base; qtdAdicionais++; }
    else { totalBase += base; qtdBase++; }
    if (d.horasExtras && d.horasExtras > 0) {
      totalHorasExtras += d.valorHorasExtras ?? 0;
      qtdComHorasExtras++;
      horasExtrasTotal += d.horasExtras;
    }
    totalReembolso += d.reembolsoPeca;
  }
  return { totalBase, totalAdicionais, totalHorasExtras, totalReembolso, qtdBase, qtdAdicionais, qtdComHorasExtras, horasExtrasTotal, total: totalBase + totalAdicionais + totalHorasExtras + totalReembolso };
}

// ─── Linha de chamado ─────────────────────────────────────────────────────────

function ChamadoRow({ chamado }: { chamado: Chamado }) {
  const cfg = CHAMADO_STATUS[chamado.status];
  const Icon = cfg.icon;
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-xs">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm">{chamado.fsa || '—'}</span>
          <span className="text-muted-foreground">· Loja {chamado.codigoLoja}</span>
          <Badge className={cn('text-[10px] border gap-1', cfg.badge)}>
            <Icon className="w-2.5 h-2.5" /> {cfg.label}
          </Badge>
        </div>
        <div className="flex gap-x-3 mt-0.5 text-muted-foreground flex-wrap">
          <span>{fmtDate(chamado.dataAtendimento)}</span>
          {chamado.catalogoServicoNome && (
            <span className="flex items-center gap-1">
              <Wrench className="w-2.5 h-2.5" />{chamado.catalogoServicoNome}
            </span>
          )}
          {chamado.pecaUsada && (
            <span className="flex items-center gap-1">
              <Package className="w-2.5 h-2.5" />{chamado.pecaUsada}
            </span>
          )}
          {chamado.durationMinutes && (
            <span className="flex items-center gap-1">
              <Timer className="w-2.5 h-2.5" />{chamado.durationMinutes} min
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Card de pagamento com comprovante ───────────────────────────────────────

function PagamentoRow({ pagamento, tech }: { pagamento: Pagamento; tech: TechnicianProfile }) {
  const isPago = pagamento.status === 'pago';
  const b = calcBreakdownLocal(pagamento.detalhesChamados);
  return (
    <div className="rounded-lg border border-border bg-muted/10 px-4 py-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{brl(pagamento.valor)}</span>
            <Badge className={cn('text-[10px] border', isPago
              ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400')}>
              {isPago ? <><CheckCircle2 className="w-2.5 h-2.5 mr-1" />Pago</> : <><Clock className="w-2.5 h-2.5 mr-1" />Pendente</>}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {fmtDate(pagamento.periodo.de)} → {fmtDate(pagamento.periodo.ate)} · {pagamento.chamadoIds.length} chamado(s)
          </p>
          {pagamento.pagoEm && (
            <p className="text-xs text-muted-foreground">
              Pago em {new Date(pagamento.pagoEm).toLocaleDateString('pt-BR')}
            </p>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 shrink-0 h-8 text-xs"
          onClick={() => gerarComprovante(pagamento, tech)}
        >
          <Printer className="w-3.5 h-3.5" /> Comprovante
        </Button>
      </div>

      {/* Mini breakdown */}
      {b.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-border/50">
          <div className="text-xs">
            <p className="text-muted-foreground">Base ({b.qtdBase})</p>
            <p className="font-medium">{brl(b.totalBase)}</p>
          </div>
          {b.qtdAdicionais > 0 && (
            <div className="text-xs">
              <p className="text-muted-foreground">Adicionais ({b.qtdAdicionais})</p>
              <p className="font-medium text-amber-700 dark:text-amber-400">{brl(b.totalAdicionais)}</p>
            </div>
          )}
          {b.qtdComHorasExtras > 0 && (
            <div className="text-xs">
              <p className="text-muted-foreground">H. Extras ({fmtH(b.horasExtrasTotal)})</p>
              <p className="font-medium text-orange-700 dark:text-orange-400">{brl(b.totalHorasExtras)}</p>
            </div>
          )}
          {b.totalReembolso > 0 && (
            <div className="text-xs">
              <p className="text-muted-foreground">Reembolso</p>
              <p className="font-medium text-blue-700 dark:text-blue-400">{brl(b.totalReembolso)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── TechnicianDetailSheet ────────────────────────────────────────────────────

interface Props {
  technician: TechnicianProfile | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onEdit?: (tech: TechnicianProfile) => void;
}

export function TechnicianDetailSheet({ technician, open, onOpenChange, onEdit }: Props) {
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [catalogo, setCatalogo] = useState<CatalogoServico[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !technician) return;
    setLoading(true);
    Promise.all([
      listChamados({ tecnicoId: technician.uid }),
      listPagamentos(technician.uid),
      listCatalogoServicos(),
    ]).then(([c, p, cat]) => {
      setChamados(c);
      setPagamentos(p);
      setCatalogo(cat);
    }).catch(() => {
      toast.error('Erro ao carregar dados do técnico.');
    }).finally(() => setLoading(false));
  }, [open, technician?.uid]);

  // KPIs
  const kpis = useMemo(() => {
    if (!chamados.length && !pagamentos.length) return null;

    const pendentes = chamados.filter(c =>
      ['submetido', 'validado_operador', 'validado_financeiro'].includes(c.status)
    );
    const aguardandoPgto = chamados.filter(c => c.status === 'validado_financeiro');

    const catalogoMap = new Map(catalogo.map(s => [s.id, s]));
    const detalhes = calcularDetalhesDeChamados(aguardandoPgto, catalogoMap);
    const valorPendente = detalhes.reduce((s, d) => s + d.valorChamado + d.reembolsoPeca, 0);

    const totalPago = pagamentos
      .filter(p => p.status === 'pago')
      .reduce((s, p) => s + p.valor, 0);

    // Taxa de rejeição
    const rejeitados = chamados.filter(c =>
      c.status === 'rejeitado' ||
      c.status === 'rejeitado_operacional' ||
      c.status === 'rejeitado_financeiro'
    ).length;
    const taxaRejeicao = chamados.length > 0
      ? Math.round((rejeitados / chamados.length) * 100)
      : 0;

    // Média de dias para concluir (registradoEm → pago, apenas chamados pagos)
    const pagos = chamados.filter(c => c.status === 'pago' && c.registradoEm && c.atualizadoEm);
    const mediaDias = pagos.length > 0
      ? Math.round(
          pagos.reduce((s, c) => s + ((c.atualizadoEm! - c.registradoEm) / 86_400_000), 0) / pagos.length,
        )
      : null;

    return { pendentes: pendentes.length, valorPendente, totalPago, taxaRejeicao, mediaDias, rejeitados };
  }, [chamados, pagamentos, catalogo]);

  if (!technician) return null;

  const initials = technician.nome.split(' ').slice(0, 2).map(s => s[0]?.toUpperCase() ?? '').join('');
  const cargoLabel: Record<string, string> = { tecnico: 'Técnico de Campo', supervisor: 'Supervisor', coordenador: 'Coordenador' };
  const statusCfg: Record<string, { label: string; className: string }> = {
    ativo:     { label: 'Ativo',     className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
    inativo:   { label: 'Inativo',   className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
    ferias:    { label: 'Férias',    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
    licenca:   { label: 'Licença',   className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
    desligado: { label: 'Desligado', className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  };
  const statusInfo = statusCfg[technician.status] ?? { label: technician.status, className: 'bg-muted text-muted-foreground' };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto flex flex-col gap-0 p-0">
        {/* Cabeçalho */}
        <div className="h-1 bg-gradient-to-r from-primary via-primary/70 to-primary/30 shrink-0" />
        <SheetHeader className="px-6 pt-5 pb-4 shrink-0">
          <div className="flex items-start gap-4">
            <Avatar className="w-14 h-14 shrink-0">
              <AvatarImage src={technician.avatarUrl} />
              <AvatarFallback className="text-lg font-bold">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-lg leading-tight">{technician.nome}</SheetTitle>
              <p className="text-sm text-muted-foreground font-mono mt-0.5">{technician.codigoTecnico}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge className={cn('text-[11px]', statusInfo.className)}>{statusInfo.label}</Badge>
                <span className="text-xs text-muted-foreground">{cargoLabel[technician.cargo] ?? technician.cargo}</span>
              </div>
            </div>
            {onEdit && (
              <Button size="sm" variant="outline" onClick={() => onEdit(technician)} className="shrink-0">
                Editar
              </Button>
            )}
          </div>

          {/* Info rápida */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-muted-foreground">
            {technician.telefone && (
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3" />{technician.telefone}
              </span>
            )}
            {technician.cidade && technician.uf && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />{technician.cidade}, {technician.uf}
              </span>
            )}
            {technician.cpf && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />CPF: {technician.cpf}
              </span>
            )}
          </div>

          {/* Períodos de indisponibilidade ativos/futuros */}
          {(technician.periodosIndisponibilidade?.length ?? 0) > 0 && (
            <div className="mt-2 rounded-lg border border-amber-300/60 bg-amber-50/60 dark:bg-amber-900/10 px-3 py-2 text-xs space-y-1">
              <p className="font-semibold text-amber-700 dark:text-amber-400">Períodos de indisponibilidade:</p>
              {technician.periodosIndisponibilidade!.map((p, i) => (
                <p key={i} className="text-muted-foreground font-mono">
                  {p.de} → {p.ate}
                  {p.motivo && <span className="ml-2 font-sans capitalize text-amber-600 dark:text-amber-400">[{p.motivo}]</span>}
                </p>
              ))}
            </div>
          )}

          {/* PIX / banco */}
          {(technician.pagamento?.pix || technician.pagamento?.banco) && (
            <div className="mt-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs flex flex-wrap gap-x-4 gap-y-1">
              {technician.pagamento?.pix && (
                <span className="flex items-center gap-1">
                  <Wallet className="w-3 h-3 text-primary" />
                  <span className="font-semibold">PIX:</span> {technician.pagamento.pix}
                </span>
              )}
              {technician.pagamento?.banco && (
                <span className="flex items-center gap-1">
                  <DollarSign className="w-3 h-3 text-muted-foreground" />
                  {technician.pagamento.banco}
                  {technician.pagamento.agencia && ` · Ag. ${technician.pagamento.agencia}`}
                  {technician.pagamento.conta && ` · C. ${technician.pagamento.conta}`}
                </span>
              )}
            </div>
          )}
        </SheetHeader>

        <Separator />

        {/* KPIs — linha 1 */}
        <div className="px-6 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
          {[
            { label: 'Total Chamados', value: chamados.length.toString(), color: 'text-foreground', border: 'border-border' },
            { label: 'Pendentes',      value: kpis ? kpis.pendentes.toString() : '—', color: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/20' },
            { label: 'Aguard. Pgto',   value: kpis ? brl(kpis.valorPendente) : '—',  color: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/20' },
            { label: 'Total Pago',     value: kpis ? brl(kpis.totalPago) : '—',      color: 'text-green-600 dark:text-green-400', border: 'border-green-500/20' },
          ].map(k => (
            <div key={k.label} className={cn('rounded-xl border-2 bg-background p-3 shadow-sm text-center', k.border)}>
              <p className="text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wide leading-tight">{k.label}</p>
              {loading
                ? <Skeleton className="h-5 w-full mt-1" />
                : <p className={cn('text-base font-bold leading-tight', k.color)}>{k.value}</p>
              }
            </div>
          ))}
        </div>
        {/* KPIs — linha 2: métricas de qualidade */}
        {!loading && kpis && (
          <div className="px-6 pb-3 grid grid-cols-2 sm:grid-cols-3 gap-3 shrink-0">
            <div className={cn('rounded-xl border-2 bg-background p-3 shadow-sm text-center',
              kpis.taxaRejeicao >= 20 ? 'border-red-400/40' : kpis.taxaRejeicao >= 10 ? 'border-amber-400/40' : 'border-emerald-500/20'
            )}>
              <p className="text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wide leading-tight">Taxa Rejeição</p>
              <p className={cn('text-base font-bold leading-tight',
                kpis.taxaRejeicao >= 20 ? 'text-red-600 dark:text-red-400'
                : kpis.taxaRejeicao >= 10 ? 'text-amber-600 dark:text-amber-400'
                : 'text-emerald-600 dark:text-emerald-400'
              )}>
                {kpis.taxaRejeicao}%
                <span className="text-[10px] font-normal text-muted-foreground ml-1">({kpis.rejeitados} cham.)</span>
              </p>
            </div>
            <div className="rounded-xl border-2 border-border bg-background p-3 shadow-sm text-center">
              <p className="text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wide leading-tight">Dias p/ Fechar</p>
              <p className="text-base font-bold leading-tight text-foreground">
                {kpis.mediaDias !== null ? `${kpis.mediaDias}d` : '—'}
              </p>
            </div>
            <div className="rounded-xl border-2 border-emerald-500/20 bg-background p-3 shadow-sm text-center">
              <p className="text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wide leading-tight">Pagamentos</p>
              <p className="text-base font-bold leading-tight text-emerald-600 dark:text-emerald-400">
                {pagamentos.filter(p => p.status === 'pago').length}
                <span className="text-[10px] font-normal text-muted-foreground ml-1">pagos</span>
              </p>
            </div>
          </div>
        )}

        <Separator />

        {/* Tabs: Chamados | Pagamentos */}
        <Tabs defaultValue="chamados" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-6 mt-4 mb-0 shrink-0">
            <TabsTrigger value="chamados" className="gap-1.5">
              <Wrench className="w-3.5 h-3.5" /> Chamados
              {chamados.length > 0 && (
                <Badge variant="secondary" className="text-[10px] ml-1">{chamados.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="pagamentos" className="gap-1.5">
              <DollarSign className="w-3.5 h-3.5" /> Pagamentos
              {pagamentos.length > 0 && (
                <Badge variant="secondary" className="text-[10px] ml-1">{pagamentos.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chamados" className="flex-1 overflow-y-auto px-6 pb-6 pt-3 space-y-2">
            {loading ? (
              [1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)
            ) : chamados.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Wrench className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhum chamado registrado</p>
              </div>
            ) : (
              <>
                {/* Agrupamento por status */}
                {(['validado_financeiro', 'submetido', 'validado_operador', 'pago', 'rejeitado', 'rascunho'] as ChamadoStatus[]).map(status => {
                  const group = chamados.filter(c => c.status === status);
                  if (!group.length) return null;
                  return (
                    <div key={status} className="space-y-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground pt-2">
                        {CHAMADO_STATUS[status].label} ({group.length})
                      </p>
                      {group.map(c => <ChamadoRow key={c.id} chamado={c} />)}
                    </div>
                  );
                })}
              </>
            )}
          </TabsContent>

          <TabsContent value="pagamentos" className="flex-1 overflow-y-auto px-6 pb-6 pt-3 space-y-3">
            {loading ? (
              [1,2].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)
            ) : pagamentos.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhum pagamento gerado</p>
                <p className="text-xs mt-1">Use "Gerar Pagamento" na página de Pagamentos para criar o primeiro fechamento.</p>
              </div>
            ) : (
              <>
                {/* Pendentes primeiro */}
                {pagamentos.filter(p => p.status === 'pendente').length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <Clock className="w-3 h-3" /> Pendentes
                    </p>
                    {pagamentos.filter(p => p.status === 'pendente').map(p => (
                      <PagamentoRow key={p.id} pagamento={p} tech={technician} />
                    ))}
                  </div>
                )}
                {/* Histórico */}
                {pagamentos.filter(p => p.status !== 'pendente').length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <Layers className="w-3 h-3" /> Histórico
                    </p>
                    {pagamentos.filter(p => p.status !== 'pendente').map(p => (
                      <PagamentoRow key={p.id} pagamento={p} tech={technician} />
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
