"use client";

import { useEffect, useState } from "react";

/** Current time, refreshed every `interval` ms so wait clocks keep ticking. */
export function useNow(interval = 15000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(timer);
  }, [interval]);
  return now;
}
