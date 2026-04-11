import { useEffect, useMemo, useState } from "react";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { FileText, Clipboard, Eye } from "lucide-react";
import { Skeleton } from "../components/ui/skeleton";
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

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end gap-4 mb-2">
        <div className="flex-1">
          <label className="mb-1 block font-semibold">Busca Rápida</label>
          <Input
            type="text"
            placeholder="Buscar por código, loja, status ou resumo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="max-w-full"
          />
        </div>
        <div className="min-w-[180px]">
          <label className="mb-1 block font-semibold">Status</label>
          <Select value={status} onValueChange={(v) => setStatus(v as any)}>
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="Emitida">Emitida</SelectItem>
              <SelectItem value="Pendente">Pendente</SelectItem>
              <SelectItem value="Finalizada">Finalizada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[140px]">
          <label className="mb-1 block font-semibold">Loja</label>
          <Input placeholder="Ex: 1323" value={storeFilter} onChange={e => setStoreFilter(e.target.value)} />
        </div>
        <div className="min-w-[140px]">
          <label className="mb-1 block font-semibold">FSA</label>
          <Input placeholder="Ex: 2025-001" value={fsaFilter} onChange={e => setFsaFilter(e.target.value)} />
        </div>
        <div className="min-w-[210px] flex gap-2">
          <div>
            <label className="mb-1 block font-semibold">De</label>
            <Input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block font-semibold">Até</label>
            <Input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} />
          </div>
        </div>
      </div>
      <div className="flex justify-between items-center mb-2">
        <div className="text-xs text-muted-foreground">{filtered.length} registro(s)</div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const view = { status, storeFilter, fsaFilter, dateStart, dateEnd };
              localStorage.setItem("reports_view", JSON.stringify(view));
              toast.success("Visão salva.");
            }}
          >Salvar visão</Button>
          <Button
            variant="secondary"
            size="sm"
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
          >Aplicar visão</Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const rows = filtered.filter(r => selectedIds[r.id]).map(r => r);
              if (!rows.length) { toast.info("Selecione ao menos 1 item."); return; }
              const header = ["id","status","loja","data","responsavel","resumo"];
              const csv = [header.join(","), ...rows.map(r => header.map(h => JSON.stringify((r as any)[h] ?? "")).join(","))].join("\n");
              const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url; a.download = `historico-${Date.now()}.csv`; a.click();
              URL.revokeObjectURL(url);
            }}
          >Exportar CSV</Button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading && (
          <>
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="p-4">
                <div className="flex justify-between mb-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-16" />
                </div>
                <Skeleton className="h-4 w-40 mb-2" />
                <Skeleton className="h-4 w-full mb-4" />
                <div className="flex gap-3">
                  <Skeleton className="h-7 w-24" />
                  <Skeleton className="h-7 w-28" />
                </div>
              </Card>
            ))}
          </>
        )}
        {!loading && filtered.length === 0 && <div className="text-center text-muted-foreground col-span-full">Nenhum registro encontrado.</div>}
        {!loading && filtered.map(rep => (
          <Card key={rep.id} className="p-4 flex flex-col gap-2 hover:shadow-lg transition group border-primary/20 border">
            <div className="flex items-center gap-2 justify-between">
              <div className="flex items-center gap-2 text-primary font-semibold">
                <input type="checkbox" checked={!!selectedIds[rep.id]} onChange={(e) => setSelectedIds(prev => ({ ...prev, [rep.id]: e.target.checked }))} />
                <FileText className="w-5 h-5" /> {rep.id}
              </div>
              <span className={`text-xs px-2 py-1 rounded font-semibold ${rep.status === "Finalizada" ? "bg-green-200 text-green-700" : rep.status === "Pendente" ? "bg-yellow-200 text-yellow-800" : "bg-primary/10 text-primary"}`}>{rep.status}</span>
            </div>
            <div className="text-xs text-muted-foreground mb-1">Loja: <span className="font-semibold">{rep.loja}</span> · {rep.data}</div>
            <div className="text-sm font-medium mb-1">{rep.resumo}</div>
            <div className="flex gap-3 mt-2">
              <button className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-secondary border hover:bg-primary/10 transition" onClick={() => setSelected(rep)}>
                <Eye className="w-4 h-4" /> Visualizar
              </button>
              <button className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-secondary border hover:bg-primary/10 transition" onClick={() => handleCopy(rep.id)}>
                <Clipboard className="w-4 h-4" /> Copiar código
              </button>
            </div>
          </Card>
        ))}
      </div>
      {!loading && hasMore && (
        <div className="flex justify-center pt-4">
          <Button variant="outline" onClick={() => fetchPage(lastDoc)}>
            Carregar mais
          </Button>
        </div>
      )}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhes da RAT</DialogTitle>
            <DialogDescription className="text-sm">{selected?.id}</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-2 text-sm">
              <div><span className="text-muted-foreground">Status:</span> {selected.status}</div>
              <div><span className="text-muted-foreground">Loja:</span> {selected.loja}</div>
              <div><span className="text-muted-foreground">Data:</span> {selected.data}</div>
              <div><span className="text-muted-foreground">Responsável:</span> {selected.responsavel}</div>
              <div className="mt-2">{selected.resumo}</div>
              <div className="pt-3 flex justify-end">
                <Button onClick={() => { handleCopy(selected.id); }} size="sm" variant="outline" className="gap-2"><Clipboard className="w-4 h-4" /> Copiar código</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
