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

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

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
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(s => !s)} />

      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur-sm">
          <div className="flex items-center gap-3 px-4 h-14">
            {/* Mobile hamburger */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden -ml-1 h-9 w-9 p-0"
              onClick={() => setSidebarOpen(o => !o)}
            >
              <Menu className="w-5 h-5" />
            </Button>

            {/* Mobile brand */}
            <div className="md:hidden font-semibold text-sm text-foreground flex-1">
              {pageTitle}
            </div>

            {/* Desktop breadcrumb */}
            <div className="hidden md:flex items-center gap-2 flex-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                onClick={() => navigate(-1)}
                title="Voltar"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink href="/" className="text-muted-foreground hover:text-foreground text-sm">
                      Início
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  {crumbs.map((c, i) => (
                    <span key={c.href} className="contents">
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        {i === crumbs.length - 1 ? (
                          <BreadcrumbPage className="text-sm font-medium">{c.label}</BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink href={c.href} className="text-muted-foreground hover:text-foreground text-sm">
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
            <div className="flex items-center gap-1.5 ml-auto">
              {user && (
                <span className="hidden lg:block text-xs text-muted-foreground truncate max-w-[180px] px-1">
                  {user.email}
                </span>
              )}
              <ThemeToggle />
              {user && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="hidden md:flex h-9 gap-1.5 text-muted-foreground hover:text-destructive"
                  title="Sair"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden lg:inline">Sair</span>
                </Button>
              )}
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 px-4 py-6 max-w-6xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
