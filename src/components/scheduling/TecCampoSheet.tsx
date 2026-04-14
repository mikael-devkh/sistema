import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../ui/sheet';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Wrench, ArrowRight, MapPin, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { getTransitions, transitionIssue } from '../../lib/jiraScheduling';
import type { LojaGroup } from '../../types/scheduling';

interface Props {
  group: LojaGroup | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function TecCampoSheet({ group, open, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);

  const handleTransition = async () => {
    if (!group) return;
    setLoading(true);
    let moved = 0;
    const errors: string[] = [];

    for (const issue of group.issues) {
      try {
        const trans = await getTransitions(issue.key);
        const tcTr = trans.find(
          t =>
            t.toName?.toLowerCase().includes('tec-campo') ||
            t.name.toLowerCase().includes('tec-campo'),
        );
        if (tcTr) {
          const ok = await transitionIssue({ key: issue.key, transitionId: tcTr.id });
          if (ok) moved++;
          else errors.push(`${issue.key}: falha ao mover`);
        } else {
          errors.push(`${issue.key}: transição TEC-CAMPO não encontrada`);
        }
      } catch (e: any) {
        errors.push(`${issue.key}: ${e?.message}`);
      }
    }

    setLoading(false);
    if (errors.length) {
      toast.error(errors.join('\n'));
    } else {
      toast.success(`${moved} FSA(s) movido(s) → TEC-CAMPO`);
      onSuccess();
      onClose();
    }
  };

  const issues = group?.issues ?? [];

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:w-[420px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-orange-500" />
            Virar para TEC-CAMPO
          </SheetTitle>
          <SheetDescription className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            {group?.loja ?? '—'}
            {group?.cidade ? ` · ${group.cidade}` : ''}
            {group?.uf ? ` – ${group.uf}` : ''}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">

          {/* FSA list */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Chamados agendados ({issues.length})
            </p>
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {issues.map(issue => (
                <div
                  key={issue.key}
                  className="flex items-center justify-between rounded-lg bg-secondary/60 border border-border px-3 py-2.5 text-sm"
                >
                  <span className="font-mono font-semibold">{issue.key}</span>
                  <div className="flex items-center gap-2">
                    {issue.slaBadge && (
                      <span className="text-xs">{issue.slaBadge}</span>
                    )}
                    <Badge variant="outline" className="text-[10px]">
                      {issue.status}
                    </Badge>
                  </div>
                </div>
              ))}
              {issues.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum chamado encontrado.
                </p>
              )}
            </div>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2.5 rounded-lg bg-orange-500/10 border border-orange-500/25 px-4 py-3 text-sm text-orange-600 dark:text-orange-400">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Todos os chamados acima serão movidos para o status{' '}
              <strong>TEC-CAMPO</strong> no Jira.
            </span>
          </div>

          {/* Confirm button */}
          <Button
            onClick={handleTransition}
            disabled={loading || issues.length === 0}
            className="w-full gap-2 bg-orange-500 hover:bg-orange-600 text-white"
          >
            {loading ? (
              'Movendo…'
            ) : (
              <>
                Confirmar → TEC-CAMPO
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
