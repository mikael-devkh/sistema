import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, requireAuth } from './_lib/auth.js';
import { jiraAuthHeader, jiraBaseUrl, resolveJiraCloudId, debugLog } from './_lib/jira.js';

class JiraAPI {
  private email: string;
  private apiToken: string;
  private base: string;

  constructor(email: string, apiToken: string, cloudId?: string, site?: string) {
    this.email = email;
    this.apiToken = apiToken.trim().replace(/\s+/g, '');
    this.base = jiraBaseUrl(cloudId, site);
  }

  private headers(): Record<string, string> {
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: jiraAuthHeader(this.email, this.apiToken),
    };
  }

  private async req(endpoint: string, method = 'GET', body?: unknown): Promise<Response> {
    return fetch(`${this.base}${endpoint}`, {
      method,
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async buscarChamados(jql: string, fields: string[], maxResults = 50) {
    const allIssues: any[] = [];
    let nextPageToken: string | null = null;

    do {
      const body: Record<string, unknown> = { jql, fields, maxResults };
      if (nextPageToken) body.nextPageToken = nextPageToken;

      const response = await this.req('/search/jql', 'POST', body);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('buscar-fsa: Jira error', response.status);
        throw new Error(`Jira API error (${response.status}): ${errorText.slice(0, 300)}`);
      }
      const data = await response.json();
      const issues = data.issues || [];
      allIssues.push(...issues);
      nextPageToken = data.nextPageToken || null;
    } while (nextPageToken);

    return { issues: allIssues, total: allIssues.length };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });

  const user = await requireAuth(req, res, {
    roles: ['admin', 'operador', 'financeiro', 'visualizador'],
  });
  if (!user) return;

  try {
    const email = process.env.JIRA_USER_EMAIL || process.env.JIRA_EMAIL;
    const token = process.env.JIRA_API_TOKEN || process.env.JIRA_TOKEN;
    const cloudIdEnv = process.env.JIRA_CLOUD_ID;
    const site = process.env.JIRA_BASE_URL || process.env.JIRA_URL;

    if (!email || !token) return res.status(500).json({ error: 'Jira credentials incomplete.' });
    if (!cloudIdEnv && !site) {
      return res.status(500).json({ error: 'Jira base config incomplete.' });
    }

    let resolvedCloudId = cloudIdEnv;
    if (!resolvedCloudId && site) {
      resolvedCloudId = await resolveJiraCloudId(email, token, site);
    }

    const { jql, fields, maxResults } = req.body || {};
    if (!jql) return res.status(400).json({ error: 'Missing required body parameter: jql' });

    const jiraApi = new JiraAPI(email, token, resolvedCloudId, site);
    const fieldsArray: string[] = Array.isArray(fields) ? fields : ['summary', 'description', 'created'];
    const maxResultsNum: number = typeof maxResults === 'number' && maxResults > 0 ? maxResults : 1;

    debugLog('buscar-fsa: search', { fieldsCount: fieldsArray.length, maxResults: maxResultsNum });

    const resultado = await jiraApi.buscarChamados(jql, fieldsArray, maxResultsNum);

    return res.status(200).json({
      issues: resultado.issues,
      total: resultado.total,
      isLast: true,
    });
  } catch (error: any) {
    console.error('buscar-fsa: error', error?.message);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
}
