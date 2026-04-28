import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePermissions } from "../hooks/use-permissions";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
  FileText, User, PlusCircle, Network,
  BookText, LayoutTemplate, Users,
  CalendarClock, TrendingUp, Wrench, ArrowRight,
  ClipboardList, ShieldCheck, DollarSign, Package,
  AlertTriangle, CheckCircle2,
} from "lucide-react";
import { Skeleton } from "../components/ui/skeleton";
import { Badge } from "../components/ui/badge";
import { db } from "../firebase";
import {
  collection, getDocs, limit as fbLimit, orderBy,
  query, Timestamp, where,
} from "firebase/firestore";
import { useQuery } from "@tanstack/react-query";
import { cn } from "../lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin", operador: "Operador", financeiro: "Financeiro",
  tecnico: "Técnico", visualizador: "Visualizador",
};

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface BackofficeMetrics {
  chamadosPendentesOp: number;
  chamadosPendentesFin: number;
  chamadosRejeitados: number;
  pagamentosPendentes: number;
  estoqueBaixo: number;
}

interface RatRecente {
  id: string;
  loja: string;
  data: string;
  status: string;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { profile, loadingAuth, loadingProfile, user } = useAuth();
  const { permissions, role } = usePermissions();

  const nomeDisplay = profile?.nome?.split(" ")[0] || "Usuário";
  const avatarUrl   = profile?.avatarUrl;
  const initials    =
    (profile?.nome || "U")
      .split(" ")
      .map(n => n[0]?.toUpperCase())
      .slice(0, 2)
      .join("") || "U";
  const roleLabel = ROLE_LABEL[profile?.role ?? ""] ?? "Técnico";

  const isBackoffice = role === "admin" || role === "operador" || role === "financeiro";
  const isLoading    = loadingAuth || loadingProfile;

