import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { FileText, BookText, UserCog, Paintbrush, Zap, Link as LinkIcon, Users, Shield, Loader2, MoreVertical, Search } from "lucide-react";
import { Card } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { Skeleton } from "../components/ui/skeleton";
import { Badge } from "../components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../components/ui/dropdown-menu";
import { usePageLoading } from "../hooks/use-page-loading";
import { loadPreferences, savePreferences, type UserPreferences } from "../utils/settings";
import { useAuth } from "../context/AuthContext";
import { collection, doc, getDocs, setDoc, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";
import { toast } from "sonner";
import type { Role } from "../lib/permissions";

const ProfilePage = React.lazy(() => import("./ProfilePage"));

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface SystemUser {
  uid: string;
  nome?: string;
  email?: string;
  role: Role;
  ativo: boolean;
  createdAt?: number;
}

// ─── Role helpers ─────────────────────────────────────────────────────────────

const ROLES: Role[] = ['admin', 'operador', 'financeiro', 'visualizador'];

const ROLE_LABEL: Record<Role, string> = {
  admin:       'Administrador',
  operador:    'Operador',
  financeiro:  'Financeiro',
  tecnico:     'Técnico',
  visualizador:'Visualizador',
};

const ROLE_COLOR: Record<Role, string> = {
  admin:        'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  operador:     'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  financeiro:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  tecnico:      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  visualizador: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
};

// ─── UsersTab ─────────────────────────────────────────────────────────────────

function UsersTab({ currentUid }: { currentUid: string }) {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, 'users'), orderBy('email')));
        const list: SystemUser[] = snap.docs.map(d => {
          const data = d.data();
          return {
            uid: d.id,
            nome: typeof data.nome === 'string' ? data.nome : undefined,
            email: typeof data.email === 'string' ? data.email : undefined,
            role: (['admin','operador','financeiro','tecnico','visualizador'] as Role[]).includes(data.role)
              ? data.role as Role
              : 'visualizador',
            ativo: data.ativo !== false,
            createdAt: typeof data.createdAt?.toMillis === 'function' ? data.createdAt.toMillis() : undefined,
          };
        });
        setUsers(list);
      } catch {
        toast.error('Erro ao carregar usuários.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleRoleChange = async (uid: string, role: Role) => {
    setSaving(uid);
    try {
      await setDoc(doc(db, 'users', uid), { role }, { merge: true });
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, role } : u));
      toast.success('Perfil atualizado.');
    } catch {
      toast.error('Erro ao atualizar perfil.');
    } finally {
      setSaving(null);
    }
  };

  const handleToggleAtivo = async (uid: string, ativo: boolean) => {
    setSaving(uid);
    try {
      await setDoc(doc(db, 'users', uid), { ativo }, { merge: true });
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, ativo } : u));
      toast.success(ativo ? 'Usuário ativado.' : 'Usuário desativado.');
    } catch {
      toast.error('Erro ao atualizar usuário.');
    } finally {
      setSaving(null);
    }
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return !q || (u.nome?.toLowerCase().includes(q) ?? false) || (u.email?.toLowerCase().includes(q) ?? false);
  });

  if (loading) {
    return (
      <div className="space-y-2 py-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4 py-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou e-mail…"
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <span className="text-sm text-muted-foreground whitespace-nowrap">{filtered.length} usuário{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Usuário</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">E-mail</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Perfil</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Status</th>
              <th className="px-4 py-2.5 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-muted-foreground py-8">Nenhum usuário encontrado.</td>
              </tr>
            )}
            {filtered.map(u => (
              <tr key={u.uid} className={`hover:bg-muted/30 transition-colors ${!u.ativo ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3">
                  <div className="font-medium">{u.nome || '—'}</div>
                  <div className="text-xs text-muted-foreground sm:hidden">{u.email}</div>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{u.email || '—'}</td>
                <td className="px-4 py-3">
                  {u.uid === currentUid ? (
                    <Badge className={`text-xs ${ROLE_COLOR[u.role]}`}>{ROLE_LABEL[u.role]}</Badge>
                  ) : (
                    <Select
                      value={u.role}
                      onValueChange={val => handleRoleChange(u.uid, val as Role)}
                      disabled={saving === u.uid}
                    >
                      <SelectTrigger className="h-7 text-xs w-36 border-0 bg-transparent p-0 focus:ring-0 focus:ring-offset-0">
                        <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_COLOR[u.role]}`}>
                          {saving === u.uid ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                          {ROLE_LABEL[u.role]}
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map(r => (
                          <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className={`text-xs font-medium ${u.ativo ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {u.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {u.uid !== currentUid && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {u.ativo
                          ? <DropdownMenuItem onClick={() => handleToggleAtivo(u.uid, false)}>Desativar acesso</DropdownMenuItem>
                          : <DropdownMenuItem onClick={() => handleToggleAtivo(u.uid, true)}>Reativar acesso</DropdownMenuItem>
                        }
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground px-1">
        Novos usuários fazem login com e-mail/senha — o perfil padrão é <strong>Visualizador</strong>. Altere o perfil aqui para liberar acesso.
      </p>
    </div>
  );
}

// ─── ConfigPage ────────────────────────────────────────────────────────────────

export default function ConfigPage() {
  const navigate = useNavigate();
  const loading = usePageLoading(400, []);
  const { user, profile, updateProfileLocally } = useAuth();

  const isAdmin = profile?.role === 'admin';

  const prefs = loadPreferences();
  const [pdfFont, setPdfFont] = useState<string>(prefs.pdfSolutionFont || "auto");
  const [defaultTemplateKey, setDefaultTemplateKey] = useState<string>(prefs.defaultTemplateKey || "none");
  const [palette, setPalette] = useState<string>(prefs.palette || "wt");
  const [reduceMotion, setReduceMotion] = useState<boolean>(!!prefs.reduceMotion);
  const [webhookUrl, setWebhookUrl] = useState<string>(profile?.webhookUrl || "");
  const [externalApiKey, setExternalApiKey] = useState<string>(profile?.externalApiKey || "");

  const handleSavePrefs = async () => {
    const next: UserPreferences = { pdfSolutionFont: pdfFont as any, defaultTemplateKey, palette, reduceMotion };
    savePreferences(next);

    if (user) {
      try {
        await setDoc(doc(db, "users", user.uid), { webhookUrl, externalApiKey }, { merge: true });
        updateProfileLocally(profile ? { ...profile, webhookUrl, externalApiKey } : null);
      } catch {
        toast.error("Erro ao salvar integrações. Tente novamente.");
        return;
      }
    }

    toast.success("Preferências salvas.");
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-page-in">
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
        <TabsList className={`flex gap-3 ${isAdmin ? 'flex-wrap' : ''}`}>
          <TabsTrigger value="perfil" className="flex items-center gap-2">
            <UserCog className="w-4 h-4" /> Minha Conta
          </TabsTrigger>
          <TabsTrigger value="personalizar" className="flex items-center gap-2">
            <Paintbrush className="w-4 h-4" /> Personalizar
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="usuarios" className="flex items-center gap-2">
              <Users className="w-4 h-4" /> Usuários
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="perfil">
          <React.Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
            <ProfilePage />
          </React.Suspense>
        </TabsContent>

        <TabsContent value="personalizar">
          <div className="space-y-6 py-2">
            <div className="flex flex-col sm:flex-row gap-4">
              <Button type="button" variant="secondary" className="gap-2 flex-1 text-base py-6" onClick={() => navigate("/templates-rat")}>
                <FileText className="w-6 h-6" /> Editar Templates de RATs
              </Button>
              <Button type="button" variant="secondary" className="gap-2 flex-1 text-base py-6" onClick={() => navigate("/base-conhecimento")}>
                <BookText className="w-6 h-6" /> Gerenciar Base de Conhecimento
              </Button>
            </div>
            <p className="text-muted-foreground text-sm mx-2">
              Use estes atalhos para personalizar os textos e conteúdos do programa para todo o time.
              O que for salvo nestes módulos NÃO altera formulários já enviados.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-primary font-semibold"><Paintbrush className="h-5 w-5" /> Preferências de PDF</div>
                {loading ? (
                  <><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /></>
                ) : (
                  <>
                    <div className="space-y-1">
                      <Label>Tamanho da fonte (Solução)</Label>
                      <Select value={pdfFont} onValueChange={setPdfFont}>
                        <SelectTrigger><SelectValue placeholder="Auto" /></SelectTrigger>
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
                        <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
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
                  <><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-24" /></>
                ) : (
                  <>
                    <div className="space-y-1">
                      <Label>Paleta</Label>
                      <Select value={palette} onValueChange={setPalette}>
                        <SelectTrigger><SelectValue placeholder="WT" /></SelectTrigger>
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
                  <><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /></>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Webhook de recebimento de RAT</Label>
                      <Input placeholder="https://exemplo.com/webhook" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label>Chave API externa</Label>
                      <Input type="password" placeholder="Insira a chave" value={externalApiKey} onChange={(e) => setExternalApiKey(e.target.value)} />
                    </div>
                  </div>
                )}
              </Card>

              <div className="flex justify-end sm:col-span-2">
                <Button type="button" onClick={handleSavePrefs} className="gap-2">Salvar preferências</Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="usuarios">
            <UsersTab currentUid={user?.uid ?? ''} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
