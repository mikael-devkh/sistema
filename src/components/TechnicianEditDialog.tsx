import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createOrUpdateTechnician } from '../lib/technician-firestore';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Loader2 } from 'lucide-react';
import type { TechnicianProfile } from '../types/technician';

const technicianEditSchema = z.object({
  nome: z.string().min(2, 'Nome é obrigatório'),
  nomeCompleto: z.string().min(5, 'Nome completo é obrigatório'),
  cpf: z.string().optional(),
  telefone: z.string().min(10, 'Telefone inválido'),
  telefoneEmergencia: z.string().optional(),
  cargo: z.enum(['tecnico', 'supervisor', 'coordenador']),
  especialidades: z.array(z.string()).min(1, 'Selecione ao menos uma especialidade'),
  regiaoAtuacao: z.array(z.string()).optional(),
  cidade: z.string().optional(),
  uf: z.string().length(2, 'UF deve ter 2 caracteres').optional(),
  endereco: z.string().optional(),
  banco: z.string().optional(),
  agencia: z.string().optional(),
  conta: z.string().optional(),
  tipoConta: z.enum(['corrente', 'poupanca']).optional(),
  pix: z.string().optional(),
  observacoesPagamento: z.string().optional(),
  status: z.enum(['ativo', 'inativo', 'ferias', 'licenca', 'desligado']),
});

type TechnicianEditFormValues = z.infer<typeof technicianEditSchema>;

const ESPECIALIDADES_OPTIONS = [
  'PDVs',
  'Desktops',
  'Impressora Zebra',
  'Infraestrutura',
  'Field Service',
];

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

interface TechnicianEditDialogProps {
  technician: TechnicianProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function TechnicianEditDialog({
  technician,
  open,
  onOpenChange,
  onSuccess,
}: TechnicianEditDialogProps) {
  const { user: currentUser } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<TechnicianEditFormValues>({
    resolver: zodResolver(technicianEditSchema),
    defaultValues: {
      cargo: 'tecnico',
      especialidades: [],
      regiaoAtuacao: [],
      status: 'ativo',
    },
  });

  // Preencher formulário quando o técnico for selecionado
  useEffect(() => {
    if (technician && open) {
      form.reset({
        nome: technician.nome || '',
        nomeCompleto: technician.nomeCompleto || '',
        cpf: technician.cpf || '',
        telefone: technician.telefone || '',
        telefoneEmergencia: technician.telefoneEmergencia || '',
        cargo: technician.cargo,
        especialidades: technician.especialidades || [],
        regiaoAtuacao: technician.regiaoAtuacao || [],
        cidade: technician.cidade || '',
        uf: technician.uf || '',
        endereco: technician.endereco || '',
        banco: technician.pagamento?.banco || '',
        agencia: technician.pagamento?.agencia || '',
        conta: technician.pagamento?.conta || '',
        tipoConta: technician.pagamento?.tipoConta,
        pix: technician.pagamento?.pix || '',
        observacoesPagamento: technician.pagamento?.observacoes || '',
        status: technician.status || 'ativo',
      });
    }
  }, [technician, open, form]);

  const onSubmit = async (values: TechnicianEditFormValues) => {
    if (!technician || !currentUser) return;

    setIsSubmitting(true);
    try {
      // Atualizar email no Firebase Auth se necessário
      // (Normalmente não mudamos, mas se necessário, podemos fazer aqui)

      const technicianData: TechnicianProfile = {
        ...technician,
        nome: values.nome,
        nomeCompleto: values.nomeCompleto,
        cpf: values.cpf,
        telefone: values.telefone,
        telefoneEmergencia: values.telefoneEmergencia,
        cargo: values.cargo,
        especialidades: values.especialidades,
        regiaoAtuacao: values.regiaoAtuacao,
        cidade: values.cidade,
        uf: values.uf,
        endereco: values.endereco,
        pagamento: values.banco || values.agencia || values.conta || values.pix ? {
          banco: values.banco,
          agencia: values.agencia,
          conta: values.conta,
          tipoConta: values.tipoConta,
          pix: values.pix,
          observacoes: values.observacoesPagamento,
        } : undefined,
        status: values.status,
        dataAtualizacao: Date.now(),
      };

      await createOrUpdateTechnician(technicianData);

      toast.success('Técnico atualizado com sucesso!');
      form.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Erro ao atualizar técnico:', error);
      let errorMessage = 'Erro ao atualizar técnico';
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'Este e-mail já está cadastrado';
      }
      
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!technician) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Técnico - {technician.codigoTecnico}</DialogTitle>
          <DialogDescription>
            Atualize as informações do técnico. O código e email não podem ser alterados.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Dados Pessoais */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Dados Pessoais</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl>
                        <Input placeholder="João" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="nomeCompleto"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Completo</FormLabel>
                      <FormControl>
                        <Input placeholder="João Silva Santos" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cpf"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF (Opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="000.000.000-00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="telefone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <Input placeholder="(11) 99999-9999" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="telefoneEmergencia"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone de Emergência (Opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="(11) 99999-9999" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Dados Profissionais */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Dados Profissionais</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="cargo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cargo</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o cargo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tecnico">Técnico</SelectItem>
                          <SelectItem value="supervisor">Supervisor</SelectItem>
                          <SelectItem value="coordenador">Coordenador</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ativo">Ativo</SelectItem>
                          <SelectItem value="inativo">Inativo</SelectItem>
                          <SelectItem value="ferias">Férias</SelectItem>
                          <SelectItem value="licenca">Licença</SelectItem>
                          <SelectItem value="desligado">Desligado</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="especialidades"
                render={() => (
                  <FormItem>
                    <FormLabel>Especialidades *</FormLabel>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {ESPECIALIDADES_OPTIONS.map((esp) => (
                        <FormField
                          key={esp}
                          control={form.control}
                          name="especialidades"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(esp)}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([...field.value, esp])
                                      : field.onChange(
                                          field.value?.filter((value) => value !== esp)
                                        );
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="text-sm font-normal">{esp}</FormLabel>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Dados de Localização */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Localização</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="cidade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cidade</FormLabel>
                      <FormControl>
                        <Input placeholder="São Paulo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="uf"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>UF</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {UFS.map((uf) => (
                            <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endereco"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Endereço (Opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Rua, número" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Dados de Pagamento */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Dados de Pagamento (Opcional)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="banco"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Banco</FormLabel>
                      <FormControl>
                        <Input placeholder="Banco do Brasil" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="agencia"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agência</FormLabel>
                      <FormControl>
                        <Input placeholder="1234-5" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="conta"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Conta</FormLabel>
                      <FormControl>
                        <Input placeholder="12345-6" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="tipoConta"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Conta</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="corrente">Conta Corrente</SelectItem>
                          <SelectItem value="poupanca">Conta Poupança</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="pix"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Chave PIX</FormLabel>
                      <FormControl>
                        <Input placeholder="CPF, e-mail, telefone ou chave aleatória" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="observacoesPagamento"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Observações</FormLabel>
                      <FormControl>
                        <Input placeholder="Informações adicionais sobre pagamento" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Alterações
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

