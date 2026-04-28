import { useState } from 'react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Collapsible, CollapsibleContent } from '../ui/collapsible';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  ChevronDown, Copy, Check, MapPin,
  AlertTriangle, Monitor, Wrench,
} from 'lucide-react';
import { AgendamentoForm } from './AgendamentoForm';
import { gerarMensagem } from '../../lib/jiraScheduling';
import type { LojaGroup, SchedulingIssue } from '../../types/scheduling';

export interface RelatedGroup {
  label: string;
  issues: SchedulingIssue[];
  isTerminal?: boolean;
}

interface Props {
  group: LojaGroup;
  showForm?: boolean;
  warningText?: string;
  onScheduled?: () => void;
  /** Ações primárias do header (pin + CTA) — fixas no extremo direito */
  actions?: React.ReactNode;
  /** Indica que a loja tem chamados de terminal em outro tab — mostra ícone discreto */
  crossTerminal?: boolean;
  /** Issues de outro tipo (terminal ou manutenção) da mesma loja, exibidos na seção expandida */
  relatedGroups?: RelatedGroup[];
}

// ─── Issue row ────────────────────────────────────────────────────────────────

/** Mapeia o emoji-prefix do slaBadge para um chip com dot colorido + texto curto. */
function slaChip(slaBadge?: string) {
  if (!slaBadge) return null;
  let dot = 'bg-muted-foreground';
  let text = slaBadge.replace(/^[🔴🟡🟢]/u, '').trim() || 'SLA';
  if (slaBadge.startsWith('🔴')) { dot = 'bg-critical';   text = text || 'estourado'; }
  else if (slaBadge.startsWith('🟡')) { dot = 'bg-amber-500'; text = text || 'alerta'; }
  else if (slaBadge.startsWith('🟢')) { dot = 'bg-emerald-500'; text = text || 'ok'; }
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground">
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {text}
    </span>
  );
}

