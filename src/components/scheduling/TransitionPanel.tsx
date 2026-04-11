import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../ui/sheet';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { toast } from 'sonner';
import {
  getTransitions,
  transitionIssue,
  buildIsoDatetime,
} from '../../lib/jiraScheduling';
import type { LojaGroup } from '../../types/scheduling';

interface Props {
  open: boolean;
  onClose: () => void;
  loja: string | null;
  allLojaGroups: LojaGroup[];
  pendentes: LojaGroup[];
  agendados: Map<string, LojaGroup[]>;
  tecCampo: LojaGroup[];
  onSuccess: () => void;
}

export function TransitionPanel({ open, onClose, loja, allLojaGroups, pendentes, agendados, tecCampo, onSuccess }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [emCampo, setEmCampo] = useState(true);
  const [date, setDate] = useState(today);
  const [hora, setHora] = useState('09:00');
  const [tecnico, setTecnico] = useState('');
  const [loading, setLoading] = useState(false);

  // For manual transition
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [manualTransId, setManualTransId] = useState('');
  const [availTrans, setAvailTrans] = useState<{ id: string; name: string }[]>([]);

  const lojaGroup = loja ? allLojaGroups.find(g => g.loja === loja) : null;
  const pendGroup = loja ? pendentes.find(g => g.loja === loja) : null;

  const agendadoIssues = loja
    ? [...(agendados?.values() ?? [])].flatMap(gs => gs.filter(g => g.loja === loja)).flatMap(g => g.issues)
    : [];
  const tcIssues = loja ? (tecCampo.find(g => g.loja === loja)?.issues ?? []) : [];
  const pendIssues = pendGroup?.issues ?? [];

  const allKeys = [...pendIssues, ...agendadoIssues, ...tcIssues].map(i => i.key);

  const handleEmCampo = async () => {
    if (!loja) return;
    setLoading(true);
    const dtIso = buildIsoDatetime(date, hora);
    let moved = 0;
    const errors: string[] = [];

    for (const key of allKeys) {
      try {
        const trans = await getTransitions(key);
        const isPend = pendIssues.some(i => i.key === key);

        if (isPend) {
          const agendTr = trans.find(t => t.name.toLowerCase().includes('agend'));
          if (agendTr) {
            await transitionIssue({ key, transitionId: agendTr.id, dataAgenda: dtIso, tecnico: tecnico || undefined });
          }
        }

        const trans2 = await getTransitions(key);
        const tcTr = trans2.find(t => t.toName.toLowerCase().includes('tec-campo') || t.name.toLowerCase().includes('tec-campo'));
        if (tcTr) {
          const ok = await transitionIssue({ key, transitionId: tcTr.id });
          if (ok) moved++;
          else errors.push(`${key}: falha ao mover TEC-CAMPO`);
        }
      } catch (e: any) {
        errors.push(`${key}: ${e?.message}`);
      }
    }

    setLoading(false);
    if (errors.length) toast.error(errors.join('\n'));
    else toast.success(`${moved} FSA(s) agendados e movidos → TEC-CAMPO`);
    onSuccess();
    onClose();
  };

  const loadTransitions = async (keys: string[]) => {
    if (!keys.length) return;
    try {
      const trans = await getTransitions(keys[0]);
      setAvailTrans(trans.map(t => ({ id: t.id, name: t.name })));
    } catch { /* ignore */ }
  };

  const handleManual = async () => {
    if (!selectedKeys.length || !manualTransId) {
      toast.warning('Selecione FSAs e a transição.');
      return;
    }
    setLoading(true);
    let mv = 0;
    const errors: string[] = [];
    for (const key of selectedKeys) {
      try {
        const ok = await transitionIssue({ key, transitionId: manualTransId });
        if (ok) mv++;
        else errors.push(`${key}: falha`);
      } catch (e: any) {
        errors.push(`${key}: ${e?.message}`);
      }
    }
    setLoading(false);
    if (errors.length) toast.error(errors.join('\n'));
    else toast.success(`${mv} FSA(s) movidos.`);
    onSuccess();
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:w-[420px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>🚚 Transição de Chamados</SheetTitle>
          <SheetDescription>{loja || 'Nenhuma loja selecionada'}</SheetDescription>
        </SheetHeader>

        {!loja ? (
          <p className="mt-6 text-sm text-muted-foreground">Selecione uma loja na lista de chamados.</p>
        ) : (
          <div className="mt-6 space-y-6">
            <p className="text-xs text-muted-foreground">
              Total: {allKeys.length} FSA(s) (pend.: {pendIssues.length} | agend.: {agendadoIssues.length} | TC: {tcIssues.length})
            </p>

            {/* Quick flow */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox id="em-campo" checked={emCampo} onCheckedChange={v => setEmCampo(Boolean(v))} />
                <Label htmlFor="em-campo" className="cursor-pointer font-semibold">Técnico em campo?</Label>
              </div>

              {emCampo && (
                <div className="space-y-3 pl-6">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Data</Label>
                      <Input type="date" value={date} min={today} onChange={e => setDate(e.target.value)} className="h-8" />
                    </div>
                    <div>
                      <Label className="text-xs">Hora</Label>
                      <Input type="time" value={hora} onChange={e => setHora(e.target.value)} className="h-8" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Técnico (Nome-CPF-RG-TEL)</Label>
                    <Input placeholder="Técnico…" value={tecnico} onChange={e => setTecnico(e.target.value)} className="h-8" />
                  </div>
                  <Button onClick={handleEmCampo} disabled={loading} className="w-full">
                    {loading ? 'Movendo…' : `Agendar + mover ${allKeys.length} FSA(s) → TEC-CAMPO`}
                  </Button>
                </div>
              )}
            </div>

            <hr className="border-border" />

            {/* Manual transition */}
            <div className="space-y-3">
              <p className="text-sm font-semibold">Transição manual</p>
              <div>
                <Label className="text-xs">FSAs</Label>
                <div className="max-h-40 overflow-y-auto border border-border rounded p-2 space-y-1">
                  {allKeys.map(k => (
                    <label key={k} className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedKeys.includes(k)}
                        onChange={e => {
                          const next = e.target.checked
                            ? [...selectedKeys, k]
                            : selectedKeys.filter(x => x !== k);
                          setSelectedKeys(next);
                          loadTransitions(next);
                        }}
                      />
                      {k}
                    </label>
                  ))}
                </div>
              </div>

              {availTrans.length > 0 && (
                <div>
                  <Label className="text-xs">Transição</Label>
                  <Select value={manualTransId} onValueChange={setManualTransId}>
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Selecionar…" />
                    </SelectTrigger>
                    <SelectContent>
                      {availTrans.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button variant="outline" onClick={handleManual} disabled={loading || !selectedKeys.length} className="w-full">
                {loading ? 'Aplicando…' : 'Aplicar transição'}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
