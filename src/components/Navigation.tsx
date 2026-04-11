import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  BarChart3,
  DollarSign,
  FileText,
  Menu,
  Network,
  NotebookPen,
  UserCircle2,
} from "lucide-react";
import { cn } from "../lib/utils";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "./ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTrigger,
} from "./ui/sheet";
import { useAuth } from "../context/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { toast } from "sonner";

export const Navigation = () => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();
  const navItems = [
    {
      path: "/",
      label: "Gerador de IP",
      icon: Network,
    },
    {
      path: "/rat",
      label: "RAT",
      icon: FileText,
    },
    {
      path: "/support",
      label: "KB/RAT Pré-pronta",
      icon: NotebookPen,
    },
    {
      path: "/service-manager",
      label: "Chamados/Mídia",
      icon: DollarSign,
    },
    {
      path: "/profile",
      label: "Perfil",
      icon: UserCircle2,
    },
    {
      path: "/reports",
      label: "Relatórios",
      icon: BarChart3,
    },
  ];

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success("Sessão encerrada com sucesso.");
    } catch (error) {
      console.error("Erro ao sair da conta:", error);
      toast.error("Não foi possível encerrar a sessão.");
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 bg-card/90 backdrop-blur-sm border-b border-border z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="flex items-center gap-2 rounded-lg px-2 py-1 transition hover:bg-secondary/60"
              aria-label="Ir para a página inicial"
            >
              <span className="text-lg font-semibold tracking-tight text-primary md:text-xl">
                WT Tecnologia
              </span>
            </Link>
            <div className="hidden md:flex items-center gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg transition-all",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </div>
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden h-10 w-10"
                  aria-label="Abrir menu de navegação"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-full sm:max-w-xs p-6 space-y-6">
                <div className="flex flex-col items-center gap-3">
                  <Link
                    to="/"
                    onClick={() => setIsOpen(false)}
                    className="rounded-full bg-secondary/70 px-5 py-3 text-lg font-semibold tracking-tight text-primary"
                  >
                    WT Tecnologia
                  </Link>
                  <p className="text-base font-semibold text-foreground">WT Tecnologia</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-muted-foreground">
                    Navegação
                  </p>
                  <div className="flex flex-col gap-2">
                    {navItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = location.pathname === item.path;

                      return (
                        <SheetClose asChild key={item.path}>
                          <Link
                            to={item.path}
                            onClick={() => setIsOpen(false)}
                            className={cn(
                              "flex items-center gap-3 rounded-lg px-3 py-2 text-base font-medium transition",
                              isActive
                                ? "bg-primary text-primary-foreground shadow"
                                : "text-foreground hover:bg-secondary"
                            )}
                          >
                            <Icon className="h-5 w-5" />
                            {item.label}
                          </Link>
                        </SheetClose>
                      );
                    })}
                  </div>
                </div>
                <div className="border-t border-border pt-4">
                  <p className="text-sm font-semibold text-muted-foreground mb-3">
                    Preferências
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Tema</span>
                    <ThemeToggle />
                  </div>
                  {user && (
                    <div className="mt-4">
                      <SheetClose asChild>
                        <Button variant="outline" className="w-full" onClick={handleLogout}>
                          Sair
                        </Button>
                      </SheetClose>
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
          <div className="hidden md:flex items-center space-x-2">
            {user && (
              <span className="text-sm font-medium text-muted-foreground">
                {user.email}
              </span>
            )}
            <ThemeToggle />
            {user && (
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Sair
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
