// --- 1. ENUMS E INTERFACES DE RESULTADO ---

// Tipos de Ativos (Assets)
export type AssetType =
  | "CPU"
  | "MONITOR"
  | "IMPRESSORA_PDV"
  | "IMPRESSORA_ETIQUETA"
  | "TECLADO"
  | "GAVETA"
  | "THIN_CLIENT"
  | "SISTEMA";

// Códigos de Status Detalhado (Para filtragem e lógica)
export type TemplateStatus =
  | "OPERACIONAL"
  | "TROCA_PECA"
  | "TROCA_COMPLETA"
  | "REPARO_LIMPEZA"
  | "CONFIG_REDE"
  | "REPARO_SOFTWARE"
  | "FALHA_PERSISTENTE";

export interface RatTemplate {
  id: string;
  title: string;
  asset: AssetType;
  status: TemplateStatus;
  defeito: string;
  diagnostico: string;
  solucao: string;
}

// --- 2. MAPA DE TEMPLATES PADRÃO (15 Templates Corrigidos) ---
export const ratTemplates: RatTemplate[] = [
  // --- CPU (DESKTOP / PDV) ---
  {
    id: "cpu_troca_fonte",
    title: "CPU: Troca de Fonte Externa",
    asset: "CPU",
    status: "TROCA_PECA",
    defeito: "PDV/CPU não liga. LED da fonte externa apagado ou piscando.",
    diagnostico:
      "Realizado Troubleshooting de CPU. Teste de multímetro confirmou falha de condução e tensão na fonte externa. Necessário realizar troca de Fonte Externa.",
    solucao:
      "Substituição do componente Fonte Externa. CPU inicializa e carrega o S.O. normalmente. Testes de funcionalidade OK. Necessário realizar troca de Fonte Externa.",
  },
  {
    id: "cpu_limpeza_ram_cmos",
    title: "CPU: Falha de Imagem/Boot - Reparo/Limpeza",
    asset: "CPU",
    status: "REPARO_LIMPEZA",
    defeito: "CPU liga, mas não gera imagem (POST falha) ou travada no POST/BIOS.",
    diagnostico:
      "Realizado Troubleshooting: Desenergização da Placa-Mãe, limpeza de contatos de memória RAM e reset da BIOS/CMOS.",
    solucao:
      "Conflito de hardware (POST) solucionado. CPU iniciou e carregou o sistema operacional com sucesso. Reparo por limpeza/reset concluído.",
  },
  {
    id: "cpu_troca_hd_formata",
    title: "CPU: Troca de HD/SSD e Formatação",
    asset: "CPU",
    status: "TROCA_PECA",
    defeito: "PDV travado na tela de (initramfs) ou falha crítica de inicialização do S.O.",
    diagnostico:
      "Verificação com Hirens Boot/BIOS confirmou falha de integridade do Disco Rígido. Autorizada formatação pela equipe Hydra. Necessário realizar troca de SSD.",
    solucao:
      "Substituição do SSD e formatação do PDV com ISO Hydra. Configuração de SAT, IP estático e periféricos concluída. PDV operacional. Necessário realizar troca de SSD.",
  },
  {
    id: "cpu_troca_mb_completa",
    title: "CPU: Falha Persistente - Troca Completa",
    asset: "CPU",
    status: "TROCA_COMPLETA",
    defeito: "CPU não gera imagem e não inicializa S.O. Falha de energia.",
    diagnostico:
      "Realizados os 4 passos do Troubleshooting. Falha persistente após troca de fonte, limpeza de RAM/CMOS e teste de cabos. Necessário realizar troca de CPU completa.",
    solucao:
      "Necessário realizar troca de CPU completa. Equipamento encaminhado para Nível 2. Atendimento finalizado.",
  },

  // --- MONITOR ---
  {
    id: "monitor_troca_cabo",
    title: "Monitor: Sem Imagem - Troca de Cabo de Vídeo",
    asset: "MONITOR",
    status: "TROCA_PECA",
    defeito: "Monitor sem sinal de vídeo (tela preta) com CPU ligada e funcional.",
    diagnostico:
      "Realizado Troubleshooting Monitor. Problema isolado no Cabo VGA/HDMI. Necessário realizar troca de Cabo de Vídeo.",
    solucao:
      "Substituição do Cabo de Dados (VGA/HDMI). Sinal de vídeo restabelecido. Monitor operacional. Necessário realizar troca de Cabo de Vídeo.",
  },
  {
    id: "monitor_troca_completa",
    title: "Monitor: Falha Persistente - Troca Completa",
    asset: "MONITOR",
    status: "TROCA_COMPLETA",
    defeito: "Monitor não liga. LED de força apagado/amarelo. Sem comunicação de vídeo.",
    diagnostico:
      "Testado Monitor com cabos OK em outro PDV. Falha persiste. Falha de hardware interna confirmada. Necessário realizar troca de Monitor.",
    solucao:
      "Necessário realizar troca de Monitor. Ativo inoperante. Solicitação de troca encaminhada para Nível 2.",
  },
  {
    id: "monitor_touch_firmware",
    title: "Monitor Touch: Eixos Incorretos - Flash de Firmware",
    asset: "MONITOR",
    status: "REPARO_SOFTWARE",
    defeito: "Monitor Touch (Schalter) com eixos invertidos ou inoperante. Falha de calibração.",
    diagnostico:
      "Diagnóstico de falha de firmware na controladora (ILItek). Realizado procedimento de atualização via ILItek USB Upgrade Tool.",
    solucao:
      "Firmware do Touch atualizado com sucesso. Calibração realizada. Eixos operacionais e precisos. Reparo de software concluído.",
  },

  // --- THIN CLIENT ---
  {
    id: "thinclient_config_rede",
    title: "Thin Client: Erro Citrix/Rede - Configuração de DNS",
    asset: "THIN_CLIENT",
    status: "CONFIG_REDE",
    defeito: "Thin Client travado em \"Establishing connection. Please wait.\" ou sem acesso ao Citrix.",
    diagnostico:
      "Teste de rede (Ping/DNS) falhando. Realizado acesso ao Control Center e reconfiguração manual do IP estático e DNS (LASA) conforme padrão.",
    solucao:
      "Configuração de rede e DNS concluída. Acesso ao Citrix restabelecido. Ativo operacional.",
  },
  {
    id: "thinclient_reset_senha",
    title: "Thin Client: Senha de Usuário - Reset Padrão",
    asset: "THIN_CLIENT",
    status: "REPARO_LIMPEZA",
    defeito: "Thin Client solicitando senha de usuário na inicialização (senha perdida/trocada).",
    diagnostico:
      "Realizado Reset de Fábrica (CTRL no boot). Reconfiguração inicial do Thin Client (Hostname, Idioma, Citrix).",
    solucao:
      "Conflito de senha resolvido com o Reset. Senha de Administrador (suporte#2010) definida. Ativo operacional.",
  },

  // --- IMPRESSORAS ---
  {
    id: "zebra_ajuste_calibracao",
    title: "Impressora Etiqueta: Falha de Calibração/Suprimento",
    asset: "IMPRESSORA_ETIQUETA",
    status: "OPERACIONAL",
    defeito: "Impressora Zebra com erro de suprimento/calibração. Impressão desalinhada/cortada.",
    diagnostico:
      "Realizada limpeza de cabeça/sensores e ajuste de suprimentos. Necessário reset de calibração.",
    solucao:
      "Calibração forçada (manual/browser) e ajuste de sensor de mídia. Impressora funcional. Ativo operacional.",
  },
  {
    id: "zebra_troca_cabeca",
    title: "Impressora Etiqueta: Impressão Borrada - Troca de Cabeça",
    asset: "IMPRESSORA_ETIQUETA",
    status: "TROCA_PECA",
    defeito: "Impressão borrada/falhada, com riscos persistentes na etiqueta.",
    diagnostico:
      "Diagnóstico visual confirmou riscos na Cabeça de Impressão. Falha de hardware. Necessário realizar troca de Cabeça de Impressão.",
    solucao:
      "Substituição da Cabeça de Impressão. Impressão de teste OK. Necessário realizar troca de Cabeça de Impressão.",
  },
  {
    id: "impressora_pdv_config",
    title: "Impressora PDV: Falha de Configuração - ESC/POS",
    asset: "IMPRESSORA_PDV",
    status: "CONFIG_REDE",
    defeito: "Impressora MP-4200 imprime, mas não fiscaliza/não finaliza a venda.",
    diagnostico:
      "Diagnóstico de Conjunto de Comandos incorreto (não estava em ESC/POS).",
    solucao:
      "Realizada configuração de fábrica e alterado Conjunto de Comandos para ESC/POS. Fiscalização OK. Ativo operacional.",
  },

  // --- PERIFÉRICOS ---
  {
    id: "gaveta_troca_cabo",
    title: "Gaveta: Falha ao Abrir - Troca de Cabo",
    asset: "GAVETA",
    status: "TROCA_PECA",
    defeito: "Gaveta não abre via sistema (solenoide não é acionado).",
    diagnostico:
      "Teste de troca cruzada (Gaveta/PDV) OK. Falha isolada no cabo de conexão RJ-11. Necessário realizar troca de Cabo RJ-11.",
    solucao:
      "Substituição do Cabo de Dados RJ-11. Gaveta abre via aplicação. Necessário realizar troca de Cabo RJ-11.",
  },
  {
    id: "gaveta_aciona_chaveiro",
    title: "Gaveta: Falha Física - Acionamento de Chaveiro",
    asset: "GAVETA",
    status: "FALHA_PERSISTENTE",
    defeito: "Gaveta com miolo danificado ou chave quebrada/perdida. Problema físico.",
    diagnostico:
      "Análise do componente de fechadura (miolo/chave) confirmou falha mecânica. Problema não coberto pelo serviço técnico.",
    solucao:
      "Serviço finalizado. Necessário Acionamento de chaveiro local para reparo/troca do miolo/chave, conforme procedimento.",
  },
  {
    id: "teclado_layout_grava",
    title: "Teclado: Falha de Mapeamento - GravaPLUS",
    asset: "TECLADO",
    status: "REPARO_SOFTWARE",
    defeito: "Teclado Gertec Tec65 com layout numérico desconfigurado. Mapeamento incorreto.",
    diagnostico:
      "Problema isolado no mapeamento de layout. Utilizado software GravaPLUS com o arquivo de layout padrão LASA.",
    solucao:
      "Atualização de layout via GravaPLUS concluída. Teclas numéricas mapeadas corretamente. Teclado operacional.",
  },
];
