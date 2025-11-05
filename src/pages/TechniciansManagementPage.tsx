import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../hooks/use-permissions';
import { useAuth } from '../context/AuthContext';
import { listTechnicians, updateTechnicianAvailability, deleteTechnician } from '../lib/technician-firestore';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { TechnicianCard } from '../components/TechnicianCard';
import { TechnicianEditDialog } from '../components/TechnicianEditDialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Skeleton } from '../components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Plus, Search, Download } from 'lucide-react';
import { toast } from 'sonner';
import type { TechnicianProfile } from '../types/technician';

export default function TechniciansManagementPage() {
  const navigate = useNavigate();
  const { permissions } = usePermissions();
  const { profile } = useAuth();
  const [technicians, setTechnicians] = useState<TechnicianProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'todos' | 'ativos' | 'inativos'>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingTechnician, setEditingTechnician] = useState<TechnicianProfile | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deletingTechnician, setDeletingTechnician] = useState<TechnicianProfile | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [filterEspecialidade, setFilterEspecialidade] = useState<string>('todos');
  const [filterCargo, setFilterCargo] = useState<string>('todos');
  const [filterUF, setFilterUF] = useState<string>('todos');

  useEffect(() => {
    loadTechnicians();
  }, [filter]);

  // Listener em tempo real para atualizar quando técnicos são adicionados
  useEffect(() => {
    const techniciansRef = collection(db, 'technicians');
    
    // Tentar com orderBy primeiro, se falhar usa sem
    let q;
    try {
      q = query(techniciansRef, orderBy('dataCadastro', 'desc'));
    } catch (error) {
      console.warn('Não foi possível usar orderBy no listener, usando query simples:', error);
      q = query(techniciansRef);
    }
    
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const technicians = snapshot.docs.map(doc => ({
          uid: doc.id,
          ...doc.data(),
        })) as TechnicianProfile[];
        
        // Ordenar no cliente se necessário
        technicians.sort((a, b) => (b.dataCadastro || 0) - (a.dataCadastro || 0));
        
        console.log(`🔄 Realtime update: ${technicians.length} técnico(s)`);
        setTechnicians(technicians);
      },
      (error) => {
        console.error('Erro no listener real-time:', error);
        // Se falhar, tenta carregar manualmente uma vez
        if (error.code === 'failed-precondition') {
          console.warn('Índice necessário para orderBy. Usando query simples...');
          const qSimple = query(techniciansRef);
          onSnapshot(qSimple, (snap) => {
            const techs = snap.docs.map(doc => ({
              uid: doc.id,
              ...doc.data(),
            })) as TechnicianProfile[];
            techs.sort((a, b) => (b.dataCadastro || 0) - (a.dataCadastro || 0));
            setTechnicians(techs);
          });
        }
      }
    );
    
    return () => unsubscribe();
  }, []);

  const loadTechnicians = async () => {
    setLoading(true);
    try {
      console.log('🔄 Carregando técnicos... Filtro:', filter);
      
      const filters: any = {};
      if (filter === 'ativos') {
        filters.status = 'ativo';
      }

      const data = await listTechnicians(
        filter === 'todos' ? undefined : { status: filters.status }
      );

      console.log(`📊 Técnicos recebidos: ${data.length}`);

      // Filtrar inativos se necessário
      const filteredData = filter === 'inativos'
        ? data.filter(t => t.status !== 'ativo')
        : data;

      console.log(`✅ Técnicos após filtro: ${filteredData.length}`);
      setTechnicians(filteredData);
      
      if (filteredData.length === 0 && data.length === 0) {
        console.warn('⚠️ Nenhum técnico encontrado no Firestore. Verifique se a collection "technicians" existe.');
      }
    } catch (error: any) {
      console.error('❌ Erro ao carregar técnicos:', error);
      console.error('Detalhes do erro:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      
      let errorMessage = 'Erro ao carregar lista de técnicos';
      if (error.code === 'failed-precondition') {
        errorMessage = 'Erro: Índice Firestore necessário. Verifique o console para mais detalhes.';
        console.error('💡 SOLUÇÃO: Crie um índice composto no Firebase Console para:', {
          collection: 'technicians',
          fields: ['status', 'dataCadastro'] // ou os campos que você está usando
        });
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAvailability = async (uid: string, disponivel: boolean) => {
    try {
      await updateTechnicianAvailability(uid, disponivel);
      toast.success(`Técnico ${disponivel ? 'disponível' : 'indisponível'}`);
      loadTechnicians();
    } catch (error) {
      console.error('Erro ao atualizar disponibilidade:', error);
      toast.error('Erro ao atualizar disponibilidade');
    }
  };

  const handleEdit = (technician: TechnicianProfile) => {
    setEditingTechnician(technician);
    setIsEditDialogOpen(true);
  };

  const handleEditSuccess = () => {
    loadTechnicians();
  };

  const handleDelete = (technician: TechnicianProfile) => {
    setDeletingTechnician(technician);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingTechnician) return;
    
    try {
      await deleteTechnician(deletingTechnician.uid);
      toast.success(`Técnico ${deletingTechnician.nome} desligado com sucesso`);
      setIsDeleteDialogOpen(false);
      setDeletingTechnician(null);
      loadTechnicians();
    } catch (error) {
      console.error('Erro ao excluir técnico:', error);
      toast.error('Erro ao excluir técnico');
    }
  };

  const filteredTechnicians = technicians.filter(tech => {
    // Busca por texto
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const matchesSearch = (
        tech.nome.toLowerCase().includes(search) ||
        tech.codigoTecnico.toLowerCase().includes(search) ||
        tech.email.toLowerCase().includes(search) ||
        tech.telefone?.includes(search)
      );
      if (!matchesSearch) return false;
    }

    // Filtro por especialidade
    if (filterEspecialidade !== 'todos') {
      if (!tech.especialidades?.includes(filterEspecialidade)) return false;
    }

    // Filtro por cargo
    if (filterCargo !== 'todos') {
      if (tech.cargo !== filterCargo) return false;
    }

    // Filtro por UF
    if (filterUF !== 'todos') {
      if (tech.uf !== filterUF) return false;
    }

    return true;
  });

  // Obter lista única de especialidades e UFs para os filtros
  const especialidadesUnicas = Array.from(
    new Set(technicians.flatMap(t => t.especialidades || []))
  ).sort();

  const ufsUnicas = Array.from(
    new Set(technicians.map(t => t.uf).filter(Boolean) as string[])
  ).sort();

  // Função para exportar CSV
  const handleExportCSV = () => {
    if (filteredTechnicians.length === 0) {
      toast.error('Nenhum técnico para exportar');
      return;
    }

    const headers = [
      'Código',
      'Nome',
      'Nome Completo',
      'Email',
      'Telefone',
      'Cargo',
      'Especialidades',
      'Status',
      'Disponível',
      'Cidade',
      'UF',
      'Endereço',
      'Banco',
      'Agência',
      'Conta',
      'Tipo Conta',
      'PIX',
      'Total Chamados',
      'Chamados Concluídos',
      'Chamados em Andamento',
      'Data Cadastro',
      'Data Atualização'
    ];

    const rows = filteredTechnicians.map(tech => {
      const dataCadastro = tech.dataCadastro 
        ? new Date(tech.dataCadastro).toLocaleDateString('pt-BR')
        : '';
      const dataAtualizacao = tech.dataAtualizacao 
        ? new Date(tech.dataAtualizacao).toLocaleDateString('pt-BR')
        : '';

      return [
        tech.codigoTecnico || '',
        tech.nome || '',
        tech.nomeCompleto || '',
        tech.email || '',
        tech.telefone || '',
        tech.cargo || '',
        (tech.especialidades || []).join('; '),
        tech.status || '',
        tech.disponivel ? 'Sim' : 'Não',
        tech.cidade || '',
        tech.uf || '',
        tech.endereco || '',
        tech.pagamento?.banco || '',
        tech.pagamento?.agencia || '',
        tech.pagamento?.conta || '',
        tech.pagamento?.tipoConta || '',
        tech.pagamento?.pix || '',
        tech.totalChamados?.toString() || '0',
        tech.chamadosConcluidos?.toString() || '0',
        tech.chamadosEmAndamento?.toString() || '0',
        dataCadastro,
        dataAtualizacao
      ];
    });

    // Função para escapar valores CSV (lidar com vírgulas e aspas)
    const escapeCSV = (value: string): string => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tecnicos-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`${filteredTechnicians.length} técnico(s) exportado(s) com sucesso!`);
  };

  // Calcular estatísticas detalhadas
  const stats = {
    total: technicians.length,
    ativos: technicians.filter(t => t.status === 'ativo').length,
    disponiveis: technicians.filter(t => t.disponivel && t.status === 'ativo').length,
    emAtendimento: technicians.reduce((acc, t) => acc + (t.chamadosEmAndamento || 0), 0),
    porCargo: {
      tecnico: technicians.filter(t => t.cargo === 'tecnico').length,
      supervisor: technicians.filter(t => t.cargo === 'supervisor').length,
      coordenador: technicians.filter(t => t.cargo === 'coordenador').length,
    },
    porStatus: {
      ativo: technicians.filter(t => t.status === 'ativo').length,
      inativo: technicians.filter(t => t.status === 'inativo').length,
      ferias: technicians.filter(t => t.status === 'ferias').length,
      licenca: technicians.filter(t => t.status === 'licenca').length,
      desligado: technicians.filter(t => t.status === 'desligado').length,
    },
    totalChamados: technicians.reduce((acc, t) => acc + (t.totalChamados || 0), 0),
    chamadosConcluidos: technicians.reduce((acc, t) => acc + (t.chamadosConcluidos || 0), 0),
  };

  // Temporariamente permitir acesso para todos (para testes)
  // TODO: Remover depois de configurar roles no Firestore
  const hasAccess = true; // Temporário: profile?.role === 'admin' || permissions.canManageUsers;
  
  // Debug: verificar permissões
  console.log('TechniciansManagementPage - Profile role:', profile?.role);
  console.log('TechniciansManagementPage - Permissions:', permissions);
  console.log('TechniciansManagementPage - canManageUsers:', permissions.canManageUsers);
  console.log('TechniciansManagementPage - hasAccess:', hasAccess);
  
  // Temporariamente comentado - descomentar depois de configurar roles
  /*
  if (!hasAccess) {
    console.warn('Acesso negado: usuário não tem permissão');
    return (
      <div className="max-w-7xl mx-auto py-8 px-4">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-4">Acesso Negado</h2>
          <p className="text-muted-foreground mb-4">
            Você precisa ter permissão de administrador para acessar esta página.
          </p>
          <div className="mt-6 p-4 bg-muted rounded-lg text-left max-w-2xl mx-auto">
            <p className="text-sm font-semibold mb-2">Role atual: <code>{profile?.role || 'não definido'}</code></p>
            <p className="text-sm text-muted-foreground mb-2">
              Para ter acesso, você precisa ter o campo <code className="bg-background px-1 rounded">role: 'admin'</code> no seu perfil no Firestore.
            </p>
            <p className="text-sm text-muted-foreground">
              <strong>Como configurar:</strong>
            </p>
            <ol className="text-sm text-muted-foreground mt-2 list-decimal list-inside space-y-1">
              <li>Acesse o Firebase Console</li>
              <li>Vá em Firestore Database</li>
              <li>Localize a collection <code className="bg-background px-1 rounded">users</code></li>
              <li>Encontre o documento com seu UID: <code className="bg-background px-1 rounded">{profile?.role || 'seu-uid-aqui'}</code></li>
              <li>Adicione o campo <code className="bg-background px-1 rounded">role</code> com valor <code className="bg-background px-1 rounded">admin</code></li>
              <li>Recarregue esta página</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }
  */

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Gestão de Técnicos</h1>
          <p className="text-muted-foreground text-base">
            Gerencie a frota de técnicos e distribuição de chamados
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleExportCSV}
            disabled={filteredTechnicians.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
          <Button onClick={() => navigate('/cadastrar-tecnico')}>
            <Plus className="mr-2 h-4 w-4" />
            Cadastrar Técnico
          </Button>
        </div>
      </div>

      {/* Filtros e busca */}
      <div className="space-y-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="w-full sm:w-auto">
            <TabsList>
              <TabsTrigger value="todos">Todos</TabsTrigger>
              <TabsTrigger value="ativos">Ativos</TabsTrigger>
              <TabsTrigger value="inativos">Inativos</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, código, e-mail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Filtros avançados */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select value={filterEspecialidade} onValueChange={setFilterEspecialidade}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por especialidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as especialidades</SelectItem>
              {especialidadesUnicas.map((esp) => (
                <SelectItem key={esp} value={esp}>{esp}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterCargo} onValueChange={setFilterCargo}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por cargo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os cargos</SelectItem>
              <SelectItem value="tecnico">Técnico</SelectItem>
              <SelectItem value="supervisor">Supervisor</SelectItem>
              <SelectItem value="coordenador">Coordenador</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterUF} onValueChange={setFilterUF}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por UF" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as UFs</SelectItem>
              {ufsUnicas.map((uf) => (
                <SelectItem key={uf} value={uf}>{uf}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Estatísticas rápidas */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <div className="p-5 border-2 rounded-xl bg-background shadow-sm hover:shadow-md transition-shadow">
          <p className="text-sm font-medium text-muted-foreground mb-2">Total</p>
          <p className="text-3xl font-bold text-foreground">{stats.total}</p>
        </div>
        <div className="p-5 border-2 rounded-xl bg-background shadow-sm hover:shadow-md transition-shadow border-green-500/20">
          <p className="text-sm font-medium text-muted-foreground mb-2">Ativos</p>
          <p className="text-3xl font-bold text-green-600 dark:text-green-400">{stats.ativos}</p>
        </div>
        <div className="p-5 border-2 rounded-xl bg-background shadow-sm hover:shadow-md transition-shadow border-blue-500/20">
          <p className="text-sm font-medium text-muted-foreground mb-2">Disponíveis</p>
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.disponiveis}</p>
        </div>
        <div className="p-5 border-2 rounded-xl bg-background shadow-sm hover:shadow-md transition-shadow border-orange-500/20">
          <p className="text-sm font-medium text-muted-foreground mb-2">Em Atendimento</p>
          <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">{stats.emAtendimento}</p>
        </div>
        <div className="p-5 border-2 rounded-xl bg-background shadow-sm hover:shadow-md transition-shadow border-purple-500/20">
          <p className="text-sm font-medium text-muted-foreground mb-2">Total Chamados</p>
          <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{stats.totalChamados}</p>
        </div>
        <div className="p-5 border-2 rounded-xl bg-background shadow-sm hover:shadow-md transition-shadow border-emerald-500/20">
          <p className="text-sm font-medium text-muted-foreground mb-2">Concluídos</p>
          <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{stats.chamadosConcluidos}</p>
        </div>
      </div>

      {/* Estatísticas por cargo e status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="p-5 border-2 rounded-xl bg-background shadow-sm">
          <p className="text-base font-semibold mb-4 text-foreground">Distribuição por Cargo</p>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-2 rounded-lg bg-muted/50">
              <span className="text-sm font-medium">Técnicos</span>
              <span className="font-bold text-lg">{stats.porCargo.tecnico}</span>
            </div>
            <div className="flex justify-between items-center p-2 rounded-lg bg-muted/50">
              <span className="text-sm font-medium">Supervisores</span>
              <span className="font-bold text-lg">{stats.porCargo.supervisor}</span>
            </div>
            <div className="flex justify-between items-center p-2 rounded-lg bg-muted/50">
              <span className="text-sm font-medium">Coordenadores</span>
              <span className="font-bold text-lg">{stats.porCargo.coordenador}</span>
            </div>
          </div>
        </div>
        <div className="p-5 border-2 rounded-xl bg-background shadow-sm">
          <p className="text-base font-semibold mb-4 text-foreground">Distribuição por Status</p>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-2 rounded-lg bg-green-500/10 border border-green-500/20">
              <span className="text-sm font-medium">Ativo</span>
              <span className="font-bold text-lg text-green-600 dark:text-green-400">{stats.porStatus.ativo}</span>
            </div>
            <div className="flex justify-between items-center p-2 rounded-lg bg-gray-500/10 border border-gray-500/20">
              <span className="text-sm font-medium">Inativo</span>
              <span className="font-bold text-lg text-gray-600 dark:text-gray-400">{stats.porStatus.inativo}</span>
            </div>
            <div className="flex justify-between items-center p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <span className="text-sm font-medium">Férias</span>
              <span className="font-bold text-lg text-yellow-600 dark:text-yellow-400">{stats.porStatus.ferias}</span>
            </div>
            <div className="flex justify-between items-center p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <span className="text-sm font-medium">Licença</span>
              <span className="font-bold text-lg text-blue-600 dark:text-blue-400">{stats.porStatus.licenca}</span>
            </div>
            <div className="flex justify-between items-center p-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <span className="text-sm font-medium">Desligado</span>
              <span className="font-bold text-lg text-red-600 dark:text-red-400">{stats.porStatus.desligado}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid de cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : filteredTechnicians.length === 0 ? (
        <div className="text-center py-16 px-4">
          <div className="max-w-md mx-auto">
            <div className="mb-4 text-6xl">👷</div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Nenhum técnico encontrado
            </h3>
            <p className="text-muted-foreground mb-6">
              {technicians.length === 0 
                ? 'Comece cadastrando seu primeiro técnico usando o botão acima.'
                : 'Tente ajustar os filtros para encontrar técnicos.'
              }
            </p>
            {technicians.length === 0 && (
              <Button onClick={() => navigate('/cadastrar-tecnico')} size="lg">
                <Plus className="mr-2 h-5 w-5" />
                Cadastrar Primeiro Técnico
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTechnicians.map((tech) => (
            <TechnicianCard
              key={tech.uid}
              technician={tech}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggleAvailability={handleToggleAvailability}
            />
          ))}
        </div>
      )}

      <TechnicianEditDialog
        technician={editingTechnician}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSuccess={handleEditSuccess}
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja desligar o técnico <strong>{deletingTechnician?.nome}</strong> ({deletingTechnician?.codigoTecnico})?
              <br />
              <br />
              Esta ação marcará o técnico como "desligado" e não poderá ser revertida facilmente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Confirmar Exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

