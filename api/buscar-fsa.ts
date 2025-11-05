import type { VercelRequest, VercelResponse } from '@vercel/node';

// Classe auxiliar para gerenciar a conexão com Jira API
class JiraAPI {
  private email: string;
  private apiToken: string;
  private jiraUrl: string;
  private cloudId?: string;
  public useExApi: boolean;

  constructor(email: string, apiToken: string, jiraUrl: string, cloudId?: string, useExApi: boolean = false) {
    this.email = email;
    this.apiToken = apiToken.trim().replace(/\s+/g, ''); // Limpar token
    this.jiraUrl = jiraUrl.replace(/\/$/, '');
    this.cloudId = cloudId;
    this.useExApi = useExApi || !!cloudId; // Se tiver Cloud ID, usa EX API
  }

  // Método para construir a URL base da API
  private _base(): string {
    if (this.useExApi && this.cloudId) {
      return `https://api.atlassian.com/ex/jira/${this.cloudId}/rest/api/3`;
    }
    return `${this.jiraUrl}/rest/api/3`;
  }

  // Método para construir os headers de autenticação
  private _authHeaders(): Record<string, string> {
    const auth = 'Basic ' + Buffer.from(`${this.email}:${this.apiToken}`).toString('base64');
    return {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': auth
    };
  }

  // Método genérico para fazer requisições
  private async _req(endpoint: string, method: string = 'GET', body?: any): Promise<Response> {
    const url = `${this._base()}${endpoint}`;
    const headers = this._authHeaders();

    // ---- DEBUG ----
    if (method === 'POST') {
      console.log('JiraAPI._req: Enviando requisição:', {
        url,
        method,
        body: body,
        headers: {
          ...headers,
          Authorization: headers.Authorization.substring(0, 15) + '***'
        }
      });
    }
    // ---------------

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    return response;
  }

  // Método principal de busca usando POST /search/jql com paginação
  async buscarChamados(jql: string, fields: string[], maxResults: number = 50): Promise<any> {
    const allIssues: any[] = [];
    let nextPageToken: string | null = null;
    let pageCount = 0;

    do {
      pageCount++;
      const body: any = {
        jql,
        fields,
        maxResults
      };

      if (nextPageToken) {
        body.nextPageToken = nextPageToken;
      }

      console.log(`JiraAPI.buscarChamados: Página ${pageCount}`, {
        jql,
        fieldsCount: fields.length,
        maxResults,
        hasNextPageToken: !!nextPageToken
      });

      const response = await this._req('/search/jql', 'POST', body);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('JiraAPI.buscarChamados: Erro na requisição', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`Jira API error (${response.status}): ${errorText}`);
      }

      const responseText = await response.text();
      
      // ---- DEBUG ----
      console.log('JiraAPI.buscarChamados: Resposta recebida:', {
        status: response.status,
        responseLength: responseText.length,
        responsePreview: responseText.substring(0, 300)
      });
      // ---------------
      
      const data = JSON.parse(responseText);
      const issues = data.issues || [];
      
      console.log(`JiraAPI.buscarChamados: Página ${pageCount} processada`, {
        issuesInPage: issues.length,
        total: data.total || 0,
        isLast: data.isLast,
        hasNextPageToken: !!data.nextPageToken,
        firstIssueKey: issues[0]?.key
      });

      allIssues.push(...issues);
      nextPageToken = data.nextPageToken || null;
    } while (nextPageToken);

    return {
      issues: allIssues,
      total: allIssues.length
    };
  }
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
    
    // 2. LER PARÂMETROS DO BODY
    const { jql, fields, maxResults } = req.body;
    
    if (!jql) {
      return res.status(400).json({ error: 'Missing required body parameter: jql' });
    }

    // 3. INSTANCIAR A CLASSE JiraAPI
    const jiraApi = new JiraAPI(
      email,
      token,
      site || 'https://delfia.atlassian.net',
      cloudId,
      !!cloudId // useExApi = true se tiver cloudId
    );

    // ---- DEBUG ----
    console.log('API /api/buscar-fsa: Configuração Jira:', {
      usingCloudId: !!cloudId,
      cloudId: cloudId ? '***' : 'N/A',
      site: site || 'N/A',
      useExApi: jiraApi.useExApi,
      email: email ? `${email.substring(0, 3)}***${email.substring(email.length - 3)}` : 'N/A',
      tokenLength: token ? token.trim().replace(/\s+/g, '').length : 0,
      tokenStartsWithATATT: token?.trim().replace(/\s+/g, '').startsWith('ATATT') || false
    });
    // ---------------

    // 4. BUSCAR CHAMADOS USANDO A CLASSE
    const fieldsArray = fields || ['summary', 'description', 'created'];
    const maxResultsNum = maxResults || 1;
    
    console.log('API /api/buscar-fsa: Buscando com:', { jql, fields: fieldsArray, maxResults: maxResultsNum });
    
    const resultado = await jiraApi.buscarChamados(jql, fieldsArray, maxResultsNum);
    
    // ---- DEBUG ----
    console.log('API /api/buscar-fsa: Resultado da busca:', {
      total: resultado.total,
      issuesFound: resultado.issues.length,
      sampleIssues: resultado.issues.slice(0, 2).map((i: any) => ({
        key: i.key,
        summary: i.fields?.summary
      }))
    });
    // ---------------
    
    // 5. RETORNAR RESULTADO NO FORMATO ESPERADO
    return res.status(200).json({
      issues: resultado.issues,
      total: resultado.total,
      isLast: true
    });
    
  } catch (error: any) {
    console.error('Error searching Jira issues:', error);
    return res.status(500).json({
      error: error?.message || 'Internal server error'
    });
  }
}
