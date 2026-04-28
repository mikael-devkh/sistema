import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, requireAuth } from './_lib/auth';
import { jiraAuthHeader, jiraBaseUrl } from './_lib/jira';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });

  const user = await requireAuth(req, res, { roles: ['admin', 'operador', 'financeiro'] });
  if (!user) return;

  const email = process.env.JIRA_USER_EMAIL || process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN || process.env.JIRA_TOKEN;
  const cloudId = process.env.JIRA_CLOUD_ID;
  const site = process.env.JIRA_BASE_URL || process.env.JIRA_URL;

  if (!email || !token) return res.status(500).json({ error: 'Jira credentials incomplete.' });

  const { issueKey, fields } = req.body || {};
  if (!issueKey || !fields) return res.status(400).json({ error: 'Missing issueKey or fields.' });

  const url = `${jiraBaseUrl(cloudId, site)}/issue/${encodeURIComponent(issueKey)}`;

  const update: Record<string, [{ set: unknown }]> = {};
  for (const [k, v] of Object.entries(fields)) {
    update[k] = [{ set: v }];
  }

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: jiraAuthHeader(email, token),
    },
    body: JSON.stringify({ update }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('atualizar-fsa: Jira error', response.status);
    return res
      .status(response.status)
      .json({ error: `Jira update failed (${response.status}): ${text.slice(0, 300)}` });
  }

  return res.status(204).end();
}
