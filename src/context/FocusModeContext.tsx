import { createContext, useCallback, useContext, useState } from 'react';

interface FocusModeContextValue {
  focusMode: boolean;
  enter: () => void;
  exit: () => void;
  toggle: () => void;
}

const FocusModeContext = createContext<FocusModeContextValue>({
  focusMode: false,
  enter: () => {},
  exit: () => {},
  toggle: () => {},
});

export function FocusModeProvider({ children }: { children: React.ReactNode }) {
  const [focusMode, setFocusMode] = useState(false);
  const enter  = useCallback(() => setFocusMode(true),  []);
  const exit   = useCallback(() => setFocusMode(false), []);
  const toggle = useCallback(() => setFocusMode(f => !f), []);
  return (
    <FocusModeContext.Provider value={{ focusMode, enter, exit, toggle }}>
      {children}
    </FocusModeContext.Provider>
  );
}

export const useFocusMode = () => useContext(FocusModeContext);
