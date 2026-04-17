import { useState } from 'react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import {
  Database, Loader2, CheckCircle2, AlertTriangle, Building2,
  Wrench, Package, ClipboardList, Users, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { seedTestData, type SeedResult } from '../lib/seed-data';
import { Navigate } from 'react-router-dom';
import { cn } from '../lib/utils';

export default function SeedPage() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SeedResult | null>(null);

  if (profile?.role !== 'admin') return <Navigate to="/" replace />;

  const handleSeed = async () => {
    setLoading(true);
    setResult(null);
    try {
      const r = await seedTestData(user!.uid, profile?.nome ?? 'Admin');
      setResult(r);
      toast.success('Dados de teste criados com sucesso!');
    } catch (e: any) {
      console.error(e);
      toast.error('Erro ao criar dados de teste: ' + (e?.message ?? String(e)));
    } finally {
      setLoading(false);
    }
  };

  const items: Array<{ icon: React.ElementType; label: string; desc: string; count?: number | string }> = [
    { icon: Building2,    label: 'Clientes',            desc: '3 empresas contratantes (BB, Itaú, Bradesco)',      count: result?.clientes },
    { icon: Wrench,       label: 'Tipos de Serviço',    desc: '5 serviços com receita, custo e regras',            count: result?.servicos },
    { icon: Package,      label: 'Itens de Estoque',    desc: '10 itens com quantidade inicial e mínimo definido', count: result?.estoqueItens },
    { icon: ClipboardList,label: 'Chamados',            desc: '13 chamados em vários status (rascunho → pago)',     count: result?.chamados },
    { icon: Users,        label: 'Técnicos',            desc: 'Use o formulário de cadastro → "Preencher exemplo"', count: '—' },
  ];

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 space-y-6 animate-page-in">
      {/* Header */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300" />
        <div className="flex items-start gap-4 px-6 py-5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
            <Database className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Dados de Teste</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Cria registros fictícios no Firestore para verificar a funcionalidade do sistema.
              Execute quantas vezes quiser — não sobrescreve dados existentes.
            </p>
          </div>
        </div>
      </div>

      {/* O que será criado */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">O que será criado</p>
        <div className="space-y-2">
          {items.map(({ icon: Icon, label, desc, count }) => (
            <div key={label} className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm',
              result ? 'bg-muted/50' : 'bg-transparent',
            )}>
              <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-medium">{label}</span>
                <span className="text-muted-foreground ml-2 text-xs">{desc}</span>
              </div>
              {result !== null && (
                <Badge variant={count === '—' ? 'secondary' : 'default'} className="shrink-0 text-xs">
                  {count === '—' ? 'manual' : `+${count}`}
                </Badge>
              )}
              {result === null && (
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Avisos */}
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p className="font-medium">Atenção</p>
          <ul className="list-disc list-inside text-xs space-y-0.5 text-amber-600 dark:text-amber-400/80">
            <li>Os dados são criados no Firestore de <strong>produção</strong>. Lembre de limpar depois.</li>
            <li>Técnicos precisam de Firebase Auth — cadastre pelo formulário com "Preencher exemplo".</li>
            <li>Os chamados referenciam técnicos ativos existentes. Se não houver técnicos, usarão placeholder.</li>
          </ul>
        </div>
      </div>

      {/* Resultado */}
      {result && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/5 px-5 py-4 space-y-2">
          <p className="font-semibold text-green-700 dark:text-green-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Dados criados com sucesso
          </p>
          <p className="text-xs text-muted-foreground">
            {result.clientes} clientes · {result.servicos} serviços · {result.estoqueItens} itens de estoque ·{' '}
            {result.chamados} chamados · {result.estoqueEntradas} entradas de estoque
          </p>
          {result.warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3" /> {w}
            </p>
          ))}
        </div>
      )}

      {/* Ação */}
      <Button
        size="lg"
        className="w-full gap-2"
        onClick={handleSeed}
        disabled={loading}
        variant={result ? 'outline' : 'default'}
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Criando dados…</>
        ) : result ? (
          <><Database className="w-4 h-4" /> Criar mais dados</>
        ) : (
          <><Database className="w-4 h-4" /> Criar dados de teste agora</>
        )}
      </Button>
    </div>
  );
}
