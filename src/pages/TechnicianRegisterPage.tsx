import { useEffect, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { generateTechnicianCode } from '../lib/technician-code-generator';
import { createTechnician, listParentTechnicians } from '../lib/technician-firestore';
import { getCityCoords } from '../lib/brazilCityCoords';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { Loader2, Wand2 } from 'lucide-react';
import type { TechnicianProfile } from '../types/technician';
import { TECNICOS_EXEMPLO } from '../lib/seed-data';

const technicianSchema = z.object({
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
  // Hierarquia pai/filho
  tecnicoPaiId: z.string().optional(), // uid do técnico pai, '' = nenhum
  pagamentoPara: z.enum(['self', 'parent']).default('self'),
  // Área de atendimento
  atendeArredores: z.boolean().default(false),
  raioKm: z.string().optional(), // string no form; convertido para number no submit
  // Pagamento
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
      tecnicoPaiId: '',
      pagamentoPara: 'self',
      atendeArredores: false,
      raioKm: '',
    },
  });

  // Técnicos pais disponíveis para seleção
  const [parents, setParents] = useState<TechnicianProfile[]>([]);
  const [loadingParents, setLoadingParents] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoadingParents(true);
    listParentTechnicians()
      .then(list => { if (mounted) setParents(list); })
      .catch(err => console.error('Erro ao carregar técnicos pais:', err))
      .finally(() => { if (mounted) setLoadingParents(false); });
    return () => { mounted = false; };
  }, []);

  const preencherExemplo = () => {
    const ex = TECNICOS_EXEMPLO[Math.floor(Math.random() * TECNICOS_EXEMPLO.length)];
    form.reset({
      nome: ex.nome,
      nomeCompleto: ex.nomeCompleto,
      cpf: ex.cpf,
      telefone: ex.telefone,
      cargo: ex.cargo as any,
      especialidades: ex.especialidades,
      cidade: ex.cidade,
      uf: ex.uf,
      atendeArredores: ex.atendeArredores,
      raioKm: ex.raioKm,
      pagamentoPara: 'self',
      tecnicoPaiId: '',
      banco: ex.banco,
      agencia: ex.agencia,
      conta: ex.conta,
      tipoConta: ex.tipoConta as any,
      pix: ex.pix,
    });
  };

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

      // Resolve dados do técnico pai (se selecionado)
      const parent = values.tecnicoPaiId
        ? parents.find(p => p.uid === values.tecnicoPaiId)
        : undefined;

      // Monta a área de atendimento se cidade/UF foram informados
      let areaAtendimento: TechnicianProfile['areaAtendimento'] | undefined;
      if (values.cidade && values.uf) {
        const coords = getCityCoords(values.cidade, values.uf);
        areaAtendimento = {
          cidadeBase: values.cidade,
          ufBase: values.uf,
          coordenadas: coords ? { lat: coords[1], lng: coords[0] } : undefined,
          atendeArredores: !!values.atendeArredores,
          raioKm: values.atendeArredores && values.raioKm
            ? Number(values.raioKm) || undefined
            : undefined,
          cidadesAdicionais: [],
        };
      }

      const technicianData: Omit<TechnicianProfile, 'uid'> = {
        codigoTecnico,
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
        areaAtendimento,
        // Hierarquia
        tecnicoPaiId: parent?.uid,
        tecnicoPaiCodigo: parent?.codigoTecnico,
        tecnicoPaiNome: parent?.nome,
        pagamentoPara: values.pagamentoPara,
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

      await createTechnician(technicianData);

      toast.success(`Técnico cadastrado com sucesso! Código: ${codigoTecnico}`, {
        duration: 5000,
      });

      // Aguardar um pouco para o usuário ver o código gerado
      await new Promise(resolve => setTimeout(resolve, 3000));

      navigate('/tecnicos');

    } catch (error: any) {
      console.error('Erro ao cadastrar técnico:', error);
      toast.error('Erro ao cadastrar técnico. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 animate-page-in">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Cadastrar Novo Técnico</CardTitle>
              <CardDescription>
                Preencha os dados para registrar um novo técnico na frota
              </CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={preencherExemplo}>
              <Wand2 className="w-3.5 h-3.5" /> Preencher exemplo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
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

              {/* Dados de Localização e Área de Atendimento */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Localização e Área de Atendimento</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="cidade"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cidade base</FormLabel>
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <FormField
                    control={form.control}
                    name="atendeArredores"
                    render={({ field }) => (
                      <FormItem className="flex items-start gap-3 space-y-0 rounded-md border p-3 md:col-span-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="font-medium">Atende arredores</FormLabel>
                          <p className="text-xs text-muted-foreground">
                            Marque se este técnico cobre cidades próximas dentro de um raio
                          </p>
                        </div>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="raioKm"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Raio (km)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            step={5}
                            placeholder="Ex: 50"
                            disabled={!form.watch('atendeArredores')}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Hierarquia Pai/Filho */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Hierarquia (Opcional)</h3>
                <p className="text-xs text-muted-foreground">
                  Use quando este técnico atende em nome de outro (subcontratado).
                  O técnico pai pode receber o pagamento pelos chamados.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="tecnicoPaiId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Técnico pai</FormLabel>
                        <Select
                          onValueChange={v => field.onChange(v === 'none' ? '' : v)}
                          value={field.value || 'none'}
                          disabled={loadingParents}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Nenhum (técnico independente)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhum (técnico independente)</SelectItem>
                            {parents.map(p => (
                              <SelectItem key={p.uid} value={p.uid}>
                                {p.codigoTecnico} — {p.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="pagamentoPara"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pagamento vai para</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={!form.watch('tecnicoPaiId')}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="self">O próprio técnico</SelectItem>
                            <SelectItem value="parent">Técnico pai</SelectItem>
                          </SelectContent>
                        </Select>
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
                <div className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border-2 border-green-500 dark:border-green-600 rounded-xl shadow-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="text-2xl">✅</div>
                    <div>
                      <p className="text-sm font-semibold text-green-900 dark:text-green-100 uppercase tracking-wide">
                        Código do Técnico Gerado
                      </p>
                      <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                        Anote este código — ele identifica o técnico no sistema
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-lg border-2 border-green-500 dark:border-green-600">
                    <p className="text-center">
                      <span className="text-3xl font-bold text-green-700 dark:text-green-300 font-mono tracking-wider">
                        {generatedCode}
                      </span>
                    </p>
                  </div>
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
