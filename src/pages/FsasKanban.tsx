import { useEffect, useMemo, useState } from "react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { listAllAssignments, reassignAssignment, updateAssignmentStatus, appendActivity } from "../lib/workflow-firestore";
import { jiraSearch, mapJiraStatusToWorkflow, jiraTransition } from "../lib/jira";
import type { AssignmentRecord } from "../types/workflow";
import { useAuth } from "../context/AuthContext";
import { cn } from "../lib/utils";
import {
  Building2,
  CheckCircle2,
  CircleDot,
  Clock,
  Hourglass,
  RefreshCw,
  UserCheck,
} from "lucide-react";

// ─── Column config ────────────────────────────────────────────────────────────

const COLUMNS: {
  key: AssignmentRecord["status"];
  label: string;
  icon: React.ElementType;
  color: string;
  badgeClass: string;
  borderClass: string;
  headerClass: string;
}[] = [
  {
    key: "open",
    label: "Não iniciado",
    icon: CircleDot,
    color: "text-slate-500",
    badgeClass: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    borderClass: "border-slate-200 dark:border-slate-700",
    headerClass: "bg-slate-50 dark:bg-slate-900/40",
  },
  {
    key: "in_progress",
    label: "Em andamento",
    icon: Clock,
    color: "text-amber-500",
    badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    borderClass: "border-amber-200 dark:border-amber-800/40",
    headerClass: "bg-amber-50 dark:bg-amber-900/20",
  },
  {
    key: "waiting",
    label: "Aguardando",
    icon: Hourglass,
    color: "text-violet-500",
    badgeClass: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    borderClass: "border-violet-200 dark:border-violet-800/40",
    headerClass: "bg-violet-50 dark:bg-violet-900/20",
  },
  {
    key: "done",
    label: "Concluído",
    icon: CheckCircle2,
    color: "text-emerald-500",
    badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    borderClass: "border-emerald-200 dark:border-emerald-800/40",
    headerClass: "bg-emerald-50 dark:bg-emerald-900/20",
  },
];

const NEXT_ACTIONS: Record<AssignmentRecord["status"], { status: AssignmentRecord["status"]; label: string }[]> = {
  open:        [{ status: "in_progress", label: "Iniciar" }],
  in_progress: [{ status: "waiting", label: "Aguardar" }, { status: "done", label: "Concluir" }],
  waiting:     [{ status: "in_progress", label: "Retomar" }, { status: "done", label: "Concluir" }],
  done:        [{ status: "open", label: "Reabrir" }],
};

// ─── AssignmentCard ───────────────────────────────────────────────────────────