function initials(name?: string | null) {
  if (!name) return '—';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '—';
  return ((parts[0][0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

function IssueRow({ issue }: { issue: SchedulingIssue }) {
  const tecnicoNome = issue.tecnico ? issue.tecnico.split('-')[0]?.trim() : null;
  let agendaDate: string | null = null;
  let agendaTime: string | null = null;
  if (issue.dataAgenda) {
    try {
      const d = new Date(issue.dataAgenda);
      agendaDate = format(d, 'dd/MM');
      agendaTime = format(d, 'HH:mm');
    } catch { /* ignore */ }
  }

  return (
    <div className="grid grid-cols-[80px_56px_minmax(0,1fr)_72px_72px_28px] items-center gap-x-4 px-3 py-2.5 hover:bg-secondary/40 text-xs transition-colors">
      {/* 1. ID FSA */}
      <code className="text-[10px] bg-secondary px-1.5 py-0.5 rounded font-mono text-muted-foreground select-all truncate">
        {issue.key}
      </code>

      {/* 2. PDV */}
      <span className="text-[11px] text-muted-foreground tabular-nums">PDV {issue.pdv}</span>

      {/* 3. Descrição em uma linha + ativo abaixo discreto */}
      <div className="min-w-0">
        <p className="text-[12px] text-foreground/90 truncate leading-tight" title={issue.problema}>
          {issue.problema}
        </p>
        {issue.ativo && issue.ativo !== '--' && (
          <p className="text-[10px] text-muted-foreground truncate mt-0.5">
            Ativo: {issue.ativo}
            {(() => {
              if (!issue.lastUpdated) return null;
              const d = issue.lastUpdated instanceof Date
                ? issue.lastUpdated
                : new Date(issue.lastUpdated as unknown as string | number);
              if (Number.isNaN(d.getTime())) return null;
              try { return <> · atualizado {format(d, 'HH:mm')}</>; } catch { return null; }
            })()}
          </p>
        )}
      </div>

      {/* 4. SLA chip dot+texto */}
      <div className="shrink-0">{slaChip(issue.slaBadge)}</div>

      {/* 5. Data: dd/MM em cima, HH:mm em baixo */}
      <div className="shrink-0 text-[11px] text-muted-foreground tabular-nums leading-tight">
        {agendaDate ? (
          <>
            <span className="text-foreground/85">{agendaDate}</span>
            {agendaTime && <span className="block text-[10px]">{agendaTime}</span>}
          </>
        ) : (
          <span className="text-muted-foreground/60">—</span>
        )}
      </div>

      {/* 6. Avatar do técnico ou traço */}
      {tecnicoNome ? (
        <div
          className="shrink-0 w-7 h-7 rounded-full bg-primary/15 text-primary text-[10px] font-semibold flex items-center justify-center"
          title={issue.tecnico ?? 'não atribuído'}
        >
          {initials(tecnicoNome)}
        </div>
      ) : (
        <span className="shrink-0 text-[10px] text-muted-foreground/50 text-center" title="não atribuído">—</span>
      )}
    </div>
  );
}

// ─── Issue group section ──────────────────────────────────────────────────────

export function IssueSection({
  label,
  issues,
  isTerminal,
  defaultOpen = true,
}: {
  label: string;
  issues: SchedulingIssue[];
  isTerminal?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="space-y-0.5">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 py-1 text-left group"
      >
        {isTerminal
          ? <Monitor className="w-3 h-3 text-violet-400 shrink-0" />
          : <Wrench className="w-3 h-3 text-primary shrink-0" />
        }
        <span className={`text-[11px] font-semibold uppercase tracking-wide ${isTerminal ? 'text-violet-400' : 'text-primary'}`}>
          {label}
        </span>
        <Badge variant={isTerminal ? "terminal" : "secondary"} className="text-[10px] tabular-nums">
          {issues.length}
        </Badge>
        <ChevronDown
          className={`w-3 h-3 text-muted-foreground ml-auto transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="border border-border/40 rounded-lg overflow-hidden">
          {/* Header da tabela */}
          <div className="grid grid-cols-[80px_56px_minmax(0,1fr)_72px_72px_28px] items-center gap-x-4 px-3 py-1.5 bg-muted/40 border-b border-border/30 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>FSA</span>
            <span>PDV</span>
            <span>Descrição</span>
            <span>SLA</span>
            <span>Agenda</span>
            <span className="text-center">Téc.</span>
          </div>
          <div className="divide-y divide-border/30">
            {issues.map(issue => <IssueRow key={issue.key} issue={issue} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LojaExpander({ group, showForm = false, warningText, onScheduled, actions, crossTerminal, relatedGroups }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const allIssuesForMsg = [
    ...group.issues,
    ...(relatedGroups?.flatMap(rg => rg.issues) ?? []),
  ];
  const msg = gerarMensagem(group.loja, allIssuesForMsg);

  const copy = () => {
    navigator.clipboard.writeText(msg);
    setCopied(true);
    toast.success(`Mensagem da ${group.loja} copiada!`);
    setTimeout(() => setCopied(false), 2000);
  };

  const slaStatuses = group.issues.map(i => i.slaBadge).filter(Boolean);
  const hasCriticalSla = slaStatuses.some(s => s?.startsWith('🔴'));
  const hasWarnSla = slaStatuses.some(s => s?.startsWith('🟡'));

  // Tempo relativo do último update (ex: "há 18h", "há 2d")
  const lastUpdatedLabel = (() => {
    if (!group.lastUpdated) return null;
    const ts = group.lastUpdated instanceof Date
      ? group.lastUpdated.getTime()
      : new Date(group.lastUpdated as unknown as string | number).getTime();
    if (!Number.isFinite(ts)) return null;
    const diffMs = Date.now() - ts;
    const h = Math.floor(diffMs / 3_600_000);
    if (h < 1) return 'agora';
    if (h < 24) return `há ${h}h`;
    const d = Math.floor(h / 24);
    return `há ${d}d`;
  })();

  // Sinal único de SLA: chip com dot colorido + tempo
  const slaSignal: { dot: string; label: string; hint?: string } =
    hasCriticalSla || group.slaGroupStatus === 'critical'
      ? { dot: 'bg-critical',    label: hasCriticalSla ? 'SLA estourado' : '+7d sem update', hint: lastUpdatedLabel ?? undefined }
      : hasWarnSla || group.slaGroupStatus === 'warning'
      ? { dot: 'bg-warning',     label: hasWarnSla ? 'Alerta SLA' : '+3d sem update',        hint: lastUpdatedLabel ?? undefined }
      : group.isCritical
      ? { dot: 'bg-critical',    label: 'crítica',                                            hint: lastUpdatedLabel ?? undefined }
      : { dot: 'bg-success',     label: 'SLA ok',                                             hint: lastUpdatedLabel ?? undefined };

  // Manter borda esquerda sutil só em estado crítico (1 sinal a mais, opcional)
  const borderEdge = (hasCriticalSla || group.slaGroupStatus === 'critical')
    ? 'border-l-critical'
    : 'border-l-transparent';

  const bgHover = open ? 'bg-card' : 'bg-card/50 hover:bg-card';

  // Breakdown manutenção / terminal
  const totalManut = group.issues.filter(i => !i.problema.includes('Projeto Terminal de Consulta') && i.ativo !== '--').length;
  const totalTerminal = group.issues.length - totalManut;

  const toggle = () => setOpen(o => !o);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      {/*
        Header é um <div role="button"> (NÃO <button>) — `actions` contém botões
        e botão dentro de botão é HTML inválido (quebra DOM com erro 'insertBefore').
        A área de ações usa stopPropagation para não acionar o toggle.
      */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={`${open ? 'Recolher' : 'Expandir'} ${group.loja}`}
        onClick={toggle}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
          }
        }}
        className={`w-full grid grid-cols-[minmax(0,1fr)_84px_172px_140px_auto] items-center gap-x-4 px-5 py-3.5 rounded-[10px] border border-l-4 cursor-pointer ${borderEdge} ${bgHover} transition-all duration-200 text-left group shadow-card focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50`}
      >
        {/* 1. Nome + cidade */}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[15px] leading-tight truncate text-foreground">
              {group.loja}
            </span>
            {crossTerminal && (
              <span
                title="Esta loja também tem chamados de Terminal em outro grupo"
                className="shrink-0 inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[hsl(var(--terminal-soft))] text-[hsl(var(--terminal))]"
              >
                <Monitor className="w-2.5 h-2.5" /> Terminal
              </span>
            )}
          </div>
          {group.cidade && (
            <span className="block text-[11px] text-muted-foreground truncate mt-0.5">
              {group.cidade}{group.uf ? ` · ${group.uf}` : ''}
            </span>
          )}
        </div>

        {/* 2. Numeral + label CHAMADOS */}
        <div className="text-center tabular-nums">
          <div className="text-2xl font-bold leading-none text-foreground">{group.qtd}</div>
          <div className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground font-medium mt-1">
            {group.qtd === 1 ? 'chamado' : 'chamados'}
          </div>
        </div>

        {/* 3. Breakdown manut/terminal */}
        <div className="flex items-center gap-1.5 text-[11px]">
          {totalManut > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-secondary text-foreground/75 tabular-nums">
              <span className="font-semibold">{totalManut}</span> <span className="text-muted-foreground">manut.</span>
            </span>
          )}
          {totalTerminal > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-[hsl(var(--terminal-soft))] text-[hsl(var(--terminal))] tabular-nums">
              <span className="font-semibold">{totalTerminal}</span> terminal
            </span>
          )}
        </div>

        {/* 4. SLA chip */}
        <div>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-foreground/90">
            <span className={`w-1.5 h-1.5 rounded-full ${slaSignal.dot}`} />
            {slaSignal.label}
          </div>
          {slaSignal.hint && (
            <span className="block text-[10px] text-muted-foreground tabular-nums mt-0.5 ml-3.5">{slaSignal.hint}</span>
          )}
        </div>

        {/* 5. Ações + chevron — stopPropagation para não acionar o toggle */}
        <div
          className="flex items-center gap-2 shrink-0"
          onClick={e => e.stopPropagation()}
          onKeyDown={e => e.stopPropagation()}
        >
          {actions}
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground transition-transform duration-200 pointer-events-none ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </div>

      <CollapsibleContent>
        <div className="mt-2 rounded-[10px] border border-border/50 bg-card p-4 space-y-4 shadow-card">
          {warningText && (
            <div className="flex items-start gap-2.5 p-3 bg-amber-500/10 border border-amber-500/25 rounded-lg text-xs text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{warningText}</span>
            </div>
          )}

          {/* ── Chamados da loja ─────────────────────────────────────────── */}
          <div className="space-y-3">
            <IssueSection
              label="Manutenção Regular"
              issues={group.issues.filter(i => !i.problema.includes('Projeto Terminal de Consulta') && i.ativo !== '--')}
              isTerminal={false}
              defaultOpen
            />
            {/* Issues de terminal que estejam no grupo principal (caso filtro seja "Todos") */}
            {group.issues.some(i => i.problema.includes('Projeto Terminal de Consulta') || i.ativo === '--') && (
              <IssueSection
                label="Projeto Terminal"
                issues={group.issues.filter(i => i.problema.includes('Projeto Terminal de Consulta') || i.ativo === '--')}
                isTerminal
                defaultOpen
              />
            )}

            {/* Issues relacionadas de outro tipo (vindas da prop relatedGroups) */}
            {relatedGroups?.map(rg => (
              <IssueSection
                key={rg.label}
                label={rg.label}
                issues={rg.issues}
                isTerminal={rg.isTerminal}
                defaultOpen={false}
              />
            ))}
          </div>

          <div className={`grid gap-4 ${showForm ? 'md:grid-cols-2' : ''}`}>
            {/* Message preview */}
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Mensagem gerada</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1.5 text-xs"
                  onClick={copy}
                >
                  {copied
                    ? <><Check className="w-3.5 h-3.5 text-primary" /> Copiado!</>
                    : <><Copy className="w-3.5 h-3.5" /> Copiar</>
                  }
                </Button>
              </div>
              <pre className="text-xs bg-[hsl(140_25%_97%)] dark:bg-[hsl(150_15%_9%)] border border-border/40 rounded-lg p-3 whitespace-pre-wrap font-mono leading-relaxed overflow-auto max-h-72 text-foreground/75">
                {msg}
              </pre>
            </div>

            {/* Schedule form */}
            {showForm && (
              <AgendamentoForm
                loja={group.loja}
                issues={group.issues}
                onSuccess={() => onScheduled?.()}
              />
            )}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
