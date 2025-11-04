import { useAuth } from "../context/AuthContext";
import { Card } from "../components/ui/card";
import { FileText, Layers, User, PlusCircle, Settings, Network, BookText, LayoutTemplate, PhoneCall, TrendingUp, Clock } from "lucide-react";
import { Skeleton } from "../components/ui/skeleton";
import { db } from "../firebase";
import { collection, getDocs, limit as fbLimit, orderBy, query, Timestamp, where } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { useServiceManager } from "../hooks/use-service-manager";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default function Dashboard() {
  const { profile, loadingAuth, loadingProfile, user } = useAuth();
  const nomeDisplay = profile?.nome?.split(" ")[0] || "Usuário";
  const avatarUrl = profile?.avatarUrl;
  const initials = (profile?.nome || "U").split(" ").map(n => n[0]?.toUpperCase()).slice(0,2).join("") || "U";
  const [loadingData, setLoadingData] = useState(true);
  const [thisMonthCount, setThisMonthCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [recent, setRecent] = useState<Array<{ id: string; loja: string; data: string; status: string }>>([]);
  const { activeCalls, storeTimers, getStoreTotalMinutes } = useServiceManager();

  const totalServiceMinutes = useMemo(() => {
    try {
      return Object.keys(storeTimers).reduce((acc, store) => acc + getStoreTotalMinutes(store), 0);
    } catch {
      return 0;
    }
  }, [storeTimers, getStoreTotalMinutes]);

  const formatMinutes = (m: number) => {
    const h = Math.floor(m / 60);
    const r = m % 60;
    if (h && r) return `${h}h ${r}min`;
    if (h) return `${h}h`;
    return `${r}min`;
  };

  useEffect(() => {
    const CACHE_KEY = "dashboard_metrics_cache_v1";
    const TTL_MS = 10 * 60 * 1000; // 10 minutos
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw) as { month: number; recent: Array<{ id: string; loja: string; data: string; status: string }>, ts: number };
        if (cached && typeof cached.month === "number") {
          setThisMonthCount(cached.month);
          setRecent(cached.recent || []);
          if (cached.ts && Date.now() - cached.ts < TTL_MS) {
            setLoadingData(false);
          }
        }
      }
    } catch {}

    (async () => {
      try {
        const reportsCol = collection(db, "serviceReports");
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const startTs = Timestamp.fromDate(monthStart);

        const clauses: any[] = [where("archivedAt", ">=", startTs)];
        if (user?.uid) clauses.unshift(where("userId", "==", user.uid));
        const qMonth = query(reportsCol, ...clauses);

        const clausesRecent: any[] = [orderBy("archivedAt", "desc"), fbLimit(5)];
        if (user?.uid) clausesRecent.unshift(where("userId", "==", user.uid));
        const qRecent = query(reportsCol, ...clausesRecent);

        const [snapMonth, snapRecent] = await Promise.all([getDocs(qMonth), getDocs(qRecent)]);
        const monthCount = snapMonth.size;
        const recentMapped = snapRecent.docs.map((d) => {
          const data: any = d.data();
          const date = data.archivedAt?.toDate?.() as Date | undefined;
          return {
            id: data.fsa ? `RAT-${data.fsa}` : d.id,
            loja: String(data.codigoLoja || ""),
            data: date ? date.toLocaleDateString("pt-BR") : "",
            status: data.status === "archived" ? "Finalizada" : (data.status || ""),
          };
        });

        setThisMonthCount(monthCount);
        setRecent(recentMapped);
        setLoadingData(false);

        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ month: monthCount, recent: recentMapped, ts: Date.now() }));
        } catch {}
      } catch (e) {
        // mantém cache se houver
      }
    })();
  }, [user?.uid]);

  useEffect(() => {
    // pendentes reais provenientes do ServiceManager (status !== archived)
    try {
      const open = activeCalls.filter(c => c.status === "open").length;
      setPendingCount(open);
    } catch {
      setPendingCount(0);
    }
  }, [activeCalls]);

  return (
    <div className="space-y-8">
      <Card className="w-full bg-gradient-to-br from-primary/10 to-secondary/30 rounded-xl shadow-lg p-6 mb-8">
        <div className="flex items-center gap-4 mb-4">
          {loadingAuth || loadingProfile ? (
            <Skeleton className="h-12 w-12 rounded-full" />
          ) : avatarUrl ? (
            <img src={avatarUrl} alt="avatar" className="rounded-full h-12 w-12 object-cover border border-primary/30 shadow" />
          ) : (
            <div className="rounded-full h-12 w-12 bg-primary/20 font-bold flex items-center justify-center text-lg border border-primary/20 shadow">{initials}</div>
          )}
          <div>
            {loadingAuth || loadingProfile ? (
              <>
                <Skeleton className="h-5 w-52 mb-1" />
                <Skeleton className="h-4 w-72" />
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold mb-0.5">{getGreeting()}, {nomeDisplay}!</h2>
                <p className="text-slate-500 mb-0.5">Veja rapidamente o status dos principais atendimentos:</p>
              </>
            )}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          {(loadingAuth || loadingProfile) ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-8 w-8 rounded-md mb-2" />
                <Skeleton className="h-5 w-40 mb-1" />
                <Skeleton className="h-4 w-24" />
              </Card>
            ))
          ) : (
            <>
              <Card className="p-4 flex flex-col items-center gap-2 hover:shadow-xl transition">
                <FileText size={32} className="text-primary" />
                <span className="font-bold text-lg">{thisMonthCount} RATs Emitidas</span>
                <small className="text-muted-foreground">Este mês</small>
              </Card>
              <a href="/service-manager" className="p-4 flex flex-col items-center gap-2 hover:shadow-xl transition rounded-md border bg-card">
                <Layers size={32} className="text-green-500" />
                <span className="font-bold text-lg">{pendingCount} Pendentes</span>
                <small className="text-muted-foreground">Tempo em atendimento: {formatMinutes(totalServiceMinutes)}</small>
                <span className="text-xs text-primary underline">Ir para Chamados</span>
              </a>
              <Card className="p-4 flex flex-col items-center gap-2 hover:shadow-xl transition">
                <User size={32} className="text-sky-500" />
                <span className="font-bold text-lg">Seu Perfil</span>
                <small className="text-muted-foreground">Gerencie dados e segurança</small>
              </Card>
              <Card className="p-4 flex flex-col items-center gap-2 hover:shadow-xl transition">
                <Settings size={32} className="text-zinc-500" />
                <span className="font-bold text-lg">Configurações</span>
                <small className="text-muted-foreground">Preferências e acesso</small>
              </Card>
            </>
          )}
        </div>
        {loadingAuth || loadingProfile ? (
          <div className="flex gap-3 mt-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-40 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-3 mt-8">
            <a href="/rat" className="bg-primary text-white font-semibold px-6 py-3 rounded-lg flex items-center gap-2 shadow transition hover:bg-primary/80">
              <PlusCircle className="w-5 h-5" /> Nova RAT
            </a>
            <a href="/reports" className="bg-secondary font-semibold px-6 py-3 rounded-lg flex items-center gap-2 border border-primary/10 shadow hover:bg-primary/10 transition">
              <Layers className="w-5 h-5" /> Histórico
            </a>
            <a href="/gerador-ip" className="bg-secondary font-semibold px-6 py-3 rounded-lg flex items-center gap-2 border border-primary/10 shadow hover:bg-primary/10 transition">
              <Network className="w-5 h-5" /> Gerador de IP
            </a>
            <a href="/base-conhecimento" className="bg-secondary font-semibold px-6 py-3 rounded-lg flex items-center gap-2 border border-primary/10 shadow hover:bg-primary/10 transition">
              <BookText className="w-5 h-5" /> Base de Conhecimento
            </a>
            <a href="/templates-rat" className="bg-secondary font-semibold px-6 py-3 rounded-lg flex items-center gap-2 border border-primary/10 shadow hover:bg-primary/10 transition">
              <LayoutTemplate className="w-5 h-5" /> Templates RAT
            </a>
            <a href="/service-manager" className="bg-secondary font-semibold px-6 py-3 rounded-lg flex items-center gap-2 border border-primary/10 shadow hover:bg-primary/10 transition">
              <PhoneCall className="w-5 h-5" /> Chamados
            </a>
          </div>
        )}
      </Card>
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-5 bg-background/80">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" /> Últimas RATs</h3>
            <a href="/reports" className="text-xs text-primary hover:underline">Ver tudo</a>
          </div>
          {loadingData ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (<Skeleton key={i} className="h-10 w-full" />))}
            </div>
          ) : recent.length ? (
            <ul className="divide-y divide-border/60">
              {recent.map(r => (
                <li key={r.id} className="py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="font-medium">{r.id}</span>
                    <span className="text-xs text-muted-foreground">Loja {r.loja}</span>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5" /> {r.data}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-muted-foreground">Nenhuma RAT recente.</div>
          )}
        </Card>
        <Card className="p-5 bg-background/80">
          <h3 className="font-semibold mb-3">Ações rápidas</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <a href="/rat" className="rounded-md border bg-card hover:bg-primary/10 transition p-3 flex items-center gap-2">
              <PlusCircle className="h-5 w-5 text-primary" /> Nova RAT
            </a>
            <a href="/reports" className="rounded-md border bg-card hover:bg-primary/10 transition p-3 flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" /> Histórico
            </a>
            <a href="/templates-rat" className="rounded-md border bg-card hover:bg-primary/10 transition p-3 flex items-center gap-2">
              <LayoutTemplate className="h-5 w-5 text-primary" /> Templates de RAT
            </a>
            <a href="/base-conhecimento" className="rounded-md border bg-card hover:bg-primary/10 transition p-3 flex items-center gap-2">
              <BookText className="h-5 w-5 text-primary" /> Base de Conhecimento
            </a>
          </div>
        </Card>
      </div>
    </div>
  );
}
