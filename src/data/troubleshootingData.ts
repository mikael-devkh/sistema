export interface Procedure {
  id: string;
  title: string;
  tags: string[];
  content: string; // Markdown-like content or steps
}

// --- Procedimentos Detalhados da Americanas (Base de Conhecimento Offline) ---
// Baseado nos 17 documentos fornecidos.
export const mockProcedures: Procedure[] = [
  {
    id: "gaveta-pdv",
    title: "Gaveta de Dinheiro - Problemas e Testes",
    tags: ["gaveta", "pdv", "hardware", "solenoide", "chaveiro"],
    content: "## Problemas Comuns\n\n* Gaveta não abre (sistema ou fisicamente).\n* Gaveta com miolo/chave danificados ou travando.\n\n## Testes a Realizar\n\n1. Testar a gaveta em outro PDV e testar outra gaveta no PDV com problema.\n2. Verificar conexões, especialmente o **cabo RJ-11** (que conecta à impressora).\n3. Abrir a gaveta para inspecionar e diagnosticar peças: verificar se o **solenoide e motor** estão funcionando.\n\n**IMPORTANTE:** Problemas de fechadura, miolo ou chave quebrada exigem o acionamento de um **chaveiro local**.",
  },
  {
    id: "impressora-bematech",
    title: "Impressora de PDV (Bematech MP-4200) - Configuração ESC/POS",
    tags: ["impressora", "pdv", "bematech", "configuração", "gaveta", "esc/pos"],
    content: "## Problemas e Testes\n\n* Problema: Impressora não funciona/não sai nota fiscal, Erro de Suprimento, Gaveta não abre (se a impressora for a acionadora).\n* Testes: Troca cruzada com outro PDV/Impressora. Inspeção de componentes danificados.\n\n## Configuração ESC/POS (MP-4200)\n\n1. Ligue a impressora segurando o **botão direito (avanço)**.\n2. Quando o papel sair, pressione o botão de avanço novamente para entrar nas configurações.\n3. Use **CORTE** para navegar e **AVANÇO** para modificar.\n4. Altere o **Conjunto de Comandos** de Bematech para **ESC/POS**.\n5. Desligue a impressora por 5 segundos e ligue novamente para aplicar.",
  },
  {
    id: "impressora-zebra-ip",
    title: "Impressoras Zebra / Printronix - Padrão IP e Calibração",
    tags: ["impressora", "zebra", "printronix", "rede", "ip", "calibração", "ribbon"],
    content: "## Padrão de Endereçamento IP\n\nO IP da impressora sempre será os 3 primeiros octetos da loja. O último octeto é determinado pelo modelo:\n\n* **Zebra 1**: final **19** (ex: 10.29.84.19)\n* **Zebra 2**: final **20** (ex: 10.29.84.20)\n* **Laser**: final **24** (ex: 10.29.84.24)\n* **Máscara**: 255.255.255.128\n* **Gateway**: (3 primeiros octetos da loja).126\n\n## Métodos de Calibração (Geral)\n\n1.  **Limpeza**: Limpar cabeça de impressão, sensor e rolo com álcool isopropílico.\n2.  **Calibração por IP**: Acessar o IP da impressora via browser e usar a senha **1234** para modificar configurações (S4M e ZT230).\n3.  **Calibração Manual (S600)**: Segurar os botões $FEED+PAUSE+CANCEL$ ao ligar a impressora.\n4.  **Printronix T2N**: Requer conexão USB e software específico para verificar status/configurações.",
  },
  {
    id: "pdv-cpu-geral",
    title: "PDV (CPU) - Solução de Problemas Comuns",
    tags: ["pdv", "cpu", "hardware", "software", "initramfs", "hydra", "erros sistemicos"],
    content: "## Troubleshooting Básico\n\n1.  Verificar fonte/cabo de força, voltagem da tomada e ponto de rede.\n2.  Abrir CPU: inspecionar hardware (placa-mãe, disco, pasta térmica, capacitores).\n\n## Tratativas de Erros de Sistema\n\n* **PDV travado na tela `(initramfs)`**: Inserir o comando `fsck /dev/sda1`, digitar `y` e dar enter para correção de boot.\n* **PDV em configuração**: Formatação incorreta. Verificar `Código da Loja` e `Número do PDV` (devem estar sem zeros a mais).\n* **Erro de Suprimento**: Relacionado à impressora. Se testes de impressora falharem, trocar impressora.\n* **Erros SEFAZ/TEF/DANFE**: Se rede e PinPad estiverem OK, pode ser sistema. Orientar gerente a abrir chamado com a equipe **Hydra**.",
  },
  {
    id: "formatacao-hydra",
    title: "Formatação de PDV com Software Hydra (ISO 2.54)",
    tags: ["formatação", "hydra", "ubuntu", "pendrive", "boot", "sat", "rede"],
    content: "## Procedimento de Formatação\n\n1.  **Autorização**: Formatação requer **autorização prévia** da equipe Hydra.\n2.  **Pendrive**: Usar pendrive de **8GB (recomendado) ou no máximo 16GB**. Gravar ISO 2.54 usando o aplicativo `IMAGEUSB`. **Importante**: Desmarcar a caixa `Post Image Verification` antes de escrever a ISO.\n3.  **Boot**: Bootar pelo pendrive e selecionar a opção **Install PRD** no menu GRUB.\n\n## Configuração do PDV (Pós-formatação)\n\n* **Identificação**: Preencher `Número da Loja` e `Número do PDV` (PDV >= 300). O `Código SAT` deve ser o número da loja repetido, totalizando **8 dígitos** (Ex: Loja 1250 = `12501250`).\n* **Rede**: Inserir IP, Máscara, Gateway e DNS (conferir com o Gerador de IP). Se o teste de rede falhar, verificar ponto e reiniciar.\n* **Scanner**: Pode selecionar **qualquer modelo**; o scanner deve funcionar independente do modelo escolhido.",
  },
  {
    id: "thinclient-init-config",
    title: "Thin Client INIT (Novo/Antigo) - Reset e Configuração Citrix",
    tags: ["thin client", "init", "reset", "citrix", "rede", "hostname", "senha"],
    content: "## Reset de Fábrica (INIT i0x/i60x)\n\n1.  Ligue o equipamento segurando a tecla **CTRL**.\n2.  No Boot Menu, selecione a opção **Restore Configuration (opção 3)**.\n3.  Confirme em **OK**.\n\n## Configuração Padrão\n\n1.  **Keyboard**: Altere para **Brazil (Português do Brasil) / ABNT2**.\n2.  **Cloud Service**: `Connection mode` para **Web Interface/StoreFront**. `Server address` para `citrix7.lasa.lojasamericanas.com.br`.\n3.  **Network**: Desligue `Obtain IP automatically`. Insira **IP, Máscara, Gateway e DNS** (10.114.241.29 / 10.114.241.30).\n4.  **Hostname**: No Control Center, altere `Device name` para `LyyyTCxxxxxx` (yyy=loja, xxxxxx=últimos 6 dígitos do patrimônio).\n5.  **Citrix Receiver**: Adicione `citrixcloud.lasa.lojasamericanas.com.br`.\n6.  **Security**: Defina a senha de **Administrador** para **`suporte#2010`**.\n\n**OBS**: Se travar em `Establishing connection. Please wait.`, **troque o DNS** da máquina.",
  },
  {
    id: "thinclient-hp-config",
    title: "Thin Client HP T510 - Configuração Citrix (Windows XP)",
    tags: ["thin client", "hp", "citrix", "rede", "windows", "explorer"],
    content: "## Acesso ao Painel de Controle\n\n1.  Com equipamento desligado, ligue segurando a tecla **SHIFT** até o Windows iniciar.\n2.  **Login Padrão**: `admlasa` / `suporte#2010` (consultar `ADM_LOCAL.txt` se falhar).\n3.  Abra o **Gerenciador de Tarefas** (`CTRL+ALT+DEL`).\n4.  Em Arquivo, `Nova Tarefa` > digite `explorer.exe`.\n\n## Configuração de Rede\n\n1.  No Painel de Controle, vá em **Rede** > `Protocolo TCP/IP` > `Propriedades`.\n2.  Defina **IP, Máscara, Gateway e DNS** (10.114.241.29 / 10.114.241.30).\n\n## Configuração Citrix\n\n1.  Acesse `http://util/arquivos/` no navegador e baixe `CitrixOnline PluginWeb.exe` e `CitrixReceiverXP.exe`.\n2.  No ícone do Citrix, vá em `Online plugin Settings` > `Change server`.\n3.  Insira o **Server Address**: `http://citrixcloud.lasa.lojasamericanas.com.br` e clique em `Update`.",
  },
  {
    id: "limpeza-otimizacao",
    title: "Limpeza e Otimização do Sistema (Windows/Chrome)",
    tags: ["sistema", "desempenho", "limpeza", "cache", "windows", "chrome", "msconfig"],
    content: "## Limpeza de Cache (Temporários)\n\n1.  Pressione **WINDOWS + R**.\n2.  Digite `%temp%` e apague tudo. Repita com `temp`, `prefetch` e `recent`.\n\n## Otimização de Desempenho\n\n1.  **Opções de Energia**: Painel de Controle > Opções de energia > **Alto desempenho**.\n2.  **Ajuste Visual**: Vá em Propriedades do Sistema > Desempenho > **Ajustar para obter um melhor desempenho**.\n3.  **MSCONFIG**: Desmarque serviços não essenciais como **Kaspersky**, **Ivms** e **Cybereason**.\n4.  **Chrome**: Limpe **Imagens e arquivos em cache** em `Mais ferramentas` > `Limpar dados de navegação`.",
  },
  {
    id: "teclado-configuracao",
    title: "Teclado Gertec Tec65 - Configuração (GravaPLUS)",
    tags: ["teclado", "usb", "ps2", "gertec", "grava plus", "firmware"],
    content: "## Procedimento de Gravação (Layout)\n\n1.  Instale o software **GravaPLUS.cab**.\n2.  Execute `Grava Plus.exe` > `Arquivo` > `Abrir`. Selecione o arquivo de layout **`tec65dis at 4 codigos lasa.gtc`**.\n\n## Seleção de Modelo\n\n* **USB (TEC E-65)**: Selecionar `TEC65 Dis AT/USB (4 códigos)`.\n* **PS2 (Antigo)**: Selecionar `TECD65 AT (antigo 1 código)`.\n\n## Finalização\n\n1.  Clique em **Gravar teclado** e aguarde `GRAVAÇÃO EFETUADA COM SUCESSO`.\n2.  **Teste**: Abra o Bloco de Notas e pressione as teclas numéricas de 1 a 9 para verificar a correspondência.",
  },
  {
    id: "colocando-dominio",
    title: "Colocando Máquina (Gerência/Thin Client) no Domínio",
    tags: ["rede", "domínio", "thin client", "gerencia", "dns"],
    content: "## Máquina de Gerência (Entrar no Domínio)\n\n1.  Vá em `Sobre o computador` > `Configurações avançadas do sistema` > `Nome do computador`.\n2.  Clique em **Alterar** e insira o nome do domínio: `delfia.tech`.\n\n## Thin Client (Adicionar Sufixo DNS)\n\n* Thin Client **NÃO PODE** ser colocado no domínio padrão.\n1.  Siga o mesmo caminho acima.\n2.  Selecione a opção **Grupo de trabalho**.\n3.  Clique em **Mais** > insira o **Sufixo DNS primário**: `lasa.lojasamericanas.com.br`.",
  },
  {
    id: "thinclient-connect",
    title: "Thin Client Connect (Mais Antigos) - Quebra de Senha",
    tags: ["thin client", "connect", "senha", "reset", "hirens boot"],
    content: "## Problema de Senha\n\n* Para Thin Clients Connect com problemas de senha, a ação é **Quebrar a senha usando Hiren's Boot**.\n* Após o reset, deixe a senha funcional (em branco/removida) e avise **David Neto** para que a Americanas possa trocá-la internamente.",
  },
  {
    id: "instalacao-sap",
    title: "Instalação e Configuração do SAP (GUI 7.70)",
    tags: ["aplicativo", "sap", "instalação", "configuração", "rede", "ecp", "prd"],
    content: "## Instalação e Tema\n\n1.  Baixe o `SAPGUI 7.70` do link de utilitários (`https://utilarquivos.../index.html`) e execute `SapGuiSetup.exe`.\n2.  Marque a opção: **SAP GUI for Windows 7.70**.\n3.  Após instalar, vá em SAP > **Opções** > `Configurações de tema` > selecione **SAP Signature Theme**.\n\n## Configuração das Instâncias\n\n* **Ambiente SAP PRD 6.0**:\n    * Servidor: `10.23.50.233`\n    * Nº da Instância: `00`\n    * ID Sist.: `PRD`\n* **Ambiente ECP - CYQ - PRD**:\n    * Servidor: `vaciCYQ`\n    * Nº da Instância: `00`\n    * ID Sist.: `CYQ`\n    * **SAProuter**: `/H/10.110.189.182/S/3299/H/payroll64-osk.sapsf.com/S/3299`",
  },
  {
    id: "instalacao-bi",
    title: "Instalação Hyperion / EIS / BI (Add-in Excel)",
    tags: ["aplicativo", "excel", "bi", "hyperion", "eis", "gerencia"],
    content: "## Instalação do Suplemento\n\n1.  Baixe o `EISBI-micro` e `Hyperion` do link de utilitários.\n2.  Execute o `setup.exe` do **EISBI-micro** (`Essbase Client Setup`) e clique `Next`.\n3.  Execute o arquivo **`essexcln.xll`** (que aparecerá no sistema) para abrir o Excel.\n4.  No Excel, vá em `Arquivo` > `Opções` > `Suplementos` > **Gerenciar: Suplementos do Excel** > `IR...`.\n5.  Certifique-se de que os suplementos relacionados a **Essbase** ou **Hyperion** estão marcados.\n\n## Conexão ao Servidor\n\n1.  Na aba **Suplementos** do Excel, clique em **Essbase** > **Connect...**.\n2.  **Server**: `52.31.153.95`.\n3.  **Username**: `Gglxxx` (xxx = número da loja).\n4.  **Password**: `123456`.\n\n**OBS**: Em caso de problemas de acesso remoto, é possível adicionar o usuário do gerente à lista de usuários habilitados para Área de Trabalho Remota e acessar a máquina remotamente, removendo-o depois.",
  },
  {
    id: "teclado-gertec-antigo",
    title: "Teclado Gertec Tec65 (Antigo) - Testes Físicos",
    tags: ["teclado", "gertec", "ps2", "hardware", "limpeza"],
    content: "## Testes de Diagnóstico\n\n1.  Teste o teclado com problema em outro PDV.\n2.  Teste outro teclado no PDV com problema.\n3.  Inspecione os **pinos** (se estiverem tortos/quebrados).\n4.  Realize a **limpeza** do teclado.\n5.  Verifique se há teclas soltas/quebradas.\n\n**REGISTRO**: O técnico deve informar **Marca** e **Modelo** na RAT e o motivo da troca de forma legível.",
  },
  {
    id: "touch-firmware-schalter",
    title: "Monitor Touch Schalter PCAP - Atualização de Firmware (ILItek)",
    tags: ["monitor", "touch", "schalter", "firmware", "ilitek", "pcap"],
    content: "## Procedimento de Atualização\n\n1.  Requisito: Notebook com Windows e o aplicativo **ILItek USB Upgrade Tool** (`v2.3.5.3` ou `v2.3.5.7`).\n2.  Com o painel touch conectado, clique em **Search** no aplicativo para localizar a controladora.\n3.  Clique em **Load Hex** e selecione o arquivo de firmware (.hex).\n4.  Selecione a controladora detectada (barra azul).\n5.  Clique em **Upgrade** e confirme. Aguarde a mensagem `Upgrade successfully`.",
  },
  {
    id: "ssa-manutencao",
    title: "SSA UNA (Self-Checkout) - Manual de Manutenção V3",
    tags: ["ssa", "self-checkout", "schalter", "manutenção", "hardware", "cpu", "impressora"],
    content: "## Abertura dos Gabinetes\n\n* O equipamento possui **fechaduras simples** e cada conjunto de chaves tem o mesmo segredo.\n* **Gabinete Superior**: Insira a chave e gire **180° no sentido horário**.\n* **Gabinete Principal**: Insira a chave e gire **180° no sentido horário**.\n\n## Substituição de Componentes Chave\n\n1.  **Impressora**: Remover porcas do suporte com **chave canhão n°7**. Fixar a nova com parafusos Philips pequena.\n2.  **Monitor/Tela**: Parafuso traseiro com **chave allen M4**. A substituição da **película touch** e da **placa controladora** requerem remoção de molduras e manípulos.\n3.  **CPU**: Remover os quatro espaçadores com **alicate de corte** antes de remover a CPU.",
  },
];


