import type { VercelRequest, VercelResponse } from '@vercel/node';

// Função buildBaseUrl (a mesma de antes, com useEx = false)
function buildBaseUrl(cloudId?: string, site?: string): string {
  const useEx = false; // Corrigido para 'false'
  
  if (useEx && cloudId) {
    return `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3`;
  }
  if (site) {
    return `${site.replace(/\/$/, '')}/rest/api/3`;
  }
  throw new Error('Missing Jira base config: JIRA_BASE_URL required');
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS'); // APENAS POST
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  // 1. VERIFICAR MÉTODO POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }
  
  try {
    // ---- DEBUG ----
    console.log('API /api/buscar-fsa RECEBEU BODY:', req.body);
    // ---------------
    
    const email = process.env.JIRA_USER_EMAIL || process.env.JIRA_EMAIL;
    const token = process.env.JIRA_API_TOKEN || process.env.JIRA_TOKEN;
    const site = process.env.JIRA_BASE_URL || process.env.JIRA_URL;
    
    if (!email || !token || !site) {
      console.error('Missing JIRA credentials or JIRA_BASE_URL');
      return res.status(500).json({ error: 'Jira config incomplete.' });
    }
    
    const baseUrl = buildBaseUrl(undefined, site);
    const auth = 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64');
    
    // 2. LER PARÂMETROS DO BODY
    const { jql, fields, maxResults } = req.body;
    
    if (!jql) {
      return res.status(400).json({ error: 'Missing required body parameter: jql' });
    }

    // 3. PREPARAR O BODY PARA O JIRA
    const jiraBody = {
      jql: jql as string,
      fields: fields || ['summary', 'description', 'created'],
      maxResults: maxResults || 50
    };

    // 4. CHAMAR A API DO JIRA COM POST
    const jiraUrl = `${baseUrl}/search`;
    
    // ---- DEBUG ----
    console.log('API /api/buscar-fsa: Chamando Jira:', {
      url: jiraUrl,
      body: jiraBody,
      jql: jiraBody.jql
    });
    // ---------------
    
    const jiraResponse = await fetch(jiraUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': auth
      },
      body: JSON.stringify(jiraBody)
    });
    
    const responseData = await jiraResponse.text();
    
    // ---- DEBUG ----
    console.log('API /api/buscar-fsa: Resposta do Jira:', {
      status: jiraResponse.status,
      statusText: jiraResponse.statusText,
      ok: jiraResponse.ok,
      responseData: responseData.substring(0, 500) // Primeiros 500 caracteres para debug
    });
    // ---------------
    
    if (!jiraResponse.ok) {
      console.error('Jira API error:', responseData);
      let errorDetails;
      try {
        errorDetails = JSON.parse(responseData);
      } catch {
        errorDetails = responseData;
      }
      return res.status(jiraResponse.status).json({
        error: 'Failed to search Jira issues',
        details: errorDetails
      });
    }
    
    // Retornar resposta de sucesso
    let parsedData;
    try {
      parsedData = JSON.parse(responseData);
    } catch (error) {
      console.error('Error parsing Jira response:', error);
      return res.status(500).json({
        error: 'Failed to parse Jira response',
        details: responseData.substring(0, 500)
      });
    }
    
    // ---- DEBUG ----
    console.log('API /api/buscar-fsa: Retornando dados:', {
      total: parsedData.total || 0,
      issuesFound: parsedData.issues?.length || 0
    });
    // ---------------
    
    return res.status(200).json(parsedData);
    
  } catch (error: any) {
    console.error('Error searching Jira issues:', error);
    return res.status(500).json({
      error: error?.message || 'Internal server error'
    });
  }
}
