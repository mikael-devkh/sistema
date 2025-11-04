import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Search } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";

const formSchema = z
  .object({
    store: z.string().trim().min(1, "Informe a loja."),
    tipo: z.string().min(1, "Selecione o tipo."),
    numeroPDV: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.tipo === "PDV") {
      const value = data.numeroPDV?.trim();
      if (!value) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["numeroPDV"],
          message: "Informe o número do PDV.",
        });
        return;
      }

      const parsedNumber = Number(value);
      if (Number.isNaN(parsedNumber) || parsedNumber < 300) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["numeroPDV"],
          message: "O número do PDV deve ser maior ou igual a 300.",
        });
      }
    }
  });

type SearchFormValues = z.infer<typeof formSchema>;

interface SearchFormProps {
  onSearch: (store: string, tipo: string, numeroPDV?: string) => void;
}

export const SearchForm = ({ onSearch }: SearchFormProps) => {
  const form = useForm<SearchFormValues>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      store: "",
      tipo: "PDV",
      numeroPDV: "",
    },
  });

  const tipoSelecionado = form.watch("tipo");

  const handleSubmit = (values: SearchFormValues) => {
    const store = values.store.trim();
    const numeroPDV = values.numeroPDV?.trim();
    onSearch(store, values.tipo, numeroPDV || undefined);
  };

  const handleReset = () => {
    form.reset({ store: "", tipo: "PDV", numeroPDV: "" });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="store"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-foreground">Loja</FormLabel>
              <FormControl>
                <Input
                  type="text"
                  placeholder="Ex: 001 ou Loja Centro"
                  className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="tipo"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-foreground">Tipo de Dispositivo</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="bg-secondary border-border text-foreground">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="PDV">PDV</SelectItem>
                  <SelectItem value="Impressora Zebra 1">Impressora Zebra 1</SelectItem>
                  <SelectItem value="Impressora Zebra 2">Impressora Zebra 2</SelectItem>
                  <SelectItem value="Impressora Laser">Impressora Laser</SelectItem>
                  <SelectItem value="Desktop">Desktop</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {tipoSelecionado === "PDV" && (
          <FormField
            control={form.control}
            name="numeroPDV"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-foreground">Número do PDV</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="300"
                    placeholder="Ex: 300"
                    className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="submit"
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium transition-all hover:shadow-glow sm:w-auto"
            disabled={!form.formState.isValid}
          >
            <Search className="mr-2 h-4 w-4" />
            Gerar Configuração de IP
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={handleReset}
          >
            Limpar
          </Button>
        </div>
      </form>
    </Form>
  );
};
