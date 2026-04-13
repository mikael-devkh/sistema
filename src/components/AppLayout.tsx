import { Sidebar } from "./Sidebar";
import { useMemo, useState } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./ui/breadcrumb";
import { useLocation, useNavigate } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "../context/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { LogOut, Menu, ChevronLeft, PanelLeft } from "lucide-react";
import { cn } from "../lib/utils";

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
  "/support": "Suporte",
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

  return (
    <div className="flex min-h-screen bg-background">
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
        <header className="sticky top-0 z-20 border-b border-border bg-card/90 backdrop-blur-md">
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

            {/* ── Mobile: título da página ── */}
            <div className="md:hidden font-semibold text-sm text-foreground flex-1 truncate pl-1">
              {pageTitle}
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
                    <BreadcrumbLink
                      href="/"
                      className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                    >
                      Início
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
                          <BreadcrumbLink
                            href={c.href}
                            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                          >
                            {c.label}
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
        <main className="flex-1 px-4 py-6 max-w-6xl w-full mx-auto animate-page-in">
          {children}
        </main>
      </div>
    </div>
  );
}
