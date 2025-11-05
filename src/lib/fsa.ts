import type { JiraIssue, JiraSearchResult } from '../types/rat';
import { jiraSearch } from './jira';
import { getFsaById, createOrUpdateFsa } from './workflow-firestore';
import { loadPreferences } from '../utils/settings';

export interface FsaDetails {
  fsaId?: string;
  storeCode?: string;
  endereco?: string;
  cidade?: string;
  uf?: string;
  clienteNome?: string;
  pdv?: string;
}

export function normalizeFsa(input?: string): string | undefined {
  if (!input) return undefined;
  const s = String(input).trim();
  if (!s) return undefined;
  // aceita formatos: 1234, FSA 1234, FSA-1234, Loja 1234
  const m = s.match(/(?:FSA\s*-?\s*)?(\d{2,6})/i);
  return m ? m[1] : undefined;
}

export function extractStoreCode(input?: string): string | undefined {
  if (!input) return undefined;
  const s = String(input).trim();
  // tenta 3-5 dígitos
  const m = s.match(/\b(\d{3,5})\b/);
  return m ? m[1] : undefined;
}

function parseAddressFromIssue(issue: JiraIssue): Partial<FsaDetails> {
  const out: Partial<FsaDetails> = {};
  const f = issue.fields || {} as Record<string, any>;
  const text = [issue.fields?.summary, issue.fields?.description]
    .filter(Boolean)
    .join("\n\n");

  // Preferências do usuário / variáveis de ambiente para campos Jira
  const prefs = loadPreferences();
  const envAddress = (import.meta as any)?.env?.VITE_JIRA_FIELD_ADDRESS as string | undefined;
  const envCity = (import.meta as any)?.env?.VITE_JIRA_FIELD_CITY as string | undefined;
  const envState = (import.meta as any)?.env?.VITE_JIRA_FIELD_STATE as string | undefined;
  const envStore = (import.meta as any)?.env?.VITE_JIRA_FIELD_STORE as string | undefined;
  const envPdv = (import.meta as any)?.env?.VITE_JIRA_FIELD_PDV as string | undefined;

  // Tenta campos conhecidos, priorizando mapeamento configurado
  const addressKeys = [
    prefs.jiraAddressField,
    envAddress,
    "customfield_12271", // endereço (fornecido)
    "customfield_address",
    "address",
    "endereco",
    "customfield_endereco",
  ].filter(Boolean) as string[];
  for (const k of addressKeys) {
    if (f[k]) { out.endereco = String(f[k]); break; }
  }

  const cityKeys = [
    prefs.jiraCityField,
    envCity,
    "customfield_11994", // cidade (fornecido)
    "cidade",
    "city",
    "customfield_city",
  ].filter(Boolean) as string[]; 
  for (const k of cityKeys) {
    if (f[k]) { out.cidade = String(f[k]); break; }
  }

  const ufKeys = [
    prefs.jiraStateField,
    envState,
    "customfield_11948", // estado (option.value) (fornecido)
    "uf",
    "estado",
    "state",
    "customfield_state",
  ].filter(Boolean) as string[]; 
  for (const k of ufKeys) {
    if (f[k]) {
      const v = f[k];
      const val = typeof v === 'object' && v && 'value' in v ? String(v.value) : String(v);
      out.uf = val.toUpperCase().slice(0,2);
      break;
    }
  }

  const storeKeys = [
    prefs.jiraStoreField,
    envStore,
    "store",
    "codigoLoja",
    "customfield_store",
    "loja",
  ].filter(Boolean) as string[]; 
  for (const k of storeKeys) {
    if (f[k]) { out.storeCode = String(f[k]).match(/\d{3,5}/)?.[0]; if (out.storeCode) break; }
  }

  // PDV
  const pdvKeys = [
    prefs.jiraPdvField,
    envPdv,
    "customfield_14829", // PDV (fornecido)
    "pdv",
  ].filter(Boolean) as string[];
  for (const k of pdvKeys) {
    if (f[k]) { out.pdv = String(f[k]); break; }
  }

  // Parsing do corpo (fallback)
  if (text) {
    if (!out.endereco) {
      const m = text.match(/Endereç[oa]:?\s*(.+)/i);
      if (m) out.endereco = m[1].trim();
    }
    if (!out.cidade) {
      const m = text.match(/Cidad[ea]:?\s*([\p{L}\s]+)/iu);
      if (m) out.cidade = m[1].trim();
    }
    if (!out.uf) {
      const m = text.match(/\b(UF|Estado):?\s*([A-Z]{2})\b/i);
      if (m) out.uf = m[2].toUpperCase();
    }
    if (!out.storeCode) {
      const m = text.match(/Loja:?\s*(\d{3,5})/i);
      if (m) out.storeCode = m[1];
    }
  }

  return out;
}

