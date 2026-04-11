import { createContext, ReactNode, useContext, useMemo, useState } from "react";

type AutofillPayload = {
  title?: string;
  defeito: string;
  diagnostico: string;
  solucao: string;
};

export interface RatAutofillData {
  isAvailable: boolean;
  title?: string;
  defeito: string;
  diagnostico: string;
  solucao: string;
}

interface RatAutofillContextValue {
  autofillData: RatAutofillData;
  setAutofillData: (payload: AutofillPayload) => void;
  clearAutofillData: () => void;
}

const defaultData: RatAutofillData = {
  isAvailable: false,
  title: undefined,
  defeito: "",
  diagnostico: "",
  solucao: "",
};

const RatAutofillContext = createContext<RatAutofillContextValue | undefined>(
  undefined,
);

export const RatAutofillProvider = ({ children }: { children: ReactNode }) => {
  const [autofillData, setAutofillDataState] = useState<RatAutofillData>(defaultData);

  const setAutofillData = (payload: AutofillPayload) => {
    setAutofillDataState({
      isAvailable: true,
      title: payload.title,
      defeito: payload.defeito,
      diagnostico: payload.diagnostico,
      solucao: payload.solucao,
    });
  };

  const clearAutofillData = () => setAutofillDataState(defaultData);

  const value = useMemo(
    () => ({
      autofillData,
      setAutofillData,
      clearAutofillData,
    }),
    [autofillData],
  );

  return (
    <RatAutofillContext.Provider value={value}>
      {children}
    </RatAutofillContext.Provider>
  );
};

export const useRatAutofill = () => {
  const context = useContext(RatAutofillContext);
  if (!context) {
    throw new Error("useRatAutofill deve ser usado dentro de RatAutofillProvider");
  }
  return context;
};
