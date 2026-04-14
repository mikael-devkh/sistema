import type { VercelRequest, VercelResponse } from '@vercel/node';

function authHeader(email: string, token: string) {
  const clean = token.trim().replace(/\s+/g, '');
  return 'Basic ' + Buffer.from(`${email}:${clean}`).toString('base64');
}

function getBase(cloudId?: string, site?: string) {
  if (cloudId) return `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3`;
  return `${(site || '').replace(/\/$/, '')}/rest/api/3`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });

  const email = process.env.JIRA_USER_EMAIL || process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN || process.env.JIRA_TOKEN;
  const cloudId = process.env.JIRA_CLOUD_ID;
  const site = process.env.JIRA_BASE_URL || process.env.JIRA_URL;

  if (!email || !token) return res.status(500).json({ error: 'Jira credentials incomplete.' });

  const { issueKey, fields } = req.body || {};
  if (!issueKey || !fields) return res.status(400).json({ error: 'Missing issueKey or fields.' });

  const base = getBase(cloudId, site);
  const url = `${base}/issue/${encodeURIComponent(issueKey)}`;

  /** Extracts plain text from a field value (ADF doc or plain string). */
  function adfToPlain(val: any): string {
    if (typeof val === 'string') return val;
    if (val?.type === 'doc') {
      return (val.content || [])
        .flatMap((p: any) => (p.content || []).map((n: any) => n.text || ''))
        .join('\n\n');
    }
    return String(val ?? '');
  }

  /** Try a PUT with given body; return the Response. */
  async function tryPut(body: object): Promise<Response> {
    return fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': authHeader(email, token),
      },
      body: JSON.stringify(body),
    });
  }

  console.log('atualizar-fsa: updating', issueKey, 'fields:', Object.keys(fields));

  // First attempt: send as-is (ADF for rich-text fields)
  let response = await tryPut({ fields });

  // If Jira rejects the format (400), retry with plain strings
  if (response.status === 400) {
    const plainFields: Record<string, string> = {};
    for (const [k, v] of Object.entries(fields)) plainFields[k] = adfToPlain(v);
    console.log('atualizar-fsa: ADF rejected, retrying with plain text');
    response = await tryPut({ fields: plainFields });
  }

  if (!response.ok) {
    const text = await response.text();
    console.error('atualizar-fsa: Jira error', response.status, text);
    return res.status(response.status).json({ error: `Jira update failed (${response.status}): ${text}` });
  }

  return res.status(204).end();
}
