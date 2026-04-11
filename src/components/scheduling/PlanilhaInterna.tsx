import { useState, useMemo } from 'react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { updateTecnico } from '../../lib/jiraScheduling';
import type { SchedulingIssue, InternalNote } from '../../types/scheduling';

const LS_KEY = 'wt_scheduling_notes_v1';
const CLASSES = ['⚪ Não Classificado', '🟢 Confirmado', '🟡 Aguardando Confirmação', '🔴 Sem Técnico', '🚨 Crítico', '⏳ Esperando Peça'];

function loadNotes(): Map<string, InternalNote> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return new Map();
    const arr: InternalNote[] = JSON.parse(raw);
    return new Map(arr.map(n => [n.fsa, n]));
  } catch { return new Map(); }
}

function saveNotes(map: Map<string, InternalNote>) {
  localStorage.setItem(LS_KEY, JSON.stringify([...map.values()]));
}

interface Props { issues: SchedulingIssue[] }

export function PlanilhaInterna({ issues }: Props) {
  const [notes, setNotes] = useState<Map<string, InternalNote>>(loadNotes);
  const [filterLoja, setFilterLoja] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [savingJira, setSavingJira] = useState(false);
  const [edited, setEdited] = useState<Map<string, Partial<InternalNote>>>(new Map());

  const rows = useMemo(() => {
    let list = issues.map(issue => {
      const note = notes.get(issue.key) || {
        fsa: issue.key, classificacao: '⚪ Não Classificado',
        tecnico: issue.tecnico || '', data: '', obs: '', escalonado: false,
      };
      return { issue, note: { ...note } };
    });
    if (filterLoja) list = list.filter(r => r.issue.loja.toLowerCase().includes(filterLoja.toLowerCase()));
    if (filterClass) list = list.filter(r => r.note.classificacao === filterClass);
    if (filterStatus) list = list.filter(r => r.issue.status === filterStatus);
    return list;
  }, [issues, notes, filterLoja, filterClass, filterStatus]);

  const statuses = [...new Set(issues.map(i => i.status))];

  const updateNote = (fsa: string, field: keyof InternalNote, value: string | boolean) => {
    const current = notes.get(fsa) || { fsa, classificacao: '⚪ Não Classificado', tecnico: '', data: '', obs: '', escalonado: false };
    const next = { ...current, [field]: value };
    const newMap = new Map(notes);
    newMap.set(fsa, next);
    setNotes(newMap);

    const newEdited = new Map(edited);
    const prevEdited = newEdited.get(fsa) || {};
    newEdited.set(fsa, { ...prevEdited, [field]: value });
    setEdited(newEdited);
  };

  const save = () => {
    saveNotes(notes);
    toast.success('Planilha salva localmente!');
    setEdited(new Map());
  };

  const sendToJira = async () => {
    setSavingJira(true);
    let changed = 0;
    const errors: string[] = [];
    for (const [fsa, changes] of edited.entries()) {
      if (!changes.tecnico) continue;
      const origIssue = issues.find(i => i.key === fsa);
      if (!origIssue || changes.tecnico === origIssue.tecnico) continue;
      try {
        const ok = await updateTecnico(fsa, changes.tecnico);
        if (ok) changed++;
        else errors.push(`${fsa}: falha`);
      } catch (e: any) { errors.push(`${fsa}: ${e?.message}`); }
    }
    setSavingJira(false);
    saveNotes(notes);
    if (errors.length) toast.error(errors.join('\n'));
    if (changed) toast.success(`${changed} técnico(s) atualizado(s) no Jira!`);
    setEdited(new Map());
  };

  const getRowBg = (cls: string) => {
    if (cls.includes('Sem Técnico')) return 'bg-red-500/10';
    if (cls.includes('Confirmado')) return 'bg-green-500/10';
    if (cls.includes('Aguardando')) return 'bg-yellow-500/10';
    if (cls.includes('Crítico')) return 'bg-red-600/20';
    if (cls.includes('Esperando')) return 'bg-blue-500/10';
    return '';
  };

  const downloadCsv = () => {
    const header = 'FSA,Loja,Cidade,Status,Classificação,Técnico,Data,Obs,Escalonado\n';
    const body = rows.map(({ issue, note }) =>
      `"${issue.key}","${issue.loja}","${issue.cidade}","${issue.status}","${note.classificacao}","${note.tecnico}","${note.data}","${note.obs}",${note.escalonado}`
    ).join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'planilha_interna.csv'; a.click();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Controle interno local. Classificações e observações são salvas no seu navegador. Técnicos podem ser enviados ao Jira.</p>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-end">
        <Input placeholder="Filtrar loja…" value={filterLoja} onChange={e => setFilterLoja(e.target.value)} className="h-8 w-36" />
        <Select value={filterClass} onValueChange={setFilterClass}>
          <SelectTrigger className="h-8 w-44"><SelectValue placeholder="Classificação…" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas</SelectItem>
            {CLASSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 w-36"><SelectValue placeholder="Status Jira…" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos</SelectItem>
            {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{rows.length} / {issues.length}</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-border rounded-lg">
        <table className="w-full text-xs min-w-[900px]">
          <thead className="border-b bg-muted/50">
            <tr>
              {['FSA','Loja','Cidade','Status Jira','Classificação','Técnico','Data','Obs','Escalonado?'].map(h => (
                <th key={h} className="py-2 px-2 text-left font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ issue, note }) => (
              <tr key={issue.key} className={`border-b transition ${getRowBg(note.classificacao)}`}>
                <td className="py-1.5 px-2 font-mono whitespace-nowrap">{issue.key}</td>
                <td className="py-1.5 px-2 whitespace-nowrap">{issue.loja}</td>
                <td className="py-1.5 px-2 whitespace-nowrap text-muted-foreground">{issue.cidade}</td>
                <td className="py-1.5 px-2"><Badge variant="secondary" className="text-[10px]">{issue.status}</Badge></td>
                <td className="py-1.5 px-2">
                  <Select value={note.classificacao} onValueChange={v => updateNote(issue.key, 'classificacao', v)}>
                    <SelectTrigger className="h-6 text-[10px] w-40 px-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{CLASSES.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}</SelectContent>
                  </Select>
                </td>
                <td className="py-1.5 px-2">
                  <Input className="h-6 text-xs w-40 px-1" value={note.tecnico} onChange={e => updateNote(issue.key, 'tecnico', e.target.value)} />
                </td>
                <td className="py-1.5 px-2">
                  <Input type="date" className="h-6 text-[10px] w-28 px-1" value={note.data} onChange={e => updateNote(issue.key, 'data', e.target.value)} />
                </td>
                <td className="py-1.5 px-2">
                  <Input className="h-6 text-xs w-36 px-1" value={note.obs} placeholder="Obs…" onChange={e => updateNote(issue.key, 'obs', e.target.value)} />
                </td>
                <td className="py-1.5 px-2 text-center">
                  <Checkbox checked={note.escalonado} onCheckedChange={v => updateNote(issue.key, 'escalonado', Boolean(v))} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={9} className="py-6 text-center text-muted-foreground">Nenhum chamado encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={save}>💾 Salvar Localmente</Button>
        <Button size="sm" variant="outline" onClick={sendToJira} disabled={savingJira || !edited.size}>
          {savingJira ? 'Enviando…' : '🚀 Enviar Técnicos → Jira'}
        </Button>
        <Button size="sm" variant="ghost" onClick={downloadCsv}>⬇ Exportar CSV</Button>
        {edited.size > 0 && <span className="text-xs text-muted-foreground self-center">{edited.size} alteração(ões) não salva(s)</span>}
      </div>
    </div>
  );
}
