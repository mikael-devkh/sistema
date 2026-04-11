import { useEffect, useMemo, useState } from "react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { listAllAssignments, reassignAssignment, updateAssignmentStatus, appendActivity } from "../lib/workflow-firestore";
import { jiraSearch, mapJiraStatusToWorkflow, jiraTransition } from "../lib/jira";
import type { AssignmentRecord } from "../types/workflow";
import { useAuth } from "../context/AuthContext";

export default function FsasKanban() {
  const [items, setItems] = useState<AssignmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    (async () => {
      setLoading(true);
      const useJira = import.meta.env.VITE_JIRA_USE_EX_API === 'true';
      if (useJira) {
        // Traz últimas issues (ajuste JQL conforme necessidade)
        const issues = await jiraSearch('statusCategory in ("To Do","In Progress") ORDER BY created DESC');
        const mapped: AssignmentRecord[] = issues.map(it => ({
          id: it.id,
          fsaId: it.fields.summary?.match(/FSA\s*(\d+)/i)?.[1] || '—',
          tecnicoId: it.fields.assignee?.accountId || '',
          status: mapJiraStatusToWorkflow(it.fields.status?.name),
          jiraIssueKey: it.key,
          createdAt: Date.parse(it.fields.created || new Date().toISOString()),
        }));
        setItems(mapped);
      } else {
        const rows = await listAllAssignments();
        setItems(rows);
      }
      setLoading(false);
    })();
  }, []);

  const groups = useMemo(() => {
    const map: Record<string, AssignmentRecord[]> = { open:[], in_progress:[], waiting:[], done:[] };
    items.forEach(i => { (map[i.status] ||= []).push(i); });
    return map;
  }, [items]);

  const move = async (a: AssignmentRecord, status: AssignmentRecord["status"]) => {
    const useJira = import.meta.env.VITE_JIRA_USE_EX_API === 'true';
    if (useJira && a.jiraIssueKey) {
      try {
        const target: any = status === 'in_progress' ? 'in_progress' : status === 'waiting' ? 'waiting' : 'done';
        await jiraTransition(a.jiraIssueKey, target);
      } catch (e) {
        console.error(e);
      }
    } else {
      await updateAssignmentStatus(a.id, status);
      await appendActivity({ id:'', fsaId: a.fsaId, tecnicoId: a.tecnicoId, tipo:'status_change', payload:{ to: status }, ts: Date.now() });
    }
    setItems(prev => prev.map(x => x.id === a.id ? { ...x, status } : x));
  };

  const assignMe = async (a: AssignmentRecord) => {
    if (!user) return;
    await reassignAssignment(a.id, user.uid);
    await appendActivity({ id:'', fsaId: a.fsaId, tecnicoId: user.uid, tipo:'status_change', payload:{ reassigned: true }, ts: Date.now() });
    setItems(prev => prev.map(x => x.id === a.id ? { ...x, tecnicoId: user.uid } : x));
  };

  const Column = ({title, statusKey}:{title:string; statusKey:AssignmentRecord['status']}) => (
    <Card className="p-3 min-h-[300px]">
      <div className="font-semibold mb-2">{title}</div>
      <div className="space-y-2">
        {groups[statusKey].map(a => (
          <Card key={a.id} className="p-3">
            <div className="text-sm font-medium">FSA {a.fsaId}</div>
            <div className="text-xs text-muted-foreground mb-2">Técnico: {a.tecnicoId || '—'}</div>
            <div className="flex flex-wrap gap-2">
              {statusKey !== 'in_progress' && <Button size="sm" onClick={()=>move(a,'in_progress')}>Em andamento</Button>}
              {statusKey !== 'waiting' && <Button size="sm" variant="secondary" onClick={()=>move(a,'waiting')}>Aguardando</Button>}
              {statusKey !== 'done' && <Button size="sm" variant="outline" onClick={()=>move(a,'done')}>Concluir</Button>}
              <Button size="sm" variant="ghost" onClick={()=>assignMe(a)}>Atribuir a mim</Button>
            </div>
          </Card>
        ))}
        {groups[statusKey].length === 0 && <div className="text-xs text-muted-foreground">Vazio</div>}
      </div>
    </Card>
  );

  return (
    <div className="max-w-6xl mx-auto pt-4 pb-10 space-y-6">
      <h2 className="text-xl sm:text-2xl font-bold">FSAs – Kanban</h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Column title="Não iniciado" statusKey="open" />
        <Column title="Em andamento" statusKey="in_progress" />
        <Column title="Aguardando" statusKey="waiting" />
        <Column title="Concluído" statusKey="done" />
      </div>
    </div>
  );
}



