import type { ActiveCall, StoreTimerRecord } from "../hooks/use-service-manager";

export const BASE_FEE_INITIAL_CALL = 120.0;
export const FEE_PER_EXTRA_ACTIVE = 20.0;
export const TIME_LIMIT_INITIAL_MINUTES = 120;
export const FEE_PER_EXTRA_HOUR = 20.0;

export interface BillingResult {
  totalActiveCount: number;
  totalFee: number;
  totalExtraHours: number;
  totalTimeFee: number;
  detailsByStore: Record<
    string,
    { count: number; fee: number; extraHours: number; timeFee: number }
  >;
}

const normalizeStoreCode = (codigoLoja: string | undefined) =>
  codigoLoja && codigoLoja.trim().length
    ? codigoLoja.trim()
    : "Loja não informada";

export function calculateBilling(
  activeCalls: ActiveCall[],
  storeTimers: Record<string, StoreTimerRecord>,
): BillingResult {
  const countByStore = activeCalls.reduce<Record<string, number>>((acc, call) => {
    const storeCode = normalizeStoreCode(call.codigoLoja);
    acc[storeCode] = (acc[storeCode] ?? 0) + 1;
    return acc;
  }, {});

  const allStoreCodes = new Set([
    ...Object.keys(storeTimers),
    ...Object.keys(countByStore),
  ]);

  const detailsByStore: BillingResult["detailsByStore"] = {};
  let totalActiveCount = 0;
  let totalFee = 0;
  let totalExtraHours = 0;
  let totalTimeFee = 0;

  const resolveMinutes = (record?: StoreTimerRecord) => {
    if (!record) return 0;
    let total = record.totalMinutes;
    if (record.timeStarted) {
      total += Math.max(0, Math.round((Date.now() - record.timeStarted) / 60000));
    }
    return total;
  };

  allStoreCodes.forEach((storeCode) => {
    const count = countByStore[storeCode] ?? 0;
    const baseFee =
      count === 0
        ? 0
        : BASE_FEE_INITIAL_CALL + Math.max(0, count - 1) * FEE_PER_EXTRA_ACTIVE;

    const totalMinutes = resolveMinutes(storeTimers[storeCode]);
    const extraMinutes = Math.max(0, totalMinutes - TIME_LIMIT_INITIAL_MINUTES);
    const extraHours = extraMinutes > 0 ? Math.ceil(extraMinutes / 60) : 0;
    const timeFee = extraHours * FEE_PER_EXTRA_HOUR;

    if (count === 0 && timeFee === 0) {
      return;
    }

    detailsByStore[storeCode] = {
      count,
      fee: baseFee + timeFee,
      extraHours,
      timeFee,
    };

    totalActiveCount += count;
    totalFee += baseFee + timeFee;
    totalExtraHours += extraHours;
    totalTimeFee += timeFee;
  });

  return {
    totalActiveCount,
    totalFee,
    totalExtraHours,
    totalTimeFee,
    detailsByStore,
  };
}
