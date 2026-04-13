import { NavLink } from "react-router-dom";
import {
  Home,
  FileText,
  Network,
  CalendarClock,
  LayoutTemplate,
  BookOpen,
  CircleUser,
  Settings,
  UserCog,
  LogOut,
  Wrench,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

// ─── Estrutura de navegação ────────────────────────────────────────────────────

interface NavItemDef {
  to: string;
  icon: React.ElementType;
  label: string;
  adminOnly?: boolean;
}

interface NavGroupDef {
  label: string;
  items: NavItemDef[];
}

function buildGroups(isAdmin: boolean): NavGroupDef[] {
  return [
    {
      label: "Principal",
      items: [
        { to: "/",           icon: Home,          label: "Dashboard"     },
        { to: "/rat",        icon: FileText,      label: "Nova RAT"      },
        { to: "/gerador-ip", icon: Network,       label: "Gerador de IP" },
        { to: "/agendamento",icon: CalendarClock, label: "Agendamentos"  },
      ],
    },
    {
      label: "Recursos",
      items: [
        { to: "/templates-rat",     icon: LayoutTemplate, label: "Templates de RAT"     },
        { to: "/base-conhecimento", icon: BookOpen,       label: "Base de Conhecimento" },
      ],
    },
    {
      label: "Conta",
      items: [
        { to: "/perfil",        icon: CircleUser, label: "Perfil"        },
        { to: "/configuracoes", icon: Settings,   label: "Configurações" },
        ...(isAdmin
          ? [{ to: "/tecnicos", icon: UserCog, label: "Técnicos", adminOnly: true }]
          : []),
      ],
    },
  ];
}

// ─── NavItem ──────────────────────────────────────────────────────────────────

function NavItem({
  to,
  icon: Icon,
  label,
  collapsed,
}: NavItemDef & { collapsed: boolean }) {
  const link = (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        cn(
          "group/item relative flex items-center rounded-lg text-[13px] font-medium transition-all duration-150 select-none",
          !collapsed && "gap-2.5 px-3 h-9",
          collapsed && "h-9 w-9 justify-center mx-auto",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-foreground/60 hover:text-foreground hover:bg-secondary/60",
          isActive && !collapsed && "border-l-2 border-primary pl-[10px]",
        )
      }
    >
      <Icon className={cn("shrink-0 transition-colors", collapsed ? "w-[18px] h-[18px]" : "w-4 h-4")} />
      {!collapsed && <span className="flex-1 truncate leading-none">{label}</span>}
    </NavLink>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

// ─── NavGroup ─────────────────────────────────────────────────────────────────

function NavGroup({ label, items, collapsed }: NavGroupDef & { collapsed: boolean }) {
  if (collapsed) {
    return (
      <div className="space-y-0.5">
        <div className="mx-2 my-1.5 h-px bg-border/50" />
        {items.map(item => <NavItem key={item.to} {...item} collapsed />)}
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      <p className="px-3 pt-4 pb-1 text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/55 select-none">
        {label}
      </p>
      {items.map(item => <NavItem key={item.to} {...item} collapsed={false} />)}
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export interface SidebarProps {
  open: boolean;
  onToggle: () => void;
  collapsed: boolean;
}

export function Sidebar({ open, collapsed }: SidebarProps) {
  const { profile, user } = (() => {
    try { return useAuth(); }
    catch { return { profile: undefined as any, user: undefined }; }
  })();

  const isAdmin = profile?.role === "admin";
  const groups  = buildGroups(isAdmin);

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

  const initials  = user?.email ? user.email.slice(0, 2).toUpperCase() : "WT";
  const roleLabel = profile?.role === "admin" ? "Admin" : "Técnico";

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        style={{ width: collapsed ? "56px" : "240px" }}
        className={cn(
          "fixed md:sticky md:top-0 z-40 h-screen flex flex-col",
          "bg-card border-r border-border shrink-0",
          "transition-[width,transform] duration-300 ease-in-out",
          "overflow-hidden",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        {/* ── Brand ── */}
        <div className={cn(
          "flex items-center h-14 border-b border-border shrink-0",
          collapsed ? "justify-center px-0" : "px-4 gap-3",
        )}>
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0 shadow-sm">
            <Wrench className="w-[14px] h-[14px] text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0 overflow-hidden">
              <p className="text-sm font-bold leading-none tracking-tight truncate">WT Serviços</p>
              <p className="text-[10px] text-muted-foreground mt-[3px] font-medium">Field Service</p>
            </div>
          )}
        </div>

        {/* ── Navegação ── */}
        <nav className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden",
          collapsed ? "px-1.5 py-2" : "px-2 pb-4",
        )}>
          {groups.map(group => (
            <NavGroup key={group.label} {...group} collapsed={collapsed} />
          ))}
        </nav>

        {/* ── Rodapé do usuário ── */}
        {user && (
          <div className={cn(
            "shrink-0 border-t border-border",
            collapsed ? "px-1.5 py-2" : "px-3 py-3",
          )}>
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-9 h-9 rounded-full bg-primary/15 border border-primary/15 flex items-center justify-center text-xs font-bold text-primary cursor-default mx-auto">
                    {initials}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="space-y-0.5 text-left">
                  <p className="font-semibold text-sm leading-none">{user.email}</p>
                  <p className="text-xs text-muted-foreground">{roleLabel}</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <div className="flex items-center gap-2.5 group/footer">
                <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/15 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate leading-none">{user.email}</p>
                  <p className="text-[10px] text-muted-foreground mt-[3px]">{roleLabel}</p>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleLogout}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover/footer:opacity-100"
                    >
                      <LogOut className="w-[14px] h-[14px]" />
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
