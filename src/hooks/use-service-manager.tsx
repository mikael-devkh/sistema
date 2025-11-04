import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

export type RequiredMediaType =
  | "serial"
  | "defect_photo"
  | "defect_video"
  | "solution_video"
  | "workbench_photo"
  | "cupom_photo"
  | "replacement_serial";

export type MediaStatus = "missing" | "uploaded";

export interface MediaEvidence {
  status: MediaStatus;
  dataUrl?: string;
  fileName?: string;
  mimeType?: string;
}

export type MediaChecklist = Record<RequiredMediaType, MediaEvidence>;

export interface StoreTimerRecord {
  codigoLoja: string;
  timeStarted: number | null;
  totalMinutes: number;
}

export interface ActiveCall {
  id: string;
  fsa: string;
  codigoLoja: string;
  pdv?: string;
  status: "open" | "completed" | "archived";
  photos: MediaChecklist;
  openedAt: string;
  timeStarted: number | null;
  timeTotalServiceMinutes: number;
}

interface NewCallPayload {
  id?: string;
  fsa: string;
  codigoLoja: string;
  pdv?: string;
}

export interface GroupedCallBucket {
  date: string;
  stores: {
    codigoLoja: string;
    calls: ActiveCall[];
  }[];
}

interface ServiceManagerContextValue {
  calls: ActiveCall[];
  activeCalls: ActiveCall[];
  storeTimers: Record<string, StoreTimerRecord>;
  addCall: (payload: NewCallPayload) => void;
  removeCall: (id: string) => void;
  updatePhotoStatus: (
    id: string,
    media: RequiredMediaType,
    status: MediaStatus,
    evidence?: Partial<Omit<MediaEvidence, "status">>
  ) => void;
  completeCall: (id: string, totalMinutes?: number) => void;
  archiveAllCompleted: () => void;
  startStoreTimer: (codigoLoja: string, startedAt?: number) => void;
  stopStoreTimer: (codigoLoja: string, additionalMinutes: number) => void;
  resetStoreTimer: (codigoLoja: string) => void;
  getStoreTotalMinutes: (codigoLoja: string) => number;
  adjustStoreTime: (codigoLoja: string, newTotalMinutes: number) => void;
}

const LOCAL_STORAGE_KEY = "service_manager_calls";
const STORE_TIMERS_STORAGE_KEY = "service_manager_store_timers";

const ServiceManagerContext =
  createContext<ServiceManagerContextValue | undefined>(undefined);

const defaultMediaState: MediaChecklist = {
  serial: { status: "missing" },
  defect_photo: { status: "missing" },
  defect_video: { status: "missing" },
  solution_video: { status: "missing" },
  workbench_photo: { status: "missing" },
  cupom_photo: { status: "missing" },
  replacement_serial: { status: "missing" },
};

