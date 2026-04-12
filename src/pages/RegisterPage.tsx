import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  AuthError,
} from "firebase/auth";
import { toast } from "sonner";
import { auth } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
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
import { Loader2, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { cn } from "../lib/utils";

const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Informe o e-mail.")
    .email("Informe um e-mail válido."),
  password: z
    .string()
    .min(6, "A senha deve ter pelo menos 6 caracteres."),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

/** Calcula a força da senha: 0-4 */
function passwordStrength(p: string): number {
  if (!p) return 0;
  let score = 0;
  if (p.length >= 6)  score++;
  if (p.length >= 10) score++;
  if (/[A-Z]/.test(p)) score++;
  if (/[0-9!@#$%^&*]/.test(p)) score++;
  return score;
}

const strengthLabel = ["", "Fraca", "Razoável", "Boa", "Forte"];
const strengthColor = ["", "bg-red-500", "bg-amber-400", "bg-blue-500", "bg-emerald-500"];

const RegisterPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "" },
  });

  const passwordValue = form.watch("password");
  const strength = passwordStrength(passwordValue);

  const onSubmit = async (values: RegisterFormValues) => {
    setIsSubmitting(true);
    try {
      const { user: newUser } = await createUserWithEmailAndPassword(
        auth,
        values.email,
        values.password,
      );
      await sendEmailVerification(newUser);
      toast.success(
        "Conta criada! Verifique seu e-mail para ativar o acesso.",
      );
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      let msg = "Não foi possível criar a conta. Tente novamente.";
      if (error && typeof error === "object" && "code" in error) {
        const fe = error as AuthError;
        if (fe.code === "auth/email-already-in-use") msg = "Este e-mail já está cadastrado.";
        else if (fe.code === "auth/invalid-email")    msg = "E-mail inválido.";
        else if (fe.code === "auth/weak-password")    msg = "Senha muito fraca. Use ao menos 6 caracteres.";
      }
      toast.error(msg);
    }
    setIsSubmitting(false);
  };

  if (user) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-gradient-primary flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md animate-page-in">
        <Card className="shadow-card-md">
          <CardHeader className="space-y-4 text-center pb-4">
            <img
              src="/wt-logo.svg"
              alt="WT Tecnologia"
              className="mx-auto h-14 w-auto"
            />
            <div className="space-y-1.5">
              <CardTitle className="text-2xl font-bold">Criar nova conta</CardTitle>
              <CardDescription>
                Cadastre seu acesso ao ecossistema WT Tecnologia.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="relative space-y-5"
              >
                <fieldset disabled={isSubmitting} className="space-y-5">
                  {/* E-mail */}
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>E-mail corporativo</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            autoComplete="email"
                            placeholder="nome@empresa.com"
                            className="bg-secondary"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Senha */}
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Senha</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showPassword ? "text" : "password"}
                              autoComplete="new-password"
                              placeholder="Mínimo 6 caracteres"
                              className="bg-secondary pr-10"
                              {...field}
                            />
                            <button
                              type="button"
                              tabIndex={-1}
                              onClick={() => setShowPassword(v => !v)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {showPassword
                                ? <EyeOff className="w-4 h-4" />
                                : <Eye    className="w-4 h-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />

                        {/* Barra de força */}
                        {passwordValue.length > 0 && (
                          <div className="space-y-1 mt-1">
                            <div className="flex gap-1">
                              {[1, 2, 3, 4].map(i => (
                                <div
                                  key={i}
                                  className={cn(
                                    "h-1 flex-1 rounded-full transition-all duration-300",
                                    i <= strength ? strengthColor[strength] : "bg-muted",
                                  )}
                                />
                              ))}
                            </div>
                            {strength > 0 && (
                              <p className={cn(
                                "text-[11px] font-medium",
                                strength <= 1 ? "text-red-500" :
                                strength === 2 ? "text-amber-500" :
                                strength === 3 ? "text-blue-500" : "text-emerald-500",
                              )}>
                                Senha {strengthLabel[strength]}
                              </p>
                            )}
                          </div>
                        )}
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting
                      ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      : <ShieldCheck className="mr-2 h-4 w-4" />}
                    Criar conta
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

          <CardFooter className="flex justify-center text-sm text-muted-foreground">
            Já possui acesso?{" "}
            <Link to="/login" className="text-primary hover:underline ml-1 font-medium">
              Fazer login
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default RegisterPage;
