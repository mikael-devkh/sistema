import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
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
  const hasCriticalSla = slaStatuses.some(s => s.startsWith('🔴'));
  const hasWarnSla = slaStatuses.some(s => s.startsWith('🟡'));

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-muted/60 transition text-left border border-border/50">
          <span className="flex items-center gap-2 flex-wrap">
            {group.isCritical && <span className="text-destructive font-bold">🔴</span>}
            <span className="font-medium text-sm">{group.loja}</span>
            {group.cidade && <span className="text-xs text-muted-foreground">{group.cidade} – {group.uf}</span>}
            <Badge variant="secondary" className="text-xs">{group.qtd} chamado(s)</Badge>
            {hasCriticalSla && <Badge variant="destructive" className="text-[10px]">SLA ESTOURADO</Badge>}
            {!hasCriticalSla && hasWarnSla && <Badge variant="outline" className="text-[10px] border-yellow-500 text-yellow-600">ALERTA SLA</Badge>}
            {extra}
          </span>
          {open ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-1 border border-border/40 rounded-md p-3 space-y-3">
          {warningText && (
            <div className="flex items-start gap-2 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-xs text-yellow-700 dark:text-yellow-400">
              ⚠️ {warningText}
            </div>
          )}

          <div className={`grid gap-3 ${showForm ? 'md:grid-cols-2' : ''}`}>
            {/* Message */}
            <div className="relative">
              <Button
                size="sm"
                variant="ghost"
                className="absolute top-1 right-1 h-6 w-6 p-0"
                onClick={copy}
                title="Copiar mensagem"
              >
                {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
              </Button>
              <pre className="text-xs bg-muted/50 rounded p-3 pr-8 whitespace-pre-wrap font-mono leading-relaxed overflow-auto max-h-80">{msg}</pre>
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
