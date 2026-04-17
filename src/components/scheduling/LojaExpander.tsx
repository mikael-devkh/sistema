import { useState } from 'react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  ChevronDown, Copy, Check, MapPin, Hash,
  AlertCircle, AlertTriangle, Clock, Monitor, Wrench,
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

function IssueRow({ issue }: { issue: SchedulingIssue }) {
  const tecnicoNome = issue.tecnico ? issue.tecnico.split('-')[0]?.trim() : null;
  let agendaLabel: string | null = null;
  if (issue.dataAgenda) {
    try { agendaLabel = format(new Date(issue.dataAgenda), 'dd/MM HH:mm'); } catch { /* ignore */ }
  }

  return (
    <div className="flex items-start gap-2 px-2 py-2 rounded-lg hover:bg-secondary/40 text-xs transition-colors">
      {/* Key */}
      <code className="text-[10px] bg-secondary px-1.5 py-0.5 rounded font-mono shrink-0 text-muted-foreground select-all">
        {issue.key}
      </code>

      {/* PDV + Ativo + Problema */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="font-medium text-[11px]">PDV {issue.pdv}</span>
          {issue.ativo && issue.ativo !== '--' && (
            <span className="text-muted-foreground">· {issue.ativo}</span>
          )}
        </div>
        <p className="text-muted-foreground truncate mt-0.5 leading-snug" title={issue.problema}>
          {issue.problema}
        </p>
      </div>

      {/* Meta: SLA, status, data, técnico */}
      <div className="flex flex-col items-end gap-0.5 shrink-0 text-[10px] text-muted-foreground">
        {issue.slaBadge && <span>{issue.slaBadge}</span>}
        {issue.status && (
          <span className="bg-secondary px-1 rounded">{issue.status}</span>
        )}
        {agendaLabel && <span>📅 {agendaLabel}</span>}
        {tecnicoNome && (
          <span className="truncate max-w-[110px]" title={issue.tecnico}>👤 {tecnicoNome}</span>
        )}
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

  const borderColor = hasCriticalSla || group.slaGroupStatus === 'critical'
    ? 'border-l-rose-500'
    : hasWarnSla || group.slaGroupStatus === 'warning'
    ? 'border-l-amber-500'
    : group.isCritical
    ? 'border-l-rose-500'
    : 'border-l-border';

  const bgHover = open ? 'bg-card' : 'bg-card/50 hover:bg-card';

  // Determina se há tipo oposto de issues para mostrar na label do header
  const hasRelated = relatedGroups && relatedGroups.length > 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border border-l-4 ${borderColor} ${bgHover} transition-all duration-200 text-left group shadow-sm`}
        >
          <div className="flex items-center gap-3 flex-wrap min-w-0">
            {/* Store name */}
            <span className="font-semibold text-sm truncate max-w-[200px]">{group.loja}</span>

            {/* Location */}
            {group.cidade && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3" />
                {group.cidade}{group.uf ? ` – ${group.uf}` : ''}
              </span>
            )}

            {/* Count badge */}
            <Badge
              variant="secondary"
              className="text-xs font-medium tabular-nums"
            >
              <Hash className="w-3 h-3 mr-0.5" />{group.qtd}
            </Badge>

            {/* SLA badges */}
            {hasCriticalSla && (
              <Badge className="text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/40 gap-1">
                <AlertCircle className="w-3 h-3" /> SLA Estourado
              </Badge>
            )}
            {!hasCriticalSla && hasWarnSla && (
              <Badge className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/40 gap-1">
                <AlertTriangle className="w-3 h-3" /> Alerta SLA
              </Badge>
            )}

            {/* Staleness badges (only when no issue-level SLA badge) */}
            {!hasCriticalSla && !hasWarnSla && group.slaGroupStatus === 'critical' && (
              <Badge className="text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/40 gap-1">
                <Clock className="w-3 h-3" /> +7d sem update
              </Badge>
            )}
            {!hasCriticalSla && !hasWarnSla && group.slaGroupStatus === 'warning' && (
              <Badge className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/40 gap-1">
                <Clock className="w-3 h-3" /> +3d sem update
              </Badge>
            )}

            {extra}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {hasRelated && !open && (
              <span className="text-[10px] text-muted-foreground italic">
                ver todos os chamados
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
              <pre className="text-xs bg-secondary/50 border border-border/50 rounded-lg p-3 whitespace-pre-wrap font-mono leading-relaxed overflow-auto max-h-72 text-foreground/80">
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
