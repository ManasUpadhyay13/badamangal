"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import LocationPicker, { type Coord } from "./LocationPicker";
import PhotoInput from "./PhotoInput";
import ResultModals, { type Result } from "./ResultModals";
import { useFingerprint } from "@/lib/fingerprint/useFingerprint";
import { istDateRange } from "@/lib/ist/time";

export default function PostForm() {
  const router = useRouter();
  const fp = useFingerprint();
  const { min, max } = useMemo(() => istDateRange(), []);

  const [coord, setCoord] = useState<Coord | null>(null);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const valid = Boolean(
    coord &&
      name.trim().length > 0 &&
      date >= min &&
      date <= max &&
      start &&
      end &&
      end > start &&
      fp
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || !coord || !fp) return;
    setSubmitting(true);
    setSubmitError(null);
    setResult(null);

    const fd = new FormData();
    fd.set("name", name.trim());
    fd.set("lat", String(coord.lat));
    fd.set("lng", String(coord.lng));
    fd.set("event_date", date);
    fd.set("start_time", start);
    fd.set("end_time", end);
    if (photo) fd.set("photo", photo, "photo.jpg");

    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        body: fd,
        headers: { "x-device-fingerprint": fp },
      });
      if (res.status === 201) {
        router.push("/find?submitted=1");
        return;
      }
      if (res.status === 422) {
        const body = await res.json();
        setResult({ kind: "rejected", reason: body.reason ?? "Photo did not match." });
      } else if (res.status === 429) {
        const body = await res.json();
        setResult({
          kind: "rate_limited",
          retryAt: new Date(Date.now() + (body.retry_after_seconds ?? 3600) * 1000),
        });
      } else if (res.status === 502) {
        setSubmitError("Validation service is temporarily unavailable. Please try again.");
      } else if (res.status === 400) {
        const body = await res.json();
        setSubmitError(
          Object.entries(body.errors ?? {})
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
            .join("; ") || "Invalid submission"
        );
      } else {
        setSubmitError(`Unexpected error (${res.status}).`);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="max-w-xl mx-auto px-4 pb-16 pt-6 flex flex-col gap-5" onSubmit={onSubmit}>
      <h1 className="text-2xl font-bold text-saffron-700 m-0">Post a Bhandara</h1>

      <LocationPicker value={coord} onChange={setCoord} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Event name</Label>
        <Input
          id="name"
          type="text"
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Hanuman Mandir Bhandara"
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="date">Event date</Label>
        <Input
          id="date"
          type="date"
          min={min}
          max={max}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="start">Start time</Label>
          <Input
            id="start"
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="end">End time</Label>
          <Input
            id="end"
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            required
          />
        </div>
      </div>

      <PhotoInput onChange={setPhoto} />

      {submitError && (
        <p role="alert" className="text-sm text-destructive">
          {submitError}
        </p>
      )}

      {!valid && !submitting && (
        <p className="text-sm text-muted-foreground">
          Fill all required fields above (location, name, date, both times) to submit. Photo is optional but adds trust.
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={!valid || submitting}>
          {submitting ? "Submitting…" : "Submit Bhandara"}
        </Button>
      </div>

      <ResultModals
        result={result}
        onDismiss={() => setResult(null)}
        onRetry={() => {
          setResult(null);
          setPhoto(null);
        }}
      />
    </form>
  );
}
