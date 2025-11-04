# API Vercel Functions - Integração com Jira

Esta pasta contém as Serverless Functions da Vercel para integração com o Jira.

## Função: `buscar-fsa.ts`

Faz proxy para a API de busca do Jira, permitindo buscar issues por JQL (Jira Query Language).

### Endpoint

```
GET /api/buscar-fsa?jql=<jql_query>&fields=<campos>&maxResults=<max>
```

### Parâmetros de Query

- **jql** (obrigatório): Query JQL para buscar issues (ex: `text ~ "FSA 123"`)
- **fields** (opcional): Campos a serem retornados, separados por vírgula (padrão: `summary,assignee,status,created`)
- **maxResults** (opcional): Número máximo de resultados (padrão: `50`)

### Exemplo de Uso

```typescript
GET /api/buscar-fsa?jql=text%20~%20%22FSA%20123%22&fields=summary,description,created
```

### Resposta (Sucesso)

Retorna o mesmo formato da API do Jira:

```json
{
  "expand": "schema,names",
  "startAt": 0,
  "maxResults": 50,
  "total": 1,
  "issues": [
    {
      "id": "10001",
      "key": "PROJ-123",
      "fields": {
        "summary": "FSA 123 - Loja 456",
        "description": "...",
        "created": "2024-01-01T00:00:00.000Z"
      }
    }
  ]
}
```

### Resposta (Erro)

```json
{
  "error": "Mensagem de erro",
  "details": "Detalhes adicionais (apenas em desenvolvimento)"
}
```

---

## Função: `gerar-rat.ts`

Cria uma nova issue no Jira a partir dos dados de um RAT (Relatório de Atendimento Técnico).

### Configuração de Variáveis de Ambiente na Vercel

Para que esta função funcione, você precisa configurar as seguintes variáveis de ambiente no painel da Vercel:

1. **JIRA_USER_EMAIL** ou **JIRA_EMAIL**
   - Email do usuário do Jira (ex: `usuario@exemplo.com`)

2. **JIRA_API_TOKEN** ou **JIRA_TOKEN**
   - Token de API do Jira (gerado em: Configurações do Jira > Segurança > Tokens de API)

3. **JIRA_CLOUD_ID** (obrigatório se usar EX API)
   - Cloud ID do seu workspace Jira
   - Pode ser encontrado na URL: `https://[workspace].atlassian.net/_edge/tenant_info`

4. **JIRA_BASE_URL** ou **JIRA_URL** (alternativa ao Cloud ID)
   - URL base do seu Jira (ex: `https://seuworkspace.atlassian.net`)

5. **JIRA_PROJECT_KEY** (opcional, padrão: `PROJ`)
   - Chave do projeto Jira onde as issues serão criadas

6. **JIRA_ISSUE_TYPE** (opcional, padrão: `Task`)
   - Tipo de issue a ser criada (ex: `Task`, `Bug`, `Story`, etc.)

### Como Configurar na Vercel

1. Acesse o painel da Vercel: https://vercel.com/dashboard
2. Selecione seu projeto
3. Vá em **Settings** > **Environment Variables**
4. Adicione cada variável acima com seus valores
5. Certifique-se de selecionar os ambientes apropriados (Production, Preview, Development)
6. Faça um novo deploy do projeto

### Como Testar Localmente

Para testar a função localmente usando a Vercel CLI:

```bash
# Instalar Vercel CLI (se ainda não tiver)
npm i -g vercel

# Rodar em modo desenvolvimento
vercel dev
```

A função estará disponível em: `http://localhost:3000/api/gerar-rat`

### Formato da Requisição

```typescript
POST /api/gerar-rat
Content-Type: application/json

{
  // Dados do RAT (todos os campos são opcionais)
  fsa: "123",
  codigoLoja: "456",
  pdv: "1",
  endereco: "Rua Exemplo, 123",
  cidade: "São Paulo",
  uf: "SP",
  nomeSolicitante: "João Silva",
  serial: "SN123456",
  patrimonio: "PAT789",
  marca: "HP",
  modelo: "LaserJet Pro",
  defeitoProblema: "Impressora não liga",
  diagnosticoTestes: "Verificado fonte de alimentação",
  solucao: "Troca de fonte",
  problemaResolvido: "Sim",
  prestadorNome: "José Silva",
  prestadorRgMatricula: "12345",
  
  // Opcionais: podem vir do body ou das env vars
  projectKey: "PROJ",  // Sobrescreve JIRA_PROJECT_KEY
  issueType: "Task",   // Sobrescreve JIRA_ISSUE_TYPE
  customFields: {      // Campos customizados do Jira
    customfield_12345: "valor"
  }
}
```

### Formato da Resposta (Sucesso)

```json
{
  "success": true,
  "issueKey": "PROJ-123",
  "issueId": "10001",
  "self": "https://api.atlassian.com/ex/jira/cloudid/rest/api/3/issue/10001",
  "summary": "FSA 123 - Loja 456 - PDV 1"
}
```

### Formato da Resposta (Erro)

```json
{
  "error": "Mensagem de erro",
  "details": "Detalhes adicionais (apenas em desenvolvimento)"
}
```

### Notas Importantes

- A função usa autenticação Basic (Base64) com email e token
- O summary (título) da issue é gerado automaticamente a partir do FSA, Loja e PDV
- A descrição é formatada em Markdown com os campos principais do RAT
- A função suporta tanto a EX API do Atlassian quanto a API tradicional do Jira

