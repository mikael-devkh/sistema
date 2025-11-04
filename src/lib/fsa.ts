import { jiraSearch, type JiraIssue } from "./jira";
import { getFsaById, createOrUpdateFsa } from "./workflow-firestore";
import { loadPreferences } from "../utils/settings";

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

  // 2) Tenta Jira: busca por FSA ou por loja
  try {
    const clauses: string[] = [];
    if (fsaNorm) {
      clauses.push(`text ~ "\"FSA ${fsaNorm}\""`);
      clauses.push(`text ~ "\"FSA-${fsaNorm}\""`);
      clauses.push(`summary ~ "${fsaNorm}"`);
    }
    if (storeNorm) {
      clauses.push(`text ~ "\"Loja ${storeNorm}\""`);
      clauses.push(`summary ~ "${storeNorm}"`);
    }
    if (!clauses.length) return null;
    const jql = clauses.join(" OR ") + " ORDER BY updated DESC";
    const issues = await jiraSearch(jql, ["summary","description","created"]);
    if (!issues?.length) return null;
    const parsed = parseAddressFromIssue(issues[0]);
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
  } catch {
    return null;
  }
}


