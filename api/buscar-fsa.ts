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
      maxResults: parsedData.maxResults || 0,
      startAt: parsedData.startAt || 0,
      issuesFound: parsedData.issues?.length || 0,
      isLast: parsedData.isLast,
      nextPageToken: parsedData.nextPageToken ? 'presente' : 'não presente',
      jql: jiraBody.jql,
      sampleIssues: parsedData.issues?.slice(0, 2).map((i: any) => ({
        key: i.key,
        summary: i.fields?.summary
      })) || []
    });
    
    // Se não encontrou resultados, fazer testes de diagnóstico
    if ((parsedData.total || 0) === 0 && parsedData.issues?.length === 0) {
      console.warn('API /api/buscar-fsa: Nenhum resultado encontrado. Executando testes de diagnóstico...');
      
      // Teste 1: Buscar qualquer issue do projeto FSA
      try {
        const testJql = 'project = FSA ORDER BY created DESC';
        const testBody = {
          jql: testJql,
          fields: ['summary', 'key'],
          maxResults: 1
        };
        
        const testResponse = await fetch(`${baseUrl}/search/jql`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': auth
          },
          body: JSON.stringify(testBody)
        });
        
        if (testResponse.ok) {
          const testData = await testResponse.json();
          console.log('API /api/buscar-fsa: Teste 1 - Busca simples projeto FSA:', {
            total: testData.total || 0,
            found: testData.issues?.length || 0,
            sample: testData.issues?.[0]?.key
          });
        } else {
          const testError = await testResponse.text();
          console.error('API /api/buscar-fsa: Teste 1 falhou:', testResponse.status, testError);
        }
      } catch (testError) {
        console.error('API /api/buscar-fsa: Erro no teste 1:', testError);
      }
      
      // Teste 2: Listar projetos acessíveis
      try {
        const projectsResponse = await fetch(`${baseUrl}/project`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Authorization': auth
          }
        });
        
        if (projectsResponse.ok) {
          const projectsData = await projectsResponse.json();
          const fsaProject = projectsData.find((p: any) => p.key === 'FSA' || p.name?.toUpperCase().includes('FSA'));
          console.log('API /api/buscar-fsa: Teste 2 - Projetos acessíveis:', {
            totalProjects: projectsData.length,
            fsaProjectFound: !!fsaProject,
            fsaProjectKey: fsaProject?.key,
            fsaProjectName: fsaProject?.name,
            firstProjects: projectsData.slice(0, 5).map((p: any) => ({ key: p.key, name: p.name }))
          });
        } else {
          const projectsError = await projectsResponse.text();
          console.error('API /api/buscar-fsa: Teste 2 falhou:', {
            status: projectsResponse.status,
            statusText: projectsResponse.statusText,
            error: projectsError
          });
        }
      } catch (testError) {
        console.error('API /api/buscar-fsa: Erro no teste 2:', testError);
      }
      
      // Teste 3: Verificar usuário atual (autenticação)
      try {
        const myselfResponse = await fetch(`${baseUrl}/myself`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Authorization': auth
          }
        });
        
        if (myselfResponse.ok) {
          const myselfData = await myselfResponse.json();
          console.log('API /api/buscar-fsa: Teste 3 - Usuário autenticado:', {
            accountId: myselfData.accountId,
            displayName: myselfData.displayName,
            emailAddress: myselfData.emailAddress,
            active: myselfData.active
          });
        } else {
          const myselfError = await myselfResponse.text();
          console.error('API /api/buscar-fsa: Teste 3 falhou (problema de autenticação):', {
            status: myselfResponse.status,
            error: myselfError
          });
        }
      } catch (testError) {
        console.error('API /api/buscar-fsa: Erro no teste 3:', testError);
      }
    }
    // ---------------
    
    return res.status(200).json(parsedData);
    
  } catch (error: any) {
    console.error('Error searching Jira issues:', error);
    return res.status(500).json({
      error: error?.message || 'Internal server error'
    });
  }
}