const ensureMediaState = (
  photos?: Partial<
    Record<
      RequiredMediaType,
      (MediaEvidence & { status?: MediaStatus }) | MediaStatus | undefined
    >
  >
): MediaChecklist => {
  const entries = Object.entries(defaultMediaState).map(([mediaKey, defaults]) => {
    const media = mediaKey as RequiredMediaType;
    const incoming = photos?.[media];

    if (!incoming) {
      return [media, { ...defaults }];
    }

    if (typeof incoming === "string") {
      return [media, { status: incoming }];
    }

    const status = incoming.status ?? "missing";
    const dataUrl = incoming.dataUrl;
    const fileName = incoming.fileName;
    const mimeType = incoming.mimeType;
    return [media, { status, dataUrl, fileName, mimeType }];
  });

  return Object.fromEntries(entries) as MediaChecklist;
};

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `call-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const normalizeCall = (raw: ActiveCall): ActiveCall => {
  const openedAt = raw.openedAt ?? new Date().toISOString();
  return {
    ...raw,
    openedAt,
    photos: ensureMediaState(raw.photos as Partial<
      Record<RequiredMediaType, MediaEvidence | MediaStatus>
    >),
    timeStarted: raw.timeStarted ?? null,
    timeTotalServiceMinutes: raw.timeTotalServiceMinutes ?? 0,
  };
};

const loadStoredCalls = (): ActiveCall[] => {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as ActiveCall[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeCall);
  } catch (error) {
    console.error("Erro ao carregar chamados do Local Storage", error);
    return [];
  }
};

const normalizeStoreTimerRecord = (
  codigoLoja: string,
  record?: Partial<StoreTimerRecord>
): StoreTimerRecord => {
  return {
    codigoLoja,
    timeStarted:
      record?.timeStarted && Number.isFinite(record.timeStarted)
        ? record.timeStarted
        : null,
    totalMinutes:
      record?.totalMinutes && Number.isFinite(record.totalMinutes)
        ? Math.max(0, Math.round(record.totalMinutes))
        : 0,
  };
};

const loadStoredStoreTimers = (): Record<string, StoreTimerRecord> => {
  if (typeof window === "undefined") return {};
  try {
    const stored = window.localStorage.getItem(STORE_TIMERS_STORAGE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored) as Record<string, StoreTimerRecord>;
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed).map(([codigoLoja, record]) => [
        codigoLoja,
        normalizeStoreTimerRecord(codigoLoja, record),
      ])
    );
  } catch (error) {
    console.error("Erro ao carregar timers de loja", error);
    return {};
  }
};

export const getGroupedCalls = (calls: ActiveCall[]): GroupedCallBucket[] => {
  const relevantCalls = calls.filter((call) => call.status !== "open");
  const accumulator = new Map<string, Map<string, ActiveCall[]>>();

  relevantCalls.forEach((call) => {
    const referenceTime = call.timeStarted ?? Date.parse(call.openedAt);
    const dateKey = Number.isFinite(referenceTime)
      ? new Date(referenceTime).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    if (!accumulator.has(dateKey)) {
      accumulator.set(dateKey, new Map());
    }
    const storeMap = accumulator.get(dateKey)!;
    if (!storeMap.has(call.codigoLoja)) {
      storeMap.set(call.codigoLoja, []);
    }
    storeMap.get(call.codigoLoja)!.push(call);
  });

  const sortedDates = Array.from(accumulator.entries()).sort((a, b) =>
    b[0].localeCompare(a[0])
  );

  return sortedDates.map(([date, storeMap]) => {
    const stores = Array.from(storeMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([codigoLoja, storeCalls]) => ({
        codigoLoja,
        calls: [...storeCalls].sort((a, b) => a.fsa.localeCompare(b.fsa)),
      }));

    return {
      date,
      stores,
    };
  });
};

export const ServiceManagerProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [calls, setCalls] = useState<ActiveCall[]>(() => loadStoredCalls());
  const [storeTimers, setStoreTimers] = useState<Record<string, StoreTimerRecord>>(
    () => loadStoredStoreTimers()
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        LOCAL_STORAGE_KEY,
        JSON.stringify(calls.map(normalizeCall))
      );
    } catch (error) {
      console.error("Erro ao salvar chamados no Local Storage", error);
    }
  }, [calls]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        STORE_TIMERS_STORAGE_KEY,
        JSON.stringify(storeTimers)
      );
    } catch (error) {
      console.error("Erro ao salvar timers de loja", error);
    }
  }, [storeTimers]);

  const addCall = useCallback((payload: NewCallPayload) => {
    setCalls((prev) => {
      const id = payload.id ?? createId();
      if (prev.some((call) => call.id === id)) {
        return prev;
      }

      const newCall: ActiveCall = {
        id,
        fsa: payload.fsa,
        codigoLoja: payload.codigoLoja,
        pdv: payload.pdv,
        status: "open",
        photos: ensureMediaState(),
        openedAt: new Date().toISOString(),
        timeStarted: null,
        timeTotalServiceMinutes: 0,
      };

      return [newCall, ...prev];
    });
    setStoreTimers((prev) => {
      if (prev[payload.codigoLoja]) {
        return prev;
      }
      return {
        ...prev,
        [payload.codigoLoja]: normalizeStoreTimerRecord(payload.codigoLoja, prev[payload.codigoLoja]),
      };
    });
  }, []);

  const removeCall = useCallback((id: string) => {
    setCalls((prev) => prev.filter((call) => call.id !== id));
  }, []);

  const updatePhotoStatus = useCallback(
    (
      id: string,
      media: RequiredMediaType,
      status: MediaStatus,
      evidence?: Partial<Omit<MediaEvidence, "status">>
    ) => {
      setCalls((prev) =>
        prev.map((call) =>
          call.id === id
            ? (() => {
                const current = call.photos[media] ?? { status: "missing" };
                return {
                  ...call,
                  photos: {
                    ...call.photos,
                    [media]: {
                      status,
                      dataUrl:
                        status === "uploaded"
                          ? evidence?.dataUrl ?? current.dataUrl
                          : undefined,
                      fileName:
                        status === "uploaded"
                          ? evidence?.fileName ?? current.fileName
                          : undefined,
                      mimeType:
                        status === "uploaded"
                          ? evidence?.mimeType ?? current.mimeType
                          : undefined,
                    },
                  },
                };
              })()
            : call
        )
      );
    },
    []
  );

  const completeCall = useCallback((id: string, totalMinutes?: number) => {
    setCalls((prev) =>
      prev.map((call) =>
        call.id === id
          ? {
              ...call,
              status: "completed",
              timeStarted: null,
              timeTotalServiceMinutes:
                totalMinutes ?? call.timeTotalServiceMinutes,
            }
          : call
      )
    );
  }, []);

  const archiveAllCompleted = useCallback(() => {
    setCalls((prev) =>
      prev.map((call) =>
        call.status === "completed"
          ? {
              ...call,
              status: "archived",
              timeStarted: null,
            }
          : call
      )
    );
  }, []);

  const startStoreTimer = useCallback(
    (codigoLoja: string, startedAt?: number) => {
      const startTimestamp = startedAt ?? Date.now();
      setStoreTimers((prev) => {
        const next = { ...prev };

        for (const [store, record] of Object.entries(next)) {
          if (record.timeStarted !== null && store !== codigoLoja) {
            const elapsed = Math.max(
              0,
              Math.round((startTimestamp - record.timeStarted) / 60000)
            );
            next[store] = {
              ...record,
              totalMinutes: record.totalMinutes + elapsed,
              timeStarted: null,
            };
          }
        }

        const current = next[codigoLoja] ?? normalizeStoreTimerRecord(codigoLoja);
        next[codigoLoja] = {
          ...current,
          timeStarted: startTimestamp,
        };

        return next;
      });
    },
    []
  );

  const stopStoreTimer = useCallback(
    (codigoLoja: string, additionalMinutes: number) => {
      setStoreTimers((prev) => {
        const current = prev[codigoLoja];
        if (!current) {
          return prev;
        }
        return {
          ...prev,
          [codigoLoja]: {
            ...current,
            timeStarted: null,
            totalMinutes:
              current.totalMinutes + Math.max(0, Math.round(additionalMinutes)),
          },
        };
      });
    },
    []
  );

  const resetStoreTimer = useCallback((codigoLoja: string) => {
    setStoreTimers((prev) => {
      const current = prev[codigoLoja];
      if (!current) return prev;
      return {
        ...prev,
        [codigoLoja]: {
          codigoLoja,
          timeStarted: null,
          totalMinutes: 0,
        },
      };
    });
  }, []);

  const getStoreTotalMinutes = useCallback(
    (codigoLoja: string) => {
      const record = storeTimers[codigoLoja];
      if (!record) return 0;
      let total = record.totalMinutes;
      if (record.timeStarted) {
        total += Math.max(0, Math.round((Date.now() - record.timeStarted) / 60000));
      }
      return total;
    },
    [storeTimers]
  );

  const adjustStoreTime = useCallback((codigoLoja: string, newTotalMinutes: number) => {
    setStoreTimers((prev) => {
      const current = prev[codigoLoja] ?? normalizeStoreTimerRecord(codigoLoja);
      return {
        ...prev,
        [codigoLoja]: {
          ...current,
          totalMinutes: Math.max(0, Math.round(newTotalMinutes)),
          timeStarted: null,
        },
      };
    });
  }, []);

  const value = useMemo<ServiceManagerContextValue>(() => {
    const activeCalls = calls.filter((call) => call.status !== "archived");
    return {
      calls,
      activeCalls,
      storeTimers,
      addCall,
      removeCall,
      updatePhotoStatus,
      completeCall,
      archiveAllCompleted,
      startStoreTimer,
      stopStoreTimer,
      resetStoreTimer,
      getStoreTotalMinutes,
      adjustStoreTime,
    };
  }, [
    calls,
    storeTimers,
    addCall,
    removeCall,
    updatePhotoStatus,
    completeCall,
    archiveAllCompleted,
    startStoreTimer,
    stopStoreTimer,
    resetStoreTimer,
    getStoreTotalMinutes,
    adjustStoreTime,
  ]);

  return (
    <ServiceManagerContext.Provider value={value}>
      {children}
    </ServiceManagerContext.Provider>
  );
};

export const useServiceManager = () => {
  const context = useContext(ServiceManagerContext);
  if (!context) {
    throw new Error(
      "useServiceManager deve ser usado dentro de um ServiceManagerProvider"
    );
  }
  return context;
};
