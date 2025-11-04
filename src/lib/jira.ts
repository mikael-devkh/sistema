// Simple Jira Cloud client (read-only) using Atlassian EX API
// NOTE: For security, set credentials via environment variables and DO NOT commit tokens.

const USE_EX_API = import.meta.env.VITE_JIRA_USE_EX_API === 'true';
const PROXY_BASE = import.meta.env.VITE_JIRA_PROXY_BASE as string | undefined; // ex.: https://<region>-<proj>.cloudfunctions.net/api
const CLOUD_ID = import.meta.env.VITE_JIRA_CLOUD_ID as string | undefined;
const EMAIL = import.meta.env.VITE_JIRA_EMAIL as string | undefined;
const API_TOKEN = import.meta.env.VITE_JIRA_TOKEN as string | undefined;

function authHeader() {
  if (!EMAIL || !API_TOKEN) return {} as HeadersInit;
  const token = btoa(`${EMAIL}:${API_TOKEN}`);
  return { Authorization: `Basic ${token}` } as HeadersInit;
}

function getBaseUrl() {
  if (USE_EX_API && CLOUD_ID) {
    return `https://api.atlassian.com/ex/jira/${CLOUD_ID}/rest/api/3`;
  }
  // Fallback to site URL if ex api disabled
  const SITE = (import.meta.env.VITE_JIRA_URL as string | undefined) || '';
  return `${SITE.replace(/\/$/, '')}/rest/api/3`;
}

export interface JiraIssue {
  id: string;
  key: string;
  fields: Record<string, any>;
}

export async function jiraSearch(jql: string, fields: string[] = ['summary','assignee','status','created']): Promise<JiraIssue[]> {
  if (PROXY_BASE) {
    const url = `${PROXY_BASE.replace(/\/$/, '')}/jira/search?jql=${encodeURIComponent(jql)}&fields=${encodeURIComponent(fields.join(','))}`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error(`Jira proxy search failed: ${res.status}`);
    const data = await res.json();
    return (data.issues || []) as JiraIssue[];
  }
  const base = getBaseUrl();
  const url = `${base}/search?jql=${encodeURIComponent(jql)}&fields=${encodeURIComponent(fields.join(','))}&maxResults=50`;
  const res = await fetch(url, { headers: { 'Accept': 'application/json', ...authHeader() } });
  if (!res.ok) throw new Error(`Jira search failed: ${res.status}`);
  const data = await res.json();
  return (data.issues || []) as JiraIssue[];
}

export function mapJiraStatusToWorkflow(statusName?: string): 'open' | 'in_progress' | 'waiting' | 'done' {
  const s = (statusName || '').toLowerCase();
  if (s.includes('progress') || s.includes('andamento')) return 'in_progress';
  if (s.includes('wait') || s.includes('aguard')) return 'waiting';
  if (s.includes('done') || s.includes('concl')) return 'done';
  return 'open';
}

async function getTransitions(issueIdOrKey: string) {
  if (PROXY_BASE) {
    const url = `${PROXY_BASE.replace(/\/$/, '')}/jira/transitions?issueKey=${encodeURIComponent(issueIdOrKey)}`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error(`Jira proxy transitions failed: ${res.status}`);
    return (await res.json()).transitions as Array<{ id:string; name:string }>;
  }
  const base = getBaseUrl();
  const url = `${base}/issue/${encodeURIComponent(issueIdOrKey)}/transitions`;
  const res = await fetch(url, { headers: { 'Accept': 'application/json', ...authHeader() } });
  if (!res.ok) throw new Error(`Jira transitions failed: ${res.status}`);
  return (await res.json()).transitions as Array<{ id:string; name:string }>;
}

export async function jiraTransition(issueIdOrKey: string, toName: 'in_progress'|'waiting'|'done') {
  const nameMap: Record<typeof toName, string[]> = {
    in_progress: ['In Progress','Em andamento'],
    waiting: ['Waiting','Aguardando','On Hold'],
    done: ['Done','Concluído','Resolved']
  } as const;
  const transitions = await getTransitions(issueIdOrKey);
  const wanted = transitions.find(t => nameMap[toName].some(n => t.name.toLowerCase() === n.toLowerCase()));
  if (!wanted && transitions.length) throw new Error('Transition not available');
  if (PROXY_BASE) {
    const url = `${PROXY_BASE.replace(/\/$/, '')}/jira/transition`;
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ issueKey: issueIdOrKey, transitionId: wanted?.id }) });
    if (!res.ok) throw new Error(`Jira proxy transition failed: ${res.status}`);
    return;
  }
  const base = getBaseUrl();
  const url = `${base}/issue/${encodeURIComponent(issueIdOrKey)}/transitions`;
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type':'application/json', ...authHeader() }, body: JSON.stringify({ transition: { id: wanted?.id } }) });
  if (!res.ok) throw new Error(`Jira transition POST failed: ${res.status}`);
}

export async function jiraAttach(issueKey: string, fileName: string, blob: Blob) {
  if (!PROXY_BASE) throw new Error('Attachment requires proxy base (VITE_JIRA_PROXY_BASE)');
  const arrayBuf = await blob.arrayBuffer();
  const b64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuf)));
  const url = `${PROXY_BASE.replace(/\/$/, '')}/jira/attach`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ issueKey, fileName, fileBase64: b64 })
  });
  if (!res.ok) throw new Error(`Jira proxy attach failed: ${res.status}`);
}


