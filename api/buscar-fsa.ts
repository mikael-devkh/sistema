import type { VercelRequest, VercelResponse } from '@vercel/node';

function buildBaseUrl(cloudId?: string, site?: string): string {
  const useEx = true;
  
  if (useEx && cloudId) {
    return `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3`;
  }
  
  if (site) {
    return `${site.replace(/\/$/, '')}/rest/api/3`;
  }
  
  throw new Error('Missing Jira base config: JIRA_CLOUD_ID or JIRA_BASE_URL required');
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  // Verificar método GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }
  
  try {
    // Ler credenciais do Jira das variáveis de ambiente
    const email = process.env.JIRA_USER_EMAIL || process.env.JIRA_EMAIL;
    const token = process.env.JIRA_API_TOKEN || process.env.JIRA_TOKEN;
    const cloudId = process.env.JIRA_CLOUD_ID;
    const site = process.env.JIRA_BASE_URL || process.env.JIRA_URL;
    
    if (!email || !token) {
      console.error('Missing JIRA credentials in environment variables');
      return res.status(500).json({ 
        error: 'Jira credentials not configured. Please set JIRA_USER_EMAIL and JIRA_API_TOKEN.' 
      });
    }
    
    // Construir URL base da API
    const baseUrl = buildBaseUrl(cloudId, site);
    
    // Criar autenticação Basic
    const auth = 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64');
    
    // Ler parâmetros da query string
    const jql = req.query.jql as string | undefined;
    const fields = req.query.fields as string | undefined || 'summary,assignee,status,created';
    const maxResults = req.query.maxResults as string | undefined || '50';
    
    if (!jql) {
      return res.status(400).json({ error: 'Missing required query parameter: jql' });
    }
    
    // Construir URL da API do Jira com os parâmetros
    const jiraUrl = `${baseUrl}/search?jql=${encodeURIComponent(jql)}&fields=${encodeURIComponent(fields)}&maxResults=${encodeURIComponent(maxResults)}`;
    
    // Chamar API do Jira para buscar issues
    const jiraResponse = await fetch(jiraUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': auth
      }
    });
    
    const responseData = await jiraResponse.text();
    
    if (!jiraResponse.ok) {
      console.error('Jira API error:', responseData);
      let errorMessage = 'Failed to search Jira issues';
      try {
        const errorJson = JSON.parse(responseData);
        errorMessage = errorJson.errorMessages?.join(', ') || errorJson.message || errorMessage;
      } catch {}
      
      return res.status(jiraResponse.status).json({
        error: errorMessage,
        details: responseData
      });
    }
    
    // Parse da resposta de sucesso
    let issueData;
    try {
      issueData = JSON.parse(responseData);
    } catch {
      return res.status(500).json({
        error: 'Invalid JSON response from Jira',
        details: responseData
      });
    }
    
    // Retornar resposta de sucesso (mantém o formato da API do Jira)
    return res.status(200).json(issueData);
    
  } catch (error: any) {
    console.error('Error searching Jira issues:', error);
    return res.status(500).json({
      error: error?.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    });
  }
}
