import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { toast } from "sonner";
import { auth } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../components/ui/form";
import { Loader2 } from "lucide-react";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Informe o e-mail.")
    .email("Informe um e-mail válido."),
  password: z
    .string()
    .min(6, "A senha deve ter pelo menos 6 caracteres."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const getErrorMessage = (error: unknown, context: "login" | "reset" = "login") => {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "auth/invalid-email":
        return "E-mail inválido.";
      case "auth/user-disabled":
        return "Usuário desativado. Procure um administrador.";
      case "auth/user-not-found":
        if (context === "reset") {
          return "Não encontramos uma conta com esse e-mail.";
        }
        return "E-mail ou senha inválidos.";
      case "auth/wrong-password":
        return "E-mail ou senha inválidos.";
      default:
        return "Não foi possível realizar o login. Tente novamente.";
    }
  }
  return "Não foi possível realizar o login. Tente novamente.";
};

const LoginPage = () => {
  const navigate = useNavigate();
  const { user, loadingAuth } = useAuth();
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const isSubmitting = form.formState.isSubmitting;

  useEffect(() => {
    if (!loadingAuth && user) {
      navigate("/");
    }
  }, [loadingAuth, navigate, user]);

  const onSubmit = async (values: LoginFormValues) => {
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        values.email,
        values.password
      );

      const loggedUser = userCredential.user;

      if (!loggedUser.emailVerified) {
        await signOut(auth);
        toast.error(
          "Seu e-mail ainda não foi verificado. Confira sua caixa de entrada antes de acessar."
        );
        return;
      }

      toast.success("Login realizado com sucesso!");
      navigate("/");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handlePasswordReset = async () => {
    const parsedEmail = loginSchema.shape.email.safeParse(resetEmail);
    if (!parsedEmail.success) {
      toast.error("Informe um e-mail válido para recuperar a senha.");
      return;
    }

    try {
      setIsResettingPassword(true);
      await sendPasswordResetEmail(auth, parsedEmail.data);
      toast.success(
        "Enviamos um e-mail com instruções para redefinir sua senha."
      );
      setIsResetDialogOpen(false);
      setResetEmail("");
    } catch (error) {
      toast.error(getErrorMessage(error, "reset"));
    } finally {
      setIsResettingPassword(false);
    }
  };

  if (loadingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-primary">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-primary px-4 py-12">
      <div className="mx-auto flex min-h-[80vh] w-full max-w-md items-center justify-center">
        <Card className="w-full shadow-xl animate-in fade-in-50 slide-in-from-bottom-4">
          <CardHeader className="space-y-4 text-center">
            <img src="/wt-logo.svg" alt="WT Tecnologia" className="mx-auto h-16 w-auto" />
            <div className="space-y-2">
              <CardTitle className="text-2xl font-bold text-foreground">Acesse sua conta</CardTitle>
              <CardDescription className="text-muted-foreground">
                Entre com suas credenciais corporativas para utilizar o ecossistema WT Tecnologia.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="relative space-y-6"
              >
                <fieldset disabled={isSubmitting} className="space-y-6">
                  <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          autoComplete="email"
                          placeholder="nome@empresa.com"
                          className="bg-secondary text-foreground"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                  <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="current-password"
                          placeholder="••••••••"
                          className="bg-secondary text-foreground"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Entrar
                  </Button>
                </fieldset>
                {isSubmitting && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/70 backdrop-blur-sm">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                )}
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 text-sm text-muted-foreground">
            <AlertDialog
              open={isResetDialogOpen}
              onOpenChange={(open) => {
                setIsResetDialogOpen(open);
                if (open) {
                  setResetEmail(form.getValues("email"));
                } else {
                  setResetEmail("");
                  setIsResettingPassword(false);
                }
              }}
            >
              <AlertDialogTrigger asChild>
                <Button variant="link" className="text-primary">
                  Esqueci minha senha
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Recuperar acesso</AlertDialogTitle>
                  <AlertDialogDescription>
                    Informe seu e-mail corporativo para enviar um link de redefinição de senha.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2 py-4">
                  <FormLabel htmlFor="reset-email">E-mail</FormLabel>
                  <Input
                    id="reset-email"
                    type="email"
                    value={resetEmail}
                    onChange={(event) => setResetEmail(event.target.value)}
                    autoComplete="email"
                    disabled={isResettingPassword}
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isResettingPassword}>
                    Cancelar
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handlePasswordReset}
                    disabled={isResettingPassword}
                    className="gap-2"
                  >
                    {isResettingPassword && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    Enviar e-mail de recuperação
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <div>
              Ainda não possui acesso?
              <Button variant="link" asChild className="text-primary">
                <Link to="/register">Criar conta</Link>
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;