  // ── RATs recentes (React Query com cache de 10min) ────────────────────────
  const { data: ratData, isLoading: loadingRats } = useQuery({
    queryKey: ["dashboard-rats", user?.uid],
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const base = collection(db, "serviceReports");
      const clauses: any[] = [orderBy("archivedAt", "desc"), fbLimit(5)];
      if (user?.uid) clauses.unshift(where("userId", "==", user.uid));
      const [recentSnap, monthSnap] = await Promise.all([
        getDocs(query(base, ...clauses)),
        getDocs(query(base, where("archivedAt", ">=", Timestamp.fromDate(startOfMonth)), fbLimit(200),
          ...(user?.uid ? [where("userId", "==", user.uid)] : []))),
      ]);
      const recentRats: RatRecente[] = recentSnap.docs.map(d => {
        const data = d.data();
        const archivedAt = data.archivedAt?.toDate?.() as Date | undefined;
        return {
          id: data.fsa ? `RAT-${data.fsa}` : d.id,
          loja: String(data.codigoLoja || ""),
          data: archivedAt ? archivedAt.toISOString().slice(0, 10) : "—",
          status: data.status || "Emitida",
        };
      });
      return { recentRats, thisMonthCount: monthSnap.size };
    },
    staleTime: 10 * 60 * 1000,
    enabled: !loadingAuth,
  });

  const thisMonthCount = ratData?.thisMonthCount ?? 0;
  const recentRats     = ratData?.recentRats ?? [];

  // ── Métricas de backoffice (React Query) ─────────────────────────────────
  const { data: bo, isLoading: loadingBo } = useQuery({
    queryKey: ["dashboard-backoffice"],
    queryFn: async () => {
      const chamados  = collection(db, "chamados");
      const pagamentos = collection(db, "pagamentos");
      const estoque   = collection(db, "estoqueItens");
      const [snapOp, snapFin, snapRej, snapPag, snapEst] = await Promise.all([
        getDocs(query(chamados,   where("status", "==", "submetido"),         fbLimit(200))),
        getDocs(query(chamados,   where("status", "==", "validado_operador"), fbLimit(200))),
        getDocs(query(chamados,   where("status", "in", ["rejeitado", "rejeitado_operacional", "rejeitado_financeiro"]), fbLimit(200))),
        getDocs(query(pagamentos, where("status", "==", "pendente"),          fbLimit(200))),
        getDocs(query(estoque)),
      ]);
      let estoqueBaixo = 0;
      snapEst.forEach(d => {
        const atual = d.data().quantidadeAtual ?? 0;
        const min   = d.data().quantidadeMinima ?? 0;
        if (min > 0 && atual <= min) estoqueBaixo++;
      });
      return {
        chamadosPendentesOp:  snapOp.size,
        chamadosPendentesFin: snapFin.size,
        chamadosRejeitados:   snapRej.size,
        pagamentosPendentes:  snapPag.size,
        estoqueBaixo,
      };
    },
    staleTime: 5 * 60 * 1000,
    enabled: isBackoffice,
  });

  const boData: BackofficeMetrics = bo ?? {
    chamadosPendentesOp: 0, chamadosPendentesFin: 0,
    chamadosRejeitados: 0,  pagamentosPendentes: 0, estoqueBaixo: 0,
  };

  // ── Tiles de métricas ─────────────────────────────────────────────────────

  const statsTecnico = [
    {
      label: "RATs este mês",
      value: loadingRats ? null : String(thisMonthCount),
      icon: FileText,
      signal: "success",
      href: "/rat",
    },
    {
      label: "Agendamentos",
      value: "Ver",
      icon: CalendarClock,
      signal: "neutral",
      href: "/agendamento",
    },
    {
      label: "Gerador de IP",
      value: "Usar",
      icon: Network,
      signal: "neutral",
      href: "/gerador-ip",
    },
    {
      label: "Função",
      value: roleLabel,
      icon: User,
      signal: "neutral",
      href: "/perfil",
    },
  ];

  const statsBackoffice = [
    {
      label: "Ag. Validação Op.",
      value: loadingBo ? null : String(boData.chamadosPendentesOp),
      icon: ShieldCheck,
      signal: boData.chamadosPendentesOp > 0 ? "attention" : "neutral",
      href: "/validacao",
    },
    {
      label: "Ag. Validação Fin.",
      value: loadingBo ? null : String(boData.chamadosPendentesFin),
      icon: CheckCircle2,
      signal: boData.chamadosPendentesFin > 0 ? "attention" : "neutral",
      href: "/validacao",
    },
    {
      label: "Pagamentos pend.",
      value: loadingBo ? null : String(boData.pagamentosPendentes),
      icon: DollarSign,
      signal: boData.pagamentosPendentes > 0 ? "attention" : "neutral",
      href: "/pagamentos",
    },
    {
      label: "Estoque baixo",
      value: loadingBo ? null : String(boData.estoqueBaixo),
      icon: Package,
      signal: boData.estoqueBaixo > 0 ? "critical" : "neutral",
      href: "/estoque",
    },
  ];

  const stats = isBackoffice ? statsBackoffice : statsTecnico;

  // ── Quick actions ─────────────────────────────────────────────────────────

  const quickActionsTecnico = [
    { href: "/rat",               icon: PlusCircle,    label: "Nova RAT",            description: "Abrir relatório de atendimento",      accent: "text-primary bg-primary/10" },
    { href: "/agendamento",       icon: CalendarClock, label: "Agendamentos",         description: "Ver agenda de visitas",               accent: "text-muted-foreground bg-secondary"  },
    { href: "/gerador-ip",        icon: Network,       label: "Gerador de IP",        description: "Calcular endereços de rede",          accent: "text-muted-foreground bg-secondary"      },
    { href: "/base-conhecimento", icon: BookText,      label: "Base de Conhecimento", description: "Artigos e procedimentos técnicos",    accent: "text-muted-foreground bg-secondary"      },
    { href: "/templates-rat",     icon: LayoutTemplate,label: "Templates RAT",        description: "Modelos de relatório",                accent: "text-muted-foreground bg-secondary"  },
    { href: "/perfil",            icon: User,          label: "Meu Perfil",           description: "Dados e preferências",                accent: "text-muted-foreground bg-muted"    },
  ];

  const quickActionsBackoffice = [
    { href: "/chamados",          icon: ClipboardList, label: "Chamados",             description: "Registrar e acompanhar chamados",     accent: "text-primary bg-primary/10"      },
    { href: "/validacao",         icon: ShieldCheck,   label: "Fila de Validação",    description: "Aprovar ou rejeitar chamados",        accent: "text-muted-foreground bg-secondary"  },
    { href: "/pagamentos",        icon: DollarSign,    label: "Pagamentos",           description: "Gerar e controlar pagamentos",        accent: "text-muted-foreground bg-secondary"    },
    { href: "/estoque",           icon: Package,       label: "Estoque",              description: "Controle de peças e materiais",       accent: "text-muted-foreground bg-secondary"    },
    { href: "/agendamento",       icon: CalendarClock, label: "Agendamentos",         description: "Ver agenda de visitas",               accent: "text-muted-foreground bg-secondary"  },
    { href: "/gerador-ip",        icon: Network,       label: "Gerador de IP",        description: "Calcular endereços de rede",          accent: "text-muted-foreground bg-secondary"      },
  ];

  const quickActions = isBackoffice ? quickActionsBackoffice : quickActionsTecnico;

  return (
    <div className="space-y-6 pb-6 animate-page-in">
      {/* ── Hero ── */}
      <div className="surface-panel overflow-hidden">
        <div className="card-top-bar" />

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
                  <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
                    <span className="inline-flex h-[22px] items-center rounded-full px-2.5 text-[11px] font-semibold bg-primary/10 text-primary">
                      {roleLabel}
                    </span>
                    {isBackoffice
                      ? "Aqui está o resumo das operações."
                      : "Aqui está o resumo do seu dia."}
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
                  const loading = isBackoffice ? loadingBo : loadingRats;
                  const isInverted = s.signal === "critical";
                  const signalClass =
                    s.signal === "success" ? "text-success" :
                    s.signal === "attention" ? "text-foreground" :
                    s.signal === "critical" ? "text-primary-foreground" :
                    "text-foreground";
                  const dotClass =
                    s.signal === "success" ? "bg-success" :
                    s.signal === "attention" ? "bg-warning" :
                    s.signal === "critical" ? "bg-critical" :
                    "bg-muted-foreground/35";
                  const tile = (
                    <div className={cn(
                      "kpi-card min-h-[112px] space-y-4 transition-all duration-200",
                      isInverted && "kpi-card-inverted",
                      s.href && "hover:scale-[1.02] hover:shadow-card-md cursor-pointer active:scale-[0.99]",
                    )}>
                      <div className="flex items-center justify-between">
                        <p className={cn("t-eyebrow leading-tight", isInverted ? "text-primary-foreground/65" : "text-muted-foreground")}>
                          {s.label}
                        </p>
                        <span className={cn("status-dot", dotClass)} />
                      </div>
                      {loading
                        ? <Skeleton className="h-7 w-12" />
                        : (
                          <div className="flex items-end justify-between gap-3">
                            <p className={cn("text-[34px] font-extrabold tabular-nums leading-none", signalClass)}>
                              {s.value ?? "—"}
                            </p>
                            <Icon className={cn("w-4 h-4 shrink-0 mb-1", isInverted ? "text-primary-foreground/55" : "text-muted-foreground")} />
                          </div>
                        )
                      }
                    </div>
                  );
                  return s.href ? <Link key={s.label} to={s.href}>{tile}</Link> : <div key={s.label}>{tile}</div>;
                })}
          </div>
        </div>
      </div>

      {/* ── Grade inferior ── */}
      <div className="grid gap-5 md:grid-cols-2">

        {/* Coluna esquerda: chamados recentes (backoffice) ou RATs (técnico) */}
        {isBackoffice ? (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <ClipboardList className="w-4 h-4 text-primary" />
                  Chamados rejeitados
                </CardTitle>
                <Link to="/chamados" className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1 transition-colors">
                  Ver todos <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {loadingBo ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}
                </div>
              ) : boData.chamadosRejeitados === 0 ? (
                <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
                  <CheckCircle2 className="w-8 h-8 opacity-30" />
                  <p className="text-sm">Nenhum chamado rejeitado.</p>
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-[10px] border border-critical/25 bg-critical/5 p-4">
                  <AlertTriangle className="w-5 h-5 text-critical shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-critical">
                      {boData.chamadosRejeitados} chamado{boData.chamadosRejeitados > 1 ? "s" : ""} rejeitado{boData.chamadosRejeitados > 1 ? "s" : ""}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Requerem correção e resubmissão</p>
                  </div>
                  <Link to="/chamados" className="ml-auto shrink-0">
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  Últimas RATs
                </CardTitle>
                <Link to="/rat" className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1 transition-colors">
                  Nova RAT <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {loadingRats ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
                </div>
              ) : recentRats.length ? (
                <ul className="space-y-0.5">
                  {recentRats.map(r => (
                    <li key={r.id} className="flex items-center justify-between py-2.5 px-2.5 rounded-lg hover:bg-secondary/50 transition-colors">
                      <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-[8px] bg-primary/10 flex items-center justify-center shrink-0">
                          <FileText className="h-[15px] w-[15px] text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold leading-none">{r.id}</p>
                          <p className="text-[11px] text-muted-foreground mt-1">Loja {r.loja}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-muted-foreground hidden sm:block">{r.data}</span>
                        <Badge className={cn(
                          "text-[10px] border font-semibold",
                          r.status === "Finalizada"
                            ? "bg-success/10 text-success border-success/20"
                            : r.status === "Pendente"
                            ? "bg-warning/15 text-foreground border-warning/20"
                            : "bg-info/10 text-info border-info/20",
                        )}>
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
                  <Link to="/rat" className="text-xs text-primary font-medium hover:underline">Criar primeira RAT</Link>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Acesso rápido */}
        <Card>
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
                  <Link
                    key={a.href + a.label}
                    to={a.href}
                    className="group flex items-start gap-3 rounded-[10px] border border-border bg-card hover:bg-secondary/60 transition-all p-3"
                  >
                    <div className={cn("w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0 mt-0.5", a.accent)}>
                      <Icon className="w-[15px] h-[15px]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-none truncate">{a.label}</p>
                      <p className="text-[11px] text-muted-foreground mt-1 leading-snug line-clamp-2">{a.description}</p>
                    </div>
                  </Link>
                );
              })}
              {permissions.canManageUsers && !isBackoffice && (
                <Link
                  to="/tecnicos"
                  className="group flex items-start gap-3 rounded-[10px] border border-border bg-card hover:bg-secondary/60 transition-all p-3"
                >
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                    <Users className="w-[15px] h-[15px] text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-none">Técnicos</p>
                    <p className="text-[11px] text-muted-foreground mt-1">Gerenciar equipe</p>
                  </div>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── CTA contextual ── */}
      {isBackoffice ? (
        <Link
          to="/validacao"
          className="flex items-center justify-between rounded-xl border border-border/60 bg-card hover:bg-secondary/30 transition-all px-5 py-4 shadow-card group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Fila de validação</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {boData.chamadosPendentesOp + boData.chamadosPendentesFin > 0
                  ? `${boData.chamadosPendentesOp + boData.chamadosPendentesFin} chamado(s) aguardando aprovação`
                  : "Nenhum chamado aguardando aprovação no momento"}
              </p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
        </Link>
      ) : (
        <Link
          to="/agendamento"
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
        </Link>
      )}
    </div>
  );
}
