import * as functions from "firebase-functions";
import fetch from "node-fetch";
import FormData from "form-data";

const useEx = true;

function buildBase(cloudId?: string, site?: string) {
  if (useEx && cloudId) return `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3`;
  if (site) return `${site.replace(/\/$/, '')}/rest/api/3`;
  throw new Error('Missing Jira base config');
}

export const api = functions.runWith({
  secrets: ["JIRA_EMAIL", "JIRA_TOKEN", "JIRA_CLOUD_ID", "JIRA_URL"],
  timeoutSeconds: 60,
  memory: '256MB'
}).https.onRequest(async (req, res) => {
  // Basic CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).send('');

  const email = process.env.JIRA_EMAIL || '';
  const token = process.env.JIRA_TOKEN || '';
  const cloudId = process.env.JIRA_CLOUD_ID || '';
  const site = process.env.JIRA_URL || '';
  const base = buildBase(cloudId, site);
  const auth = 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64');

  try {
    if (req.path.endsWith('/jira/search')) {
      const jql = String(req.query.jql || '');
      const fields = String(req.query.fields || 'summary,assignee,status,created');
      const url = `${base}/search?jql=${encodeURIComponent(jql)}&fields=${encodeURIComponent(fields)}&maxResults=50`;
      const r = await fetch(url, { headers: { 'Accept': 'application/json', 'Authorization': auth } });
      const data = await r.text();
      return res.status(r.status).type('application/json').send(data);
    }

    if (req.path.endsWith('/jira/transition')) {
      if (req.method !== 'POST') return res.status(405).send('POST only');
      const { issueKey, transitionId } = req.body || {};
      if (!issueKey || !transitionId) return res.status(400).json({ error: 'Missing issueKey/transitionId' });
      const url = `${base}/issue/${encodeURIComponent(issueKey)}/transitions`;
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': auth },
        body: JSON.stringify({ transition: { id: transitionId } })
      });
      const data = await r.text();
      return res.status(r.status).type('application/json').send(data || '{}');
    }

    if (req.path.endsWith('/jira/transitions')) {
      const issueKey = String(req.query.issueKey || '');
      if (!issueKey) return res.status(400).json({ error: 'Missing issueKey' });
      const url = `${base}/issue/${encodeURIComponent(issueKey)}/transitions`;
      const r = await fetch(url, { headers: { 'Accept': 'application/json', 'Authorization': auth } });
      const data = await r.text();
      return res.status(r.status).type('application/json').send(data);
    }

    if (req.path.endsWith('/jira/attach')) {
      if (req.method !== 'POST') return res.status(405).send('POST only');
      const { issueKey, fileName, fileBase64 } = req.body || {};
      if (!issueKey || !fileName || !fileBase64) return res.status(400).json({ error: 'Missing issueKey/fileName/fileBase64' });
      const url = `${base}/issue/${encodeURIComponent(issueKey)}/attachments`;
      const buf = Buffer.from(String(fileBase64), 'base64');
      const form = new FormData();
      form.append('file', buf, { filename: fileName, contentType: 'application/pdf' });
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'X-Atlassian-Token': 'no-check', 'Authorization': auth },
        body: form as any,
      });
      const data = await r.text();
      return res.status(r.status).type('application/json').send(data || '{}');
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: e?.message || 'error' });
  }
});