function AssignmentCard({
  item,
  currentUserId,
  col,
  onMove,
  onAssignMe,
}: {
  item: AssignmentRecord;
  currentUserId?: string;
  col: typeof COLUMNS[number];
  onMove: (a: AssignmentRecord, s: AssignmentRecord["status"]) => Promise<void>;
  onAssignMe: (a: AssignmentRecord) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const isAssignedToMe = item.tecnicoId === currentUserId;
  const ColIcon = col.icon;

  const handleMove = async (status: AssignmentRecord["status"]) => {
    setLoading(true);
    try { await onMove(item, status); } finally { setLoading(false); }
  };

  const handleAssignMe = async () => {
    setLoading(true);
    try { await onAssignMe(item); } finally { setLoading(false); }
  };

  return (
    <div
      className={cn(
        "rounded-xl border bg-card shadow-sm hover:shadow-md transition-shadow p-4 space-y-3",
        col.borderClass,
        loading && "opacity-60 pointer-events-none",
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", col.headerClass)}>
            <ColIcon className={cn("w-4 h-4", col.color)} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">FSA {item.fsaId}</p>
            {item.jiraIssueKey && (
              <p className="text-[11px] text-muted-foreground font-mono">{item.jiraIssueKey}</p>
            )}
          </div>
        </div>
        <span className={cn("text-[11px] font-semibold rounded-full px-2 py-0.5 shrink-0", col.badgeClass)}>
          {col.label}
        </span>
      </div>

      {/* Técnico */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Building2 className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">
          {item.tecnicoId
            ? isAssignedToMe
              ? "Você"
              : item.tecnicoId.slice(0, 8) + "…"
            : "Não atribuído"}
        </span>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {NEXT_ACTIONS[item.status].map(({ status, label }) => (
          <Button
            key={status}
            size="sm"
            variant={status === "done" ? "default" : "outline"}
            className="h-7 text-xs px-2.5"
            disabled={loading}
            onClick={() => handleMove(status)}
          >
            {label}
          </Button>
        ))}
        {!isAssignedToMe && currentUserId && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs px-2.5 text-primary hover:text-primary"
            disabled={loading}
            onClick={handleAssignMe}
          >
            <UserCheck className="w-3 h-3 mr-1" />
            Atribuir a mim
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── KanbanColumn ─────────────────────────────────────────────────────────────

function KanbanColumn({
  col,
  items,
  currentUserId,
  onMove,
  onAssignMe,
}: {
  col: typeof COLUMNS[number];
  items: AssignmentRecord[];
  currentUserId?: string;
  onMove: (a: AssignmentRecord, s: AssignmentRecord["status"]) => Promise<void>;
  onAssignMe: (a: AssignmentRecord) => Promise<void>;
}) {
  const ColIcon = col.icon;

  return (
    <div className="flex flex-col min-h-[480px] rounded-xl border border-border bg-muted/30 overflow-hidden">
      {/* Column Header */}
      <div className={cn("flex items-center justify-between gap-2 px-4 py-3 border-b border-border", col.headerClass)}>
        <div className="flex items-center gap-2">
          <ColIcon className={cn("w-4 h-4", col.color)} />
          <span className="text-sm font-semibold">{col.label}</span>
        </div>
        <span className={cn("text-xs font-bold rounded-full min-w-[22px] h-[22px] flex items-center justify-center px-1.5", col.badgeClass)}>
          {items.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 p-3 space-y-2.5 overflow-y-auto">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center py-10 text-center">
            <ColIcon className={cn("w-8 h-8 mb-2 opacity-25", col.color)} />
            <p className="text-xs text-muted-foreground">Nenhuma FSA aqui</p>
          </div>
        ) : (
          items.map(item => (
            <AssignmentCard
              key={item.id}
              item={item}
              col={col}
              currentUserId={currentUserId}
              onMove={onMove}
              onAssignMe={onAssignMe}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── FsasKanban ───────────────────────────────────────────────────────────────

export default function FsasKanban() {
  const [items, setItems] = useState<AssignmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const loadData = async () => {
    setLoading(true);
    try {
      const useJira = import.meta.env.VITE_JIRA_USE_EX_API === "true";
      if (useJira) {
        const issues = await jiraSearch('statusCategory in ("To Do","In Progress") ORDER BY created DESC');
        const mapped: AssignmentRecord[] = issues.map(it => ({
          id: it.id,
          fsaId: it.fields.summary?.match(/FSA\s*(\d+)/i)?.[1] || "—",
          tecnicoId: it.fields.assignee?.accountId || "",
          status: mapJiraStatusToWorkflow(it.fields.status?.name),
          jiraIssueKey: it.key,
          createdAt: Date.parse(it.fields.created || new Date().toISOString()),
        }));
        setItems(mapped);
      } else {
        setItems(await listAllAssignments());
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const groups = useMemo(() => {
    const map: Record<string, AssignmentRecord[]> = { open: [], in_progress: [], waiting: [], done: [] };
    items.forEach(i => { (map[i.status] ||= []).push(i); });
    return map;
  }, [items]);

  const move = async (a: AssignmentRecord, status: AssignmentRecord["status"]) => {
    const useJira = import.meta.env.VITE_JIRA_USE_EX_API === "true";
    if (useJira && a.jiraIssueKey) {
      try { await jiraTransition(a.jiraIssueKey, status as any); } catch {}
    } else {
      await updateAssignmentStatus(a.id, status);
      await appendActivity({ id: "", fsaId: a.fsaId, tecnicoId: a.tecnicoId, tipo: "status_change", payload: { to: status }, ts: Date.now() });
    }
    setItems(prev => prev.map(x => x.id === a.id ? { ...x, status } : x));
  };

  const assignMe = async (a: AssignmentRecord) => {
    if (!user) return;
    await reassignAssignment(a.id, user.uid);
    await appendActivity({ id: "", fsaId: a.fsaId, tecnicoId: user.uid, tipo: "status_change", payload: { reassigned: true }, ts: Date.now() });
    setItems(prev => prev.map(x => x.id === a.id ? { ...x, tecnicoId: user.uid } : x));
  };

  const total = items.length;

  return (
    <div className="space-y-6 animate-page-in">
      {/* Header */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-primary via-primary/70 to-primary/30" />
        <div className="flex items-center justify-between gap-4 px-6 py-4">
          <div>
            <h1 className="text-xl font-bold">FSAs — Kanban</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {loading ? "Carregando…" : `${total} ${total === 1 ? "atribuição" : "atribuições"} no total`}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="gap-1.5">
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            Atualizar
          </Button>
        </div>

        {/* Summary chips */}
        {!loading && (
          <div className="flex items-center gap-2 flex-wrap px-6 pb-4">
            {COLUMNS.map(col => (
              <span key={col.key} className={cn("inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1", col.badgeClass)}>
                <col.icon className="w-3 h-3" />
                {col.label}: {groups[col.key].length}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Board */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {COLUMNS.map(col => (
            <div key={col.key} className="rounded-xl border border-border bg-muted/30 overflow-hidden">
              <div className={cn("px-4 py-3 border-b border-border", col.headerClass)}>
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="p-3 space-y-2.5">
                {[1, 2].map(i => <Skeleton key={i} className="h-[110px] rounded-xl" />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {COLUMNS.map(col => (
            <KanbanColumn
              key={col.key}
              col={col}
              items={groups[col.key]}
              currentUserId={user?.uid}
              onMove={move}
              onAssignMe={assignMe}
            />
          ))}
        </div>
      )}
    </div>
  );
}
