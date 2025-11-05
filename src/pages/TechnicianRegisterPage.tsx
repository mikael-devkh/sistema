import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { generateTechnicianCode } from '../lib/technician-code-generator';
import { createOrUpdateTechnician } from '../lib/technician-firestore';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import type { TechnicianProfile } from '../types/technician';

const technicianSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
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
});

type TechnicianFormValues = z.infer<typeof technicianSchema>;

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

export default function TechnicianRegisterPage() {
  const navigate = useNavigate();
  const { user: currentUser, profile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  const form = useForm<TechnicianFormValues>({
    resolver: zodResolver(technicianSchema),
    defaultValues: {
      cargo: 'tecnico',
      especialidades: [],
      regiaoAtuacao: [],
    },
  });

  // Debug
  console.log('TechnicianRegisterPage - User:', currentUser?.uid);
  console.log('TechnicianRegisterPage - Profile role:', profile?.role);
  
  if (!currentUser) {
    return <Navigate to="/" replace />;
  }
  
  if (profile?.role !== 'admin') {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Acesso Negado</CardTitle>
            <CardDescription>
              Você precisa ter permissão de administrador para cadastrar técnicos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Role atual: {profile?.role || 'não definido'}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Para ter acesso, seu perfil no Firestore precisa ter o campo <code>role: 'admin'</code> no documento <code>users/{currentUser.uid}</code>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const onSubmit = async (values: TechnicianFormValues) => {
    setIsSubmitting(true);
    try {
      const codigoTecnico = await generateTechnicianCode();
      setGeneratedCode(codigoTecnico);

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        values.email,
        values.password
      );
      const newUser = userCredential.user;

      const technicianData: TechnicianProfile = {
        uid: newUser.uid,
        codigoTecnico,
        email: values.email,
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
        status: 'ativo',
        disponivel: true,
        dataCadastro: Date.now(),
        dataAtualizacao: Date.now(),
        cadastradoPor: currentUser.uid,
        totalChamados: 0,
        chamadosConcluidos: 0,
        chamadosEmAndamento: 0,
      };

      await createOrUpdateTechnician(technicianData);

      await setDoc(doc(db, 'users', newUser.uid), {
        nome: values.nome,
        matricula: codigoTecnico,
        role: 'tecnico',
        email: values.email,
        createdAt: serverTimestamp(),
      });

      toast.success(`Técnico cadastrado com sucesso! Código: ${codigoTecnico}`);
      form.reset();
      setGeneratedCode(null);
      
      // Aguardar um pouco para garantir que o Firestore salvou
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Redirecionar para a página de gestão
      navigate('/tecnicos');

    } catch (error: any) {
      console.error('Erro ao cadastrar técnico:', error);
      let errorMessage = 'Erro ao cadastrar técnico';
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'Este e-mail já está cadastrado';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'A senha é muito fraca';
      }
      
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle>Cadastrar Novo Técnico</CardTitle>
          <CardDescription>
            Preencha os dados para registrar um novo técnico na frota
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Dados de Acesso */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Dados de Acesso</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>E-mail</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="tecnico@empresa.com" {...field} />
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
                          <Input type="password" placeholder="Mínimo 6 caracteres" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

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

              {generatedCode && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">
                    ✅ Código gerado: <strong>{generatedCode}</strong>
                  </p>
                </div>
              )}

              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/tecnicos')}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Cadastrar Técnico
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

