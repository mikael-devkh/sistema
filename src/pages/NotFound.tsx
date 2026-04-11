import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "../components/ui/button";
import { Home, ArrowLeft, SearchX } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 – rota inexistente:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center space-y-6 max-w-md">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <SearchX className="w-10 h-10 text-primary" />
          </div>
        </div>

        {/* Text */}
        <div className="space-y-2">
          <p className="text-7xl font-black text-primary/20 select-none">404</p>
          <h1 className="text-2xl font-bold tracking-tight -mt-4">Página não encontrada</h1>
          <p className="text-sm text-muted-foreground">
            A rota <code className="bg-secondary px-1.5 py-0.5 rounded text-xs font-mono">{location.pathname}</code> não existe.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Button>
          <Button onClick={() => navigate("/")} className="gap-2">
            <Home className="w-4 h-4" /> Início
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
