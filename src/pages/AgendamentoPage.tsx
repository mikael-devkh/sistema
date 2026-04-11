import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';
import { Loader2, RefreshCw, ChevronDown, ChevronRight, Zap } from 'lucide-react';

import { useAgendamentoData, useRouteGroups } from '../hooks/use-agendamento';
import { KpiCards } from '../components/scheduling/KpiCards';
import { TrendChart } from '../components/scheduling/TrendChart';
import { StoreHighlights } from '../components/scheduling/StoreHighlights';
import { LojaExpander } from '../components/scheduling/LojaExpander';
import { TransitionPanel } from '../components/scheduling/TransitionPanel';
import { ReqTracker } from '../components/scheduling/ReqTracker';
import { GerenteTab } from '../components/scheduling/GerenteTab';
import { PlanilhaInterna } from '../components/scheduling/PlanilhaInterna';

import type { LojaGroup } from '../types/scheduling';
import { format } from 'date-fns';

// ─── Pending tab ──────────────────────────────────────────────────────────────

function PendentesTab({
  groups,
  agendadoLojas,
  tecCampoLojas,
  onTransition,
  onScheduled,
}: {
  groups: LojaGroup[];
  agendadoLojas: Set<string>;
  tecCampoLojas: Set<string>;
  onTransition: (loja: string) => void;
  onScheduled: () => void;
}) {
  const [filter, setFilter] = useState('');
  const filtered = filter
    ? groups.filter(g => g.loja.toLowerCase().includes(filter.toLowerCase()) || g.cidade.toLowerCase().includes(filter.toLowerCase()))
    : groups;

  return (
    <div className="space-y-3">
      <Input placeholder="🔎 Filtrar por loja ou cidade…" value={filter} onChange={e => setFilter(e.target.value)} className="max-w-sm h-8" />
      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground py-6 text-center">Nenhum chamado em AGENDAMENTO.</p>
      )}
      {filtered.map(g => {
        const outras: string[] = [];
        if (agendadoLojas.has(g.loja)) outras.push('Agendado');
        if (tecCampoLojas.has(g.loja)) outras.push('TEC-CAMPO');
        const warning = outras.length
          ? `Esta loja já possui chamado(s) na fila ${outras.join(' e ')}. Verifique se há técnico designado.`
          : undefined;

        return (
          <LojaExpander
            key={g.loja}
            group={g}
            showForm
            warningText={warning}
            onScheduled={onScheduled}
            extra={
              <button
                className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 hover:bg-primary/20 text-primary transition"
                onClick={e => { e.stopPropagation(); onTransition(g.loja); }}
              >
                🚚 Transição em massa
              </button>
            }
          />
        );
      })}
    </div>
  );
}

// ─── Agendados tab ────────────────────────────────────────────────────────────