export async function fetchFsaDetails(input: { fsa?: string; codigoLoja?: string }): Promise<FsaDetails | null> {
  const fsaNorm = normalizeFsa(input.fsa);
  const storeNorm = extractStoreCode(input.codigoLoja);

  // 1) Tenta Firestore (fsas)
  if (fsaNorm) {
    const cached = await getFsaById(fsaNorm);
    if (cached) {
      return {
        fsaId: cached.id,
        storeCode: cached.loja,
        endereco: cached.observacoes || undefined, // se usarem este campo para endereço
        cidade: cached.cidade,
        uf: cached.uf,
      };
    }
  }

  // 2) Tenta Jira: busca por FSA usando a nova função
  try {
    if (fsaNorm) {
      const issue = await searchFsaByNumber(fsaNorm);
      const parsed = parseAddressFromIssue(issue);
      const details: FsaDetails = {
        fsaId: fsaNorm,
        storeCode: parsed.storeCode || storeNorm,
        endereco: parsed.endereco,
        cidade: parsed.cidade,
        uf: parsed.uf,
      };

      // 3) Persiste cache em Firestore quando tivermos FSA e loja
      if (details.fsaId && details.storeCode) {
        try {
          const obsParts = [details.endereco, [details.cidade, details.uf].filter(Boolean).join("/ ")].filter(Boolean);
          await createOrUpdateFsa({
            id: details.fsaId,
            loja: details.storeCode,
            observacoes: obsParts.join(" - ") || undefined,
            status: 'open',
          });
        } catch {}
      }

      return details;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Constrói uma JQL para buscar uma FSA pelo seu número (em texto/resumo)
 * DENTRO DO PROJETO FSA.
 */
function buildJqlQueryByNumber(fsaNumber: string): string {
  const sanitizedNumber = fsaNumber.replace(/\D/g, ''); // Apenas números
  if (!sanitizedNumber) throw new Error('Número da FSA inválido');

  const fsaKey = `FSA-${sanitizedNumber}`;

  // JQL CORRETA: Combina a regra 'project = FSA'
  // com a busca por número
  return `project = FSA AND (key = "${fsaKey}" OR text ~ "FSA ${sanitizedNumber}" OR text ~ "${fsaKey}" OR summary ~ "${sanitizedNumber}") ORDER BY created DESC`;
}

/**
 * Busca uma FSA no Jira usando o seu número (em texto/resumo).
 * Usa o método POST para a API /api/buscar-fsa.
 */
export async function searchFsaByNumber(fsaNumber: string): Promise<JiraIssue> {
  if (!fsaNumber) {
    throw new Error('Número da FSA é obrigatório');
  }

  const jql = buildJqlQueryByNumber(fsaNumber);
  
  // Lista de campos exata do seu bot
  const fieldsToRequest = [
    'summary', 'description', 'created', 'customfield_14954', 
    'customfield_14829', 'customfield_14825', 'customfield_12374', 
    'customfield_12271', 'customfield_11948', 'customfield_11993', 
    'customfield_11994', 'customfield_12036',
  ];

  // ---- DEBUG ----
  console.log('FRONTEND: Enviando para /api/buscar-fsa (POST) com body:', { jql, fieldsToRequest });
  // ---------------

  const response = await fetch(`/api/buscar-fsa`, {
    method: 'POST', // Corrigido para POST
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jql: jql,
      fields: fieldsToRequest,
      maxResults: 1 // Queremos o resultado mais recente
    }),
  });

  const data: JiraSearchResult | { error: string, details?: any } = await response.json();

  if (!response.ok) {
    const errorMsg = (data as any).error || 'Falha ao buscar FSA';
    console.error('FRONTEND: Erro da API:', (data as any).details || data);
    throw new Error(errorMsg);
  }

  const searchResult = data as JiraSearchResult;
  
  // ---- DEBUG ----
  console.log('FRONTEND: Resultado da busca:', {
    total: searchResult.total || 0,
    issuesFound: searchResult.issues?.length || 0,
    jql: jql
  });
  // ---------------
  
  if (!searchResult.issues || searchResult.issues.length === 0) {
    throw new Error(`Nenhuma FSA encontrada para o número "${fsaNumber}". JQL usada: ${jql}`);
  }

  // ---- DEBUG ----
  console.log('FRONTEND: Recebido da API:', searchResult.issues[0]);
  // ---------------

  return searchResult.issues[0]; // Retorna a issue mais recente encontrada
}

/**
 * Constrói uma JQL para buscar todas as FSAs do projeto FSA.
 */
function buildJqlQueryAllFsa(): string {
  return `project = FSA ORDER BY created DESC`;
}

/**
 * Busca todas as FSAs do projeto FSA no Jira.
 * Usa o método POST para a API /api/buscar-fsa.
 * @param maxResults Número máximo de resultados a retornar (padrão: 50)
 */
export async function searchAllFsa(maxResults: number = 50): Promise<JiraIssue[]> {
  const jql = buildJqlQueryAllFsa();
  
  // Lista de campos exata do seu bot
  const fieldsToRequest = [
    'summary', 'description', 'created', 'customfield_14954', 
    'customfield_14829', 'customfield_14825', 'customfield_12374', 
    'customfield_12271', 'customfield_11948', 'customfield_11993', 
    'customfield_11994', 'customfield_12036',
  ];

  // ---- DEBUG ----
  console.log('FRONTEND: Buscando todas as FSAs. Enviando para /api/buscar-fsa (POST) com body:', { jql, fieldsToRequest, maxResults });
  // ---------------

  const response = await fetch(`/api/buscar-fsa`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jql: jql,
      fields: fieldsToRequest,
      maxResults: maxResults
    }),
  });

  const data: JiraSearchResult | { error: string, details?: any } = await response.json();

  if (!response.ok) {
    const errorMsg = (data as any).error || 'Falha ao buscar FSAs';
    console.error('FRONTEND: Erro da API ao buscar todas as FSAs:', (data as any).details || data);
    throw new Error(errorMsg);
  }

  const searchResult = data as JiraSearchResult;
  
  // ---- DEBUG ----
  console.log('FRONTEND: Resultado da busca de todas as FSAs:', {
    total: searchResult.total || 0,
    issuesFound: searchResult.issues?.length || 0,
    jql: jql
  });
  // ---------------
  
  return searchResult.issues || []; // Retorna todas as issues encontradas
}


