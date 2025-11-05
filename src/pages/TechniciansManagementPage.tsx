import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../hooks/use-permissions';
import { useAuth } from '../context/AuthContext';
import { listTechnicians, updateTechnicianAvailability } from '../lib/technician-firestore';
import { TechnicianCard } from '../components/TechnicianCard';
import { TechnicianEditDialog } from '../components/TechnicianEditDialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Skeleton } from '../components/ui/skeleton';
import { Plus, Search } from 'lucide-react';
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

  useEffect(() => {
    loadTechnicians();
  }, [filter]);

  const loadTechnicians = async () => {
    setLoading(true);
    try {
      const filters: any = {};
      if (filter === 'ativos') {
        filters.status = 'ativo';
      }

      const data = await listTechnicians(
        filter === 'todos' ? undefined : { status: filters.status }
      );

      // Filtrar inativos se necessário
      const filteredData = filter === 'inativos'
        ? data.filter(t => t.status !== 'ativo')
        : data;

      setTechnicians(filteredData);
    } catch (error) {
      console.error('Erro ao carregar técnicos:', error);
      toast.error('Erro ao carregar lista de técnicos');
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

  const filteredTechnicians = technicians.filter(tech => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      tech.nome.toLowerCase().includes(search) ||
      tech.codigoTecnico.toLowerCase().includes(search) ||
      tech.email.toLowerCase().includes(search) ||
      tech.telefone?.includes(search)
    );
  });

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
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Gestão de Técnicos</h1>
          <p className="text-muted-foreground">
            Gerencie a frota de técnicos e distribuição de chamados
          </p>
        </div>
        <Button onClick={() => navigate('/cadastrar-tecnico')}>
          <Plus className="mr-2 h-4 w-4" />
          Cadastrar Técnico
        </Button>
      </div>

      {/* Filtros e busca */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
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

      {/* Estatísticas rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 border rounded-lg">
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="text-2xl font-bold">{technicians.length}</p>
        </div>
        <div className="p-4 border rounded-lg">
          <p className="text-sm text-muted-foreground">Ativos</p>
          <p className="text-2xl font-bold text-green-600">
            {technicians.filter(t => t.status === 'ativo').length}
          </p>
        </div>
        <div className="p-4 border rounded-lg">
          <p className="text-sm text-muted-foreground">Disponíveis</p>
          <p className="text-2xl font-bold text-blue-600">
            {technicians.filter(t => t.disponivel).length}
          </p>
        </div>
        <div className="p-4 border rounded-lg">
          <p className="text-sm text-muted-foreground">Em Atendimento</p>
          <p className="text-2xl font-bold text-orange-600">
            {technicians.reduce((acc, t) => acc + (t.chamadosEmAndamento || 0), 0)}
          </p>
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
        <div className="text-center py-12">
          <p className="text-muted-foreground">Nenhum técnico encontrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTechnicians.map((tech) => (
            <TechnicianCard
              key={tech.uid}
              technician={tech}
              onEdit={handleEdit}
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
    </div>
  );
}

