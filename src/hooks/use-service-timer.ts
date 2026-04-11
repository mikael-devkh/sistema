import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const LOCAL_STORAGE_KEY = "service_manager_timer_start";
const TICK_INTERVAL = 1000;

const formatTimeDisplay = (elapsedMs: number) => {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const hours = Math.floor(totalSeconds / 3600)
    .toString()
    .padStart(2, "0");
  const minutes = Math.floor((totalSeconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");

  return `${hours}:${minutes}:${seconds}`;
};

export const useServiceTimer = () => {
  const [startTime, setStartTime] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!stored) return null;
    const parsed = Number(stored);
    return Number.isFinite(parsed) ? parsed : null;
  });
  const [elapsedMs, setElapsedMs] = useState(0);
  const intervalRef = useRef<number | null>(null);

  const clearTimerInterval = () => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    if (startTime === null) {
      clearTimerInterval();
      return;
    }

    setElapsedMs(Date.now() - startTime);
    intervalRef.current = window.setInterval(() => {
      setElapsedMs(Date.now() - startTime);
    }, TICK_INTERVAL);

    return () => {
      clearTimerInterval();
    };
  }, [startTime]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (startTime !== null) {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, String(startTime));
    } else {
      window.localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }, [startTime]);

  const startTimer = useCallback(() => {
    const now = Date.now();
    setStartTime(now);
    setElapsedMs(0);
    return now;
  }, []);

  const stopTimer = useCallback(() => {
    const now = Date.now();
    let minutes = 0;
    if (startTime !== null) {
      const elapsed = now - startTime;
      minutes = Math.max(0, Math.round(elapsed / 60000));
      setElapsedMs(elapsed);
    }
    setStartTime(null);
    clearTimerInterval();
    return minutes;
  }, [startTime]);

  const resetTimer = useCallback(() => {
    setStartTime(null);
    setElapsedMs(0);
    clearTimerInterval();
  }, []);

  const elapsedTimeMinutes = useMemo(() => {
    return Math.max(0, Math.round(elapsedMs / 60000));
  }, [elapsedMs]);

  const timeDisplay = useMemo(() => formatTimeDisplay(elapsedMs), [elapsedMs]);

  const isRunning = startTime !== null;

  return {
    isRunning,
    elapsedTimeMinutes,
    timeDisplay,
    startTimer,
    stopTimer,
    resetTimer,
  };
};
