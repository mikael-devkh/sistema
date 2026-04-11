import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ChevronDown, Copy, Check, MapPin, Hash, AlertCircle, AlertTriangle } from 'lucide-react';
import { AgendamentoForm } from './AgendamentoForm';
import { gerarMensagem } from '../../lib/jiraScheduling';
import type { LojaGroup } from '../../types/scheduling';

interface Props {
  group: LojaGroup;
  showForm?: boolean;
  warningText?: string;
  onScheduled?: () => void;
  extra?: React.ReactNode;
}

export function LojaExpander({ group, showForm = false, warningText, onScheduled, extra }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const msg = gerarMensagem(group.loja, group.issues);

  const copy = () => {
    navigator.clipboard.writeText(msg);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const slaStatuses = group.issues.map(i => i.slaBadge).filter(Boolean);
  const hasCriticalSla = slaStatuses.some(s => s?.startsWith('🔴'));
  const hasWarnSla = slaStatuses.some(s => s?.startsWith('🟡'));

  const borderColor = hasCriticalSla
    ? 'border-l-rose-500'
    : hasWarnSla
    ? 'border-l-amber-500'
    : group.isCritical
    ? 'border-l-rose-500'
    : 'border-l-border';

  const bgHover = open ? 'bg-card' : 'bg-card/50 hover:bg-card';

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

            {extra}
          </div>

          <ChevronDown
            className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
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
