export function jiraAuthHeader(email: string, token: string): string {
  const clean = token.trim().replace(/\s+/g, '');
  return 'Basic ' + Buffer.from(`${email}:${clean}`).toString('base64');
}

export function jiraBaseUrl(cloudId?: string, site?: string): string {
  if (cloudId) return `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3`;
  if (site) return `${site.replace(/\/$/, '')}/rest/api/3`;
  throw new Error('Missing Jira base config: JIRA_CLOUD_ID or JIRA_BASE_URL required');
}

export async function resolveJiraCloudId(
  email: string,
  token: string,
  site: string
): Promise<string | undefined> {
  try {
    const res = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
      headers: { Authorization: jiraAuthHeader(email, token), Accept: 'application/json' },
    });
    if (!res.ok) return undefined;
    const resources = (await res.json()) as Array<{ id: string; url: string; name?: string; scopes?: string[] }>;
    let host = '';
    try { host = new URL(site).hostname; } catch { /* ignore */ }
    const match =
      (host && resources.find((r) => r.url && r.url.includes(host))) ||
      resources.find((r) => r.url?.includes('atlassian.net')) ||
      resources.find((r) => r.name?.toLowerCase().includes('jira') || r.scopes?.includes('read:jira-work'));
    return match?.id;
  } catch {
    return undefined;
  }
}

export function debugLog(...args: unknown[]) {
  if (process.env.DEBUG_API === '1') {
    console.log(...args);
  }
}
