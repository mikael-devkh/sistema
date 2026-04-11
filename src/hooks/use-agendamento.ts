import { useQuery, useQueryClient } from '@tanstack/react-query';
import { subDays, format, parseISO } from 'date-fns';
import { searchIssues, parseIssue } from '../lib/jiraScheduling';
import { JQL, STATUS, STATUS_IDS } from '../lib/schedulingConstants';
import type {
  AgendamentoData,
  KpiData,
  LojaGroup,
  SchedulingIssue,
  TrendPoint,
  RouteGroup,
} from '../types/scheduling';

const QUERY_KEY = ['agendamento-data'] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildLojaGroups(issues: SchedulingIssue[]): Map<string, LojaGroup> {
  const map = new Map<string, LojaGroup>();

  for (const issue of issues) {
    const { loja, cidade, uf, endereco, cep, updated } = issue;
    if (!map.has(loja)) {
      map.set(loja, { loja, cidade, uf, qtd: 0, lastUpdated: null, endereco, cep, isCritical: false, issues: [] });
    }
    const g = map.get(loja)!;
    g.qtd += 1;
    g.issues.push(issue);
    if (cidade && !g.cidade) g.cidade = cidade;
    if (uf && !g.uf) g.uf = uf;
    if (endereco && !g.endereco) g.endereco = endereco;
    if (cep && !g.cep) g.cep = cep;
    if (updated && (!g.lastUpdated || updated > g.lastUpdated)) g.lastUpdated = updated;
  }

  // Compute isCritical
  for (const g of map.values()) {
    const stale = g.lastUpdated
      ? (Date.now() - g.lastUpdated.getTime()) > 7 * 86_400_000
      : false;
    g.isCritical = g.qtd >= 5 || stale;
  }

  return map;
}

function computeTrend(allIssues: SchedulingIssue[], resolvidos: SchedulingIssue[], days: number): TrendPoint[] {
  const points: TrendPoint[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const day = subDays(today, i);
    const label = format(day, 'dd/MM');
    const dayStr = format(day, 'yyyy-MM-dd');

    const novos = allIssues.filter(iss => iss.created && format(iss.created, 'yyyy-MM-dd') === dayStr).length;
    const resol = resolvidos.filter(iss => iss.resolutiondate && format(iss.resolutiondate, 'yyyy-MM-dd') === dayStr).length;
    points.push({ label, Novos: novos, Resolvidos: resol });
  }
  return points;
}

function computeRouteGroups(allLojas: LojaGroup[]): RouteGroup[] {
  const byCep = new Map<string, { cidade: string; lojas: string[] }>();
  for (const g of allLojas) {
    const cepClean = g.cep.replace(/\D/g, '');
    if (cepClean.length < 5) continue;
    const prefix = cepClean.slice(0, 5);
    if (!byCep.has(prefix)) byCep.set(prefix, { cidade: g.cidade, lojas: [] });
    byCep.get(prefix)!.lojas.push(g.loja);
  }
  return [...byCep.entries()]
    .filter(([, v]) => v.lojas.length > 1)
    .map(([cepPrefix, v]) => ({ cepPrefix, cidade: v.cidade, lojas: v.lojas }));
}

// ─── Main fetch function ──────────────────────────────────────────────────────

async function fetchAgendamentoData(): Promise<AgendamentoData> {
  const today = new Date();
  const fromDay = subDays(today, 14);
  const jqlRes = JQL.RESOLVIDOS(format(fromDay, 'yyyy-MM-dd'), format(today, 'yyyy-MM-dd'));

  // Fetch in parallel
  const [comboRaw, resolvidosRaw] = await Promise.all([
    searchIssues(JQL.COMBINADA, 600),
    searchIssues(jqlRes, 600),
  ]);

  const allIssues = comboRaw.map(parseIssue);
  const resolvidosIssues = resolvidosRaw.map(parseIssue);

  // Split by status
  const pendentesIssues: SchedulingIssue[] = [];
  const agendadosIssues: SchedulingIssue[] = [];
  const tecCampoIssues: SchedulingIssue[] = [];
  const kpi: KpiData = { agendamento: 0, agendado: 0, tecCampo: 0, lojasMultiplas: 0 };

  for (const issue of allIssues) {
    const sid = issue.statusId;
    const sname = issue.status;
    if (sid === STATUS_IDS.AGENDAMENTO || sname === STATUS.AGENDAMENTO) {
      pendentesIssues.push(issue);
      kpi.agendamento++;
    } else if (sid === STATUS_IDS.AGENDADO || sname === STATUS.AGENDADO) {
      agendadosIssues.push(issue);
      kpi.agendado++;
    } else if (sid === STATUS_IDS.TEC_CAMPO || sname === STATUS.TEC_CAMPO) {
      tecCampoIssues.push(issue);
      kpi.tecCampo++;
    }
  }

  // Build loja groups
  const allLojaMap = buildLojaGroups(allIssues);
  kpi.lojasMultiplas = [...allLojaMap.values()].filter(g => g.qtd >= 2).length;

  const pendentesMap = buildLojaGroups(pendentesIssues);
  const agendadosMap = buildLojaGroups(agendadosIssues);
  const tecCampoMap = buildLojaGroups(tecCampoIssues);

  // Group agendados by date
  const agendadosByDate = new Map<string, LojaGroup[]>();
  for (const issue of agendadosIssues) {
    let dateStr = 'Não definida';
    if (issue.dataAgenda) {
      try { dateStr = format(parseISO(issue.dataAgenda), 'dd/MM/yyyy'); } catch { /* keep default */ }
    }
    if (!agendadosByDate.has(dateStr)) agendadosByDate.set(dateStr, []);
    // Find or create loja group for this date+loja
    let dateLojas = agendadosByDate.get(dateStr)!;
    let lojaGrp = dateLojas.find(g => g.loja === issue.loja);
    if (!lojaGrp) {
      const fullGroup = agendadosMap.get(issue.loja);
      if (fullGroup) {
        lojaGrp = { ...fullGroup, issues: [] };
        dateLojas.push(lojaGrp);
      }
    }
    lojaGrp?.issues.push(issue);
  }

  const top5 = [...allLojaMap.values()]
    .sort((a, b) => b.qtd - a.qtd)
    .slice(0, 5);

  const trendPoints = computeTrend(allIssues, resolvidosIssues, 14);

  return {
    pendentes: [...pendentesMap.values()].sort((a, b) => a.loja.localeCompare(b.loja)),
    agendados: agendadosByDate,
    tecCampo: [...tecCampoMap.values()].sort((a, b) => a.loja.localeCompare(b.loja)),
    kpi,
    top5,
    trendPoints,
    allIssues,
    allLojaGroups: [...allLojaMap.values()],
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAgendamentoData() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchAgendamentoData,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: QUERY_KEY });

  return { ...query, refresh };
}

export function useRouteGroups(allLojaGroups: LojaGroup[]): RouteGroup[] {
  return computeRouteGroups(allLojaGroups);
}
