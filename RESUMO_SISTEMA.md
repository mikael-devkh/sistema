# Resumo do Sistema

## Visao geral

Este projeto e um sistema web de gestao operacional para field service da WT Tecnologia. A aplicacao centraliza rotinas de atendimento tecnico, emissao de RATs, acompanhamento de chamados, validacao operacional/financeira, pagamentos de tecnicos, controle de estoque, base de conhecimento, agendamentos e relatorios.

O sistema foi construido como uma SPA em React com TypeScript, usando Firebase para autenticacao e Firestore, alem de funcoes serverless para integracao com Jira/Atlassian.

## Objetivo principal

O objetivo do sistema e reduzir o trabalho manual do time tecnico e administrativo, padronizando o fluxo desde o atendimento em campo ate a validacao, faturamento interno e pagamento dos tecnicos.

Em termos praticos, ele ajuda a:

- Gerar configuracoes tecnicas rapidamente, como IPs de lojas, PDVs e desktops.
- Criar RATs padronizadas com historico, templates, preenchimento assistido e geracao de PDF.
- Registrar chamados e lotes de chamados associados a tecnicos, lojas, servicos e pecas.
- Validar chamados em etapas operacional e financeira.
- Calcular e controlar pagamentos por tecnico.
- Controlar itens de estoque, entradas, saidas e alertas de quantidade minima.
- Consultar agenda, mapa, lojas, tecnicos, relatorios e base de conhecimento.

## Tecnologias principais

- Frontend: React 18, TypeScript, Vite e React Router.
- UI: Tailwind CSS, Radix UI, componentes estilo shadcn/ui, lucide-react e sonner.
- Estado e dados: TanStack React Query, Context API e hooks customizados.
- Backend/dados: Firebase Authentication e Cloud Firestore.
- Serverless: Vercel Functions em `api/` e Firebase Functions em `functions/`.
- Integracoes: Jira/Atlassian para busca de FSA, criacao/atualizacao de issues, anexos e transicoes.
- Mapas e visualizacao: Leaflet, React Leaflet, clustering e Recharts.
- Documentos/exportacao: pdf-lib, XLSX, CSV e JSZip.
- Testes: Vitest, Testing Library e Playwright.
- Mobile/build: suporte a Capacitor Android e configuracao PWA no projeto.

## Perfis e permissoes

O sistema usa perfis carregados da colecao `users` no Firestore. Os papeis previstos sao:

- `admin`: acesso completo, incluindo usuarios, tecnicos, catalogo, estoque, validacao e pagamentos.
- `operador`: atua em chamados, validacao operacional, estoque e relatorios, sem acesso financeiro completo.
- `financeiro`: atua em validacao financeira, catalogo, pagamentos, estoque e valores financeiros.
- `tecnico`: pode criar/editar RATs e consultar recursos tecnicos, mas nao acessa rotinas administrativas sensiveis.
- `visualizador`: acesso restrito, principalmente consulta/relatorios.

As permissoes sao centralizadas em `src/lib/permissions.ts` e usadas pelos componentes e paginas para liberar ou esconder acoes.

## Funcionalidades

### Dashboard

A tela inicial apresenta atalhos e indicadores conforme o perfil do usuario. Para tecnicos, exibe RATs do mes, agendamentos, gerador de IP e perfil. Para backoffice, exibe metricas de chamados aguardando validacao, pagamentos pendentes e estoque baixo.

### Gerador de IP

Permite consultar uma loja e gerar configuracoes de rede para PDVs, impressoras e desktops. O modulo utiliza a base local de lojas e calcula IP, mascara, gateway, broadcast e DNS, mantendo historico recente no navegador.

### RAT - Relatorio de Atendimento Tecnico

O modulo de RAT permite criar relatorios tecnicos com dados do atendimento, loja, FSA, PDV, equipamento, pecas, diagnostico, solucao e prestador. Tambem inclui:

- multiplas sessoes de RAT;
- rascunho salvo localmente;
- historico de RATs;
- autocomplete por textos usados anteriormente;
- templates aplicaveis aos campos do relatorio;
- modo foco;
- preview e geracao de PDF;
- anexo/atualizacao de issues no Jira;
- busca de FSA por numero.

### Templates de RAT

Area para criar, editar, duplicar e organizar modelos de laudo. Os templates ajudam a padronizar descricoes de defeito, diagnostico e solucao.

### Base de Conhecimento

Repositorio interno de procedimentos, passo a passo e dicas tecnicas. Possui busca por titulo, conteudo ou tag, votos, edicao controlada e restauracao de conteudos padrao.

### Agendamentos

Modulo para acompanhamento de agendamentos e chamados vindos do Jira. Inclui visoes por abas, indicadores, grupos por loja, ordenacao por cidade/loja/SLA/agenda, mapa, acompanhamento de requisicoes, visao de gerente, planilha interna e painel de tecnico em campo.

### Loja 360

Pagina de detalhe de uma loja, acessada por codigo. Mostra informacoes de rede, atalhos para gerar IP, abrir mapa e iniciar uma nova RAT, alem do historico recente de RATs daquela loja para o usuario.

### Chamados

Permite registrar, editar, buscar e acompanhar chamados operacionais. O chamado pode ter:

- codigo principal e itens adicionais em lote;
- loja, tecnico e servico do catalogo;
- data, hora de inicio/fim e duracao;
- peca usada, custo e fornecedor;
- link da plataforma/Jira;
- observacoes;
- status e historico de alteracoes.

