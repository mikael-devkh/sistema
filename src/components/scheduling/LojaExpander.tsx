import { useState } from 'react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  ChevronDown, Copy, Check, MapPin,
  AlertTriangle, Clock, Monitor, Wrench,
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
  extra?: React.ReactNode;
  /** Issues de outro tipo (terminal ou manutenção) da mesma loja, exibidos na seção expandida */
  relatedGroups?: RelatedGroup[];
}

// ─── Issue row ────────────────────────────────────────────────────────────────

/** Mapeia o emoji-prefix do slaBadge para um chip com dot colorido + texto curto. */
function slaChip(slaBadge?: string) {
  if (!slaBadge) return null;
  let dot = 'bg-muted-foreground';
  let text = slaBadge.replace(/^[🔴🟡🟢]/u, '').trim() || 'SLA';
  if (slaBadge.startsWith('🔴')) { dot = 'bg-rose-500';   text = text || 'estourado'; }
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
  let agendaLabel: string | null = null;
  if (issue.dataAgenda) {
    try { agendaLabel = format(new Date(issue.dataAgenda), 'dd/MM HH:mm'); } catch { /* ignore */ }
  }

  return (
    <div className="grid grid-cols-[88px_60px_1fr_auto_auto_auto] items-center gap-3 px-3 py-2 hover:bg-secondary/40 text-xs transition-colors">
      {/* 1. ID */}
      <code className="text-[10px] bg-secondary px-1.5 py-0.5 rounded font-mono text-muted-foreground select-all truncate">
        {issue.key}
      </code>

      {/* 2. PDV */}
      <span className="font-medium text-[11px] tabular-nums">PDV {issue.pdv}</span>

      {/* 3. Descrição (ativo + problema) */}
      <div className="min-w-0">
        <p className="text-foreground/90 truncate leading-snug" title={issue.problema}>
          {issue.problema}
        </p>
        {issue.ativo && issue.ativo !== '--' && (
          <p className="text-[10px] text-muted-foreground truncate">{issue.ativo}</p>
        )}
      </div>

      {/* 4. SLA chip */}
      <div className="shrink-0 min-w-[64px] text-right">{slaChip(issue.slaBadge)}</div>

      {/* 5. Data */}
      <div className="shrink-0 text-[10px] text-muted-foreground tabular-nums min-w-[72px] text-right">
        {agendaLabel ?? '—'}
      </div>

      {/* 6. Técnico (avatar circular substitui o ícone) */}
      <div className="shrink-0 w-7 h-7 rounded-full bg-primary/15 text-primary text-[10px] font-semibold flex items-center justify-center" title={issue.tecnico ?? 'não atribuído'}>
        {tecnicoNome ? initials(tecnicoNome) : '—'}
      </div>
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
        <Badge
          variant="secondary"
          className={`text-[10px] tabular-nums ${isTerminal ? 'bg-violet-500/15 text-violet-300 border-violet-500/30' : ''}`}
        >
          {issues.length}
        </Badge>
        <ChevronDown
          className={`w-3 h-3 text-muted-foreground ml-auto transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="border border-border/40 rounded-lg overflow-hidden divide-y divide-border/30">
          {issues.map(issue => <IssueRow key={issue.key} issue={issue} />)}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LojaExpander({ group, showForm = false, warningText, onScheduled, extra, relatedGroups }: Props) {
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

  // Sinal único de SLA: chip com dot colorido (substitui border-l-4 + badge + emoji)
  const slaSignal: { dot: string; label: string } | null =
    hasCriticalSla || group.slaGroupStatus === 'critical'
      ? { dot: 'bg-rose-500', label: hasCriticalSla ? 'SLA estourado' : '+7d sem update' }
      : hasWarnSla || group.slaGroupStatus === 'warning'
      ? { dot: 'bg-amber-500', label: hasWarnSla ? 'Alerta SLA' : '+3d sem update' }
      : group.isCritical
      ? { dot: 'bg-rose-500', label: 'crítica' }
      : { dot: 'bg-emerald-500', label: 'SLA ok' };

  // Manter borda esquerda sutil só em estado crítico (1 sinal a mais, opcional)
  const borderEdge = (hasCriticalSla || group.slaGroupStatus === 'critical')
    ? 'border-l-rose-500/60'
    : 'border-l-transparent';

  const bgHover = open ? 'bg-card' : 'bg-card/50 hover:bg-card';

  // Breakdown manutenção / terminal
  const totalManut = group.issues.filter(i => !i.problema.includes('Projeto Terminal de Consulta') && i.ativo !== '--').length;
  const totalTerminal = group.issues.length - totalManut;

  // Determina se há tipo oposto de issues para mostrar na label do header
  const hasRelated = relatedGroups && relatedGroups.length > 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          className={`w-full grid grid-cols-[minmax(0,1.6fr)_auto_auto_auto_auto] items-center gap-4 px-4 py-3 rounded-xl border border-l-4 ${borderEdge} ${bgHover} transition-all duration-200 text-left group shadow-sm`}
        >
          {/* 1. Nome + cidade */}
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{group.loja}</p>
            {group.cidade && (
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground truncate">
                <MapPin className="w-3 h-3 shrink-0" />
                {group.cidade}{group.uf ? ` · ${group.uf}` : ''}
              </p>
            )}
          </div>

          {/* 2. Total de chamados (heroizado) */}
          <div className="shrink-0 text-right tabular-nums">
            <span className="text-lg font-bold leading-none">{group.qtd}</span>
            <span className="block text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">
              {group.qtd === 1 ? 'chamado' : 'chamados'}
            </span>
          </div>

          {/* 3. Breakdown manut/terminal */}
          <div className="shrink-0 hidden sm:flex items-center gap-1.5 text-[10px]">
            {totalManut > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                {totalManut} manut.
              </span>
            )}
            {totalTerminal > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-[hsl(var(--terminal-soft))] text-[hsl(var(--terminal))]">
                {totalTerminal} terminal
              </span>
            )}
          </div>

          {/* 4. SLA chip único */}
          <div className="shrink-0 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            {(hasCriticalSla || hasWarnSla || group.slaGroupStatus !== 'ok') && slaSignal ? (
              <>
                <span className={`w-1.5 h-1.5 rounded-full ${slaSignal.dot}`} />
                {slaSignal.label}
                {(group.slaGroupStatus === 'critical' || group.slaGroupStatus === 'warning') &&
                  !hasCriticalSla && !hasWarnSla && (
                    <Clock className="w-3 h-3 text-muted-foreground/70" />
                  )}
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                ok
              </>
            )}
          </div>

          {/* 5. Ações (extra do caller) + chevron */}
          <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
            {extra}
            {hasRelated && !open && (
              <span className="hidden lg:inline text-[10px] text-muted-foreground italic">
                ver todos
              </span>
            )}
            <ChevronDown
              className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            />
          </div>
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-1 rounded-xl border border-border/50 bg-card p-4 space-y-4 shadow-sm">
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