function AgendadosTab({ agendados }: { agendados: Map<string, LojaGroup[]> }) {
  const [filter, setFilter] = useState('');
  const entries = [...agendados.entries()].sort(([a], [b]) => a.localeCompare(b));

  const filterFn = (g: LojaGroup) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return g.loja.toLowerCase().includes(q) || g.cidade.toLowerCase().includes(q);
  };

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">Nenhum chamado Agendado.</p>;
  }

  return (
    <div className="space-y-4">
      <Input placeholder="🔎 Filtrar por loja ou cidade…" value={filter} onChange={e => setFilter(e.target.value)} className="max-w-sm h-8" />
      {entries.map(([date, lojas]) => {
        const filtered = lojas.filter(filterFn);
        if (!filtered.length) return null;
        const total = filtered.reduce((s, g) => s + g.qtd, 0);

        // Check duplicates per loja (same pdv+ativo)
        return (
          <div key={date}>
            <p className="text-sm font-semibold mb-2">{date} — {total} chamado(s)</p>
            <div className="space-y-1">
              {filtered.map(g => {
                const pdvAtivos = g.issues.map(i => `${i.pdv}||${i.ativo}`);
                const dupes = pdvAtivos.filter((v, i, a) => a.indexOf(v) !== i);
                const dupKeys = g.issues.filter(i => dupes.includes(`${i.pdv}||${i.ativo}`)).map(i => i.key);
                const extra = dupKeys.length
                  ? <Badge variant="outline" className="text-[10px] border-orange-400 text-orange-500">Dup: {dupKeys.join(', ')}</Badge>
                  : undefined;

                return <LojaExpander key={`${date}-${g.loja}`} group={g} extra={extra} />;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── TEC-CAMPO tab ────────────────────────────────────────────────────────────

function TecCampoTab({ groups }: { groups: LojaGroup[] }) {
  const [filter, setFilter] = useState('');
  const filtered = filter
    ? groups.filter(g => g.loja.toLowerCase().includes(filter.toLowerCase()) || g.cidade.toLowerCase().includes(filter.toLowerCase()))
    : groups;

  if (filtered.length === 0 && !filter) {
    return <p className="text-sm text-muted-foreground py-6 text-center">Nenhum chamado em TEC-CAMPO.</p>;
  }

  return (
    <div className="space-y-3">
      <Input placeholder="🔎 Filtrar por loja ou cidade…" value={filter} onChange={e => setFilter(e.target.value)} className="max-w-sm h-8" />
      {filtered.map(g => <LojaExpander key={g.loja} group={g} />)}
      {filtered.length === 0 && filter && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma loja encontrada.</p>}
    </div>
  );
}

// ─── Route Optimization ───────────────────────────────────────────────────────

function RouteOptimization({ allLojaGroups }: { allLojaGroups: LojaGroup[] }) {
  const routes = useRouteGroups(allLojaGroups);
  if (!routes.length) return <p className="text-xs text-muted-foreground">Nenhuma loja muito próxima identificada no momento.</p>;

  return (
    <div className="space-y-2">
      {routes.map(r => (
        <div key={r.cepPrefix} className="flex items-start gap-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded text-xs">
          <span>🛣️</span>
          <span>
            <strong>{r.cidade} (CEP {r.cepPrefix}-xxx):</strong>{' '}
            As lojas <strong>{r.lojas.join(', ')}</strong> estão na mesma zona. Considere enviar o mesmo técnico!
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Top 5 cards ──────────────────────────────────────────────────────────────

function Top5Lojas({ top5 }: { top5: LojaGroup[] }) {
  if (!top5.length) return <p className="text-sm text-muted-foreground">Sem dados para o ranking.</p>;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {top5.map(g => (
        <Card key={g.loja} className={`${g.isCritical ? 'border-destructive/50' : ''}`}>
          <CardContent className="p-3 space-y-1">
            <div className="text-xs text-muted-foreground truncate">{g.isCritical ? '🔴 ' : ''}{g.loja}</div>
            <div className="text-xs text-muted-foreground">{g.cidade} {g.uf ? `– ${g.uf}` : ''}</div>
            <div className="text-2xl font-bold">{g.qtd}</div>
            {g.lastUpdated && (
              <div className="text-[10px] text-muted-foreground">
                Últ: {format(g.lastUpdated, 'dd/MM HH:mm')}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AgendamentoPage() {
  const { data, isLoading, isError, error, refresh } = useAgendamentoData();
  const [transitionLoja, setTransitionLoja] = useState<string | null>(null);
  const [transitionOpen, setTransitionOpen] = useState(false);
  const [highlightsOpen, setHighlightsOpen] = useState(false);

  const openTransition = (loja: string) => {
    setTransitionLoja(loja);
    setTransitionOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Carregando chamados do Jira…</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-4">
        <div className="text-center space-y-3 max-w-md">
          <div className="text-4xl">❌</div>
          <h2 className="text-lg font-semibold">Erro ao carregar dados do Jira</h2>
          <p className="text-sm text-muted-foreground">{(error as Error)?.message}</p>
          <Button onClick={refresh}>Tentar novamente</Button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { pendentes, agendados, tecCampo, kpi, top5, trendPoints, allIssues, allLojaGroups } = data;
  const agendadoLojas = new Set([...agendados.values()].flatMap(gs => gs.map(g => g.loja)));
  const tecCampoLojas = new Set(tecCampo.map(g => g.loja));

  return (
    <div className="space-y-4 pb-10">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">📱 Painel de Agendamentos</h1>
          <p className="text-sm text-muted-foreground">Field Service – Jira FSA</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={refresh}>
            <RefreshCw className="w-4 h-4 mr-1" /> Atualizar
          </Button>
          <Button size="sm" onClick={() => openTransition('')}>
            <Zap className="w-4 h-4 mr-1" /> Transição em massa
          </Button>
        </div>
      </div>

      {/* Main tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">📊 Visão Geral</TabsTrigger>
          <TabsTrigger value="chamados">
            📋 Chamados
            <Badge variant="secondary" className="ml-1.5 text-[10px]">
              {kpi.agendamento + kpi.agendado + kpi.tecCampo}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="reqs">🔍 Rastreador REQs</TabsTrigger>
          <TabsTrigger value="gerente">👤 Gerente</TabsTrigger>
          <TabsTrigger value="planilha">📋 Planilha</TabsTrigger>
        </TabsList>

        {/* ── Visão Geral ── */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          <KpiCards kpi={kpi} />

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">📌 Top 5 Lojas Críticas</CardTitle></CardHeader>
            <CardContent><Top5Lojas top5={top5} /></CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">📈 Tendência (14 dias)</CardTitle></CardHeader>
            <CardContent><TrendChart data={trendPoints} /></CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">🛣️ Otimização de Rotas</CardTitle></CardHeader>
            <CardContent><RouteOptimization allLojaGroups={allLojaGroups} /></CardContent>
          </Card>
        </TabsContent>

        {/* ── Chamados ── */}
        <TabsContent value="chamados" className="space-y-4 mt-4">
          {/* Store highlights collapsible */}
          <Collapsible open={highlightsOpen} onOpenChange={setHighlightsOpen}>
            <CollapsibleTrigger asChild>
              <button className="flex w-full items-center justify-between px-3 py-2 bg-muted/50 rounded-md hover:bg-muted transition text-sm font-medium">
                🏷️ Lojas com N+ chamados
                {highlightsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border border-border/50 rounded-md p-4 mt-1">
                <StoreHighlights lojaGroups={allLojaGroups} />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Sub-tabs */}
          <Tabs defaultValue="pendentes">
            <TabsList>
              <TabsTrigger value="pendentes">
                ⏳ Pendentes
                <Badge variant="secondary" className="ml-1.5 text-[10px]">{kpi.agendamento}</Badge>
              </TabsTrigger>
              <TabsTrigger value="agendados">
                📋 Agendados
                <Badge variant="secondary" className="ml-1.5 text-[10px]">{kpi.agendado}</Badge>
              </TabsTrigger>
              <TabsTrigger value="tec-campo">
                🧰 TEC-CAMPO
                <Badge variant="secondary" className="ml-1.5 text-[10px]">{kpi.tecCampo}</Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pendentes" className="mt-4">
              <PendentesTab
                groups={pendentes}
                agendadoLojas={agendadoLojas}
                tecCampoLojas={tecCampoLojas}
                onTransition={openTransition}
                onScheduled={refresh}
              />
            </TabsContent>

            <TabsContent value="agendados" className="mt-4">
              <AgendadosTab agendados={agendados} />
            </TabsContent>

            <TabsContent value="tec-campo" className="mt-4">
              <TecCampoTab groups={tecCampo} />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ── Rastreador REQs ── */}
        <TabsContent value="reqs" className="mt-4">
          <ReqTracker allIssues={allIssues} />
        </TabsContent>

        {/* ── Gerente ── */}
        <TabsContent value="gerente" className="mt-4">
          <GerenteTab allLojaGroups={allLojaGroups} />
        </TabsContent>

        {/* ── Planilha ── */}
        <TabsContent value="planilha" className="mt-4">
          <PlanilhaInterna issues={allIssues} />
        </TabsContent>
      </Tabs>

      {/* Transition slide-over panel */}
      <TransitionPanel
        open={transitionOpen}
        onClose={() => setTransitionOpen(false)}
        loja={transitionLoja}
        allLojaGroups={allLojaGroups}
        pendentes={pendentes}
        agendados={agendados}
        tecCampo={tecCampo}
        onSuccess={refresh}
      />
    </div>
  );
}
