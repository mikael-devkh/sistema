import type { LojaGroup, SchedulingIssue } from '../types/scheduling';

type IssueKind = 'Terminal' | 'Manutencao';

function isTerminalIssue(issue: SchedulingIssue): boolean {
  return issue.problema.includes('Projeto Terminal de Consulta') || issue.ativo === '--';
}

function issueKind(issue: SchedulingIssue): IssueKind {
  return isTerminalIssue(issue) ? 'Terminal' : 'Manutencao';
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('pt-BR');
}

function cleanText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function statusFromIssue(issue: SchedulingIssue): string {
  const status = cleanText(issue.status);
  return status || 'Sem status';
}

function uniqueIssues(issues: SchedulingIssue[]): SchedulingIssue[] {
  const seen = new Set<string>();
  return issues.filter(issue => {
    if (seen.has(issue.key)) return false;
    seen.add(issue.key);
    return true;
  });
}

function buildStoreStudyRows(groups: LojaGroup[]) {
  return groups
    .filter(group => group.qtd >= 2)
    .map(group => {
      const terminal = group.issues.filter(isTerminalIssue);
      const normal = group.issues.filter(issue => !isTerminalIssue(issue));
      const statuses = [...new Set(group.issues.map(statusFromIssue))].join(' | ');
      const fsas = group.issues.map(issue => issue.key).join(', ');
      const problemas = group.issues.map(issue => `${issue.key}: ${cleanText(issue.problema)}`).join(' | ');
      const tecnicos = [...new Set(group.issues.map(issue => cleanText(issue.tecnico)).filter(Boolean))].join(', ');

      return {
        Loja: group.loja,
        Cidade: group.cidade,
        UF: group.uf,
        'Total chamados': group.qtd,
        'Chamados manutencao': normal.length,
        'Chamados terminal': terminal.length,
        'Tem terminal?': terminal.length > 0 ? 'Sim' : 'Nao',
        'Status encontrados': statuses,
        'SLA grupo': group.slaGroupStatus,
        Critica: group.isCritical ? 'Sim' : 'Nao',
        'Ultima atualizacao': formatDate(group.lastUpdated),
        Tecnicos: tecnicos,
        FSAs: fsas,
        'Problemas detalhados': problemas,
      };
    })
    .sort((a, b) => b['Total chamados'] - a['Total chamados'] || String(a.Loja).localeCompare(String(b.Loja), 'pt-BR'));
}

function buildIssueRows(issues: SchedulingIssue[]) {
  return uniqueIssues(issues)
    .map(issue => ({
      Tipo: issueKind(issue),
      FSA: issue.key,
      Loja: issue.loja,
      PDV: issue.pdv,
      Ativo: issue.ativo,
      Cidade: issue.cidade,
      UF: issue.uf,
      CEP: issue.cep,
      Endereco: issue.endereco,
      Status: issue.status,
      SLA: issue.slaBadge || 'OK',
      'Data agenda': issue.dataAgenda ?? '',
      Tecnico: issue.tecnico,
      REQ: issue.req,
      Criado: formatDate(issue.created),
      Atualizado: formatDate(issue.updated),
      Resolvido: formatDate(issue.resolutiondate),
      Problema: cleanText(issue.problema),
    }))
    .sort((a, b) => String(a.Loja).localeCompare(String(b.Loja), 'pt-BR') || String(a.Tipo).localeCompare(String(b.Tipo), 'pt-BR'));
}

function buildSummaryRows(issues: SchedulingIssue[], groups: LojaGroup[]) {
  const all = uniqueIssues(issues);
  const terminal = all.filter(isTerminalIssue);
  const normal = all.filter(issue => !isTerminalIssue(issue));
  const stores2Plus = groups.filter(group => group.qtd >= 2);
  const storesWithTerminal = groups.filter(group => group.issues.some(isTerminalIssue));
  const criticalStores = groups.filter(group => group.isCritical || group.slaGroupStatus === 'critical');

  const byStatus = [...all.reduce((map, issue) => {
    const status = statusFromIssue(issue);
    map.set(status, (map.get(status) ?? 0) + 1);
    return map;
  }, new Map<string, number>())]
    .sort((a, b) => b[1] - a[1])
    .map(([status, count]) => `${status}: ${count}`)
    .join(' | ');

  return [
    { Indicador: 'Chamados totais', Valor: all.length, Observacao: 'Todos os chamados ativos carregados na aba Agendamentos' },
    { Indicador: 'Chamados manutencao', Valor: normal.length, Observacao: 'Chamados que nao sao Projeto Terminal' },
    { Indicador: 'Chamados terminal', Valor: terminal.length, Observacao: 'Problema contem Projeto Terminal de Consulta ou ativo igual a --' },
    { Indicador: 'Lojas com chamados', Valor: groups.length, Observacao: 'Lojas distintas' },
    { Indicador: 'Lojas com 2+ chamados', Valor: stores2Plus.length, Observacao: 'Base para priorizacao/estudo de loja' },
    { Indicador: 'Chamados em lojas 2+', Valor: stores2Plus.reduce((sum, group) => sum + group.qtd, 0), Observacao: 'Volume concentrado nas lojas reincidentes' },
    { Indicador: 'Lojas com terminal', Valor: storesWithTerminal.length, Observacao: 'Lojas que possuem pelo menos um chamado terminal' },
    { Indicador: 'Lojas criticas', Valor: criticalStores.length, Observacao: 'Marcadas como criticas ou com SLA de grupo critico' },
    { Indicador: 'Status', Valor: byStatus, Observacao: 'Distribuicao por status Jira' },
    { Indicador: 'Gerado em', Valor: new Date().toLocaleString('pt-BR'), Observacao: 'Horario local do navegador' },
  ];
}

function fitColumns(rows: Record<string, unknown>[], min = 10, max = 48) {
  const keys = Object.keys(rows[0] ?? {});
  return keys.map(key => {
    const longest = rows.reduce((size, row) => Math.max(size, cleanText(row[key]).length), key.length);
    return { wch: Math.min(Math.max(longest + 2, min), max) };
  });
}

export async function exportAgendamentoExcel(issues: SchedulingIssue[], groups: LojaGroup[]) {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();

  const summaryRows = buildSummaryRows(issues, groups);
  const storeRows = buildStoreStudyRows(groups);
  const issueRows = buildIssueRows(issues);

  const sheets = [
    { name: 'Resumo', rows: summaryRows },
    { name: 'Lojas 2+', rows: storeRows },
    { name: 'Todos chamados', rows: issueRows },
    { name: 'Terminais', rows: issueRows.filter(row => row.Tipo === 'Terminal') },
    { name: 'Manutencao', rows: issueRows.filter(row => row.Tipo === 'Manutencao') },
  ];

  sheets.forEach(({ name, rows }) => {
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Aviso: 'Sem dados para os filtros atuais' }]);
    ws['!cols'] = fitColumns(rows.length ? rows : [{ Aviso: 'Sem dados para os filtros atuais' }]);
    XLSX.utils.book_append_sheet(workbook, ws, name);
  });

  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `agendamentos_estudo_${date}.xlsx`, { compression: true });
}
