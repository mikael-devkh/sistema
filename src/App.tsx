import React, { type ReactElement, Component, type ReactNode } from "react";
import { Toaster } from "./components/ui/toaster";
import { Toaster as Sonner } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const RatForm = React.lazy(() => import("./pages/RatForm"));
const NotFound = React.lazy(() => import("./pages/NotFound"));
const SupportCenter = React.lazy(() => import("./pages/SupportCenter"));
const LoginPage = React.lazy(() => import("./pages/LoginPage"));
const RegisterPage = React.lazy(() => import("./pages/RegisterPage"));
const ProfilePage = React.lazy(() => import("./pages/ProfilePage"));
const GeradorIPPage = React.lazy(() => import("./pages/GeradorIPPage"));
const BaseConhecimentoPage = React.lazy(() => import("./pages/BaseConhecimentoPage"));
const TemplatesRatPage = React.lazy(() => import("./pages/TemplatesRatPage"));
const AgendamentoPage = React.lazy(() => import("./pages/AgendamentoPage"));
const Loja360 = React.lazy(() => import("./pages/Loja360"));
const DiarioBordoPage = React.lazy(() => import("./pages/DiarioBordoPage"));
// Função helper para retry em caso de erro de carregamento (404, cache antigo, etc)
const lazyWithRetry = (componentImport: () => Promise<any>, retries = 2) => {
  return React.lazy(async () => {
    let lastError: any;
    
    for (let i = 0; i <= retries; i++) {
      try {
        const module = await componentImport();
        // Se chegou aqui, sucesso! Limpar flag de refresh
        if (i > 0) {
          sessionStorage.removeItem('pageRefreshed');
        }
        return module;
      } catch (error: any) {
        lastError = error;
        console.warn(`⚠️ Tentativa ${i + 1} de carregar módulo falhou:`, error);
        
        // Se é erro 404 ou erro de módulo, tentar recarregar a página
        if (i < retries && (error?.message?.includes('404') || error?.message?.includes('Failed to fetch') || error?.message?.includes('dynamically imported'))) {
          const pageAlreadyRefreshed = sessionStorage.getItem('pageRefreshed') === 'true';
          
          if (!pageAlreadyRefreshed && i === retries - 1) {
            // Última tentativa: recarregar a página
            console.log('🔄 Recarregando página para limpar cache...');
            sessionStorage.setItem('pageRefreshed', 'true');
            setTimeout(() => {
              window.location.reload();
            }, 100);
            // Aguardar um pouco antes de lançar o erro
            await new Promise(resolve => setTimeout(resolve, 500));
          } else {
            // Aguardar um pouco antes de tentar novamente
            await new Promise(resolve => setTimeout(resolve, 300 * (i + 1)));
          }
        } else {
          break;
        }
      }
    }
    
    throw lastError;
  });
};

const TechnicianRegisterPage = lazyWithRetry(() => import("./pages/TechnicianRegisterPage"));
const TechniciansManagementPage = lazyWithRetry(() => import("./pages/TechniciansManagementPage"));
const TechniciansMapPage = lazyWithRetry(() => import("./pages/TechniciansMapPage"));
const SeedPage = lazyWithRetry(() => import("./pages/SeedPage"));
const CatalogoServicosPage = lazyWithRetry(() => import("./pages/CatalogoServicosPage"));
const PagamentosPage = lazyWithRetry(() => import("./pages/PagamentosPage"));
const ChamadosPage = lazyWithRetry(() => import("./pages/ChamadosPage"));
const ValidacaoPage = lazyWithRetry(() => import("./pages/ValidacaoPage"));
const EstoquePage = lazyWithRetry(() => import("./pages/EstoquePage"));
const ReportsPage = lazyWithRetry(() => import("./pages/ReportsPage"));
const ConfigPage = lazyWithRetry(() => import("./pages/ConfigPage"));
import { RatAutofillProvider } from "./context/RatAutofillContext";
import { FocusModeProvider } from "./context/FocusModeContext";
import { useAuth } from "./context/AuthContext";
import { GlobalSearch } from "./components/GlobalSearch";
import { Loader2 } from "lucide-react";
import { AppLayout } from "./components/AppLayout";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutos
      // gcTime no v5, cacheTime no v4
      gcTime: 10 * 60 * 1000, // 10 minutos
      refetchOnWindowFocus: false,
      retry: 1,
      refetchOnMount: true, // Sempre refazer fetch ao montar componente
    },
  },
});

