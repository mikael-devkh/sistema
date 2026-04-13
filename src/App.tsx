import React, { type ReactElement, Component, type ReactNode } from "react";
import { Toaster } from "./components/ui/toaster";
import { Toaster as Sonner } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
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
import { RatAutofillProvider } from "./context/RatAutofillContext";
import { useAuth } from "./context/AuthContext";
import { GlobalSearch } from "./components/GlobalSearch";
import { Loader2 } from "lucide-react";
import { AppLayout } from "./components/AppLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/ui/tabs";
import { Button } from "./components/ui/button";
import { FileText, BookText, UserCog, Paintbrush, Zap, Link as LinkIcon } from "lucide-react";
import { Card } from "./components/ui/card";
import { Label } from "./components/ui/label";
import { Input } from "./components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./components/ui/select";
import { Switch } from "./components/ui/switch";
import { Skeleton } from "./components/ui/skeleton";
import { usePageLoading } from "./hooks/use-page-loading";
import { loadPreferences, savePreferences, type UserPreferences } from "./utils/settings";
import { toast } from "sonner";

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

const ConfigPage = () => {
  const navigate = useNavigate();
  const loading = usePageLoading(400, []);
  const prefs = loadPreferences();
  const [pdfFont, setPdfFont] = React.useState<string>(prefs.pdfSolutionFont || "auto");
  const [defaultTemplateKey, setDefaultTemplateKey] = React.useState<string>(prefs.defaultTemplateKey || "none");
  const [palette, setPalette] = React.useState<string>(prefs.palette || "wt");
  const [reduceMotion, setReduceMotion] = React.useState<boolean>(!!prefs.reduceMotion);
  const [webhookUrl, setWebhookUrl] = React.useState<string>(prefs.webhookUrl || "");
  const [externalApiKey, setExternalApiKey] = React.useState<string>(prefs.externalApiKey || "");

  const handleSavePrefs = () => {
    const next: UserPreferences = {
      pdfSolutionFont: pdfFont as any,
      defaultTemplateKey,
      palette,
      reduceMotion,
      webhookUrl,
      externalApiKey,
    };
    savePreferences(next);
    toast.success("Preferências salvas.");
  };
  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-page-in">
      {/* Header */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-primary via-primary/70 to-primary/30" />
        <div className="flex items-center gap-4 px-6 py-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <UserCog className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Configurações</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Preferências, aparência e integrações</p>
          </div>
        </div>
      </div>
      <Tabs defaultValue="perfil" className="w-full">
        <TabsList className="flex gap-3">
          <TabsTrigger value="perfil" className="flex items-center gap-2"><UserCog className="w-5 h-5" />Minha Conta</TabsTrigger>
          <TabsTrigger value="personalizar" className="flex items-center gap-2"><FileText className="w-5 h-5" />Personalizar</TabsTrigger>
        </TabsList>
        <TabsContent value="perfil">
          <React.Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
            <ProfilePage />
          </React.Suspense>
        </TabsContent>
        <TabsContent value="personalizar">
          <div className="space-y-6 py-2">
            <div className="flex flex-col sm:flex-row gap-4">
              <Button type="button" variant="secondary" className="gap-2 flex-1 text-base py-6" onClick={() => navigate("/templates-rat") }><FileText className="w-6 h-6" /> Editar Templates de RATs</Button>
              <Button type="button" variant="secondary" className="gap-2 flex-1 text-base py-6" onClick={() => navigate("/base-conhecimento") }><BookText className="w-6 h-6" /> Gerenciar Base de Conhecimento</Button>
            </div>
            <p className="text-muted-foreground text-sm mx-2">Use estes atalhos para personalizar os textos e conteúdos do programa para todo o time. O que for salvo nestes módulos NÃO altera formulários já enviados.</p>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-primary font-semibold"><Paintbrush className="h-5 w-5" /> Preferências de PDF</div>
                {loading ? (
                  <>
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-9 w-full" />
                  </>
                ) : (
                  <>
                    <div className="space-y-1">
                      <Label>Tamanho da fonte (Solução)</Label>
                      <Select value={pdfFont} onValueChange={setPdfFont}>
                        <SelectTrigger>
                          <SelectValue placeholder="Auto" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Automático</SelectItem>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="9">9</SelectItem>
                          <SelectItem value="8">8</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Template padrão</Label>
                      <Select value={defaultTemplateKey} onValueChange={setDefaultTemplateKey}>
                        <SelectTrigger>
                          <SelectValue placeholder="Nenhum" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          <SelectItem value="cpu">CPU - Operacional</SelectItem>
                          <SelectItem value="zebra">Impressora Zebra</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </Card>

              <Card className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-primary font-semibold"><Zap className="h-5 w-5" /> Aparência</div>
                {loading ? (
                  <>
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-9 w-24" />
                  </>
                ) : (
                  <>
                    <div className="space-y-1">
                      <Label>Paleta</Label>
                      <Select value={palette} onValueChange={setPalette}>
                        <SelectTrigger>
                          <SelectValue placeholder="WT" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="wt">WT</SelectItem>
                          <SelectItem value="azul">Azul</SelectItem>
                          <SelectItem value="escuro">Escuro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Reduzir animações</Label>
                      <Switch checked={reduceMotion} onCheckedChange={setReduceMotion} />
                    </div>
                  </>
                )}
              </Card>

              <Card className="p-4 space-y-3 sm:col-span-2">
                <div className="flex items-center gap-2 text-primary font-semibold"><LinkIcon className="h-5 w-5" /> Integrações</div>
                {loading ? (
                  <>
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-9 w-full" />
                  </>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Webhook de recebimento de RAT</Label>
                      <Input placeholder="https://exemplo.com/webhook" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label>Chave API externa</Label>
                      <Input placeholder="Insira a chave" value={externalApiKey} onChange={(e) => setExternalApiKey(e.target.value)} />
                    </div>
                  </div>
                )}
              </Card>
              <div className="flex justify-end">
                <Button type="button" onClick={handleSavePrefs} className="gap-2">Salvar preferências</Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <RatAutofillProvider>
            <GlobalSearch />
            <Routes>
              <Route
                path="/"
                element={(
                  <ProtectedRoute>
                    <AppLayout>
                      <Dashboard />
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
                path="/configuracoes"
                element={(
                  <ProtectedRoute>
                    <AppLayout>
                      <ConfigPage />
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
              <Route path="*" element={<React.Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}><NotFound /></React.Suspense>} />
            </Routes>
          </RatAutofillProvider>
        </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
