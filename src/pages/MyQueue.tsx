import { useEffect, useMemo, useState } from "react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { useAuth } from "../context/AuthContext";
import { listAssignmentsByTechnician, updateAssignmentStatus, appendActivity } from "../lib/workflow-firestore";
import { jiraSearch, mapJiraStatusToWorkflow } from "../lib/jira";
import type { AssignmentRecord } from "../types/workflow";

export default function MyQueue() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AssignmentRecord[]>([]);

  useEffect(() => {
    (async () => {
      if (!user) return;
      setLoading(true);
      try {
        const useJira = import.meta.env.VITE_JIRA_USE_EX_API === 'true';
        if (useJira) {
          // Busca issues atribuídas ao usuário no Jira
          const jql = `assignee = ${user.email} AND statusCategory != Done ORDER BY created DESC`;
          const issues = await jiraSearch(jql);
          const mapped: AssignmentRecord[] = issues.map((it) => ({
            id: it.id,
            fsaId: it.fields.summary?.match(/FSA\s*(\d+)/i)?.[1] || '—',
            tecnicoId: user.uid,
            status: mapJiraStatusToWorkflow(it.fields.status?.name),
            jiraIssueKey: it.key,
            createdAt: Date.parse(it.fields.created || new Date().toISOString()),
          }));
          setItems(mapped);
        } else {
          const rows = await listAssignmentsByTechnician(user.uid);
          setItems(rows);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.uid]);

  const sorted = useMemo(() => items.slice().sort((a,b) => (a.status === 'open' ? -1 : 1)), [items]);

  const handleAction = async (a: AssignmentRecord, action: 'start'|'pause'|'finish'|'continue') => {
    if (!user) return;
    const nextStatus = action === 'start' || action === 'continue' ? 'in_progress' : action === 'pause' ? 'waiting' : 'done';
    await updateAssignmentStatus(a.id, nextStatus);
    await appendActivity({ id: '', fsaId: a.fsaId, tecnicoId: user.uid, tipo: 'status_change', payload: { from: a.status, to: nextStatus }, ts: Date.now() });
    setItems(prev => prev.map(x => x.id === a.id ? { ...x, status: nextStatus } : x));
    if (nextStatus === 'in_progress') {
      // redirecionar para RAT com FSA pré-preenchida (via localStorage sinalizador)
      localStorage.setItem('rat_autofill_fsa', a.fsaId);
      window.location.href = '/rat';
    }
  };

  return (
    <div className="max-w-5xl mx-auto pt-4 pb-10 space-y-6">
      <h2 className="text-xl sm:text-2xl font-bold">Minha Fila – FSAs Atribuídas</h2>
      {loading ? (
        <div className="space-y-2">{Array.from({length:4}).map((_,i)=>(<Skeleton key={i} className="h-16 w-full" />))}</div>
      ) : (
        <div className="space-y-3">
          {sorted.length === 0 && <div className="text-sm text-muted-foreground">Nenhuma FSA atribuída.</div>}
          {sorted.map(a => (
            <Card key={a.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold">FSA {a.fsaId}</div>
                <div className="text-xs text-muted-foreground">Status: {a.status}</div>
              </div>
              <div className="flex gap-2">
                {a.status === 'open' && <Button onClick={()=>handleAction(a,'start')}>Iniciar</Button>}
                {a.status === 'in_progress' && <>
                  <Button variant="secondary" onClick={()=>handleAction(a,'pause')}>Pausar</Button>
                  <Button onClick={()=>handleAction(a,'finish')}>Concluir</Button>
                </>}
                {a.status === 'waiting' && <Button onClick={()=>handleAction(a,'continue')}>Continuar</Button>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}


