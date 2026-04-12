import { FormEvent, useEffect, useState, ChangeEvent } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { Loader2, UserCog, Image as ImageIcon, X, ShieldCheck, Mail, Hash } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "next-themes";
import { db } from "../firebase";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { toast } from "sonner";
import { Skeleton } from "../components/ui/skeleton";
import { usePageLoading } from "../hooks/use-page-loading";
import { ThemeToggle } from "../components/ThemeToggle";
import { cn } from "../lib/utils";

const ProfilePage = () => {
  const { user, profile, loadingAuth, loadingProfile, refreshProfile, updateProfileLocally } = useAuth();
  const { resolvedTheme } = useTheme();
  const [nome, setNome] = useState("");
  const [matricula, setMatricula] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setNome(profile.nome ?? "");
      setMatricula(profile.matricula ?? "");
      setAvatarUrl(profile.avatarUrl);
    }
  }, [profile]);

  const loadingUi = usePageLoading(400, [loadingProfile, profile]);

  if (loadingAuth) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const handleAvatarUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo: 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatarUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => setAvatarUrl(undefined);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);
    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          email: user.email ?? "",
          nome: nome.trim(),
          matricula: matricula.trim(),
          updatedAt: serverTimestamp(),
          avatarUrl: avatarUrl ?? "",
        },
        { merge: true },
      );
      updateProfileLocally({ nome: nome.trim(), matricula: matricula.trim(), avatarUrl });
      toast.success("Perfil salvo! Suas RATs usarão estes dados automaticamente.");
      await refreshProfile();
    } catch {
      toast.error("Não foi possível salvar o perfil. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  const initials =
    (nome || user.email || "U")
      .split(" ")
      .slice(0, 2)
      .map(s => s[0]?.toUpperCase() ?? "")
      .join("") || "U";

  const roleLabel = profile?.role === "admin" ? "Administrador" : "Técnico";

  return (
    <div className="max-w-2xl mx-auto py-6 space-y-5 pb-10 animate-page-in">

      {/* ── Card de identidade ── */}
      <Card className="shadow-card overflow-hidden">
        {/* Faixa de acento */}
        <div className="h-1 w-full bg-gradient-to-r from-primary/50 via-primary to-primary/40" />

        <div className="p-6 flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar */}
          <div className="relative shrink-0">
            {loadingUi ? (
              <Skeleton className="h-24 w-24 rounded-full" />
            ) : avatarUrl ? (
              <>
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="rounded-full h-24 w-24 object-cover border-2 border-primary/20 shadow-md"
                />
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  title="Remover foto"
                  className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-md hover:brightness-110 transition"
                >
                  <X className="w-3 h-3" />
                </button>
              </>
            ) : (
              <div className="h-24 w-24 rounded-full bg-primary/15 border-2 border-primary/15 flex items-center justify-center text-2xl font-bold text-primary shadow-sm">
                {initials}
              </div>
            )}

            <label
              htmlFor="avatar-upload"
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-card border border-border shadow cursor-pointer flex items-center justify-center hover:bg-secondary transition"
              title="Alterar foto (máx. 2 MB)"
            >
              <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </label>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 space-y-2 text-center sm:text-left">
            {loadingUi ? (
              <>
                <Skeleton className="h-6 w-48 mx-auto sm:mx-0" />
                <Skeleton className="h-4 w-36 mx-auto sm:mx-0" />
                <Skeleton className="h-4 w-56 mx-auto sm:mx-0" />
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h2 className="text-xl font-bold truncate">{nome || "Seu nome"}</h2>
                  {user.emailVerified && (
                    <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/25 dark:text-emerald-400 text-[10px] gap-1">
                      <ShieldCheck className="w-3 h-3" /> Verificado
                    </Badge>
                  )}
                  {profile?.role && (
                    <Badge variant="secondary" className="text-[10px]">
                      {roleLabel}
                    </Badge>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row flex-wrap gap-x-4 gap-y-0.5 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    {user.email}
                  </span>
                  {matricula && (
                    <span className="flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5 shrink-0" />
                      Matrícula {matricula}
                    </span>
                  )}
                </div>
              </>
            )}

            {/* Tema */}
            <div className="flex items-center gap-2 pt-1 justify-center sm:justify-start">
              <span className="text-xs text-muted-foreground">
                Tema: <span className="font-medium text-foreground capitalize">{resolvedTheme === "dark" ? "Escuro" : "Claro"}</span>
              </span>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </Card>

      {/* ── Formulário de dados ── */}
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <UserCog className="h-4 w-4 text-primary" />
            Dados do prestador
          </CardTitle>
        </CardHeader>

        <Separator />

        <form onSubmit={handleSubmit}>
          <CardContent className="pt-5">
            {loadingUi ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>E-mail corporativo</Label>
                  <Input value={user.email ?? ""} readOnly disabled className="bg-muted/50" />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="nome">Nome completo <span className="text-destructive">*</span></Label>
                  <Input
                    id="nome"
                    value={nome}
                    onChange={e => setNome(e.target.value)}
                    placeholder="Ex: Maria da Silva"
                    autoComplete="name"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="matricula">Matrícula / RG <span className="text-destructive">*</span></Label>
                  <Input
                    id="matricula"
                    value={matricula}
                    onChange={e => setMatricula(e.target.value)}
                    placeholder="Ex: 123456"
                    required
                  />
                </div>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              Esses dados aparecem automaticamente nas RATs emitidas.
            </p>
            <Button
              type="submit"
              className="gap-2 shrink-0"
              disabled={isSaving || loadingUi}
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar perfil
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default ProfilePage;
