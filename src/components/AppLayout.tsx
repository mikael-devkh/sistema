import { Sidebar } from "./Sidebar";
import { useMemo, useState } from "react";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "./ui/breadcrumb";
import { useLocation, useNavigate } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

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
            <ThemeToggle />
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
