import type { VercelRequest, VercelResponse } from '@vercel/node';

// ─── Jira API helper (server-side) ────────────────────────────────────────────
class JiraAPI {
  private email: string;
  private token: string;
  private base: string;

  constructor(email: string, token: string, cloudId?: string, site?: string) {
    this.email = email;
    this.token = token.trim().replace(/\s+/g, '');
    this.base = cloudId
      ? `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3`
      : `${(site || 'https://delfia.atlassian.net').replace(/\/$/, '')}/rest/api/3`;
  }

  private headers() {
    const auth = 'Basic ' + Buffer.from(`${this.email}:${this.token}`).toString('base64');
    return { 'Accept': 'application/json', 'Content-Type': 'application/json', Authorization: auth };
  }

  private async req(path: string, method = 'GET', body?: unknown) {
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
    return res;
  }

  /** Paginated search – fetches all pages up to maxResults */
  async searchAll(jql: string, fields: string, maxResults = 600) {
    const size = Math.min(maxResults, 100);
    let start = 0;
    const all: any[] = [];

    while (all.length < maxResults) {
      const res = await this.req(
        `/search?jql=${encodeURIComponent(jql)}&fields=${encodeURIComponent(fields)}&maxResults=${size}&startAt=${start}`
      );
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Jira search failed (${res.status}): ${err.slice(0, 300)}`);
      }
      const data = await res.json();
      const issues: any[] = data.issues || [];
      all.push(...issues);
      if (issues.length < size || all.length >= (data.total ?? 0)) break;
      start += issues.length;
    }
    return all.slice(0, maxResults);
  }

  /** Get a single issue */
  async getIssue(key: string) {
    const res = await this.req(`/issue/${encodeURIComponent(key)}`);
    if (!res.ok) throw new Error(`getIssue failed (${res.status})`);
    return res.json();
  }

  /** Get available transitions for an issue */
  async getTransitions(key: string) {
    const res = await this.req(`/issue/${encodeURIComponent(key)}/transitions`);
    if (!res.ok) throw new Error(`getTransitions failed (${res.status})`);
    const data = await res.json();
    return data.transitions as Array<{ id: string; name: string; to: { name: string; id: string } }>;
  }

  /**
   * Execute a transition, optionally setting scheduling fields.
   * fields: { dataAgenda?: ISO string, tecnico?: string }
   */
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

  /** Update issue fields (e.g. technician) */
  async updateIssue(key: string, fields: Record<string, unknown>) {
    const res = await this.req(`/issue/${encodeURIComponent(key)}`, 'PUT', { fields });
    return res.status;
  }
}

// ─── Resolve Cloud ID from site URL ──────────────────────────────────────────
async function resolveCloudId(email: string, token: string, site: string): Promise<string | undefined> {
  try {
    const auth = 'Basic ' + Buffer.from(`${email}:${token.trim()}`).toString('base64');
    const res = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
      headers: { Authorization: auth, Accept: 'application/json' },
    });
    if (!res.ok) return undefined;
    const resources = await res.json() as Array<{ id: string; url: string }>;
    const match = resources.find((r) => r.url && site && r.url.includes(new URL(site).hostname));
    return match?.id;
  } catch {
    return undefined;
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const email = process.env.JIRA_USER_EMAIL || process.env.JIRA_EMAIL || '';
  const token = process.env.JIRA_API_TOKEN || process.env.JIRA_TOKEN || '';
  const site = process.env.JIRA_BASE_URL || process.env.JIRA_URL || 'https://delfia.atlassian.net';
  let cloudId = process.env.JIRA_CLOUD_ID || '';

  if (!email || !token) return res.status(500).json({ error: 'Missing JIRA_EMAIL or JIRA_TOKEN env vars' });

  if (!cloudId) {
    cloudId = (await resolveCloudId(email, token, site)) || '';
  }

  const jira = new JiraAPI(email, token, cloudId || undefined, site);
  const action = (req.method === 'GET' ? req.query.action : req.body?.action) as string;

  try {
    switch (action) {
      // ── READ ──────────────────────────────────────────────────────────────
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

      // ── WRITE ─────────────────────────────────────────────────────────────
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
