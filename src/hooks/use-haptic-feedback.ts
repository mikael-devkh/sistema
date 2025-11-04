import { useCallback } from "react";

const DEFAULT_DURATION = 50;

export const useHapticFeedback = () => {
  const trigger = useCallback((duration: number | number[] = DEFAULT_DURATION) => {
    if (typeof window === "undefined") {
      return;
    }

    const navigatorInstance = window.navigator as Navigator & {
      vibrate?: (pattern: number | number[]) => boolean;
    };

    if (typeof navigatorInstance.vibrate === "function") {
      navigatorInstance.vibrate(duration);
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      console.debug("Haptic feedback mock:", duration);
    }
  }, []);

  return { trigger };
};
