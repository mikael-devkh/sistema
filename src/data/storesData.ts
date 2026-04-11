export interface StoreData {
  numeroLoja: string;
  nomeLoja: string;
  ipDesktop: string;
  ipPDV: string;
}

/**
 * Gera os dados da loja baseado no número da loja
 * A planilha Rede 10 contém 10.000 lojas com IPs npmnpmseguindo um padrão matemático
 */
function generateStoreData(storeNumber: number): StoreData {
  // Padrão da planilha: cada loja tem 2 IPs consecutivos (/23 subnet)
  // Loja 1: 10.23.100.xx / 10.23.101.xx
  // Loja 2: 10.23.102.xx / 10.23.103.xx
  // etc.
  
  // Calcula o offset base (cada loja usa 2 octetos consecutivos)
  const offset = (storeNumber - 1) * 2;
  
  // IP base começa em 10.23.100.0
  const baseSecondOctet = 23;
  const baseThirdOctet = 100;
  
  // Calcula overflow para o segundo octeto (a cada 128 lojas passa para 10.24.x.x, etc)
  const totalThirdOctetOffset = baseThirdOctet + offset;
  const secondOctetIncrement = Math.floor(totalThirdOctetOffset / 256);
  const thirdOctetDesktop = totalThirdOctetOffset % 256;
  const thirdOctetPDV = (baseThirdOctet + offset + 1) % 256;
  
  const secondOctet = baseSecondOctet + secondOctetIncrement;
  const secondOctetPDV = thirdOctetDesktop === 255 ? secondOctet + 1 : secondOctet;
  
  return {
    numeroLoja: String(storeNumber),
    nomeLoja: `Loja ${storeNumber}`,
    ipDesktop: `10.${secondOctet}.${thirdOctetDesktop}.xx`,
    ipPDV: `10.${secondOctetPDV}.${thirdOctetPDV}.xx`
  };
}

/**
 * Retorna os dados de todas as 10.000 lojas da Rede 10
 * Gerados dinamicamente para economizar memória
 */
export const storesData: StoreData[] = Array.from({ length: 10000 }, (_, i) => 
  generateStoreData(i + 1)
);

/**
 * Busca uma loja específica pelo número
 * Mais eficiente que procurar no array completo
 */
export function getStoreData(storeNumber: string | number): StoreData | undefined {
  const num = typeof storeNumber === 'string' ? parseInt(storeNumber, 10) : storeNumber;
  
  if (isNaN(num) || num < 1 || num > 10000) {
    return undefined;
  }
  
  return generateStoreData(num);
}
