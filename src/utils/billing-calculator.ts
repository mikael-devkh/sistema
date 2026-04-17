import type { ActiveCall, StoreTimerRecord } from "../hooks/use-service-manager";
import type { CatalogoServico } from "../types/catalogo";

// ─── Valores padrão (fallback sem catálogo) ───────────────────────────────────
export const BASE_FEE_INITIAL_CALL = 120.0;
export const FEE_PER_EXTRA_ACTIVE = 20.0;
export const TIME_LIMIT_INITIAL_MINUTES = 120;
export const FEE_PER_EXTRA_HOUR = 20.0;

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface StoreDetail {
  count: number;
  /** Receita total (empresa) */
  fee: number;
  /** Custo total (técnico) */
  custoTecnico: number;
  extraHours: number;
  /** Adicional de receita por hora extra */
  timeFee: number;
  /** Adicional de custo por hora extra */
  timeCustoTecnico: number;
}

export interface BillingResult {
  totalActiveCount: number;
  /** Receita total estimada */
  totalFee: number;
  /** Custo total estimado para o técnico */
  totalCustoTecnico: number;
  totalExtraHours: number;
  totalTimeFee: number;
  detailsByStore: Record<string, StoreDetail>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const normalizeStoreCode = (codigoLoja: string | undefined) =>
  codigoLoja?.trim().length ? codigoLoja.trim() : "Loja não informada";

function resolveMinutes(record?: StoreTimerRecord): number {
  if (!record) return 0;
  let total = record.totalMinutes;
  if (record.timeStarted) {
    total += Math.max(0, Math.round((Date.now() - record.timeStarted) / 60000));
  }
  return total;
}

// ─── Cálculo sem catálogo (fallback) ─────────────────────────────────────────

export function calculateBilling(
  activeCalls: ActiveCall[],
  storeTimers: Record<string, StoreTimerRecord>,
): BillingResult {
  const countByStore = activeCalls.reduce<Record<string, number>>((acc, call) => {
    const code = normalizeStoreCode(call.codigoLoja);
    acc[code] = (acc[code] ?? 0) + 1;
    return acc;
  }, {});

  const allStoreCodes = new Set([
    ...Object.keys(storeTimers),
    ...Object.keys(countByStore),
  ]);

  const detailsByStore: BillingResult["detailsByStore"] = {};
  let totalActiveCount = 0;
  let totalFee = 0;
  let totalCustoTecnico = 0;
  let totalExtraHours = 0;
  let totalTimeFee = 0;

  allStoreCodes.forEach((storeCode) => {
    const count = countByStore[storeCode] ?? 0;
    const baseFee =
      count === 0
        ? 0
        : BASE_FEE_INITIAL_CALL + Math.max(0, count - 1) * FEE_PER_EXTRA_ACTIVE;
    const baseCusto = baseFee; // sem catálogo, custo = receita (estimativa)

    const totalMinutes = resolveMinutes(storeTimers[storeCode]);
    const extraMinutes = Math.max(0, totalMinutes - TIME_LIMIT_INITIAL_MINUTES);
    const extraHours = extraMinutes > 0 ? Math.ceil(extraMinutes / 60) : 0;
    const timeFee = extraHours * FEE_PER_EXTRA_HOUR;

    if (count === 0 && timeFee === 0) return;

    detailsByStore[storeCode] = {
      count,
      fee: baseFee + timeFee,
      custoTecnico: baseCusto + timeFee,
      extraHours,
      timeFee,
      timeCustoTecnico: timeFee,
    };

    totalActiveCount += count;
    totalFee += baseFee + timeFee;
    totalCustoTecnico += baseCusto + timeFee;
    totalExtraHours += extraHours;
    totalTimeFee += timeFee;
  });

  return { totalActiveCount, totalFee, totalCustoTecnico, totalExtraHours, totalTimeFee, detailsByStore };
}

// ─── Cálculo com catálogo ─────────────────────────────────────────────────────

/**
 * Calcula o faturamento usando as regras do catálogo de serviços.
 *
 * Lógica de lote (batch) por loja:
 *  - 1º chamado: valorCustoTecnico / valorReceita
 *  - demais chamados: valorAdicionalCusto / valorAdicionalReceita
 *  - exceção `pagamentoIntegral = true`: sempre valor cheio independente de lote
 *  - exceção `pagaTecnico = false`: custo = 0 (chamado de falha)
 *
 * Horas extras:
 *  - se tempo total > horasFranquia * 60: adiciona valorHoraAdicionalCusto/Receita por hora excedente
 */
export function calculateBillingWithCatalog(
  activeCalls: ActiveCall[],
  storeTimers: Record<string, StoreTimerRecord>,
  catalogoServicos: CatalogoServico[],
): BillingResult {
  // Se não há chamados com catálogo, usa cálculo padrão
  const hasCatalog = activeCalls.some(c => c.catalogoServicoId);
  if (!hasCatalog) return calculateBilling(activeCalls, storeTimers);

  const catalogoMap = new Map(catalogoServicos.map(s => [s.id, s]));

  // Agrupa por loja
  const storeCallsMap = new Map<string, ActiveCall[]>();
  for (const call of activeCalls) {
    const code = normalizeStoreCode(call.codigoLoja);
    if (!storeCallsMap.has(code)) storeCallsMap.set(code, []);
    storeCallsMap.get(code)!.push(call);
  }

  const allStoreCodes = new Set([
    ...storeCallsMap.keys(),
    ...Object.keys(storeTimers),
  ]);

  const detailsByStore: BillingResult["detailsByStore"] = {};
  let totalActiveCount = 0;
  let totalFee = 0;
  let totalCustoTecnico = 0;
  let totalExtraHours = 0;
  let totalTimeFee = 0;

  allStoreCodes.forEach((storeCode) => {
    const calls = storeCallsMap.get(storeCode) ?? [];
    let receitaBase = 0;
    let custoBase = 0;

    // Índice de chamado "elegível para desconto de lote" por loja
    let batchIndex = 0;

    for (const call of calls) {
      const servico = call.catalogoServicoId ? catalogoMap.get(call.catalogoServicoId) : undefined;

      if (!servico) {
        // Sem catálogo → fallback
        const isFirst = batchIndex === 0;
        receitaBase += isFirst ? BASE_FEE_INITIAL_CALL : FEE_PER_EXTRA_ACTIVE;
        custoBase   += isFirst ? BASE_FEE_INITIAL_CALL : FEE_PER_EXTRA_ACTIVE;
        batchIndex++;
        continue;
      }

      // pagaTecnico = false → custo = 0 (chamado de falha)
      const pagarTec = servico.pagaTecnico !== false;

      if (servico.pagamentoIntegral) {
        // Sempre valor cheio, não entra na contagem de lote
        receitaBase += servico.valorReceita;
        custoBase   += pagarTec ? servico.valorCustoTecnico : 0;
      } else {
        const isFirst = batchIndex === 0;
        receitaBase += isFirst ? servico.valorReceita : servico.valorAdicionalReceita;
        custoBase   += pagarTec
          ? (isFirst ? servico.valorCustoTecnico : servico.valorAdicionalCusto)
          : 0;
        batchIndex++;
      }

      // Peça fornecida pelo técnico → reembolso no custo
      if (call.fornecedorPeca === "Tecnico" && call.custoPeca && call.custoPeca > 0) {
        custoBase += call.custoPeca;
      }
    }

    // Horas extras — usa a franquia do primeiro serviço da loja (ou padrão 2h)
    const firstServico = calls.find(c => c.catalogoServicoId)
      ? catalogoMap.get(calls.find(c => c.catalogoServicoId)!.catalogoServicoId!)
      : undefined;
    const horasFranquia = firstServico?.horasFranquia ?? 2;
    const franquiaMinutos = horasFranquia * 60;

    const totalMinutes = resolveMinutes(storeTimers[storeCode]);
    const extraMinutes = Math.max(0, totalMinutes - franquiaMinutos);
    const extraHours = extraMinutes > 0 ? Math.ceil(extraMinutes / 60) : 0;

    const timeFeeReceita = extraHours * (firstServico?.valorHoraAdicionalReceita ?? FEE_PER_EXTRA_HOUR);
    const timeFeeCusto   = extraHours * (firstServico?.valorHoraAdicionalCusto   ?? FEE_PER_EXTRA_HOUR);

    const count = calls.length;
    if (count === 0 && timeFeeReceita === 0) return;

    detailsByStore[storeCode] = {
      count,
      fee: receitaBase + timeFeeReceita,
      custoTecnico: custoBase + timeFeeCusto,
      extraHours,
      timeFee: timeFeeReceita,
      timeCustoTecnico: timeFeeCusto,
    };

    totalActiveCount += count;
    totalFee += receitaBase + timeFeeReceita;
    totalCustoTecnico += custoBase + timeFeeCusto;
    totalExtraHours += extraHours;
    totalTimeFee += timeFeeReceita;
  });

  return { totalActiveCount, totalFee, totalCustoTecnico, totalExtraHours, totalTimeFee, detailsByStore };
}
