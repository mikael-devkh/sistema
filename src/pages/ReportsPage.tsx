import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import { Separator } from "../components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import {
  FileText, Clipboard, Eye, Download, Save, RotateCcw,
  Search, Store, Hash, CalendarRange, Filter, X,
  ClipboardList, Wrench, Package,
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
import { listChamados } from "../lib/chamado-firestore";
import type { Chamado, ChamadoStatus } from "../types/chamado";

// ─── Mock fallback ────────────────────────────────────────────────────────────
const mockReports = [
  { id: "RAT-2025-001", status: "Emitida",   loja: "1323", data: "2025-10-29", responsavel: "João", resumo: "Troca de SSD, update BIOS" },
  { id: "RAT-2025-002", status: "Pendente",  loja: "1327", data: "2025-10-28", responsavel: "Ana",  resumo: "Impressora Zebra — erro de etiqueta" },
  { id: "RAT-2025-003", status: "Finalizada",loja: "3131", data: "2025-10-27", responsavel: "João", resumo: "Fonte PDV substituída" },
];

type Report = typeof mockReports[number];
type StatusFilter = "all" | "Emitida" | "Pendente" | "Finalizada";
type ChamadoSignalFilter = 'todos' | 'com_peca' | 'com_reembolso' | 'estoque_pendente' | 'estoque_baixado';

const PAGE_SIZE = 12;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusBadge(s: string) {
  if (s === "Finalizada") return "bg-emerald-500/12 text-emerald-600 border-emerald-500/25 dark:text-emerald-400";
  if (s === "Pendente")   return "bg-amber-500/12  text-amber-600  border-amber-500/25  dark:text-amber-400";
  return                         "bg-blue-500/12   text-blue-600   border-blue-500/25   dark:text-blue-400";
}

const CHAMADO_STATUS_LABEL: Record<ChamadoStatus, string> = {
  rascunho: 'Rascunho',
  submetido: 'Ag. Validação Op.',
  validado_operador: 'Ag. Validação Fin.',
  rejeitado_operacional: 'Rej. Operacional',
  rejeitado_financeiro: 'Rej. Financeiro',
  rejeitado: 'Rejeitado',
  validado_financeiro: 'Aprovado',
  pagamento_pendente: 'Ag. Pagamento',
  pago: 'Pago',
  cancelado: 'Cancelado',
};

const CHAMADO_STATUS_BADGE: Record<ChamadoStatus, string> = {
  rascunho: 'bg-muted text-muted-foreground border-border',
  submetido: 'bg-blue-500/10 text-blue-700 border-blue-500/25 dark:text-blue-400',
  validado_operador: 'bg-purple-500/10 text-purple-700 border-purple-500/25 dark:text-purple-400',
  rejeitado_operacional: 'bg-red-500/10 text-red-700 border-red-500/25 dark:text-red-400',
  rejeitado_financeiro: 'bg-rose-500/10 text-rose-700 border-rose-500/25 dark:text-rose-400',
  rejeitado: 'bg-red-500/10 text-red-700 border-red-500/25 dark:text-red-400',
  validado_financeiro: 'bg-green-500/10 text-green-700 border-green-500/25 dark:text-green-400',
  pagamento_pendente: 'bg-amber-500/10 text-amber-700 border-amber-500/25 dark:text-amber-400',
  pago: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-400',
  cancelado: 'bg-slate-500/10 text-slate-600 border-slate-500/25 dark:text-slate-400',
};

const CHAMADO_REJECTION_STATUSES: ChamadoStatus[] = ['rejeitado', 'rejeitado_operacional', 'rejeitado_financeiro'];

