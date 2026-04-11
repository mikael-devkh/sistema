import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { FileText, Clipboard, Eye, Download, Save, RotateCcw, Search, Store, Hash, CalendarRange } from "lucide-react";
import { Skeleton } from "../components/ui/skeleton";
import { Badge } from "../components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import { db } from "../firebase";
import { collection, getDocs, limit as fbLimit, onSnapshot, orderBy, query, startAfter, where, type DocumentSnapshot } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";

const mockReports = [
  { id: "RAT-2025-001", status: "Emitida", loja: "1323", data: "2025-10-29", responsavel: "João", resumo: "Troca de SSD, update BIOS" },
  { id: "RAT-2025-002", status: "Pendente", loja: "1327", data: "2025-10-28", responsavel: "Ana", resumo: "Impressora Zebra - erro de etiqueta" },
  { id: "RAT-2025-003", status: "Finalizada", loja: "3131", data: "2025-10-27", responsavel: "João", resumo: "Fonte PDV substituída" },
  // ...adicione mais mocks
];

export default function ReportsPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"all" | "Emitida" | "Pendente" | "Finalizada">("all");
  const [selected, setSelected] = useState<typeof mockReports[number] | null>(null);
  const [items, setItems] = useState<typeof mockReports>([]);
  const [hasMore, setHasMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const PAGE_SIZE = 12;
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [storeFilter, setStoreFilter] = useState("");
  const [fsaFilter, setFsaFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const mapDoc = (d: any): typeof mockReports[number] => {
    const data = d.data();
    // Campos esperados do serviceReports: userId, codigoLoja, fsa, pdv, durationMinutes, status, archivedAt
    const archivedAt = data.archivedAt?.toDate?.() as Date | undefined;
    return {
      id: data.fsa ? `RAT-${data.fsa}` : d.id,
      status: data.status === "archived" ? "Finalizada" : (data.status || "Emitida"),
      loja: String(data.codigoLoja || ""),
      data: archivedAt ? archivedAt.toISOString().slice(0,10) : new Date().toISOString().slice(0,10),
      responsavel: "",
      resumo: data.pdv ? `PDV ${data.pdv} • ${data.durationMinutes || 0} min` : `${data.durationMinutes || 0} min`,
    };
  };

  const fetchPage = async (cursor: DocumentSnapshot | null) => {
    try {
      setLoading(true);
      const base = collection(db, "serviceReports");
      const clauses: any[] = [orderBy("archivedAt", "desc"), fbLimit(PAGE_SIZE)];
      if (user?.uid) clauses.unshift(where("userId", "==", user.uid));
      if (cursor) clauses.push(startAfter(cursor));
      const q = query(base, ...clauses);
      const snap = await getDocs(q);
      const docs = snap.docs.map(mapDoc);
      setItems(prev => cursor ? [...prev, ...docs] : docs);
      setLastDoc(snap.docs[snap.docs.length - 1] || null);
      setHasMore(snap.size === PAGE_SIZE);
    } catch (e) {
      console.warn("Histórico: fallback para dados locais", e);
      if (!cursor) {
        setItems(mockReports);
        setHasMore(false);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // Notificações realtime de novos registros arquivados
  useEffect(() => {
    try {
      const base = collection(db, "serviceReports");
      const clauses: any[] = [orderBy("archivedAt", "desc"), fbLimit(1)];
      if (user?.uid) clauses.unshift(where("userId", "==", user.uid));
      const q = query(base, ...clauses);
      const unsub = onSnapshot(q, (snap) => {
        if (!snap.empty) {
          const d = mapDoc(snap.docs[0]);
          // Evita duplicar o primeiro carregamento: notifica apenas quando já há itens
          if (items.length) {
            toast.info(`Novo registro arquivado: ${d.id}`);
          }
        }
      });
      return () => unsub();
    } catch {
      // silencioso
    }
  }, [user?.uid, items.length]);
  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return items
      .filter(r =>
        (status === "all" || r.status === status) &&
        (
          r.id.toLowerCase().includes(term) ||
          r.status.toLowerCase().includes(term) ||
          r.loja.includes(term) ||
          r.resumo.toLowerCase().includes(term)
        )
      )
      .filter(r => !storeFilter || r.loja.includes(storeFilter))
      .filter(r => !fsaFilter || r.id.includes(fsaFilter))
      .filter(r => {
        if (!dateStart && !dateEnd) return true;
        const d = r.data;
        return (!dateStart || d >= dateStart) && (!dateEnd || d <= dateEnd);
      })
      .sort((a, b) => (a.data < b.data ? 1 : -1));
  }, [items, search, status]);

  const handleCopy = async (repId: string) => {
    try {
      await navigator.clipboard.writeText(repId);
      toast.success("Código copiado para a área de transferência.");
    } catch {
      toast.error("Não foi possível copiar o código.");
    }
  };

  const statusBadge = (s: string) => {
    if (s === "Finalizada") return "bg-primary/15 text-primary border-primary/30";
    if (s === "Pendente") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    return "bg-blue-500/15 text-blue-400 border-blue-500/30";
  };

  return (
    <div className="space-y-5 pb-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Histórico de RATs</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Registros de atendimento arquivados</p>
      </div>

      {/* Filter panel */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar por código, loja ou resumo…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Status */}
          <Select value={status} onValueChange={(v) => setStatus(v as any)}>
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
          <div className="relative w-32">
            <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input placeholder="Loja" value={storeFilter} onChange={e => setStoreFilter(e.target.value)} className="pl-8" />
          </div>

          {/* FSA */}
          <div className="relative w-36">
            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input placeholder="FSA" value={fsaFilter} onChange={e => setFsaFilter(e.target.value)} className="pl-8" />
          </div>

          {/* Date range */}
          <div className="flex items-center gap-1.5">
            <CalendarRange className="w-4 h-4 text-muted-foreground shrink-0" />
            <Input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="w-36" />
            <span className="text-muted-foreground text-xs">–</span>
            <Input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="w-36" />
          </div>
        </div>

        {/* Action bar */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {filtered.length} registro(s)
            {Object.values(selectedIds).some(Boolean) && (
              <span className="ml-1 text-primary">· {Object.values(selectedIds).filter(Boolean).length} selecionado(s)</span>
            )}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs"
              onClick={() => {
                const view = { status, storeFilter, fsaFilter, dateStart, dateEnd };
                localStorage.setItem("reports_view", JSON.stringify(view));
                toast.success("Visão salva.");
              }}
            >
              <Save className="w-3.5 h-3.5" /> Salvar visão
            </Button>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs"
              onClick={() => {
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
              }}
            >
              <RotateCcw className="w-3.5 h-3.5" /> Aplicar visão
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs"
              onClick={() => {
                const rows = filtered.filter(r => selectedIds[r.id]);
                if (!rows.length) { toast.info("Selecione ao menos 1 item."); return; }
                const header = ["id","status","loja","data","responsavel","resumo"];
                const csv = [header.join(","), ...rows.map(r => header.map(h => JSON.stringify((r as any)[h] ?? "")).join(","))].join("\n");
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = `historico-${Date.now()}.csv`; a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="w-3.5 h-3.5" /> Exportar CSV
            </Button>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {loading && Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="p-4 space-y-3">
            <div className="flex justify-between">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-full" />
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-7 w-24 rounded-md" />
              <Skeleton className="h-7 w-28 rounded-md" />
            </div>
          </Card>
        ))}

        {!loading && filtered.length === 0 && (
          <div className="col-span-full flex flex-col items-center gap-3 py-16 text-muted-foreground">
            <FileText className="w-10 h-10" />
            <p className="text-sm">Nenhum registro encontrado.</p>
          </div>
        )}

        {!loading && filtered.map(rep => (
          <Card
            key={rep.id}
            className="group border border-border/60 hover:border-primary/40 hover:shadow-md transition-all duration-200 overflow-hidden"
          >
            <CardContent className="p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <input
                    type="checkbox"
                    checked={!!selectedIds[rep.id]}
                    onChange={(e) => setSelectedIds(prev => ({ ...prev, [rep.id]: e.target.checked }))}
                    className="accent-primary mt-0.5 shrink-0"
                  />
                  <div className="flex items-center gap-1.5 text-primary font-semibold text-sm truncate">
                    <FileText className="w-4 h-4 shrink-0" />
                    <span className="truncate">{rep.id}</span>
                  </div>
                </div>
                <Badge className={`text-[11px] border shrink-0 ${statusBadge(rep.status)}`}>
                  {rep.status}
                </Badge>
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Store className="w-3 h-3" /> {rep.loja}
                </span>
                <span>·</span>
                <span>{rep.data}</span>
              </div>

              {rep.resumo && (
                <p className="text-sm text-foreground/80 line-clamp-2">{rep.resumo}</p>
              )}

              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs flex-1"
                  onClick={() => setSelected(rep)}
                >
                  <Eye className="w-3.5 h-3.5" /> Visualizar
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

      {!loading && hasMore && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={() => fetchPage(lastDoc)} className="gap-2">
            Carregar mais registros
          </Button>
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" /> Detalhes da RAT
            </DialogTitle>
            <DialogDescription>{selected?.id}</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Status</p>
                  <Badge className={`text-xs border ${statusBadge(selected.status)}`}>{selected.status}</Badge>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Loja</p>
                  <p className="font-medium">{selected.loja}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Data</p>
                  <p>{selected.data}</p>
                </div>
                {selected.responsavel && (
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Responsável</p>
                    <p>{selected.responsavel}</p>
                  </div>
                )}
              </div>
              {selected.resumo && (
                <div className="rounded-lg bg-secondary/50 p-3 text-sm">{selected.resumo}</div>
              )}
              <div className="flex justify-end pt-1">
                <Button onClick={() => handleCopy(selected.id)} size="sm" variant="outline" className="gap-2">
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
