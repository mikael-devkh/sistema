import { useAuth } from "../context/AuthContext";
import { usePermissions } from "../hooks/use-permissions";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
  FileText, User, PlusCircle, Network,
  BookText, LayoutTemplate, Users,
  CalendarClock, TrendingUp, Wrench, ArrowRight,
} from "lucide-react";
import { Skeleton } from "../components/ui/skeleton";
import { Badge } from "../components/ui/badge";
import { db } from "../firebase";
import { collection, getDocs, limit as fbLimit, orderBy, query, Timestamp, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { cn } from "../lib/utils";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

const quickActions = [
  {
    href: "/rat",
    icon: PlusCircle,
    label: "Nova RAT",
    description: "Abrir relatório de atendimento",
    accent: "text-emerald-500 bg-emerald-500/10",
  },
  {
    href: "/agendamento",
    icon: CalendarClock,
    label: "Agendamentos",
    description: "Ver agenda de visitas",
    accent: "text-violet-500 bg-violet-500/10",
  },
  {
    href: "/gerador-ip",
    icon: Network,
    label: "Gerador de IP",
    description: "Calcular endereços de rede",
    accent: "text-cyan-500 bg-cyan-500/10",
  },
  {
    href: "/base-conhecimento",
    icon: BookText,
    label: "Base de Conhecimento",
    description: "Artigos e procedimentos técnicos",
    accent: "text-rose-500 bg-rose-500/10",
  },
  {
    href: "/templates-rat",
    icon: LayoutTemplate,
    label: "Templates RAT",
    description: "Modelos de relatório",
    accent: "text-indigo-500 bg-indigo-500/10",
  },
  {
    href: "/perfil",
    icon: User,
    label: "Meu Perfil",
    description: "Dados e preferências",
    accent: "text-muted-foreground bg-muted",
  },
];

export default function Dashboard() {
  const { profile, loadingAuth, loadingProfile, user } = useAuth();
  const { permissions } = usePermissions();

  const nomeDisplay = profile?.nome?.split(" ")[0] || "Usuário";
  const avatarUrl = profile?.avatarUrl;
  const initials =
    (profile?.nome || "U")
      .split(" ")
      .map(n => n[0]?.toUpperCase())
      .slice(0, 2)
      .join("") || "U";

  const [loadingData, setLoadingData] = useState(true);
  const [thisMonthCount, setThisMonthCount] = useState(0);
  const [recent, setRecent] = useState<Array<{ id: string; loja: string; data: string; status: string }>>([]);

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
        const clauses: any[] = [orderBy("archivedAt", "desc"), fbLimit(5)];
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

        setThisMonthCount(monthSnap.size);
        setRecent(recentMapped);
        try {
          localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ month: monthSnap.size, recent: recentMapped, ts: Date.now() }),
          );
        } catch {}
      } catch {
        // mantém cache
      } finally {
        setLoadingData(false);
      }
    })();
  }, [user?.uid]);

  const isLoading = loadingAuth || loadingProfile;

  const stats = [
    {
      label: "RATs este mês",
      value: loadingData ? null : String(thisMonthCount),
      icon: FileText,
      colorClass: "text-emerald-600 dark:text-emerald-400",
      bgClass: "bg-emerald-500/10",
      borderClass: "border-emerald-500/20",
      href: "/rat",
    },
    {
      label: "Agendamentos",
      value: "Ver",
      icon: CalendarClock,
      colorClass: "text-violet-600 dark:text-violet-400",
      bgClass: "bg-violet-500/10",
      borderClass: "border-violet-500/20",
      href: "/agendamento",
    },
    {
      label: "Gerador de IP",
      value: "Usar",
      icon: Network,
      colorClass: "text-cyan-600 dark:text-cyan-400",
      bgClass: "bg-cyan-500/10",
      borderClass: "border-cyan-500/20",
      href: "/gerador-ip",
    },
    {
      label: "Função",
      value: profile?.role ? (profile.role === "admin" ? "Admin" : "Técnico") : "—",
      icon: User,
      colorClass: "text-violet-600 dark:text-violet-400",
      bgClass: "bg-violet-500/10",
      borderClass: "border-violet-500/20",
      href: "/perfil",
    },
  ];

  return (
    <div className="space-y-6 pb-6 animate-page-in">
      {/* ── Hero ── */}
      <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-primary/60 via-primary to-primary/40" />

        <div className="p-5 sm:p-6">
          {/* Saudação */}
          <div className="flex items-center gap-4 mb-6">
            {isLoading ? (
              <Skeleton className="h-12 w-12 rounded-full shrink-0" />
            ) : avatarUrl ? (
              <img
                src={avatarUrl}
                alt="avatar"
                className="rounded-full h-12 w-12 object-cover border-2 border-primary/20 shadow-sm shrink-0"
              />
            ) : (
              <div className="rounded-full h-12 w-12 bg-primary/15 font-bold flex items-center justify-center text-lg border-2 border-primary/15 shadow-sm shrink-0 text-primary">
                {initials}
              </div>
            )}
            <div>
              {isLoading ? (
                <>
                  <Skeleton className="h-6 w-44 mb-1.5" />
                  <Skeleton className="h-4 w-52" />
                </>
              ) : (
                <>
                  <h1 className="text-xl font-bold tracking-tight">
                    {getGreeting()}, {nomeDisplay}!
                  </h1>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Aqui está o resumo do seu dia.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Metric tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-[88px] rounded-xl" />
                ))
              : stats.map(s => {
                  const Icon = s.icon;
                  const tile = (
                    <div
                      className={cn(
                        "rounded-xl border p-4 space-y-2.5 transition-all duration-150",
                        s.borderClass,
                        s.bgClass,
                        s.href && "hover:brightness-105 cursor-pointer",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground leading-none">
                          {s.label}
                        </p>
                        <Icon className={cn("w-4 h-4 shrink-0", s.colorClass)} />
                      </div>
                      <p className={cn("text-2xl font-bold tabular-nums leading-none", s.colorClass)}>
                        {s.value ?? "—"}
                      </p>
                    </div>
                  );
                  return s.href ? (
                    <a key={s.label} href={s.href}>{tile}</a>
                  ) : (
                    <div key={s.label}>{tile}</div>
                  );
                })}
          </div>
        </div>
      </div>

      {/* ── Grade inferior ── */}
      <div className="grid gap-5 md:grid-cols-2">
        {/* Últimas RATs */}
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <TrendingUp className="w-4 h-4 text-primary" />
                Últimas RATs
              </CardTitle>
              <a
                href="/rat"
                className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1 transition-colors"
              >
                Nova RAT
                <ArrowRight className="w-3 h-3" />
              </a>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {loadingData ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : recent.length ? (
              <ul className="space-y-0.5">
                {recent.map(r => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between py-2.5 px-2.5 rounded-lg hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="h-[15px] w-[15px] text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold leading-none">{r.id}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Loja {r.loja}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] text-muted-foreground hidden sm:block">
                        {r.data}
                      </span>
                      <Badge
                        className={cn(
                          "text-[10px] border font-semibold",
                          r.status === "Finalizada"
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/25 dark:text-emerald-400"
                            : r.status === "Pendente"
                            ? "bg-amber-500/10 text-amber-600 border-amber-500/25 dark:text-amber-400"
                            : "bg-blue-500/10 text-blue-600 border-blue-500/25 dark:text-blue-400",
                        )}
                      >
                        {r.status}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">Nenhuma RAT recente</p>
                  <p className="text-xs mt-0.5">As RATs emitidas aparecerão aqui</p>
                </div>
                <a href="/rat" className="text-xs text-primary font-medium hover:underline">
                  Criar primeira RAT
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Acesso rápido */}
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <Wrench className="w-4 h-4 text-primary" />
              Acesso rápido
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-2">
              {quickActions.map(a => {
                const Icon = a.icon;
                return (
                  <a
                    key={a.href}
                    href={a.href}
                    className="group flex items-start gap-3 rounded-xl border border-border/60 bg-secondary/20 hover:bg-secondary hover:border-border transition-all p-3"
                  >
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5", a.accent)}>
                      <Icon className="w-[15px] h-[15px]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-none truncate">{a.label}</p>
                      <p className="text-[11px] text-muted-foreground mt-1 leading-snug line-clamp-2">
                        {a.description}
                      </p>
                    </div>
                  </a>
                );
              })}
              {permissions.canManageUsers && (
                <a
                  href="/tecnicos"
                  className="group flex items-start gap-3 rounded-xl border border-border/60 bg-secondary/20 hover:bg-secondary hover:border-border transition-all p-3"
                >
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                    <Users className="w-[15px] h-[15px] text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-none">Técnicos</p>
                    <p className="text-[11px] text-muted-foreground mt-1">Gerenciar equipe</p>
                  </div>
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── CTA Agendamentos ── */}
      <a
        href="/agendamento"
        className="flex items-center justify-between rounded-xl border border-border/60 bg-card hover:bg-secondary/30 transition-all px-5 py-4 shadow-card group"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <CalendarClock className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">Agendamentos do dia</p>
            <p className="text-xs text-muted-foreground mt-0.5">Veja e gerencie a agenda de visitas técnicas</p>
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
      </a>
    </div>
  );
}
