import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { 
  MoreVertical, 
  Edit, 
  Trash2,
  CheckCircle2,
  XCircle,
  User,
  Phone,
  MapPin
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import type { TechnicianProfile } from '../types/technician';

interface TechnicianCardProps {
  technician: TechnicianProfile;
  onEdit?: (tech: TechnicianProfile) => void;
  onDelete?: (uid: string) => void;
  onToggleAvailability?: (uid: string, disponivel: boolean) => void;
}

export function TechnicianCard({
  technician,
  onEdit,
  onDelete,
  onToggleAvailability,
}: TechnicianCardProps) {
  const initials = technician.nome
    .split(' ')
    .slice(0, 2)
    .map(s => s.charAt(0).toUpperCase())
    .join('') || 'T';

  const statusColors: Record<string, string> = {
    ativo: 'bg-green-500',
    inativo: 'bg-gray-500',
    ferias: 'bg-yellow-500',
    licenca: 'bg-blue-500',
    desligado: 'bg-red-500',
  };

  const cargoLabels: Record<string, string> = {
    tecnico: 'Técnico',
    supervisor: 'Supervisor',
    coordenador: 'Coordenador',
  };

  return (
    <Card className="hover:shadow-lg transition-all border-2 hover:border-primary/50 bg-background">
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={technician.avatarUrl} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold">{technician.nome}</h3>
              <p className="text-sm text-muted-foreground">
                {technician.codigoTecnico}
              </p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit(technician)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Editar
                </DropdownMenuItem>
              )}
              {onToggleAvailability && (
                <DropdownMenuItem
                  onClick={() => onToggleAvailability(technician.uid, !technician.disponivel)}
                >
                  {technician.disponivel ? (
                    <>
                      <XCircle className="mr-2 h-4 w-4" />
                      Marcar como Indisponível
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Marcar como Disponível
                    </>
                  )}
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  onClick={() => onDelete(technician.uid)}
                  className="text-red-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span>{cargoLabels[technician.cargo] || technician.cargo}</span>
          </div>
          {technician.telefone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{technician.telefone}</span>
            </div>
          )}
          {technician.cidade && technician.uf && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{technician.cidade}, {technician.uf}</span>
            </div>
          )}
          {technician.pagamento?.pix && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>PIX: {technician.pagamento.pix}</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {technician.especialidades?.slice(0, 3).map((esp) => (
            <Badge key={esp} variant="secondary" className="text-xs">
              {esp}
            </Badge>
          ))}
          {technician.especialidades && technician.especialidades.length > 3 && (
            <Badge variant="secondary" className="text-xs">
              +{technician.especialidades.length - 3}
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                technician.disponivel ? 'bg-green-500' : 'bg-gray-400'
              }`}
            />
            <span className="text-sm text-muted-foreground">
              {technician.disponivel ? 'Disponível' : 'Indisponível'}
            </span>
          </div>
          <Badge
            variant="outline"
            style={{
              backgroundColor: technician.status === 'ativo' ? '#10b981' : 
                               technician.status === 'inativo' ? '#6b7280' :
                               technician.status === 'ferias' ? '#eab308' :
                               technician.status === 'licenca' ? '#3b82f6' :
                               technician.status === 'desligado' ? '#ef4444' : '#6b7280',
              color: 'white',
              border: 'none'
            }}
          >
            {technician.status}
          </Badge>
        </div>

        {(technician.totalChamados !== undefined || technician.avaliacaoMedia !== undefined) && (
          <div className="mt-3 pt-3 border-t text-xs text-muted-foreground space-y-1">
            {technician.totalChamados !== undefined && (
              <div className="flex justify-between">
                <span>Chamados:</span>
                <span className="font-medium">{technician.totalChamados || 0}</span>
              </div>
            )}
            {technician.chamadosConcluidos !== undefined && (
              <div className="flex justify-between">
                <span>Concluídos:</span>
                <span className="font-medium text-green-600">{technician.chamadosConcluidos}</span>
              </div>
            )}
            {technician.chamadosEmAndamento !== undefined && technician.chamadosEmAndamento > 0 && (
              <div className="flex justify-between">
                <span>Em Andamento:</span>
                <span className="font-medium text-orange-600">{technician.chamadosEmAndamento}</span>
              </div>
            )}
            {technician.avaliacaoMedia !== undefined && technician.avaliacaoMedia > 0 && (
              <div className="flex justify-between">
                <span>Avaliação Média:</span>
                <span className="font-medium text-yellow-600">
                  {technician.avaliacaoMedia.toFixed(1)} ⭐
                </span>
              </div>
            )}
            {technician.mediaTempoAtendimento !== undefined && technician.mediaTempoAtendimento > 0 && (
              <div className="flex justify-between">
                <span>Tempo Médio:</span>
                <span className="font-medium">
                  {Math.round(technician.mediaTempoAtendimento)} min
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

