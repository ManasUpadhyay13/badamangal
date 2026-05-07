"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const PinDropMap = dynamic(() => import("./PinDropMap"), { ssr: false });

export type Coord = { lat: number; lng: number };

export default function LocationPicker({
  value,
  onChange,
}: {
  value: Coord | null;
  onChange: (c: Coord | null) => void;
}) {
  const [mode, setMode] = useState<"geo" | "pin">("geo");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function detect() {
    if (!navigator.geolocation) {
      setError("Your browser does not support location.");
      return;
    }
    setBusy(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setBusy(false);
      },
      (err) => {
        setError(err.message || "Could not detect your location.");
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 15_000 }
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Label>Where is the bhandara?</Label>
      <RadioGroup
        value={mode}
        onValueChange={(v) => setMode(v as "geo" | "pin")}
        className="flex flex-row gap-6"
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem id="locmode-geo" value="geo" />
          <Label htmlFor="locmode-geo">Use my location</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem id="locmode-pin" value="pin" />
          <Label htmlFor="locmode-pin">Pick on map</Label>
        </div>
      </RadioGroup>

      {mode === "geo" ? (
        <Button type="button" variant="outline" onClick={detect} disabled={busy}>
          {busy ? "Detecting…" : value ? "Re-detect" : "Detect now"}
        </Button>
      ) : (
        <PinDropMap value={value} onChange={(c) => onChange(c)} />
      )}

      {value && (
        <p className="text-sm text-muted-foreground">
          Pinned at {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
