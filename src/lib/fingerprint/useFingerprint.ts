"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "bhandara.fp";

export function useFingerprint(): string | null {
  const [fp, setFp] = useState<string | null>(null);

  useEffect(() => {
    const cached = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (cached) {
      setFp(cached);
      return;
    }
    let cancelled = false;
    (async () => {
      const FP = (await import("@fingerprintjs/fingerprintjs")).default;
      const agent = await FP.load();
      const result = await agent.get();
      if (cancelled) return;
      window.localStorage.setItem(STORAGE_KEY, result.visitorId);
      setFp(result.visitorId);
    })().catch(() => {
      const fallback = `anon-${Math.random().toString(36).slice(2, 10)}`;
      if (!cancelled) {
        window.localStorage.setItem(STORAGE_KEY, fallback);
        setFp(fallback);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return fp;
}
