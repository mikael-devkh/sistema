import type { VercelRequest, VercelResponse } from '@vercel/node';

// Função buildBaseUrl - prioriza Cloud ID se disponível (formato correto para Jira Cloud)
function buildBaseUrl(cloudId?: string, site?: string): string {
  // Se tiver Cloud ID, usa o formato /ex/jira/{cloudId} (formato recomendado)
  if (cloudId) {
    return `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3`;
  }
  // Caso contrário, usa o site/base URL tradicional
  if (site) {
    return `${site.replace(/\/$/, '')}/rest/api/3`;
  }
  throw new Error('Missing Jira base config: JIRA_CLOUD_ID or JIRA_BASE_URL required');
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
    const cloudId = process.env.JIRA_CLOUD_ID;
    const site = process.env.JIRA_BASE_URL || process.env.JIRA_URL;
    
    if (!email || !token) {
      console.error('Missing JIRA credentials');
      return res.status(500).json({ error: 'Jira credentials incomplete.' });
    }
    
    if (!cloudId && !site) {
      console.error('Missing JIRA_CLOUD_ID or JIRA_BASE_URL');
      return res.status(500).json({ error: 'Jira base config incomplete. Provide JIRA_CLOUD_ID or JIRA_BASE_URL.' });
    }
    
    const baseUrl = buildBaseUrl(cloudId, site);
    const auth = 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64');
    
    // ---- DEBUG ----
    console.log('API /api/buscar-fsa: Configuração Jira:', {
      usingCloudId: !!cloudId,
      cloudId: cloudId ? '***' : 'N/A',
      site: site || 'N/A',
      baseUrl: baseUrl
    });
    // ---------------
    
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
    // Usando /search/jql conforme mudança do Jira (CHANGE-2046)
    // Nota: A nova API pode precisar de um formato ligeiramente diferente
    const jiraUrl = `${baseUrl}/search/jql`;
    
    // ---- DEBUG ----
    console.log('API /api/buscar-fsa: Chamando Jira:', {
      baseUrl: baseUrl,
      url: jiraUrl,
      body: jiraBody,
      jql: jiraBody.jql,
      fields: jiraBody.fields,
      maxResults: jiraBody.maxResults,
      bodyStringified: JSON.stringify(jiraBody)
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
    console.log('API /api/buscar-fsa: Resposta completa do Jira:', {
      status: jiraResponse.status,
      statusText: jiraResponse.statusText,
      ok: jiraResponse.ok,
      headers: Object.fromEntries(jiraResponse.headers.entries()),
      responseDataLength: responseData.length,
      responseData: responseData // Resposta completa para debug
    });
    // ---------------
    
    if (!jiraResponse.ok) {
      console.error('Jira API error:', {
        status: jiraResponse.status,
        statusText: jiraResponse.statusText,
        responseData: responseData
      });
      
      let errorDetails;
      try {
        errorDetails = JSON.parse(responseData);
      } catch {
        errorDetails = responseData;
      }
      
      // Extrair mensagens de erro do Jira
      const errorMessages = errorDetails?.errorMessages || errorDetails?.errorMessage || [];
      const errorMessage = Array.isArray(errorMessages) ? errorMessages.join(', ') : String(errorMessages || 'Unknown error');
      
      return res.status(jiraResponse.status).json({
        error: `Failed to search Jira issues: ${errorMessage}`,
        details: errorDetails,
        jql: jiraBody.jql
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
