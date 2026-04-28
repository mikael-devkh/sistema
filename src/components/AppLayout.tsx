import { Sidebar } from "./Sidebar";
import { useMemo, useState, useEffect } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./ui/breadcrumb";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "../context/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { LogOut, Menu, ChevronLeft, PanelLeft, Search } from "lucide-react";
import { cn } from "../lib/utils";
import { useFocusMode } from "../context/FocusModeContext";
import { GlobalSearch } from "./GlobalSearch";

const ROUTE_MAP: Record<string, string> = {
  "/": "Dashboard",
  "/rat": "Nova RAT",
  "/gerador-ip": "Gerador de IP",
  "/agendamento": "Agendamentos",
  "/base-conhecimento": "Base de Conhecimento",
  "/templates-rat": "Templates de RAT",
  "/configuracoes": "Configurações",
  "/perfil": "Perfil",
  "/tecnicos": "Técnicos",
  "/cadastrar-tecnico": "Cadastrar Técnico",
  "/catalogo-servicos": "Catálogo de Serviços",
  "/pagamentos": "Pagamentos",
  "/chamados": "Chamados",
  "/validacao": "Fila de Validação",
  "/estoque": "Controle de Estoque",
  "/support": "Suporte",
  "/relatorios": "Relatórios",
  "/diario-bordo": "Diário de Bordo",
  "/tecnicos/mapa": "Mapa de Técnicos",
  "/seed": "Dados de Teste",
};

// Mapeia rota → grupo (para contexto no header mobile)
const ROUTE_GROUP: Record<string, string> = {
  "/": "Principal",
  "/rat": "Principal",
  "/gerador-ip": "Principal",
  "/agendamento": "Principal",
  "/chamados": "Chamados",
  "/validacao": "Chamados",
  "/pagamentos": "Chamados",
  "/estoque": "Chamados",
  "/templates-rat": "Recursos",
  "/base-conhecimento": "Recursos",
  "/diario-bordo": "Recursos",
  "/relatorios": "Recursos",
  "/perfil": "Conta",
  "/configuracoes": "Conta",
  "/tecnicos": "Conta",
  "/tecnicos/mapa": "Conta",
  "/catalogo-servicos": "Conta",
  "/seed": "Conta",
};

function getSidebarCollapsed() {
  try { return localStorage.getItem("sidebar-collapsed") === "true"; }
  catch { return false; }
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(getSidebarCollapsed);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { focusMode } = useFocusMode();

  // Scroll to top on every navigation
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  const handleToggleCollapse = () => {
    setSidebarCollapsed(c => {
      const next = !c;
      try { localStorage.setItem("sidebar-collapsed", String(next)); } catch {}
      return next;
    });
  };

  const handleLogout = async () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      await signOut(auth);
      toast.success("Sessão encerrada com sucesso.");
      setTimeout(() => { window.location.href = "/login"; }, 500);
    } catch {
      window.location.href = "/login";
    }
  };

  const crumbs = useMemo(() => {
    const path = location.pathname || "/";
    const segments = path.split("/").filter(Boolean);
    if (segments.length === 0) return [{ href: "/", label: ROUTE_MAP["/"] }];
    const acc: { href: string; label: string }[] = [];
    let href = "";
    for (const seg of segments) {
      href += `/${seg}`;
      acc.push({ href, label: ROUTE_MAP[href] || seg });
    }
    return acc;
  }, [location.pathname]);

  const pageTitle = crumbs[crumbs.length - 1]?.label ?? "Dashboard";
  const pageGroup = ROUTE_GROUP[location.pathname] ?? null;

  if (focusMode) {
    return (
      <div className="min-h-screen bg-background">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:font-medium">
          Pular para o conteúdo
        </a>
        <main id="main-content" className="px-4 py-6 max-w-6xl w-full mx-auto animate-page-in">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:font-medium">
        Pular para o conteúdo
      </a>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-[2px] md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(s => !s)}
        collapsed={sidebarCollapsed}
      />

      <div className="flex-1 flex flex-col min-h-screen overflow-hidden min-w-0">
        {/* ── Header ── */}
        <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur-md">
          <div className="flex items-center gap-1.5 px-3 h-14">

            {/* ── Mobile: hamburger ── */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden h-9 w-9 p-0 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => setSidebarOpen(o => !o)}
            >
              <Menu className="w-[18px] h-[18px]" />
            </Button>

            {/* ── Desktop: sidebar toggle (SEMPRE visível) ── */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden md:flex h-9 w-9 p-0 shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={handleToggleCollapse}
                >
                  <PanelLeft
                    className={cn(
                      "w-[18px] h-[18px] transition-transform duration-300",
                      sidebarCollapsed && "rotate-180",
                    )}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
              </TooltipContent>
            </Tooltip>

            {/* Divisor */}
            <div className="hidden md:block h-5 w-px bg-border/60 mx-1 shrink-0" />

            {/* ── Mobile: grupo + título da página ── */}
            <div className="md:hidden flex flex-col justify-center flex-1 min-w-0 pl-1">
              {pageGroup && pageGroup !== pageTitle && (
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 leading-none mb-0.5">
                  {pageGroup}
                </p>
              )}
              <p className="font-semibold text-sm text-foreground leading-none truncate">
                {pageTitle}
              </p>
            </div>

            {/* ── Desktop: voltar + breadcrumb ── */}
            <div className="hidden md:flex items-center gap-1 flex-1 min-w-0">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground shrink-0"
                onClick={() => navigate(-1)}
                title="Voltar"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              <Breadcrumb>
                <BreadcrumbList className="flex-nowrap">
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to="/" className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                        Início
                      </Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  {crumbs.map((c, i) => (
                    <span key={c.href} className="contents">
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        {i === crumbs.length - 1 ? (
                          <BreadcrumbPage className="text-sm font-semibold text-foreground">
                            {c.label}
                          </BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink asChild>
                            <Link to={c.href} className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                              {c.label}
                            </Link>
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                    </span>
                  ))}
                </BreadcrumbList>
              </Breadcrumb>
            </div>

            {/* ── Controles direita ── */}
            <div className="flex items-center gap-1 ml-auto shrink-0">
              {/* Search button — triggers GlobalSearch (Ctrl+K) */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      const event = new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true });
                      document.dispatchEvent(event);
                    }}
                    aria-label="Buscar (Ctrl+K)"
                  >
                    <Search className="w-[18px] h-[18px]" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Buscar
                  <kbd className="ml-1.5 pointer-events-none inline-flex h-4 select-none items-center gap-0.5 rounded border border-border/50 bg-muted px-1 font-mono text-[10px] font-medium text-muted-foreground">
                    Ctrl K
                  </kbd>
                </TooltipContent>
              </Tooltip>

              {user && (
                <span className="hidden lg:block text-xs text-muted-foreground truncate max-w-[160px] px-1">
                  {user.email}
                </span>
              )}
              <ThemeToggle />
              {user && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleLogout}
                      aria-label="Sair"
                      className="hidden md:flex h-9 w-9 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <LogOut className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Sair</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </header>

        {/* ── Conteúdo ── */}
        <main id="main-content" className="flex-1 px-4 py-6 max-w-7xl w-full mx-auto animate-page-in">
          {children}
        </main>
      </div>

      {/* Global search dialog (Ctrl+K) */}
      <GlobalSearch />
    </div>
  );
}
