// Jira client — all calls are routed through server-side proxy endpoints.
// Credentials are NEVER included in client-side code.

const PROXY_BASE = import.meta.env.VITE_JIRA_PROXY_BASE as string | undefined;

export interface JiraIssue {
  id: string;
  key: string;
  fields: Record<string, any>;
}

export async function jiraSearch(jql: string, fields: string[] = ['summary','assignee','status','created']): Promise<JiraIssue[]> {
  if (PROXY_BASE) {
    // Usa proxy do Firebase Functions se configurado
    const url = `${PROXY_BASE.replace(/\/$/, '')}/jira/search?jql=${encodeURIComponent(jql)}&fields=${encodeURIComponent(fields.join(','))}`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error(`Jira proxy search failed: ${res.status}`);
    const data = await res.json();
    return (data.issues || []) as JiraIssue[];
  }
  // Usa o proxy da Vercel Function (novo) - agora usa POST
  const res = await fetch('/api/buscar-fsa', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      jql: jql,
      fields: fields,
      maxResults: 50,
    }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: `Jira search failed: ${res.status}` }));
    throw new Error(errorData.error || `Jira search failed: ${res.status}`);
  }
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
  if (!PROXY_BASE) throw new Error('VITE_JIRA_PROXY_BASE must be configured for Jira transitions');
  const url = `${PROXY_BASE.replace(/\/$/, '')}/jira/transitions?issueKey=${encodeURIComponent(issueIdOrKey)}`;
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(`Jira proxy transitions failed: ${res.status}`);
  return (await res.json()).transitions as Array<{ id:string; name:string }>;
}

export async function jiraTransition(issueIdOrKey: string, toName: 'in_progress'|'waiting'|'done') {
  if (!PROXY_BASE) throw new Error('VITE_JIRA_PROXY_BASE must be configured for Jira transitions');
  const nameMap: Record<typeof toName, string[]> = {
    in_progress: ['In Progress','Em andamento'],
    waiting: ['Waiting','Aguardando','On Hold'],
    done: ['Done','Concluído','Resolved']
  } as const;
  const transitions = await getTransitions(issueIdOrKey);
  const wanted = transitions.find(t => nameMap[toName].some(n => t.name.toLowerCase() === n.toLowerCase()));
  if (!wanted && transitions.length) throw new Error('Transition not available');
  const url = `${PROXY_BASE.replace(/\/$/, '')}/jira/transition`;
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ issueKey: issueIdOrKey, transitionId: wanted?.id }) });
  if (!res.ok) throw new Error(`Jira proxy transition failed: ${res.status}`);
}

/**
 * Converts a plain text block (with \n line-breaks) to Jira ADF (Atlassian Document Format).
 * Sections separated by a blank line become separate paragraphs.
 */
export function textToAdf(text: string) {
  const paragraphs = text
    .split('\n')
    .reduce<string[][]>((acc, line) => {
      if (line.trim() === '') { acc.push([]); } else { acc[acc.length - 1].push(line); }
      return acc;
    }, [[]])
    .filter(p => p.length > 0)
    .map(lines => ({
      type: 'paragraph' as const,
      content: [{ type: 'text' as const, text: lines.join('\n') }],
    }));
  return {
    version: 1 as const,
    type: 'doc' as const,
    content: paragraphs.length > 0 ? paragraphs : [{ type: 'paragraph' as const, content: [] }],
  };
}

/**
 * Updates arbitrary fields on a Jira issue via the /api/atualizar-fsa Vercel function.
 * `fields` should be an object like { customfield_14811: adfDoc, customfield_12351: "text" }.
 */
export async function jiraUpdateFields(issueKey: string, fields: Record<string, unknown>): Promise<void> {
  const res = await fetch('/api/atualizar-fsa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ issueKey, fields }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Jira update failed: ${res.status}`);
  }
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


