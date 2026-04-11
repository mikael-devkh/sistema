import { useAuth } from "../context/AuthContext";
import { usePermissions } from "../hooks/use-permissions";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
  FileText, Layers, User, PlusCircle, Settings, Network,
  BookText, LayoutTemplate, PhoneCall, Clock, Users,
  CalendarClock, TrendingUp, Wrench,
} from "lucide-react";
import { Skeleton } from "../components/ui/skeleton";
import { Badge } from "../components/ui/badge";
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

function formatMinutes(m: number) {
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h && r) return `${h}h ${r}min`;
  if (h) return `${h}h`;
  return `${r}min`;
}

const quickActions = [
  { href: "/rat",              icon: PlusCircle,     label: "Nova RAT",           color: "text-primary" },
  { href: "/service-manager", icon: PhoneCall,       label: "Chamados",           color: "text-blue-400" },
  { href: "/agendamento",     icon: CalendarClock,   label: "Agendamentos",       color: "text-purple-400" },
  { href: "/reports",         icon: TrendingUp,      label: "Histórico",          color: "text-amber-400" },
  { href: "/gerador-ip",      icon: Network,         label: "Gerador de IP",      color: "text-cyan-400" },
  { href: "/base-conhecimento", icon: BookText,       label: "Base de Conhecimento", color: "text-rose-400" },
  { href: "/templates-rat",   icon: LayoutTemplate,  label: "Templates RAT",      color: "text-indigo-400" },
  { href: "/perfil",          icon: User,            label: "Perfil",             color: "text-muted-foreground" },
];

