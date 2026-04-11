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
import { Loader2 } from "lucide-react";

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

const RegisterPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: RegisterFormValues) => {
    setIsSubmitting(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        values.email,
        values.password
      );

      const newUser = userCredential.user;

      if (!newUser) {
        throw new Error("Não foi possível obter o usuário recém-criado.");
      }

      await sendEmailVerification(newUser);
      toast.success(
        "Conta criada! Verifique seu e-mail para ativar o acesso antes de fazer login."
      );

      await signOut(auth);
      navigate("/login");
    } catch (error) {
      let errorMessage =
        "Não foi possível criar a conta. Verifique os dados e tente novamente.";

      if (error && typeof error === "object" && "code" in error) {
        const firebaseError = error as AuthError;
        switch (firebaseError.code) {
          case "auth/email-already-in-use":
            errorMessage = "Este e-mail já está cadastrado.";
            break;
          case "auth/invalid-email":
            errorMessage = "E-mail inválido.";
            break;
          case "auth/weak-password":
            errorMessage = "A senha é muito fraca. Utilize ao menos 6 caracteres.";
            break;
          default:
            errorMessage = "Não foi possível criar a conta. Tente novamente.";
        }
      }

      toast.error(errorMessage);
    }
    setIsSubmitting(false);
  };

  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-primary px-4 py-12">
      <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center">
        <Card className="w-full shadow-lg">
          <CardHeader className="space-y-2 text-center">
            <CardTitle className="text-2xl font-bold text-foreground">
              Criar nova conta
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Cadastre um acesso para utilizar o ecossistema WT Tecnologia.
            </CardDescription>
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
                          autoComplete="new-password"
                          placeholder="Defina uma senha segura"
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
          <CardFooter className="flex flex-col gap-2 text-sm text-muted-foreground">
            <span>
              Já possui acesso?{" "}
              <Link to="/login" className="text-primary hover:underline">
                Fazer login
              </Link>
            </span>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default RegisterPage;
