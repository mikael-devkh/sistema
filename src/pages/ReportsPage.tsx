import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import { Separator } from "../components/ui/separator";
import {
  FileText, Clipboard, Eye, Download, Save, RotateCcw,
  Search, Store, Hash, CalendarRange, Filter, X,
} from "lucide-react";
import { toast } from "sonner";
import { db } from "../firebase";
import {
  collection, getDocs, limit as fbLimit, onSnapshot,
  orderBy, query, startAfter, where,
  type DocumentSnapshot,
} from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { cn } from "../lib/utils";

// ─── Mock fallback ────────────────────────────────────────────────────────────
const mockReports = [
  { id: "RAT-2025-001", status: "Emitida",   loja: "1323", data: "2025-10-29", responsavel: "João", resumo: "Troca de SSD, update BIOS" },
  { id: "RAT-2025-002", status: "Pendente",  loja: "1327", data: "2025-10-28", responsavel: "Ana",  resumo: "Impressora Zebra — erro de etiqueta" },
  { id: "RAT-2025-003", status: "Finalizada",loja: "3131", data: "2025-10-27", responsavel: "João", resumo: "Fonte PDV substituída" },
];

type Report = typeof mockReports[number];
type StatusFilter = "all" | "Emitida" | "Pendente" | "Finalizada";

