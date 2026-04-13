// Jira custom field IDs for the scheduling system
export const CF = {
  LOJA:         'customfield_14954',
  PDV:          'customfield_14829',
  ATIVO:        'customfield_14825',
  PROBLEMA:     'customfield_12374',
  ENDERECO:     'customfield_12271',
  CEP:          'customfield_11993',
  CIDADE:       'customfield_11994',
  UF:           'customfield_11948',
  DATA_AGENDA:  'customfield_12036',
  TECNICOS:     'customfield_12279',
  NOME_GERENTE: 'customfield_12267',
  TEL_GERENTE:  'customfield_12268',
  REQ:          'customfield_14886',
} as const;

export const STATUS = {
  AGENDAMENTO: 'AGENDAMENTO',
  AGENDADO:    'Agendado',
  TEC_CAMPO:   'TEC-CAMPO',
} as const;

export const STATUS_IDS = {
  AGENDAMENTO: '11499',
  AGENDADO:    '11481',
  TEC_CAMPO:   '11500',
} as const;

/** Fields string for all scheduling-related Jira queries */
export const SCHED_FIELDS = [
  'summary',
  CF.LOJA, CF.PDV, CF.ATIVO, CF.PROBLEMA,
  CF.ENDERECO, CF.CEP, CF.CIDADE, CF.UF,
  CF.DATA_AGENDA, CF.TECNICOS, CF.REQ,
  'status', 'created', 'resolutiondate', 'updated',
].join(',');

/** Fields for manager contact queries */
export const CONTACT_FIELDS = [CF.LOJA, CF.NOME_GERENTE, CF.TEL_GERENTE, 'created'].join(',');

export const JQL = {
  COMBINADA: `project = FSA AND status in (${Object.values(STATUS_IDS).join(',')})`,
  RESOLVIDOS: (from: string, to: string) =>
    `project = FSA AND status in (11498, 10702, "Encerrado", "Resolvido") AND resolutiondate >= "${from}" AND resolutiondate <= "${to}"`,
  CONTATOS: (lojas: string[]) =>
    `project = FSA AND ${CF.LOJA} in (${lojas.map(l => `"${l}"`).join(',')}) AND ${CF.TEL_GERENTE} is not EMPTY ORDER BY created DESC`,
} as const;

export const SLA_HOURS = { WARNING: 24, CRITICAL: 48 } as const;
