import { FormEvent, useEffect, useState, ChangeEvent } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";
import { Badge } from "../components/ui/badge";
import { Avatar } from "../components/ui/avatar";
import { Loader2, UserCog, Moon, Sun, Image as ImageIcon, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { toast } from "sonner";
import { useState as useThemeState } from "react"; // para tema manual, substitua por hook real se tiver!
import { Skeleton } from "../components/ui/skeleton";
import { usePageLoading } from "../hooks/use-page-loading";

const ProfilePage = () => {
  const { user, profile, loadingAuth, loadingProfile, refreshProfile, updateProfileLocally } = useAuth();
  const [nome, setNome] = useState("");
  const [matricula, setMatricula] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [theme, setTheme] = useThemeState("light");

  useEffect(() => {
    if (profile) {
      setNome(profile.nome ?? "");
      setMatricula(profile.matricula ?? "");
      setAvatarUrl(profile.avatarUrl);
    } else {
      setNome("");
      setMatricula("");
      setAvatarUrl(undefined);
    }
  }, [profile]);

  useEffect(() => {
    if (!loadingAuth && user && !profile && !loadingProfile) {
      void (async () => {
        try {
          const snapshot = await getDoc(doc(db, "users", user.uid));
          if (snapshot.exists()) {
            const data = snapshot.data();
            setNome(typeof data.nome === "string" ? data.nome : "");
            setMatricula(typeof data.matricula === "string" ? data.matricula : "");
            setAvatarUrl(typeof data.avatarUrl === "string" ? data.avatarUrl : undefined);
            updateProfileLocally({
              nome: typeof data.nome === "string" ? data.nome : undefined,
              matricula: typeof data.matricula === "string" ? data.matricula : undefined,
              avatarUrl: typeof data.avatarUrl === "string" ? data.avatarUrl : undefined,
            });
          }
        } catch (error) {
          console.error("Erro ao buscar dados do perfil:", error);
        }
      })();
    }
  }, [loadingAuth, loadingProfile, profile, updateProfileLocally, user]);

  if (loadingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-primary">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const handleAvatarUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setAvatarUrl(base64);
        setAvatarFile(file);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl(undefined);
    setAvatarFile(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;

    setIsSaving(true);
    try {
      const profileRef = doc(db, "users", user.uid);
      await setDoc(
        profileRef,
        {
          email: user.email ?? "",
          nome: nome.trim(),
          matricula: matricula.trim(),
          updatedAt: serverTimestamp(),
          avatarUrl: avatarUrl ?? "",
        },
        { merge: true },
      );
      updateProfileLocally({ nome: nome.trim(), matricula: matricula.trim(), avatarUrl: avatarUrl });
      toast.success("Perfil salvo com sucesso. Suas RATs usarão estes dados automaticamente.");
      await refreshProfile();
    } catch (error) {
      console.error("Erro ao salvar perfil:", error);
      toast.error("Não foi possível salvar as informações do perfil.");
    } finally {
      setIsSaving(false);
    }
  };

  const initials = nome
    ?.split(" ")
    .slice(0, 2)
    .map(s => s.charAt(0).toUpperCase())
    .join("") || "US";

  const loadingUi = usePageLoading(400, [loadingProfile, profile]);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 py-10">
      <Card className="mb-2 p-6 bg-background/80 flex flex-col md:flex-row items-center gap-6 shadow-lg">
        <div className="relative flex flex-col items-center">
          {loadingUi ? (
            <Skeleton className="h-20 w-20 rounded-full" />
          ) : avatarUrl ? (
            <>
              <img src={avatarUrl} alt="Avatar" className="rounded-full h-20 w-20 object-cover border border-primary/30 shadow" />
              <button type="button" className="absolute top-0 right-0 bg-background rounded-full p-1 hover:bg-primary/10" onClick={handleRemoveAvatar} title="Remover avatar">
                <X className="w-5 h-5 text-destructive" />
              </button>
            </>
          ) : (
            <Avatar className="h-20 w-20 text-3xl font-bold bg-muted border-primary/30 border shadow-md flex items-center justify-center">
              {initials}
            </Avatar>
          )}
          <label htmlFor="avatar-upload" className="flex flex-col items-center mt-3 cursor-pointer text-xs text-primary hover:text-foreground transition">
            <ImageIcon className="h-5 w-5 mr-1 inline-block" />
            {avatarUrl ? "Trocar imagem" : "Adicionar imagem"}
            <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </label>
        </div>
        <div className="flex-1 flex flex-col gap-2">
          {loadingUi ? (
            <>
              <Skeleton className="h-6 w-48 mb-1" />
              <Skeleton className="h-4 w-40 mb-1" />
              <Skeleton className="h-4 w-64" />
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg font-semibold">{nome || "Seu Nome"}</span>
                {user.emailVerified && <Badge variant="success">Verificado</Badge>}
              </div>
              <div className="text-sm text-muted-foreground">Matrícula/RG: <strong>{matricula || ""}</strong></div>
              <div className="text-sm text-muted-foreground">E-mail: {user.email}</div>
            </>
          )}
          <div className="flex items-center gap-3 mt-2">
            <Switch checked={theme === 'dark'} onCheckedChange={checked => setTheme(checked ? 'dark' : 'light')} id="theme-toggle" />
            <Label htmlFor="theme-toggle" className="flex items-center gap-1 cursor-pointer">
              {theme === 'dark' ? <Moon className="w-4 h-4 text-primary" /> : <Sun className="w-4 h-4 text-yellow-500" />}
              Tema {theme === 'dark' ? "Escuro" : "Claro"}
            </Label>
          </div>
        </div>
      </Card>
      <Card className="bg-background/90 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground sm:text-xl flex gap-2 items-center">
            <UserCog className="h-6 w-6 text-primary mr-1" /> Informações do prestador
          </CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {loadingUi ? (
              <>
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </>
            ) : (
              <>
                <div className="space-y-1">
                  <Label>E-mail corporativo</Label>
                  <Input value={user.email ?? ""} readOnly disabled />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="nome">Nome completo</Label>
                  <Input
                    id="nome"
                    value={nome}
                    onChange={(event) => setNome(event.target.value)}
                    placeholder="Ex: Maria Souza"
                    autoComplete="name"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="matricula">Matrícula ou RG</Label>
                  <Input
                    id="matricula"
                    value={matricula}
                    onChange={(event) => setMatricula(event.target.value)}
                    placeholder="Ex: 123456"
                    required
                  />
                </div>
              </>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="submit" className="gap-2" disabled={isSaving} variant="primary">
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar perfil
            </Button>
          </CardFooter>
        </form>
      </Card>
      {/* Comentário: avatar/nome acima mudam só no dashboard e no app, os dados da RAT são capturados do perfil na hora da emissão */}
    </div>
  );
};

export default ProfilePage;