const PAGE_SIZE = 12;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusBadge(s: string) {
  if (s === "Finalizada") return "bg-emerald-500/12 text-emerald-600 border-emerald-500/25 dark:text-emerald-400";
  if (s === "Pendente")   return "bg-amber-500/12  text-amber-600  border-amber-500/25  dark:text-amber-400";
  return                         "bg-blue-500/12   text-blue-600   border-blue-500/25   dark:text-blue-400";
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { user } = useAuth();
  const [loading, setLoading]     = useState(true);
  const [items, setItems]         = useState<Report[]>([]);
  const [hasMore, setHasMore]     = useState(false);
  const [lastDoc, setLastDoc]     = useState<DocumentSnapshot | null>(null);
  const [selected, setSelected]   = useState<Report | null>(null);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});

  // Filtros
  const [search, setSearch]       = useState("");
  const [status, setStatus]       = useState<StatusFilter>("all");
  const [storeFilter, setStoreFilter] = useState("");
  const [fsaFilter, setFsaFilter] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd]     = useState("");

  const mapDoc = (d: any): Report => {
    const data = d.data();
    const archivedAt = data.archivedAt?.toDate?.() as Date | undefined;
    return {
      id:          data.fsa ? `RAT-${data.fsa}` : d.id,
      status:      data.status === "archived" ? "Finalizada" : (data.status || "Emitida"),
      loja:        String(data.codigoLoja || ""),
      data:        archivedAt ? archivedAt.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      responsavel: "",
      resumo:      data.pdv ? `PDV ${data.pdv} · ${data.durationMinutes || 0} min` : `${data.durationMinutes || 0} min`,
    };
  };

  const fetchPage = async (cursor: DocumentSnapshot | null) => {
    setLoading(true);
    try {
      const base    = collection(db, "serviceReports");
      const clauses: any[] = [orderBy("archivedAt", "desc"), fbLimit(PAGE_SIZE)];
      if (user?.uid) clauses.unshift(where("userId", "==", user.uid));
      if (cursor)    clauses.push(startAfter(cursor));
      const snap = await getDocs(query(base, ...clauses));
      const docs = snap.docs.map(mapDoc);
      setItems(prev => cursor ? [...prev, ...docs] : docs);
      setLastDoc(snap.docs[snap.docs.length - 1] || null);
      setHasMore(snap.size === PAGE_SIZE);
    } catch {
      if (!cursor) { setItems(mockReports); setHasMore(false); }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPage(null); }, [user?.uid]);

  // Realtime: notifica novo registro arquivado
  useEffect(() => {
    try {
      const base = collection(db, "serviceReports");
      const clauses: any[] = [orderBy("archivedAt", "desc"), fbLimit(1)];
      if (user?.uid) clauses.unshift(where("userId", "==", user.uid));
      const unsub = onSnapshot(query(base, ...clauses), snap => {
        if (!snap.empty && items.length) {
          toast.info(`Novo registro arquivado: ${mapDoc(snap.docs[0]).id}`);
        }
      });
      return () => unsub();
    } catch {}
  }, [user?.uid, items.length]);

  // ── Filtros ──
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items
      .filter(r => status === "all" || r.status === status)
      .filter(r =>
        !q || r.id.toLowerCase().includes(q) ||
        r.loja.includes(q) || r.resumo.toLowerCase().includes(q)
      )
      .filter(r => !storeFilter || r.loja.includes(storeFilter))
      .filter(r => !fsaFilter   || r.id.includes(fsaFilter))
      .filter(r => {
        if (!dateStart && !dateEnd) return true;
        return (!dateStart || r.data >= dateStart) && (!dateEnd || r.data <= dateEnd);
      })
      .sort((a, b) => (a.data < b.data ? 1 : -1));
  }, [items, search, status, storeFilter, fsaFilter, dateStart, dateEnd]);

  const activeFilters = [search, storeFilter, fsaFilter, dateStart, dateEnd].some(Boolean) || status !== "all";
  const selectedCount = Object.values(selectedIds).filter(Boolean).length;

  const clearFilters = () => {
    setSearch(""); setStatus("all"); setStoreFilter("");
    setFsaFilter(""); setDateStart(""); setDateEnd("");
  };

  const handleCopy = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      toast.success("Código copiado!");
    } catch {
      toast.error("Não foi possível copiar o código.");
    }
  };

  const handleExportCsv = () => {
    const rows = filtered.filter(r => selectedIds[r.id]);
    if (!rows.length) { toast.info("Selecione ao menos 1 item."); return; }
    const header = ["id", "status", "loja", "data", "responsavel", "resumo"];
    const csv = [
      header.join(","),
      ...rows.map(r => header.map(h => JSON.stringify((r as any)[h] ?? "")).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `historico-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const saveView = () => {
    localStorage.setItem("reports_view", JSON.stringify({ status, storeFilter, fsaFilter, dateStart, dateEnd }));
    toast.success("Visão salva.");
  };

  const loadView = () => {
    const raw = localStorage.getItem("reports_view");
    if (!raw) { toast.info("Nenhuma visão salva."); return; }
    try {
      const v = JSON.parse(raw);
      setStatus(v.status || "all");
      setStoreFilter(v.storeFilter || "");
      setFsaFilter(v.fsaFilter || "");
      setDateStart(v.dateStart || "");
      setDateEnd(v.dateEnd || "");
      toast.success("Visão aplicada.");
    } catch { toast.error("Falha ao carregar visão."); }
  };

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 pb-8 animate-page-in">

      {/* ── Cabeçalho ── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Histórico de RATs</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Registros de atendimento arquivados
        </p>
      </div>

      {/* ── Painel de filtros ── */}
      <div className="rounded-xl border border-border bg-card shadow-card p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {/* Busca geral */}
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar por código, loja ou resumo…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          {/* Status */}
          <Select value={status} onValueChange={v => setStatus(v as StatusFilter)}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="Emitida">Emitida</SelectItem>
              <SelectItem value="Pendente">Pendente</SelectItem>
              <SelectItem value="Finalizada">Finalizada</SelectItem>
            </SelectContent>
          </Select>

          {/* Loja */}
          <div className="relative w-28">
            <Store className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Loja"
              value={storeFilter}
              onChange={e => setStoreFilter(e.target.value)}
              className="pl-8"
            />
          </div>

          {/* FSA */}
          <div className="relative w-32">
            <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="FSA"
              value={fsaFilter}
              onChange={e => setFsaFilter(e.target.value)}
              className="pl-8"
            />
          </div>

          {/* Período */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <CalendarRange className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <Input
              type="date"
              value={dateStart}
              onChange={e => setDateStart(e.target.value)}
              className="w-36 text-sm"
            />
            <span className="text-xs text-muted-foreground">–</span>
            <Input
              type="date"
              value={dateEnd}
              onChange={e => setDateEnd(e.target.value)}
              className="w-36 text-sm"
            />
          </div>
        </div>

        <Separator />

        {/* Barra de ações */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Filter className="w-3.5 h-3.5" />
            <span>
              <span className="font-semibold text-foreground">{filtered.length}</span> registro(s)
              {selectedCount > 0 && (
                <span className="ml-1 text-primary font-medium">
                  · {selectedCount} selecionado(s)
                </span>
              )}
            </span>
            {activeFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-primary hover:text-primary/80 font-medium transition-colors"
              >
                <X className="w-3 h-3" /> Limpar
              </button>
            )}
          </div>

          <div className="flex gap-1.5">
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={saveView}>
              <Save className="w-3.5 h-3.5" /> Salvar visão
            </Button>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={loadView}>
              <RotateCcw className="w-3.5 h-3.5" /> Aplicar visão
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={handleExportCsv}
              disabled={selectedCount === 0}
            >
              <Download className="w-3.5 h-3.5" /> Exportar CSV
            </Button>
          </div>
        </div>
      </div>

      {/* ── Grid de cards ── */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {/* Skeleton */}
        {loading && Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="p-4 space-y-3 shadow-card">
            <div className="flex justify-between items-start">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-full" />
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-7 flex-1 rounded-md" />
              <Skeleton className="h-7 flex-1 rounded-md" />
            </div>
          </Card>
        ))}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="col-span-full flex flex-col items-center gap-4 py-16 text-center text-muted-foreground">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="font-medium">Nenhum registro encontrado</p>
              <p className="text-sm mt-0.5">
                {activeFilters
                  ? "Tente ajustar ou limpar os filtros."
                  : "Os atendimentos arquivados aparecerão aqui."}
              </p>
            </div>
            {activeFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters} className="gap-2">
                <X className="w-3.5 h-3.5" /> Limpar filtros
              </Button>
            )}
          </div>
        )}

        {/* Cards */}
        {!loading && filtered.map(rep => (
          <Card
            key={rep.id}
            className={cn(
              "shadow-card group hover:shadow-card-md hover:border-primary/30 transition-all duration-150 overflow-hidden",
              selectedIds[rep.id] && "border-primary/40 bg-primary/[0.02]",
            )}
          >
            <CardContent className="p-4 flex flex-col gap-2.5">
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <label className="flex items-center gap-2 min-w-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!selectedIds[rep.id]}
                    onChange={e => setSelectedIds(prev => ({ ...prev, [rep.id]: e.target.checked }))}
                    className="accent-primary w-4 h-4 shrink-0 rounded cursor-pointer"
                  />
                  <div className="flex items-center gap-1.5 text-primary font-bold text-sm min-w-0">
                    <FileText className="w-4 h-4 shrink-0" />
                    <span className="truncate">{rep.id}</span>
                  </div>
                </label>
                <Badge className={cn("text-[10px] font-semibold border shrink-0", statusBadge(rep.status))}>
                  {rep.status}
                </Badge>
              </div>

              {/* Meta */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <Store className="w-3 h-3" /> Loja {rep.loja}
                </span>
                <span className="text-border">·</span>
                <span>{rep.data}</span>
                {rep.responsavel && (
                  <>
                    <span className="text-border">·</span>
                    <span>{rep.responsavel}</span>
                  </>
                )}
              </div>

              {/* Resumo */}
              {rep.resumo && (
                <p className="text-xs text-foreground/75 line-clamp-2 leading-relaxed">
                  {rep.resumo}
                </p>
              )}

              {/* Ações */}
              <div className="flex gap-2 pt-0.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs flex-1"
                  onClick={() => setSelected(rep)}
                >
                  <Eye className="w-3.5 h-3.5" /> Ver
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-xs flex-1"
                  onClick={() => handleCopy(rep.id)}
                >
                  <Clipboard className="w-3.5 h-3.5" /> Copiar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Carregar mais */}
      {!loading && hasMore && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={() => fetchPage(lastDoc)} className="gap-2">
            Carregar mais registros
          </Button>
        </div>
      )}

      {/* ── Dialog de detalhe ── */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Detalhes da RAT
            </DialogTitle>
            <DialogDescription>{selected?.id}</DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-0.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Status</p>
                  <Badge className={cn("text-xs border", statusBadge(selected.status))}>
                    {selected.status}
                  </Badge>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Loja</p>
                  <p className="font-semibold">{selected.loja}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Data</p>
                  <p>{selected.data}</p>
                </div>
                {selected.responsavel && (
                  <div className="space-y-0.5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Responsável</p>
                    <p>{selected.responsavel}</p>
                  </div>
                )}
              </div>

              {selected.resumo && (
                <div className="rounded-lg bg-secondary/50 border border-border/60 p-3 text-sm">
                  {selected.resumo}
                </div>
              )}

              <div className="flex justify-end pt-1">
                <Button
                  onClick={() => handleCopy(selected.id)}
                  size="sm"
                  variant="outline"
                  className="gap-2"
                >
                  <Clipboard className="w-4 h-4" /> Copiar código
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