// ─── Componente ───────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'rats' | 'chamados'>('rats');

  return (
    <div className="space-y-5 pb-8 animate-page-in">
      {/* ── Cabeçalho ── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-primary via-primary/70 to-primary/30" />
        <div className="flex items-center gap-4 px-6 py-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Relatórios</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Histórico consolidado de RATs e Chamados
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="rats" className="gap-1.5">
            <FileText className="w-3.5 h-3.5" /> RATs
          </TabsTrigger>
          <TabsTrigger value="chamados" className="gap-1.5">
            <ClipboardList className="w-3.5 h-3.5" /> Chamados
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rats" className="mt-4">
          <RatsTab userUid={user?.uid} />
        </TabsContent>

        <TabsContent value="chamados" className="mt-4">
          <ChamadosTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Tab de RATs ─────────────────────────────────────────────────────────────

function RatsTab({ userUid }: { userUid?: string }) {
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
      if (userUid) clauses.unshift(where("userId", "==", userUid));
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

  useEffect(() => { fetchPage(null); }, [userUid]);

  // Realtime: notifica novo registro arquivado
  useEffect(() => {
    try {
      const base = collection(db, "serviceReports");
      const clauses: any[] = [orderBy("archivedAt", "desc"), fbLimit(1)];
      if (userUid) clauses.unshift(where("userId", "==", userUid));
      const unsub = onSnapshot(query(base, ...clauses), snap => {
        if (!snap.empty && items.length) {
          toast.info(`Novo registro arquivado: ${mapDoc(snap.docs[0]).id}`);
        }
      });
      return () => unsub();
    } catch {}
  }, [userUid, items.length]);

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
    a.download = `historico-rats-${Date.now()}.csv`;
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

  return (
    <div className="space-y-5">
      {/* ── Painel de filtros ── */}
      <div className="rounded-xl border border-border bg-card shadow-card p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar por código, loja ou resumo…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

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

          <div className="relative w-28">
            <Store className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Loja"
              value={storeFilter}
              onChange={e => setStoreFilter(e.target.value)}
              className="pl-8"
            />
          </div>

          <div className="relative w-32">
            <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="FSA"
              value={fsaFilter}
              onChange={e => setFsaFilter(e.target.value)}
              className="pl-8"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <CalendarRange className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <Input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="w-36 text-sm" />
            <span className="text-xs text-muted-foreground">–</span>
            <Input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="w-36 text-sm" />
          </div>
        </div>

        <Separator />

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
              <button onClick={clearFilters} className="flex items-center gap-1 text-primary hover:text-primary/80 font-medium transition-colors">
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
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleExportCsv} disabled={selectedCount === 0}>
              <Download className="w-3.5 h-3.5" /> Exportar CSV
            </Button>
          </div>
        </div>
      </div>

      {/* ── Grid de cards ── */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {loading && Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="p-4 space-y-3 shadow-card">
            <div className="flex justify-between items-start">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-full" />
          </Card>
        ))}

        {!loading && filtered.length === 0 && (
          <div className="col-span-full flex flex-col items-center gap-4 py-16 text-center text-muted-foreground">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="font-medium">Nenhum registro encontrado</p>
              <p className="text-sm mt-0.5">
                {activeFilters ? "Tente ajustar ou limpar os filtros." : "Os atendimentos arquivados aparecerão aqui."}
              </p>
            </div>
            {activeFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters} className="gap-2">
                <X className="w-3.5 h-3.5" /> Limpar filtros
              </Button>
            )}
          </div>
        )}

        {!loading && filtered.map(rep => (
          <Card
            key={rep.id}
            className={cn(
              "shadow-card group hover:shadow-card-md hover:border-primary/30 transition-all duration-150 overflow-hidden",
              selectedIds[rep.id] && "border-primary/40 bg-primary/[0.02]",
            )}
          >
            <CardContent className="p-4 flex flex-col gap-2.5">
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

              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <Store className="w-3 h-3" /> Loja {rep.loja}
                </span>
                <span className="text-border">·</span>
                <span>{rep.data}</span>
              </div>

              {rep.resumo && (
                <p className="text-xs text-foreground/75 line-clamp-2 leading-relaxed">{rep.resumo}</p>
              )}

              <div className="flex gap-2 pt-0.5">
                <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs flex-1" onClick={() => setSelected(rep)}>
                  <Eye className="w-3.5 h-3.5" /> Ver
                </Button>
                <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs flex-1" onClick={() => handleCopy(rep.id)}>
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

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" /> Detalhes da RAT
            </DialogTitle>
            <DialogDescription>{selected?.id}</DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-0.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Status</p>
                  <Badge className={cn("text-xs border", statusBadge(selected.status))}>{selected.status}</Badge>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Loja</p>
                  <p className="font-semibold">{selected.loja}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Data</p>
                  <p>{selected.data}</p>
                </div>
              </div>

              {selected.resumo && (
                <div className="rounded-lg bg-secondary/50 border border-border/60 p-3 text-sm">{selected.resumo}</div>
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

// ─── Tab de Chamados ─────────────────────────────────────────────────────────

function ChamadosTab() {
  const [loading, setLoading] = useState(true);
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [selected, setSelected] = useState<Chamado | null>(null);

  // Filtros
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | ChamadoStatus>('todos');
  const [signalFilter, setSignalFilter] = useState<ChamadoSignalFilter>('todos');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await listChamados({ limitCount: 500 });
        setChamados(data);
      } catch {
        toast.error('Erro ao carregar chamados.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return chamados.filter(c => {
      if (statusFilter !== 'todos' && c.status !== statusFilter) return false;
      if (signalFilter === 'com_peca' && !(c.pecaUsada || c.estoqueItemId)) return false;
      if (signalFilter === 'com_reembolso' && !(c.fornecedorPeca === 'Tecnico' && (c.custoPeca ?? 0) > 0)) return false;
      if (signalFilter === 'estoque_pendente' && !(c.estoqueItemId && !c.estoqueBaixadoEm)) return false;
      if (signalFilter === 'estoque_baixado' && !c.estoqueBaixadoEm) return false;
      if (dateStart && c.dataAtendimento < dateStart) return false;
      if (dateEnd && c.dataAtendimento > dateEnd) return false;
      if (q) {
        const hay = `${c.fsa} ${c.codigoLoja} ${c.tecnicoNome} ${c.tecnicoCodigo ?? ''} ${c.catalogoServicoNome ?? ''} ${c.pecaUsada ?? ''} ${c.estoqueItemNome ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [chamados, search, statusFilter, signalFilter, dateStart, dateEnd]);

  const stats = useMemo(() => ({
    total: filtered.length,
    aprovados: filtered.filter(c => c.status === 'validado_financeiro' || c.status === 'pago').length,
    emValidacao: filtered.filter(c => c.status === 'submetido' || c.status === 'validado_operador').length,
    rejeitados: filtered.filter(c => CHAMADO_REJECTION_STATUSES.includes(c.status)).length,
    valorPecas: filtered.reduce((sum, c) => sum + (c.custoPeca ?? 0), 0),
    valorReembolso: filtered.reduce((sum, c) => sum + (c.fornecedorPeca === 'Tecnico' ? (c.custoPeca ?? 0) : 0), 0),
    estoquePendente: filtered.filter(c => c.estoqueItemId && !c.estoqueBaixadoEm).length,
    minutosTotais: filtered.reduce((sum, c) => sum + (c.durationMinutes ?? 0), 0),
  }), [filtered]);

  const activeFilters = search || statusFilter !== 'todos' || signalFilter !== 'todos' || dateStart || dateEnd;

  const clearFilters = () => {
    setSearch(''); setStatusFilter('todos'); setSignalFilter('todos'); setDateStart(''); setDateEnd('');
  };

  const handleExportCsv = () => {
    if (!filtered.length) { toast.info('Nenhum chamado para exportar.'); return; }
    const header = [
      'fsa', 'codigoLoja', 'data', 'tecnicoCodigo', 'tecnicoNome',
      'tecnicoPaiCodigo', 'servico', 'peca', 'custoPeca', 'fornecedorPeca',
      'estoqueItem', 'estoqueQtd', 'estoqueBaixadoEm', 'duracaoMin', 'status',
    ];
    const rows = filtered.map(c => [
      c.fsa, c.codigoLoja, c.dataAtendimento, c.tecnicoCodigo ?? '', c.tecnicoNome,
      c.tecnicoPaiCodigo ?? '', c.catalogoServicoNome ?? '', c.pecaUsada ?? c.estoqueItemNome ?? '',
      c.custoPeca ?? '', c.fornecedorPeca ?? '', c.estoqueItemNome ?? '', c.estoqueQuantidade ?? '',
      c.estoqueBaixadoEm ? new Date(c.estoqueBaixadoEm).toLocaleString('pt-BR') : '',
      c.durationMinutes ?? '', CHAMADO_STATUS_LABEL[c.status],
    ]);
    const csv = [
      header.join(','),
      ...rows.map(r => r.map(cell => JSON.stringify(String(cell ?? ''))).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `relatorio-chamados-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total de chamados" value={stats.total} color="default" />
        <KpiCard label="Aprovados / Pagos" value={stats.aprovados} color="green" />
        <KpiCard label="Em validação" value={stats.emValidacao} color="blue" />
        <KpiCard label="Rejeitados" value={stats.rejeitados} color="red" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Total em peças</p>
          <p className="text-2xl font-bold">R$ {stats.valorPecas.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Reembolsos</p>
          <p className="text-2xl font-bold">R$ {stats.valorReembolso.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Estoque sem baixa</p>
          <p className={cn('text-2xl font-bold', stats.estoquePendente > 0 && 'text-amber-600 dark:text-amber-400')}>
            {stats.estoquePendente}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Minutos acumulados</p>
          <p className="text-2xl font-bold">{stats.minutosTotais} min</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar FSA, loja, técnico, código…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          <Select value={statusFilter} onValueChange={v => setStatusFilter(v as any)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="rascunho">Rascunho</SelectItem>
              <SelectItem value="submetido">Ag. Validação Op.</SelectItem>
              <SelectItem value="validado_operador">Ag. Validação Fin.</SelectItem>
              <SelectItem value="rejeitado">Rejeitado</SelectItem>
              <SelectItem value="rejeitado_operacional">Rej. Operacional</SelectItem>
              <SelectItem value="rejeitado_financeiro">Rej. Financeiro</SelectItem>
              <SelectItem value="validado_financeiro">Aprovado</SelectItem>
              <SelectItem value="pagamento_pendente">Ag. Pagamento</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>

          <Select value={signalFilter} onValueChange={v => setSignalFilter(v as ChamadoSignalFilter)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os sinais</SelectItem>
              <SelectItem value="com_peca">Com peça/spare</SelectItem>
              <SelectItem value="com_reembolso">Com reembolso</SelectItem>
              <SelectItem value="estoque_pendente">Estoque sem baixa</SelectItem>
              <SelectItem value="estoque_baixado">Estoque baixado</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1.5 flex-wrap">
            <CalendarRange className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <Input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="w-36 text-sm" />
            <span className="text-xs text-muted-foreground">–</span>
            <Input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="w-36 text-sm" />
          </div>
        </div>

        <Separator />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Filter className="w-3.5 h-3.5" />
            <span><span className="font-semibold text-foreground">{filtered.length}</span> chamado(s)</span>
            {activeFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-primary hover:text-primary/80 font-medium transition-colors">
                <X className="w-3 h-3" /> Limpar
              </button>
            )}
          </div>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleExportCsv} disabled={!filtered.length}>
            <Download className="w-3.5 h-3.5" /> Exportar CSV
          </Button>
        </div>
      </div>

      {/* Lista */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {loading && Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="p-4 space-y-3"><Skeleton className="h-5 w-32" /><Skeleton className="h-4 w-40" /></Card>
        ))}

        {!loading && filtered.length === 0 && (
          <div className="col-span-full flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
            <ClipboardList className="w-10 h-10 opacity-30" />
            <p className="text-sm">Nenhum chamado encontrado</p>
            {activeFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters}>Limpar filtros</Button>
            )}
          </div>
        )}

        {!loading && filtered.map(c => (
          <Card key={c.id} className="shadow-card hover:border-primary/30 transition-colors cursor-pointer" onClick={() => setSelected(c)}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-sm">FSA #{c.fsa}</p>
                  <p className="text-xs text-muted-foreground">Loja {c.codigoLoja} · {new Date(c.dataAtendimento + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                </div>
                <Badge className={cn('text-[10px] border shrink-0', CHAMADO_STATUS_BADGE[c.status])}>
                  {CHAMADO_STATUS_LABEL[c.status]}
                </Badge>
              </div>
              <div className="text-xs flex flex-wrap gap-x-2 gap-y-0.5">
                <span className="font-medium">
                  {c.tecnicoCodigo && <span className="font-mono text-primary">{c.tecnicoCodigo} — </span>}
                  {c.tecnicoNome}
                </span>
                {c.tecnicoPaiCodigo && (
                  <span className="text-amber-600 dark:text-amber-400 text-[11px]">
                    ↳ sub de <span className="font-mono">{c.tecnicoPaiCodigo}</span>
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {c.catalogoServicoNome && (
                  <Badge variant="outline" className="text-[10px]">
                    <Wrench className="w-2.5 h-2.5 mr-1" />{c.catalogoServicoNome}
                  </Badge>
                )}
                {(c.pecaUsada || c.estoqueItemId) && (
                  <Badge variant="secondary" className="text-[10px]">
                    <Package className="w-2.5 h-2.5 mr-1" />{c.pecaUsada ?? c.estoqueItemNome ?? 'Peça'}
                  </Badge>
                )}
                {c.fornecedorPeca === 'Tecnico' && (c.custoPeca ?? 0) > 0 && (
                  <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 dark:text-amber-400">
                    Reembolso R$ {c.custoPeca?.toFixed(2)}
                  </Badge>
                )}
                {c.estoqueItemId && (
                  <Badge variant="outline" className={cn(
                    'text-[10px]',
                    c.estoqueBaixadoEm
                      ? 'border-green-300 text-green-700 dark:text-green-400'
                      : 'border-red-300 text-red-600 dark:text-red-400',
                  )}>
                    {c.estoqueBaixadoEm ? 'Estoque baixado' : 'Estoque sem baixa'}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detalhe */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-primary" /> FSA #{selected?.fsa}
            </DialogTitle>
            <DialogDescription>
              Loja {selected?.codigoLoja} · {selected && new Date(selected.dataAtendimento + 'T12:00:00').toLocaleDateString('pt-BR')}
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground font-semibold">Status</p>
                  <Badge className={cn('text-xs border mt-1', CHAMADO_STATUS_BADGE[selected.status])}>
                    {CHAMADO_STATUS_LABEL[selected.status]}
                  </Badge>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground font-semibold">Técnico</p>
                  <p className="font-medium mt-1">
                    {selected.tecnicoCodigo && <span className="font-mono text-primary mr-1">{selected.tecnicoCodigo}</span>}
                    {selected.tecnicoCodigo ? '— ' : ''}{selected.tecnicoNome}
                  </p>
                  {selected.tecnicoPaiCodigo && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400">
                      Sub de <span className="font-mono">{selected.tecnicoPaiCodigo}</span>
                    </p>
                  )}
                </div>
                {selected.catalogoServicoNome && (
                  <div className="col-span-2">
                    <p className="text-[10px] uppercase text-muted-foreground font-semibold">Serviço</p>
                    <p className="font-medium mt-1">{selected.catalogoServicoNome}</p>
                  </div>
                )}
                {(selected.pecaUsada || selected.estoqueItemId) && (
                  <div className="col-span-2">
                    <p className="text-[10px] uppercase text-muted-foreground font-semibold">Peça</p>
                    <p className="font-medium mt-1">
                      {selected.pecaUsada ?? selected.estoqueItemNome ?? 'Peça vinculada'}
                      {selected.custoPeca ? ` · R$ ${selected.custoPeca.toFixed(2)}` : ''}
                      {selected.fornecedorPeca === 'Tecnico' ? ' · reembolso' : ''}
                    </p>
                    {selected.estoqueItemId && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Estoque: {selected.estoqueItemNome ?? selected.pecaUsada}
                        {selected.estoqueQuantidade ? ` · qtd. ${selected.estoqueQuantidade}` : ''}
                        {selected.estoqueBaixadoEm
                          ? ` · baixado em ${new Date(selected.estoqueBaixadoEm).toLocaleString('pt-BR')}`
                          : ' · saída pendente'}
                      </p>
                    )}
                  </div>
                )}
                {selected.durationMinutes != null && (
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground font-semibold">Duração</p>
                    <p className="font-medium mt-1">{selected.durationMinutes} min</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── KpiCard ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, color }: { label: string; value: number | string; color: 'default' | 'blue' | 'green' | 'red' }) {
  const colors = {
    default: 'text-foreground border-border',
    blue: 'text-blue-600 dark:text-blue-400 border-blue-500/20',
    green: 'text-green-600 dark:text-green-400 border-green-500/20',
    red: 'text-red-600 dark:text-red-400 border-red-500/20',
  };
  return (
    <div className={cn('p-4 rounded-xl border-2 bg-background shadow-sm', colors[color])}>
      <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
      <p className={cn('text-2xl font-bold', colors[color])}>{value}</p>
    </div>
  );
}
