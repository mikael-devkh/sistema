import { describe, expect, it } from "vitest";
import { calculateBilling, BASE_FEE_INITIAL_CALL, FEE_PER_EXTRA_ACTIVE, FEE_PER_EXTRA_HOUR } from "../billing-calculator";
import type { ActiveCall, StoreTimerRecord } from "../../hooks/use-service-manager";

const buildCall = (overrides: Partial<ActiveCall>): ActiveCall => ({
  id: overrides.id ?? Math.random().toString(16).slice(2),
  fsa: overrides.fsa ?? "FSA-1",
  codigoLoja: overrides.codigoLoja ?? "0001",
  pdv: overrides.pdv,
  status: overrides.status ?? "open",
  photos: overrides.photos ?? ({} as ActiveCall["photos"]),
  openedAt: overrides.openedAt ?? new Date().toISOString(),
  timeStarted: overrides.timeStarted ?? null,
  timeTotalServiceMinutes: overrides.timeTotalServiceMinutes ?? 0,
});

describe("calculateBilling", () => {
  it("agrupa por loja e calcula adicionais de tempo", () => {
    const calls: ActiveCall[] = [
      buildCall({ codigoLoja: "123", status: "open" }),
      buildCall({ codigoLoja: "123", status: "completed" }),
      buildCall({ codigoLoja: "200", status: "open" }),
    ];

    const timers: Record<string, StoreTimerRecord> = {
      "123": { codigoLoja: "123", timeStarted: null, totalMinutes: 150 },
      "200": { codigoLoja: "200", timeStarted: null, totalMinutes: 60 },
    };

    const result = calculateBilling(calls, timers);

    expect(result.totalActiveCount).toBe(3);
    expect(result.totalExtraHours).toBe(1);
    expect(result.totalTimeFee).toBe(FEE_PER_EXTRA_HOUR);

    const store123 = result.detailsByStore["123"];
    expect(store123.count).toBe(2);
    expect(store123.extraHours).toBe(1);
    expect(store123.fee).toBe(
      BASE_FEE_INITIAL_CALL + FEE_PER_EXTRA_ACTIVE + FEE_PER_EXTRA_HOUR,
    );

    const store200 = result.detailsByStore["200"];
    expect(store200.count).toBe(1);
    expect(store200.extraHours).toBe(0);
  });
});
