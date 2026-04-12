import { useEffect, useMemo, useState } from "react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { useAuth } from "../context/AuthContext";
import { listAssignmentsByTechnician, updateAssignmentStatus, appendActivity } from "../lib/workflow-firestore";
import { jiraSearch, mapJiraStatusToWorkflow } from "../lib/jira";
import type { AssignmentRecord } from "../types/workflow";
import {
  ClipboardList,
  Play,
  Pause,
  CheckCircle2,
  RotateCcw,
  FileText,
  Clock,
  ArrowRight,
} from "lucide-react";
import { cn } from "../lib/utils";

// ─── Helpers ─────────────────────────────────────────────────────────────────

type WorkflowStatus = AssignmentRecord["status"];

interface StatusConfig {
  label: string;
  badge: string;
  dot: string;
}

const STATUS_MAP: Record<string, StatusConfig> = {
  open:        { label: "Aberto",       badge: "bg-blue-500/12 text-blue-600 border-blue-500/25 dark:text-blue-400",    dot: "bg-blue-500" },
  in_progress: { label: "Em andamento", badge: "bg-amber-500/12 text-amber-600 border-amber-500/25 dark:text-amber-400", dot: "bg-amber-500" },
  waiting:     { label: "Aguardando",   badge: "bg-violet-500/12 text-violet-600 border-violet-500/25 dark:text-violet-400", dot: "bg-violet-500" },
  done:        { label: "Concluído",    badge: "bg-emerald-500/12 text-emerald-600 border-emerald-500/25 dark:text-emerald-400", dot: "bg-emerald-500" },
};

function statusConfig(s: string): StatusConfig {
  return STATUS_MAP[s] ?? { label: s, badge: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground" };
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function MyQueue() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AssignmentRecord[]>([]);

  useEffect(() => {
    (async () => {
      if (!user) return;
      setLoading(true);
      try {
        const useJira = import.meta.env.VITE_JIRA_USE_EX_API === "true";
        if (useJira) {
          const jql = `assignee = ${user.email} AND statusCategory != Done ORDER BY created DESC`;
          const issues = await jiraSearch(jql);
          const mapped: AssignmentRecord[] = issues.map((it: any) => ({
            id: it.id,
            fsaId: it.fields.summary?.match(/FSA\s*(\d+)/i)?.[1] || "—",
            tecnicoId: user.uid,
            status: mapJiraStatusToWorkflow(it.fields.status?.name) as WorkflowStatus,
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

  const sorted = useMemo(
    () =>
      items.slice().sort((a, b) => {
        const order: Record<string, number> = { in_progress: 0, open: 1, waiting: 2, done: 3 };
        return (order[a.status] ?? 9) - (order[b.status] ?? 9);
      }),
    [items],
  );

  const handleAction = async (
    a: AssignmentRecord,
    action: "start" | "pause" | "finish" | "continue",
  ) => {
    if (!user) return;
    const nextStatus: WorkflowStatus =
      action === "start" || action === "continue"
        ? "in_progress"
        : action === "pause"
        ? "waiting"
        : "done";

    await updateAssignmentStatus(a.id, nextStatus);
    await appendActivity({
      id: "",
      fsaId: a.fsaId,
      tecnicoId: user.uid,
      tipo: "status_change",
      payload: { from: a.status, to: nextStatus },
      ts: Date.now(),
    });

    setItems(prev => prev.map(x => (x.id === a.id ? { ...x, status: nextStatus } : x)));

    if (nextStatus === "in_progress") {
      localStorage.setItem("rat_autofill_fsa", a.fsaId);
      window.location.href = "/rat";
    }
  };

  // ── Estatísticas rápidas ──
  const stats = useMemo(() => ({
    open:        items.filter(i => i.status === "open").length,
    in_progress: items.filter(i => i.status === "in_progress").length,
    waiting:     items.filter(i => i.status === "waiting").length,
    done:        items.filter(i => i.status === "done").length,
  }), [items]);

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10 animate-page-in">

      {/* ── Cabeçalho ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-primary" />
            Minha Fila
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            FSAs atribuídas ao seu usuário
          </p>
        </div>

        {!loading && items.length > 0 && (
          <div className="flex gap-2 flex-wrap justify-end">
            {Object.entries(stats).filter(([, v]) => v > 0).map(([k, v]) => {
              const cfg = statusConfig(k);
              return (
                <span
                  key={k}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold border",
                    cfg.badge,
                  )}
                >
                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", cfg.dot)} />
                  {v} {cfg.label}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && sorted.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
            <ClipboardList className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <p className="text-base font-semibold">Nenhuma FSA atribuída</p>
            <p className="text-sm text-muted-foreground mt-1">
              Quando chamados forem atribuídos a você, eles aparecerão aqui.
            </p>
          </div>
          <Button variant="outline" className="gap-2 mt-1" onClick={() => window.location.href = "/agendamento"}>
            <ArrowRight className="w-4 h-4" />
            Ver Agendamentos
          </Button>
        </div>
      )}

      {/* ── Lista de itens ── */}
      {!loading && sorted.length > 0 && (
        <div className="space-y-3">
          {sorted.map(a => {
            const cfg = statusConfig(a.status);
            const isDone = a.status === "done";

            return (
              <Card
                key={a.id}
                className={cn(
                  "overflow-hidden shadow-card transition-all duration-150",
                  isDone && "opacity-60",
                )}
              >
                {/* Faixa lateral de cor */}
                <div className={cn("flex items-center gap-4 p-4")}>
                  <div
                    className={cn(
                      "w-1 self-stretch rounded-full shrink-0",
                      cfg.dot,
                    )}
                  />

                  {/* Ícone */}
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm">FSA {a.fsaId}</span>
                      {a.jiraIssueKey && (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {a.jiraIssueKey}
                        </span>
                      )}
                      <Badge
                        className={cn(
                          "text-[10px] font-semibold border",
                          cfg.badge,
                        )}
                      >
                        {cfg.label}
                      </Badge>
                    </div>
                    {a.createdAt > 0 && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Criado em {new Date(a.createdAt).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    {a.status === "open" && (
                      <Button
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => handleAction(a, "start")}
                      >
                        <Play className="w-3.5 h-3.5" /> Iniciar
                      </Button>
                    )}
                    {a.status === "in_progress" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5 text-xs"
                          onClick={() => handleAction(a, "pause")}
                        >
                          <Pause className="w-3.5 h-3.5" /> Pausar
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => handleAction(a, "finish")}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Concluir
                        </Button>
                      </>
                    )}
                    {a.status === "waiting" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => handleAction(a, "continue")}
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Continuar
                      </Button>
                    )}
                    {isDone && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Concluído
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
