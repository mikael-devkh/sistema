import type { VercelRequest, VercelResponse } from '@vercel/node';

function buildBaseUrl(cloudId?: string, site?: string): string {
  const useEx = false;
  
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  // Aceitar tanto GET quanto POST (mas sempre usa POST para o Jira)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use GET or POST.' });
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
    
    // Ler parâmetros do body (POST) ou query string (para compatibilidade)
    const jql = (req.body?.jql as string | undefined) || (req.query.jql as string | undefined);
    const fields = (req.body?.fields as string | undefined) || (req.query.fields as string | undefined) || 'summary,assignee,status,created';
    const maxResults = (req.body?.maxResults as string | undefined) || (req.query.maxResults as string | undefined) || '50';
    
    if (!jql) {
      return res.status(400).json({ error: 'Missing required parameter: jql' });
    }
    
    // Construir URL da API do Jira (agora usando o endpoint POST /search/jql)
    const jiraUrl = `${baseUrl}/search/jql`;
    
    // Preparar o corpo (body) da requisição
    const body = {
      jql: jql,
      fields: fields.split(',').map(f => f.trim()).filter(Boolean),
      maxResults: parseInt(maxResults, 10)
    };
    
    // Chamar API do Jira para buscar issues
    const jiraResponse = await fetch(jiraUrl, {
      method: 'POST', // MUDOU DE GET PARA POST
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json', // Adicionado Content-Type
        'Authorization': auth
      },
      body: JSON.stringify(body) // Enviando dados no corpo
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
