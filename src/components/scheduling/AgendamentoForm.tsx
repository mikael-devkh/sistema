import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { toast } from 'sonner';
import { transitionIssue, getTransitions, buildIsoDatetime } from '../../lib/jiraScheduling';
import type { SchedulingIssue, AgendaFormData } from '../../types/scheduling';

interface Props {
  loja: string;
  issues: SchedulingIssue[];
  onSuccess: () => void;
}

export function AgendamentoForm({ loja, issues, onSuccess }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<AgendaFormData>({
    data: today,
    hora: '09:00',
    tecnico: '',
    moverTecCampo: true,
  });
  const [loading, setLoading] = useState(false);

  const set = (field: keyof AgendaFormData, value: string | boolean) =>
    setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async () => {
    if (!form.data || !form.hora) {
      toast.warning('Preencha data e hora.');
      return;
    }
    setLoading(true);
    const dtIso = buildIsoDatetime(form.data, form.hora);
    let ok = 0;
    const errors: string[] = [];

    for (const issue of issues) {
      try {
        const transitions = await getTransitions(issue.key);
        const agendTrans = transitions.find(t => t.name.toLowerCase().includes('agend'));
        if (agendTrans) {
          const success = await transitionIssue({
            key: issue.key,
            transitionId: agendTrans.id,
            dataAgenda: dtIso,
            tecnico: form.tecnico || undefined,
          });
          if (!success) { errors.push(`${issue.key}: falha ao agendar`); continue; }
        }

        if (form.moverTecCampo) {
          // Re-fetch transitions after scheduling (status changed)
          const trans2 = await getTransitions(issue.key);
          const tcTrans = trans2.find(t => t.toName.toLowerCase().includes('tec-campo') || t.name.toLowerCase().includes('tec-campo'));
          if (tcTrans) {
            const s2 = await transitionIssue({ key: issue.key, transitionId: tcTrans.id });
            if (!s2) errors.push(`${issue.key}: falha ao mover TEC-CAMPO`);
          }
        }
        ok++;
      } catch (e: any) {
        errors.push(`${issue.key}: ${e?.message}`);
      }
    }

    setLoading(false);
    if (errors.length) {
      toast.error(`Erros:\n${errors.join('\n')}`);
    } else {
      toast.success(`${ok} chamado(s) agendado(s) com sucesso!`);
      onSuccess();
    }
  };

  return (
    <div className="space-y-3 pt-1">
      <p className="text-xs font-semibold text-muted-foreground uppercase">📅 Agendar {issues.length} chamado(s)</p>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Data</Label>
          <Input type="date" value={form.data} min={today} onChange={e => set('data', e.target.value)} className="h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Hora</Label>
          <Input type="time" value={form.hora} onChange={e => set('hora', e.target.value)} className="h-8 text-sm" />
        </div>
      </div>

      <div>
        <Label className="text-xs">Técnico (Nome-CPF-RG-TEL)</Label>
        <Input
          placeholder="Ex: João Silva-123.456.789-00-123456-11 99999-9999"
          value={form.tecnico}
          onChange={e => set('tecnico', e.target.value)}
          className="h-8 text-sm"
        />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id={`tc-${loja}`}
          checked={form.moverTecCampo}
          onCheckedChange={v => set('moverTecCampo', Boolean(v))}
        />
        <Label htmlFor={`tc-${loja}`} className="text-xs cursor-pointer">Mover direto → TEC-CAMPO</Label>
      </div>

      <Button size="sm" onClick={handleSubmit} disabled={loading} className="w-full">
        {loading ? 'Agendando…' : `✅ Agendar ${issues.length} chamado(s)`}
      </Button>
    </div>
  );
}
