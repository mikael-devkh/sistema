import { NavLink } from "react-router-dom";
import {
  FileText,
  Settings,
  Home,
  Layers,
  User,
  BookOpen,
  Network,
  BarChart2,
  LayoutTemplate,
  LogOut,
  CalendarClock,
  Wrench,
  ChevronDown,
} from "lucide-react";
import { useServiceManager } from "../hooks/use-service-manager";
import { useAuth } from "../context/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { toast } from "sonner";
import { useState } from "react";
import { cn } from "../lib/utils";

// ─── Nav item ────────────────────────────────────────────────────────────────

function NavItem({
  to,
  icon: Icon,
  label,
  badge,
}: {
  to: string;
  icon: React.ElementType;
  label: string;
  badge?: number;
}) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150",
          isActive
            ? "bg-primary/15 text-primary font-medium border-l-2 border-primary pl-[10px]"
            : "text-foreground/70 hover:text-foreground hover:bg-secondary/80",
        )
      }
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {badge != null && badge > 0 && (
        <span className="inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-semibold min-w-[18px] h-[18px] px-1">
          {badge}
        </span>
      )}
    </NavLink>
  );
}

// ─── Nav section ──────────────────────────────────────────────────────────────

function NavSection({
  label,
  children,
  defaultOpen = true,
}: {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
      >
        {label}
        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", open ? "" : "-rotate-90")} />
      </button>
      {open && <div className="mt-0.5 space-y-0.5">{children}</div>}
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar({ open, onToggle }: { open: boolean; onToggle: () => void }) {
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

  // User initials
  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : "WT";

  return (
    <aside
      className={cn(
        "fixed md:sticky md:top-0 z-40 h-screen w-64 flex flex-col bg-card border-r border-border transition-transform duration-300",
        open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
      )}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 h-14 border-b border-border shrink-0">
        <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <Wrench className="w-4 h-4 text-primary-foreground" />
        </div>
        <div>
          <p className="text-sm font-bold leading-none">WT Serviços</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Field Service</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        <NavSection label="Operação">
          <NavItem to="/" icon={Home} label="Dashboard" />
          <NavItem to="/rat" icon={FileText} label="Nova RAT" />
          <NavItem to="/gerador-ip" icon={Network} label="Gerador de IP" />
          <NavItem to="/minha-fila" icon={Layers} label="Minha Fila" />
        </NavSection>

        <NavSection label="Atendimento">
          <NavItem to="/service-manager" icon={Layers} label="Chamados" badge={openCount} />
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
          <NavItem to="/perfil" icon={User} label="Perfil" />
          <NavItem to="/configuracoes" icon={Settings} label="Configurações" />
          {profile?.role === "admin" && (
            <>
              <NavItem to="/fsas" icon={Layers} label="FSAs" />
              <NavItem to="/tecnicos" icon={User} label="Técnicos" />
            </>
          )}
        </NavSection>
      </nav>

      {/* User footer */}
      {user && (
        <div className="shrink-0 border-t border-border px-3 py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{user.email}</p>
              <p className="text-[10px] text-muted-foreground capitalize">{profile?.role ?? "usuário"}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Sair"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
