import { useEffect, useState } from "react";

export function usePageLoading(delayMs: number = 500, deps: unknown[] = []) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const id = window.setTimeout(() => setLoading(false), delayMs);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return loading;
}