O fluxo de status passa por rascunho, submissao, validacao operacional, validacao financeira, rejeicao, pagamento pendente e pago.

### Validacao

Fila de validacao para revisar chamados antes de pagamento/faturamento. O modulo oferece:

- validacao operacional;
- validacao financeira;
- rejeicao com motivo;
- historico completo;
- alertas de urgencia por SLA;
- lock otimista de revisao para evitar edicoes concorrentes;
- configuracao de motivos de rejeicao.

### Pagamentos

Gera, revisa e controla pagamentos de tecnicos a partir dos chamados aprovados. O calculo considera servico, adicionais, horas extras, reembolso de pecas e destino do pagamento, incluindo tecnicos vinculados a um tecnico pai.

Funcionalidades principais:

- pre-visualizacao por periodo;
- selecao de chamados por tecnico;
- confirmacao de pagamentos;
- marcacao como pago;
- cancelamento;
- historico;
- detalhamento financeiro;
- exportacao/analise em planilha.

### Catalogo de Servicos

Cadastro de clientes e servicos contratados. Cada servico pode definir valores de receita, custo tecnico, adicionais, horas extras, franquia, exigencia de peca, pagamento ao tecnico e regras de retorno.

### Estoque

Controle de itens de estoque com cadastro, edicao, exclusao, quantidade minima, unidade, movimentos de entrada/saida e historico. O dashboard e a sidebar indicam itens abaixo do minimo.

### Tecnicos

Modulo administrativo para cadastro e gestao de tecnicos. O perfil de tecnico inclui codigo unico, dados pessoais, telefone, cargo, especialidades, localizacao, area de atendimento, disponibilidade, dados de pagamento, hierarquia de tecnico pai/filho e status.

Tambem ha uma pagina de mapa de tecnicos para visualizar cobertura geografica e disponibilidade.

### Diario de Bordo

Registro de ocorrencias em campo por data, tecnico, cidade, gravidade e descricao. Ajuda a identificar recorrencias por cidade e problemas frequentes.

### Relatorios

Area de historico consolidado de RATs e chamados. Possui filtros por status, loja, FSA/codigo, periodo, busca textual, detalhes e exportacao CSV.

### Perfil e configuracoes

Paginas para dados do usuario, preferencias e configuracoes gerais do sistema, incluindo informacoes usadas em automacoes e integracoes.

### Busca global

O componente de busca global fica disponivel no app autenticado e permite acessar rapidamente informacoes e rotas relevantes.

## Integracoes externas

### Jira/Atlassian

O projeto possui funcoes serverless para:

- buscar FSA/issues por JQL;
- criar RAT como issue;
- atualizar campos;
- anexar PDF;
- consultar e executar transicoes;
- apoiar o modulo de agendamentos.

As funcoes em `api/` rodam na Vercel. A pasta `functions/` contem uma Firebase Function com endpoints equivalentes para busca, transicao e anexo no Jira.

### Firebase

O Firebase e usado para:

- autenticacao;
- perfis de usuario;
- armazenamento de RATs, chamados, pagamentos, estoque, tecnicos, catalogo e configuracoes;
- regras de seguranca em `firestore.rules`;
- indices em `firestore.indexes.json`.

## Principais colecoes/dados

Pelo codigo, as principais colecoes usadas no Firestore incluem:

- `users`: perfis e papeis de usuarios.
- `serviceReports`: RATs/relatorios arquivados.
- `chamados`: chamados operacionais e seu fluxo de validacao.
- `pagamentos`: pagamentos gerados para tecnicos.
- `estoqueItens`: cadastro e saldo de itens de estoque.
- `technicians`: tecnicos cadastrados e disponibilidade.
- `configuracoes`: parametros como motivos de rejeicao.
- colecoes de catalogo/clientes e movimentos de estoque usadas pelos modulos de catalogo e estoque.

## Estrutura do projeto

- `src/pages/`: telas principais do sistema.
- `src/components/`: componentes reutilizaveis, layout, navegacao e componentes especificos de modulos.
- `src/components/ui/`: componentes base de UI.
- `src/context/`: contextos globais, como autenticacao, modo foco e autofill de RAT.
- `src/hooks/`: hooks de dados e comportamento.
- `src/lib/`: clientes, integracoes, regras de negocio, Firestore e validacoes.
- `src/types/`: tipos TypeScript dos dominios do sistema.
- `src/data/`: dados locais como lojas, templates e opcoes.
- `src/utils/`: calculadoras, geracao de PDF, exportacoes e utilitarios.
- `api/`: Vercel Functions para Jira e RAT.
- `functions/`: Firebase Functions.
- `e2e/`: testes end-to-end Playwright.

## Scripts uteis

- `npm run dev`: inicia o ambiente de desenvolvimento Vite.
- `npm run build`: gera build de producao.
- `npm run build:dev`: gera build em modo development.
- `npm run lint`: executa ESLint.
- `npm run test`: executa testes unitarios com Vitest.
- `npm run test:e2e`: executa testes end-to-end com Playwright.
- `npm run setup:test-users`: cria usuarios de teste.

## Resumo final

O sistema funciona como uma plataforma integrada de operacao tecnica e backoffice. Ele cobre o ciclo de vida do atendimento: consulta tecnica, agendamento, execucao, geracao de RAT, registro do chamado, validacao, pagamento, controle de estoque e relatorios. A combinacao de Firebase, Jira e telas especializadas permite que tecnicos e administradores trabalhem em um fluxo unico, com rastreabilidade e padronizacao.
