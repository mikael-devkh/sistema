import type { VercelRequest, VercelResponse } from '@vercel/node';

// Tipos para o payload da requisição
interface RatFormData {
  fsa?: string;
  codigoLoja?: string;
  pdv?: string;
  endereco?: string;
  cidade?: string;
  uf?: string;
  nomeSolicitante?: string;
  serial?: string;
  patrimonio?: string;
  marca?: string;
  modelo?: string;
  defeitoProblema?: string;
  diagnosticoTestes?: string;
  solucao?: string;
  problemaResolvido?: string;
  motivoNaoResolvido?: string;
  prestadorNome?: string;
  prestadorRgMatricula?: string;
  // Outros campos do RAT conforme necessário
}

interface CreateIssuePayload {
  fields: {
    project: {
      key: string;
    };
    summary: string;
    description?: string | { type: string; version: number; content: any[] };
    issuetype: {
      name: string;
    };
    // Campos customizados do Jira (opcionais)
    [key: string]: any;
  };
}

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

function formatDescription(data: RatFormData): string {
  const parts: string[] = [];
  
  if (data.fsa) parts.push(`*FSA:* ${data.fsa}`);
  if (data.codigoLoja) parts.push(`*Código da Loja:* ${data.codigoLoja}`);
  if (data.pdv) parts.push(`*PDV:* ${data.pdv}`);
  
  if (data.endereco || data.cidade || data.uf) {
    const enderecoCompleto = [data.endereco, data.cidade, data.uf].filter(Boolean).join(', ');
    if (enderecoCompleto) parts.push(`*Endereço:* ${enderecoCompleto}`);
  }
  
  if (data.nomeSolicitante) parts.push(`*Solicitante:* ${data.nomeSolicitante}`);
  
  if (data.serial) parts.push(`*Serial:* ${data.serial}`);
  if (data.patrimonio) parts.push(`*Patrimônio:* ${data.patrimonio}`);
  if (data.marca || data.modelo) {
    parts.push(`*Equipamento:* ${[data.marca, data.modelo].filter(Boolean).join(' ')}`);
  }
  
  if (data.defeitoProblema) {
    parts.push('');
    parts.push('*Defeito/Problema:*');
    parts.push(data.defeitoProblema);
  }
  
  if (data.diagnosticoTestes) {
    parts.push('');
    parts.push('*Diagnóstico/Testes:*');
    parts.push(data.diagnosticoTestes);
  }
  
  if (data.solucao) {
    parts.push('');
    parts.push('*Solução:*');
    parts.push(data.solucao);
  }
  
  if (data.problemaResolvido) {
    parts.push('');
    parts.push(`*Problema Resolvido:* ${data.problemaResolvido}`);
  }
  
  if (data.motivoNaoResolvido) {
    parts.push('');
    parts.push('*Motivo Não Resolvido:*');
    parts.push(data.motivoNaoResolvido);
  }
  
  if (data.prestadorNome) {
    parts.push('');
    parts.push(`*Prestador:* ${data.prestadorNome}${data.prestadorRgMatricula ? ` (${data.prestadorRgMatricula})` : ''}`);
  }
  
  return parts.join('\n');
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  // Verificar método POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
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
    
    // Ler dados do RAT do body
    const ratData: RatFormData = req.body;
    
    if (!ratData) {
      return res.status(400).json({ error: 'Missing request body with RAT data' });
    }
    
    // Configurações do projeto e tipo de issue (podem vir do body ou de env vars)
    const projectKey = req.body.projectKey || process.env.JIRA_PROJECT_KEY || 'PROJ';
    const issueType = req.body.issueType || process.env.JIRA_ISSUE_TYPE || 'Task';
    
    // Gerar summary (título) da issue
    const summaryParts: string[] = [];
    if (ratData.fsa) summaryParts.push(`FSA ${ratData.fsa}`);
    if (ratData.codigoLoja) summaryParts.push(`Loja ${ratData.codigoLoja}`);
    if (ratData.pdv) summaryParts.push(`PDV ${ratData.pdv}`);
    
    const summary = summaryParts.length > 0 
      ? summaryParts.join(' - ')
      : `RAT - ${new Date().toLocaleDateString('pt-BR')}`;
    
    // Formatar descrição
    const descriptionText = formatDescription(ratData);
    
    // Preparar payload para criar issue no Jira
    // O Jira aceita tanto texto simples quanto o formato ADF (Atlassian Document Format)
    // Vamos usar texto simples primeiro, que é mais simples
    const payload: CreateIssuePayload = {
      fields: {
        project: {
          key: projectKey
        },
        summary: summary,
        description: descriptionText, // Texto simples - o Jira converte automaticamente
        issuetype: {
          name: issueType
        }
      }
    };
    
    // Campos customizados opcionais (se fornecidos)
    if (req.body.customFields) {
      Object.assign(payload.fields, req.body.customFields);
    }
    
    // Chamar API do Jira para criar issue
    const jiraUrl = `${baseUrl}/issue`;
    const jiraResponse = await fetch(jiraUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': auth
      },
      body: JSON.stringify(payload)
    });
    
    const responseData = await jiraResponse.text();
    
    if (!jiraResponse.ok) {
      console.error('Jira API error:', responseData);
      let errorMessage = 'Failed to create Jira issue';
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
      issueData = { raw: responseData };
    }
    
    // Retornar resposta de sucesso
    return res.status(201).json({
      success: true,
      issueKey: issueData.key,
      issueId: issueData.id,
      self: issueData.self,
      summary: summary
    });
    
  } catch (error: any) {
    console.error('Error creating Jira issue:', error);
    return res.status(500).json({
      error: error?.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    });
  }
}
