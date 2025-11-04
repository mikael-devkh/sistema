import React, { type ReactElement } from "react";
import { Toaster } from "./components/ui/toaster";
import { Toaster as Sonner } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
const RatForm = React.lazy(() => import("./pages/RatForm"));
const NotFound = React.lazy(() => import("./pages/NotFound"));
const SupportCenter = React.lazy(() => import("./pages/SupportCenter"));
const ServiceManager = React.lazy(() => import("./pages/ServiceManager"));
const LoginPage = React.lazy(() => import("./pages/LoginPage"));
const RegisterPage = React.lazy(() => import("./pages/RegisterPage"));
const ProfilePage = React.lazy(() => import("./pages/ProfilePage"));
const ReportsPage = React.lazy(() => import("./pages/ReportsPage"));
const GeradorIPPage = React.lazy(() => import("./pages/GeradorIPPage"));
const BaseConhecimentoPage = React.lazy(() => import("./pages/BaseConhecimentoPage"));
const TemplatesRatPage = React.lazy(() => import("./pages/TemplatesRatPage"));
const MyQueue = React.lazy(() => import("./pages/MyQueue"));
const FsasKanban = React.lazy(() => import("./pages/FsasKanban"));
const Loja360 = React.lazy(() => import("./pages/Loja360"));
import { ServiceManagerProvider } from "./hooks/use-service-manager";
import { RatAutofillProvider } from "./context/RatAutofillContext";
import { useAuth } from "./context/AuthContext";
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

const queryClient = new QueryClient();

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
  const { user, loadingAuth, profile } = useAuth();
  if (loadingAuth) {
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
    <div className="max-w-3xl mx-auto py-8 px-2">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6 ">Configurações</h1>
      <Tabs defaultValue="perfil" className="w-full">
        <TabsList className="mb-6 flex gap-3">
          <TabsTrigger value="perfil" className="flex items-center gap-2"><UserCog className="w-5 h-5" />Minha Conta</TabsTrigger>
          <TabsTrigger value="personalizar" className="flex items-center gap-2"><FileText className="w-5 h-5" />Personalizar</TabsTrigger>
        </TabsList>
        <TabsContent value="perfil">
          <ProfilePage />
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
        <ServiceManagerProvider>
          <RatAutofillProvider>
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
                path="/service-manager"
                element={(
                  <ProtectedRoute>
                    <AppLayout>
                      <React.Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
                        <ServiceManager />
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
                path="/reports"
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
                path="/minha-fila"
                element={(
                  <ProtectedRoute>
                    <AppLayout>
                      <React.Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
                        <MyQueue />
                      </React.Suspense>
                    </AppLayout>
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/fsas"
                element={(
                  <ProtectedAdminRoute>
                    <AppLayout>
                      <React.Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
                        <FsasKanban />
                      </React.Suspense>
                    </AppLayout>
                  </ProtectedAdminRoute>
                )}
              />
              <Route
                path="/loja/:fsaId"
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
                      <ConfigPage />
                    </AppLayout>
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/historico"
                element={(
                  <ProtectedRoute>
                    <AppLayout>
                      <ReportsPage />
                    </AppLayout>
                  </ProtectedRoute>
                )}
              />
              <Route path="*" element={<React.Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}><NotFound /></React.Suspense>} />
            </Routes>
          </RatAutofillProvider>
        </ServiceManagerProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
