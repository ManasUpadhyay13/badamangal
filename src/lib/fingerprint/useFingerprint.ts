"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "bhandara.fp";

function readCached(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function useFingerprint(): string | null {
  const [fp, setFp] = useState<string | null>(() => readCached());

  useEffect(() => {
    if (fp) return;
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
  }, [fp]);

  return fp;
}
