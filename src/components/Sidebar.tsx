import { NavLink, useNavigate } from "react-router-dom";
import { FileText, Settings, Home, Layers, User, BookOpen, Network, BarChart2, LayoutTemplate, LogOut } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { useServiceManager } from "../hooks/use-service-manager";
import { useAuth } from "../context/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { toast } from "sonner";
import { Button } from "./ui/button";

export function Sidebar({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const navigate = useNavigate();
  let openCount = 0;
  try {
    const { activeCalls } = useServiceManager();
    openCount = activeCalls.filter(c => c.status === "open").length;
  } catch {}
  const { profile, user } = (() => { try { return useAuth(); } catch { return { profile: undefined as any, user: undefined }; } })();

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
  return (
    <aside className={`fixed md:static bg-secondary z-40 transition-all duration-300 ${open ? "left-0" : "-left-64"} md:left-0 w-64 min-h-screen border-r border-border flex flex-col`}>
      <nav className="flex flex-col gap-2 py-4 flex-1">
        <Accordion type="multiple" defaultValue={["operacao", "relatorios", "conhecimento", "atendimento", "admin"]} className="px-2">
          <AccordionItem value="operacao" className="border-none">
            <AccordionTrigger className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Operação</AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-col gap-1 pb-2">
                <NavLink to="/" className={({ isActive }) => `flex items-center gap-3 px-6 py-2 rounded transition cursor-pointer ${isActive ? "bg-primary/15 text-primary border-l-2 border-primary" : "text-foreground/90 hover:bg-primary/10"}`}><Home className="w-5 h-5" /> Dashboard</NavLink>
                <NavLink to="/rat" className={({ isActive }) => `flex items-center gap-3 px-6 py-2 rounded transition cursor-pointer ${isActive ? "bg-primary/15 text-primary border-l-2 border-primary" : "text-foreground/90 hover:bg-primary/10"}`}><FileText className="w-5 h-5" /> Nova RAT</NavLink>
                <NavLink to="/gerador-ip" className={({ isActive }) => `flex items-center gap-3 px-6 py-2 rounded transition cursor-pointer ${isActive ? "bg-primary/15 text-primary border-l-2 border-primary" : "text-foreground/90 hover:bg-primary/10"}`}><Network className="w-5 h-5" /> Gerador de IP</NavLink>
                <NavLink to="/minha-fila" className={({ isActive }) => `flex items-center gap-3 px-6 py-2 rounded transition cursor-pointer ${isActive ? "bg-primary/15 text-primary border-l-2 border-primary" : "text-foreground/90 hover:bg-primary/10"}`}><Layers className="w-5 h-5" /> Minha Fila</NavLink>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="relatorios" className="border-none">
            <AccordionTrigger className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Relatórios</AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-col gap-1 pb-2">
                <NavLink to="/reports" className={({ isActive }) => `flex items-center gap-3 px-6 py-2 rounded transition cursor-pointer ${isActive ? "bg-primary/15 text-primary border-l-2 border-primary" : "text-foreground/90 hover:bg-primary/10"}`}><BarChart2 className="w-5 h-5" /> Histórico</NavLink>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="conhecimento" className="border-none">
            <AccordionTrigger className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Conhecimento</AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-col gap-1 pb-2">
                <NavLink to="/templates-rat" className={({ isActive }) => `flex items-center gap-3 px-6 py-2 rounded transition cursor-pointer ${isActive ? "bg-primary/15 text-primary border-l-2 border-primary" : "text-foreground/90 hover:bg-primary/10"}`}><LayoutTemplate className="w-5 h-5" /> Templates de RAT</NavLink>
                <NavLink to="/base-conhecimento" className={({ isActive }) => `flex items-center gap-3 px-6 py-2 rounded transition cursor-pointer ${isActive ? "bg-primary/15 text-primary border-l-2 border-primary" : "text-foreground/90 hover:bg-primary/10"}`}><BookOpen className="w-5 h-5" /> Base de Conhecimento</NavLink>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="atendimento" className="border-none">
            <AccordionTrigger className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Atendimento</AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-col gap-1 pb-2">
                <NavLink to="/service-manager" className={({ isActive }) => `flex items-center justify-between px-6 py-2 rounded transition cursor-pointer ${isActive ? "bg-primary/15 text-primary border-l-2 border-primary" : "text-foreground/90 hover:bg-primary/10"}`}>
                  <span className="flex items-center gap-3"><Layers className="w-5 h-5" /> Chamados</span>
                  {openCount > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center rounded-full bg-primary text-background text-[11px] px-2 py-0.5 font-semibold">{openCount}</span>
                  )}
                </NavLink>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="admin" className="border-none">
            <AccordionTrigger className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Administração</AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-col gap-1 pb-2">
                <NavLink to="/perfil" className={({ isActive }) => `flex items-center gap-3 px-6 py-2 rounded transition cursor-pointer ${isActive ? "bg-primary/15 text-primary border-l-2 border-primary" : "text-foreground/90 hover:bg-primary/10"}`}><User className="w-5 h-5" /> Perfil</NavLink>
                <NavLink to="/configuracoes" className={({ isActive }) => `flex items-center gap-3 px-6 py-2 rounded transition cursor-pointer ${isActive ? "bg-primary/15 text-primary border-l-2 border-primary" : "text-foreground/90 hover:bg-primary/10"}`}><Settings className="w-5 h-5" /> Configurações</NavLink>
                {profile?.role === 'admin' && (
                  <>
                    <NavLink to="/fsas" className={({ isActive }) => `flex items-center gap-3 px-6 py-2 rounded transition cursor-pointer ${isActive ? "bg-primary/15 text-primary border-l-2 border-primary" : "text-foreground/90 hover:bg-primary/10"}`}><Layers className="w-5 h-5" /> FSAs</NavLink>
                    <NavLink to="/tecnicos" className={({ isActive }) => `flex items-center gap-3 px-6 py-2 rounded transition cursor-pointer ${isActive ? "bg-primary/15 text-primary border-l-2 border-primary" : "text-foreground/90 hover:bg-primary/10"}`}><User className="w-5 h-5" /> Técnicos</NavLink>
                  </>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        {user && (
          <div className="mt-auto px-4 pb-4 pt-4 border-t border-border">
            <div className="flex flex-col gap-2">
              <div className="px-4 py-2 text-xs text-muted-foreground truncate">
                {user.email}
              </div>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </Button>
            </div>
          </div>
        )}
      </nav>
    </aside>
  );
}
