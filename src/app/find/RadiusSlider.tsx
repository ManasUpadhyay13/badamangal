"use client";

import { Slider } from "@/components/ui/slider";
import { useRef, useState } from "react";

export default function RadiusSlider({
  value,
  onCommit,
  disabled,
}: {
  value: number;
  onCommit: (next: number) => void;
  disabled?: boolean;
}) {
  const [local, setLocal] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  const timer = useRef<number | null>(null);

  // Sync local state when the prop changes from outside (e.g., reset).
  if (value !== lastValue) {
    setLastValue(value);
    setLocal(value);
  }

  const display = local < 1000 ? `${local} m` : `${(local / 1000).toFixed(1)} km`;

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-full bg-saffron-50 border border-saffron-100">
      <span className="text-sm text-muted-foreground min-w-[64px]">Within {display}</span>
      <Slider
        value={[local]}
        min={50}
        max={5000}
        step={50}
        onValueChange={(vals) => {
          const next = Array.isArray(vals) ? (vals[0] ?? 50) : vals;
          setLocal(next);
          if (timer.current) window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => onCommit(next), 300);
        }}
        disabled={disabled}
        aria-label="Search radius"
        className="flex-1"
      />
    </div>
  );
}