// Error Boundary para capturar erros de carregamento de módulos
class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('❌ Erro ao carregar módulo:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <div className="flex min-h-[60vh] items-center justify-center p-4">
          <div className="text-center max-w-md">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold mb-2">Erro ao carregar página</h2>
            <p className="text-muted-foreground mb-4 text-sm">
              Ocorreu um erro ao carregar esta página. Isso geralmente acontece quando há cache desatualizado.
            </p>
            <button
              onClick={() => {
                sessionStorage.removeItem('pageRefreshed');
                window.location.reload();
              }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition"
            >
              Recarregar Página
            </button>
            <details className="mt-4 text-left text-xs text-muted-foreground">
              <summary className="cursor-pointer">Detalhes do erro</summary>
              <pre className="mt-2 p-2 bg-muted rounded overflow-auto max-h-40">
                {this.state.error?.message || 'Erro desconhecido'}
              </pre>
            </details>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const ProtectedRoute = ({ children }: { children: ReactElement }) => {
  const { user, loadingAuth } = useAuth();

  if (loadingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-primary">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const ProtectedAdminRoute = ({ children }: { children: ReactElement }) => {
  const { user, loadingAuth, profile, loadingProfile } = useAuth();
  if (loadingAuth || loadingProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-primary">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  
  if (profile?.role !== 'admin') return <Navigate to="/" replace />;

  return children;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <FocusModeProvider>
        <RatAutofillProvider>
            <GlobalSearch />
            <ErrorBoundary>
            <Routes>
              <Route
                path="/"
                element={(
                  <ProtectedRoute>
                    <AppLayout>
                      <React.Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
                        <Dashboard />
                      </React.Suspense>
                    </AppLayout>
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/rat"
                element={(
                  <ProtectedRoute>
                    <AppLayout>
                      <React.Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
                        <RatForm />
                      </React.Suspense>
                    </AppLayout>
                  </ProtectedRoute>
                )}
              />
              <Route path="/login" element={<React.Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}><LoginPage /></React.Suspense>} />
              <Route path="/register" element={<React.Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}><RegisterPage /></React.Suspense>} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route
                path="/support"
                element={(
                  <ProtectedRoute>
                    <AppLayout>
                      <React.Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
                        <SupportCenter />
                      </React.Suspense>
                    </AppLayout>
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/profile"
                element={(
                  <ProtectedRoute>
                    <AppLayout>
                      <React.Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
                        <ProfilePage />
                      </React.Suspense>
                    </AppLayout>
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/perfil"
                element={(
                  <ProtectedRoute>
                    <AppLayout>
                      <React.Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
                        <ProfilePage />
                      </React.Suspense>
                    </AppLayout>
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/gerador-ip"
                element={(
                  <ProtectedRoute>
                    <AppLayout>
                      <React.Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
                        <GeradorIPPage />
                      </React.Suspense>
                    </AppLayout>
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/base-conhecimento"
                element={(
                  <ProtectedRoute>
                    <AppLayout>
                      <React.Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
                        <BaseConhecimentoPage />
                      </React.Suspense>
                    </AppLayout>
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/templates-rat"
                element={(
                  <ProtectedRoute>
                    <AppLayout>
                      <React.Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
                        <TemplatesRatPage />
                      </React.Suspense>
                    </AppLayout>
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/agendamento"
                element={(
                  <ProtectedRoute>
                    <AppLayout>
                      <React.Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
                        <AgendamentoPage />
                      </React.Suspense>
                    </AppLayout>
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/diario-bordo"
                element={(
                  <ProtectedRoute>
                    <AppLayout>
                      <React.Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
                        <DiarioBordoPage />
                      </React.Suspense>
                    </AppLayout>
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/loja/:lojaId"
                element={(
                  <ProtectedRoute>
                    <AppLayout>
                      <React.Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
                        <Loja360 />
                      </React.Suspense>
                    </AppLayout>
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/configuracoes"
                element={(
                  <ProtectedRoute>
                    <AppLayout>
                      <React.Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
                        <ConfigPage />
                      </React.Suspense>
                    </AppLayout>
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/cadastrar-tecnico"
                element={(
                  <ProtectedAdminRoute>
                    <AppLayout>
                      <ErrorBoundary>
                        <React.Suspense 
                          fallback={
                            <div className="flex min-h-[60vh] items-center justify-center">
                              <div className="text-center">
                                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                                <p className="text-sm text-muted-foreground">Carregando formulário de cadastro...</p>
                              </div>
                            </div>
                          }
                        >
                          <TechnicianRegisterPage />
                        </React.Suspense>
                      </ErrorBoundary>
                    </AppLayout>
                  </ProtectedAdminRoute>
                )}
              />
              <Route
                path="/tecnicos"
                element={(
                  <ProtectedAdminRoute>
                    <AppLayout>
                      <React.Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
                        <TechniciansManagementPage />
                      </React.Suspense>
                    </AppLayout>
                  </ProtectedAdminRoute>
                )}
              />
              <Route
                path="/tecnicos/mapa"
                element={(
                  <ProtectedRoute>
                    <AppLayout>
                      <React.Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
                        <TechniciansMapPage />
                      </React.Suspense>
                    </AppLayout>
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/seed"
                element={(
                  <ProtectedAdminRoute>
                    <AppLayout>
                      <React.Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
                        <SeedPage />
                      </React.Suspense>
                    </AppLayout>
                  </ProtectedAdminRoute>
                )}
              />
              <Route
                path="/catalogo-servicos"
                element={(
                  <ProtectedAdminRoute>
                    <AppLayout>
                      <React.Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
                        <CatalogoServicosPage />
                      </React.Suspense>
                    </AppLayout>
                  </ProtectedAdminRoute>
                )}
              />
              <Route
                path="/pagamentos"
                element={(
                  <ProtectedRoute>
                    <AppLayout>
                      <React.Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
                        <PagamentosPage />
                      </React.Suspense>
                    </AppLayout>
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/chamados"
                element={(
                  <ProtectedRoute>
                    <AppLayout>
                      <React.Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
                        <ChamadosPage />
                      </React.Suspense>
                    </AppLayout>
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/validacao"
                element={(
                  <ProtectedRoute>
                    <AppLayout>
                      <React.Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
                        <ValidacaoPage />
                      </React.Suspense>
                    </AppLayout>
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/estoque"
                element={(
                  <ProtectedRoute>
                    <AppLayout>
                      <React.Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
                        <EstoquePage />
                      </React.Suspense>
                    </AppLayout>
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/relatorios"
                element={(
                  <ProtectedRoute>
                    <AppLayout>
                      <React.Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
                        <ReportsPage />
                      </React.Suspense>
                    </AppLayout>
                  </ProtectedRoute>
                )}
              />
              <Route path="*" element={<React.Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}><NotFound /></React.Suspense>} />
            </Routes>
            </ErrorBoundary>
          </RatAutofillProvider>
        </FocusModeProvider>
        </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
