/**
 * Client-side wrapper for /api/jira-scheduling
 * All Jira calls for the scheduling module go through this file.
 */
import { CF, SCHED_FIELDS, SLA_HOURS } from './schedulingConstants';
import type { SchedulingIssue, TransitionOption } from '../types/scheduling';

const API = '/api/jira-scheduling';

// ─── Raw API calls ─────────────────────────────────────────────────────────────

async function post(body: Record<string, unknown>) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function get(params: Record<string, string | number>) {
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)])
  ).toString();
  const res = await fetch(`${API}?${qs}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ─── Reads ─────────────────────────────────────────────────────────────────────

export async function searchIssues(jql: string, maxResults = 600): Promise<any[]> {
  const data = await post({ action: 'search', jql, fields: SCHED_FIELDS, maxResults });
  return data.issues || [];
}

export async function searchIssuesFields(jql: string, fields: string, maxResults = 100): Promise<any[]> {
  const data = await post({ action: 'search', jql, fields, maxResults });
  return data.issues || [];
}

export async function getIssue(key: string): Promise<any> {
  const data = await get({ action: 'getIssue', key });
  return data.issue;
}

export async function getTransitions(key: string): Promise<TransitionOption[]> {
  const data = await get({ action: 'getTransitions', key });
  return ((data.transitions || []) as any[]).map((t: any) => ({
    id: t.id,
    name: t.name,
    toName: t.to?.name || t.name,
  }));
}

// ─── Writes ────────────────────────────────────────────────────────────────────

export interface TransitionPayload {
  key: string;
  transitionId: string;
  dataAgenda?: string;  // ISO datetime string e.g. "2024-07-15T09:00:00.000-0300"
  tecnico?: string;     // plain text
}

export async function transitionIssue(payload: TransitionPayload): Promise<boolean> {
  const data = await post({ action: 'transition', ...payload });
  return data.ok === true;
}

export async function updateTecnico(key: string, tecnico: string): Promise<boolean> {
  const fields: Record<string, unknown> = {
    [CF.TECNICOS]: tecnico
      ? { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: tecnico }] }] }
      : null,
  };
  const data = await post({ action: 'updateIssue', key, fields });
  return data.ok === true;
}

// ─── Parsing helpers ──────────────────────────────────────────────────────────

function parseDt(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  try { return new Date(raw); } catch { return null; }
}

function extractAdfText(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val !== null) {
    const obj = val as any;
    let text = '';
    if (obj.type === 'text') return obj.text || '';
    for (const c of obj.content || []) text += extractAdfText(c);
    return text;
  }
  return String(val);
}

function getSla(created: Date | null): string {
  if (!created) return '';
  const hours = (Date.now() - created.getTime()) / 3_600_000;
  if (hours >= SLA_HOURS.CRITICAL) return `🔴 SLA ESTOURADO (${Math.floor(hours / 24)}d)`;
  if (hours >= SLA_HOURS.WARNING) return `🟡 ALERTA SLA (${Math.floor(hours / 24)}d)`;
  return '🟢 No Prazo';
}

export function parseIssue(raw: any): SchedulingIssue {
  const f = raw.fields || {};
  const status = f.status || {};

  const lojaRaw = f[CF.LOJA];
  const ativoRaw = f[CF.ATIVO];
  const ufRaw = f[CF.UF];

  const created = parseDt(f.created);

  return {
    key: raw.key,
    loja: (typeof lojaRaw === 'object' ? lojaRaw?.value : lojaRaw) || 'Loja Desconhecida',
    pdv: String(f[CF.PDV] || '--'),
    ativo: (typeof ativoRaw === 'object' ? ativoRaw?.value : ativoRaw) || '--',
    problema: String(f[CF.PROBLEMA] || '--'),
    endereco: String(f[CF.ENDERECO] || '--'),
    cidade: String(f[CF.CIDADE] || ''),
    uf: (typeof ufRaw === 'object' ? ufRaw?.value : ufRaw) || '',
    cep: String(f[CF.CEP] || ''),
    dataAgenda: f[CF.DATA_AGENDA] || null,
    tecnico: extractAdfText(f[CF.TECNICOS]),
    req: '', // not used in scheduling panel
    status: status.name || '',
    statusId: String(status.id || ''),
    created,
    updated: parseDt(f.updated),
    resolutiondate: parseDt(f.resolutiondate),
    slaBadge: getSla(created),
  };
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

/** Generates the WhatsApp-style message for a store's tickets */
export function gerarMensagem(loja: string, issues: SchedulingIssue[]): string {
  const blocks: string[] = [];
  let enderecoInfo: string | null = null;

  for (const ch of issues) {
    blocks.push(
      [`*${ch.key}*`, `Loja: ${loja}`, `PDV: ${ch.pdv}`, `*ATIVO: ${ch.ativo}*`, `Problema: ${ch.problema}`, '***'].join('\n')
    );
    enderecoInfo = [
      `Endereço: ${ch.endereco}`,
      `Estado: ${ch.uf}`,
      `CEP: ${ch.cep}`,
      `Cidade: ${ch.cidade}`,
    ].join('\n');
  }

  if (enderecoInfo) blocks.push(enderecoInfo);
  blocks.push('*SEMPRE AO CHEGAR NO LOCAL É NECESSÁRIO ACIONAR O SUPORTE E ENVIAR AS FOTOS NECESSÁRIAS*');

  return blocks.join('\n\n');
}

/** Generates the manager contact message */
export function gerarMensagemGerente(loja: string, issues: SchedulingIssue[], isProjeto = false): string {
  const ch = issues[0];
  if (!ch) return '';
  const req = isProjeto
    ? 'PROJETO TERMINAL DE CONSULTA'
    : issues.map(i => i.req).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ') || '--';

  return [
    'Somos da empresa WT Tecnologia parceiros da Delfia e estamos com um chamado da loja. ' +
    'Se precisar verificar mais algum Ativo/PDV pode abrir chamado que a gente atende na hora.',
    'Caso tenha algum ativo com problema(Ex: Scanner, Impressora, Monitor, Teclado, CPU) fazemos analise na mesma hora.',
    'Site Abertura Chamados:https://americanas.freshservice.com',
    'PDV - Equipamento - Manutenção,',
    'Iremos enviar um técnico para verificar o chamado. Caso tenha mais algum ativo para olhar, favor enviar o numero do REQ. Obrigado',
    `REQ: ${req}`,
    `Loja: ${loja}`,
    `Endereço: ${ch.endereco}`,
    `Estado: ${ch.uf}`,
    `CEP: ${ch.cep}`,
    `Cidade: ${ch.cidade}`,
  ].join('\n\n');
}

/** Build ISO datetime from date string (yyyy-MM-dd) + time (HH:MM) in -03:00 */
export function buildIsoDatetime(date: string, hora: string): string {
  return `${date}T${hora}:00.000-0300`;
}
