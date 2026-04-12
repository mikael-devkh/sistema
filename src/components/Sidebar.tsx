import { NavLink } from "react-router-dom";
import {
  FileText,
  Settings,
  Home,
  CircleUser,
  BookOpen,
  Network,
  BarChart2,
  LayoutTemplate,
  LogOut,
  CalendarClock,
  Wrench,
  ChevronDown,
  PhoneCall,
  ClipboardList,
  Building2,
  UserCog,
  PanelLeft,
} from "lucide-react";
import { useServiceManager } from "../hooks/use-service-manager";
import { useAuth } from "../context/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { toast } from "sonner";
import { useState } from "react";
import { cn } from "../lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

// ─── Nav item ─────────────────────────────────────────────────────────────────

interface NavItemProps {
  to: string;
  icon: React.ElementType;
  label: string;
  badge?: number;
  collapsed?: boolean;
}

function NavItem({ to, icon: Icon, label, badge, collapsed }: NavItemProps) {
  const linkEl = (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        cn(
          "relative flex items-center rounded-lg text-sm transition-all duration-150",
          collapsed
            ? "h-9 w-9 justify-center mx-auto"
            : "gap-3 px-3 py-2",
          isActive
            ? cn(
                "bg-primary/12 text-primary font-semibold",
                !collapsed && "border-l-[2.5px] border-primary pl-[10px]",
              )
            : "text-foreground/65 hover:text-foreground hover:bg-secondary/70",
        )
      }
    >
      <Icon className={cn("shrink-0", collapsed ? "w-[18px] h-[18px]" : "w-4 h-4")} />
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
      {!collapsed && badge != null && badge > 0 && (
        <span className="inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold min-w-[18px] h-[18px] px-1 leading-none">
          {badge}
        </span>
      )}
      {collapsed && badge != null && badge > 0 && (
        <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-primary ring-2 ring-card" />
      )}
    </NavLink>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
        <TooltipContent side="right" className="flex items-center gap-2">
          {label}
          {badge != null && badge > 0 && (
            <span className="text-[10px] font-semibold text-primary ml-0.5">({badge})</span>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }

  return linkEl;
}

// ─── Nav section ──────────────────────────────────────────────────────────────

interface NavSectionProps {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  collapsed?: boolean;
}

function NavSection({ label, children, defaultOpen = true, collapsed }: NavSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  if (collapsed) {
    return (
      <div className="space-y-0.5 py-2 border-t border-border/60 first:border-t-0 first:pt-0">
        {children}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground/80 hover:text-foreground transition-colors"
      >
        {label}
        <ChevronDown
          className={cn(
            "w-3 h-3 transition-transform duration-200",
            open ? "" : "-rotate-90",
          )}
        />
      </button>
      {open && <div className="mt-0.5 space-y-0.5">{children}</div>}
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export interface SidebarProps {
  open: boolean;
  onToggle: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ open, onToggle, collapsed, onToggleCollapse }: SidebarProps) {
  let openCount = 0;
  try {
    const { activeCalls } = useServiceManager();
    openCount = activeCalls.filter(c => c.status === "open").length;
  } catch {}

  const { profile, user } = (() => {
    try { return useAuth(); }
    catch { return { profile: undefined as any, user: undefined }; }
  })();

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

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : "WT";

  return (
    <TooltipProvider delayDuration={250}>
      <aside
        style={{ width: collapsed ? "56px" : "256px" }}
        className={cn(
          "fixed md:sticky md:top-0 z-40 h-screen flex flex-col bg-card border-r border-border",
          "transition-[width,transform] duration-300 ease-in-out overflow-hidden shrink-0",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        {/* Brand */}
        <div
          className={cn(
            "flex items-center h-14 border-b border-border shrink-0 gap-2.5",
            collapsed ? "justify-center px-2" : "px-4",
          )}
        >
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0 shadow-sm">
            <Wrench className="w-[15px] h-[15px] text-primary-foreground" />
          </div>

          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold leading-none tracking-tight">WT Serviços</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">Field Service</p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onToggleCollapse}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
                  >
                    <PanelLeft className="w-[15px] h-[15px]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Recolher menu</TooltipContent>
              </Tooltip>
            </>
          )}
        </div>

        {/* Nav */}
        <nav
          className={cn(
            "flex-1 overflow-y-auto overflow-x-hidden py-3",
            collapsed ? "px-1.5 space-y-0" : "px-3 space-y-3",
          )}
        >
          {collapsed ? (
            <>
              <NavSection label="Operação" collapsed>
                <NavItem to="/" icon={Home} label="Dashboard" collapsed />
                <NavItem to="/rat" icon={FileText} label="Nova RAT" collapsed />
                <NavItem to="/gerador-ip" icon={Network} label="Gerador de IP" collapsed />
                <NavItem to="/minha-fila" icon={ClipboardList} label="Minha Fila" collapsed />
              </NavSection>

              <NavSection label="Atendimento" collapsed>
                <NavItem to="/service-manager" icon={PhoneCall} label="Chamados" badge={openCount} collapsed />
                <NavItem to="/agendamento" icon={CalendarClock} label="Agendamentos" collapsed />
              </NavSection>

              <NavSection label="Relatórios" collapsed>
                <NavItem to="/reports" icon={BarChart2} label="Histórico" collapsed />
              </NavSection>

              <NavSection label="Conhecimento" collapsed>
                <NavItem to="/templates-rat" icon={LayoutTemplate} label="Templates de RAT" collapsed />
                <NavItem to="/base-conhecimento" icon={BookOpen} label="Base de Conhecimento" collapsed />
              </NavSection>

              <NavSection label="Admin" collapsed>
                <NavItem to="/perfil" icon={CircleUser} label="Perfil" collapsed />
                <NavItem to="/configuracoes" icon={Settings} label="Configurações" collapsed />
                {profile?.role === "admin" && (
                  <>
                    <NavItem to="/fsas" icon={Building2} label="FSAs" collapsed />
                    <NavItem to="/tecnicos" icon={UserCog} label="Técnicos" collapsed />
                  </>
                )}
              </NavSection>
            </>
          ) : (
            <>
              <NavSection label="Operação">
                <NavItem to="/" icon={Home} label="Dashboard" />
                <NavItem to="/rat" icon={FileText} label="Nova RAT" />
                <NavItem to="/gerador-ip" icon={Network} label="Gerador de IP" />
                <NavItem to="/minha-fila" icon={ClipboardList} label="Minha Fila" />
              </NavSection>

              <NavSection label="Atendimento">
                <NavItem to="/service-manager" icon={PhoneCall} label="Chamados" badge={openCount} />
                <NavItem to="/agendamento" icon={CalendarClock} label="Agendamentos" />
              </NavSection>

              <NavSection label="Relatórios">
                <NavItem to="/reports" icon={BarChart2} label="Histórico" />
              </NavSection>

              <NavSection label="Conhecimento">
                <NavItem to="/templates-rat" icon={LayoutTemplate} label="Templates de RAT" />
                <NavItem to="/base-conhecimento" icon={BookOpen} label="Base de Conhecimento" />
              </NavSection>

              <NavSection label="Administração">
                <NavItem to="/perfil" icon={CircleUser} label="Perfil" />
                <NavItem to="/configuracoes" icon={Settings} label="Configurações" />
                {profile?.role === "admin" && (
                  <>
                    <NavItem to="/fsas" icon={Building2} label="FSAs" />
                    <NavItem to="/tecnicos" icon={UserCog} label="Técnicos" />
                  </>
                )}
              </NavSection>
            </>
          )}
        </nav>

        {/* Expand button (only when collapsed) */}
        {collapsed && (
          <div className="shrink-0 border-t border-border px-1.5 py-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggleCollapse}
                  className="w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary flex items-center justify-center mx-auto transition-colors"
                >
                  <PanelLeft className="w-[15px] h-[15px] rotate-180" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Expandir menu</TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* User footer */}
        {user && (
          <div
            className={cn(
              "shrink-0 border-t border-border",
              collapsed ? "px-1.5 py-2" : "px-3 py-3",
            )}
          >
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary cursor-default mx-auto ring-2 ring-primary/10">
                    {initials}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="space-y-0.5">
                  <p className="font-medium text-sm">{user.email}</p>
                  <p className="text-xs text-muted-foreground capitalize">{profile?.role ?? "usuário"}</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary shrink-0 ring-2 ring-primary/10">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{user.email}</p>
                  <p className="text-[10px] text-muted-foreground capitalize mt-0.5">{profile?.role ?? "usuário"}</p>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleLogout}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <LogOut className="w-[15px] h-[15px]" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Sair</TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>
        )}
      </aside>
    </TooltipProvider>
  );
}
