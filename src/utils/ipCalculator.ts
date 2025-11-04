export interface IPConfig {
  ip: string;
  mascara: string;
  gateway: string;
  broadcast: string;
  dns1: string;
  dns2: string;
  nomeLoja: string;
}

export function calcularIP(
  ipBase: string,
  tipo: string,
  numeroPDV?: string
): Omit<IPConfig, 'nomeLoja'> {
  if (!ipBase) {
    throw new Error("IP base não encontrado para essa loja.");
  }

  const ipPartes = ipBase.split(".");
  let ipFinal: string;
  let gateway: string;
  let broadcast: string;
  let mascara: string;
  let dns1: string;
  let dns2: string;

  if (tipo === "PDV") {
    if (!numeroPDV || parseInt(numeroPDV) < 300) {
      throw new Error("Número do PDV inválido (deve ser ≥ 300).");
    }

    const ultimoOcteto = 100 + (parseInt(numeroPDV) - 300);
    ipPartes[3] = ultimoOcteto.toString();
    ipFinal = ipPartes.join(".");
    gateway = `${ipPartes[0]}.${ipPartes[1]}.${ipPartes[2]}.254`;
    broadcast = `${ipPartes[0]}.${ipPartes[1]}.${ipPartes[2]}.255`;
    mascara = "255.255.255.0";
    dns1 = "10.19.5.34";
    dns2 = "10.18.5.35";

  } else if (tipo === "Impressora Zebra 1" || tipo === "Impressora Zebra 2") {
    const finalOcteto = tipo === "Impressora Zebra 1" ? "19" : "20";
    ipFinal = `${ipPartes[0]}.${ipPartes[1]}.${ipPartes[2]}.${finalOcteto}`;
    gateway = `${ipPartes[0]}.${ipPartes[1]}.${ipPartes[2]}.126`;
    broadcast = "N/A";
    mascara = "255.255.255.128";
    dns1 = "10.114.241.29";
    dns2 = "10.114.241.30";

  } else if (tipo === "Impressora Laser") {
    ipFinal = `${ipPartes[0]}.${ipPartes[1]}.${ipPartes[2]}.24`;
    gateway = `${ipPartes[0]}.${ipPartes[1]}.${ipPartes[2]}.126`;
    broadcast = "N/A";
    mascara = "255.255.255.128";
    dns1 = "10.114.241.29";
    dns2 = "10.114.241.30";

  } else {
    // Desktop
    ipPartes[3] = "45";
    ipFinal = ipPartes.join(".");
    gateway = `${ipPartes[0]}.${ipPartes[1]}.${ipPartes[2]}.126`;
    broadcast = "N/A";
    mascara = "255.255.255.128";
    dns1 = "10.114.241.29";
    dns2 = "10.114.241.30";
  }

  return {
    ip: ipFinal,
    mascara,
    gateway,
    broadcast,
    dns1,
    dns2
  };
}