export default function Dashboard() {
  const { profile, loadingAuth, loadingProfile, user } = useAuth();
  const { permissions } = usePermissions();

  const nomeDisplay = profile?.nome?.split(" ")[0] || "Usuário";
  const avatarUrl = profile?.avatarUrl;
  const initials = (profile?.nome || "U").split(" ").map(n => n[0]?.toUpperCase()).slice(0, 2).join("") || "U";

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

  useEffect(() => {
    const CACHE_KEY = "dashboard_metrics_cache_v1";
    const TTL_MS = 10 * 60 * 1000;
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw) as { month: number; recent: typeof recent; ts: number };
        if (cached && typeof cached.month === "number" && Date.now() - cached.ts < TTL_MS) {
          setThisMonthCount(cached.month);
          setRecent(cached.recent || []);
          setLoadingData(false);
        }
      }
    } catch {}
    (async () => {
      try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const base = collection(db, "serviceReports");
        const clauses: any[] = [
          orderBy("archivedAt", "desc"),
          fbLimit(5),
        ];
        if (user?.uid) clauses.unshift(where("userId", "==", user.uid));
        const recentSnap = await getDocs(query(base, ...clauses));
        const recentMapped = recentSnap.docs.map(d => {
          const data = d.data();
          const archivedAt = data.archivedAt?.toDate?.() as Date | undefined;
          return {
            id: data.fsa ? `RAT-${data.fsa}` : d.id,
            loja: String(data.codigoLoja || ""),
            data: archivedAt ? archivedAt.toISOString().slice(0, 10) : "—",
            status: data.status || "Emitida",
          };
        });

        const monthClauses: any[] = [
          where("archivedAt", ">=", Timestamp.fromDate(startOfMonth)),
          fbLimit(200),
        ];
        if (user?.uid) monthClauses.unshift(where("userId", "==", user.uid));
        const monthSnap = await getDocs(query(base, ...monthClauses));
        const monthCount = monthSnap.size;

        setThisMonthCount(monthCount);
        setRecent(recentMapped);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ month: monthCount, recent: recentMapped, ts: Date.now() }));
        } catch {}
      } catch {
        // mantém cache
      } finally {
        setLoadingData(false);
      }
    })();
  }, [user?.uid]);

  useEffect(() => {
    try {
      setPendingCount(activeCalls.filter(c => c.status === "open").length);
    } catch {
      setPendingCount(0);
    }
  }, [activeCalls]);

  const isLoading = loadingAuth || loadingProfile;

  const stats = [
    {
      label: "RATs este mês",
      value: loadingData ? "—" : String(thisMonthCount),
      icon: FileText,
      gradient: "from-primary/20 to-primary/5",
      border: "border-primary/30",
      valueColor: "text-primary",
      iconColor: "text-primary",
    },
    {
      label: "Chamados abertos",
      value: String(pendingCount),
      icon: PhoneCall,
      gradient: "from-blue-500/20 to-blue-600/5",
      border: "border-blue-500/30",
      valueColor: "text-blue-300",
      iconColor: "text-blue-400",
      href: "/service-manager",
    },
    {
      label: "Tempo em campo",
      value: totalServiceMinutes ? formatMinutes(totalServiceMinutes) : "—",
      icon: Clock,
      gradient: "from-amber-500/20 to-amber-600/5",
      border: "border-amber-500/30",
      valueColor: "text-amber-300",
      iconColor: "text-amber-400",
    },
    {
      label: "Perfil",
      value: profile?.role ? (profile.role === "admin" ? "Admin" : "Técnico") : "—",
      icon: User,
      gradient: "from-purple-500/20 to-purple-600/5",
      border: "border-purple-500/30",
      valueColor: "text-purple-300",
      iconColor: "text-purple-400",
      href: "/perfil",
    },
  ];

  return (
    <div className="space-y-5 pb-6">
      {/* ── Hero card ── */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-6 shadow-lg">
        {/* Greeting */}
        <div className="flex items-center gap-4 mb-6">
          {isLoading ? (
            <Skeleton className="h-12 w-12 rounded-full shrink-0" />
          ) : avatarUrl ? (
            <img src={avatarUrl} alt="avatar" className="rounded-full h-12 w-12 object-cover border-2 border-primary/30 shadow shrink-0" />
          ) : (
            <div className="rounded-full h-12 w-12 bg-primary/20 font-bold flex items-center justify-center text-lg border-2 border-primary/20 shadow shrink-0 text-primary">
              {initials}
            </div>
          )}
          <div>
            {isLoading ? (
              <>
                <Skeleton className="h-6 w-48 mb-1" />
                <Skeleton className="h-4 w-64" />
              </>
            ) : (
              <>
                <h1 className="text-xl font-bold">{getGreeting()}, {nomeDisplay}!</h1>
                <p className="text-sm text-muted-foreground">Aqui está o resumo do seu dia.</p>
              </>
            )}
          </div>
        </div>

        {/* Metric tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
            : stats.map(s => {
                const Icon = s.icon;
                const content = (
                  <div
                    className={`rounded-xl border ${s.border} bg-gradient-to-br ${s.gradient} p-4 space-y-2 ${s.href ? "hover:brightness-110 transition-all cursor-pointer" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</p>
                      <Icon className={`w-4 h-4 ${s.iconColor}`} />
                    </div>
                    <p className={`text-2xl font-bold tabular-nums ${s.valueColor}`}>{s.value}</p>
                  </div>
                );
                return s.href
                  ? <a key={s.label} href={s.href}>{content}</a>
                  : <div key={s.label}>{content}</div>;
              })
          }
        </div>
      </div>

      {/* ── Bottom grid ── */}
      <div className="grid gap-5 md:grid-cols-2">
        {/* Recent RATs */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" /> Últimas RATs
              </CardTitle>
              <a href="/reports" className="text-xs text-primary hover:underline">Ver tudo</a>
            </div>
          </CardHeader>
          <CardContent>
            {loadingData ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
              </div>
            ) : recent.length ? (
              <ul className="space-y-1">
                {recent.map(r => (
                  <li key={r.id} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-secondary/50 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <div>
                        <p className="text-sm font-medium leading-none">{r.id}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Loja {r.loja}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] text-muted-foreground hidden sm:block">{r.data}</span>
                      <Badge
                        className={`text-[10px] border ${
                          r.status === "Finalizada"
                            ? "bg-primary/15 text-primary border-primary/30"
                            : r.status === "Pendente"
                            ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                            : "bg-blue-500/15 text-blue-400 border-blue-500/30"
                        }`}
                      >
                        {r.status}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <FileText className="w-8 h-8" />
                <p className="text-sm">Nenhuma RAT recente.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Wrench className="w-4 h-4 text-primary" /> Acesso rápido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {quickActions
                .filter(a => a.href !== "/tecnicos" || permissions.canManageUsers)
                .map(a => {
                  const Icon = a.icon;
                  return (
                    <a
                      key={a.href}
                      href={a.href}
                      className="flex items-center gap-2.5 rounded-lg border border-border/50 bg-secondary/30 hover:bg-secondary hover:border-border transition-all p-3 text-sm font-medium"
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${a.color}`} />
                      <span className="truncate">{a.label}</span>
                    </a>
                  );
                })}
              {permissions.canManageUsers && (
                <a
                  href="/tecnicos"
                  className="flex items-center gap-2.5 rounded-lg border border-border/50 bg-secondary/30 hover:bg-secondary hover:border-border transition-all p-3 text-sm font-medium"
                >
                  <Users className="w-4 h-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">Técnicos</span>
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
