import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, requireAuth } from './_lib/auth.js';
import { jiraAuthHeader, jiraBaseUrl, resolveJiraCloudId } from './_lib/jira.js';

class JiraAPI {
  private email: string;
  private token: string;
  private base: string;

  constructor(email: string, token: string, cloudId?: string, site?: string) {
    this.email = email;
    this.token = token.trim().replace(/\s+/g, '');
    this.base = jiraBaseUrl(cloudId, site || 'https://delfia.atlassian.net');
  }

  private headers() {
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: jiraAuthHeader(this.email, this.token),
    };
  }

  private async req(path: string, method = 'GET', body?: unknown) {
    return fetch(`${this.base}${path}`, {
      method,
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async searchAll(jql: string, fields: string, maxResults = 600) {
    const pageSize = Math.min(maxResults, 100);
    const fieldList = fields ? fields.split(',').map((f) => f.trim()) : undefined;
    const all: any[] = [];
    let nextPageToken: string | undefined;

    while (all.length < maxResults) {
      const body: Record<string, unknown> = { jql, maxResults: pageSize };
      if (fieldList) body.fields = fieldList;
      if (nextPageToken) body.nextPageToken = nextPageToken;

      const res = await this.req('/search/jql', 'POST', body);
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Jira search failed (${res.status}): ${err.slice(0, 300)}`);
      }
      const data = await res.json();
      const issues: any[] = data.issues || [];
      all.push(...issues);
      nextPageToken = data.nextPageToken;
      if (!nextPageToken || issues.length < pageSize) break;
    }
    return all.slice(0, maxResults);
  }

  async getIssue(key: string) {
    const res = await this.req(`/issue/${encodeURIComponent(key)}`);
    if (!res.ok) throw new Error(`getIssue failed (${res.status})`);
    return res.json();
  }

  async getTransitions(key: string) {
    const res = await this.req(`/issue/${encodeURIComponent(key)}/transitions`);
    if (!res.ok) throw new Error(`getTransitions failed (${res.status})`);
    const data = await res.json();
    return data.transitions as Array<{ id: string; name: string; to: { name: string; id: string } }>;
  }

  async transition(key: string, transitionId: string, scheduleFields?: { dataAgenda?: string; tecnico?: string }) {
    const body: any = { transition: { id: transitionId } };
    if (scheduleFields?.dataAgenda || scheduleFields?.tecnico) {
      body.update = {};
      body.fields = {};
      if (scheduleFields.dataAgenda) {
        body.fields['customfield_12036'] = scheduleFields.dataAgenda;
      }
      if (scheduleFields.tecnico) {
        body.fields['customfield_12279'] = {
          type: 'doc',
          version: 1,
          content: [{ type: 'paragraph', content: [{ type: 'text', text: scheduleFields.tecnico }] }],
        };
      }
    }
    const res = await this.req(`/issue/${encodeURIComponent(key)}/transitions`, 'POST', body);
    return res.status;
  }

  async updateIssue(key: string, fields: Record<string, unknown>) {
    const res = await this.req(`/issue/${encodeURIComponent(key)}`, 'PUT', { fields });
    return res.status;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  const action = (req.method === 'GET' ? req.query.action : req.body?.action) as string;
  const writeActions = new Set(['transition', 'updateIssue']);
  const requiredRoles = writeActions.has(action)
    ? (['admin', 'operador', 'financeiro'] as const)
    : (['admin', 'operador', 'financeiro', 'visualizador'] as const);

  const user = await requireAuth(req, res, { roles: [...requiredRoles] });
  if (!user) return;

  const email = process.env.JIRA_USER_EMAIL || process.env.JIRA_EMAIL || '';
  const token = process.env.JIRA_API_TOKEN || process.env.JIRA_TOKEN || '';
  const site = process.env.JIRA_BASE_URL || process.env.JIRA_URL || 'https://delfia.atlassian.net';
  let cloudId = process.env.JIRA_CLOUD_ID || '';

  if (!email || !token) return res.status(500).json({ error: 'Missing JIRA_EMAIL or JIRA_TOKEN env vars' });

  if (!cloudId) {
    cloudId = (await resolveJiraCloudId(email, token, site)) || '';
  }

  const jira = new JiraAPI(email, token, cloudId || undefined, site);

  try {
    switch (action) {
      case 'search': {
        const jql = req.method === 'GET' ? (req.query.jql as string) : req.body.jql;
        const fields = req.method === 'GET' ? (req.query.fields as string) : req.body.fields;
        const maxResults = Number(req.method === 'GET' ? req.query.maxResults : req.body.maxResults) || 600;
        if (!jql) return res.status(400).json({ error: 'Missing jql' });
        const issues = await jira.searchAll(jql, fields || 'summary,status', maxResults);
        return res.status(200).json({ issues });
      }

      case 'getIssue': {
        const key = req.method === 'GET' ? (req.query.key as string) : req.body.key;
        if (!key) return res.status(400).json({ error: 'Missing key' });
        const issue = await jira.getIssue(key);
        return res.status(200).json({ issue });
      }

      case 'getTransitions': {
        const key = req.method === 'GET' ? (req.query.key as string) : req.body.key;
        if (!key) return res.status(400).json({ error: 'Missing key' });
        const transitions = await jira.getTransitions(key);
        return res.status(200).json({ transitions });
      }

      case 'transition': {
        const { key, transitionId, dataAgenda, tecnico } = req.body || {};
        if (!key || !transitionId) return res.status(400).json({ error: 'Missing key or transitionId' });
        const status = await jira.transition(key, transitionId, { dataAgenda, tecnico });
        return res.status(200).json({ ok: status === 204, httpStatus: status });
      }

      case 'updateIssue': {
        const { key, fields } = req.body || {};
        if (!key || !fields) return res.status(400).json({ error: 'Missing key or fields' });
        const status = await jira.updateIssue(key, fields);
        return res.status(200).json({ ok: status === 204 || status === 200, httpStatus: status });
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (e: any) {
    console.error('[jira-scheduling]', e?.message);
    return res.status(500).json({ error: e?.message || 'Internal error' });
  }
}
