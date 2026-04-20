import { useState, useRef } from 'react';
import QRCode from 'react-qr-code';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import {
  MoreVertical,
  Edit,
  Trash2,
  CheckCircle2,
  XCircle,
  User,
  Phone,
  MapPin,
  Users,
  Wallet,
  Radius,
  IdCard,
  Printer,
  Eye,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import type { TechnicianProfile } from '../types/technician';

interface TechnicianCardProps {
  technician: TechnicianProfile;
  onEdit?: (tech: TechnicianProfile) => void;
  onDelete?: (uid: string) => void;
  onToggleAvailability?: (uid: string, disponivel: boolean) => void;
  onViewDetails?: (tech: TechnicianProfile) => void;
}

// ─── CrachaDialog ─────────────────────────────────────────────────────────────

function CrachaDialog({ technician, open, onClose }: {
  technician: TechnicianProfile;
  open: boolean;
  onClose: () => void;
}) {
  const badgeRef = useRef<HTMLDivElement>(null);
  const qrValue = `${window.location.origin}/tecnicos/${technician.uid}`;
  const isAtivo = technician.status === 'ativo';

  const handlePrint = () => {
    const content = badgeRef.current;
    if (!content) return;
    const win = window.open('', '_blank', 'width=400,height=600');
    if (!win) return;
    win.document.write(`
      <html><head><title>Crachá — ${technician.nome}</title>
      <style>
        body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f5f5f5; font-family: sans-serif; }
        .badge { width: 300px; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,.15); }
        .top { background: ${isAtivo ? '#10b981' : '#64748b'}; padding: 24px 16px 16px; text-align: center; color: white; }
        .avatar { width: 72px; height: 72px; border-radius: 50%; background: rgba(255,255,255,.25); display: flex; align-items: center; justify-content: center; font-size: 26px; font-weight: 700; margin: 0 auto 10px; border: 3px solid rgba(255,255,255,.6); }
        .name { font-size: 18px; font-weight: 700; margin: 0; }
        .code { font-size: 12px; opacity: .85; margin-top: 2px; font-family: monospace; }
        .body { padding: 16px; text-align: center; }
        .role { font-size: 13px; color: #64748b; margin-bottom: 12px; }
        .status { display: inline-block; padding: 3px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; background: ${isAtivo ? '#dcfce7' : '#f1f5f9'}; color: ${isAtivo ? '#16a34a' : '#64748b'}; margin-bottom: 16px; }
        .qr { display: flex; justify-content: center; margin-bottom: 12px; }
        .footer { font-size: 10px; color: #94a3b8; text-align: center; padding-bottom: 12px; }
      </style></head><body>
      ${content.innerHTML}
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  const initials = technician.nome.split(' ').slice(0, 2).map(s => s[0]?.toUpperCase() ?? '').join('');
  const cargoLabel: Record<string, string> = { tecnico: 'Técnico de Campo', supervisor: 'Supervisor', coordenador: 'Coordenador' };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IdCard className="w-5 h-5 text-primary" /> Crachá do Técnico
          </DialogTitle>
        </DialogHeader>

        {/* Badge preview */}
        <div ref={badgeRef}>
          <div className="badge" style={{ width: '100%', background: 'white', borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
            <div className="top" style={{ background: isAtivo ? '#10b981' : '#64748b', padding: '24px 16px 16px', textAlign: 'center', color: 'white' }}>
              <div className="avatar" style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,255,255,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 700, margin: '0 auto 10px', border: '3px solid rgba(255,255,255,.6)' }}>
                {technician.avatarUrl
                  ? <img src={technician.avatarUrl} alt="" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover' }} />
                  : initials}
              </div>
              <p className="name" style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{technician.nome}</p>
              <p className="code" style={{ fontSize: 12, opacity: .85, marginTop: 2, fontFamily: 'monospace' }}>{technician.codigoTecnico}</p>
            </div>
            <div className="body" style={{ padding: 16, textAlign: 'center' }}>
              <p className="role" style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>{cargoLabel[technician.cargo] ?? technician.cargo}</p>
              <span className="status" style={{ display: 'inline-block', padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: isAtivo ? '#dcfce7' : '#f1f5f9', color: isAtivo ? '#16a34a' : '#64748b', marginBottom: 16 }}>
                {isAtivo ? '● Ativo' : '○ Inativo'}
              </span>
              <div className="qr" style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                <QRCode value={qrValue} size={120} />
              </div>
              <p className="footer" style={{ fontSize: 10, color: '#94a3b8' }}>Escaneie para verificar o perfil</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={handlePrint} className="gap-1.5">
            <Printer className="w-4 h-4" /> Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TechnicianCard({
  technician,
  onEdit,
  onDelete,
  onToggleAvailability,
  onViewDetails,
}: TechnicianCardProps) {
  const [crachaOpen, setCrachaOpen] = useState(false);

  const initials = technician.nome
    .split(' ')
    .slice(0, 2)
    .map(s => s.charAt(0).toUpperCase())
    .join('') || 'T';

  const cargoLabels: Record<string, string> = {
    tecnico: 'Técnico',
    supervisor: 'Supervisor',
    coordenador: 'Coordenador',
  };

  const statusConfig: Record<string, { label: string; className: string }> = {
    ativo:     { label: "Ativo",     className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
    inativo:   { label: "Inativo",   className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
    ferias:    { label: "Férias",    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
    licenca:   { label: "Licença",   className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
    desligado: { label: "Desligado", className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  };

  const statusInfo = statusConfig[technician.status] ?? { label: technician.status, className: "bg-muted text-muted-foreground" };

  return (
    <>
    <Card className="hover:shadow-md transition-shadow bg-card border-border overflow-hidden">
      {/* Colored accent bar based on availability */}
      <div className={`h-0.5 ${technician.disponivel && technician.status === 'ativo' ? 'bg-emerald-500' : 'bg-border'}`} />
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
              {onViewDetails && (
                <DropdownMenuItem onClick={() => onViewDetails(technician)}>
                  <Eye className="mr-2 h-4 w-4" />
                  Ver Detalhes
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setCrachaOpen(true)}>
                <IdCard className="mr-2 h-4 w-4" />
                Gerar Crachá
              </DropdownMenuItem>
              <DropdownMenuSeparator />
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
          {technician.areaAtendimento?.atendeArredores && technician.areaAtendimento?.raioKm ? (
            <div className="flex items-center gap-2 text-sm">
              <Radius className="h-4 w-4 text-muted-foreground" />
              <span>
                Atende arredores — raio {technician.areaAtendimento.raioKm} km
              </span>
            </div>
          ) : null}
          {technician.tecnicoPaiCodigo && (
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">
                Subcontratado de {technician.tecnicoPaiCodigo}
                {technician.tecnicoPaiNome ? ` — ${technician.tecnicoPaiNome}` : ''}
              </span>
            </div>
          )}
          {technician.tecnicoPaiCodigo && technician.pagamentoPara === 'parent' && (
            <div className="flex items-center gap-2 text-sm">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <span className="text-amber-700 dark:text-amber-400">
                Pagamento para técnico pai
              </span>
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
            <div className={`w-2 h-2 rounded-full ${technician.disponivel ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
            <span className="text-sm text-muted-foreground">
              {technician.disponivel ? 'Disponível' : 'Indisponível'}
            </span>
          </div>
          <span className={`text-[11px] font-semibold rounded-full px-2.5 py-0.5 ${statusInfo.className}`}>
            {statusInfo.label}
          </span>
        </div>

        {onViewDetails && (
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-3 gap-1.5 text-xs"
            onClick={() => onViewDetails(technician)}
          >
            <Eye className="h-3.5 w-3.5" />
            Ver Detalhes e Histórico
          </Button>
        )}

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

    <CrachaDialog
      technician={technician}
      open={crachaOpen}
      onClose={() => setCrachaOpen(false)}
    />
    </>
  );
}

