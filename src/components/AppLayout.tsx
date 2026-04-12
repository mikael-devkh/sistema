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
import { LogOut, Menu, ChevronLeft } from "lucide-react";
import { cn } from "../lib/utils";

const ROUTE_MAP: Record<string, string> = {
  "/": "Dashboard",
  "/rat": "Nova RAT",
  "/reports": "Histórico",
  "/gerador-ip": "Gerador de IP",
  "/base-conhecimento": "Base de Conhecimento",
  "/templates-rat": "Templates RAT",
  "/service-manager": "Chamados",
  "/agendamento": "Agendamentos",
  "/configuracoes": "Configurações",
  "/perfil": "Perfil",
  "/minha-fila": "Minha Fila",
  "/fsas": "FSAs",
  "/tecnicos": "Técnicos",
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
        onToggleCollapse={handleToggleCollapse}
      />

      <div className="flex-1 flex flex-col min-h-screen overflow-hidden min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-20 border-b border-border bg-card/90 backdrop-blur-md">
          <div className="flex items-center gap-2.5 px-4 h-14">
            {/* Mobile hamburger */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden -ml-1 h-9 w-9 p-0 shrink-0"
              onClick={() => setSidebarOpen(o => !o)}
            >
              <Menu className="w-[18px] h-[18px]" />
            </Button>

            {/* Mobile: page title */}
            <div className="md:hidden font-semibold text-sm text-foreground flex-1 truncate">
              {pageTitle}
            </div>

            {/* Desktop: back + breadcrumb */}
            <div className="hidden md:flex items-center gap-1.5 flex-1 min-w-0">
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

            {/* Right controls */}
            <div className="flex items-center gap-1 ml-auto shrink-0">
              {user && (
                <span
                  className={cn(
                    "hidden lg:block text-xs text-muted-foreground truncate max-w-[160px] px-1",
                  )}
                >
                  {user.email}
                </span>
              )}
              <ThemeToggle />
              {user && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="hidden md:flex h-9 gap-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/8 px-2.5"
                  title="Sair"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden lg:inline text-sm">Sair</span>
                </Button>
              )}
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 px-4 py-6 max-w-6xl w-full mx-auto animate-page-in">
          {children}
        </main>
      </div>
    </div>
  );
}
