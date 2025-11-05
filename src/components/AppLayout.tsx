import { Sidebar } from "./Sidebar";
import { useMemo, useState } from "react";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "./ui/breadcrumb";
import { useLocation, useNavigate } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "../context/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { LogOut } from "lucide-react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleLogout = async () => {
    try {
      // Limpar cache primeiro
      localStorage.clear();
      sessionStorage.clear();
      // Fazer logout
      await signOut(auth);
      toast.success("Sessão encerrada com sucesso.");
      // Forçar reload completo para limpar todo o estado
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
    } catch (error) {
      console.error("Erro ao sair da conta:", error);
      toast.error("Não foi possível encerrar a sessão.");
      // Mesmo com erro, tentar redirecionar
      window.location.href = "/login";
    }
  };

  const crumbs = useMemo(() => {
    const path = location.pathname || "/";
    const map: Record<string, string> = {
      "/": "Dashboard",
      "/rat": "Nova RAT",
      "/reports": "Histórico",
      "/gerador-ip": "Gerador de IP",
      "/base-conhecimento": "Base de Conhecimento",
      "/templates-rat": "Templates RAT",
      "/service-manager": "Chamados",
      "/configuracoes": "Configurações",
      "/perfil": "Perfil",
    };
    const segments = path.split("/").filter(Boolean);
    const acc: { href: string; label: string }[] = [];
    let href = "";
    if (segments.length === 0) return [{ href: "/", label: map["/"] }];
    for (const seg of segments) {
      href += `/${seg}`;
      acc.push({ href, label: map[href] || seg });
    }
    return acc;
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen bg-gradient-to-tr from-slate-800 to-slate-950">
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(s => !s)} />
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="flex flex-col gap-2 bg-secondary px-4 py-3 border-b border-border shadow-md sticky top-0 z-20">
          <div className="flex items-center justify-between">
            <button className="md:hidden mr-2" onClick={() => setSidebarOpen(o => !o)}>
              <span className="material-icons">menu</span>
            </button>
            <div className="font-bold text-lg">WT Serviços</div>
            <div className="flex items-center gap-2">
              {user && (
                <span className="hidden md:block text-sm text-muted-foreground truncate max-w-[200px]">
                  {user.email}
                </span>
              )}
              <ThemeToggle />
              {user && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="hidden md:flex"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sair
                </Button>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/">Início</BreadcrumbLink>
                </BreadcrumbItem>
                {crumbs.map((c, i) => (
                  <>
                    <BreadcrumbSeparator />
                    {i === crumbs.length - 1 ? (
                      <BreadcrumbItem>
                        <BreadcrumbPage>{c.label}</BreadcrumbPage>
                      </BreadcrumbItem>
                    ) : (
                      <BreadcrumbItem>
                        <BreadcrumbLink href={c.href}>{c.label}</BreadcrumbLink>
                      </BreadcrumbItem>
                    )}
                  </>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
            <button className="text-sm text-muted-foreground hover:text-foreground" onClick={() => navigate(-1)}>Voltar</button>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 max-w-6xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
